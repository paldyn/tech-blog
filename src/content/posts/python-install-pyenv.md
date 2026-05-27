---
title: "pyenv로 Python 버전 관리하기"
description: "pyenv를 사용해 여러 Python 버전을 설치하고 프로젝트별로 독립적인 버전을 유지하는 방법을 단계별로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["Python", "pyenv", "가상환경", "버전관리", "설치"]
featured: false
draft: false
---

[지난 글](/posts/python-implementations-cpython-pypy/)에서 Python 구현체를 살펴봤습니다. 실무에서는 프로젝트마다 다른 Python 버전을 요구하는 경우가 많습니다. 어떤 프로젝트는 3.11을, 다른 프로젝트는 3.13을 써야 할 때 시스템에 여러 Python 버전을 깔끔하게 관리하는 도구가 **pyenv**입니다.

## pyenv란?

pyenv는 macOS/Linux에서 여러 Python 버전을 설치하고 전역 또는 프로젝트별로 버전을 전환할 수 있게 해 주는 도구입니다. 핵심 아이디어는 `PATH` 앞에 shim(심) 실행 파일을 삽입해 `python` 명령을 가로채는 것입니다.

```bash
# 현재 사용 중인 Python 확인
python --version  # Python 3.13.0
which python      # /Users/user/.pyenv/shims/python
```

## 설치

**macOS (Homebrew)**

```bash
brew update && brew install pyenv

# .zshrc 또는 .bashrc에 추가
export PYENV_ROOT="$HOME/.pyenv"
export PATH="$PYENV_ROOT/bin:$PATH"
eval "$(pyenv init -)"
```

**Linux (curl 스크립트)**

```bash
curl https://pyenv.run | bash
# 이후 쉘 설정 파일에 동일하게 추가
```

설치 후 터미널을 재시작하거나 `source ~/.zshrc`를 실행합니다.

## Python 설치 및 관리

```bash
# 설치 가능한 버전 목록
pyenv install --list | grep "  3\."

# 특정 버전 설치
pyenv install 3.13.0
pyenv install 3.11.9

# 설치된 버전 확인
pyenv versions
#   system
# * 3.13.0 (set by /Users/user/.pyenv/version)
#   3.11.9
```

![pyenv 버전 관리 흐름](/assets/posts/python-install-pyenv-flow.svg)

## 전역 버전과 로컬 버전

pyenv에는 세 가지 범위의 버전 설정이 있습니다.

```bash
# 전역(시스템 기본값)
pyenv global 3.13.0

# 프로젝트별 (현재 디렉터리에 .python-version 파일 생성)
cd myproject
pyenv local 3.11.9
cat .python-version   # 3.11.9

# 현재 쉘 세션만
pyenv shell 3.12.7
```

`.python-version` 파일을 Git에 커밋하면 팀 전체가 동일한 Python 버전을 사용할 수 있습니다.

## pyenv + venv 조합

pyenv는 버전만 관리하고 패키지 격리는 `venv`가 담당합니다. 함께 쓰면 완벽한 환경 분리가 됩니다.

![pyenv + venv 워크플로우](/assets/posts/python-install-pyenv-venv.svg)

```bash
# 프로젝트 셋업
mkdir myapp && cd myapp
pyenv local 3.13.0
python -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn
pip freeze > requirements.txt
```

## Windows에서 Python 관리

Windows에서는 pyenv-win을 씁니다.

```powershell
# Windows PowerShell
Invoke-WebRequest -UseBasicParsing -Uri "https://raw.githubusercontent.com/pyenv-win/pyenv-win/master/pyenv-win/install-pyenv-win.ps1" -OutFile "./install-pyenv-win.ps1"
.\install-pyenv-win.ps1

pyenv install 3.13.0
pyenv global 3.13.0
```

또는 공식 python.org 설치 파일을 사용하고, 프로젝트별 격리는 `venv`만으로도 충분합니다.

## 유용한 명령어 모음

```bash
# 버전 목록
pyenv versions

# 현재 활성 버전 확인
pyenv version

# 특정 버전 제거
pyenv uninstall 3.11.9

# rehash: shim 파일 갱신 (새 패키지 설치 후)
pyenv rehash

# 어디서 python이 실행되는지
pyenv which python
```

## 정리

pyenv를 쓰면 시스템 Python을 건드리지 않고 여러 버전을 안전하게 관리할 수 있습니다. `pyenv local`로 프로젝트마다 버전을 고정하고, `venv`로 패키지 환경을 격리하는 것이 Python 개발 환경의 기본 세팅입니다. 다음 글에서는 Python의 설계 철학을 담은 "Python의 선(The Zen of Python)"을 살펴봅니다.

---

**지난 글:** [CPython, PyPy — Python 구현체 완전 비교](/posts/python-implementations-cpython-pypy/)

**다음 글:** [Python의 선 (Zen of Python) — PEP 20](/posts/python-zen-pep20/)

<br>
읽어주셔서 감사합니다. 😊
