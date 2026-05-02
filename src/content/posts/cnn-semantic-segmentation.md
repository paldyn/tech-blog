---
title: "의미론적 분할: 픽셀 단위 이미지 이해"
description: "시맨틱 세그멘테이션(Semantic Segmentation)의 원리를 FCN, U-Net, DeepLabV3+, SegFormer 관점에서 설명한다. 픽셀 단위 분류, 업샘플링, 스킵 연결, Atrous 합성곱, mIoU 지표를 코드와 함께 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["CNN", "세그멘테이션", "UNet", "DeepLab", "컴퓨터비전"]
featured: false
draft: false
---

[지난 글](/posts/cnn-object-detection/)에서 이미지에서 물체의 위치를 경계 박스로 찾는 객체 탐지를 살펴봤다. **시맨틱 세그멘테이션(Semantic Segmentation)**은 한 발 더 나아가 이미지의 **모든 픽셀**에 클래스 레이블을 할당한다. "이 픽셀은 도로, 저 픽셀은 사람, 이 픽셀은 하늘"처럼 픽셀 단위로 장면을 이해하는 것이다.

## 문제 정의

입력: `(3, H, W)` RGB 이미지
출력: `(num_classes, H, W)` 또는 `(H, W)` 각 픽셀의 클래스 인덱스

분류와 달리 출력이 이미지와 같은 크기여야 한다. 이를 **밀집 예측(Dense Prediction)**이라 한다.

## FCN: 첫 End-to-End 시맨틱 세그멘테이션

2015년 Long et al.이 제안한 FCN(Fully Convolutional Network)은 분류 네트워크의 FC 레이어를 합성곱으로 대체해 임의 크기 이미지에 적용 가능하게 만들었다.

```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class FCN32s(nn.Module):
    """VGG16 기반 FCN-32s"""
    def __init__(self, num_classes=21):
        super().__init__()
        import torchvision.models as models
        vgg = models.vgg16(pretrained=True)

        # VGG 특징 추출기 (풀링 5회 → 1/32 크기)
        self.features = vgg.features

        # FC를 Conv로 대체
        self.fc6 = nn.Conv2d(512, 4096, 7, padding=3)
        self.fc7 = nn.Conv2d(4096, 4096, 1)
        self.score = nn.Conv2d(4096, num_classes, 1)

    def forward(self, x):
        h, w = x.shape[2:]
        x = self.features(x)           # (B, 512, H/32, W/32)
        x = F.relu(self.fc6(x))
        x = F.relu(self.fc7(x))
        x = self.score(x)              # (B, C, H/32, W/32)
        # 원본 크기로 업샘플링
        x = F.interpolate(x, (h, w), mode='bilinear',
                          align_corners=False)
        return x                        # (B, C, H, W)
```

문제: 32× 업샘플링은 너무 거칠다. 경계가 흐릿하게 복원된다.

## U-Net: 스킵 연결로 세밀한 경계 복원

![U-Net 인코더-디코더 구조](/assets/posts/cnn-semantic-segmentation-unet.svg)

U-Net은 인코더에서 저장한 고해상도 특징을 디코더에 직접 전달(스킵 연결)한다. 인코더가 "무엇"을 담당하고, 스킵 연결이 "어디"에 있는지를 보존한다.

```python
class DoubleConv(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch), nn.ReLU(),
            nn.Conv2d(out_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch), nn.ReLU()
        )

    def forward(self, x):
        return self.net(x)


class UNet(nn.Module):
    def __init__(self, in_ch=3, num_classes=2, base=64):
        super().__init__()
        # 인코더
        self.enc1 = DoubleConv(in_ch, base)
        self.enc2 = DoubleConv(base, base*2)
        self.enc3 = DoubleConv(base*2, base*4)
        self.enc4 = DoubleConv(base*4, base*8)
        self.pool = nn.MaxPool2d(2)
        # 병목
        self.bottleneck = DoubleConv(base*8, base*16)
        # 디코더
        self.up4 = nn.ConvTranspose2d(base*16, base*8, 2, 2)
        self.dec4 = DoubleConv(base*16, base*8)   # concat 후 2× 채널
        self.up3 = nn.ConvTranspose2d(base*8, base*4, 2, 2)
        self.dec3 = DoubleConv(base*8, base*4)
        self.up2 = nn.ConvTranspose2d(base*4, base*2, 2, 2)
        self.dec2 = DoubleConv(base*4, base*2)
        self.up1 = nn.ConvTranspose2d(base*2, base, 2, 2)
        self.dec1 = DoubleConv(base*2, base)
        # 출력
        self.out_conv = nn.Conv2d(base, num_classes, 1)

    def forward(self, x):
        # 인코딩
        e1 = self.enc1(x)
        e2 = self.enc2(self.pool(e1))
        e3 = self.enc3(self.pool(e2))
        e4 = self.enc4(self.pool(e3))
        b  = self.bottleneck(self.pool(e4))
        # 디코딩 (스킵 연결 concat)
        d4 = self.dec4(torch.cat([self.up4(b), e4], dim=1))
        d3 = self.dec3(torch.cat([self.up3(d4), e3], dim=1))
        d2 = self.dec2(torch.cat([self.up2(d3), e2], dim=1))
        d1 = self.dec1(torch.cat([self.up1(d2), e1], dim=1))
        return self.out_conv(d1)
```

## DeepLab: Atrous 합성곱으로 수용야 확장

DeepLab 시리즈는 **Atrous(구멍 있는) 합성곱**으로 해상도를 줄이지 않고 수용야를 넓힌다.

```python
# Atrous Convolution (rate=2이면 픽셀 간격 2칸)
atrous_conv = nn.Conv2d(256, 256, kernel_size=3,
                        padding=2, dilation=2)  # 수용야 5×5 효과

class ASPP(nn.Module):
    """Atrous Spatial Pyramid Pooling"""
    def __init__(self, in_ch, out_ch=256):
        super().__init__()
        self.conv1 = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 1, bias=False),
            nn.BatchNorm2d(out_ch), nn.ReLU()
        )
        # 다양한 rate로 다중 스케일 컨텍스트
        self.atrous6  = self._make_atrous(in_ch, out_ch, 6)
        self.atrous12 = self._make_atrous(in_ch, out_ch, 12)
        self.atrous18 = self._make_atrous(in_ch, out_ch, 18)
        # Global Average Pooling
        self.gap = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Conv2d(in_ch, out_ch, 1, bias=False),
            nn.BatchNorm2d(out_ch), nn.ReLU()
        )
        self.proj = nn.Sequential(
            nn.Conv2d(out_ch * 5, out_ch, 1, bias=False),
            nn.BatchNorm2d(out_ch), nn.ReLU()
        )

    def _make_atrous(self, in_ch, out_ch, rate):
        return nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=rate,
                      dilation=rate, bias=False),
            nn.BatchNorm2d(out_ch), nn.ReLU()
        )

    def forward(self, x):
        h, w = x.shape[2:]
        gap = F.interpolate(self.gap(x), (h, w),
                            mode='bilinear', align_corners=False)
        out = torch.cat([self.conv1(x), self.atrous6(x),
                         self.atrous12(x), self.atrous18(x), gap], 1)
        return self.proj(out)
```

## 세그멘테이션 손실 함수

```python
# 기본: CrossEntropy (픽셀당 분류 손실)
criterion = nn.CrossEntropyLoss(ignore_index=255)

# Dice Loss: 의료영상 클래스 불균형에 효과적
def dice_loss(pred, target, smooth=1.0):
    pred = pred.softmax(dim=1)
    num_classes = pred.shape[1]
    loss = 0
    for c in range(num_classes):
        p = pred[:, c]
        t = (target == c).float()
        intersection = (p * t).sum()
        loss += 1 - (2*intersection + smooth) / (p.sum() + t.sum() + smooth)
    return loss / num_classes

# 결합 손실 (CE + Dice)
def seg_loss(pred, target):
    return 0.5 * criterion(pred, target) + 0.5 * dice_loss(pred, target)
```

## mIoU 계산

![세그멘테이션 아키텍처 비교](/assets/posts/cnn-semantic-segmentation-comparison.svg)

```python
def compute_miou(preds, targets, num_classes):
    ious = []
    pred_flat = preds.flatten()
    tgt_flat  = targets.flatten()

    for c in range(num_classes):
        pred_c = (pred_flat == c)
        tgt_c  = (tgt_flat  == c)
        intersection = (pred_c & tgt_c).sum().item()
        union        = (pred_c | tgt_c).sum().item()
        if union > 0:
            ious.append(intersection / union)

    return sum(ious) / len(ious) if ious else 0.0
```

## 실전: torchvision 사전학습 세그멘테이션

```python
import torchvision.models.segmentation as seg_models

# DeepLabV3+ with ResNet-101 backbone
model = seg_models.deeplabv3_resnet101(pretrained=True)
model.eval()

# 추론
with torch.no_grad():
    output = model(img_tensor)['out']  # (B, 21, H, W)
    pred = output.argmax(1)            # (B, H, W) 픽셀별 클래스

# 커스텀 클래스 수로 교체
model.classifier[4] = nn.Conv2d(256, num_classes, 1)
model.aux_classifier[4] = nn.Conv2d(256, num_classes, 1)
```

시맨틱 세그멘테이션은 자율주행(도로·차선·보행자 구분), 의료 영상(종양 경계 추출), 위성 영상 분석 등 픽셀 단위 이해가 필요한 곳이면 어디서나 핵심 기술이다. 다음 글에서는 세그멘테이션에서 한 단계 더 나아가 같은 클래스의 물체도 개별로 구분하는 **인스턴스 세그멘테이션**을 다룬다.

---

**지난 글:** [객체 탐지: 이미지에서 물체 찾기](/posts/cnn-object-detection/)

**다음 글:** [인스턴스 분할: 물체를 개별로 구분하기](/posts/cnn-instance-segmentation/)

<br>
읽어주셔서 감사합니다. 😊
