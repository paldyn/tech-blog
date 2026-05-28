---
title: "PyTorch 기초: 텐서와 자동미분"
description: "PyTorch의 핵심 개념인 텐서 연산, requires_grad와 자동미분(autograd), nn.Module 구조를 실제 코드로 설명합니다. 딥러닝 모델 구현의 출발점을 단단히 다집니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["PyTorch", "텐서", "autograd", "자동미분", "nn.Module", "딥러닝기초"]
featured: false
draft: false
---

[지난 글](/posts/python-for-ai/)에서 AI 개발에 필요한 Python 라이브러리 생태계를 살펴봤다. 이번에는 딥러닝 연구와 실전 개발의 표준이 된 **PyTorch**의 핵심 개념을 다룬다. 텐서 생성과 조작, 자동미분, 그리고 `nn.Module`로 모델을 정의하는 방식까지 코드 중심으로 이해한다.

## 왜 PyTorch인가

PyTorch는 2017년 Facebook AI Research(FAIR)에서 공개됐다. TensorFlow의 정적 계산 그래프(define-and-run) 방식과 달리 **동적 계산 그래프(define-by-run)**를 채택해 파이썬 제어 흐름(`if`, `for`)을 그대로 쓸 수 있다. 이 덕분에 디버깅이 쉽고, 가변 길이 시퀀스 처리가 자연스럽다. 현재 머신러닝 논문의 70% 이상이 PyTorch를 사용한다.

## 텐서: 모든 것의 기본 단위

![PyTorch 텐서 — 구조와 자동미분](/assets/posts/pytorch-basics-tensor.svg)

PyTorch의 기본 데이터 타입은 `torch.Tensor`다. NumPy `ndarray`와 유사하지만 GPU 연산과 자동미분을 지원한다.

```python
import torch

# 생성
x = torch.tensor([[1.0, 2.0], [3.0, 4.0]])   # 직접 지정
z = torch.zeros(3, 4)                          # 영행렬
r = torch.randn(2, 3)                          # 표준정규분포
e = torch.ones_like(x)                         # x와 같은 shape, 전부 1

# 속성
print(x.shape)   # torch.Size([2, 2])
print(x.dtype)   # torch.float32
print(x.device)  # cpu

# GPU로 이동
if torch.cuda.is_available():
    x = x.to("cuda")   # 또는 x.cuda()
```

텐서 연산은 대부분 NumPy와 유사하다. 차이는 `@`(행렬 곱), `.T`(전치), `unsqueeze`/`squeeze`(차원 추가/제거) 등이다.

```python
a = torch.randn(3, 4)
b = torch.randn(4, 5)

c = a @ b             # 행렬 곱 (3, 5)
d = a.T               # 전치 (4, 3)
e = a.unsqueeze(0)    # (1, 3, 4) — 배치 차원 추가
f = e.squeeze(0)      # (3, 4) — 차원 제거

# reshape vs view
g = a.reshape(2, 6)   # 비연속 텐서 OK
h = a.view(2, 6)      # 연속 메모리만 OK (빠름)
```

## autograd: 자동미분의 원리

신경망 학습의 핵심은 **역전파**다. PyTorch는 계산 그래프를 동적으로 구성하고, `backward()`를 호출하면 체인 룰로 모든 파라미터의 그래디언트를 자동으로 계산한다.

```python
import torch

x = torch.tensor([2.0], requires_grad=True)
y = x ** 2 + 3 * x   # y = x² + 3x

y.backward()          # dy/dx = 2x + 3 = 7
print(x.grad)         # tensor([7.])

# 그래디언트 초기화 (루프마다 필수!)
x.grad.zero_()

# 그래디언트 계산 비활성화 (추론 시 메모리 절약)
with torch.no_grad():
    pred = model(inputs)
```

`requires_grad=True`로 설정된 텐서는 이후 모든 연산이 계산 그래프에 기록된다. 학습 루프에서 `optimizer.zero_grad()`를 매번 호출하는 것이 이 때문이다 — 누적된 그래디언트를 초기화하지 않으면 이전 배치의 그래디언트가 더해진다.

## nn.Module: 모델 정의의 표준

`torch.nn.Module`은 모든 PyTorch 모델의 기본 클래스다. `__init__`에서 레이어를 정의하고, `forward`에서 데이터 흐름을 작성한다.

![nn.Module — PyTorch 모델 기본 구조](/assets/posts/pytorch-basics-nn-module.svg)

```python
import torch
import torch.nn as nn

class MLP(nn.Module):
    def __init__(self, input_dim, hidden_dim, output_dim):
        super().__init__()
        self.layers = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden_dim, output_dim),
        )

    def forward(self, x):
        return self.layers(x)

model = MLP(784, 256, 10)

# 파라미터 수 확인
total = sum(p.numel() for p in model.parameters())
print(f"파라미터 수: {total:,}")  # 204,810

# 저장 / 로드
torch.save(model.state_dict(), "model.pt")
model.load_state_dict(torch.load("model.pt"))
```

`nn.Sequential`은 레이어를 순서대로 연결해 `forward`를 자동으로 구성해준다. 커스텀 스킵 커넥션이나 분기가 필요한 경우에만 `forward`를 직접 작성한다.

## 주요 내장 레이어

| 레이어 | 용도 |
|--------|------|
| `nn.Linear(in, out)` | 완전 연결층 (Wx + b) |
| `nn.Conv2d(in, out, k)` | 2D 합성곱 |
| `nn.BatchNorm1d/2d` | 배치 정규화 |
| `nn.Dropout(p)` | 드롭아웃 |
| `nn.Embedding(V, d)` | 정수 → 벡터 변환 |
| `nn.LSTM(in, h)` | LSTM 셀 |
| `nn.MultiheadAttention` | 멀티헤드 어텐션 |

손실 함수와 옵티마이저는 별도 모듈이다.

```python
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
```

다음 포스트에서는 이 요소들을 조합한 **전체 학습 루프**를 다룬다. `DataLoader` 구성, 에폭 반복, 검증 단계, 체크포인트 저장까지 실전 패턴을 모두 다룰 예정이다.

---

**지난 글:** [AI 개발을 위한 Python 핵심 라이브러리](/posts/python-for-ai/)

**다음 글:** [PyTorch 학습 루프 완전 정복](/posts/pytorch-training-loop/)

<br>
읽어주셔서 감사합니다. 😊
