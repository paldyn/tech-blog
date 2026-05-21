---
title: "AI 음악 생성: MusicGen·AudioCraft·Suno AI 완전 해설"
description: "오디오 토큰화·EnCodec 구조, MusicGen 자기회귀 생성, AudioCraft·Stable Audio·Suno AI 비교, Python MusicGen 실전 코드까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["MusicGen", "AudioCraft", "Suno AI", "음악생성", "EnCodec", "오디오토큰화", "Stable Audio"]
featured: false
draft: false
---

[지난 글](/posts/audio-tts/)에서 VITS·XTTS·CosyVoice 등 신경망 음성 합성 기술을 살펴봤다. 이번 글에서는 한 단계 더 나아가 **AI 음악 생성(Music Generation)**을 다룬다. 2023년 Meta의 MusicGen 공개는 텍스트 한 줄로 고품질 음악을 만들어내는 시대를 열었다. 같은 해 Suno AI는 가사·멜로디·편곡·보컬을 통합 생성하는 상용 서비스를 출시해 큰 반향을 일으켰다. 오디오 AI의 최전선인 음악 생성 기술의 원리와 실전 구현을 완전 해설한다.

## 오디오 표현: 파형에서 토큰까지

언어 모델이 텍스트를 토큰으로 처리하듯, 음악 생성 모델은 오디오를 **토큰**으로 변환해 처리한다. 오디오는 초당 수만 개의 샘플(22050Hz, 44100Hz 등)로 구성된 고차원 시계열이기 때문에, 이를 직접 Transformer에 입력하는 것은 계산 비용이 극도로 높다. 오디오 토큰화는 이 문제를 해결하는 핵심 기술이다.

### EnCodec: 신경망 오디오 코덱

Meta가 2022년 발표한 **EnCodec**은 오디오를 이산 토큰 시퀀스로 압축하는 신경망 오디오 코덱이다. 기존 MP3/AAC 같은 전통 코덱과 달리, 신경망 인코더-디코더 구조로 학습되어 훨씬 낮은 비트레이트에서도 자연스러운 품질을 유지한다.

EnCodec 인코더는 오디오 파형을 받아 연속 잠재 벡터로 압축하고, 이를 **RVQ(Residual Vector Quantization)**로 이산 토큰으로 변환한다.

### RVQ: 계층적 이산 표현

RVQ는 양자화 오류를 단계적으로 줄이는 구조다. 첫 번째 코드북이 대략적 표현을 담당하고, 이후 코드북들이 순서대로 잔차(residual)를 정밀하게 표현한다. MusicGen에서 EnCodec은 초당 50개 토큰을 생성하며, 4개의 코드북을 사용하므로 초당 200개 토큰이 된다.

```python
import torchaudio
from audiocraft.models import EncodecModel
from audiocraft.data.audio_utils import convert_audio

# EnCodec 모델 로드
encodec = EncodecModel.encodec_model_24khz()
encodec.set_target_bandwidth(6.0)  # 6 kbps

# 오디오 로드 및 전처리
wav, sr = torchaudio.load("input.wav")
wav = convert_audio(wav, sr, encodec.sample_rate, encodec.channels)
wav = wav.unsqueeze(0)  # (1, C, T)

# 인코딩: 오디오 → RVQ 토큰
with torch.no_grad():
    encoded_frames = encodec.encode(wav)

# encoded_frames: 코드북 토큰 시퀀스
codes = torch.cat([e[0] for e in encoded_frames], dim=-1)
print(f"토큰 shape: {codes.shape}")  # (1, 4, T)

# 디코딩: 토큰 → 오디오 재구성
with torch.no_grad():
    decoded = encodec.decode(encoded_frames)

torchaudio.save("reconstructed.wav", decoded[0], encodec.sample_rate)
```

## MusicGen 아키텍처

![MusicGen 음악 생성 파이프라인](/assets/posts/audio-music-generation-pipeline.svg)

### Transformer 기반 자기회귀 생성

MusicGen의 핵심은 EnCodec 토큰을 예측하는 **Transformer 디코더**다. 기존 언어 모델이 다음 단어를 예측하듯, MusicGen은 다음 오디오 토큰을 순서대로 예측한다.

문제는 RVQ의 4개 코드북을 어떻게 처리하느냐다. 각 시간 단계에서 4개의 토큰을 동시에 처리해야 하는데, MusicGen은 **병렬 디코딩(Parallel Decoding)** 방식을 채택한다. 각 코드북 레벨을 독립적으로 예측하는 대신, 이전 코드북의 정보를 현재 코드북 예측에 활용하는 계층적 예측을 수행한다.

### 텍스트 조건부 생성 (T5 인코더)

텍스트 프롬프트는 **T5 인코더**로 처리된다. T5가 텍스트를 벡터 시퀀스로 인코딩하면, MusicGen Transformer가 Cross-Attention으로 이 정보를 참조하면서 오디오 토큰을 생성한다. "happy rock music with electric guitar and drums"처럼 구체적일수록 원하는 음악에 가까운 결과를 얻는다.

MusicGen은 파라미터 크기에 따라 small(300M), medium(1.5B), large(3.3B) 세 변형을 제공하며, 최대 30초 분량의 음악을 Mono 또는 Stereo로 생성할 수 있다.

## AudioCraft 생태계

AudioCraft는 MusicGen을 포함한 Meta의 오디오 생성 프레임워크다. 세 가지 모델로 구성된다.

**MusicGen**: 텍스트 또는 멜로디 조건부 음악 생성. 이미 설명한 Transformer + EnCodec 구조.

**AudioGen**: 환경음·효과음 생성에 특화된 모델. "빗소리", "숲속 새 소리", "도시 교통 소음" 등 텍스트 설명으로 효과음을 생성한다. MusicGen과 같은 아키텍처지만 음악 대신 오디오 이벤트 데이터셋으로 학습되었다.

**EnCodec**: 위에서 설명한 신경망 오디오 코덱. 독립적으로도 사용 가능하며, 오디오 압축·스트리밍 용도로도 활용된다.

```python
# AudioGen 효과음 생성
from audiocraft.models import AudioGen
import torchaudio

model = AudioGen.get_pretrained('facebook/audiogen-medium')
model.set_generation_params(duration=5)  # 5초

descriptions = [
    'dog barking in the distance',
    '비오는 날 빗소리와 천둥',
    'crowded coffee shop ambience'
]

wav = model.generate(descriptions)

for i, audio in enumerate(wav):
    torchaudio.save(f"audio_{i}.wav", audio.cpu(), 16000)
```

## 확산 기반 음악 생성: Stable Audio

Stability AI의 **Stable Audio**(2023)는 MusicGen과 다른 접근법인 **Latent Diffusion**을 음악 생성에 적용한다.

### Latent Diffusion + 길이 조건부

Stable Audio는 오디오를 VAE로 잠재 공간에 압축한 뒤, Latent Diffusion Model(LDM)로 노이즈에서 잠재 표현을 생성하고, VAE 디코더로 오디오를 복원한다. 텍스트 조건화는 CLAP(Contrastive Language-Audio Pretraining) 임베딩을 사용한다.

MusicGen 대비 Stable Audio의 강점은 **생성 길이 조건부**다. 원하는 음악 길이를 명시적으로 지정할 수 있어 44.1kHz 고음질 기준 최대 95초 음악을 생성할 수 있다. 고음질 오디오 생성에서 Stable Audio 2.0은 MusicGen large를 능가하는 것으로 평가된다.

### AudioLDM2와의 비교

AudioLDM2(2023, 카이스트)는 음악·음성·효과음을 모두 생성할 수 있는 통합 Latent Diffusion 모델이다. 잠재 공간에서 오디오 언어 모델(AudioMAE)로 표현을 학습한 뒤, LDM이 조건부 생성을 수행한다. 오픈소스 통합 오디오 생성 모델로 연구·프로토타이핑에 자주 활용된다.

## 상용 AI 음악: Suno AI와 Udio

### Suno AI: 가사·멜로디·편곡 통합 생성

Suno AI(2023)는 가장 인상적인 AI 음악 생성 상용 서비스다. 텍스트 프롬프트만으로 **가사, 멜로디, 화음, 편곡, 보컬까지** 완전한 노래를 2분 분량으로 생성한다.

기술적 세부 사항은 비공개지만, Transformer 기반 자기회귀 생성과 고품질 뉴럴 보코더를 결합한 구조로 알려져 있다. "K-pop girl group, upbeat, synthesizer"처럼 장르·악기·분위기를 지정하면 그에 맞는 음악이 생성된다. 커스텀 가사를 입력하는 것도 가능하다.

### Udio

Udio(2024)는 Suno AI의 경쟁 서비스로, 더 높은 오디오 품질과 더 정교한 음악적 구조로 주목받았다. Suno v3 대비 더 자연스러운 악기 음색과 화성 진행을 보여준다는 평가가 많다.

### 저작권 이슈

AI 음악 생성의 가장 큰 논쟁은 학습 데이터 저작권이다. 2024년 Universal Music Group, Sony Music 등 주요 음반사들이 Suno AI와 Udio를 저작권 침해로 고소했다. 이들은 저작권 음원을 무단으로 학습에 사용했다고 주장한다. 현재 소송이 진행 중이며, AI 음악 생성의 법적 지위는 아직 불확실하다.

실용적 관점에서는 생성된 음악의 상업적 사용 전에 각 서비스의 라이선스 조건을 반드시 확인해야 한다. MusicGen은 CC-BY-NC 4.0 라이선스로 비상업적 용도에 한해 자유롭게 사용 가능하다.

## 실전 코드

![MusicGen Python 실전 예시](/assets/posts/audio-music-generation-code.svg)

```python
from audiocraft.models import MusicGen
import torchaudio
import torch

# 모델 로드 (small/medium/large/melody)
model = MusicGen.get_pretrained('facebook/musicgen-medium')
model.set_generation_params(
    duration=8,          # 생성 길이 (초)
    temperature=1.0,     # 다양성 (높을수록 창의적)
    top_k=250,           # Top-K 샘플링
    cfg_coef=3.0,        # Classifier-Free Guidance 강도
)

descriptions = [
    'happy rock music with guitar',
    '한국 전통 악기 가야금 연주',
    'chill lofi hip hop, study beats',
]

# 배치 생성
with torch.no_grad():
    wav = model.generate(descriptions)  # (3, 1, T)

for i, audio in enumerate(wav):
    torchaudio.save(
        f"music_{i}.wav",
        audio.cpu(),
        model.sample_rate
    )
    print(f"Saved music_{i}.wav")
```

```python
# MusicGen Melody: 멜로디 조건부 생성
from audiocraft.models import MusicGen
from audiocraft.data.audio import audio_read
import torchaudio
import torch

model = MusicGen.get_pretrained('facebook/musicgen-melody')
model.set_generation_params(duration=10)

# 참조 멜로디 로드
melody, sr = audio_read("reference_melody.wav")
melody = melody.unsqueeze(0)  # (1, C, T)

# 멜로디를 유지하면서 장르/스타일 변경
descriptions = ['jazz version with piano and saxophone']

with torch.no_grad():
    wav = model.generate_with_chroma(
        descriptions=descriptions,
        melody_wavs=melody,
        melody_sample_rate=sr,
    )

torchaudio.save("melody_jazz.wav", wav[0].cpu(), model.sample_rate)
```

## 음악 생성 평가: FAD·IS·인간 평가

음악 생성 품질은 이미지 생성(FID, IS)과 유사한 지표를 사용하지만, 오디오 도메인에 맞게 조정된다.

**FAD (Fréchet Audio Distance)**: 이미지의 FID에 해당하는 오디오 품질 지표. VGGish 임베딩 공간에서 실제 음악과 생성된 음악의 분포 거리를 측정한다. 낮을수록 실제 음악과 유사하다. MusicGen large는 FAD 약 7.8로 기존 모델 대비 크게 개선됐다.

**IS (Inception Score)**: 생성 다양성과 품질을 동시에 측정. 오디오 분류 모델 기반.

**CLAP Score**: 텍스트 프롬프트와 생성 음악의 의미적 유사도. CLAP 임베딩 공간에서 코사인 유사도로 계산. 프롬프트 충실도 측정에 사용.

**인간 평가**: 음악 전문가 또는 일반 청취자가 음질(Audio Quality), 텍스트 충실도(Text Relevance), 음악성(Musicality) 세 항목을 5점 척도로 평가. 가장 신뢰도 높은 평가 방법이나 비용이 크다.

현재 MusicGen large와 Stable Audio 2.0이 오픈소스 음악 생성 모델 중 최고 수준이며, 상용 서비스(Suno, Udio)가 전반적 품질에서 한 단계 앞서 있다. 오픈소스와 상용 서비스의 격차는 데이터 규모와 학습 리소스 차이에서 비롯된다.

---

**지난 글:** [신경망 음성 합성(TTS): VITS·XTTS·CosyVoice 완전 해설](/posts/audio-tts/)

**다음 글:** [멀티모달 LLM: 텍스트·이미지·오디오를 함께 이해하는 AI 완전 해설](/posts/multimodal-llm/)

<br>
읽어주셔서 감사합니다. 😊
