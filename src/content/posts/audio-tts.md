---
title: "신경망 음성 합성(TTS): VITS·XTTS·CosyVoice 완전 해설"
description: "멜 스펙트로그램 생성·보코더 구조, FastSpeech2·VITS·XTTS·CosyVoice 아키텍처, Python TTS 실전 코드, 한국어 TTS 모델 비교까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["TTS", "음성합성", "VITS", "XTTS", "CosyVoice", "FastSpeech2", "HiFi-GAN", "보코더"]
featured: false
draft: false
---

[지난 글](/posts/audio-asr/)에서 Whisper 기반 자동 음성 인식(ASR)을 완전 해설했다. 이번 글에서는 그 반대 방향인 **음성 합성(TTS, Text-to-Speech)**을 다룬다. 텍스트를 자연스러운 음성으로 변환하는 TTS는 2016년 WaveNet 이후 딥러닝 혁명을 거쳐 이제 인간과 구분하기 어려운 수준에 도달했다. 특히 VITS, XTTS, CosyVoice로 이어지는 최신 모델들은 단일 파이프라인으로 텍스트를 직접 파형으로 변환하고, 단 3초의 참조 음성만으로 어떤 화자의 목소리도 복제할 수 있다.

## TTS 파이프라인 전체 구조

![TTS 파이프라인: 텍스트 → 음성](/assets/posts/audio-tts-pipeline.svg)

TTS 시스템은 크게 두 단계로 구성된다. **음향 모델(Acoustic Model)**이 텍스트를 멜 스펙트로그램으로 변환하고, **보코더(Vocoder)**가 멜 스펙트로그램을 실제 음성 파형으로 복원한다. 최근에는 이 두 단계를 하나로 합친 End-to-End 모델이 주류가 되었다.

전통적 파이프라인에서는 텍스트 전처리 → G2P(Grapheme-to-Phoneme) 변환 → 음향 모델 → 보코더 순으로 진행된다. G2P는 "안녕"을 "ㅏㄴㄴㅕㅇ"처럼 음소 시퀀스로 변환하는 과정이다. 한국어는 음절 구조가 복잡하고 연음·경음화 등 발음 규칙이 있어 G2P 품질이 TTS 자연스러움에 직결된다.

## 음향 모델: 텍스트 → 멜 스펙트로그램

### FastSpeech2: 병렬 생성의 혁신

FastSpeech2는 2020년 Microsoft Research가 발표한 비자기회귀(Non-Autoregressive) 음향 모델이다. 기존 Tacotron2가 음소를 하나씩 순차 생성했던 것과 달리, FastSpeech2는 **모든 음소의 멜 프레임을 병렬로 동시에 생성**해 추론 속도가 수십 배 빠르다.

핵심은 **Duration Predictor**다. 각 음소가 몇 프레임 동안 지속되는지 예측한 뒤, 그 길이만큼 음소 임베딩을 확장(Length Regulator)해 멜 시퀀스와 정렬한다. 여기에 **Pitch Predictor**와 **Energy Predictor**를 추가해 피치(높낮이)와 에너지(강도)를 명시적으로 제어할 수 있다.

```python
from transformers import SpeechT5Processor, SpeechT5ForTextToSpeech
from transformers import SpeechT5HifiGan
import torch
import soundfile as sf

# SpeechT5: FastSpeech2 계열 HuggingFace 모델
processor = SpeechT5Processor.from_pretrained("microsoft/speecht5_tts")
model = SpeechT5ForTextToSpeech.from_pretrained("microsoft/speecht5_tts")
vocoder = SpeechT5HifiGan.from_pretrained("microsoft/speecht5_hifigan")

# 화자 임베딩 로드 (xvector)
from datasets import load_dataset
embeddings_dataset = load_dataset(
    "Matthijs/cmu-arctic-xvectors", split="validation"
)
speaker_embeddings = torch.tensor(
    embeddings_dataset[7306]["xvector"]
).unsqueeze(0)

inputs = processor(text="Hello, nice to meet you.", return_tensors="pt")

# 음성 생성
with torch.no_grad():
    speech = model.generate_speech(
        inputs["input_ids"],
        speaker_embeddings,
        vocoder=vocoder
    )

sf.write("speecht5_output.wav", speech.numpy(), samplerate=16000)
```

### 지속 시간·피치·에너지 제어

FastSpeech2의 강점은 합성 속도(Duration), 피치, 에너지를 수치로 직접 제어할 수 있다는 점이다. 같은 텍스트라도 Duration을 늘리면 느리게, 피치를 올리면 더 높은 음성으로 합성할 수 있다. 이 특성은 감정 표현, 강조, 억양 조절에 활용된다.

## 보코더: 멜 스펙트로그램 → 파형

### HiFi-GAN: 실시간 고품질 보코더

2020년 발표된 HiFi-GAN은 GAN(Generative Adversarial Network) 기반 보코더로, 이전 WaveNet·WaveGlow 대비 **수백 배 빠른 속도**와 유사한 품질을 달성했다. 생성기(Generator)는 멜 스펙트로그램을 입력받아 파형을 생성하고, 다중 스케일 판별기(Multi-Scale Discriminator)와 다중 주기 판별기(Multi-Period Discriminator)가 진짜 음성과 구분하도록 학습한다.

| 보코더 | 방식 | 실시간 배율 | 음질(MOS) |
|--------|------|------------|---------|
| WaveNet | 자기회귀 | ~0.003× | 4.21 |
| WaveGlow | Flow 기반 | ~25× | 4.10 |
| HiFi-GAN V1 | GAN | ~167× | 4.22 |
| HiFi-GAN V2 | GAN | ~251× | 4.17 |

### WaveNet과의 비교

WaveNet(2016, DeepMind)은 최초의 딥러닝 고품질 보코더로, 음소 하나씩 자기회귀 방식으로 파형 샘플을 생성한다. 품질은 탁월하지만 1초 음성 생성에 수십 초가 걸려 실시간 활용이 불가능했다. HiFi-GAN은 이 문제를 GAN으로 해결해 현재 TTS 시스템의 표준 보코더 자리를 차지하고 있다.

## End-to-End TTS: VITS

VITS(Variational Inference with adversarial learning for end-to-end Text-to-Speech, 2021)는 음향 모델과 보코더를 하나의 모델로 통합한 가장 영향력 있는 아키텍처다.

### VAE + Normalizing Flow + GAN

VITS의 핵심은 세 가지 생성 모델의 결합이다.

- **VAE (Variational Autoencoder)**: 음성의 잠재 표현 z를 학습. 음향 prior와 posterior를 일치시켜 텍스트에서 자연스러운 잠재 표현을 샘플링
- **Normalizing Flow**: 간단한 prior 분포를 복잡한 음향 분포로 변환. 피치·발음 변이를 표현
- **GAN Discriminator**: HiFi-GAN의 판별기로 파형 품질 향상

이 구조 덕분에 VITS는 **텍스트에서 직접 파형을 생성**하면서도 Tacotron2+WaveGlow 조합보다 높은 MOS를 달성했다. 또한 확률적 샘플링으로 같은 텍스트에서도 매번 자연스럽게 다른 억양과 운율을 생성한다.

```python
# VITS (HuggingFace Transformers)
from transformers import VitsModel, AutoTokenizer
import torch
import scipy

model = VitsModel.from_pretrained("facebook/mms-tts-kor")
tokenizer = AutoTokenizer.from_pretrained("facebook/mms-tts-kor")

text = "안녕하세요, 오늘 날씨가 참 좋네요."
inputs = tokenizer(text, return_tensors="pt")

with torch.no_grad():
    output = model(**inputs).waveform

# 파형을 WAV 파일로 저장
scipy.io.wavfile.write(
    "vits_ko.wav",
    rate=model.config.sampling_rate,
    data=output.float().numpy().squeeze()
)
```

## 다국어·제로샷 TTS: XTTS와 CosyVoice

### XTTS-v2: 화자 복제의 대중화

Coqui TTS의 XTTS-v2(2023)는 **17개 언어**를 지원하는 다국어 제로샷 TTS 모델이다. GPT-2 스타일의 자기회귀 모델이 텍스트 토큰을 음성 토큰으로 변환하고, 전용 디코더가 파형을 생성한다. 가장 큰 특징은 **3~6초의 참조 음성만으로 그 화자의 목소리를 복제**할 수 있는 Voice Cloning 기능이다.

화자 복제 과정은 이렇다. 참조 음성에서 화자 임베딩(Speaker Embedding)을 추출하고, 이를 조건 벡터로 사용해 새로운 텍스트를 해당 화자 스타일로 합성한다. 학습 데이터에 없는 화자도 추론 시점에 즉시 적용되므로 "제로샷(Zero-shot)"이라 부른다.

### CosyVoice: LLM 기반 차세대 TTS

Alibaba의 CosyVoice(2024)는 대형 언어 모델(LLM)과 Flow Matching을 결합한 최신 TTS 아키텍처다. **감정과 스타일을 자연어로 지시**할 수 있는 것이 차별점이다. "행복하게", "슬프게", "속삭이듯" 같은 지시어를 텍스트 프롬프트로 전달하면 그에 맞는 음성을 합성한다.

CosyVoice 300M 모델은 중국어·영어·한국어·일본어를 지원하며, XTTS-v2보다 더 자연스러운 운율과 감정 표현으로 평가받는다. 특히 긴 문장에서의 숨 쉬기(Breathing), 강세, 속도 변화가 자연스럽다.

## 실전 코드

![XTTS-v2 한국어 음성 합성 예시](/assets/posts/audio-tts-code.svg)

```python
from TTS.api import TTS

# XTTS-v2 모델 로드 (다국어 지원)
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2")
tts.to("cuda")

# 한국어 음성 합성 (화자 복제)
tts.tts_to_file(
    text="안녕하세요, 반갑습니다. 오늘 날씨가 참 좋네요.",
    speaker_wav="reference.wav",  # 3~6초 참조 음성
    language="ko",
    file_path="output.wav"
)

# 화자 목록 조회 (내장 화자 사용 시)
print(tts.speakers)

# 내장 화자로 생성
tts.tts_to_file(
    text="Hello, how are you today?",
    speaker="Ana Florence",
    language="en",
    file_path="output_en.wav"
)
```

```python
# CosyVoice 예시 (pip install cosyvoice)
from cosyvoice.cli.cosyvoice import CosyVoice
from cosyvoice.utils.file_utils import load_wav
import torchaudio

cosyvoice = CosyVoice('pretrained_models/CosyVoice-300M')

# 제로샷 화자 복제
prompt_speech = load_wav('reference.wav', 16000)
for result in cosyvoice.inference_zero_shot(
    tts_text='반갑습니다. 좋은 하루 보내세요.',
    prompt_text='안녕하세요.',   # 참조 음성의 텍스트
    prompt_speech_16k=prompt_speech
):
    torchaudio.save('cosyvoice_output.wav',
                    result['tts_speech'], 22050)

# 감정 제어 (Instruct 모드)
for result in cosyvoice.inference_instruct(
    tts_text='반갑습니다.',
    spk_id='중문여',
    instruct_text='행복하고 밝은 목소리로 말해주세요'
):
    torchaudio.save('cosyvoice_happy.wav',
                    result['tts_speech'], 22050)
```

## 한국어 TTS 모델 비교

한국어 TTS는 영어 대비 모델 선택지가 제한적이지만, 최근 다국어 모델이 한국어 품질을 빠르게 향상시키고 있다.

| 모델 | 오픈소스 | 한국어 지원 | 화자 복제 | 특징 |
|------|--------|-----------|---------|------|
| XTTS-v2 | ✓ | 17개 언어 포함 | ✓ | 실용적, 가장 많이 사용 |
| CosyVoice-300M | ✓ | 4개 언어 | ✓ | 감정 제어, 최신 품질 |
| MeloTTS | ✓ | 한국어 포함 | ✗ | 경량, 실시간 가능 |
| Kakao i TTS | ✗ | 한국어 특화 | ✗ | 상용, 최고 한국어 품질 |
| Naver Clova | ✗ | 한국어 특화 | ✗ | 상용, API 제공 |
| ElevenLabs | ✗ | 다국어 | ✓ | 상용, 세계 최고 수준 |

오픈소스 선택에서는 **XTTS-v2**가 설치 편의성, 한국어 품질, 화자 복제 기능의 균형이 가장 좋다. 영어 우선 프로젝트에는 ElevenLabs API, 한국어 전용 서비스에는 Clova/Kakao API가 적합하다.

## 평가 지표: MOS·WER·자연스러움

TTS 품질 평가는 크게 주관 평가와 객관 평가로 나뉜다.

**MOS (Mean Opinion Score)**: 1~5점 척도의 인간 주관 평가. 5명 이상의 평가자가 자연스러움, 명료성, 유사성(화자 복제 시)을 평가. 현재 최고 TTS는 MOS 4.3~4.5 수준으로, 실제 인간 음성(~4.5)에 근접했다.

**WER (Word Error Rate)**: 합성 음성을 ASR로 재인식해 오류율 측정. 발음 명료성 지표.

**자동 평가**: UTMOS(유사도 예측 모델), SpeakerSim(화자 유사도), F0 RMSE(피치 정확도) 등 모델 기반 자동 평가 도구가 빠르게 발전하고 있다. 실무에서는 MOS 측정에 수반되는 비용·시간 문제 때문에 UTMOS를 프록시 지표로 활용한다.

---

**지난 글:** [자동 음성 인식(ASR): Whisper와 스트리밍 음성 처리 완전 해설](/posts/audio-asr/)

**다음 글:** [AI 음악 생성: MusicGen·AudioCraft·Suno AI 완전 해설](/posts/audio-music-generation/)

<br>
읽어주셔서 감사합니다. 😊
