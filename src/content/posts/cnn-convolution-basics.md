---
title: "합성곱 연산: CNN의 핵심 원리"
description: "합성곱 신경망(CNN)의 핵심인 합성곱 연산을 수식과 예제로 상세히 설명한다. 커널, 스트라이드, 패딩의 역할과 파라미터 수 계산법, 가중치 공유가 주는 이점을 코드와 함께 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["CNN", "합성곱", "Convolution", "커널", "딥러닝기초"]
featured: false
draft: false
---

[지난 글](/posts/nn-vanishing-gradient/)에서 기울기 소실·폭발 문제와 현대적 해결책을 살펴봤다. 이번 글부터는 이미지를 위한 합성곱 신경망(Convolutional Neural Network, CNN) 시리즈를 시작한다. CNN은 2012년 AlexNet이 ImageNet 대회에서 압도적인 성능을 보이며 딥러닝 붐을 이끈 핵심 아키텍처다. 오늘은 CNN의 가장 기본 단위인 **합성곱 연산(Convolution Operation)**을 깊이 이해해 보자.

## 왜 완전연결층으로는 이미지를 처리하기 어려운가

224×224 크기의 RGB 이미지는 224 × 224 × 3 = **150,528개**의 입력값을 가진다. 이를 첫 번째 완전연결(FC) 레이어의 뉴런 1,024개에 연결하면 파라미터만 **1억 5천만 개** 이상이 된다. 이는 과적합을 유발하고 학습이 느려진다. 또한 FC 레이어는 픽셀의 **공간적 관계**를 전혀 활용하지 않는다—고양이 귀가 어느 위치에 있든 상관없이 새로운 패턴으로 처리한다.

합성곱은 이 두 문제를 동시에 해결한다.

## 합성곱 연산의 작동 방식

합성곱의 핵심 아이디어는 **작은 필터(커널)**를 이미지 위에서 슬라이딩하며 각 위치에서 내적(dot product)을 계산하는 것이다.

![합성곱 연산 원리](/assets/posts/cnn-convolution-basics-operation.svg)

수식으로 표현하면:

$$(\mathbf{I} * \mathbf{K})[i,j] = \sum_{m}\sum_{n} \mathbf{I}[i+m, j+n] \cdot \mathbf{K}[m, n]$$

여기서 `I`는 입력, `K`는 커널이다. 커널을 입력 위에서 픽셀 단위로 슬라이딩하면서 덧셈을 누적하는 과정이 합성곱이다.

## 핵심 하이퍼파라미터

### 스트라이드 (Stride)

커널이 이동하는 간격이다. `stride=1`이면 1픽셀씩, `stride=2`면 2픽셀씩 이동한다. 스트라이드가 클수록 출력 특징 맵의 공간 크기가 줄어들고 연산량도 감소한다.

### 패딩 (Padding)

입력 외곽에 값(보통 0)을 추가하는 것이다.

- **Valid padding (패딩 없음)**: 출력 크기 < 입력 크기. 경계 정보 손실.
- **Same padding**: 출력 크기 = 입력 크기. 모든 위치를 동등하게 처리.

### 출력 크기 공식

$$H_{out} = \left\lfloor\frac{H_{in} - K + 2P}{S}\right\rfloor + 1$$

5×5 입력에 3×3 커널, 패딩 0, 스트라이드 1이면: ⌊(5-3+0)/1⌋+1 = **3×3** 출력.

## 가중치 공유와 파라미터 절약

![스트라이드 패딩 파라미터](/assets/posts/cnn-convolution-basics-params.svg)

하나의 커널은 이미지의 **모든 위치**에서 동일한 가중치를 공유한다. 이것이 "가중치 공유(Weight Sharing)"다. 덕분에:

1. **파라미터 수 대폭 감소**: FC 레이어 대비 100배 이상 절약
2. **위치 동변성(Translation Equivariance)**: 고양이 귀가 어디에 있어도 같은 필터가 탐지

Conv2d 레이어의 파라미터 수는 다음으로 계산한다:

```text
파라미터 수 = K × K × C_in × C_out + C_out (bias)
```

예: `Conv2d(3, 64, 3, padding=1)` → 3×3×3×64 + 64 = **1,792개**

## PyTorch 구현

```python
import torch
import torch.nn as nn

# 기본 합성곱 레이어
conv = nn.Conv2d(
    in_channels=3,    # 입력 채널 (RGB)
    out_channels=64,  # 출력 채널 (필터 수)
    kernel_size=3,    # 3x3 커널
    stride=1,
    padding=1         # same padding
)

# 파라미터 수 확인
total = sum(p.numel() for p in conv.parameters())
print(f"파라미터 수: {total:,}")  # 1,792

# 수동 합성곱 (numpy로 원리 이해)
import numpy as np

def conv2d_manual(inp, kernel, stride=1, pad=0):
    H, W = inp.shape
    K = kernel.shape[0]
    if pad > 0:
        inp = np.pad(inp, pad, mode='constant')
    out_h = (H + 2*pad - K) // stride + 1
    out_w = (W + 2*pad - K) // stride + 1
    out = np.zeros((out_h, out_w))
    for i in range(out_h):
        for j in range(out_w):
            patch = inp[i*stride:i*stride+K, j*stride:j*stride+K]
            out[i, j] = np.sum(patch * kernel)
    return out

# 수직 엣지 감지 커널
sobel_v = np.array([[-1, 0, 1],
                    [-1, 0, 1],
                    [-1, 0, 1]], dtype=float)

img = np.array([[1,2,3,0,1],
                [0,1,2,1,0],
                [2,1,0,2,1],
                [1,0,1,0,2],
                [0,2,1,0,1]], dtype=float)

result = conv2d_manual(img, sobel_v)
print(result)
# [[-3. -1. -2.]
#  [-1.  0. -1.]
#  [ 1. -1. -2.]]
```

## 여러 필터 → 여러 채널

실제 Conv 레이어는 단 하나의 커널이 아니라 `C_out`개의 커널을 동시에 사용한다. 각 커널은 서로 다른 패턴(엣지, 질감, 색상 등)을 탐지하도록 학습된다. 그 결과 출력은 `(C_out, H_out, W_out)` 형태의 3D 텐서, 즉 **특징 맵(Feature Map)**이 된다.

```python
# 입력: (batch=1, C_in=3, H=32, W=32)
x = torch.randn(1, 3, 32, 32)
conv = nn.Conv2d(3, 64, kernel_size=3, padding=1)
out = conv(x)
print(out.shape)  # torch.Size([1, 64, 32, 32])
# 64개의 특징 맵, 공간 크기 유지
```

## 합성곱의 역전파

역전파 시 커널 가중치의 기울기는 **입력과 출력 기울기의 합성곱**으로 계산된다. PyTorch의 autograd가 자동으로 처리하지만, 내부적으로는:

- `dL/dW = X * δ` (입력과 출력 기울기의 상관 연산)
- `dL/dX = W^{flip} * δ` (커널을 180도 회전한 뒤 합성곱)

이를 통해 모든 위치에서 공유된 가중치의 기울기가 **누적**되어 업데이트된다.

## 핵심 직관

합성곱 레이어를 이해하는 가장 직관적인 방법: **레이어가 "어떤 패턴이 여기 있는가?"를 학습**한다. Sobel 커널이 수직 엣지를 탐지하듯, 학습된 커널들은 그라디언트, 곡선, 질감 등 계층적으로 복잡해지는 패턴을 자동으로 학습한다. 이 계층적 특징 추출이 다음 글에서 다룰 **풀링**과 결합되어 CNN의 강력함을 만들어낸다.

---

**지난 글:** [기울기 소실과 폭발: 깊은 네트워크의 고질적 문제](/posts/nn-vanishing-gradient/)

**다음 글:** [풀링: 공간 정보 압축과 불변성](/posts/cnn-pooling/)

<br>
읽어주셔서 감사합니다. 😊
