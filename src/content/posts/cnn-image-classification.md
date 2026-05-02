---
title: "이미지 분류: CNN 파이프라인 완전 가이드"
description: "CNN 기반 이미지 분류의 전체 파이프라인을 처음부터 끝까지 구현한다. 데이터 증강(Mixup, CutMix, RandAugment), 현대적 학습 레시피, 전이학습 전략, 그리고 실전 팁을 PyTorch 코드와 함께 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["CNN", "이미지분류", "전이학습", "데이터증강", "PyTorch"]
featured: false
draft: false
---

[지난 글](/posts/cnn-modern/)에서 MobileNet, EfficientNet, ConvNeXt 등 현대 CNN 아키텍처를 살펴봤다. 좋은 아키텍처만큼이나 중요한 것이 **학습 방법**이다. 같은 ResNet-50도 학습 레시피에 따라 Top-1 정확도가 76%에서 83%까지 달라진다. 오늘은 이미지 분류 파이프라인 전체를 처음부터 끝까지 구현해 보자.

## 데이터셋 준비

```python
import torch
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

# 학습용 변환 (증강 포함)
train_transform = transforms.Compose([
    transforms.RandomResizedCrop(224, scale=(0.08, 1.0)),
    transforms.RandomHorizontalFlip(),
    transforms.ColorJitter(
        brightness=0.4, contrast=0.4,
        saturation=0.4, hue=0.1
    ),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

# 검증/테스트용 변환 (증강 없음)
val_transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

train_dataset = datasets.ImageFolder('data/train', train_transform)
val_dataset   = datasets.ImageFolder('data/val',   val_transform)

train_loader = DataLoader(
    train_dataset, batch_size=256,
    shuffle=True, num_workers=8,
    pin_memory=True, prefetch_factor=2
)
val_loader = DataLoader(
    val_dataset, batch_size=512,
    shuffle=False, num_workers=4
)
```

## 현대적 데이터 증강

![현대적 데이터 증강 기법](/assets/posts/cnn-image-classification-augmentation.svg)

단순 랜덤 크롭과 수평 반전만으로는 현대 모델의 성능을 끌어내기 어렵다. Mixup과 CutMix는 정보를 섞어 모델이 과적합하기 어렵게 만든다.

```python
import numpy as np

def mixup_data(x, y, alpha=0.2):
    """배치 내 두 샘플을 선형 조합"""
    if alpha > 0:
        lam = np.random.beta(alpha, alpha)
    else:
        lam = 1.0
    batch_size = x.size(0)
    idx = torch.randperm(batch_size)
    mixed_x = lam * x + (1 - lam) * x[idx]
    y_a, y_b = y, y[idx]
    return mixed_x, y_a, y_b, lam

def mixup_criterion(criterion, pred, y_a, y_b, lam):
    return lam * criterion(pred, y_a) + (1 - lam) * criterion(pred, y_b)


def cutmix_data(x, y, alpha=1.0):
    """배치 내 사각형 영역 교체"""
    lam = np.random.beta(alpha, alpha)
    batch_size, _, H, W = x.shape
    idx = torch.randperm(batch_size)

    cut_ratio = np.sqrt(1.0 - lam)
    cut_h = int(H * cut_ratio)
    cut_w = int(W * cut_ratio)
    cx = np.random.randint(W)
    cy = np.random.randint(H)
    x1 = max(cx - cut_w // 2, 0)
    y1 = max(cy - cut_h // 2, 0)
    x2 = min(cx + cut_w // 2, W)
    y2 = min(cy + cut_h // 2, H)

    mixed_x = x.clone()
    mixed_x[:, :, y1:y2, x1:x2] = x[idx, :, y1:y2, x1:x2]
    lam = 1 - (x2 - x1) * (y2 - y1) / (H * W)
    return mixed_x, y, y[idx], lam
```

## 학습 루프 완전판

![이미지 분류 전체 파이프라인](/assets/posts/cnn-image-classification-pipeline.svg)

```python
import torchvision.models as models
import torch.nn as nn
from torch.cuda.amp import GradScaler, autocast

# 모델: 사전학습 ResNet50 + 분류기 교체
model = models.resnet50(pretrained=True)
model.fc = nn.Linear(2048, num_classes)
model = model.cuda()

# 옵티마이저: AdamW + Weight Decay
optimizer = torch.optim.AdamW(
    model.parameters(),
    lr=1e-3, weight_decay=0.05
)

# LR 스케줄: Cosine Annealing with Warmup
from torch.optim.lr_scheduler import OneCycleLR
scheduler = OneCycleLR(
    optimizer, max_lr=1e-3,
    epochs=100, steps_per_epoch=len(train_loader),
    pct_start=0.05  # 5% warmup
)

# Label Smoothing 포함 CrossEntropy
criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
scaler = GradScaler()  # Mixed Precision

# EMA (Exponential Moving Average)
from torch.optim.swa_utils import AveragedModel
ema_model = AveragedModel(model, multi_avg_fn=None)

def train_epoch(model, loader, optimizer, criterion, scaler):
    model.train()
    total_loss = correct = 0
    for imgs, labels in loader:
        imgs, labels = imgs.cuda(), labels.cuda()

        # Mixup 또는 CutMix 적용 (50% 확률)
        if torch.rand(1) > 0.5:
            imgs, y_a, y_b, lam = mixup_data(imgs, labels)
            use_mixup = True
        else:
            use_mixup = False

        with autocast():
            logits = model(imgs)
            if use_mixup:
                loss = mixup_criterion(criterion, logits, y_a, y_b, lam)
            else:
                loss = criterion(logits, labels)

        optimizer.zero_grad()
        scaler.scale(loss).backward()
        scaler.unscale_(optimizer)
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        scaler.step(optimizer)
        scaler.update()
        scheduler.step()

        total_loss += loss.item()
        correct += (logits.argmax(1) == labels).sum().item()

    return total_loss / len(loader), correct / len(loader.dataset)
```

## 평가 및 Top-k 정확도

```python
@torch.no_grad()
def evaluate(model, loader, top_k=(1, 5)):
    model.eval()
    correct = {k: 0 for k in top_k}
    total = 0

    for imgs, labels in loader:
        imgs, labels = imgs.cuda(), labels.cuda()
        logits = model(imgs)

        _, pred = logits.topk(max(top_k), dim=1, largest=True)
        pred = pred.t()  # (max_k, B)
        correct_mat = pred.eq(labels.view(1, -1).expand_as(pred))

        for k in top_k:
            correct[k] += correct_mat[:k].any(0).sum().item()
        total += labels.size(0)

    return {k: correct[k] / total for k in top_k}

# 사용 예
accs = evaluate(model, val_loader)
print(f"Top-1: {accs[1]*100:.2f}%, Top-5: {accs[5]*100:.2f}%")
```

## 커스텀 데이터셋 전이학습

자체 데이터에 사전학습 모델을 적용하는 실전 레시피다.

```python
# timm 라이브러리 활용 (pip install timm)
import timm

model = timm.create_model(
    'efficientnet_b0',
    pretrained=True,
    num_classes=5  # 자체 클래스 수
)

# Discriminative Learning Rate: 앞 레이어는 낮은 lr
def get_param_groups(model, base_lr, decay_factor=0.1):
    layers = list(model.children())
    groups = []
    for i, layer in enumerate(layers):
        lr = base_lr * (decay_factor ** (len(layers) - 1 - i))
        groups.append({'params': layer.parameters(), 'lr': lr})
    return groups

# 앞 레이어: base_lr * 0.01, 뒤 레이어: base_lr
optimizer = torch.optim.AdamW(
    get_param_groups(model, base_lr=1e-3),
    weight_decay=0.05
)
```

## 클래스 불균형 처리

실제 데이터는 클래스가 불균형한 경우가 많다.

```python
from collections import Counter
import torch

# 클래스별 샘플 수로 가중치 계산
class_counts = Counter(train_dataset.targets)
total = sum(class_counts.values())
class_weights = torch.tensor(
    [total / class_counts[i] for i in range(num_classes)],
    dtype=torch.float
).cuda()

# 가중치를 Loss에 적용
criterion = nn.CrossEntropyLoss(weight=class_weights)

# 또는 WeightedRandomSampler로 균형 배치
from torch.utils.data import WeightedRandomSampler

sample_weights = [class_weights[t].item() for t in train_dataset.targets]
sampler = WeightedRandomSampler(
    sample_weights, num_samples=len(sample_weights)
)
train_loader = DataLoader(train_dataset, batch_size=256, sampler=sampler)
```

이미지 분류는 가장 잘 연구된 CV 태스크다. 새로운 도메인 문제에 접근할 때 항상 사전학습 모델 + 전이학습으로 시작하는 것이 현명하다. 다음 글에서는 이미지에서 단순히 클래스를 넘어 **물체의 위치까지 찾는** 객체 탐지로 넘어간다.

---

**지난 글:** [현대 CNN: MobileNet, EfficientNet, ConvNeXt](/posts/cnn-modern/)

**다음 글:** [객체 탐지: 이미지에서 물체 찾기](/posts/cnn-object-detection/)

<br>
읽어주셔서 감사합니다. 😊
