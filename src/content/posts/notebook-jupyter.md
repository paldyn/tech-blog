---
title: "Jupyter Notebook·Lab 완전 정복: AI 개발자의 필수 환경"
description: "주피터 노트북과 JupyterLab의 구조, 커널 동작 원리, 매직 커맨드, 확장 기능, 실전 워크플로우를 AI 개발 관점에서 완전 정복한다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["Jupyter", "JupyterLab", "Python", "AI개발", "노트북", "데이터분석"]
featured: false
draft: false
---

[지난 글](/posts/gemini-sdk/)에서 Google Gemini SDK를 활용해 멀티모달 호출과 Function Calling을 실전 예제로 살펴봤다. 이번에는 한 걸음 뒤로 물러나, AI 개발자라면 매일 마주하는 작업 환경 자체를 파고든다. **Jupyter Notebook과 JupyterLab**은 탐색적 데이터 분석부터 모델 훈련 실험, 논문 재현, 팀 발표 자료 작성까지 그 역할이 끝이 없다. 단순히 "코드 실행하는 곳"이 아니라, 브라우저·서버·커널이 유기적으로 연결된 정교한 시스템이다. 구조를 이해하면 디버깅도 빠르고, 확장도 자유로워진다.

## Jupyter 아키텍처 이해하기

Jupyter는 세 컴포넌트가 분리된 구조로 동작한다.

![Jupyter 아키텍처: Browser → Server → Kernel](/assets/posts/notebook-jupyter-architecture.svg)

**Browser(Notebook UI)**는 CodeMirror 에디터와 출력 렌더러를 포함한 순수 HTML/JavaScript 앱이다. 사용자가 셀을 실행하면 HTTP 또는 WebSocket을 통해 **Jupyter Server**에 메시지를 보낸다. 서버는 Tornado 비동기 프레임워크 위에서 동작하는 Python 프로세스로, REST API 라우팅·커널 생명주기 관리·파일 시스템 접근을 담당한다. 실제 코드 실행은 서버가 아닌 **IPython Kernel**이 맡는다. 서버와 커널은 ZeroMQ 5-소켓 프로토콜로 통신한다(`shell`, `iopub`, `stdin`, `control`, `heartbeat`).

### .ipynb 파일 구조

노트북 파일은 확장자만 특별할 뿐 내부는 완전한 JSON이다. `cells` 배열에 각 셀이 순서대로 담기고, `cell_type`이 `"code"` · `"markdown"` · `"raw"` 중 하나를 가진다. 코드 셀은 `outputs` 필드에 실행 결과를 저장하기 때문에 파일만 공유해도 결과를 함께 볼 수 있다.

```bash
# 노트북 서버 실행 (8888 포트)
jupyter notebook

# JupyterLab 실행 (최신 인터페이스)
jupyter lab

# 특정 포트·디렉터리 지정
jupyter lab --port 9000 --notebook-dir ~/projects
```

## 셀 타입과 실행 모델

코드 셀(Code Cell)은 커널로 전송되어 실행되고 결과가 `outputs`에 저장된다. 실행 순서를 나타내는 `execution_count`가 셀 왼쪽에 표시된다. **중요한 함정**: 셀은 파일 순서가 아닌 **실행 순서**로 커널 상태에 영향을 준다. 아래 셀 먼저 실행한 뒤 위 셀을 실행하면 예상치 못한 결과가 생긴다.

마크다운 셀(Markdown Cell)은 렌더링만 하고 커널로 전달되지 않는다. `$`, `$$` 를 써서 LaTeX 수식도 표현할 수 있어 실험 노트로 적합하다. Raw 셀은 `nbconvert` 변환 시 그대로 출력에 포함되며, 보통 `rst` 문서 작성 때 사용한다.

```python
# 커널 상태 초기화 없이 변수를 재정의하면 발생하는 전형적 버그
x = 10

# ... (여러 셀 실행 후)

x = 20  # 위 셀보다 나중에 실행되면 x=20이 먼저 정의됨
result = x * 2  # 결과가 달라질 수 있음

# 안전한 접근: Kernel > Restart & Run All로 전체 재실행
```

## 매직 커맨드 완전 정복

IPython 매직 커맨드는 Python 문법이 아닌 특수 명령어로, 커널 기능을 확장한다. 라인 매직(`%`)은 한 줄에만 적용되고, 셀 매직(`%%`)은 셀 전체를 인수로 받는다. 셸 커맨드(`!`)는 OS 명령을 직접 실행한다.

![Jupyter 매직 커맨드 카테고리](/assets/posts/notebook-jupyter-magic.svg)

```python
# 성능 측정 — %timeit: 반복 측정으로 신뢰도 높은 평균
%timeit [x**2 for x in range(1000)]
# → 145 µs ± 2.4 µs per loop (mean ± std. dev. of 7 runs, 10,000 loops each)

# %%time: 셀 전체를 한 번만 측정
%%time
import numpy as np
a = np.random.randn(5000, 5000)
b = np.dot(a, a)
# → CPU times: user 1.2 s, sys: 44 ms, total: 1.24 s
```

```python
# 그래프 인라인 표시
%matplotlib inline
import matplotlib.pyplot as plt
import numpy as np

x = np.linspace(0, 2 * np.pi, 100)
plt.plot(x, np.sin(x), label='sin(x)')
plt.plot(x, np.cos(x), label='cos(x)')
plt.legend()
plt.title("삼각함수")
plt.show()
```

```python
# %%capture: 출력 억제 및 변수 저장
%%capture output
import subprocess
result = subprocess.run(['python', '-c', 'print("captured!")'], capture_output=True)

# 나중에 출력 확인
print(output.stdout)

# 환경변수 관리
%env OPENAI_API_KEY=sk-...
%env  # 전체 환경변수 목록 출력
```

```bash
# 셸 명령으로 패키지 설치 및 파일 관리
!pip install accelerate bitsandbytes transformers
!nvidia-smi          # GPU 상태 확인
!ls -la checkpoints/ # 디렉터리 확인
files = !ls *.csv    # 결과를 Python 리스트로 저장
print(files)
```

자주 쓰는 기타 매직:

| 매직 | 용도 |
|---|---|
| `%who` / `%whos` | 현재 네임스페이스 변수 목록 |
| `%reset` | 커널 네임스페이스 초기화 |
| `%load_ext` | 확장 로드 (`autoreload`, `tensorboard`) |
| `%autoreload 2` | 외부 모듈 변경 시 자동 리로드 |
| `%%writefile model.py` | 셀 내용을 파일로 저장 |
| `%run script.py` | 외부 스크립트 실행 (커널 공유) |

## ipywidgets: 인터랙티브 UI 만들기

`ipywidgets`는 슬라이더·드롭다운·버튼 같은 UI 위젯을 노트북 안에 직접 만들 수 있게 해준다. 모델 하이퍼파라미터를 실시간으로 조정하거나, 데이터셋을 시각적으로 탐색할 때 매우 유용하다.

```python
import ipywidgets as widgets
from IPython.display import display
import matplotlib.pyplot as plt
import numpy as np

# @interact 데코레이터로 간단하게 슬라이더 연결
from ipywidgets import interact

@interact(
    frequency=widgets.FloatSlider(min=0.5, max=5.0, step=0.1, value=1.0),
    amplitude=widgets.FloatSlider(min=0.1, max=2.0, step=0.1, value=1.0),
    wave_type=widgets.Dropdown(options=['sin', 'cos', 'square'])
)
def plot_wave(frequency, amplitude, wave_type):
    x = np.linspace(0, 4 * np.pi, 500)
    if wave_type == 'sin':
        y = amplitude * np.sin(frequency * x)
    elif wave_type == 'cos':
        y = amplitude * np.cos(frequency * x)
    else:
        y = amplitude * np.sign(np.sin(frequency * x))

    plt.figure(figsize=(8, 3))
    plt.plot(x, y)
    plt.ylim(-2.5, 2.5)
    plt.title(f"{wave_type}(x), freq={frequency}, amp={amplitude}")
    plt.tight_layout()
    plt.show()
```

```python
# 진행 상황 표시 (훈련 루프에서 유용)
from ipywidgets import IntProgress
from IPython.display import display

progress = IntProgress(min=0, max=100, description='Training:')
display(progress)

for epoch in range(100):
    # ... 훈련 코드 ...
    progress.value = epoch + 1
```

## JupyterLab과 확장 기능

**JupyterLab**은 클래식 Notebook의 후속 인터페이스로, 탭·패널·파일 탐색기·터미널을 하나의 IDE처럼 배치할 수 있다. 같은 커널을 여러 노트북이 공유하거나, 파일 브라우저와 노트북을 나란히 열어 작업하는 것도 가능하다.

```bash
# JupyterLab 설치
pip install jupyterlab

# 주요 확장 기능 설치
pip install jupyterlab-git            # Git 패널
pip install jupyterlab-lsp            # 언어 서버 프로토콜 (자동 완성)
pip install aquirdturtle-collapsible-headings  # 섹션 접기
pip install jupyterlab_execute_time   # 셀 실행 시간 표시
pip install jupyterlab-tensorboard    # TensorBoard 내장

# 확장 목록 확인
jupyter labextension list
```

특히 `jupyterlab-lsp`를 설치하면 `python-language-server` 또는 `pyright`와 연동해 VS Code 수준의 자동 완성·타입 힌트·Go-to-Definition을 노트북 안에서 사용할 수 있다.

## AI/ML 실전 워크플로우

딥러닝 실험에서 Jupyter를 효과적으로 쓰려면 몇 가지 패턴을 갖추는 것이 좋다.

```python
# 1. 환경 재현성 확인 셀 (노트북 맨 위에 배치)
import sys
import torch
import numpy as np
import pandas as pd

print(f"Python {sys.version}")
print(f"PyTorch {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"GPU: {torch.cuda.get_device_name(0)}")
    print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
```

```python
# 2. 실험 설정 셀 (하이퍼파라미터 한 곳에 모아두기)
config = {
    "model": "bert-base-uncased",
    "batch_size": 32,
    "lr": 2e-5,
    "epochs": 3,
    "max_len": 128,
    "seed": 42,
}

# 재현성 설정
import random
import numpy as np
import torch

def set_seed(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

set_seed(config["seed"])
```

```python
# 3. TensorBoard 인라인 연동
%load_ext tensorboard
%tensorboard --logdir runs/

# 학습 중 기록
from torch.utils.tensorboard import SummaryWriter

writer = SummaryWriter("runs/experiment_1")
for step, loss in enumerate(train_losses):
    writer.add_scalar("Loss/train", loss, step)
writer.close()
```

```python
# 4. 중간 체크포인트 저장 (커널 크래시 대비)
import torch

def save_checkpoint(model, optimizer, epoch, path="checkpoint.pt"):
    torch.save({
        "epoch": epoch,
        "model_state": model.state_dict(),
        "optimizer_state": optimizer.state_dict(),
    }, path)
    print(f"Checkpoint saved: epoch {epoch}")

# 매 에폭마다 저장
for epoch in range(config["epochs"]):
    train_one_epoch(model, loader, optimizer)
    save_checkpoint(model, optimizer, epoch)
```

## nbconvert: 노트북을 다양한 형식으로 변환

노트북을 HTML 보고서, Python 스크립트, PDF, 슬라이드로 변환할 수 있다. CI/CD 파이프라인에서 노트북을 자동 실행하고 결과를 HTML로 배포하는 패턴도 자주 쓰인다.

```bash
# HTML 변환 (결과 포함)
jupyter nbconvert --to html analysis.ipynb

# Python 스크립트 추출 (코드 셀만)
jupyter nbconvert --to script model_training.ipynb

# PDF 변환 (LaTeX 필요)
jupyter nbconvert --to pdf report.ipynb

# 실행 후 변환 (papermill 조합으로도 가능)
jupyter nbconvert --to html --execute analysis.ipynb

# 파라미터화된 노트북 실행 (papermill)
pip install papermill
papermill template.ipynb output.ipynb -p lr 1e-4 -p epochs 10
```

## Google Colab vs 로컬 Jupyter

| 항목 | Google Colab | 로컬 Jupyter |
|---|---|---|
| 설치 | 필요 없음 | Python 환경 필요 |
| GPU | T4 무료, A100 유료 | 자신의 GPU |
| 스토리지 | Google Drive 연동 | 로컬 파일 시스템 |
| 협업 | 링크 공유 즉시 가능 | 별도 설정 필요 |
| 커스터마이징 | 제한적 | 확장 기능 자유롭게 |
| 보안 | 코드가 Google 서버에서 실행 | 로컬 실행 |
| 지속성 | 런타임 90분 후 초기화 | 계속 유지 |

빠른 프로토타이핑이나 GPU가 없는 환경에서는 Colab이, 장기 실험·민감한 데이터·커스텀 환경이 필요할 때는 로컬 JupyterLab이 낫다.

## 자주 겪는 문제와 해결책

**커널이 죽는(Dead Kernel) 경우**: 메모리 초과가 가장 흔한 원인이다. `%whos`로 큰 객체를 확인하고 `del variable; import gc; gc.collect()`로 해제한다.

**Out of Memory (OOM)**: GPU 메모리 부족이면 배치 크기를 줄이거나, `torch.cuda.empty_cache()`를 호출한다. 다음 글에서 더 깊이 다룬다.

**포트 충돌**: `jupyter lab --port 9000`으로 포트를 변경하거나, `jupyter notebook list`로 실행 중인 서버를 확인한다.

**`autoreload` 설정**: 외부 Python 파일을 수정하면서 노트북에서 바로 반영받으려면 상단 셀에 아래 코드를 배치한다.

```python
%load_ext autoreload
%autoreload 2
import my_module  # my_module.py 수정 후 자동 반영
```

---

**지난 글:** [Google Gemini SDK 활용 가이드](/posts/gemini-sdk/)

**다음 글:** [GPU와 CUDA: 딥러닝 연산의 심장을 이해하다](/posts/gpu-cuda/)

<br>
읽어주셔서 감사합니다. 😊
