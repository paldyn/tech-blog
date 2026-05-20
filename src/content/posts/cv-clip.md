---
title: "CLIP: 이미지와 텍스트를 같은 공간에 정렬하는 대조 학습"
description: "OpenAI CLIP의 대조 학습 원리, InfoNCE 손실, 제로샷 이미지 분류 메커니즘, 그리고 Stable Diffusion·VLM에서의 활용까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["CLIP", "대조학습", "멀티모달", "제로샷", "비전언어모델", "InfoNCE", "임베딩", "StableDiffusion"]
featured: false
draft: false
---

[지난 글](/posts/cv-vision-transformer/)에서 Vision Transformer가 이미지를 패치 시퀀스로 처리하는 방법을 다뤘다. 이번 글에서는 ViT를 비전 인코더로 사용하면서, 이미지와 텍스트를 **동일한 임베딩 공간에 정렬**하는 CLIP(Contrastive Language-Image Pre-training)을 완전 해설한다. CLIP은 오늘날 Stable Diffusion, LLaVA, GPT-4V 등 거의 모든 멀티모달 AI의 비전 인코더로 쓰이는 핵심 기반 기술이다.

## CLIP의 핵심 아이디어

CLIP은 인터넷에서 수집한 **4억 개의 이미지-텍스트 쌍**을 사용해, 이미지와 그것을 설명하는 텍스트가 임베딩 공간에서 가깝도록 훈련한다. 새로운 라벨이나 수작업 어노테이션 없이, 웹의 alt-text와 캡션만으로 강력한 비전 표현을 학습하는 **자기지도 학습**의 일종이다.

![CLIP 대조 학습 구조](/assets/posts/cv-clip-architecture.svg)

## 대조 학습과 InfoNCE 손실

배치 크기를 N이라 하면, N개의 이미지와 N개의 텍스트로 N×N 유사도 행렬을 만든다. 대각선의 N개 쌍은 매칭 쌍(양성)이고, 나머지 N²-N개는 비매칭 쌍(음성)이다. InfoNCE 손실은 각 이미지에 대해 올바른 텍스트 쌍의 유사도를 최대화하는 다중 클래스 분류 손실로 해석할 수 있다.

```python
import torch
import torch.nn.functional as F

def clip_loss(
    image_features: torch.Tensor,  # (N, D) 이미지 임베딩
    text_features: torch.Tensor,   # (N, D) 텍스트 임베딩
    temperature: float = 0.07,
) -> torch.Tensor:
    # L2 정규화
    image_features = F.normalize(image_features, dim=-1)
    text_features = F.normalize(text_features, dim=-1)

    # 코사인 유사도 행렬 (N × N)
    logits = image_features @ text_features.T / temperature

    # 대각선이 정답 (i번째 이미지 ↔ i번째 텍스트)
    labels = torch.arange(len(logits), device=logits.device)

    # 이미지→텍스트 / 텍스트→이미지 양방향 손실
    loss_i2t = F.cross_entropy(logits, labels)
    loss_t2i = F.cross_entropy(logits.T, labels)

    return (loss_i2t + loss_t2i) / 2
```

temperature τ=0.07은 학습 초기의 기본값이며, 실제 CLIP 학습에서는 이 값도 학습 가능한 파라미터로 설정한다.

## CLIP 아키텍처

```python
import torch
import torch.nn as nn
from torchvision.models import vit_b_16
from transformers import BertModel

class CLIP(nn.Module):
    def __init__(self, embed_dim: int = 512):
        super().__init__()
        # 이미지 인코더: ViT 또는 ResNet
        self.image_encoder = vit_b_16(weights=None)
        self.image_proj = nn.Linear(768, embed_dim)

        # 텍스트 인코더: Transformer
        self.text_encoder = BertModel.from_pretrained(
            'bert-base-uncased'
        )
        self.text_proj = nn.Linear(768, embed_dim)

        # 학습 가능한 temperature
        self.log_scale = nn.Parameter(torch.ones([]) * 0.07)

    def encode_image(self, images: torch.Tensor):
        feats = self.image_encoder(images)
        return self.image_proj(feats)

    def encode_text(self, input_ids, attention_mask):
        out = self.text_encoder(
            input_ids=input_ids,
            attention_mask=attention_mask
        )
        # [CLS] 토큰 특징 사용
        return self.text_proj(out.last_hidden_state[:, 0])

    def forward(self, images, input_ids, attention_mask):
        img_feat = self.encode_image(images)
        txt_feat = self.encode_text(input_ids, attention_mask)
        loss = clip_loss(img_feat, txt_feat, self.log_scale.exp())
        return loss
```

## 제로샷 이미지 분류

CLIP의 가장 강력한 능력은 **파인튜닝 없이 임의의 클래스를 분류**하는 것이다. ImageNet 분류라면 "a photo of a {classname}" 형태의 템플릿 텍스트 1000개를 만들어 임베딩하고, 이미지 임베딩과 가장 유사한 텍스트를 찾으면 된다.

```python
from transformers import CLIPModel, CLIPProcessor
from PIL import Image
import torch

model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained(
    "openai/clip-vit-base-patch32"
)

# 분류할 이미지
image = Image.open("dog.jpg")

# 후보 클래스 텍스트 생성
candidate_labels = ["고양이", "강아지", "새", "물고기"]
texts = [f"a photo of a {label}" for label in candidate_labels]

# 전처리 및 추론
inputs = processor(
    text=texts,
    images=image,
    return_tensors="pt",
    padding=True
)

with torch.no_grad():
    outputs = model(**inputs)
    logits_per_image = outputs.logits_per_image  # (1, 4)
    probs = logits_per_image.softmax(dim=-1)

for label, prob in zip(candidate_labels, probs[0]):
    print(f"{label}: {prob.item():.3f}")
# 강아지: 0.923, 고양이: 0.041, 새: 0.022, 물고기: 0.014
```

## 이미지-텍스트 검색

CLIP 임베딩으로 대규모 이미지 데이터베이스를 구축하면, 텍스트 쿼리로 의미 기반 이미지 검색이 가능하다.

```python
import numpy as np
from typing import List

def build_image_index(
    image_paths: List[str], model, processor
) -> np.ndarray:
    """이미지 임베딩 인덱스 구축"""
    embeddings = []
    for path in image_paths:
        image = Image.open(path)
        inputs = processor(images=image, return_tensors="pt")
        with torch.no_grad():
            feat = model.get_image_features(**inputs)
            feat = feat / feat.norm(dim=-1, keepdim=True)
        embeddings.append(feat.cpu().numpy())
    return np.vstack(embeddings)


def search_by_text(
    query: str,
    image_embeddings: np.ndarray,
    model, processor,
    top_k: int = 5
) -> List[int]:
    """텍스트 쿼리로 유사 이미지 검색"""
    inputs = processor(text=[query], return_tensors="pt", padding=True)
    with torch.no_grad():
        txt_feat = model.get_text_features(**inputs)
        txt_feat = txt_feat / txt_feat.norm(dim=-1, keepdim=True)

    similarities = (image_embeddings @ txt_feat.T.numpy()).squeeze()
    return similarities.argsort()[::-1][:top_k].tolist()
```

## CLIP 파생 모델 생태계

![CLIP 파생 응용 모델](/assets/posts/cv-clip-applications.svg)

**DALL-E 2**는 CLIP 이미지 임베딩을 prior 모델로 변환한 뒤 확산 모델로 이미지를 생성한다. **Stable Diffusion**은 CLIP 텍스트 인코더의 출력을 UNet의 크로스 어텐션에 주입해 텍스트-이미지 정렬을 달성한다. **LLaVA·InstructBLIP** 등 VLM들은 CLIP 비전 인코더로 추출한 이미지 피처를 LLM에 프로젝션해 멀티모달 이해를 가능하게 한다.

## CLIP의 한계와 개선 방향

**강점**: 제로샷 일반화, 멀티모달 표현, 노이즈 데이터에 강건.

**약점**: 미세한 시각 추론 약함(숫자 세기, 공간 관계), 도메인 특화 데이터에서 SOTA에 못 미칠 수 있음, 4억 쌍이라는 대규모 학습 데이터 요구.

SigLIP(Google)은 Softmax 대신 Sigmoid 손실을 사용해 배치 크기에 독립적인 학습을 달성했고, OpenCLIP은 LAION-5B 데이터셋으로 CLIP을 오픈소스로 재현해 접근성을 높였다.

다음 글에서는 CLIP의 비전 인코더인 ViT가 확산 모델과 만나는 **Diffusion 모델의 기초**를 다룬다.

---

**지난 글:** [Vision Transformer(ViT): 이미지를 문장처럼 처리하는 Transformer](/posts/cv-vision-transformer/)

**다음 글:** [확산 모델(Diffusion Model) 기초: 노이즈에서 이미지로](/posts/cv-diffusion-basics/)

<br>
읽어주셔서 감사합니다. 😊
