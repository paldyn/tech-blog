---
title: "pyproject.toml: 프로젝트 설정의 단일 표준"
description: "build-system·project·tool 세 영역으로 나뉘는 pyproject.toml의 구조와 빌드 백엔드가 호출되는 흐름을, 작성 예시와 함께 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["pyproject", "TOML", "패키징", "PEP621", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-uv-package-manager/)까지 Poetry·PDM·uv를 살펴봤는데, 이 도구들이 공통으로 읽고 쓰는 파일이 하나 있었다. 바로 `pyproject.toml`이다. 한때 파이썬 프로젝트 설정은 `setup.py`, `setup.cfg`, `requirements.txt`, 도구별 설정 파일로 흩어져 있었지만, 이제는 `pyproject.toml` 하나로 모이는 흐름이 자리 잡았다. 이번 글은 이 파일의 구조를 정면으로 들여다본다.

## TOML이라는 형식

먼저 확장자에 담긴 `TOML`은 사람이 읽고 쓰기 쉬운 설정 파일 형식이다. `[섹션]`으로 영역을 나누고 `키 = 값`으로 항목을 적는다. INI와 비슷하지만 배열·중첩 테이블 같은 구조를 명확하게 표현할 수 있어, 파이썬이 표준 설정 형식으로 채택했다. 파이썬 3.11부터는 표준 라이브러리 `tomllib`로 읽을 수도 있다.

## 세 가지 핵심 영역

`pyproject.toml`은 크게 세 종류의 테이블로 구성된다. 빌드 방법을 정하는 `[build-system]`, 프로젝트 자체를 기술하는 `[project]`, 그리고 각 도구의 설정을 담는 `[tool.*]`이다.

![pyproject.toml의 세 영역](/assets/posts/python-pyproject-toml-sections.svg)

### [build-system] — 어떻게 빌드할지

이 영역은 패키지를 만들 때 **어떤 빌드 백엔드를 쓸지**를 지정한다. PEP 517/518이 정의한 부분으로, 패키징 도구가 가장 먼저 읽는 곳이다.

```toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

`requires`는 빌드에 필요한 도구를, `build-backend`는 실제로 패키지를 만들 모듈을 가리킨다. 백엔드로는 `hatchling`, `setuptools`, `flit-core`, `poetry-core` 등을 고를 수 있다.

### [project] — 프로젝트가 무엇인지

PEP 621이 표준화한 영역으로, 이름·버전·의존성처럼 프로젝트의 정체성을 담는다.

```toml
[project]
name = "myapp"
version = "0.1.0"
description = "예시 애플리케이션"
requires-python = ">=3.10"
dependencies = [
    "requests>=2.31",
    "rich~=13.7",
]
```

`dependencies`에 적는 버전 지정자의 의미는 뒤의 버전 고정 글에서 더 깊이 다룬다. 여기서는 "런타임에 필요한 패키지 목록을 표준 형식으로 적는 곳"이라는 점만 기억하면 된다.

### [tool.*] — 도구별 설정

포매터·린터·타입 검사기 등 각 도구의 설정을 한 파일 안에 모을 수 있다. 도구마다 `[tool.이름]` 아래에 자기 설정을 둔다.

```toml
[tool.ruff]
line-length = 88

[tool.pytest.ini_options]
testpaths = ["tests"]
```

흩어져 있던 `.flake8`, `pytest.ini`, `setup.cfg` 같은 파일들을 이 한 곳으로 모을 수 있다는 게 큰 장점이다.

## 선언에서 빌드로 이어지는 흐름

`pyproject.toml`은 그 자체로는 "선언"일 뿐이다. 실제 패키지를 만들 때는, 빌드 **프런트엔드**(`pip`나 `build` 같은 도구)가 `[build-system]`을 읽어 명시된 백엔드를 호출하고, 백엔드가 `[project]` 정보를 바탕으로 결과물을 만든다.

![선언에서 빌드로](/assets/posts/python-pyproject-toml-buildflow.svg)

```bash
python -m build      # build 프런트엔드가 백엔드를 호출 → dist/ 생성
```

이 분리 덕분에 도구를 자유롭게 바꿀 수 있다. 백엔드를 `hatchling`에서 `setuptools`로 바꿔도, 프로젝트를 빌드하는 명령(`python -m build`)은 그대로다.

## 정리

`pyproject.toml`은 "이 프로젝트는 무엇이고, 무엇에 의존하며, 어떻게 빌드되고, 각 도구는 어떻게 설정되는가"를 한 파일에 담는 단일 진입점이다. 어떤 패키지 관리자를 쓰든 결국 이 파일을 중심으로 동작하므로, 구조를 이해해 두면 도구가 바뀌어도 길을 잃지 않는다. 다음 글에서는 이 표준이 자리 잡기 전 오랫동안 그 역할을 했던 `setup.py`와 비교하며, 왜 이런 전환이 일어났는지를 살펴본다.

---

**지난 글:** [uv: Rust로 다시 쓴 초고속 패키지 매니저](/posts/python-uv-package-manager/)

**다음 글:** [setup.py vs pyproject.toml: 패키징 설정의 세대 교체](/posts/python-setup-py-vs-pyproject/)

<br>
읽어주셔서 감사합니다. 😊
