---
title: "pyenv로 Python 버전 마스터하기"
description: "pyenv를 사용해 여러 Python 버전을 관리하는 방법을 설명합니다. 설치, 버전 전환, 프로젝트별 버전 고정, 가상환경 연동까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["Python", "pyenv", "버전관리", "가상환경", "개발환경"]
featured: false
draft: false
---

[지난 글](/posts/python-implementations-cpython-pypy/)에서 CPython이 표준 구현체임을 살펴봤다. 이번 편에서는 Python 개발 환경의 현실적인 문제를 다룬다. 실무에서는 하나의 Python 버전만 사용하지 않는다. 프로젝트 A는 Python 3.10을 요구하고, 프로젝트 B는 3.12를 쓰며, 레거시 프로젝트는 3.8에 묶여 있을 수 있다. 이런 버전 충돌 문제를 우아하게 해결하는 도구가 **pyenv**다.

## 왜 pyenv가 필요한가?

시스템에 Python을 직접 설치하면 `/usr/bin/python3` 처럼 고정된 경로에 하나의 버전만 존재한다. 두 번째 버전을 설치하면 충돌이 발생하거나 이전 버전이 덮어씌워진다.

pyenv는 이 문제를 해결한다. `~/.pyenv/versions/` 아래에 여러 버전을 독립적으로 설치하고, `shim`이라는 래퍼를 통해 어떤 버전을 사용할지 동적으로 결정한다. 시스템 Python에 전혀 영향을 주지 않는다.

## pyenv 설치

### macOS (Homebrew)

```bash
# Homebrew로 설치
brew install pyenv

# 셸 설정 파일에 추가 (~/.zshrc 또는 ~/.bashrc)
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.zshrc
echo '[[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.zshrc
echo 'eval "$(pyenv init -)"' >> ~/.zshrc

# 셸 재시작 또는
source ~/.zshrc
```

### Linux

```bash
# 자동 설치 스크립트
curl https://pyenv.run | bash

# 또는 git으로 직접
git clone https://github.com/pyenv/pyenv.git ~/.pyenv

# 셸 설정 추가 (위와 동일)
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.bashrc
echo 'export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.bashrc
echo 'eval "$(pyenv init -)"' >> ~/.bashrc
source ~/.bashrc
```

### Windows

Windows에서는 `pyenv-win`을 사용한다.

```powershell
# PowerShell
Invoke-WebRequest -UseBasicParsing -Uri `
  "https://raw.githubusercontent.com/pyenv-win/pyenv-win/master/pyenv-win/install-pyenv-win.ps1" `
  -OutFile "./install-pyenv-win.ps1"; &"./install-pyenv-win.ps1"
```

## 기본 사용법

![pyenv 워크플로우](/assets/posts/python-install-pyenv-workflow.svg)

### Python 버전 설치

```bash
# 설치 가능한 버전 목록 보기
pyenv install --list
# 3.8.18, 3.9.18, 3.10.14, 3.11.9, 3.12.3, ...

# 특정 버전 설치
pyenv install 3.12.3
pyenv install 3.11.9
pyenv install 3.10.14

# 설치된 버전 확인
pyenv versions
# * system (set by /home/user/.pyenv/version)
#   3.10.14
#   3.11.9
#   3.12.3
# * 는 현재 활성 버전

# 현재 사용 중인 버전
pyenv version
# 3.12.3 (set by /home/user/.pyenv/version)
```

### 버전 설정: global, local, shell

pyenv의 핵심 기능은 버전 범위를 세 단계로 제어하는 것이다.

```bash
# global: 시스템 기본값 설정
pyenv global 3.12.3
python --version  # Python 3.12.3

# local: 현재 디렉토리 (프로젝트별)
cd ~/my-project
pyenv local 3.11.9
python --version  # Python 3.11.9
# → .python-version 파일 생성됨

# shell: 현재 셸 세션에만 적용
pyenv shell 3.10.14
python --version  # Python 3.10.14
# → 셸 닫으면 사라짐
```

우선순위는 `shell > local > global`이다. `.python-version` 파일이 있는 디렉토리에 들어가면 자동으로 해당 버전이 활성화된다. 프로젝트 루트에 이 파일을 커밋해두면 팀 전체가 동일한 Python 버전을 사용하게 된다.

### shim 동작 원리

pyenv가 PATH에 `~/.pyenv/shims`를 추가한다. `python`을 실행하면 실제 Python 대신 pyenv의 shim이 먼저 실행된다. shim은 현재 경로의 `.python-version` 파일, 전역 설정 파일 등을 확인해 올바른 Python 버전을 찾아 실행한다.

```bash
# shim 경로 확인
which python
# /home/user/.pyenv/shims/python

# 실제 Python 경로
pyenv which python
# /home/user/.pyenv/versions/3.12.3/bin/python3.12
```

## 디렉토리 구조

![pyenv 디렉토리 구조](/assets/posts/python-install-pyenv-structure.svg)

```bash
~/.pyenv/
├── versions/          # 설치된 Python 버전들
│   ├── 3.10.14/
│   ├── 3.11.9/
│   └── 3.12.3/
│       ├── bin/       # python, pip, 실행 파일들
│       ├── lib/       # 표준 라이브러리
│       └── include/   # C 헤더 파일
├── shims/             # 버전 라우팅 래퍼
│   ├── python
│   ├── pip
│   └── pytest
└── version            # global 버전 설정 파일
```

## 가상환경과 함께 사용하기

pyenv는 버전 관리를 담당하고, 가상환경은 패키지 격리를 담당한다. 두 도구를 함께 쓰는 것이 일반적이다.

```bash
# pyenv로 버전 선택 후 venv 생성
cd my-project
pyenv local 3.12.3

python -m venv .venv
source .venv/bin/activate   # Linux/macOS
# .venv\Scripts\activate    # Windows

pip install requests pandas

# 가상환경 비활성화
deactivate
```

### pyenv-virtualenv 플러그인

`pyenv-virtualenv` 플러그인을 사용하면 pyenv에서 직접 가상환경을 만들고 관리할 수 있다.

```bash
# 플러그인 설치
brew install pyenv-virtualenv
# 또는
git clone https://github.com/pyenv/pyenv-virtualenv.git \
  $(pyenv root)/plugins/pyenv-virtualenv

# 셸 설정 추가
echo 'eval "$(pyenv virtualenv-init -)"' >> ~/.zshrc

# 가상환경 생성 (Python 버전 + 이름)
pyenv virtualenv 3.12.3 my-project-env

# 프로젝트에서 자동 활성화
cd my-project
pyenv local my-project-env

# 생성된 가상환경 목록
pyenv virtualenvs
```

## pyenv 관리 팁

```bash
# 더 이상 안 쓰는 버전 제거
pyenv uninstall 3.9.18

# pyenv 자체 업데이트 (git 설치 방식)
cd $(pyenv root) && git pull

# Homebrew로 설치했으면
brew upgrade pyenv

# 특정 버전 재설치 (손상된 경우)
pyenv uninstall 3.12.3
pyenv install 3.12.3
```

## 실전 팁: .python-version을 git에 커밋하라

팀 프로젝트에서는 `.python-version` 파일을 git에 포함시켜야 한다. 이 파일 하나로 팀원 모두가 동일한 Python 버전을 사용하게 된다.

```bash
# 프로젝트 초기 설정
pyenv local 3.12.3
git add .python-version
git commit -m "chore: Python 3.12.3 버전 고정"
```

`.python-version`은 단순한 텍스트 파일이다.

```
3.12.3
```

CI/CD 파이프라인(GitHub Actions, GitLab CI 등)에서도 pyenv를 사용하거나, `actions/setup-python`처럼 pyenv와 호환되는 방식으로 동일한 버전을 보장할 수 있다.

## uv: 차세대 Python 관리 도구

최근 Rust로 작성된 `uv`가 pyenv + pip + venv의 기능을 통합하며 빠르게 주목받고 있다. pyenv보다 설치와 사용이 훨씬 빠르다. 단, 아직 생태계가 형성 중이라 pyenv가 더 안정적인 선택이다. 이 시리즈의 후반부에서 uv를 별도로 다룰 예정이다.

다음 편에서는 Python 언어의 설계 철학을 담은 PEP 20, "The Zen of Python"을 살펴본다. `import this`라는 easter egg에 담긴 19가지 격언을 코드와 함께 이해할 것이다.

---

**지난 글:** [CPython과 PyPy: Python 구현체의 세계](/posts/python-implementations-cpython-pypy/)

**다음 글:** [The Zen of Python: PEP 20이 말하는 아름다운 코드](/posts/python-zen-pep20/)

<br>
읽어주셔서 감사합니다. 😊
