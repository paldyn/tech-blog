---
title: "3D 생성 AI: NeRF·3D Gaussian Splatting·Point-E 완전 해설"
description: "NeRF 볼륨 렌더링 원리, 3DGS 명시적 가우시안 표현, DreamFusion SDS Loss, Zero123++ 단일 이미지 3D, 실전 코드까지 3D 생성 AI를 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["NeRF", "3DGaussianSplatting", "DreamFusion", "3D생성", "볼륨렌더링", "Point-E", "3D재구성", "Zero123"]
featured: false
draft: false
---

[지난 글](/posts/cv-video-models/)에서 비디오 생성 모델의 시간 어텐션 구조를 다뤘다. 이번 글에서는 2D 이미지를 넘어 **3D 공간**을 이해하고 생성하는 기술들을 완전 해설한다. NeRF로 시작해 3D Gaussian Splatting, DreamFusion, Zero123++ 등 최신 3D 생성 AI까지 다룬다.

## 3D 표현 방식 개요

3D 장면을 컴퓨터로 표현하는 방법은 크게 세 가지다.

**명시적 표현**: 메시(Mesh), 포인트 클라우드처럼 3D 좌표를 직접 저장한다. 렌더링이 빠르지만 복잡한 장면 편집이 어렵다.

**암묵적 표현**: NeRF처럼 신경망이 공간 좌표를 입력받아 색과 밀도를 출력한다. 연속적이고 부드럽지만 렌더링이 느리다.

**혼합 표현**: 3D Gaussian Splatting처럼 명시적 가우시안 포인트가 명시적이지만 렌더링은 소팅·래스터라이저로 빠르게 처리한다.

## NeRF: 신경 복사 필드

![NeRF 볼륨 렌더링 원리](/assets/posts/cv-3d-generation-nerf.svg)

NeRF는 3D 공간의 임의 위치 `(x,y,z)`와 관측 방향 `(θ,φ)`를 MLP에 입력하면, 그 위치의 색 RGB와 밀도 σ를 출력한다. 카메라 레이를 따라 샘플링된 여러 포인트의 출력을 볼륨 렌더링으로 통합해 최종 픽셀 색을 계산한다.

```python
import torch
import torch.nn as nn
import numpy as np

class NeRF(nn.Module):
    def __init__(
        self,
        pos_enc_dim: int = 10,   # 위치 인코딩 차수
        dir_enc_dim: int = 4,    # 방향 인코딩 차수
        hidden_dim: int = 256,
    ):
        super().__init__()
        pos_in = 3 + 3 * 2 * pos_enc_dim
        dir_in = 3 + 3 * 2 * dir_enc_dim

        # 밀도 예측 네트워크 (위치만 사용)
        self.density_net = nn.Sequential(
            nn.Linear(pos_in, hidden_dim), nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim), nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim), nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim), nn.ReLU(),
        )
        self.density_out = nn.Linear(hidden_dim, 1)

        # RGB 예측 (위치 피처 + 방향)
        self.color_net = nn.Sequential(
            nn.Linear(hidden_dim + dir_in, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, 3),
            nn.Sigmoid(),
        )

        self.pos_enc_dim = pos_enc_dim
        self.dir_enc_dim = dir_enc_dim

    def positional_encoding(self, x: torch.Tensor, L: int) -> torch.Tensor:
        """사인파 위치 인코딩"""
        freqs = 2 ** torch.arange(L, device=x.device).float()
        x_freq = (x[..., None] * freqs).reshape(*x.shape[:-1], -1)
        return torch.cat([x, x_freq.sin(), x_freq.cos()], dim=-1)

    def forward(
        self,
        pos: torch.Tensor,  # (..., 3)
        dirs: torch.Tensor, # (..., 3)
    ) -> tuple[torch.Tensor, torch.Tensor]:
        pos_enc = self.positional_encoding(pos, self.pos_enc_dim)
        dir_enc = self.positional_encoding(dirs, self.dir_enc_dim)

        feat = self.density_net(pos_enc)
        sigma = torch.relu(self.density_out(feat))    # 밀도 ≥ 0

        color_in = torch.cat([feat, dir_enc], dim=-1)
        rgb = self.color_net(color_in)                # RGB ∈ [0,1]

        return rgb, sigma


def volume_render(
    rgb: torch.Tensor,      # (N_rays, N_samples, 3)
    sigma: torch.Tensor,    # (N_rays, N_samples, 1)
    t_vals: torch.Tensor,   # (N_rays, N_samples)
) -> torch.Tensor:
    """볼륨 렌더링: 레이 적분"""
    deltas = t_vals[..., 1:] - t_vals[..., :-1]
    deltas = torch.cat([
        deltas,
        torch.full_like(deltas[..., :1], 1e10)
    ], dim=-1)

    alpha = 1 - torch.exp(-sigma[..., 0] * deltas)
    # 누적 투과도
    T = torch.cumprod(
        torch.cat([
            torch.ones_like(alpha[..., :1]),
            1 - alpha + 1e-10
        ], dim=-1), dim=-1
    )[..., :-1]

    weights = T * alpha                              # (N_rays, N_samples)
    rgb_out = (weights[..., None] * rgb).sum(dim=-2) # (N_rays, 3)
    return rgb_out
```

## 3D Gaussian Splatting

3DGS는 장면을 수백만 개의 3D 가우시안 타원체로 명시적으로 표현한다. 각 가우시안은 위치·회전·스케일·불투명도·SH 색 계수를 갖는다.

```python
import torch
import torch.nn as nn

class GaussianModel(nn.Module):
    def __init__(self, num_gaussians: int = 1_000_000):
        super().__init__()
        # 각 가우시안의 학습 가능한 속성
        self.xyz = nn.Parameter(
            torch.randn(num_gaussians, 3) * 0.1
        )
        self.rotation = nn.Parameter(
            torch.zeros(num_gaussians, 4)  # 쿼터니언
        )
        self.scaling = nn.Parameter(
            torch.ones(num_gaussians, 3) * 0.01
        )
        self.opacity = nn.Parameter(
            torch.zeros(num_gaussians, 1)
        )
        self.sh_dc = nn.Parameter(
            torch.zeros(num_gaussians, 1, 3)  # 구면 조화함수 (DC)
        )

    def get_covariance(self) -> torch.Tensor:
        """회전 + 스케일 → 3D 공분산 행렬"""
        R = self._quat_to_rotmat(self.rotation)
        S = torch.diag_embed(torch.exp(self.scaling))
        return R @ S @ S.T @ R.T

    def _quat_to_rotmat(self, q: torch.Tensor) -> torch.Tensor:
        q = nn.functional.normalize(q, dim=-1)
        w, x, y, z = q.unbind(-1)
        return torch.stack([
            1-2*(y**2+z**2), 2*(x*y-w*z), 2*(x*z+w*y),
            2*(x*y+w*z), 1-2*(x**2+z**2), 2*(y*z-w*x),
            2*(x*z-w*y), 2*(y*z+w*x), 1-2*(x**2+y**2),
        ], dim=-1).reshape(*q.shape[:-1], 3, 3)
```

실제 렌더링은 CUDA 커스텀 래스터라이저(`gaussian-splatting` 라이브러리)를 사용한다. 파이썬으로는 전체 파이프라인을 재현하기 어렵다.

## 3D 생성 방법 비교

![3D 생성 AI 핵심 기술 비교](/assets/posts/cv-3d-generation-methods.svg)

## DreamFusion: 텍스트 → 3D (SDS Loss)

DreamFusion은 사전학습된 2D 확산 모델을 "점수 함수"로 활용해 NeRF를 텍스트로 최적화한다. 핵심은 **Score Distillation Sampling(SDS)** 손실이다.

```python
def sds_loss(
    nerf,
    diffusion_model,
    text_embeddings: torch.Tensor,
    camera_poses: torch.Tensor,
    guidance_scale: float = 100,
) -> torch.Tensor:
    """Score Distillation Sampling 손실"""
    # NeRF로 랜덤 시점 이미지 렌더링
    rendered = render_nerf(nerf, camera_poses)  # (B, 3, H, W)

    # [0,1] → [-1,1] 정규화
    rendered_norm = rendered * 2 - 1

    # 랜덤 타임스텝 샘플링
    t = torch.randint(50, 950, (rendered.shape[0],))

    # 노이즈 추가
    noise = torch.randn_like(rendered_norm)
    noisy = diffusion_model.scheduler.add_noise(
        rendered_norm, noise, t
    )

    # 확산 모델로 노이즈 예측
    with torch.no_grad():
        noise_pred_cond = diffusion_model.unet(
            noisy, t, encoder_hidden_states=text_embeddings
        ).sample
        noise_pred_uncond = diffusion_model.unet(
            noisy, t,
            encoder_hidden_states=text_embeddings[:1].repeat(
                rendered.shape[0], 1, 1
            )
        ).sample

    # Classifier-Free Guidance
    noise_pred = noise_pred_uncond + guidance_scale * (
        noise_pred_cond - noise_pred_uncond
    )

    # SDS 그래디언트: 예측 노이즈 - 실제 추가된 노이즈
    grad = noise_pred - noise
    # NeRF 파라미터에 역전파
    return (grad * rendered_norm).mean()
```

## Zero123++: 단일 이미지 → 멀티뷰 3D

```python
from diffusers import Zero123PlusPipeline
import torch
from PIL import Image

pipe = Zero123PlusPipeline.from_pretrained(
    "sudo-ai/zero123plus-v1.2",
    torch_dtype=torch.float16,
).to("cuda")

# 단일 입력 이미지
image = Image.open("object.png").convert("RGBA")

# 6방향 멀티뷰 이미지 생성
result = pipe(
    image,
    num_inference_steps=75,
    guidance_scale=4.0,
).images[0]

# 결과는 6개 뷰(30°, 90°, 150°, 210°, 270°, 330°)
# 이를 NeRF 또는 3DGS에 입력해 3D 재구성
```

## Instant-NGP: 빠른 NeRF 학습

```bash
# COLMAP으로 카메라 포즈 추정
colmap automatic_reconstructor \
    --workspace_path colmap_output/ \
    --image_path images/

# Instant-NGP로 학습 (수 분 내 완료)
python scripts/run.py \
    --scene images/ \
    --n_steps 5000 \
    --save_snapshot model.ingp

# 학습된 NeRF로 새 시점 렌더링
python scripts/run.py \
    --load_snapshot model.ingp \
    --video_camera_path transforms_test.json \
    --video_output output.mp4
```

## 실전 사용 가이드

**게임 에셋 빠르게 만들 때**: Meshy·Tripo3D 같은 상용 서비스로 텍스트/이미지 → 3D 메시 30초 생성.

**특정 물체를 사진으로 3D로 만들 때**: 폰 카메라 30~50장 촬영 → COLMAP 포즈 추정 → Instant-NGP 또는 3DGS로 학습.

**텍스트로 창의적 3D 만들 때**: DreamFusion·Fantasia3D (품질↑ 시간↑) 또는 Zero123++(빠름).

**실시간 뷰어 필요할 때**: 3DGS + SuperSplat 뷰어 → 브라우저에서 30fps 렌더.

다음 글에서는 CV에서 오디오 처리로 영역을 옮겨 **자동 음성 인식(ASR)**의 원리와 Whisper 실전 사용법을 다룬다.

---

**지난 글:** [비디오 생성 모델: Sora·AnimateDiff·SVD 완전 해설](/posts/cv-video-models/)

**다음 글:** [자동 음성 인식(ASR): Whisper와 스트리밍 음성 처리 완전 해설](/posts/audio-asr/)

<br>
읽어주셔서 감사합니다. 😊
