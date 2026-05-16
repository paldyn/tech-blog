---
title: "온프레미스에서 LLM 파인튜닝: GPU 서버 구성 완전 가이드"
description: "자체 GPU 서버에서 LLM을 파인튜닝하는 방법, CUDA 환경 설정, DeepSpeed ZeRO 분산 학습, 스토리지 설계, 운영 팁을 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["파인튜닝", "온프레미스", "GPU서버", "DeepSpeed", "분산학습", "CUDA"]
featured: false
draft: false
---

[지난 글](/posts/finetuning-on-cloud/)에서 AWS·GCP·Azure 등 클라우드 환경에서 LLM을 파인튜닝하는 방법을 살펴봤다. 클라우드는 유연하지만, 대규모 학습을 반복하다 보면 비용이 눈에 띄게 쌓인다. 데이터 보안 규정이 엄격한 금융·의료·공공 분야라면 외부 클라우드를 아예 쓰지 못하는 경우도 있다. 이럴 때 등장하는 선택지가 **온프레미스(on-premises)** 서버다. 이번 글에서는 자체 GPU 서버를 구성해 LLM을 파인튜닝하는 방법을 처음부터 끝까지 다룬다. 하드웨어 선택부터 CUDA 환경 설치, DeepSpeed ZeRO 분산 학습 설정, 스토리지 설계, 그리고 일상적인 운영 팁까지 한 번에 정리한다.

## 온프레미스 vs 클라우드: 언제 어느 쪽이 유리한가

두 환경은 장단점이 명확하게 갈린다.

| 항목 | 온프레미스 | 클라우드 |
|---|---|---|
| 초기 비용 | 높음 (수억 원대) | 낮음 (즉시 시작) |
| 장기 비용 | 낮음 (전기세·유지비) | 높음 (시간당 과금) |
| 데이터 보안 | 외부 유출 없음 | 계약·설정에 따라 다름 |
| 확장성 | 증설에 시간·비용 필요 | 즉시 스케일 아웃 |
| 실험 빈도 | 반복 학습에 유리 | 단발성 실험에 유리 |

**경험칙**: 같은 GPU를 주당 60시간 이상 사용한다면 1~2년 내에 온프레미스가 투자비를 회수한다. 학습 실험을 매주 반복하는 조직, 혹은 데이터를 외부로 보낼 수 없는 조직에게 온프레미스는 사실상 필수다.

## GPU 선택 가이드

### A100 80GB × 8 (최선)

NVIDIA A100 SXM5 80GB는 현재 LLM 파인튜닝의 사실상 표준이다. HBM2e 메모리 2TB/s 대역폭, NVLink 600GB/s 연결을 지원해 8장이 마치 하나의 거대한 GPU처럼 동작한다. 70B 모델을 BF16 Full Fine-tuning할 때도 ZeRO Stage 3 적용 시 8장으로 충분히 소화한다. 문제는 가격이다. 8-GPU DGX A100 서버는 구입가 기준 4억~8억 원에 달한다.

### RTX 4090 24GB × 4 (예산형)

소비자용 RTX 4090은 가격 대비 성능이 탁월하다. 4장을 PCIe 연결하면 약 96GB의 VRAM을 사용할 수 있다. NVLink를 지원하지 않기 때문에 GPU 간 통신 대역폭은 A100보다 훨씬 낮지만, 7B 이하 모델을 QLoRA로 파인튜닝하는 용도라면 충분하다. 4장 기준 구성 비용은 1,000만~1,500만 원 수준이다.

### H100 SXM5 80GB × 8 (최신)

A100의 후속인 H100은 FP8 연산, NVLink 900GB/s, 3.35TB/s HBM3 대역폭으로 A100 대비 약 3배의 훈련 처리량을 제공한다. 가격도 그만큼 비싸다. 2024~2025년 기준으로 신규 서버를 도입한다면 H100이 가장 현명한 선택이다.

![온프레미스 파인튜닝 서버 아키텍처](/assets/posts/finetuning-on-prem-architecture.svg)

## NVLink vs PCIe: 대역폭이 왜 중요한가

멀티 GPU 학습에서 GPU 간 통신은 필수적이다. AllReduce 연산으로 모든 GPU의 그래디언트를 집계해야 파라미터를 갱신할 수 있기 때문이다.

- **NVLink (A100)**: 600GB/s 양방향. GPU 8장이 하나의 NVSwitch 패브릭으로 연결된다. 통신 병목이 거의 없다.
- **PCIe 4.0 × 16**: 약 32GB/s 양방향. NVLink 대비 약 20배 느리다.

실제로 A100 NVLink 구성과 RTX 4090 PCIe 구성에서 같은 7B 모델을 학습하면, 배치당 step 시간이 2~4배 차이 날 수 있다. 멀티노드(서버 여러 대)로 확장할 경우 서버 간 통신에는 **InfiniBand HDR(200Gb/s)** 이상을 권장한다. 일반 10GbE 이더넷은 AllReduce 병목으로 GPU를 절반 이상 놀리게 만든다.

## CUDA 환경 설정: 버전 맞추기

온프레미스에서 가장 흔한 문제가 CUDA·cuDNN·PyTorch 버전 불일치다. 설치 순서를 지켜야 한다.

```bash
# 1. NVIDIA 드라이버 확인 (서버에 맞는 버전 사용)
nvidia-smi
# Driver Version: 535.xx  CUDA Version: 12.2

# 2. CUDA Toolkit 설치 (드라이버와 호환되는 버전)
# https://developer.nvidia.com/cuda-downloads
wget https://developer.download.nvidia.com/compute/cuda/12.2.0/local_installers/cuda_12.2.0_535.54.03_linux.run
sudo sh cuda_12.2.0_535.54.03_linux.run --toolkit --silent

# 3. cuDNN 설치
# https://developer.nvidia.com/cudnn 에서 .deb 다운로드 후
sudo dpkg -i cudnn-local-repo-ubuntu2204-8.9.x.x_1.0-1_amd64.deb
sudo apt-get install libcudnn8 libcudnn8-dev

# 4. PyTorch 설치 (CUDA 버전 명시)
pip install torch==2.1.0+cu121 torchvision torchaudio \
    --index-url https://download.pytorch.org/whl/cu121

# 5. 설치 확인
python -c "import torch; print(torch.cuda.is_available(), torch.version.cuda)"
# True 12.1
```

conda 환경을 사용하면 버전 관리가 편리하다. 학습 환경별로 별도 conda 환경을 만들어 두면 버전 충돌 문제를 피할 수 있다.

## DeepSpeed ZeRO: 메모리 분산의 핵심

대형 모델을 파인튜닝할 때 가장 큰 장벽이 GPU 메모리다. 7B 모델을 BF16으로 Full Fine-tuning하면 모델 파라미터(14GB) + 그래디언트(14GB) + Adam 옵티마이저 상태(28GB) = 약 56GB가 필요하다. A100 1장(80GB)으로 겨우 감당하는 수준이다. DeepSpeed ZeRO는 이 메모리를 여러 GPU에 나눠 가짐으로써 문제를 해결한다.

![DeepSpeed ZeRO 단계별 메모리 분산](/assets/posts/finetuning-on-prem-deepspeed.svg)

### ZeRO Stage 1: 옵티마이저 상태 분산

각 GPU가 전체 파라미터와 그래디언트는 갖고 있되, 옵티마이저 상태(Adam의 1차·2차 모멘트)만 N등분해서 보관한다. 4-GPU 기준 옵티마이저 메모리가 1/4로 줄어든다. 구현이 단순하고 통신 오버헤드가 낮다.

### ZeRO Stage 2: + 그래디언트 분산

그래디언트도 N등분한다. 각 GPU는 자신이 담당하는 파라미터 범위의 그래디언트만 보관한다. 4-GPU 기준 옵티마이저 + 그래디언트 메모리가 합산 약 1/8로 줄어든다. 대부분의 실무 파인튜닝에서 Stage 2가 최적의 균형점이다.

### ZeRO Stage 3: + 파라미터 분산

파라미터까지 분산한다. 모든 GPU가 전체 모델 파라미터의 N분의 1만 보관한다. Forward/backward 시에는 AllGather로 필요한 파라미터를 일시적으로 수집한다. 이론적으로 N배의 메모리 절약이 가능하지만 통신 오버헤드가 증가한다. 70B 이상 초대형 모델이나 메모리가 극히 부족한 환경에서 사용한다.

```python
# DeepSpeed + HuggingFace Trainer 연동
from transformers import TrainingArguments, Trainer

training_args = TrainingArguments(
    output_dir="./output",
    per_device_train_batch_size=4,
    gradient_accumulation_steps=8,
    num_train_epochs=3,
    bf16=True,                          # BF16 혼합 정밀도
    deepspeed="./ds_config_stage2.json",# DeepSpeed 설정 파일 경로
    logging_steps=50,
    save_steps=500,
    learning_rate=2e-5,
    warmup_ratio=0.05,
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    data_collator=data_collator,
)

trainer.train()
```

`ds_config_stage2.json`의 핵심 옵션:

```json
{
  "zero_optimization": {
    "stage": 2,
    "overlap_comm": true,
    "contiguous_gradients": true,
    "reduce_bucket_size": 5e8
  },
  "bf16": { "enabled": true },
  "train_micro_batch_size_per_gpu": 4,
  "gradient_accumulation_steps": 8,
  "optimizer": {
    "type": "AdamW",
    "params": { "lr": 2e-5, "betas": [0.9, 0.999], "eps": 1e-8 }
  }
}
```

`overlap_comm: true`는 통신과 계산을 겹쳐서 실행해 GPU 유휴 시간을 줄인다. `contiguous_gradients: true`는 그래디언트를 연속 메모리에 저장해 통신 효율을 높인다.

## Accelerate로 멀티 GPU 훈련 시작하기

HuggingFace `accelerate`는 DeepSpeed 없이도 멀티 GPU 훈련을 쉽게 구성할 수 있다. 인터랙티브 설정 명령 하나로 분산 학습 환경을 잡아준다.

```bash
# Accelerate 설정
accelerate config
# GPU 수, BF16 여부, DeepSpeed 사용 여부 등을 대화형으로 입력

# 학습 실행 (4-GPU)
accelerate launch --num_processes 4 train.py
```

## 스토리지 설계: 데이터 파이프라인 병목 방지

GPU가 아무리 빨라도 데이터를 제때 공급하지 못하면 학습이 느려진다. 온프레미스 스토리지 설계의 핵심은 **I/O 대역폭을 GPU 처리 속도에 맞추는 것**이다.

- **로컬 NVMe SSD**: 읽기 속도 7GB/s 이상. 훈련 데이터셋, 토크나이즈된 캐시 파일, 체크포인트를 여기에 저장한다.
- **RAID 0**: NVMe 4개를 RAID 0으로 묶으면 약 28GB/s까지 달성 가능하다.
- **데이터 전처리 캐시**: 원시 텍스트를 사전에 토크나이즈해서 `.arrow` 또는 `.bin` 포맷으로 저장한다. 학습 중 토크나이징을 실시간으로 하면 CPU가 병목이 된다.
- **DataLoader 최적화**: `num_workers=8~16`, `pin_memory=True`로 설정해 CPU→GPU 데이터 전송을 최적화한다.

## 체크포인트 전략: 디스크 공간 관리

70B 모델의 체크포인트 한 개가 130~140GB를 차지한다. 매 스텝마다 저장하면 금방 디스크가 꽉 찬다.

실무 권장 전략:
- 최근 3개 체크포인트만 보관 (`save_total_limit=3`)
- 500~1000 스텝마다 저장
- 최종 최적 모델은 별도 경로에 영구 보관
- ZeRO Stage 3 환경에서는 `zero_to_fp32.py` 스크립트로 분산 체크포인트를 단일 모델 파일로 병합

```bash
# ZeRO Stage 3 체크포인트 병합
python zero_to_fp32.py ./checkpoint-500 ./merged_model.bin
```

## 모니터링: GPU 사용률·온도·메모리

학습 중 GPU 상태를 실시간으로 확인하는 것이 중요하다.

```bash
# 실시간 GPU 모니터링 (1초 갱신)
watch -n 1 nvidia-smi

# 더 상세한 정보 (메모리, 전력, 온도, 사용률)
nvidia-smi dmon -s pucvmet -d 1

# Python에서 GPU 메모리 확인
python -c "
import torch
for i in range(torch.cuda.device_count()):
    props = torch.cuda.get_device_properties(i)
    mem = torch.cuda.memory_allocated(i) / 1e9
    print(f'GPU {i}: {props.name}, 사용 {mem:.1f}GB')
"
```

주요 점검 항목:
- **GPU 사용률**: 80% 이상 유지되어야 한다. 낮으면 데이터 로딩이나 통신 병목 의심.
- **온도**: A100은 최대 83°C. 지속 80°C 이상이면 쿨링 점검 필요.
- **전력 소비**: A100 TDP 400W × 8 = 3.2kW. 서버 전원·UPS 용량 확인 필수.
- **메모리 사용률**: OOM이 발생하면 배치 크기를 줄이거나 `gradient_checkpointing=True` 활성화.

## 실전 팁: 온프레미스 운영에서 배우는 것들

**환경 격리**: Docker 또는 conda 환경으로 프로젝트별 의존성을 분리한다. 한 팀이 CUDA 12.1 PyTorch 2.1을 쓰고, 다른 팀이 CUDA 12.4 PyTorch 2.3을 쓰더라도 충돌 없이 공존할 수 있다.

**학습 재현성**: 난수 시드 고정(seed=42)과 함께 사용한 코드 커밋 해시, 데이터셋 버전, 하이퍼파라미터를 학습 로그와 함께 기록한다. `wandb` 또는 `mlflow`를 학습 서버에 내부 설치해 실험을 추적한다.

**GPU 오류 감지**: `nvidia-smi -q -d ECC`로 ECC 오류를 주기적으로 확인한다. ECC 오류가 증가하면 해당 GPU가 물리적으로 손상되고 있다는 신호다.

**사전 예열**: 학습 시작 전 `warmup_ratio=0.05~0.1`로 learning rate를 서서히 올린다. 갑작스러운 높은 학습률은 초기 불안정을 유발한다.

## 정리

온프레미스 LLM 파인튜닝은 하드웨어 투자와 운영 노하우가 동시에 필요하지만, 반복적인 학습과 데이터 보안이 중요한 환경에서는 장기적으로 유리하다. 핵심을 정리하면:

1. GPU 선택은 예산과 모델 크기에 따라: A100 80GB(최선), RTX 4090(예산), H100(최신)
2. NVLink 연결 여부가 멀티 GPU 효율을 결정한다
3. CUDA·cuDNN·PyTorch 버전을 드라이버에 맞게 정확히 맞춘다
4. DeepSpeed ZeRO Stage 2가 대부분의 파인튜닝에 최적의 균형점이다
5. NVMe SSD와 데이터 캐싱으로 I/O 병목을 제거한다
6. `nvidia-smi`와 wandb로 GPU 상태와 학습 지표를 지속 모니터링한다

다음 글에서는 학습된 모델을 더 작고 빠르게 만드는 **양자화(Quantization)** 기술을 다룬다.

---

**지난 글:** [클라우드에서 LLM 파인튜닝: AWS·GCP·Azure 완전 가이드](/posts/finetuning-on-cloud/)

**다음 글:** [양자화 완전 정복: 모델 크기를 절반으로 줄이는 기술](/posts/quantization-basics/)

<br>
읽어주셔서 감사합니다. 😊
