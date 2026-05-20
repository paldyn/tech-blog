---
title: "딥러닝 이미지 분류 완전 정복: 백본·전이학습·실전 코드"
description: "ResNet, EfficientNet, ViT, ConvNeXt 등 주요 백본 비교, Feature Extraction vs Fine-Tuning 전이학습 전략, 그리고 PyTorch 실전 분류 코드를 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["이미지분류", "딥러닝", "CNN", "전이학습", "ResNet", "EfficientNet", "ViT", "PyTorch"]
featured: false
draft: false
---

[지난 글](/posts/agent-anti-patterns/)에서 AI 에이전트 개발의 안티패턴을 살펴봤다. 이번 글부터는 컴퓨터 비전(CV) 영역으로 넘어가, 딥러닝 이미지 분류의 전 과정을 완전 해설한다. 이미지 분류는 CV의 출발점이자, 객체 탐지·세그멘테이션·생성 모델 모두의 기반이 되는 핵심 태스크다.

## 딥러닝 이미지 분류 파이프라인

![딥러닝 이미지 분류 파이프라인](/assets/posts/cv-image-classification-deep-pipeline.svg)

이미지 분류 파이프라인은 크게 **전처리 → 특징 추출 → 분류**의 세 단계로 구성된다. 전통 머신러닝과의 결정적 차이는 특징 추출이 자동화된다는 점이다. CNN 또는 Vision Transformer가 픽셀로부터 계층적 특징을 스스로 학습한다.

## 데이터 전처리와 증강

모델 성능의 50%는 데이터 품질과 증강에서 나온다. PyTorch의 `transforms`를 사용한 표준 파이프라인은 다음과 같다.

```python
from torchvision import transforms

train_transforms = transforms.Compose([
    transforms.RandomResizedCrop(224),
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.ColorJitter(
        brightness=0.4, contrast=0.4,
        saturation=0.4, hue=0.1
    ),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]   # ImageNet 통계
    ),
])

val_transforms = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    ),
])
```

훈련 중에는 랜덤 크롭·플립·색상 지터 등 증강을 적용하고, 검증·테스트 시에는 결정적(deterministic) 전처리만 사용한다. `Normalize`의 mean/std는 ImageNet 사전학습 모델을 쓸 경우 반드시 ImageNet 통계를 맞춰야 한다.

## 주요 백본 아키텍처

### ResNet — 잔차 연결의 혁명

2015년 등장한 ResNet은 **잔차 연결(skip connection)**으로 그래디언트 소실을 해결해 100층 이상의 깊은 네트워크를 가능하게 했다. 오늘날에도 전이학습 베이스라인으로 가장 많이 쓰인다.

```python
import torchvision.models as models

# ImageNet 사전학습 ResNet-50
backbone = models.resnet50(weights='IMAGENET1K_V2')

# 마지막 FC 레이어를 태스크에 맞게 교체
num_classes = 10
backbone.fc = torch.nn.Linear(
    backbone.fc.in_features, num_classes
)
```

### EfficientNet — 복합 스케일링

EfficientNet은 **너비(width)·깊이(depth)·해상도(resolution)**를 동시에 스케일링하는 복합 스케일링 기법을 도입했다. B0~B7까지 버전이 있으며, 파라미터 효율이 뛰어나 엣지 디바이스에 적합하다.

### ViT — 패치 기반 어텐션

Vision Transformer(ViT)는 이미지를 16×16 패치로 분할해 Transformer에 입력한다. 충분한 데이터가 있으면 CNN을 능가하는 성능을 보이며, CLIP 등 멀티모달 모델의 비전 인코더로 널리 사용된다.

### ConvNeXt — CNN의 현대화

2022년 등장한 ConvNeXt는 ViT의 설계 철학(큰 커널, Layer Norm, GELU)을 순수 CNN에 도입해 CNN과 ViT의 성능 격차를 좁혔다. CNN의 귀납적 편향(inductive bias)을 유지하면서 SOTA급 성능을 달성한다.

## 전이학습 전략

![전이학습 전략 비교](/assets/posts/cv-image-classification-deep-transfer.svg)

### Feature Extraction

백본의 모든 가중치를 동결(freeze)하고 마지막 분류기만 새로 학습한다. 데이터가 적을 때(수백~수천 장) 과적합을 방지하는 가장 안전한 방법이다.

```python
import torch
import torch.nn as nn
import torchvision.models as models

def build_feature_extractor(num_classes: int):
    model = models.resnet50(weights='IMAGENET1K_V2')

    # 모든 파라미터 동결
    for param in model.parameters():
        param.requires_grad = False

    # 분류기만 교체 (학습 대상)
    model.fc = nn.Linear(model.fc.in_features, num_classes)

    return model

model = build_feature_extractor(num_classes=5)

# 학습 가능한 파라미터만 옵티마이저에 전달
optimizer = torch.optim.Adam(
    filter(lambda p: p.requires_grad, model.parameters()),
    lr=1e-3
)
```

### Fine-Tuning

백본의 후기 레이어(고수준 특징 담당)도 함께 재학습한다. 학습률을 레이어별로 다르게 설정하는 **차등 학습률(Discriminative Learning Rate)**이 핵심이다.

```python
def build_finetune_model(num_classes: int):
    model = models.resnet50(weights='IMAGENET1K_V2')

    # layer1, layer2는 동결 (저수준 특징)
    for name, param in model.named_parameters():
        if 'layer1' in name or 'layer2' in name:
            param.requires_grad = False

    model.fc = nn.Linear(model.fc.in_features, num_classes)
    return model

model = build_finetune_model(num_classes=5)

# 차등 학습률: 후기 레이어 1e-4, 분류기 1e-3
optimizer = torch.optim.Adam([
    {'params': model.layer3.parameters(), 'lr': 1e-4},
    {'params': model.layer4.parameters(), 'lr': 1e-4},
    {'params': model.fc.parameters(),     'lr': 1e-3},
])
```

## 전체 훈련 루프

```python
def train_epoch(model, loader, optimizer, criterion, device):
    model.train()
    running_loss, correct, total = 0.0, 0, 0

    for images, labels in loader:
        images, labels = images.to(device), labels.to(device)

        optimizer.zero_grad()
        outputs = model(images)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()

        running_loss += loss.item() * images.size(0)
        _, preds = outputs.max(1)
        correct += preds.eq(labels).sum().item()
        total += labels.size(0)

    return running_loss / total, correct / total


def evaluate(model, loader, criterion, device):
    model.eval()
    running_loss, correct, total = 0.0, 0, 0

    with torch.no_grad():
        for images, labels in loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            loss = criterion(outputs, labels)

            running_loss += loss.item() * images.size(0)
            _, preds = outputs.max(1)
            correct += preds.eq(labels).sum().item()
            total += labels.size(0)

    return running_loss / total, correct / total
```

## 학습률 스케줄링과 조기 종료

```python
from torch.optim.lr_scheduler import CosineAnnealingLR

scheduler = CosineAnnealingLR(optimizer, T_max=30, eta_min=1e-6)

best_val_acc, patience, counter = 0.0, 5, 0

for epoch in range(50):
    train_loss, train_acc = train_epoch(
        model, train_loader, optimizer, criterion, device
    )
    val_loss, val_acc = evaluate(
        model, val_loader, criterion, device
    )
    scheduler.step()

    if val_acc > best_val_acc:
        best_val_acc = val_acc
        torch.save(model.state_dict(), 'best_model.pth')
        counter = 0
    else:
        counter += 1
        if counter >= patience:
            print(f"Early stopping at epoch {epoch}")
            break
```

## 실전 팁

**데이터가 적을 때 (< 1,000장)**: Feature Extraction + 강력한 증강(Mixup, CutMix) 조합을 사용한다.

**도메인 차이가 클 때 (의료·위성)**: Fine-Tuning을 적용하되, 학습률을 매우 작게(1e-5) 시작한다.

**추론 속도가 중요할 때**: EfficientNet-B0 또는 MobileNetV3를 선택하고, TorchScript 또는 ONNX로 내보낸다.

**라벨 노이즈가 의심될 때**: Label Smoothing(`nn.CrossEntropyLoss(label_smoothing=0.1)`)을 적용한다.

이미지 분류는 단순해 보이지만, 백본 선택·전이학습 전략·증강 조합이 최종 성능을 크게 좌우한다. 다음 글에서는 CNN을 대체하는 **Vision Transformer**의 구조와 동작 원리를 깊이 파고든다.

---

**다음 글:** [Vision Transformer(ViT): 이미지를 문장처럼 처리하는 Transformer](/posts/cv-vision-transformer/)

<br>
읽어주셔서 감사합니다. 😊
