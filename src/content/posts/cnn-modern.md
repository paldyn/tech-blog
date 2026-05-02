---
title: "현대 CNN: MobileNet, EfficientNet, ConvNeXt"
description: "ResNet 이후 등장한 현대 CNN 아키텍처를 비교 분석한다. 모바일 환경을 위한 깊이별 분리 합성곱(MobileNet), 복합 스케일링(EfficientNet), ViT 설계 원리를 CNN에 적용한 ConvNeXt를 코드와 함께 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["CNN", "MobileNet", "EfficientNet", "ConvNeXt", "경량모델"]
featured: false
draft: false
---

[지난 글](/posts/cnn-resnet/)에서 잔차 연결이 깊은 네트워크 학습을 어떻게 가능하게 했는지 살펴봤다. ResNet(2015) 이후 연구는 두 방향으로 갈라졌다. 한쪽은 **더 효율적인 CNN**—제한된 자원에서 최대 성능—을 추구했고, 다른 쪽은 **더 강력한 CNN**—Transformer의 설계 원리를 흡수—을 목표로 했다. 오늘은 양쪽의 대표 모델을 살펴본다.

## MobileNet: 모바일 환경을 위한 경량화

스마트폰, IoT 기기에서 CNN을 실행하려면 파라미터와 연산량을 획기적으로 줄여야 한다. MobileNet은 **깊이별 분리 합성곱(Depthwise Separable Convolution)**으로 이를 달성했다.

![깊이별 분리 합성곱](/assets/posts/cnn-modern-mobilenet.svg)

일반 합성곱은 채널 간 조합과 공간 패턴 탐지를 동시에 수행한다. 깊이별 분리 합성곱은 이 두 작업을 분리한다.

```python
import torch.nn as nn

class DepthwiseSeparable(nn.Module):
    def __init__(self, in_ch, out_ch, stride=1):
        super().__init__()
        # Depthwise: 채널별 독립적 3×3 합성곱
        self.dw = nn.Sequential(
            nn.Conv2d(in_ch, in_ch, 3, stride=stride,
                      padding=1, groups=in_ch, bias=False),
            nn.BatchNorm2d(in_ch),
            nn.ReLU6()
        )
        # Pointwise: 1×1 채널 믹싱
        self.pw = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU6()
        )

    def forward(self, x):
        return self.pw(self.dw(x))

# 파라미터 수 비교
conv_std = nn.Conv2d(32, 64, 3, padding=1)
print(sum(p.numel() for p in conv_std.parameters()))
# 18,432

dws = DepthwiseSeparable(32, 64)
print(sum(p.numel() for p in dws.parameters()))
# 32*9 + 32*64 = 288 + 2048 = 2,336 → 약 8배 적음
```

핵심은 `groups=in_ch` 옵션이다. 채널 그룹을 채널 수만큼 분리하면 각 그룹이 하나의 채널만 처리한다.

## MobileNetV2: 역전 잔차 블록

V2는 **역전 잔차(Inverted Residual)**를 도입했다. 일반 ResNet 블록이 넓은 → 좁은 → 넓은(병목 구조)인 반면, V2는 좁은 → 넓은 → 좁은으로 뒤집는다.

```python
class InvertedResidual(nn.Module):
    def __init__(self, in_ch, out_ch, stride, expand_ratio):
        super().__init__()
        hidden = in_ch * expand_ratio
        self.use_res = (stride == 1 and in_ch == out_ch)

        layers = []
        if expand_ratio != 1:
            # 채널 확장 (pointwise)
            layers += [nn.Conv2d(in_ch, hidden, 1, bias=False),
                       nn.BatchNorm2d(hidden), nn.ReLU6()]
        layers += [
            # Depthwise
            nn.Conv2d(hidden, hidden, 3, stride=stride,
                      padding=1, groups=hidden, bias=False),
            nn.BatchNorm2d(hidden), nn.ReLU6(),
            # 채널 압축 (pointwise, 선형 활성화)
            nn.Conv2d(hidden, out_ch, 1, bias=False),
            nn.BatchNorm2d(out_ch),
        ]
        self.conv = nn.Sequential(*layers)

    def forward(self, x):
        if self.use_res:
            return x + self.conv(x)
        return self.conv(x)
```

넓어진 공간에서 정보를 처리하고 좁은 잔차 연결로 정보를 전달한다. 좁은 채널은 메모리 효율적이고, 넓은 내부에서 표현력을 유지한다.

## EfficientNet: 복합 스케일링

![EfficientNet 복합 스케일링](/assets/posts/cnn-modern-efficientnet.svg)

이전 연구들은 깊이, 너비, 해상도 중 하나만 늘렸다. EfficientNet은 세 요소를 동시에 균형있게 늘리는 것이 더 효율적임을 수학적으로 보였다.

```python
# EfficientNet-B0 기반 스케일링 팩터
efficientnet_configs = {
    # (width_coeff, depth_coeff, resolution, dropout)
    'B0': (1.0, 1.0, 224, 0.2),
    'B1': (1.0, 1.1, 240, 0.2),
    'B2': (1.1, 1.2, 260, 0.3),
    'B3': (1.2, 1.4, 300, 0.3),
    'B4': (1.4, 1.8, 380, 0.4),
    'B7': (2.0, 3.1, 600, 0.5),
}

# torchvision으로 EfficientNet 사용
import torchvision.models as models

model = models.efficientnet_b0(pretrained=True)
model.classifier[1] = nn.Linear(1280, 10)  # 분류기 교체

# 입력 전처리 (EfficientNet은 해상도 중요)
from torchvision import transforms
transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225])
])
```

핵심 블록은 **MBConv(Mobile Inverted Bottleneck Conv)** + Squeeze-and-Excitation이다.

```python
class SEBlock(nn.Module):
    """Squeeze-and-Excitation: 채널 어텐션"""
    def __init__(self, channels, reduction=4):
        super().__init__()
        reduced = max(1, channels // reduction)
        self.se = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Linear(channels, reduced),
            nn.SiLU(),
            nn.Linear(reduced, channels),
            nn.Sigmoid()
        )

    def forward(self, x):
        scale = self.se(x).view(-1, x.shape[1], 1, 1)
        return x * scale  # 채널별 중요도로 재스케일
```

SE 블록은 "어떤 채널이 더 중요한가?"를 글로벌 정보로 판단한다. GAP로 전체 특징을 요약하고, FC-SiLU-FC-Sigmoid로 채널별 가중치를 학습한다.

## ConvNeXt: Transformer를 품은 CNN

2022년 Liu et al.은 "순수 CNN으로 Swin Transformer와 동등한 성능을 낼 수 있는가?"라는 질문에 답했다. ResNet을 출발점으로 Transformer 설계 원리를 하나씩 적용해 성능을 높였다.

```python
class ConvNeXtBlock(nn.Module):
    """ConvNeXt 기본 블록"""
    def __init__(self, dim):
        super().__init__()
        self.dwconv = nn.Conv2d(dim, dim, 7, padding=3,
                                groups=dim)       # 7×7 Depthwise
        self.norm = nn.LayerNorm(dim, eps=1e-6)  # LayerNorm (BN 아님)
        self.pwconv1 = nn.Linear(dim, 4 * dim)   # 4× 확장
        self.act = nn.GELU()                      # GELU (ReLU 아님)
        self.pwconv2 = nn.Linear(4 * dim, dim)   # 복원

    def forward(self, x):
        input = x
        x = self.dwconv(x)
        # (B, C, H, W) → (B, H, W, C) for LayerNorm
        x = x.permute(0, 2, 3, 1)
        x = self.norm(x)
        x = self.pwconv1(x)
        x = self.act(x)
        x = self.pwconv2(x)
        x = x.permute(0, 3, 1, 2)  # 복원
        return input + x            # 잔차 연결
```

ResNet 대비 ConvNeXt의 변경점:

| 요소 | ResNet | ConvNeXt |
|------|--------|----------|
| 커널 | 3×3 | 7×7 (더 넓은 수용야) |
| 정규화 | BatchNorm | LayerNorm |
| 활성화 | ReLU (여러 개) | GELU (한 개) |
| 스테이지 비율 | 1:1:1:1 | 1:1:3:1 (Transformer 따름) |
| 다운샘플 | Stride Conv | 별도 레이어 |

## 어떤 모델을 선택할까

```python
# 모바일/엣지 배포
model = models.mobilenet_v3_small(pretrained=True)
# 파라미터: 2.5M, Top-1: 67.7%, 빠른 추론

# 클라우드 범용
model = models.efficientnet_b4(pretrained=True)
# 파라미터: 19M, Top-1: 83.4%, 좋은 정확도/효율 균형

# 고성능 연구/서버
model = models.convnext_base(pretrained=True)
# 파라미터: 89M, Top-1: 85.8%, Transformer급 성능

# torchvision 전체 목록 확인
print(models.list_models(module=models))
```

선택 기준은 배포 환경, 정확도 요구, 추론 지연 제약이다. 실제 제품에서는 항상 대상 하드웨어에서 **직접 프로파일링**하는 것이 이론적 파라미터 수보다 중요하다.

현대 CNN은 Transformer와의 경쟁에서 살아남기 위해 Transformer의 장점을 흡수했다. 결과적으로 오늘날의 최고 성능 비전 모델들은 CNN과 Transformer의 경계가 점점 흐려지고 있다.

---

**지난 글:** [ResNet: 잔차 연결이 깊은 네트워크를 가능하게 한 이유](/posts/cnn-resnet/)

**다음 글:** [이미지 분류: CNN 파이프라인 완전 가이드](/posts/cnn-image-classification/)

<br>
읽어주셔서 감사합니다. 😊
