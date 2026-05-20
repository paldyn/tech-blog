---
title: "Vision Transformer(ViT): 이미지를 문장처럼 처리하는 Transformer"
description: "ViT의 패치 분할·위치 인코딩·Transformer Encoder 구조를 완전 해설하고, DeiT·Swin·BEiT·MAE 등 후속 모델 계보와 PyTorch 구현 코드를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["ViT", "VisionTransformer", "Swin", "DeiT", "MAE", "컴퓨터비전", "자기어텐션", "패치임베딩"]
featured: false
draft: false
---

[지난 글](/posts/cv-image-classification-deep/)에서 딥러닝 이미지 분류의 전체 파이프라인과 CNN 기반 백본들을 살펴봤다. 이번 글에서는 2020년 등장해 CV 분야의 판도를 바꾼 **Vision Transformer(ViT)**를 완전 해설한다. ViT는 "이미지도 단어 시퀀스처럼 처리할 수 있다"는 단순한 아이디어로 시작해, 오늘날 CLIP·Stable Diffusion·GPT-4V 등 멀티모달 모델의 비전 인코더로 자리잡았다.

## ViT 핵심 아이디어: 이미지 → 패치 시퀀스

![Vision Transformer 아키텍처](/assets/posts/cv-vision-transformer-architecture.svg)

ViT의 핵심은 이미지를 **16×16 크기의 패치**로 분할해 1D 시퀀스로 만드는 것이다. 224×224 이미지를 16×16 패치로 나누면 14×14 = 196개 패치가 생긴다. 각 패치는 선형 레이어를 거쳐 768차원 벡터(토큰)로 임베딩된다. 여기에 BERT의 [CLS] 토큰과 같은 역할을 하는 분류 토큰을 prepend하고, 위치 정보를 담은 1D 학습 가능한 위치 인코딩을 더해 최종 197개 토큰 시퀀스를 만든다.

## 패치 임베딩 구현

```python
import torch
import torch.nn as nn

class PatchEmbedding(nn.Module):
    def __init__(
        self,
        img_size: int = 224,
        patch_size: int = 16,
        in_channels: int = 3,
        embed_dim: int = 768,
    ):
        super().__init__()
        self.num_patches = (img_size // patch_size) ** 2
        # 패치 분할 + 선형 임베딩을 Conv2d로 한 번에
        self.proj = nn.Conv2d(
            in_channels, embed_dim,
            kernel_size=patch_size, stride=patch_size
        )
        self.cls_token = nn.Parameter(torch.zeros(1, 1, embed_dim))
        self.pos_embed = nn.Parameter(
            torch.zeros(1, self.num_patches + 1, embed_dim)
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        B = x.shape[0]
        # (B, C, H, W) → (B, embed_dim, H/P, W/P) → (B, N, embed_dim)
        x = self.proj(x).flatten(2).transpose(1, 2)

        # CLS 토큰 확장 + 패치 토큰과 concat
        cls = self.cls_token.expand(B, -1, -1)
        x = torch.cat([cls, x], dim=1)

        return x + self.pos_embed  # 위치 인코딩 더하기
```

Conv2d를 patch_size × patch_size 커널, patch_size 스트라이드로 설정하면 패치 분할과 선형 임베딩을 한 번에 처리할 수 있다.

## Transformer Encoder 블록

ViT의 인코더 블록은 NLP Transformer와 거의 동일하다. 차이점은 Post-LN이 아닌 **Pre-LN** 구조를 사용한다는 점이다.

```python
class TransformerBlock(nn.Module):
    def __init__(
        self,
        embed_dim: int = 768,
        num_heads: int = 12,
        mlp_ratio: float = 4.0,
        dropout: float = 0.0,
    ):
        super().__init__()
        self.norm1 = nn.LayerNorm(embed_dim)
        self.attn = nn.MultiheadAttention(
            embed_dim, num_heads,
            dropout=dropout, batch_first=True
        )
        self.norm2 = nn.LayerNorm(embed_dim)
        mlp_hidden = int(embed_dim * mlp_ratio)
        self.mlp = nn.Sequential(
            nn.Linear(embed_dim, mlp_hidden),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(mlp_hidden, embed_dim),
            nn.Dropout(dropout),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Pre-LN + 잔차 연결
        normed = self.norm1(x)
        attn_out, _ = self.attn(normed, normed, normed)
        x = x + attn_out

        x = x + self.mlp(self.norm2(x))
        return x
```

MLP는 embed_dim의 4배로 확장했다가 다시 축소한다(ViT-B 기준 768→3072→768). 활성화 함수는 ReLU 대신 **GELU**를 사용한다.

## 전체 ViT 모델

```python
class ViT(nn.Module):
    def __init__(
        self,
        img_size: int = 224,
        patch_size: int = 16,
        num_classes: int = 1000,
        embed_dim: int = 768,
        depth: int = 12,
        num_heads: int = 12,
    ):
        super().__init__()
        self.patch_embed = PatchEmbedding(
            img_size, patch_size, 3, embed_dim
        )
        self.blocks = nn.Sequential(*[
            TransformerBlock(embed_dim, num_heads)
            for _ in range(depth)
        ])
        self.norm = nn.LayerNorm(embed_dim)
        self.head = nn.Linear(embed_dim, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.patch_embed(x)     # (B, 197, 768)
        x = self.blocks(x)          # (B, 197, 768)
        x = self.norm(x)
        cls = x[:, 0]               # CLS 토큰만 추출
        return self.head(cls)       # (B, num_classes)

# ViT-B/16: depth=12, embed_dim=768, num_heads=12 → 86M params
# ViT-L/16: depth=24, embed_dim=1024, num_heads=16 → 307M params
```

## HuggingFace로 사전학습 ViT 사용

```python
from transformers import ViTForImageClassification, ViTImageProcessor
import torch
from PIL import Image

processor = ViTImageProcessor.from_pretrained(
    'google/vit-base-patch16-224'
)
model = ViTForImageClassification.from_pretrained(
    'google/vit-base-patch16-224'
)
model.eval()

image = Image.open('cat.jpg').convert('RGB')
inputs = processor(images=image, return_tensors='pt')

with torch.no_grad():
    outputs = model(**inputs)
    logits = outputs.logits
    pred_id = logits.argmax(-1).item()
    print(model.config.id2label[pred_id])
```

## ViT 계열 후속 모델

![ViT 계열 모델 비교](/assets/posts/cv-vision-transformer-variants.svg)

### DeiT — 데이터 효율적 학습

원본 ViT는 JFT-300M 같은 초대규모 데이터셋을 요구한다. DeiT는 ImageNet만으로 경쟁력 있는 ViT를 학습하기 위해 **증류 토큰(distillation token)**을 도입했다. CLS 토큰 외에 CNN 교사 모델의 예측을 모방하는 증류 토큰을 추가해 CNN의 귀납적 편향을 ViT에 이식한다.

### Swin Transformer — 계층형 윈도우 어텐션

ViT의 가장 큰 단점은 O(N²) 어텐션 복잡도다. Swin Transformer는 이미지를 7×7 윈도우로 나눠 **윈도우 내부에서만 어텐션**을 계산(O(N))하고, 레이어가 깊어질수록 패치를 병합해 CNN처럼 계층적 특징맵을 생성한다. 이 구조 덕분에 고해상도 입력이 필요한 객체 탐지·세그멘테이션의 백본으로도 쓸 수 있다.

### MAE — 마스킹 자동 인코더

MAE(Masked Autoencoder)는 입력 패치의 75%를 무작위로 마스킹하고, Encoder는 가시(visible) 패치만 처리한 뒤, 가벼운 Decoder가 마스킹된 패치의 픽셀값을 복원하도록 학습한다. 마스킹 비율이 높아 중복 정보가 적은 가시 패치만 처리하므로, 원본 ViT 대비 **3배 빠른 사전학습**이 가능하다.

## CNN vs ViT 선택 기준

| 상황 | 추천 |
|------|------|
| 데이터 < 10K장 | CNN(ResNet, EfficientNet) |
| 데이터 > 100K장 | ViT(DeiT, Swin) |
| 객체 탐지·분할 | Swin Transformer |
| 엣지 디바이스 | MobileNetV3, EfficientNet-B0 |
| 멀티모달 비전 | ViT-L (CLIP 백본) |

ViT는 데이터가 충분할 때 CNN을 압도하지만, 소량 데이터에서는 여전히 CNN이 우세하다. 실무에서는 **DeiT 또는 Swin**을 사전학습 백본으로 쓰고, 태스크에 맞게 파인튜닝하는 패턴이 가장 일반적이다.

다음 글에서는 ViT 기반 비전-언어 정렬 모델인 **CLIP**의 대조 학습 원리와 제로샷 분류 방법을 다룬다.

---

**지난 글:** [딥러닝 이미지 분류 완전 정복: 백본·전이학습·실전 코드](/posts/cv-image-classification-deep/)

**다음 글:** [CLIP: 이미지와 텍스트를 같은 공간에 정렬하는 대조 학습](/posts/cv-clip/)

<br>
읽어주셔서 감사합니다. 😊
