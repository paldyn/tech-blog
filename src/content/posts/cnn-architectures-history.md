---
title: "CNN 아키텍처 역사: LeNet에서 EfficientNet까지"
description: "1998년 LeNet-5부터 2019년 EfficientNet까지 CNN 아키텍처의 역사적 발전을 추적한다. 각 모델이 도입한 핵심 혁신(ReLU, Dropout, 잔차 연결, 1×1 합성곱, Inception 모듈)과 ImageNet 오류율 감소 과정을 코드와 함께 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["CNN", "AlexNet", "ResNet", "VGGNet", "딥러닝역사"]
featured: false
draft: false
---

[지난 글](/posts/cnn-feature-maps/)에서 CNN이 계층적으로 저수준→고수준 특징을 추출하는 방식을 살펴봤다. 이 계층적 구조를 어떻게 설계하느냐에 따라 성능이 극적으로 달라진다. 지난 30년간 연구자들은 더 깊고 효율적인 CNN을 만들기 위해 수많은 구조적 혁신을 이뤄냈다. 오늘은 그 역사를 주요 이정표와 핵심 아이디어 중심으로 정리한다.

## LeNet-5 (1998): 개념 증명

얀 르쿤(Yann LeCun)이 개발한 LeNet-5는 현대 CNN의 직접적인 조상이다. 합성곱 레이어, 풀링 레이어, 완전연결 레이어의 삼중 조합을 최초로 체계화했다.

```python
# LeNet-5 (현대 PyTorch 재현)
import torch.nn as nn

class LeNet5(nn.Module):
    def __init__(self, num_classes=10):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 6, kernel_size=5),   # 28→24
            nn.Tanh(),
            nn.AvgPool2d(2),                   # 24→12
            nn.Conv2d(6, 16, kernel_size=5),   # 12→8
            nn.Tanh(),
            nn.AvgPool2d(2),                   # 8→4
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),
            nn.Linear(16*4*4, 120),
            nn.Tanh(),
            nn.Linear(120, 84),
            nn.Tanh(),
            nn.Linear(84, num_classes),
        )

    def forward(self, x):
        return self.classifier(self.features(x))
```

60,000개 파라미터로 MNIST 손글씨 인식을 당시 최고 수준으로 달성했다. 그러나 컴퓨팅 한계로 더 큰 데이터셋에는 적용할 수 없었다.

## AlexNet (2012): 딥러닝 붐의 방아쇠

![CNN 아키텍처 역사 타임라인](/assets/posts/cnn-architectures-history-timeline.svg)

2012년 ILSVRC(ImageNet 대회)에서 AlexNet은 2위와 **10% 이상** 차이로 우승하며 딥러닝 시대를 열었다. 주요 혁신은 다음과 같다.

1. **ReLU**: Tanh/Sigmoid 대신 ReLU 사용 → 기울기 소실 완화, 6배 빠른 학습
2. **Dropout**: FC 레이어에 0.5 dropout → 과적합 방지
3. **GPU 병렬 학습**: 두 GPU에 분산 (당시 메모리 제약)
4. **Data Augmentation**: 수평 반전, 랜덤 크롭

```python
class AlexNet(nn.Module):
    def __init__(self, num_classes=1000):
        super().__init__()
        self.features = nn.Sequential(
            nn.Conv2d(3, 96, 11, stride=4),  # 224→55
            nn.ReLU(),
            nn.MaxPool2d(3, 2),              # 55→27
            nn.Conv2d(96, 256, 5, padding=2),
            nn.ReLU(),
            nn.MaxPool2d(3, 2),              # 27→13
            nn.Conv2d(256, 384, 3, padding=1),
            nn.ReLU(),
            nn.Conv2d(384, 384, 3, padding=1),
            nn.ReLU(),
            nn.Conv2d(384, 256, 3, padding=1),
            nn.ReLU(),
            nn.MaxPool2d(3, 2),              # 13→6
        )
        self.classifier = nn.Sequential(
            nn.Dropout(0.5),
            nn.Linear(256*6*6, 4096), nn.ReLU(),
            nn.Dropout(0.5),
            nn.Linear(4096, 4096), nn.ReLU(),
            nn.Linear(4096, num_classes),
        )
```

## VGGNet (2014): 깊이의 체계적 탐구

옥스퍼드 VGG 팀은 단 하나의 질문을 했다: "3×3 커널만 사용했을 때 깊이를 늘리면 성능이 좋아지는가?" 답은 "그렇다"였다.

![아키텍처별 핵심 혁신](/assets/posts/cnn-architectures-history-innovations.svg)

**3×3 두 번 = 5×5 한 번 수용야**, 파라미터는 25개 vs 18개. 이 단순한 원칙으로 16-19층을 쌓았다. VGGNet은 구조가 단순해 전이학습 연구의 기준 모델이 되었다.

```python
# VGG 블록 패턴
def vgg_block(num_convs, in_ch, out_ch):
    layers = []
    for _ in range(num_convs):
        layers += [nn.Conv2d(in_ch, out_ch, 3, padding=1),
                   nn.ReLU(inplace=True)]
        in_ch = out_ch
    layers.append(nn.MaxPool2d(2, 2))
    return nn.Sequential(*layers)

# VGG-16 구조
vgg16_blocks = [
    vgg_block(2, 3,   64),   # 224→112
    vgg_block(2, 64,  128),  # 112→56
    vgg_block(3, 128, 256),  # 56→28
    vgg_block(3, 256, 512),  # 28→14
    vgg_block(3, 512, 512),  # 14→7
]
```

단점: 138M 파라미터로 과도하게 무겁다. FC 레이어 3개가 파라미터 대부분을 차지한다.

## GoogLeNet (2014): 효율성의 혁신

같은 해 Google은 완전히 다른 방향으로 승부했다. **Inception 모듈**: 1×1, 3×3, 5×5 합성곱을 병렬로 수행하고 채널 방향으로 합친다. 1×1 합성곱으로 먼저 채널을 줄여 파라미터를 대폭 절약한다.

결과: 22층이면서도 5M 파라미터로 AlexNet(60M)보다 12배 적다.

```python
class InceptionModule(nn.Module):
    def __init__(self, in_ch, out_1x1, red_3x3, out_3x3,
                 red_5x5, out_5x5, out_pool):
        super().__init__()
        # 분기 1: 1×1
        self.b1 = nn.Sequential(
            nn.Conv2d(in_ch, out_1x1, 1), nn.ReLU()
        )
        # 분기 2: 1×1 → 3×3
        self.b2 = nn.Sequential(
            nn.Conv2d(in_ch, red_3x3, 1), nn.ReLU(),
            nn.Conv2d(red_3x3, out_3x3, 3, padding=1), nn.ReLU()
        )
        # 분기 3: 1×1 → 5×5
        self.b3 = nn.Sequential(
            nn.Conv2d(in_ch, red_5x5, 1), nn.ReLU(),
            nn.Conv2d(red_5x5, out_5x5, 5, padding=2), nn.ReLU()
        )
        # 분기 4: MaxPool → 1×1
        self.b4 = nn.Sequential(
            nn.MaxPool2d(3, stride=1, padding=1),
            nn.Conv2d(in_ch, out_pool, 1), nn.ReLU()
        )

    def forward(self, x):
        return torch.cat([self.b1(x), self.b2(x),
                          self.b3(x), self.b4(x)], dim=1)
```

## ResNet (2015): 잔차 연결의 혁명

He et al.은 단순한 관찰에서 출발했다: "56층 네트워크가 20층보다 왜 성능이 낮은가?" 더 깊다고 항상 좋은 게 아니었다. 해결책은 **잔차 연결(Residual Connection)**이었다.

```python
class ResidualBlock(nn.Module):
    def __init__(self, channels):
        super().__init__()
        self.conv1 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn1   = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn2   = nn.BatchNorm2d(channels)

    def forward(self, x):
        residual = x
        out = F.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out += residual   # ← 잔차 연결
        return F.relu(out)
```

`H(x) = F(x) + x`. 레이어가 학습하는 것은 `F(x) = H(x) - x`, 즉 **잔차(Residual)**다. 불필요하면 `F(x) → 0`으로 수렴하면 된다 — 항등 함수를 배우기 위해 모든 가중치를 0으로 만들기만 하면 된다.

이로써 152층 네트워크 학습이 가능해졌고, ImageNet 오류율이 인간 수준(5.1%)이하인 **3.57%**로 내려갔다.

## DenseNet (2017): 밀집 연결

DenseNet은 잔차 연결을 극단까지 밀어붙였다. 모든 레이어가 이후 모든 레이어와 연결된다.

```python
class DenseLayer(nn.Module):
    def __init__(self, in_ch, growth_rate):
        super().__init__()
        self.layer = nn.Sequential(
            nn.BatchNorm2d(in_ch), nn.ReLU(),
            nn.Conv2d(in_ch, growth_rate, 3, padding=1, bias=False)
        )

    def forward(self, x):
        return torch.cat([x, self.layer(x)], 1)  # 채널 누적
```

장점: 특징 재사용, 기울기 소실 완화. 단점: 메모리 사용 증가.

## EfficientNet (2019): 복합 스케일링

이전 연구들은 깊이, 너비, 해상도 중 하나만 늘렸다. EfficientNet은 세 요소를 **동시에 균형있게** 스케일링하는 복합 계수를 도입했다.

```text
깊이: d = α^φ
너비: w = β^φ
해상도: r = γ^φ
s.t. α·β²·γ² ≈ 2, φ는 자원 제약
```

EfficientNet-B7은 당시 ImageNet 최고 정확도(84.4%)를 달성하면서도 GPipe보다 8.4배 작고 6.1배 빠르다.

## 30년 진화의 교훈

1. **깊이**: 더 깊을수록 표현력 증가 (단, 기울기 문제 해결 필요)
2. **효율성**: 파라미터 수보다 아키텍처 설계가 중요
3. **잔차/밀집 연결**: 그라디언트 흐름이 핵심
4. **1×1 합성곱**: 파라미터 효율적인 채널 변환의 만능 도구
5. **규모 통합**: 깊이·너비·해상도를 함께 고려

다음 글에서는 이 역사에서 가장 중요한 이정표인 **ResNet의 잔차 연결**을 수학과 코드로 깊이 분석한다.

---

**지난 글:** [특징 맵: CNN이 이미지에서 보는 것](/posts/cnn-feature-maps/)

**다음 글:** [ResNet: 잔차 연결이 깊은 네트워크를 가능하게 한 이유](/posts/cnn-resnet/)

<br>
읽어주셔서 감사합니다. 😊
