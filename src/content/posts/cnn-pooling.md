---
title: "풀링: 공간 정보 압축과 불변성"
description: "CNN의 풀링(Pooling) 레이어가 하는 일을 최대 풀링, 평균 풀링, 글로벌 평균 풀링 관점에서 설명한다. 공간 크기 감소, 위치 불변성, 수용야 확장, 그리고 Flatten 대비 GAP의 이점을 코드와 함께 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["CNN", "풀링", "MaxPooling", "GlobalAveragePooling", "딥러닝기초"]
featured: false
draft: false
---

[지난 글](/posts/cnn-convolution-basics/)에서 합성곱 연산의 작동 방식과 파라미터 절약 효과를 살펴봤다. 합성곱이 "어떤 패턴이 어디 있는가"를 감지한다면, 오늘 다룰 **풀링(Pooling)**은 감지된 정보를 압축하고 정제하는 역할을 한다. 풀링은 CNN의 공간 계층 구조를 만들어내는 핵심 장치다.

## 풀링이 필요한 이유

합성곱 레이어를 쌓기만 하면 두 가지 문제가 생긴다. 첫째, 특징 맵의 공간 크기가 줄지 않아 연산량과 메모리가 폭발한다. 둘째, 고수준 특징(얼굴, 자동차 전체)을 포착하려면 넓은 **수용야(receptive field)**가 필요한데, 공간 크기를 줄이지 않으면 뒤 레이어가 좁은 영역만 바라본다.

풀링은 이 두 문제를 한 번에 해결한다: 공간 크기를 줄이면서(보통 절반), 각 영역의 대표값을 선택해 정보를 보존한다.

## 최대 풀링 (Max Pooling)

가장 널리 쓰이는 풀링 방법이다. 윈도우 내 **최대값**을 선택한다.

![최대 풀링 vs 평균 풀링](/assets/posts/cnn-pooling-types.svg)

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

# Max Pooling - 2×2 윈도우, stride=2
max_pool = nn.MaxPool2d(kernel_size=2, stride=2)

x = torch.tensor([[[[1., 3., 2., 4.],
                     [5., 2., 6., 1.],
                     [7., 4., 3., 8.],
                     [2., 1., 5., 2.]]]])
print(x.shape)  # [1, 1, 4, 4]

out = max_pool(x)
print(out)
# tensor([[[[5., 6.],
#           [7., 8.]]]])
print(out.shape)  # [1, 1, 2, 2]
```

최대값을 선택하는 이유는 직관적이다: "이 영역에 고양이 귀가 있는가?"라는 질문에서, 귀가 약하게 감지된 셀(1, 2)보다 강하게 감지된 셀(5)이 더 중요하다.

## 평균 풀링 (Average Pooling)

윈도우 내 **평균값**을 계산한다.

```python
avg_pool = nn.AvgPool2d(kernel_size=2, stride=2)
out = avg_pool(x)
print(out)
# tensor([[[[2.7500, 3.2500],
#           [3.5000, 4.5000]]]])
```

최대 풀링보다 부드러운 특징 표현을 만든다. 강한 활성화 하나에 과도하게 의존하지 않아, 텍스처나 배경처럼 전반적인 분포가 중요한 경우에 유리하다. 다만 현대 분류 네트워크에서는 최대 풀링이 대부분 더 좋은 성능을 보인다.

## 풀링의 위치 불변성

풀링의 중요한 특성은 **위치 불변성(Translation Invariance)**이다. 2픽셀 최대 풀링에서 특징이 1픽셀 이동해도 같은 윈도우 내에 있으면 출력이 변하지 않는다. 이는 이미지에서 물체의 정확한 위치보다 "있냐 없냐"가 중요한 분류 태스크에 매우 유용하다.

단, 위치 **동변성(Equivariance)**이 필요한 태스크—예컨대 객체 탐지에서 정확한 경계 박스—에는 오히려 단점이 된다. 이 때문에 탐지 네트워크에서는 풀링을 신중하게 사용한다.

## 글로벌 평균 풀링 (GAP)

![Global Average Pooling vs Flatten](/assets/posts/cnn-pooling-global.svg)

GAP는 각 채널의 전체 특징 맵을 단 **하나의 스칼라**로 압축한다. `(C, H, W)` → `(C,)`. 마지막 합성곱 레이어 직후, 분류기 연결 직전에 주로 사용된다.

```python
# GAP 사용 예
gap = nn.AdaptiveAvgPool2d(1)  # 출력 크기를 1×1로

feature_map = torch.randn(1, 512, 7, 7)
out = gap(feature_map)
print(out.shape)  # [1, 512, 1, 1]

# Flatten하면 512차원 벡터
out = out.flatten(1)
print(out.shape)  # [1, 512]

# Flatten 없이 직접 FC 연결 (AdaptiveAvgPool 이후)
class SimpleClassifier(nn.Module):
    def __init__(self, num_classes=1000):
        super().__init__()
        self.gap = nn.AdaptiveAvgPool2d(1)
        self.fc = nn.Linear(512, num_classes)

    def forward(self, x):
        x = self.gap(x)        # (B, 512, 1, 1)
        x = x.flatten(1)       # (B, 512)
        return self.fc(x)
```

GAP의 이점은 세 가지다.

1. **파라미터 대폭 절약**: 7×7×512=25,088 → FC(25088→4096)은 1억 파라미터. GAP 후 FC(512→1000)는 51만 파라미터.
2. **입력 크기 무관**: 훈련과 다른 해상도 이미지에도 바로 적용 가능.
3. **자연스러운 정규화**: 전체 맵 평균이라 과적합에 강하다.

GoogLeNet(2014)이 처음 도입했고, ResNet 이후 사실상 표준이 되었다.

## 수용야와 풀링의 관계

레이어가 깊어질수록 뒤 레이어의 뉴런 하나가 원본 이미지에서 바라보는 영역—**수용야(Receptive Field)**—이 커진다. 풀링은 이 확장을 가속한다.

```text
Conv3×3 → Conv3×3 (풀링 없음): 수용야 5×5
Conv3×3 → MaxPool2×2 → Conv3×3: 수용야 10×10
```

풀링 없이 깊은 수용야를 얻으려면 레이어를 훨씬 더 쌓아야 한다. 이 때문에 초기 CNN들은 2~3개 Conv 레이어마다 풀링 레이어를 두었다.

## 스트라이드 합성곱으로 풀링 대체

현대 네트워크(ResNet-v2, EfficientNet)는 풀링 대신 **스트라이드 합성곱**으로 공간 크기를 줄이는 경향이 있다.

```python
# Max Pooling 방식
nn.Sequential(
    nn.Conv2d(64, 64, 3, padding=1),
    nn.MaxPool2d(2, 2)
)

# Strided Conv 방식 (학습 파라미터로 다운샘플)
nn.Sequential(
    nn.Conv2d(64, 128, 3, stride=2, padding=1)
)
```

스트라이드 합성곱은 학습 가능한 파라미터로 다운샘플링 방식을 결정하므로 이론상 더 유연하다. 반면 일반 풀링은 파라미터가 없어 안정적이고 빠르다. 실제로는 두 방식을 혼합해 사용하는 경우가 많다.

## 풀링 없는 CNN: ViT와의 비교

Vision Transformer(ViT)는 풀링을 거의 사용하지 않는다. 대신 패치(patch)로 이미지를 분할해 공간 구조를 어텐션으로 처리한다. 이 때문에 위치 불변성을 '자동으로' 얻지 않고, 명시적인 위치 인코딩이 필요하다. 풀링의 귀납적 편향(inductive bias)이 작은 데이터셋에서는 강점이, 대규모 데이터에서는 약점이 될 수 있다는 논쟁이 이어지고 있다.

---

**지난 글:** [합성곱 연산: CNN의 핵심 원리](/posts/cnn-convolution-basics/)

**다음 글:** [특징 맵: CNN이 이미지에서 보는 것](/posts/cnn-feature-maps/)

<br>
읽어주셔서 감사합니다. 😊
