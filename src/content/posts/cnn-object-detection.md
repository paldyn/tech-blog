---
title: "객체 탐지: 이미지에서 물체 찾기"
description: "CNN 기반 객체 탐지의 원리를 2-Stage(Faster R-CNN)와 1-Stage(YOLO) 관점에서 설명한다. 앵커 박스, IoU, NMS, mAP 등 핵심 개념을 수식 없이 직관적으로 이해하고 YOLOv8로 실전 구현해 본다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["CNN", "객체탐지", "YOLO", "FasterRCNN", "컴퓨터비전"]
featured: false
draft: false
---

[지난 글](/posts/cnn-image-classification/)에서 이미지 분류 파이프라인을 완성했다. 분류는 이미지 전체에 하나의 레이블을 붙이는 것이었다. **객체 탐지(Object Detection)**는 한 발 더 나아간다: 이미지에서 **여러 물체의 위치(bounding box)와 클래스**를 동시에 찾아야 한다.

## 문제 정의

객체 탐지 모델의 출력은 `[(x1,y1,x2,y2,class,confidence), ...]` 형식의 예측 박스 목록이다.

- `(x1,y1)`, `(x2,y2)`: 경계 박스의 좌상단·우하단 좌표
- `class`: 물체 클래스 (사람, 자동차, 고양이 등)
- `confidence`: 탐지 신뢰도 (0~1)

## 핵심 개념

![앵커 박스 IoU NMS](/assets/posts/cnn-object-detection-concepts.svg)

### IoU (Intersection over Union)

예측 박스와 실제 박스가 얼마나 겹치는지 측정하는 지표다.

```python
def compute_iou(box1, box2):
    """
    box: [x1, y1, x2, y2]
    """
    # 교집합 좌표
    inter_x1 = max(box1[0], box2[0])
    inter_y1 = max(box1[1], box2[1])
    inter_x2 = min(box1[2], box2[2])
    inter_y2 = min(box1[3], box2[3])

    inter_area = max(0, inter_x2 - inter_x1) * \
                 max(0, inter_y2 - inter_y1)

    area1 = (box1[2]-box1[0]) * (box1[3]-box1[1])
    area2 = (box2[2]-box2[0]) * (box2[3]-box2[1])
    union_area = area1 + area2 - inter_area

    return inter_area / (union_area + 1e-8)
```

IoU ≥ 0.5이면 탐지 성공으로 간주하는 것이 표준이다(PASCAL VOC). COCO 데이터셋은 IoU 0.5~0.95 범위에서 평균(mAP@[.5:.95])을 사용해 더 엄격하다.

### NMS (Non-Maximum Suppression)

탐지기는 같은 물체에 대해 여러 박스를 예측한다. NMS는 중복 박스를 제거하고 최선의 박스만 남긴다.

```python
def nms(boxes, scores, iou_threshold=0.5):
    """
    boxes: (N, 4) - [x1,y1,x2,y2]
    scores: (N,) - confidence score
    """
    # 신뢰도 내림차순 정렬
    order = scores.argsort(descending=True)
    keep = []

    while order.numel() > 0:
        # 가장 높은 신뢰도 박스 선택
        i = order[0].item()
        keep.append(i)
        if order.numel() == 1:
            break

        # 나머지 박스들과 IoU 계산
        remaining = order[1:]
        ious = compute_iou_batch(boxes[i], boxes[remaining])

        # IoU < 임계값인 것만 유지
        mask = ious < iou_threshold
        order = remaining[mask]

    return keep
```

## 2-Stage 탐지기: Faster R-CNN

![객체 탐지 패러다임 비교](/assets/posts/cnn-object-detection-pipeline.svg)

Faster R-CNN은 두 단계로 탐지한다.

1. **RPN (Region Proposal Network)**: 물체가 있을 법한 영역 ~2000개 제안
2. **RoI Pooling + 분류**: 제안된 각 영역을 분류 + 박스 정밀화

```python
import torchvision
from torchvision.models.detection import fasterrcnn_resnet50_fpn
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor

# 사전학습 Faster R-CNN 로드
model = fasterrcnn_resnet50_fpn(pretrained=True)

# 클래스 수 교체 (COCO 91개 → 커스텀)
in_features = model.roi_heads.box_predictor.cls_score.in_features
model.roi_heads.box_predictor = FastRCNNPredictor(
    in_features, num_classes=5  # 배경 포함
)
model = model.cuda()

# 학습 루프
model.train()
for images, targets in data_loader:
    images = [img.cuda() for img in images]
    targets = [{k: v.cuda() for k, v in t.items()} for t in targets]

    # torchvision detection 모델은 targets를 직접 받음
    loss_dict = model(images, targets)
    losses = sum(loss_dict.values())

    optimizer.zero_grad()
    losses.backward()
    optimizer.step()

# 추론
model.eval()
with torch.no_grad():
    predictions = model(images)  # [{'boxes','labels','scores'}, ...]
```

## 1-Stage 탐지기: YOLOv8

YOLO(You Only Look Once)는 이미지를 단 한 번의 순전파로 모든 박스를 예측한다.

```python
# pip install ultralytics
from ultralytics import YOLO

# 사전학습 모델 로드
model = YOLO('yolov8n.pt')  # nano (가장 빠름)

# 추론
results = model('image.jpg')
for result in results:
    boxes = result.boxes.xyxy    # (N, 4) 박스 좌표
    confs = result.boxes.conf    # (N,) 신뢰도
    cls   = result.boxes.cls     # (N,) 클래스 인덱스
    print(f"탐지된 물체: {len(boxes)}개")
    result.save('output.jpg')    # 결과 저장

# 커스텀 데이터 학습
model = YOLO('yolov8n.pt')
results = model.train(
    data='dataset.yaml',  # 데이터셋 설명 파일
    epochs=100,
    imgsz=640,
    batch=16,
    device='cuda'
)
```

YOLOv8 데이터셋 YAML 예시:

```yaml
path: /data/custom
train: images/train
val:   images/val

nc: 3
names: ['cat', 'dog', 'bird']
```

## FPN: 다중 스케일 탐지

작은 물체와 큰 물체를 동시에 잘 탐지하려면 **Feature Pyramid Network(FPN)**이 필요하다.

```python
# FPN 개념 (torchvision에 내장)
from torchvision.ops import FeaturePyramidNetwork

# ResNet의 여러 스테이지 출력을 피라미드로 합침
fpn = FeaturePyramidNetwork(
    in_channels_list=[256, 512, 1024, 2048],
    out_channels=256
)
# P2 (stride=4): 작은 물체
# P3 (stride=8): 중간 물체
# P4 (stride=16): 큰 물체
# P5 (stride=32): 매우 큰 물체
```

각 레벨의 특징 맵 크기가 달라서 다양한 크기의 물체를 각기 적합한 스케일에서 탐지한다.

## mAP 평가 지표

```python
# torchmetrics로 mAP 계산
from torchmetrics.detection import MeanAveragePrecision

metric = MeanAveragePrecision(iou_type='bbox')

preds = [{
    'boxes': torch.tensor([[100,100,200,200]], dtype=torch.float),
    'scores': torch.tensor([0.9]),
    'labels': torch.tensor([0])
}]
targets = [{
    'boxes': torch.tensor([[110,110,210,210]], dtype=torch.float),
    'labels': torch.tensor([0])
}]

metric.update(preds, targets)
result = metric.compute()
print(f"mAP@50: {result['map_50']:.3f}")
print(f"mAP@50:95: {result['map']:.3f}")
```

## 2-Stage vs 1-Stage 선택 가이드

| 상황 | 추천 |
|------|------|
| 정확도 최우선 (의료, 위성) | Faster R-CNN, DINO |
| 실시간 처리 (CCTV, 자율주행) | YOLOv8/9/10 |
| 엣지 기기 (모바일, Jetson) | YOLO-NAS, PP-YOLO |
| 빠른 프로토타입 | YOLOv8 (Ultralytics) |

객체 탐지는 이미지 분류와 달리 위치 정보를 다루므로 훨씬 복잡하다. 이 복잡성은 다음 단계—픽셀 단위로 분류하는 **시맨틱 세그멘테이션**—에서 더욱 심화된다.

---

**지난 글:** [이미지 분류: CNN 파이프라인 완전 가이드](/posts/cnn-image-classification/)

**다음 글:** [의미론적 분할: 픽셀 단위 이미지 이해](/posts/cnn-semantic-segmentation/)

<br>
읽어주셔서 감사합니다. 😊
