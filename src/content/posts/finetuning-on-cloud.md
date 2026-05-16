---
title: "클라우드에서 LLM 파인튜닝: AWS·GCP·Azure 완전 가이드"
description: "AWS SageMaker, Google Vertex AI, Azure ML에서 LLM을 파인튜닝하는 방법과 비용 최적화 전략, 스팟 인스턴스 활용법을 한국어로 완전 해설한다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["파인튜닝", "AWS", "SageMaker", "GCP", "VertexAI", "클라우드", "LLM"]
featured: false
draft: false
---

[지난 글](/posts/finetuning-evaluation/)에서 파인튜닝된 모델이 실제로 얼마나 좋아졌는지를 ROUGE, BERTScore, LLM-as-Judge 등으로 측정하는 방법을 살펴봤다. 이번에는 그 훈련 자체를 어디서 어떻게 돌릴지를 다룬다. 로컬 GPU가 없거나, 있더라도 7B 이상의 모델을 여러 GPU에 걸쳐 훈련해야 하는 상황에서 클라우드는 사실상 필수 선택지다. AWS SageMaker, GCP Vertex AI, Azure ML 세 플랫폼의 설정 방법과 비용을 크게 줄일 수 있는 스팟 인스턴스 전략을 처음부터 끝까지 설명한다.

## 왜 클라우드에서 파인튜닝하는가

온프레미스 GPU 서버를 구매하면 초기 비용이 크지만 장기적으로는 저렴할 수 있다. 반면 클라우드의 장점은 다음과 같다.

- **즉시 확장**: A100 8장짜리 노드를 클릭 한 번으로 확보 가능
- **유연성**: 필요한 시간만 사용하고 비용을 지불
- **관리 부담 없음**: OS 업데이트, 하드웨어 장애, 냉각 등을 클라우드가 담당
- **생태계 통합**: S3, GCS, Azure Blob과 데이터 파이프라인 연동이 자연스러움

물론 단점도 있다. 인터넷 속도와 데이터 전송 비용, 그리고 데이터 거버넌스 요구사항에 따라 클라우드를 쓸 수 없는 조직도 있다.

![클라우드 파인튜닝 옵션 비교](/assets/posts/finetuning-on-cloud-options.svg)

## AWS SageMaker Training Jobs

AWS SageMaker는 가장 널리 사용되는 관리형 ML 플랫폼이다. **Training Job** 기능을 사용하면 컨테이너 기반으로 훈련을 실행하고, 완료 후 결과를 S3에 자동 저장할 수 있다.

### 사전 준비: IAM 역할 설정

SageMaker가 S3와 ECR(컨테이너 레지스트리)에 접근하려면 적절한 IAM 역할이 필요하다.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-training-bucket",
        "arn:aws:s3:::my-training-bucket/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage"
      ],
      "Resource": "*"
    }
  ]
}
```

SageMaker 실행 역할에 `AmazonSageMakerFullAccess` 정책을 붙이는 것이 가장 빠른 시작 방법이지만, 프로덕션에서는 최소 권한 원칙을 따르는 것을 권장한다.

### HuggingFace Estimator로 Training Job 실행

SageMaker는 HuggingFace 공식 컨테이너를 내장 지원한다.

```python
import boto3
from sagemaker.huggingface import HuggingFace

# SageMaker 세션 초기화
sess = sagemaker.Session()
role = "arn:aws:iam::123456789:role/SageMakerRole"

# 하이퍼파라미터 정의
hyperparameters = {
    "model_name_or_path": "meta-llama/Llama-3.2-3B",
    "dataset_path": "/opt/ml/input/data/train",
    "output_dir": "/opt/ml/model",
    "num_train_epochs": 3,
    "per_device_train_batch_size": 4,
    "gradient_accumulation_steps": 8,
    "learning_rate": 2e-4,
    "bf16": True,
    "use_peft": True,
    "lora_r": 16,
    "lora_alpha": 32,
    "save_steps": 50,
}

# HuggingFace Estimator 생성
estimator = HuggingFace(
    entry_point="train.py",          # 훈련 스크립트
    source_dir="./scripts",          # 스크립트 디렉토리
    role=role,
    instance_type="ml.p4d.24xlarge", # A100 8× GPU
    instance_count=1,
    transformers_version="4.36",
    pytorch_version="2.1",
    py_version="py310",
    hyperparameters=hyperparameters,
    use_spot_instances=True,         # 스팟 인스턴스 활성화
    max_wait=86400,                  # 최대 대기 시간 (초)
    max_run=72000,                   # 최대 실행 시간 (초)
    checkpoint_s3_uri="s3://my-bucket/checkpoints/",
)

# 훈련 데이터 S3 경로 지정 후 실행
estimator.fit(
    inputs={
        "train": "s3://my-bucket/data/train/",
        "valid": "s3://my-bucket/data/valid/"
    }
)

# 훈련 완료 후 모델 경로
print(f"Model artifact: {estimator.model_data}")
```

`use_spot_instances=True`를 설정하면 SageMaker가 스팟 인스턴스를 자동으로 사용하고, 중단 시 `checkpoint_s3_uri`에서 재개한다. 비용이 최대 70% 절감된다.

### 비용 계산 예시

7B 모델을 1000 스텝 훈련하는 경우 (`ml.p4d.24xlarge`, A100 8×, 약 $32/hr):

- 배치 크기 4 × 그래디언트 축적 8 = 유효 배치 32
- 7B 모델 1000 스텝 ≈ 약 1.5시간
- 온디맨드: 1.5 × $32 = **$48**
- 스팟 (70% 절감): 약 **$14.4**

## GCP Vertex AI Custom Training

Google Cloud의 Vertex AI는 TPU를 활용할 수 있다는 점이 가장 큰 차별점이다. JAX/PyTorch 기반 코드를 TPU에서 실행하면 A100 대비 비용 효율이 크게 향상된다.

### GPU vs TPU 선택 기준

| 기준 | GPU (A100) | TPU (v4/v5e) |
|------|-----------|--------------|
| 코드 호환성 | PyTorch, HuggingFace 그대로 | JAX 또는 PyTorch/XLA 필요 |
| 설정 난이도 | 낮음 | 중간~높음 |
| 비용 (대량) | 높음 | 낮음 |
| 배치 크기 유연성 | 높음 | 다소 제한적 |
| 권장 상황 | 빠른 실험, 기존 코드 재사용 | 대규모 학습, 비용 최적화 |

처음 Vertex AI를 사용한다면 GPU로 시작하고, 어느 정도 익숙해진 후 TPU로 전환하는 것을 권장한다.

### Vertex AI Custom Training 설정

```python
from google.cloud import aiplatform

aiplatform.init(
    project="my-gcp-project",
    location="us-central1",
    staging_bucket="gs://my-bucket/staging"
)

# Custom Training Job 생성
job = aiplatform.CustomTrainingJob(
    display_name="llama-finetuning",
    script_path="train.py",
    container_uri="us-docker.pkg.dev/vertex-ai/training/pytorch-gpu.2-1:latest",
    requirements=["transformers==4.36.0", "peft==0.7.0", "trl==0.7.0"],
    model_serving_container_image_uri=None,
)

# 훈련 실행
model = job.run(
    dataset=None,
    replica_count=1,
    machine_type="a2-highgpu-8g",      # A100 8× GPU
    accelerator_type="NVIDIA_TESLA_A100",
    accelerator_count=8,
    args=[
        "--model_name", "meta-llama/Llama-3.2-3B",
        "--output_dir", "/gcs/my-bucket/output",  # GCS 자동 마운트
        "--num_train_epochs", "3",
        "--bf16", "true",
    ],
    # 프리엠티블 인스턴스 (스팟 상당)
    enable_web_access=False,
    # restart_job_on_worker_restart=True,  # 중단 시 재시작
)
```

Vertex AI에서 GCS 경로(`/gcs/버킷명/...`)를 사용하면 별도 SDK 없이 파일시스템처럼 GCS에 접근할 수 있다. 이는 S3에 비해 편리한 점이다.

## Azure ML: Compute Cluster 설정

Azure ML은 Microsoft 365 생태계와의 통합이 강점이다. 엔터프라이즈 환경에서 Azure AD를 통한 접근 제어와 컴플라이언스 요구사항을 충족하기 쉽다.

### Compute Cluster 생성

```python
from azure.ai.ml import MLClient
from azure.ai.ml.entities import AmlCompute
from azure.identity import DefaultAzureCredential

# Azure ML 클라이언트 초기화
credential = DefaultAzureCredential()
ml_client = MLClient(
    credential=credential,
    subscription_id="your-subscription-id",
    resource_group_name="my-resource-group",
    workspace_name="my-ml-workspace"
)

# GPU 클러스터 생성
gpu_cluster = AmlCompute(
    name="a100-cluster",
    type="amlcompute",
    size="Standard_ND96asr_v4",    # A100 8× GPU
    min_instances=0,               # 0이면 미사용 시 비용 없음
    max_instances=4,               # 최대 4개 노드 (32× A100)
    idle_time_before_scale_down=120,  # 2분 후 자동 축소
    tier="LowPriority",            # 스팟 인스턴스 (Low Priority)
)

ml_client.begin_create_or_update(gpu_cluster).result()
print(f"Cluster '{gpu_cluster.name}' created successfully")
```

`tier="LowPriority"`가 Azure ML의 스팟 인스턴스에 해당한다. 중단 가능하지만 비용이 크게 절감된다.

## 비용 최적화: 스팟 인스턴스와 체크포인팅

![클라우드 GPU 비용 최적화 전략](/assets/posts/finetuning-on-cloud-cost.svg)

스팟 인스턴스(AWS), 프리엠티블 인스턴스(GCP), Low Priority VM(Azure)은 언제든 중단될 수 있는 대신 온디맨드 대비 60~80% 저렴하다. 이를 안전하게 활용하려면 **체크포인팅 전략**이 필수다.

### 핵심 체크포인팅 설정

```python
from transformers import TrainingArguments, Trainer

training_args = TrainingArguments(
    output_dir="s3://my-bucket/checkpoints",  # 클라우드 스토리지 직접 지정
    save_strategy="steps",
    save_steps=50,                   # 50스텝마다 저장 (약 5~10분 간격)
    save_total_limit=3,              # 최근 3개만 보관 (스토리지 절약)
    load_best_model_at_end=True,
    evaluation_strategy="steps",
    eval_steps=50,
    metric_for_best_model="eval_loss",

    # Mixed precision (메모리 50% 절약)
    bf16=True,                       # A100/H100은 bf16 권장
    fp16=False,                      # V100이면 fp16 사용

    # 그래디언트 체크포인팅 (메모리 추가 절약)
    gradient_checkpointing=True,
    gradient_accumulation_steps=8,

    # 재개 설정
    resume_from_checkpoint=True,     # 마지막 체크포인트에서 자동 재개
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=eval_dataset,
)

# 스팟 중단 후 재실행 시 자동으로 체크포인트 탐지
trainer.train(resume_from_checkpoint=True)
```

체크포인팅 간격(`save_steps`)을 너무 작게 하면 스토리지 비용이 증가하고, 너무 크게 하면 중단 시 손실이 크다. **50~100 스텝**이 일반적으로 적절한 균형점이다.

## 분산 학습: Multi-GPU와 Multi-Node

7B 이상의 모델은 단일 GPU에 올라가지 않거나, 올라가더라도 배치 크기가 너무 작아 훈련이 비효율적이다. 분산 학습이 필요한 시점을 판단하는 기준은 다음과 같다.

- **모델이 단일 GPU에 올라가지 않음**: 텐서 병렬화 또는 파이프라인 병렬화 필요
- **훈련 속도가 너무 느림**: 데이터 병렬화로 처리량 향상
- **70B 이상 모델**: 최소 4장 이상의 A100 80GB 필요

### DeepSpeed를 활용한 Multi-GPU 설정

DeepSpeed ZeRO는 옵티마이저 상태, 그래디언트, 파라미터를 여러 GPU에 분산하여 메모리를 크게 절약한다.

```bash
# deepspeed_config.json 생성
cat > ds_config.json << 'EOF'
{
  "zero_optimization": {
    "stage": 3,
    "offload_optimizer": {"device": "cpu"},
    "offload_param": {"device": "cpu"}
  },
  "bf16": {"enabled": true},
  "gradient_clipping": 1.0,
  "train_batch_size": "auto",
  "train_micro_batch_size_per_gpu": "auto"
}
EOF

# 8 GPU로 훈련 실행
deepspeed --num_gpus=8 train.py \
  --deepspeed ds_config.json \
  --model_name_or_path meta-llama/Llama-3.2-7B \
  --output_dir ./output \
  --num_train_epochs 3 \
  --per_device_train_batch_size 2 \
  --gradient_accumulation_steps 4 \
  --bf16
```

ZeRO Stage 3 + CPU 오프로딩을 사용하면 A100 80GB 1장으로도 70B 모델을 추론할 수 있을 정도로 메모리 효율이 높다. 단, CPU ↔ GPU 데이터 전송 오버헤드로 인해 속도는 다소 느려진다.

## GPU 선택 가이드

| GPU | VRAM | 적합한 모델 | 시간당 비용 |
|-----|------|------------|------------|
| T4 | 16GB | 3B 이하, 추론용 | $0.35~ |
| A10G | 24GB | 7B (QLoRA) | $1.0~ |
| V100 | 32GB | 7B (Full FT) | $2.5~ |
| A100 40GB | 40GB | 13B (QLoRA) | $2.8~ |
| A100 80GB | 80GB | 70B (LoRA) | $4.0~ |
| H100 SXM | 80GB | 70B (Full FT) | $6.5~ |

QLoRA를 사용하면 모델 크기 대비 필요 VRAM을 크게 줄일 수 있다. 예를 들어 7B 모델을 QLoRA로 훈련하면 A10G(24GB) 1장으로도 가능하다.

## 실전 워크플로: 로컬 → 클라우드

클라우드 비용을 최소화하려면 로컬에서 충분히 검증한 후 클라우드로 이전하는 것이 중요하다.

### 1단계: 로컬 환경에서 검증

```bash
# 소규모 데이터셋(100건)으로 코드 검증
python train.py \
  --model_name_or_path TinyLlama/TinyLlama-1.1B-Chat-v1.0 \
  --dataset_path ./data/sample100 \
  --max_steps 10 \
  --per_device_train_batch_size 1
```

작은 모델, 작은 데이터셋, 적은 스텝으로 코드가 에러 없이 실행되는지 확인한다. 클라우드에서 오류를 발견하면 그 자체가 비용이다.

### 2단계: 클라우드 스토리지 연동 확인

훈련 스크립트가 클라우드 스토리지에서 데이터를 읽고 결과를 저장할 수 있는지 소규모로 테스트한다.

### 3단계: 비용 예측 후 전체 훈련 실행

예상 훈련 시간 = (스텝 수 × 스텝당 시간) ÷ GPU 수

스텝당 시간은 2단계 테스트 결과로 측정한다. 예상 비용을 계산한 후 클라우드 예산 알림을 설정하고 훈련을 시작하라.

## 완료 후 모델 저장 및 배포 준비

훈련이 완료되면 체크포인트를 정리하고 최종 모델만 별도로 저장하는 것이 중요하다.

```python
# 훈련 완료 후 LoRA 가중치를 베이스 모델에 병합
from peft import PeftModel
import torch

base_model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-7B",
    torch_dtype=torch.bfloat16,
    device_map="auto"
)

# LoRA 어댑터 로드 및 병합
peft_model = PeftModel.from_pretrained(base_model, "./lora-checkpoint")
merged_model = peft_model.merge_and_unload()

# 최종 모델 저장 (S3 또는 HuggingFace Hub)
merged_model.save_pretrained("./final-model")
tokenizer.save_pretrained("./final-model")

# HuggingFace Hub에 업로드 (선택)
merged_model.push_to_hub("my-org/my-finetuned-model", private=True)
```

## 마무리

클라우드 파인튜닝의 핵심은 **비용 통제**와 **중단 대응**이다. 스팟 인스턴스를 체크포인팅과 함께 사용하면 온디맨드 대비 70% 가까이 비용을 절감할 수 있다. 플랫폼 선택에서 AWS는 S3 데이터 파이프라인 기반 팀에게, GCP는 비용 효율과 TPU가 중요한 팀에게, Azure는 엔터프라이즈 보안 요구사항이 있는 팀에게 유리하다.

무엇보다 처음에는 로컬에서 충분히 검증한 후 클라우드로 이전하는 습관이 중요하다. 클라우드에서 발생하는 디버깅 비용은 생각보다 크다. 소규모 실험으로 코드를 완성하고, 클라우드는 최종 훈련을 위한 엔진으로만 활용하라.

---

**지난 글:** [파인튜닝 평가: 내 모델이 얼마나 좋아졌는지 측정하기](/posts/finetuning-evaluation/)

**다음 글:** [온프레미스에서 LLM 파인튜닝: GPU 서버 구성 완전 가이드](/posts/finetuning-on-prem/)

<br>
읽어주셔서 감사합니다. 😊
