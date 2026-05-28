---
title: "PyTorch 학습 루프 완전 정복"
description: "Dataset·DataLoader 구성, 전체 학습 루프(forward→loss→backward→step), 검증 단계, 조기 종료, LR 스케줄러, 체크포인트 저장까지 PyTorch 실전 학습 파이프라인을 완성합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 3
type: "knowledge"
category: "AI"
tags: ["PyTorch", "학습루프", "DataLoader", "Dataset", "체크포인트", "LR스케줄러", "조기종료"]
featured: false
draft: false
---

[지난 글](/posts/pytorch-basics/)에서 텐서, 자동미분, `nn.Module`의 기본 개념을 다뤘다. 이번에는 이 요소들을 엮어서 **완전한 학습 파이프라인**을 완성한다. 실전 프로젝트에서 그대로 가져다 쓸 수 있는 패턴을 중심으로 설명한다.

## Dataset과 DataLoader

PyTorch에서 데이터를 다루는 표준 방식은 `Dataset` → `DataLoader` 구조다.

![Dataset · DataLoader 구조](/assets/posts/pytorch-training-loop-dataset.svg)

`Dataset`은 두 메서드만 구현하면 된다 — `__len__`(데이터 크기)과 `__getitem__`(인덱스로 샘플 반환). `DataLoader`는 이를 배치로 묶고, 셔플하며, 멀티프로세스 프리페칭을 처리한다.

```python
import torch
from torch.utils.data import Dataset, DataLoader

class TextDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, max_len=128):
        self.encodings = tokenizer(
            texts, truncation=True, padding=True,
            max_length=max_len, return_tensors="pt"
        )
        self.labels = torch.tensor(labels)

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        return {k: v[idx] for k, v in self.encodings.items()}, self.labels[idx]

# DataLoader 생성
train_loader = DataLoader(train_ds, batch_size=32, shuffle=True,  num_workers=4)
val_loader   = DataLoader(val_ds,   batch_size=64, shuffle=False, num_workers=4)
```

`num_workers=4`는 CPU 4개로 데이터를 병렬 프리페치한다. GPU가 데이터 로딩을 기다리지 않게 해서 전체 학습 속도를 높인다.

## 학습 루프: 핵심 5단계

![PyTorch 학습 루프 전체 흐름](/assets/posts/pytorch-training-loop-flow.svg)

매 배치마다 반드시 이 순서를 따른다.

```python
import torch
import torch.nn as nn

model     = MyModel().to(device)
criterion = nn.CrossEntropyLoss()
optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4, weight_decay=1e-2)

def train_one_epoch(model, loader, criterion, optimizer, device):
    model.train()
    total_loss = 0.0

    for x, y in loader:
        x, y = x.to(device), y.to(device)

        optimizer.zero_grad()        # ① 그래디언트 초기화
        pred = model(x)              # ② forward
        loss = criterion(pred, y)    # ③ loss 계산
        loss.backward()              # ④ backward
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)  # 그래디언트 클리핑
        optimizer.step()             # ⑤ 파라미터 업데이트

        total_loss += loss.item()

    return total_loss / len(loader)
```

`optimizer.zero_grad()`를 루프 **시작**에 호출하는 것이 중요하다. 끝에 호출하면 첫 배치가 쓰레기 그래디언트를 가지게 된다. 그래디언트 클리핑(`clip_grad_norm_`)은 RNN이나 트랜스포머처럼 그래디언트 폭발이 쉬운 모델에 필수다.

## 검증 단계

검증 시에는 반드시 `model.eval()`과 `torch.no_grad()`를 함께 사용한다.

```python
def evaluate(model, loader, criterion, device):
    model.eval()
    total_loss, correct, total = 0.0, 0, 0

    with torch.no_grad():
        for x, y in loader:
            x, y = x.to(device), y.to(device)
            pred  = model(x)
            loss  = criterion(pred, y)
            total_loss += loss.item()
            correct    += (pred.argmax(1) == y).sum().item()
            total      += y.size(0)

    return total_loss / len(loader), correct / total
```

`model.eval()`은 BatchNorm의 이동 통계와 Dropout을 추론 모드로 전환한다. `torch.no_grad()`는 계산 그래프 구성을 생략해 메모리와 속도를 아낀다.

## 전체 학습 루프: 조기 종료 + 체크포인트

```python
best_val_loss = float("inf")
patience, no_improve = 5, 0

for epoch in range(1, num_epochs + 1):
    train_loss = train_one_epoch(model, train_loader, criterion, optimizer, device)
    val_loss, val_acc = evaluate(model, val_loader, criterion, device)
    scheduler.step(val_loss)   # ReduceLROnPlateau

    print(f"[{epoch:03d}] train={train_loss:.4f} val={val_loss:.4f} acc={val_acc:.4f}")

    if val_loss < best_val_loss:
        best_val_loss = val_loss
        no_improve    = 0
        torch.save({"epoch": epoch, "model": model.state_dict(),
                    "optim": optimizer.state_dict()}, "best_model.pt")
    else:
        no_improve += 1
        if no_improve >= patience:
            print("조기 종료")
            break
```

`torch.save`에 `optimizer.state_dict()`를 함께 저장하면 학습을 중단했다 재개할 때 옵티마이저 모멘텀 상태까지 복원된다.

## LR 스케줄러

```python
from torch.optim.lr_scheduler import CosineAnnealingLR, ReduceLROnPlateau

# 코사인 스케줄 (주로 이미지 모델)
scheduler = CosineAnnealingLR(optimizer, T_max=num_epochs, eta_min=1e-6)

# 검증 손실 정체 시 감소 (언어 모델에 적합)
scheduler = ReduceLROnPlateau(optimizer, mode="min", factor=0.5, patience=3)
```

`CosineAnnealingLR`은 매 에폭마다 `scheduler.step()`을 호출하고, `ReduceLROnPlateau`는 `scheduler.step(val_loss)`처럼 지표를 인자로 넘긴다.

다음 포스트에서는 PyTorch와 함께 고레벨 API를 제공하는 **TensorFlow/Keras**를 살펴본다.

---

**지난 글:** [PyTorch 기초: 텐서와 자동미분](/posts/pytorch-basics/)

**다음 글:** [TensorFlow/Keras로 시작하는 딥러닝](/posts/tensorflow-keras/)

<br>
읽어주셔서 감사합니다. 😊
