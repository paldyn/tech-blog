---
title: "인스턴스 분할: 물체를 개별로 구분하기"
description: "인스턴스 세그멘테이션(Instance Segmentation)의 원리를 Mask R-CNN 중심으로 설명한다. 시맨틱 세그멘테이션과의 차이, RoI Align, 마스크 헤드, Panoptic Segmentation, 그리고 SOLOv2 등 현대 아키텍처를 코드와 함께 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["CNN", "인스턴스분할", "MaskRCNN", "PanopticSegmentation", "컴퓨터비전"]
featured: false
draft: false
---

[지난 글](/posts/cnn-semantic-segmentation/)에서 모든 픽셀에 클래스 레이블을 할당하는 시맨틱 세그멘테이션을 살펴봤다. 그런데 시맨틱 세그멘테이션에는 한계가 있다: 같은 클래스의 물체 두 개(예: 고양이 두 마리)를 구분하지 못한다. **인스턴스 세그멘테이션(Instance Segmentation)**은 이 문제를 해결한다—각 물체를 개별 인스턴스로 구분해 고유한 마스크를 부여한다.

## 태스크 비교

![비전 태스크 비교](/assets/posts/cnn-instance-segmentation-comparison.svg)

인스턴스 세그멘테이션은 객체 탐지와 시맨틱 세그멘테이션의 결합이다. 각 물체에 대해 경계 박스 + 클래스 + **픽셀 단위 마스크**를 동시에 예측한다.

## Mask R-CNN

He et al. (2017)이 제안한 Mask R-CNN은 Faster R-CNN에 마스크 헤드를 추가한 구조다.

![Mask R-CNN 구조](/assets/posts/cnn-instance-segmentation-maskrcnn.svg)

핵심 혁신은 **RoI Align**이다. Faster R-CNN의 RoI Pooling은 박스 좌표를 정수로 반올림해 최대 1~2픽셀 오정렬이 발생한다. 픽셀 마스크는 이 오정렬에 매우 민감하다. RoI Align은 쌍선형 보간으로 부동소수점 좌표를 그대로 처리한다.

```python
import torchvision
from torchvision.models.detection import maskrcnn_resnet50_fpn
from torchvision.models.detection.mask_rcnn import MaskRCNNPredictor
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor

def get_maskrcnn(num_classes):
    # 사전학습 모델
    model = maskrcnn_resnet50_fpn(pretrained=True)

    # 분류 헤드 교체
    in_features = model.roi_heads.box_predictor.cls_score.in_features
    model.roi_heads.box_predictor = FastRCNNPredictor(
        in_features, num_classes
    )

    # 마스크 헤드 교체
    in_mask = model.roi_heads.mask_predictor.conv5_mask.in_channels
    model.roi_heads.mask_predictor = MaskRCNNPredictor(
        in_mask, 256, num_classes
    )
    return model

model = get_maskrcnn(num_classes=3)  # 배경 포함
model = model.cuda()
```

## 학습 루프

torchvision의 Mask R-CNN은 학습 시 `targets`에 마스크 정보를 추가로 요구한다.

```python
# 데이터셋 형식
target = {
    'boxes':  torch.tensor([[x1,y1,x2,y2]], dtype=torch.float32),
    'labels': torch.tensor([1], dtype=torch.int64),
    'masks':  torch.zeros(1, H, W, dtype=torch.uint8),  # 바이너리 마스크
    'image_id': torch.tensor([image_id]),
    'area': torch.tensor([area]),
    'iscrowd': torch.tensor([0])
}

# 학습
model.train()
optimizer = torch.optim.SGD(
    [p for p in model.parameters() if p.requires_grad],
    lr=0.005, momentum=0.9, weight_decay=0.0005
)
scheduler = torch.optim.lr_scheduler.StepLR(
    optimizer, step_size=3, gamma=0.1
)

for images, targets in train_loader:
    images  = [img.cuda() for img in images]
    targets = [{k: v.cuda() for k, v in t.items()} for t in targets]

    loss_dict = model(images, targets)
    # loss_dict: {'loss_classifier','loss_box_reg',
    #             'loss_mask','loss_objectness','loss_rpn_box_reg'}
    losses = sum(loss_dict.values())

    optimizer.zero_grad()
    losses.backward()
    optimizer.step()

scheduler.step()
```

## 추론과 마스크 시각화

```python
import numpy as np
from PIL import Image
import torchvision.transforms.functional as TF
import matplotlib.pyplot as plt
import matplotlib.patches as patches

model.eval()
with torch.no_grad():
    predictions = model([img.cuda()])

pred = predictions[0]
boxes  = pred['boxes'].cpu()    # (N, 4)
labels = pred['labels'].cpu()   # (N,)
scores = pred['scores'].cpu()   # (N,)
masks  = pred['masks'].cpu()    # (N, 1, H, W) 확률값 0~1

# 신뢰도 필터링
threshold = 0.5
keep = scores > threshold

fig, ax = plt.subplots(1, 1, figsize=(12, 8))
ax.imshow(np.array(original_image))

colors = plt.cm.tab10(np.linspace(0, 1, keep.sum()))
for i, (box, mask, score, color) in enumerate(
    zip(boxes[keep], masks[keep], scores[keep], colors)
):
    # 바이너리 마스크 (임계값 0.5)
    binary_mask = mask[0] > 0.5

    # 마스크 오버레이
    colored_mask = np.zeros((*binary_mask.shape, 4))
    colored_mask[binary_mask] = [*color[:3], 0.5]
    ax.imshow(colored_mask)

    # 박스
    x1, y1, x2, y2 = box.numpy()
    rect = patches.Rectangle(
        (x1, y1), x2-x1, y2-y1,
        linewidth=2, edgecolor=color, facecolor='none'
    )
    ax.add_patch(rect)
    ax.text(x1, y1-5, f'{score:.2f}', color=color, fontsize=10)

plt.axis('off')
plt.tight_layout()
plt.savefig('instance_seg_result.jpg')
```

## Panoptic Segmentation: 통합 분할

Panoptic Segmentation은 시맨틱 + 인스턴스 분할을 통합한다. "Things"(셀 수 있는 물체: 사람, 자동차)는 인스턴스 단위로, "Stuff"(셀 수 없는 배경: 하늘, 도로)는 시맨틱 단위로 처리한다.

```python
# panoptic quality (PQ) 지표
# PQ = SQ × RQ
# SQ (Segmentation Quality): 매칭된 인스턴스의 평균 IoU
# RQ (Recognition Quality): F1-score (Precision × Recall)

# transformers 라이브러리의 SegFormer 기반 Panoptic
from transformers import AutoImageProcessor, Mask2FormerForUniversalSegmentation

processor = AutoImageProcessor.from_pretrained(
    "facebook/mask2former-swin-large-coco-panoptic"
)
model = Mask2FormerForUniversalSegmentation.from_pretrained(
    "facebook/mask2former-swin-large-coco-panoptic"
)

inputs = processor(images=image, return_tensors="pt")
with torch.no_grad():
    outputs = model(**inputs)

result = processor.post_process_panoptic_segmentation(
    outputs, target_sizes=[image.size[::-1]]
)[0]

panoptic_map = result['segmentation']       # 픽셀별 세그먼트 ID
segments_info = result['segments_info']     # 세그먼트 정보 목록
```

## SOLOv2: 앵커 없는 인스턴스 분할

Mask R-CNN과 달리 SOLOv2는 앵커 박스 없이 직접 마스크를 예측한다. 각 그리드 셀이 자신이 담당하는 인스턴스의 마스크를 생성한다.

```python
# SOLOv2 개념 (mmdetection 기준)
# pip install mmdet

from mmdet.apis import init_detector, inference_detector

config = 'configs/solov2/solov2_r50_fpn_3x_coco.py'
checkpoint = 'solov2_r50_fpn_3x_coco_20220512_125858-a357fa23.pth'

model = init_detector(config, checkpoint, device='cuda')
result = inference_detector(model, 'image.jpg')

# result: instance_results
# - masks: (N, H, W) bool tensor
# - labels: (N,) int
# - scores: (N,) float
```

SOLOv2는 Mask R-CNN보다 **단순하고 빠르면서** 비슷한 정확도를 보인다. 실시간 처리가 필요한 경우 좋은 대안이다.

## CNN 비전 태스크 전체 요약

CNN 시리즈를 통해 우리는 다음 흐름을 따라왔다:

1. **합성곱 연산** → 공간 패턴 탐지
2. **풀링** → 정보 압축과 불변성
3. **특징 맵** → 계층적 추상화
4. **아키텍처 진화** → 더 깊고 효율적인 네트워크
5. **이미지 분류** → 전체 이미지에 레이블
6. **객체 탐지** → 위치 + 클래스
7. **시맨틱 분할** → 픽셀 단위 클래스
8. **인스턴스 분할** → 픽셀 단위 + 개별 인스턴스

다음 장에서는 CNN의 한계(순서 정보 처리 불가)에서 출발한 **RNN** 시리즈로 넘어간다.

---

**지난 글:** [의미론적 분할: 픽셀 단위 이미지 이해](/posts/cnn-semantic-segmentation/)

<br>
읽어주셔서 감사합니다. 😊
