---
title: "특징 맵: CNN이 이미지에서 보는 것"
description: "CNN 각 레이어의 특징 맵(Feature Map)이 무엇을 표현하는지 저수준·중수준·고수준 특징 관점에서 분석한다. 특징 맵 시각화 방법과 전이학습 전략을 코드와 함께 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["CNN", "특징맵", "FeatureMap", "전이학습", "딥러닝기초"]
featured: false
draft: false
---

[지난 글](/posts/cnn-pooling/)에서 풀링이 공간 정보를 압축하고 위치 불변성을 만드는 원리를 살펴봤다. 합성곱과 풀링이 쌓이면서 만들어지는 중간 출력물—**특징 맵(Feature Map)**—이 실제로 무엇을 담고 있는지 이해하는 것은 CNN을 효과적으로 활용하기 위한 핵심이다. 특징 맵의 본질을 파악하면 전이학습 전략도 자연스럽게 따라온다.

## 특징 맵이란

합성곱 레이어는 입력에 여러 개의 필터를 적용해 `(C_out, H, W)` 형태의 3D 텐서를 출력한다. 이것이 특징 맵이다. 채널 수 `C_out`은 필터의 개수이고, 각 채널은 서로 다른 패턴에 대한 응답 강도를 나타낸다.

특징 맵의 한 위치 `(c, i, j)`의 값은: "채널 `c`의 필터가 감지하는 패턴이 원본 이미지의 해당 위치에 **얼마나 강하게** 존재하는가"를 나타낸다.

![CNN 계층적 특징 맵](/assets/posts/cnn-feature-maps-hierarchy.svg)

## 저수준 특징: 가장자리와 색상

첫 번째 합성곱 레이어의 필터들을 시각화하면 놀랍게도 고전적인 이미지 처리 필터와 유사하다. Gabor 필터(방향성 엣지 감지), 색상 감지기 등이 자연스럽게 학습된다. 이는 딥러닝 이전의 수작업 특징 추출과 같은 방향으로 수렴한다는 강력한 증거다.

```python
import torch
import torch.nn as nn
import torchvision.models as models
import matplotlib.pyplot as plt
import numpy as np

# ResNet50의 첫 번째 conv 필터 시각화
model = models.resnet50(pretrained=True)
first_conv = model.conv1.weight.data  # shape: [64, 3, 7, 7]

fig, axes = plt.subplots(8, 8, figsize=(10, 10))
for i, ax in enumerate(axes.flat):
    if i < 64:
        # 첫 3채널(RGB)로 필터를 RGB 이미지로 시각화
        filt = first_conv[i].permute(1, 2, 0).numpy()
        filt = (filt - filt.min()) / (filt.max() - filt.min())
        ax.imshow(filt)
    ax.axis('off')
plt.suptitle('ResNet50 첫 번째 레이어 64개 필터')
plt.tight_layout()
plt.savefig('resnet50_filters.png', dpi=100)
```

## 특징 맵 시각화

특정 입력 이미지에 대한 중간 레이어 출력을 시각화할 수 있다.

```python
# 특정 레이어의 특징 맵 추출
class FeatureExtractor(nn.Module):
    def __init__(self, model, target_layer):
        super().__init__()
        self.features = None
        # hook으로 중간 출력 캡처
        target_layer.register_forward_hook(self._hook)
        self.model = model

    def _hook(self, module, inp, output):
        self.features = output.detach()

    def forward(self, x):
        return self.model(x)

model = models.resnet50(pretrained=True).eval()
extractor = FeatureExtractor(model, model.layer1[0].conv1)

# 이미지 추론
import torchvision.transforms as T
from PIL import Image

transform = T.Compose([
    T.Resize((224, 224)),
    T.ToTensor(),
    T.Normalize([0.485,0.456,0.406], [0.229,0.224,0.225])
])

img = Image.open('cat.jpg')
x = transform(img).unsqueeze(0)

with torch.no_grad():
    _ = extractor(x)

fmaps = extractor.features[0]  # (64, 56, 56)
print(fmaps.shape)

# 첫 16개 채널 시각화
fig, axes = plt.subplots(4, 4, figsize=(8, 8))
for i, ax in enumerate(axes.flat):
    if i < 16:
        ax.imshow(fmaps[i].numpy(), cmap='viridis')
    ax.axis('off')
plt.tight_layout()
```

## 계층적 추상화

네트워크가 깊어질수록 특징은 점점 추상적이고 의미론적으로 변한다.

- **레이어 1-2**: 수평/수직/대각 엣지, 색상 블롭 → 모든 자연 이미지 공유
- **레이어 3-4**: 질감, 코너, 곡선, 격자 패턴 → 대부분의 도메인 공유
- **레이어 5+**: 눈, 바퀴, 창문, 털 등 의미 단위 → 훈련 도메인 특화

이 계층 구조는 생물학적 시각 피질(V1→V2→V4→IT)의 처리 방식과 놀랍도록 유사하다.

## 수용야 (Receptive Field) 계산

특징 맵의 각 뉴런이 원본 이미지의 얼마나 넓은 영역에 의존하는지가 수용야다.

```python
def compute_receptive_field(layers):
    """
    layers: list of (kernel_size, stride, padding)
    """
    rf = 1
    total_stride = 1
    for k, s, p in layers:
        rf = rf + (k - 1) * total_stride
        total_stride *= s
    return rf

# VGG-style: 3×3 conv 두 번 + 2×2 maxpool
layers = [
    (3, 1, 1),  # conv1
    (3, 1, 1),  # conv2
    (2, 2, 0),  # maxpool
    (3, 1, 1),  # conv3
    (3, 1, 1),  # conv4
    (2, 2, 0),  # maxpool
]
rf = compute_receptive_field(layers)
print(f"6레이어 후 수용야: {rf}×{rf}")  # 28×28
```

## 전이학습 전략

![특징 맵 시각화와 전이학습](/assets/posts/cnn-feature-maps-transfer.svg)

특징의 계층적 특성은 전이학습(Transfer Learning) 전략을 결정하는 근거가 된다.

```python
import torchvision.models as models
import torch.nn as nn

# ResNet50 로드
model = models.resnet50(pretrained=True)

# 전략 1: Feature Extractor - 모든 레이어 고정
for param in model.parameters():
    param.requires_grad = False

# 분류 헤드만 교체
model.fc = nn.Linear(2048, 10)  # 10클래스로 교체

# requires_grad가 True인 파라미터만 최적화
optimizer = torch.optim.Adam(
    filter(lambda p: p.requires_grad, model.parameters()),
    lr=1e-3
)

# 전략 2: Partial Fine-tuning - 앞 레이어만 고정
for name, param in model.named_parameters():
    if 'layer4' in name or 'fc' in name:
        param.requires_grad = True
    else:
        param.requires_grad = False

# 전략 3: Full Fine-tuning - 전체 낮은 lr
for param in model.parameters():
    param.requires_grad = True

optimizer = torch.optim.Adam([
    {'params': model.layer1.parameters(), 'lr': 1e-5},
    {'params': model.layer2.parameters(), 'lr': 1e-5},
    {'params': model.layer3.parameters(), 'lr': 1e-4},
    {'params': model.layer4.parameters(), 'lr': 1e-4},
    {'params': model.fc.parameters(),     'lr': 1e-3},
])
```

전략 선택 기준은 두 가지다: **데이터 크기**와 **도메인 유사성**. 데이터가 적고 도메인이 유사하면 전략 1, 데이터가 많고 도메인이 다르면 전략 3이 적합하다.

## CAM: 분류 근거 시각화

Class Activation Mapping(CAM)은 모델이 어떤 특징 맵 영역에 근거해 분류 결정을 내렸는지 보여준다.

```python
def get_cam(model, img_tensor, class_idx):
    """GAP 기반 CAM 계산"""
    # 마지막 conv 출력 추출
    features = None
    def hook(m, i, o):
        nonlocal features
        features = o

    model.layer4.register_forward_hook(hook)

    with torch.no_grad():
        output = model(img_tensor)

    # FC 가중치 가져오기 (GAP 이후)
    fc_weights = model.fc.weight.data  # (num_classes, 2048)

    # CAM = 가중 합산
    cam = torch.einsum('c,chw->hw', fc_weights[class_idx], features[0])
    cam = cam.relu()
    return cam
```

CAM은 "왜 이 이미지를 고양이로 분류했는가?"에 대한 설명 가능성을 제공한다. 의료 AI나 자율주행처럼 해석 가능성이 중요한 분야에서 필수적인 도구다.

특징 맵의 이해는 단순한 이론에 그치지 않는다. 전이학습 전략 결정, 모델 디버깅, 설명 가능 AI, 그리고 다음 글에서 다룰 CNN 아키텍처 역사를 이해하는 데 직접적인 기반이 된다.

---

**지난 글:** [풀링: 공간 정보 압축과 불변성](/posts/cnn-pooling/)

**다음 글:** [CNN 아키텍처 역사: LeNet에서 EfficientNet까지](/posts/cnn-architectures-history/)

<br>
읽어주셔서 감사합니다. 😊
