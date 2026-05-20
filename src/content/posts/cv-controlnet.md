---
title: "ControlNet: 포즈·깊이·엣지로 확산 모델을 정밀 제어하기"
description: "ControlNet의 Zero Conv 아키텍처, OpenPose·Canny·Depth 등 제어 유형, diffusers 구현 코드, 다중 조건 결합까지 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["ControlNet", "StableDiffusion", "OpenPose", "Canny", "DepthMap", "이미지제어", "생성AI", "diffusers"]
featured: false
draft: false
---

[지난 글](/posts/cv-stable-diffusion/)에서 Stable Diffusion의 전체 파이프라인과 실전 사용법을 다뤘다. 이번 글에서는 텍스트 프롬프트만으로는 통제하기 어려운 **포즈·구도·깊이·엣지** 등의 공간적 제약을 정밀하게 부여하는 **ControlNet**을 완전 해설한다. ControlNet은 2023년 발표된 이후 디자인·패션·게임 아트 등 실무 이미지 생성의 표준이 되었다.

## ControlNet의 핵심 문제 의식

Stable Diffusion은 텍스트 프롬프트로 이미지를 생성하지만, "왼쪽 팔을 들어 올린 자세"처럼 정밀한 공간 제약을 텍스트만으로 표현하기는 어렵다. ControlNet은 추가 제어 이미지(포즈 맵, 엣지 맵 등)를 조건으로 받아 SD의 생성 결과를 정밀하게 제어한다.

![ControlNet 아키텍처](/assets/posts/cv-controlnet-architecture.svg)

## Zero Conv: 학습 안정성의 비결

ControlNet의 핵심 설계 요소는 **Zero Convolution**이다. 1×1 Conv 레이어의 가중치와 바이어스를 모두 0으로 초기화해, 학습 초기에는 제어 신호가 0이 되도록 만든다. 이로 인해 학습 초반에는 SD 원본과 동일하게 동작하며, 학습이 진행될수록 ControlNet 인코더의 출력이 SD U-Net의 중간 특징에 점진적으로 더해진다. SD U-Net은 완전히 동결(freeze)되어 원본 생성 품질이 보존된다.

```python
import torch
import torch.nn as nn

class ZeroConv(nn.Module):
    """학습 초기 출력 = 0을 보장하는 1×1 합성곱"""
    def __init__(self, channels: int):
        super().__init__()
        self.conv = nn.Conv2d(channels, channels, 1, padding=0)
        # 가중치·바이어스 모두 0 초기화
        nn.init.zeros_(self.conv.weight)
        nn.init.zeros_(self.conv.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.conv(x)
```

## diffusers로 ControlNet 사용

### 1. OpenPose — 인체 포즈 제어

```python
from diffusers import StableDiffusionControlNetPipeline, ControlNetModel
from diffusers.utils import load_image
import torch

# OpenPose ControlNet 로드
controlnet = ControlNetModel.from_pretrained(
    "lllyasviel/sd-controlnet-openpose",
    torch_dtype=torch.float16,
)

pipe = StableDiffusionControlNetPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    controlnet=controlnet,
    torch_dtype=torch.float16,
).to("cuda")

# 포즈 이미지 (OpenPose로 추출된 관절 맵)
pose_image = load_image("pose_keypoints.png")

image = pipe(
    prompt=(
        "a beautiful woman in a red dress, "
        "professional photography, 8k"
    ),
    negative_prompt="ugly, blurry, bad anatomy",
    image=pose_image,
    num_inference_steps=30,
    guidance_scale=7.5,
    controlnet_conditioning_scale=1.0,  # 제어 강도
).images[0]

image.save("controlled_pose.png")
```

### 2. Canny Edge — 구도·윤곽 제어

```python
import cv2
import numpy as np
from PIL import Image
from diffusers import ControlNetModel, StableDiffusionControlNetPipeline

def extract_canny(
    image_path: str,
    low_threshold: int = 100,
    high_threshold: int = 200,
) -> Image.Image:
    """Canny 엣지 맵 추출"""
    img = cv2.imread(image_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, low_threshold, high_threshold)
    # 3채널로 변환 (ControlNet 입력 형식)
    edges_rgb = cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB)
    return Image.fromarray(edges_rgb)


controlnet = ControlNetModel.from_pretrained(
    "lllyasviel/sd-controlnet-canny",
    torch_dtype=torch.float16,
)

pipe = StableDiffusionControlNetPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    controlnet=controlnet,
    torch_dtype=torch.float16,
).to("cuda")

canny_image = extract_canny("building_sketch.png", 50, 150)

# 스케치에서 건축 렌더링으로 변환
image = pipe(
    prompt=(
        "modern architecture, glass facade, "
        "professional architectural rendering, 4k"
    ),
    image=canny_image,
    num_inference_steps=30,
    guidance_scale=7.5,
    controlnet_conditioning_scale=0.9,
).images[0]
```

### 3. Depth Map — 3D 공간감 제어

```python
from transformers import pipeline as hf_pipeline
import numpy as np

# DPT로 깊이 추정
depth_estimator = hf_pipeline(
    "depth-estimation",
    model="Intel/dpt-large"
)

def get_depth_map(image: Image.Image) -> Image.Image:
    depth_output = depth_estimator(image)["depth"]
    depth_array = np.array(depth_output)
    # 0~255 정규화
    depth_norm = (depth_array - depth_array.min()) / (
        depth_array.max() - depth_array.min() + 1e-8
    ) * 255
    return Image.fromarray(depth_norm.astype(np.uint8))


controlnet_depth = ControlNetModel.from_pretrained(
    "lllyasviel/sd-controlnet-depth",
    torch_dtype=torch.float16,
)

pipe_depth = StableDiffusionControlNetPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    controlnet=controlnet_depth,
    torch_dtype=torch.float16,
).to("cuda")

original = Image.open("living_room.jpg")
depth_map = get_depth_map(original)

# 같은 공간감으로 인테리어 재디자인
image = pipe_depth(
    prompt=(
        "luxurious japanese minimalist interior, "
        "tatami floor, shoji screens, warm lighting"
    ),
    image=depth_map,
    num_inference_steps=30,
    controlnet_conditioning_scale=0.8,
).images[0]
```

## ControlNet 유형별 비교

![ControlNet 유형별 제어 방식](/assets/posts/cv-controlnet-types.svg)

## 다중 ControlNet 결합

```python
from diffusers import StableDiffusionControlNetPipeline, ControlNetModel

# 포즈 + 깊이를 동시에 제어
controlnet_pose = ControlNetModel.from_pretrained(
    "lllyasviel/sd-controlnet-openpose",
    torch_dtype=torch.float16,
)
controlnet_depth = ControlNetModel.from_pretrained(
    "lllyasviel/sd-controlnet-depth",
    torch_dtype=torch.float16,
)

pipe_multi = StableDiffusionControlNetPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    controlnet=[controlnet_pose, controlnet_depth],
    torch_dtype=torch.float16,
).to("cuda")

image = pipe_multi(
    prompt="a person standing in a forest, photorealistic",
    image=[pose_image, depth_image],
    controlnet_conditioning_scale=[1.0, 0.6],  # 포즈 강하게, 깊이 약하게
    num_inference_steps=30,
    guidance_scale=7.5,
).images[0]
```

## 실전 conditioning_scale 조정

`controlnet_conditioning_scale`은 제어 신호의 강도를 결정한다.

| 값 | 효과 |
|----|------|
| 0.3~0.5 | 제어 신호 약함, 텍스트 프롬프트 우세 |
| 0.7~1.0 | 균형, 일반적으로 권장 |
| 1.2~2.0 | 제어 신호 강함, 창의성 감소 |

복잡한 포즈나 정밀한 구도 재현이 필요하면 1.0 이상, 스타일 참조만 원하면 0.5 이하로 설정한다.

## SDXL + ControlNet

```python
from diffusers import StableDiffusionXLControlNetPipeline, ControlNetModel

# SDXL용 ControlNet
controlnet_xl = ControlNetModel.from_pretrained(
    "diffusers/controlnet-canny-sdxl-1.0",
    torch_dtype=torch.float16,
)

pipe_xl = StableDiffusionXLControlNetPipeline.from_pretrained(
    "stabilityai/stable-diffusion-xl-base-1.0",
    controlnet=controlnet_xl,
    torch_dtype=torch.float16,
).to("cuda")

image = pipe_xl(
    prompt="a futuristic cityscape at night, neon lights",
    image=canny_image,
    controlnet_conditioning_scale=0.7,
    num_inference_steps=25,
).images[0]
```

ControlNet은 SD의 텍스트 제어 한계를 보완해 "정확히 이런 포즈로, 이런 구도로" 생성을 가능하게 한다. 다음 글에서는 생성된 이미지를 **인페인팅·아웃페인팅·스타일 전이** 등으로 편집하는 **이미지 편집 기법**들을 다룬다.

---

**지난 글:** [Stable Diffusion: 잠재 확산 모델의 구조와 실전 활용](/posts/cv-stable-diffusion/)

**다음 글:** [AI 이미지 편집: 인페인팅·아웃페인팅·스타일 전이](/posts/cv-image-editing/)

<br>
읽어주셔서 감사합니다. 😊
