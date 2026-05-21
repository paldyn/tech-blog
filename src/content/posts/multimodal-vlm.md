---
title: "비전-언어 모델(VLM): CLIP·BLIP2·LLaVA 완전 해설"
description: "CLIP 대조 학습·BLIP2 Q-Former·LLaVA 비주얼 인스트럭션 튜닝 구조, 비전 인코더와 언어 모델 연결 방식, Python 실전 코드까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["VLM", "CLIP", "BLIP2", "LLaVA", "비전언어모델", "대조학습", "Q-Former", "비주얼인스트럭션튜닝"]
featured: false
draft: false
---

[지난 글](/posts/multimodal-llm/)에서 GPT-4o·Gemini·Claude 같은 멀티모달 LLM의 전체 구조를 살펴봤다. 이번 글에서는 그 근간을 이루는 **비전-언어 모델(VLM, Vision-Language Model)**의 핵심 기술들을 파고든다. CLIP이 이미지와 텍스트를 같은 공간에 정렬하는 방법, BLIP2가 Q-Former로 모달리티 간극을 메우는 방식, LLaVA가 GPT-4 생성 데이터로 비주얼 인스트럭션 튜닝을 수행하는 과정까지 — 현대 멀티모달 AI의 기술적 뼈대를 완전 해설한다.

## CLIP: 대조 학습으로 이미지-텍스트 정렬

![VLM 아키텍처 진화](/assets/posts/multimodal-vlm-architecture.svg)

2021년 OpenAI가 발표한 **CLIP(Contrastive Language-Image Pre-training)**은 VLM 연구의 게임 체인저였다. 핵심 아이디어는 간단하다: 이미지와 그에 대응하는 텍스트를 동일한 임베딩 공간에서 **가깝게** 만들고, 관련 없는 이미지-텍스트 쌍은 **멀게** 만드는 것이다.

### 4억 쌍 이미지-텍스트 데이터

CLIP의 강력함은 학습 데이터 규모에서 비롯된다. OpenAI는 인터넷에서 수집한 **4억 쌍(400M)의 이미지-텍스트 쌍**으로 CLIP을 학습했다. 이 데이터는 자동으로 수집되어 별도의 어노테이션 없이도 다양한 시각 개념을 커버한다. ImageNet 같은 기존 이미지 데이터셋이 100만 장 규모인 것과 비교하면 400배에 달하는 규모다.

### ViT 이미지 인코더 + 텍스트 인코더

CLIP은 두 개의 인코더로 구성된다. **이미지 인코더**는 ViT(Vision Transformer) 또는 ResNet 기반으로, 이미지를 고정 차원의 벡터로 변환한다. 이미지를 N개의 패치로 분할하고 각 패치를 토큰처럼 처리해 Transformer에 입력하는 ViT 방식이 현재 주류다.

**텍스트 인코더**는 Transformer 기반 언어 모델로, 텍스트를 같은 차원의 벡터로 변환한다. CLIP의 텍스트 인코더는 BERT와 유사한 구조이지만, 처음부터 이미지 대조 학습 목적으로 훈련된다.

### 코사인 유사도 최대화

학습 과정에서 CLIP은 **배치 내의 N개 이미지와 N개 텍스트**를 쌍으로 만들어 N×N 유사도 행렬을 계산한다. 대각선(올바른 쌍)의 유사도는 최대화하고, 나머지(틀린 쌍)의 유사도는 최소화하는 **InfoNCE 손실**을 사용한다.

```python
import torch
import torch.nn.functional as F

def clip_loss(image_features, text_features, temperature=0.07):
    # 정규화
    image_features = F.normalize(image_features, dim=-1)
    text_features = F.normalize(text_features, dim=-1)

    # 유사도 행렬: (N, N)
    logits = torch.matmul(image_features, text_features.T) / temperature

    # 대각선이 정답 (각 이미지-텍스트 쌍)
    N = logits.shape[0]
    labels = torch.arange(N, device=logits.device)

    # 이미지→텍스트, 텍스트→이미지 방향 모두 학습
    loss_i2t = F.cross_entropy(logits, labels)
    loss_t2i = F.cross_entropy(logits.T, labels)
    return (loss_i2t + loss_t2i) / 2
```

학습 후 CLIP은 놀라운 **제로샷(zero-shot)** 분류 능력을 갖는다. "A photo of a {class}" 템플릿에 클래스명을 넣어 텍스트 임베딩을 생성하고, 이미지 임베딩과 가장 유사한 클래스를 찾는 방식으로 어떤 분류 작업도 수행할 수 있다.

## BLIP2: Q-Former로 모달리티 간극 메우기

2023년 Salesforce가 발표한 **BLIP2(Bootstrapping Language-Image Pre-training 2)**는 사전학습된 이미지 인코더와 LLM을 효율적으로 연결하는 방법을 제시했다. 핵심 혁신은 **Q-Former(Querying Transformer)**라는 새로운 모듈이다.

### Querying Transformer (Q-Former)

Q-Former의 아이디어는 간단하다: 이미지의 모든 특징을 LLM에 전달하는 대신, **32개의 학습 가능한 쿼리 토큰**이 이미지에서 가장 언어 관련성 높은 정보를 선택적으로 추출하도록 한다.

Q-Former는 두 개의 Transformer로 구성된다. 첫 번째는 이미지 특징과 상호작용하는 **이미지 Transformer**로, 쿼리 토큰이 Cross-Attention을 통해 ViT 출력에 접근한다. 두 번째는 텍스트를 처리하는 **텍스트 Transformer**로, Self-Attention을 통해 쿼리-텍스트 상호작용을 모델링한다.

```python
# Q-Former 핵심 개념 (의사 코드)
class QFormer:
    def __init__(self, num_queries=32, d_model=768):
        self.queries = nn.Parameter(
            torch.randn(num_queries, d_model))
        self.cross_attention = CrossAttention(d_model)
        self.self_attention = SelfAttention(d_model)

    def forward(self, image_features, text_tokens=None):
        # 쿼리가 이미지에서 정보 추출
        q = self.queries.expand(batch_size, -1, -1)
        q = self.cross_attention(q, image_features)
        # 텍스트와 쿼리 상호작용
        if text_tokens is not None:
            combined = concat([q, text_tokens], dim=1)
            combined = self.self_attention(combined)
        return q  # 32 토큰만 LLM에 전달
```

### 2단계 학습: 표현 학습 → 생성 학습

BLIP2는 **두 단계**로 학습된다. 1단계는 **비전-언어 표현 학습**으로, Q-Former를 Frozen ViT에 연결해 이미지-텍스트 매칭, 이미지-텍스트 대조 학습, 이미지 기반 텍스트 생성의 세 가지 목표를 동시에 학습한다.

2단계는 **생성 언어 학습**으로, Q-Former 출력을 Frozen LLM(OPT 또는 FlanT5)에 연결해 이미지 조건부 텍스트 생성 능력을 획득한다. 두 단계 모두 ViT와 LLM을 **동결(freeze)**한 채 Q-Former만 학습하므로, 파라미터 효율이 높다. 전체 파라미터의 1~2%만 학습해도 강력한 멀티모달 능력을 달성한다.

## LLaVA: 비주얼 인스트럭션 튜닝

2023년 위스콘신-매디슨 대학교·마이크로소프트 연구팀이 발표한 **LLaVA(Large Language and Vision Assistant)**는 놀라울 정도로 단순한 구조로 강력한 멀티모달 대화 능력을 달성했다.

### CLIP ViT → 선형 프로젝션 → LLM

LLaVA의 아키텍처는 세 부분으로 구성된다.

1. **CLIP ViT 인코더**: 이미지를 패치 시퀀스로 변환 (ViT-L/14)
2. **선형 프로젝션 행렬 W**: ViT 출력 차원 → LLM 입력 차원 (유일한 학습 파라미터)
3. **LLaMA / Vicuna**: 텍스트 생성 담당 LLM

Q-Former의 복잡성 없이 단순 선형 변환만으로도 충분한 성능이 나온다는 것이 LLaVA의 핵심 발견이다. 이미지 패치 임베딩을 LLM의 입력 차원으로 변환하는 가중치 행렬 하나만 학습하면 된다.

```python
from transformers import LlavaNextProcessor, LlavaNextForConditionalGeneration
from PIL import Image
import torch

model_id = "llava-hf/llava-v1.6-mistral-7b-hf"
processor = LlavaNextProcessor.from_pretrained(model_id)
model = LlavaNextForConditionalGeneration.from_pretrained(
    model_id, torch_dtype=torch.float16, device_map="auto"
)

image = Image.open("chart.png")
conversation = [
    {
        "role": "user",
        "content": [
            {"type": "image"},
            {"type": "text", "text": "이 차트의 주요 트렌드는?"}
        ],
    }
]
prompt = processor.apply_chat_template(
    conversation, add_generation_prompt=True)
inputs = processor(images=image, text=prompt,
                   return_tensors="pt").to(model.device)
output = model.generate(**inputs, max_new_tokens=200)
print(processor.decode(output[0], skip_special_tokens=True))
```

### GPT-4 생성 데이터로 인스트럭션 튜닝

LLaVA의 가장 독창적인 기여는 **학습 데이터 생성 방식**이다. 연구팀은 이미지에 대한 GPT-4의 언어 전용 추론 능력을 활용해 멀티모달 인스트럭션 데이터를 만들었다.

구체적으로, COCO 데이터셋 이미지의 캡션과 박스 정보(텍스트)를 GPT-4에게 제공하고, GPT-4에게 해당 이미지를 실제로 볼 때 사람이 할 법한 질문-답변 쌍을 생성하도록 요청했다. 이렇게 생성된 **158K개의 합성 대화 데이터**로 LLaVA를 학습시켰다.

### LLaVA-1.5, LLaVA-NeXT 개선

LLaVA-1.5는 선형 프로젝션을 **2층 MLP**로 교체하고, CLIP ViT를 더 큰 ViT-L/14@336px로 업그레이드했다. 또한 학술 벤치마크 데이터를 추가해 VQA·OCR 성능을 크게 향상시켰다.

LLaVA-NeXT(LLaVA-1.6)는 **동적 고해상도 처리**를 도입했다. 이미지를 여러 타일로 분할해 각각 인코딩하고 합치는 방식으로 최대 4배 해상도까지 처리하며, 이미지 추론 능력과 OCR 성능이 크게 향상되었다.

## SigLIP과 최신 비전 인코더

### Sigmoid Loss (CLIP vs SigLIP)

Google이 2023년 제안한 **SigLIP(Sigmoid Loss for Language-Image Pre-Training)**은 CLIP의 소프트맥스 기반 대조 손실 대신 **시그모이드 손실**을 사용한다.

CLIP의 InfoNCE 손실은 배치 내의 모든 쌍을 비교하는 방식이라, 배치 크기가 커질수록 부정 샘플(negative sample)도 증가한다. 반면 SigLIP은 각 이미지-텍스트 쌍을 독립적으로 이진 분류(매칭/비매칭)하는 시그모이드 손실을 사용해 **배치 크기에 덜 민감**하고 **학습이 더 안정적**이다.

```python
def siglip_loss(image_features, text_features,
                temperature, bias):
    # 이진 크로스엔트로피 기반
    logits = torch.matmul(image_features,
                          text_features.T) * temperature + bias
    # 대각선=1 (매칭), 나머지=0 (비매칭)
    N = logits.shape[0]
    labels = 2 * torch.eye(N) - 1  # +1 / -1
    loss = -F.logsigmoid(labels * logits).mean()
    return loss
```

Gemini, PaliGemma, InternVL 등 최신 멀티모달 모델들이 SigLIP을 비전 인코더로 채택하고 있다. SigLIP-SO400M(소믈리에 400M 파라미터)은 현재 오픈소스 최고 성능의 비전 인코더 중 하나다.

## 실전 코드

![CLIP 이미지-텍스트 유사도](/assets/posts/multimodal-vlm-code.svg)

CLIP으로 이미지와 여러 텍스트 설명의 유사도를 계산하는 실전 예시다.

```python
import torch
from transformers import CLIPProcessor, CLIPModel
from PIL import Image

model = CLIPModel.from_pretrained(
    "openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained(
    "openai/clip-vit-base-patch32")

image = Image.open("cat.jpg")
texts = ["고양이 사진", "강아지 사진", "자동차 사진"]

inputs = processor(text=texts, images=image,
                   return_tensors="pt", padding=True)
outputs = model(**inputs)

# 이미지-텍스트 유사도 점수
logits = outputs.logits_per_image  # shape: [1, 3]
probs = logits.softmax(dim=1)
print(probs)  # tensor([[0.92, 0.05, 0.03]])

# 가장 유사한 텍스트 찾기
best_idx = probs.argmax(dim=1).item()
print(f"가장 유사한 설명: {texts[best_idx]}")
```

제로샷 이미지 검색에도 활용할 수 있다:

```python
# 텍스트 쿼리로 이미지 검색
from pathlib import Path

def search_images(query: str, image_paths: list, top_k=5):
    images = [Image.open(p) for p in image_paths]
    inputs = processor(
        text=[query], images=images,
        return_tensors="pt", padding=True
    )
    outputs = model(**inputs)
    # logits_per_text: [1, num_images]
    scores = outputs.logits_per_text.softmax(dim=1)
    top_indices = scores[0].topk(top_k).indices
    return [(image_paths[i], scores[0][i].item())
            for i in top_indices]
```

## VLM 응용

### 이미지 캡셔닝, VQA

VLM의 가장 기본적인 응용은 **이미지 캡셔닝**으로, 이미지를 입력받아 자연어 설명을 생성한다. COCO Captions·Flickr30k 같은 데이터셋으로 평가하며, CIDEr·BLEU·METEOR 같은 n-gram 기반 지표와 CLIPScore 같은 임베딩 기반 지표를 사용한다.

**VQA(Visual Question Answering)**는 이미지와 질문을 함께 입력받아 답변을 생성하는 작업으로, VQAv2·GQA·TextVQA 같은 벤치마크가 있다. TextVQA는 이미지 속 텍스트를 읽어야 하는 OCR 중심 VQA로, 영수증·간판·표지 이해에 중요하다.

### 이미지 검색, 이상 탐지

CLIP 임베딩 공간의 의미적 유사성을 이용한 **이미지 검색**은 전통적인 키워드 검색을 대체한다. "해질녘 해변가의 실루엣" 같은 추상적인 쿼리로도 관련 이미지를 찾을 수 있다. 이커머스에서는 텍스트 쿼리로 상품을 검색하는 **텍스트-이미지 교차 검색**에 활용된다.

**이상 탐지(Anomaly Detection)**에서는 "정상 제품"과 "결함이 있는 제품" 텍스트 프롬프트의 임베딩과 이미지 임베딩의 거리를 비교해 제조업 품질 검사를 자동화할 수 있다. WinCLIP 같은 방법은 별도 파인튜닝 없이 제로샷으로 산업 이상 탐지를 수행한다.

## 학습 데이터와 벤치마크

VLM 학습에 사용되는 주요 데이터셋을 정리하면 다음과 같다:

| 데이터셋 | 규모 | 유형 |
|---|---|---|
| LAION-5B | 58억 쌍 | 이미지-텍스트 쌍 |
| COYO-700M | 7억 쌍 | 이미지-텍스트 쌍 |
| LLaVA-Instruct-150K | 15만 개 | 시각 인스트럭션 |
| ShareGPT4V | 120만 개 | GPT-4V 캡션 |

VLM 평가에는 다양한 벤치마크가 사용된다. **MMBench**는 총 6K개 객관식 문제로 멀티모달 능력을 평가한다. **MMMU(Massive Multidisciplinary Multimodal Understanding)**는 대학 수준 전문 지식이 필요한 문제들로 구성된다. **ScienceQA**는 초중고 과학 교과서 문제로 과학 지식 추론을 평가하고, **OCRBench**는 장면 텍스트 인식과 문서 이해를 집중 평가한다.

현재 VLM 연구의 최전선은 더 고해상도 이미지 처리, 더 긴 비디오 이해, 3D 공간 추론으로 이동하고 있다. 다음 글에서는 이러한 멀티모달 AI 모델들을 어떻게 체계적으로 평가하는지, MMBench·MMMU·VQA 벤치마크 구조와 평가 방법론을 살펴본다.

---

**지난 글:** [멀티모달 LLM: 텍스트·이미지·오디오를 함께 이해하는 AI 완전 해설](/posts/multimodal-llm/)

**다음 글:** [멀티모달 AI 평가: MMBench·MMMU·VQA 벤치마크 완전 해설](/posts/multimodal-evaluation/)

<br>
읽어주셔서 감사합니다. 😊
