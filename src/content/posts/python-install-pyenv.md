---
title: "pyenv로 Python 버전 관리하기"
description: "pyenv를 사용해 여러 Python 버전을 설치하고 프로젝트별로 관리하는 방법을 설명합니다. 가상환경과 함께 쓰는 패턴도 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["Python", "pyenv", "버전관리", "설치", "가상환경"]
featured: false
draft: false
---

[지난 글](/posts/python-implementations-cpython-pypy/)에서 CPython이 Python의 기본 구현체임을 배웠다. 이제 실제로 Python을 시스템에 설치하고 여러 버전을 관리하는 방법을 알아보자. 시스템 패키지 관리자(`apt`, `brew`)로 설치하는 방법도 있지만, 개발 환경에서는 **pyenv**가 훨씬 유연하다.

## 왜 pyenv인가

Python 개발을 하다 보면 여러 버전이 필요한 상황이 생긴다. 회사 레거시 프로젝트가 Python 3.8을 요구하는데, 새 프로젝트는 3.12의 최신 기능을 쓰고 싶을 수 있다. 시스템 Python을 직접 업그레이드하면 다른 프로젝트나 OS 도구가 망가질 수 있다.

pyenv는 다음 문제를 해결한다.

- 여러 Python 버전을 시스템에 충돌 없이 설치
- 프로젝트 디렉터리마다 서로 다른 Python 버전 지정
- `python` 명령이 올바른 버전을 가리키도록 PATH 조작

```bash
# 시스템에 여러 Python이 설치됐을 때의 혼란
which python3   # /usr/bin/python3
python3 --version  # 3.10.12 (OS 기본값)

# pyenv를 쓰면 프로젝트별로 자동 전환됨
cd ~/project-a && python --version  # Python 3.8.20
cd ~/project-b && python --version  # Python 3.12.4
```

## pyenv 설치

**macOS**:

```bash
# Homebrew로 설치
brew install pyenv

# 셸 설정 추가 (~/.zshrc 또는 ~/.bash_profile)
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.zshrc
echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.zshrc
echo 'eval "$(pyenv init -)"' >> ~/.zshrc

source ~/.zshrc
```

**Linux (Ubuntu/Debian)**:

```bash
# 의존성 설치
sudo apt update && sudo apt install -y \
  build-essential libssl-dev zlib1g-dev \
  libbz2-dev libreadline-dev libsqlite3-dev \
  libncursesw5-dev xz-utils libxml2-dev \
  libxmlsec1-dev libffi-dev liblzma-dev

# pyenv 설치 스크립트
curl https://pyenv.run | bash

# 셸 설정 추가 (~/.bashrc)
echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.bashrc
echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.bashrc
echo 'eval "$(pyenv init -)"' >> ~/.bashrc

source ~/.bashrc
```

## Python 버전 설치와 전환

![pyenv 핵심 명령어](/assets/posts/python-install-pyenv-commands.svg)

```bash
# 설치 가능한 버전 확인
pyenv install --list | grep "^\s*3\.12"

# 버전 설치 (소스 빌드, 시간이 걸림)
pyenv install 3.12.4
pyenv install 3.10.14

# 전역 기본값 설정
pyenv global 3.12.4

# 설치된 버전 목록 확인
pyenv versions
# * 3.12.4 (set by /home/user/.pyenv/version)
#   3.10.14

# 현재 디렉터리에 로컬 버전 지정
cd ~/my-old-project
pyenv local 3.10.14
cat .python-version  # 3.10.14

# 이 디렉터리 안에서는 자동으로 3.10.14가 활성화됨
python --version  # Python 3.10.14
```

pyenv는 세 가지 범위로 버전을 지정할 수 있다. **shell**은 현재 터미널 세션에만, **local**은 해당 디렉터리(`.python-version` 파일)에, **global**은 시스템 전역에 적용된다. 우선순위는 `shell > local > global` 순서다.

![pyenv 버전 관리 구조](/assets/posts/python-install-pyenv-workflow.svg)

## pyenv와 가상환경 함께 사용하기

Python 버전 관리(pyenv)와 패키지 의존성 격리(venv)는 별개 문제다. pyenv로 Python 버전을 고정한 뒤 `venv`로 가상환경을 만드는 것이 표준 패턴이다.

```bash
# 1. 프로젝트 디렉터리에서 Python 버전 지정
cd ~/my-project
pyenv local 3.12.4

# 2. 가상환경 생성 (해당 pyenv 버전의 Python 사용)
python -m venv .venv

# 3. 가상환경 활성화
source .venv/bin/activate  # macOS/Linux
# .venv\Scripts\activate   # Windows

# 4. 패키지 설치 (가상환경 안에만 설치됨)
pip install requests pandas

# 5. 가상환경 비활성화
deactivate
```

**pyenv-virtualenv** 플러그인을 쓰면 pyenv 안에서 가상환경을 직접 관리할 수도 있다.

```bash
# pyenv-virtualenv 설치 (macOS)
brew install pyenv-virtualenv

# 가상환경 생성
pyenv virtualenv 3.12.4 my-project-env

# 로컬 가상환경 지정 (자동 활성화)
pyenv local my-project-env

# 프로젝트 디렉터리 진입 시 자동으로 활성화됨
```

## Windows에서의 Python 설치

Windows에서는 pyenv 대신 **pyenv-win**을 사용한다.

```powershell
# PowerShell에서 설치
Invoke-WebRequest -UseBasicParsing `
  -Uri "https://raw.githubusercontent.com/pyenv-win/pyenv-win/master/pyenv-win/install-pyenv-win.ps1" `
  -OutFile "./install-pyenv-win.ps1"
.\install-pyenv-win.ps1

# 버전 설치 및 전환
pyenv install 3.12.4
pyenv global 3.12.4
python --version
```

혹은 **Python 공식 설치 프로그램**([python.org](https://python.org))을 직접 내려받는 방법도 간단하다. 단, 이 방법으로는 여러 버전 전환이 번거롭다.

## 설치 확인

pyenv와 Python이 올바르게 설정됐는지 확인하는 방법이다.

```bash
# pyenv 동작 확인
pyenv version       # 현재 활성 버전
pyenv which python  # 실제 python 실행 파일 경로

# Python 기본 동작 확인
python --version
python -c "import sys; print(sys.executable)"

# pip 확인
pip --version
pip list  # 설치된 패키지 목록
```

설치가 완료됐다면 이제 코드를 작성할 준비가 됐다. 다음 편에서는 Python의 설계 철학인 'The Zen of Python'을 살펴본다.

---

**지난 글:** [CPython vs PyPy: Python 구현체의 세계](/posts/python-implementations-cpython-pypy/)

**다음 글:** [Python의 철학: Zen of Python (PEP 20)](/posts/python-zen-pep20/)

<br>
읽어주셔서 감사합니다. 😊
