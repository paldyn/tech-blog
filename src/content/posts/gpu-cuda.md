---
title: "GPU와 CUDA: 딥러닝 연산의 심장을 이해하다"
description: "CPU와 GPU의 구조적 차이, CUDA 프로그래밍 모델, PyTorch에서의 GPU 활용, 메모리 계층 구조를 딥러닝 관점에서 완전 정복한다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["GPU", "CUDA", "딥러닝", "PyTorch", "병렬컴퓨팅", "NVIDIA"]
featured: false
draft: false
---

[지난 글](/posts/notebook-jupyter/)에서 Jupyter Notebook과 JupyterLab의 구조, 매직 커맨드, ML 실전 워크플로우를 살펴봤다. 이번에는 그 노트북 안에서 실제로 훈련이 얼마나 빨리 돌아가느냐를 결정하는 핵심 하드웨어인 **GPU와 CUDA**를 파고든다. "GPU를 쓰면 빠르다"는 사실은 누구나 알지만, 왜 빠른지, 어떤 원리로 병렬 연산을 수행하는지, PyTorch가 CUDA와 어떻게 대화하는지를 이해하면 OOM 에러 해결부터 연산 최적화까지 훨씬 깊은 수준에서 대응할 수 있다.

## CPU vs GPU: 근본적인 설계 철학의 차이

CPU와 GPU는 목표 자체가 다르다. CPU는 **지연시간(Latency)** 최소화에 최적화되어 있다. 복잡한 분기 예측, 비순서 실행(OOO Execution), 거대한 캐시 계층이 그 증거다. 한 번의 복잡한 연산을 최대한 빨리 끝내야 하는 OS 스케줄링, 웹 서버, 데이터베이스 쿼리 처리에 이상적이다.

GPU는 반대로 **처리량(Throughput)** 최적화를 추구한다. 단순한 연산을 동시에 수천 개 처리하는 구조다.

![CPU vs GPU 아키텍처 비교](/assets/posts/gpu-cuda-architecture.svg)

딥러닝의 핵심 연산인 **행렬 곱셈(GEMM)**은 독립적인 곱셈-덧셈 연산의 집합이다. 1000×1000 행렬 두 개를 곱하면 10억 번의 독립 연산이 발생한다. CPU의 16개 코어로 이를 처리하는 것보다, GPU의 수천 개 작은 코어가 병렬 처리하는 것이 압도적으로 유리하다. NVIDIA A100 기준 FP16 행렬 연산 성능은 약 312 TFLOPS — CPU의 수백 배다.

## CUDA 아키텍처: SM, Warp, Thread

CUDA GPU는 **Streaming Multiprocessor(SM)**라는 단위로 구성된다. SM은 독립적인 연산 유닛 묶음으로, 각각 CUDA 코어(FP32/INT32), Tensor Core(행렬 연산 전용), Shared Memory, Warp Scheduler를 포함한다. H100 기준 132개 SM, 각 SM에 128개 CUDA 코어 → 총 16,896개 CUDA 코어.

GPU 실행의 기본 단위는 **Warp**다. Warp는 동시에 실행되는 32개 스레드의 묶음이다. Warp 내 모든 스레드는 동일한 명령어를 실행한다(SIMT: Single Instruction, Multiple Thread). 스레드가 서로 다른 분기(if/else)를 탈 경우 **Warp Divergence**가 발생해 직렬화되므로 성능이 저하된다.

```python
# CUDA 프로그래밍 모델 개념 (C++ CUDA 커널 예시)
# 딥러닝 프레임워크가 내부적으로 이 구조를 사용

# Grid: 커널 실행 단위 전체
# Block: 스레드 블록 (SM 하나에 배정)
# Thread: 가장 작은 실행 단위 (Warp 32개씩 묶임)

# Python에서 확인
import torch

print(f"CUDA 사용 가능: {torch.cuda.is_available()}")
print(f"GPU 수: {torch.cuda.device_count()}")
print(f"현재 GPU: {torch.cuda.get_device_name(0)}")
print(f"Compute Capability: {torch.cuda.get_device_capability(0)}")
# → Compute Capability: (9, 0) → H100 (SM 9.0)
```

## CUDA 메모리 계층 구조

딥러닝 성능 최적화에서 메모리가 연산보다 더 중요한 병목인 경우가 많다. CUDA는 용도별로 여러 계층의 메모리를 제공한다.

![CUDA 메모리 계층 구조](/assets/posts/gpu-cuda-memory.svg)

- **Register File**: 컴파일러가 자동 할당하는 가장 빠른 메모리. 스레드 전용.
- **Shared Memory / L1 Cache**: `__shared__` 키워드로 명시적 할당. SM 내 스레드 블록이 공유. 행렬 타일링 최적화의 핵심.
- **L2 Cache**: 자동 관리. GPU 전체 SM이 공유.
- **Global Memory (HBM/DRAM)**: `cudaMalloc` 또는 PyTorch 텐서가 여기 위치. 대용량이지만 레이턴시가 높다. **Coalesced Access**가 매우 중요.
- **Host RAM**: PCIe를 통해 GPU와 통신. 대역폭이 HBM 대비 ~30배 낮으므로 H2D/D2H 복사를 최소화해야 한다.

PyTorch는 이 모든 메모리 관리를 자동화하지만, 원리를 알아야 OOM을 피할 수 있다.

## PyTorch에서 GPU 다루기

### 기본 Device 관리

```python
import torch

# Device 설정 (MPS는 Apple Silicon)
device = (
    "cuda" if torch.cuda.is_available()
    else "mps" if torch.backends.mps.is_available()
    else "cpu"
)
print(f"Using device: {device}")

# 텐서를 GPU로 이동
x = torch.randn(1000, 1000)
x_gpu = x.to(device)           # 또는 x.cuda()
x_gpu = x.to("cuda:1")         # 두 번째 GPU 지정

# 모델을 GPU로 이동
model = MyModel()
model = model.to(device)

# GPU에서 CPU로 (결과 추출 시)
result = x_gpu.cpu().numpy()   # NumPy는 CPU 텐서만 지원
```

### Device 정보 확인 및 메모리 모니터링

```python
import torch

# 현재 GPU 메모리 상태 (바이트 단위)
allocated = torch.cuda.memory_allocated(0) / 1e9
reserved  = torch.cuda.memory_reserved(0) / 1e9
print(f"Allocated: {allocated:.2f} GB")
print(f"Reserved:  {reserved:.2f} GB")

# 메모리 정리 (캐시 해제)
torch.cuda.empty_cache()

# 메모리 스냅샷 (디버깅)
torch.cuda.reset_peak_memory_stats()
# ... 연산 ...
peak = torch.cuda.max_memory_allocated() / 1e9
print(f"Peak memory: {peak:.2f} GB")
```

### cuda.synchronize(): 비동기 실행 이해하기

PyTorch GPU 연산은 기본적으로 **비동기(asynchronous)**다. CPU는 GPU 작업을 큐에 올리고 바로 다음 코드로 넘어간다. 정확한 시간 측정을 위해서는 동기화가 필요하다.

```python
import torch
import time

x = torch.randn(10000, 10000, device='cuda')
y = torch.randn(10000, 10000, device='cuda')

# 잘못된 측정 (GPU가 실제로 끝나기 전에 시간 기록)
start = time.time()
z = torch.matmul(x, y)
print(f"Wrong: {time.time() - start:.4f}s")  # 거의 0초로 나옴

# 올바른 측정
torch.cuda.synchronize()  # 이전 작업 완료 대기
start = time.time()
z = torch.matmul(x, y)
torch.cuda.synchronize()  # 완료까지 대기
print(f"Correct: {time.time() - start:.4f}s")
```

## Mixed Precision: torch.cuda.amp

FP32(32비트 부동소수점) 대신 FP16(16비트) 연산을 사용하면 메모리가 절반으로 줄고, Tensor Core의 FP16 행렬 연산 가속을 받을 수 있다. PyTorch `torch.cuda.amp`는 자동으로 적합한 연산을 FP16으로 전환하면서 수치 안정성을 유지한다.

```python
import torch
from torch.cuda.amp import autocast, GradScaler

model = MyModel().to('cuda')
optimizer = torch.optim.AdamW(model.parameters(), lr=1e-4)
scaler = GradScaler()  # FP16 그라디언트 언더플로우 방지

for batch in dataloader:
    inputs, labels = batch
    inputs = inputs.to('cuda')
    labels = labels.to('cuda')

    optimizer.zero_grad()

    # autocast 블록 내에서 FP16 사용
    with autocast():
        outputs = model(inputs)
        loss = criterion(outputs, labels)

    # scaled backward (FP16 그라디언트 스케일)
    scaler.scale(loss).backward()
    scaler.step(optimizer)
    scaler.update()

print("Mixed precision training 완료")
```

PyTorch 2.0 이상에서는 `torch.compile(model)`과 조합하면 추가 가속을 얻을 수 있다.

## CUDA 프로그래밍 모델: Thread · Block · Grid

CUDA 커널은 수많은 스레드를 3차원 그리드로 조직화한다. 딥러닝 프레임워크가 이 구조를 자동으로 다루지만 원리를 이해하면 커스텀 연산(Custom Op) 작성이나 성능 분석이 쉬워진다.

```python
# PyTorch Custom CUDA Kernel (간단 예시)
# 실제로는 C++/CUDA 코드를 작성하고 torch.utils.cpp_extension으로 빌드

# PyTorch 내장 연산의 스레드 구조는 아래처럼 생각할 수 있음
# Grid = (ceil(N/256),) 개의 Block
# Block = 256개의 Thread
# 총 스레드 = N개 (각 원소 하나씩 처리)

# 실전: Triton 라이브러리로 Python에서 커스텀 커널 작성
# pip install triton
import triton
import triton.language as tl

@triton.jit
def add_kernel(x_ptr, y_ptr, output_ptr, n_elements, BLOCK_SIZE: tl.constexpr):
    pid = tl.program_id(axis=0)
    block_start = pid * BLOCK_SIZE
    offsets = block_start + tl.arange(0, BLOCK_SIZE)
    mask = offsets < n_elements
    x = tl.load(x_ptr + offsets, mask=mask)
    y = tl.load(y_ptr + offsets, mask=mask)
    output = x + y
    tl.store(output_ptr + offsets, output, mask=mask)
```

## GPU 활용률 모니터링

```bash
# nvidia-smi: 기본 GPU 상태 확인
nvidia-smi

# 1초마다 갱신 (훈련 중 모니터링)
watch -n 1 nvidia-smi

# 상세 정보
nvidia-smi --query-gpu=name,temperature.gpu,utilization.gpu,\
memory.used,memory.total --format=csv

# dmon: 지속 스트리밍
nvidia-smi dmon -s u -d 1
```

```python
# Python에서 GPU 상태 확인
import subprocess

def gpu_stats():
    result = subprocess.run(
        ['nvidia-smi',
         '--query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total',
         '--format=csv,noheader,nounits'],
        capture_output=True, text=True
    )
    for line in result.stdout.strip().split('\n'):
        name, temp, util, mem_used, mem_total = line.split(', ')
        print(f"{name} | {temp}°C | GPU {util}% | VRAM {mem_used}/{mem_total} MiB")

gpu_stats()
# → NVIDIA A100 | 42°C | GPU 78% | VRAM 38912/81920 MiB
```

## 흔한 CUDA 에러와 해결책

**CUDA out of memory**: 가장 흔한 에러. 배치 크기를 줄이거나, `torch.cuda.empty_cache()`를 호출한다. `del` 후 `gc.collect()`도 유효하다. 훈련 루프 안에서 그라디언트 축적(gradient accumulation)을 사용하면 작은 배치 크기로 큰 유효 배치를 시뮬레이션할 수 있다.

```python
import gc
import torch

# 메모리 누수 방지 패턴
for batch in dataloader:
    optimizer.zero_grad()
    with torch.cuda.amp.autocast():
        loss = model(batch)
    loss.backward()
    optimizer.step()

    # 매 N 스텝마다 캐시 정리
    if step % 100 == 0:
        torch.cuda.empty_cache()
        gc.collect()
```

**RuntimeError: Expected all tensors to be on the same device**: 텐서와 모델이 서로 다른 디바이스(CPU/GPU)에 있을 때 발생. `.to(device)`로 통일한다.

**CUDA error: device-side assert triggered**: 보통 인덱스 범위 초과나 NaN/Inf 값이 원인. `CUDA_LAUNCH_BLOCKING=1` 환경변수를 설정하면 더 명확한 스택 트레이스를 얻을 수 있다.

```bash
# 디버깅용: GPU 연산 동기화 강제 (느려지지만 에러 위치 정확)
CUDA_LAUNCH_BLOCKING=1 python train.py
```

**Warp Divergence 줄이기**: 커스텀 커널 작성 시 `if/else`를 최소화하거나, 마스크 연산으로 대체한다. PyTorch 기본 연산은 대부분 이미 최적화되어 있다.

## 멀티-GPU: DataParallel vs DistributedDataParallel

단일 GPU 메모리를 초과하는 모델이나 훈련을 가속하려면 멀티-GPU를 활용한다.

```python
import torch
import torch.nn as nn

# DataParallel: 간단하지만 비효율 (GIL, 언밸런싱)
model = nn.DataParallel(model)  # 기본: 모든 GPU 사용
model = nn.DataParallel(model, device_ids=[0, 1])

# DistributedDataParallel: 권장 방식
# torchrun 또는 torch.distributed.launch로 실행
# torchrun --nproc_per_node=4 train.py

import torch.distributed as dist
from torch.nn.parallel import DistributedDataParallel as DDP

dist.init_process_group(backend='nccl')  # GPU간 통신 백엔드
local_rank = int(os.environ['LOCAL_RANK'])
model = model.to(local_rank)
model = DDP(model, device_ids=[local_rank])
```

---

**지난 글:** [Jupyter Notebook·Lab 완전 정복: AI 개발자의 필수 환경](/posts/notebook-jupyter/)

**다음 글:** [GPU 메모리 최적화: OOM 없이 더 크게 훈련하는 법](/posts/gpu-memory-tuning/)

<br>
읽어주셔서 감사합니다. 😊
