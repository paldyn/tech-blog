---
title: "ResNet: 잔차 연결이 깊은 네트워크를 가능하게 한 이유"
description: "ResNet의 잔차 연결(Residual Connection)이 기울기 소실을 어떻게 해결하는지 수학적으로 분석한다. Basic Block과 Bottleneck Block의 차이, Pre-activation ResNet, WideResNet 변형까지 PyTorch 코드와 함께 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 5
type: "knowledge"
category: "AI"
tags: ["ResNet", "잔차연결", "SkipConnection", "딥러닝기초", "CNN"]
featured: false
draft: false
---

[지난 글](/posts/cnn-architectures-history/)에서 1998년부터 2019년까지 CNN 아키텍처의 역사적 흐름을 살펴봤다. 그 역사에서 가장 중요한 단일 혁신을 꼽으라면 단연 **ResNet의 잔차 연결**이다. 2015년 ILSVRC에서 발표된 이후 Transformer를 포함한 거의 모든 현대 딥러닝 아키텍처에 잔차 연결 개념이 흡수되었다. 왜 이렇게 강력한 아이디어인지 수학부터 코드까지 파헤쳐 보자.

## 문제: 왜 더 깊으면 성능이 떨어지는가

직관적으로 레이어가 많을수록 표현력이 커져야 한다. 56층 네트워크가 20층에 비해 더 나빠야 할 이유가 없다—최악의 경우 20층 이후 레이어들이 항등 함수를 학습하면 되지 않는가.

하지만 현실에서는 그렇지 않다. 56층은 20층보다 훈련 오류조차 더 높았다. 이는 과적합이 아닌 **최적화 실패**다. 더 깊은 네트워크를 최적화하기가 더 어렵고, 특히 기울기 소실이 심해진다.

He et al.의 핵심 통찰: "항등 함수를 배우게 만들자. 처음부터."

## 잔차 연결의 수학

기존 레이어가 학습하는 것: `H(x)` (원하는 출력)

잔차 연결 후 학습하는 것: `F(x) = H(x) - x` (잔차)

따라서 전체 출력은:

$$H(x) = F(x) + x$$

항등 함수가 필요한 경우 `F(x) → 0`으로 수렴하기만 하면 된다. 이는 `H(x) → x`를 직접 학습하는 것보다 훨씬 쉽다—가중치를 0에 가깝게 유지하면 된다.

![ResNet 잔차 블록 구조](/assets/posts/cnn-resnet-block.svg)

역전파 시 기울기:

$$\frac{\partial L}{\partial x} = \frac{\partial L}{\partial H} \cdot \left(\frac{\partial F}{\partial x} + 1\right)$$

`+1` 항이 핵심이다. `∂F/∂x`가 아무리 작아도 기울기는 최소 `∂L/∂H` 만큼 전달된다.

![잔차 연결과 기울기 흐름](/assets/posts/cnn-resnet-gradient.svg)

## Basic Block vs Bottleneck Block

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class BasicBlock(nn.Module):
    """ResNet-18/34용 기본 블록"""
    expansion = 1

    def __init__(self, in_ch, out_ch, stride=1):
        super().__init__()
        self.conv1 = nn.Conv2d(in_ch, out_ch, 3,
                               stride=stride, padding=1, bias=False)
        self.bn1 = nn.BatchNorm2d(out_ch)
        self.conv2 = nn.Conv2d(out_ch, out_ch, 3,
                               padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(out_ch)

        # 차원 불일치 시 1×1 프로젝션
        self.shortcut = nn.Sequential()
        if stride != 1 or in_ch != out_ch:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_ch, out_ch, 1, stride=stride, bias=False),
                nn.BatchNorm2d(out_ch)
            )

    def forward(self, x):
        out = F.relu(self.bn1(self.conv1(x)))
        out = self.bn2(self.conv2(out))
        out += self.shortcut(x)   # 잔차 연결
        return F.relu(out)


class Bottleneck(nn.Module):
    """ResNet-50/101/152용 병목 블록"""
    expansion = 4  # 출력 채널 = 기본 채널 × 4

    def __init__(self, in_ch, base_ch, stride=1):
        super().__init__()
        # 1×1: 압축
        self.conv1 = nn.Conv2d(in_ch, base_ch, 1, bias=False)
        self.bn1 = nn.BatchNorm2d(base_ch)
        # 3×3: 특징 추출
        self.conv2 = nn.Conv2d(base_ch, base_ch, 3,
                               stride=stride, padding=1, bias=False)
        self.bn2 = nn.BatchNorm2d(base_ch)
        # 1×1: 확장
        self.conv3 = nn.Conv2d(base_ch, base_ch * 4, 1, bias=False)
        self.bn3 = nn.BatchNorm2d(base_ch * 4)

        self.shortcut = nn.Sequential()
        if stride != 1 or in_ch != base_ch * 4:
            self.shortcut = nn.Sequential(
                nn.Conv2d(in_ch, base_ch * 4, 1,
                          stride=stride, bias=False),
                nn.BatchNorm2d(base_ch * 4)
            )

    def forward(self, x):
        out = F.relu(self.bn1(self.conv1(x)))
        out = F.relu(self.bn2(self.conv2(out)))
        out = self.bn3(self.conv3(out))
        out += self.shortcut(x)
        return F.relu(out)
```

Bottleneck 블록은 1×1 합성곱으로 채널을 먼저 줄인다(256→64), 3×3 합성곱을 수행한다(64→64), 다시 1×1로 채널을 복원한다(64→256). Basic Block과 비슷한 파라미터 수로 3배 더 깊이 쌓을 수 있다.

## ResNet 전체 구조

```python
class ResNet(nn.Module):
    def __init__(self, block, layers, num_classes=1000):
        super().__init__()
        self.in_ch = 64

        # Stem: 초기 특징 추출
        self.stem = nn.Sequential(
            nn.Conv2d(3, 64, 7, stride=2, padding=3, bias=False),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d(3, stride=2, padding=1)
        )

        # 4개 스테이지
        self.stage1 = self._make_stage(block, 64,  layers[0], stride=1)
        self.stage2 = self._make_stage(block, 128, layers[1], stride=2)
        self.stage3 = self._make_stage(block, 256, layers[2], stride=2)
        self.stage4 = self._make_stage(block, 512, layers[3], stride=2)

        self.gap = nn.AdaptiveAvgPool2d(1)
        self.fc = nn.Linear(512 * block.expansion, num_classes)

    def _make_stage(self, block, base_ch, num_blocks, stride):
        layers = [block(self.in_ch, base_ch, stride)]
        self.in_ch = base_ch * block.expansion
        for _ in range(1, num_blocks):
            layers.append(block(self.in_ch, base_ch))
        return nn.Sequential(*layers)

    def forward(self, x):
        x = self.stem(x)
        x = self.stage1(x); x = self.stage2(x)
        x = self.stage3(x); x = self.stage4(x)
        return self.fc(self.gap(x).flatten(1))

# ResNet 변형 생성
def resnet50():
    return ResNet(Bottleneck, [3, 4, 6, 3])

def resnet101():
    return ResNet(Bottleneck, [3, 4, 23, 3])

def resnet152():
    return ResNet(Bottleneck, [3, 8, 36, 3])
```

## Pre-activation ResNet (ResNetV2)

He et al.은 2016년 후속 논문에서 BN과 ReLU의 순서를 바꾼 Pre-activation ResNet을 제안했다.

```python
class PreActBlock(nn.Module):
    """BN-ReLU-Conv 순서 (Pre-activation)"""
    def __init__(self, channels):
        super().__init__()
        self.bn1   = nn.BatchNorm2d(channels)
        self.conv1 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)
        self.bn2   = nn.BatchNorm2d(channels)
        self.conv2 = nn.Conv2d(channels, channels, 3, padding=1, bias=False)

    def forward(self, x):
        out = self.conv1(F.relu(self.bn1(x)))
        out = self.conv2(F.relu(self.bn2(out)))
        return out + x  # BN이 잔차 경로에 없어 기울기 더 깔끔하게 흐름
```

Pre-activation은 특히 매우 깊은 네트워크(1000층 이상)에서 더 나은 학습 안정성을 보인다.

## WideResNet: 깊이보다 너비

Zagoruyko와 Komodakis는 깊이 대신 **너비(채널 수)**를 늘리는 것이 더 효율적일 수 있음을 보였다.

```python
# WideResNet: 채널을 k배 넓힘
def wide_resnet(width_factor=10):
    # 예: base 64채널 → 640채널
    return ResNet(BasicBlock, [4, 4, 4, 4],
                  # in_ch를 width_factor배로 조정
                  )
```

WideResNet-28-10(28층, 너비 10배)은 ResNet-1000보다 높은 정확도를 훨씬 적은 레이어로 달성했다. 현대 연구는 깊이와 너비 모두를 함께 고려해야 함을 시사한다.

## ResNet의 유산

잔차 연결은 ResNet에서 멈추지 않았다. Transformer의 각 서브레이어 후 `x + Sublayer(x)`, LSTM의 셀 상태 업데이트, DenseNet의 밀집 연결, U-Net의 스킵 연결—모두 같은 기본 아이디어의 변주다. "충분한 깊이를 가질 때 기울기가 직접 흐를 수 있는 경로를 만들어라"는 원칙은 현대 딥러닝의 핵심 설계 원리가 되었다.

---

**지난 글:** [CNN 아키텍처 역사: LeNet에서 EfficientNet까지](/posts/cnn-architectures-history/)

**다음 글:** [현대 CNN: MobileNet, EfficientNet, ConvNeXt](/posts/cnn-modern/)

<br>
읽어주셔서 감사합니다. 😊
