---
title: "확산 모델(Diffusion Model) 기초: 노이즈에서 이미지로"
description: "DDPM의 순방향·역방향 과정, U-Net 노이즈 예측, InfoNCE 손실 수식, DDIM·DPM-Solver·LCM 스케줄러 비교를 완전 해설합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 4
type: "knowledge"
category: "AI"
tags: ["확산모델", "DDPM", "DDIM", "UNet", "노이즈스케줄러", "생성AI", "StableDiffusion", "이미지생성"]
featured: false
draft: false
---

[지난 글](/posts/cv-clip/)에서 이미지와 텍스트를 공동 임베딩 공간에 정렬하는 CLIP을 다뤘다. 이번 글에서는 그 CLIP을 컨디셔닝으로 활용해 텍스트로 이미지를 생성하는 **확산 모델(Diffusion Model)**의 수학적 원리와 구현을 완전 해설한다. Stable Diffusion, DALL-E 3, Imagen 모두 이 원리 위에 세워졌다.

## 확산 모델의 직관

확산 모델의 아이디어는 간단하다. "이미지를 조금씩 가우시안 노이즈로 오염시키는 과정(순방향)을 학습하면, 그 역과정(역방향)을 신경망으로 배울 수 있다." 순방향은 손쉽게 수식으로 정의할 수 있고, 역방향은 U-Net이 각 타임스텝 t에서 추가된 노이즈를 예측하도록 학습된다.

![확산 모델 순방향·역방향 과정](/assets/posts/cv-diffusion-basics-forward.svg)

## 순방향 과정: 노이즈 추가

타임스텝 t에서 x_{t-1}에 Gaussian 노이즈를 더하는 과정은 아래와 같이 정의된다.

```
q(x_t | x_{t-1}) = N(x_t; √(1-β_t)·x_{t-1}, β_t·I)
```

β_t는 t가 커질수록 점점 큰 노이즈를 추가하는 노이즈 스케줄이다. 핵심 트릭은 **임의의 타임스텝 t에서 x_t를 한 번에 계산**할 수 있다는 점이다.

```python
import torch

def q_sample(
    x0: torch.Tensor,
    t: torch.Tensor,
    sqrt_alphas_cumprod: torch.Tensor,
    sqrt_one_minus_alphas_cumprod: torch.Tensor,
) -> tuple[torch.Tensor, torch.Tensor]:
    """x0와 타임스텝 t로 x_t를 직접 샘플링"""
    noise = torch.randn_like(x0)

    # ᾱ_t = ∏(1 - β_s) for s=1..t
    sqrt_at = sqrt_alphas_cumprod[t][:, None, None, None]
    sqrt_1mat = sqrt_one_minus_alphas_cumprod[t][:, None, None, None]

    # x_t = √ᾱ_t · x₀ + √(1-ᾱ_t) · ε
    xt = sqrt_at * x0 + sqrt_1mat * noise
    return xt, noise  # x_t와 실제 노이즈 반환


def cosine_schedule(T: int) -> dict:
    """OpenAI 코사인 노이즈 스케줄 (DDPM 선형보다 성능 우수)"""
    steps = T + 1
    t = torch.linspace(0, T, steps) / T
    alphas_cumprod = torch.cos((t + 0.008) / 1.008 * torch.pi / 2) ** 2
    alphas_cumprod = alphas_cumprod / alphas_cumprod[0]
    betas = 1 - alphas_cumprod[1:] / alphas_cumprod[:-1]
    betas = betas.clamp(0, 0.999)

    alphas = 1 - betas
    ac = torch.cumprod(alphas, dim=0)
    return {
        'betas': betas,
        'alphas_cumprod': ac,
        'sqrt_alphas_cumprod': ac.sqrt(),
        'sqrt_one_minus_alphas_cumprod': (1 - ac).sqrt(),
    }
```

## 역방향 과정: 노이즈 예측

역방향 과정의 목표는 x_t에서 추가된 노이즈 ε를 예측하는 신경망 ε_θ를 학습하는 것이다. 손실 함수는 단순한 MSE다.

```python
def p_losses(
    model,           # U-Net ε_θ
    x0: torch.Tensor,
    t: torch.Tensor,
    schedule: dict,
) -> torch.Tensor:
    """DDPM 훈련 손실"""
    xt, noise = q_sample(
        x0, t,
        schedule['sqrt_alphas_cumprod'],
        schedule['sqrt_one_minus_alphas_cumprod']
    )
    # 모델이 예측한 노이즈
    pred_noise = model(xt, t)

    # 단순 MSE: 예측 노이즈 vs 실제 노이즈
    return torch.nn.functional.mse_loss(pred_noise, noise)


def train_step(model, optimizer, batch, schedule, device):
    model.train()
    x0 = batch.to(device)
    B = x0.shape[0]
    T = len(schedule['betas'])

    # 랜덤 타임스텝 샘플링
    t = torch.randint(0, T, (B,), device=device)

    optimizer.zero_grad()
    loss = p_losses(model, x0, t, schedule)
    loss.backward()
    optimizer.step()
    return loss.item()
```

## U-Net: 노이즈 예측 아키텍처

확산 모델의 핵심 신경망은 **U-Net**이다. 인코더(다운샘플링)와 디코더(업샘플링)를 스킵 연결로 연결한 구조로, 다양한 해상도의 특징을 동시에 활용한다. 타임스텝 t는 사인파 위치 인코딩으로 임베딩되어 각 ResNet 블록에 주입된다.

```python
import torch.nn as nn

class TimeEmbedding(nn.Module):
    def __init__(self, dim: int):
        super().__init__()
        self.proj = nn.Sequential(
            nn.Linear(dim, dim * 4),
            nn.SiLU(),
            nn.Linear(dim * 4, dim * 4),
        )

    def forward(self, t: torch.Tensor) -> torch.Tensor:
        # 사인파 위치 인코딩
        half = self.proj[0].in_features // 2
        freqs = torch.exp(
            -torch.log(torch.tensor(10000.0)) *
            torch.arange(half, device=t.device) / half
        )
        emb = t[:, None].float() * freqs[None]
        emb = torch.cat([emb.sin(), emb.cos()], dim=-1)
        return self.proj(emb)
```

## DDPM 샘플링

학습된 모델로 이미지를 생성할 때는 순수 가우시안 노이즈 x_T에서 시작해 역방향 과정을 T번 반복한다.

```python
@torch.no_grad()
def p_sample_loop(
    model,
    shape: tuple,
    schedule: dict,
    device: torch.device,
) -> torch.Tensor:
    """DDPM 샘플링: x_T → x_0"""
    T = len(schedule['betas'])
    x = torch.randn(shape, device=device)

    for t_idx in reversed(range(T)):
        t = torch.full((shape[0],), t_idx, device=device)
        beta_t = schedule['betas'][t_idx]
        alpha_t = 1 - beta_t
        ac_t = schedule['alphas_cumprod'][t_idx]

        # 노이즈 예측
        pred_noise = model(x, t)

        # x_{t-1} 계산
        coef1 = 1 / alpha_t.sqrt()
        coef2 = beta_t / (1 - ac_t).sqrt()
        mean = coef1 * (x - coef2 * pred_noise)

        if t_idx > 0:
            noise = torch.randn_like(x)
            x = mean + beta_t.sqrt() * noise
        else:
            x = mean

    return x.clamp(-1, 1)
```

## 노이즈 스케줄러 비교

![노이즈 스케줄러 비교](/assets/posts/cv-diffusion-basics-schedulers.svg)

실제 Stable Diffusion 사용 시 `diffusers` 라이브러리의 스케줄러를 교체하는 것만으로 품질과 속도를 조절할 수 있다.

```python
from diffusers import (
    StableDiffusionPipeline,
    DDIMScheduler,
    DPMSolverMultistepScheduler,
)

pipe = StableDiffusionPipeline.from_pretrained(
    "runwayml/stable-diffusion-v1-5",
    torch_dtype=torch.float16,
).to("cuda")

# 기본 DDIM (50 steps)
pipe.scheduler = DDIMScheduler.from_config(
    pipe.scheduler.config
)

# DPM-Solver++ (20 steps, 비슷한 품질)
pipe.scheduler = DPMSolverMultistepScheduler.from_config(
    pipe.scheduler.config,
    algorithm_type="dpmsolver++",
)

image = pipe(
    "a photo of an astronaut riding a horse on mars",
    num_inference_steps=20,
    guidance_scale=7.5,
).images[0]
```

## Classifier-Free Guidance

텍스트 컨디셔닝 확산 모델에서는 **Classifier-Free Guidance(CFG)**가 품질을 크게 높인다. 조건부 예측과 무조건부 예측을 섞어 텍스트 프롬프트 방향으로 더 강하게 이동시킨다.

```
ε̃_θ(x_t, c) = ε_θ(x_t, ∅) + w·(ε_θ(x_t, c) - ε_θ(x_t, ∅))
```

w(guidance_scale)가 클수록 텍스트 정합도가 높아지지만, 다양성이 줄고 과포화(oversaturation) 현상이 생긴다. 일반적으로 7~12 사이를 사용한다.

다음 글에서는 확산 모델을 잠재 공간(Latent Space)으로 가져간 **Stable Diffusion**의 전체 파이프라인과 실전 사용법을 다룬다.

---

**지난 글:** [CLIP: 이미지와 텍스트를 같은 공간에 정렬하는 대조 학습](/posts/cv-clip/)

**다음 글:** [Stable Diffusion: 잠재 확산 모델의 구조와 실전 활용](/posts/cv-stable-diffusion/)

<br>
읽어주셔서 감사합니다. 😊
