---
title: "자동 음성 인식(ASR): Whisper와 스트리밍 음성 처리 완전 해설"
description: "멜 스펙트로그램·CTC·Whisper Encoder-Decoder 구조, faster-whisper 실전 코드, VAD 기반 스트리밍 ASR, 한국어 특화 모델 비교까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["ASR", "Whisper", "음성인식", "멜스펙트로그램", "faster-whisper", "스트리밍ASR", "VAD", "한국어ASR"]
featured: false
draft: false
---

[지난 글](/posts/cv-3d-generation/)에서 NeRF·3DGS 등 3D 생성 AI를 다뤘다. 이번 글부터는 오디오 AI 영역으로 넘어가, **자동 음성 인식(ASR)**의 원리와 실전 구현을 완전 해설한다. Whisper는 2022년 OpenAI가 공개한 이후 오픈소스 ASR의 사실상 표준이 되었으며, 100여 개 언어에서 인간 수준에 가까운 성능을 보인다.

## ASR 파이프라인 전체 구조

![ASR 파이프라인](/assets/posts/audio-asr-pipeline.svg)

ASR은 크게 세 단계로 구성된다. 먼저 원시 오디오 파형을 **멜 스펙트로그램**으로 변환하고, **오디오 인코더**가 음향 특징을 추출하며, **텍스트 디코더**가 자기회귀 방식으로 텍스트를 생성한다.

## 멜 스펙트로그램: 오디오를 이미지로

인간의 청각 시스템은 주파수를 로그 스케일로 인식한다. 멜 스펙트로그램은 STFT(단시간 푸리에 변환)로 주파수 분포를 구한 뒤, 멜 필터뱅크로 로그 스케일 주파수 표현으로 변환한다.

```python
import librosa
import numpy as np
import matplotlib.pyplot as plt

def audio_to_mel(
    audio_path: str,
    sr: int = 16000,
    n_mels: int = 80,
    n_fft: int = 400,      # 25ms 윈도우 (16kHz × 0.025)
    hop_length: int = 160,  # 10ms 스텝
) -> np.ndarray:
    """오디오 파일 → 멜 스펙트로그램"""
    y, _ = librosa.load(audio_path, sr=sr, mono=True)

    # 멜 스펙트로그램 계산
    mel = librosa.feature.melspectrogram(
        y=y, sr=sr,
        n_fft=n_fft,
        hop_length=hop_length,
        n_mels=n_mels,
        fmin=0,
        fmax=8000,
    )

    # log 스케일 변환
    log_mel = librosa.power_to_db(mel, ref=np.max)

    # [-1, 1] 정규화
    log_mel = (log_mel - log_mel.mean()) / (log_mel.std() + 1e-8)

    return log_mel  # (n_mels, T) = (80, T)


mel = audio_to_mel("speech.wav")
print(f"멜 스펙트로그램 shape: {mel.shape}")
# → (80, 1501) for 15초 오디오
```

## Whisper 기본 사용법

```python
import whisper

# 모델 로드 (tiny/base/small/medium/large-v3/turbo)
model = whisper.load_model("turbo")

# 기본 전사
result = model.transcribe(
    "meeting.mp3",
    language="ko",           # 언어 지정 (생략 시 자동 감지)
    task="transcribe",       # 또는 "translate" (영어로 번역)
    fp16=True,
    beam_size=5,
    best_of=5,
    temperature=0,           # 결정적 디코딩 (변동성 없음)
    word_timestamps=True,    # 단어별 타임스탬프
    verbose=True,
)

print(result["text"])
print(f"언어: {result['language']}")

# 세그먼트별 타임스탬프
for seg in result["segments"]:
    print(f"[{seg['start']:.1f}s ~ {seg['end']:.1f}s] {seg['text']}")
```

## faster-whisper: 실전 속도 최적화

`faster-whisper`는 CTranslate2 INT8 양자화로 원본 대비 2~4배 빠르고, VRAM도 절반 이하다.

```python
from faster_whisper import WhisperModel

# INT8 양자화 (CPU 또는 GPU)
model = WhisperModel(
    "large-v3",
    device="cuda",
    compute_type="int8_float16",  # GPU: int8_float16, CPU: int8
)

segments, info = model.transcribe(
    "audio.mp3",
    language="ko",
    beam_size=5,
    best_of=5,
    vad_filter=True,        # 내장 VAD로 무음 구간 건너뜀
    vad_parameters={
        "min_silence_duration_ms": 500,
    },
    word_timestamps=True,
)

print(f"감지 언어: {info.language} (신뢰도 {info.language_probability:.2f})")

full_text = ""
for seg in segments:
    full_text += seg.text
    print(f"[{seg.start:.1f}~{seg.end:.1f}] {seg.text}")

print("\n전체 전사:")
print(full_text)
```

## 실시간 스트리밍 ASR

![실시간 스트리밍 ASR 아키텍처](/assets/posts/audio-asr-streaming.svg)

Whisper 자체는 배치 처리 모델이지만, VAD + 슬라이딩 윈도우 방식으로 실시간 스트리밍을 구현할 수 있다.

```python
import asyncio
import queue
import threading
import numpy as np
import sounddevice as sd
from faster_whisper import WhisperModel

class RealtimeASR:
    def __init__(
        self,
        model_size: str = "turbo",
        device: str = "cuda",
        chunk_duration: float = 2.0,   # 초 단위 청크
        overlap: float = 0.5,           # 겹침
        sample_rate: int = 16000,
    ):
        self.model = WhisperModel(
            model_size, device=device,
            compute_type="int8_float16"
        )
        self.sr = sample_rate
        self.chunk_size = int(chunk_duration * sample_rate)
        self.overlap_size = int(overlap * sample_rate)
        self.audio_queue = queue.Queue()
        self.buffer = np.array([], dtype=np.float32)
        self.running = False

    def audio_callback(
        self,
        indata: np.ndarray,
        frames: int,
        time,
        status,
    ):
        """sounddevice 콜백: 오디오 캡처 → 큐에 추가"""
        if status:
            print(f"오디오 상태: {status}")
        self.audio_queue.put(indata[:, 0].copy())

    def transcription_worker(self):
        """별도 스레드: 큐에서 오디오 가져와 전사"""
        while self.running:
            try:
                chunk = self.audio_queue.get(timeout=0.1)
                self.buffer = np.append(self.buffer, chunk)

                if len(self.buffer) >= self.chunk_size:
                    # 현재 청크 + 겹침 영역 추출
                    audio_chunk = self.buffer[:self.chunk_size].copy()

                    # Whisper로 전사
                    segments, _ = self.model.transcribe(
                        audio_chunk,
                        language="ko",
                        beam_size=3,
                        vad_filter=True,
                    )
                    text = "".join(s.text for s in segments).strip()
                    if text:
                        print(f"[실시간] {text}")

                    # 겹침 보존 후 버퍼 슬라이딩
                    self.buffer = self.buffer[
                        self.chunk_size - self.overlap_size:
                    ]

            except queue.Empty:
                continue

    def start(self):
        """마이크 입력 시작"""
        self.running = True
        worker = threading.Thread(
            target=self.transcription_worker, daemon=True
        )
        worker.start()

        with sd.InputStream(
            samplerate=self.sr,
            channels=1,
            dtype="float32",
            callback=self.audio_callback,
            blocksize=int(self.sr * 0.1),  # 100ms 블록
        ):
            print("실시간 음성 인식 시작 (Ctrl+C로 종료)")
            while self.running:
                asyncio.get_event_loop().run_until_complete(
                    asyncio.sleep(0.1)
                )

    def stop(self):
        self.running = False


# 사용법
asr = RealtimeASR(model_size="turbo")
try:
    asr.start()
except KeyboardInterrupt:
    asr.stop()
```

## 한국어 특화 ASR 모델 비교

| 모델 | 파라미터 | 한국어 WER | 특징 |
|------|----------|-----------|------|
| Whisper large-v3 | 1550M | ~6% | 다국어, 범용 |
| Whisper turbo | 809M | ~7% | 속도·품질 균형 ★ |
| ClovaNote-ASR | 미공개 | ~4% | 한국어 특화, 상용 |
| ETRI-AI BERT+CTC | 350M | ~8% | 오픈소스 한국어 |
| wav2vec2-large-xlsr-korean | 317M | ~10% | HuggingFace 공개 |

실무에서는 **Whisper turbo**를 기본으로 쓰고, 한국어 회의록·의료·법률 등 도메인 특화가 필요하면 Whisper를 한국어 도메인 데이터로 파인튜닝하는 것이 가장 효과적이다.

## Whisper 파인튜닝 (HuggingFace)

```python
from transformers import (
    WhisperProcessor, WhisperForConditionalGeneration,
    Seq2SeqTrainer, Seq2SeqTrainingArguments,
)
from datasets import load_dataset

# KsponSpeech 한국어 음성 데이터셋
dataset = load_dataset(
    "audiofolder",
    data_dir="kspon_speech/",
    split="train",
)

processor = WhisperProcessor.from_pretrained(
    "openai/whisper-small",
    language="Korean",
    task="transcribe",
)

def preprocess(batch):
    audio = batch["audio"]
    batch["input_features"] = processor(
        audio["array"],
        sampling_rate=audio["sampling_rate"],
        return_tensors="pt",
    ).input_features[0]
    batch["labels"] = processor.tokenizer(batch["sentence"]).input_ids
    return batch

dataset = dataset.map(preprocess, remove_columns=dataset.column_names)

model = WhisperForConditionalGeneration.from_pretrained(
    "openai/whisper-small"
)
model.config.forced_decoder_ids = None
model.config.suppress_tokens = []

training_args = Seq2SeqTrainingArguments(
    output_dir="whisper-ko-finetuned",
    num_train_epochs=3,
    per_device_train_batch_size=16,
    learning_rate=1e-5,
    warmup_steps=500,
    predict_with_generate=True,
    fp16=True,
    save_strategy="epoch",
)

trainer = Seq2SeqTrainer(
    model=model,
    args=training_args,
    train_dataset=dataset,
    tokenizer=processor.feature_extractor,
)
trainer.train()
```

## 실전 활용 팁

**회의 자동 자막**: `faster-whisper` + 화자 분리(pyannote-audio) 조합으로 "누가 무슨 말을 했는지" 자동 기록.

**자막 파일 생성**: Whisper의 타임스탬프 출력을 SRT/VTT 파일로 변환.

```python
def segments_to_srt(segments, output_path: str):
    """Whisper 세그먼트 → SRT 자막 파일"""
    def fmt(t: float) -> str:
        h = int(t // 3600)
        m = int((t % 3600) // 60)
        s = int(t % 60)
        ms = int((t % 1) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    with open(output_path, "w", encoding="utf-8") as f:
        for i, seg in enumerate(segments, 1):
            f.write(f"{i}\n")
            f.write(f"{fmt(seg.start)} --> {fmt(seg.end)}\n")
            f.write(f"{seg.text.strip()}\n\n")
```

다음 글에서는 음성 합성(TTS) 기술, 특히 VITS·XTTS·CosyVoice 등 신경망 기반 음성 합성 모델을 완전 해설한다.

---

**지난 글:** [3D 생성 AI: NeRF·3D Gaussian Splatting·Point-E 완전 해설](/posts/cv-3d-generation/)

**다음 글:** [신경망 음성 합성(TTS): VITS·XTTS·CosyVoice 완전 해설](/posts/audio-tts/)

<br>
읽어주셔서 감사합니다. 😊
