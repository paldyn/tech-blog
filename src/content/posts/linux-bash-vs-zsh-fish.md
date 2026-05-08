---
title: "Bash vs Zsh vs Fish: 어떤 셸을 써야 할까"
description: "세 가지 주요 셸의 특징·문법·장단점을 비교하고, 스크립팅과 인터랙티브 용도에 맞는 선택 기준을 제시한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 7
type: "knowledge"
category: "Linux"
tags: ["Linux", "bash", "zsh", "fish", "셸", "Oh My Zsh"]
featured: false
draft: false
---

[지난 글](/posts/linux-shell-vs-terminal/)에서 셸이 터미널과 다른 별개의 프로세스임을 확인했다. 이번에는 가장 널리 쓰이는 세 가지 셸 — **Bash, Zsh, Fish** — 를 비교한다. 어떤 셸을 기본으로 쓸지, 스크립팅은 어떤 셸로 작성할지 결정하는 데 도움이 된다.

## Bash: 사실상 표준

**Bash(Bourne Again Shell)**는 1989년 GNU 프로젝트의 일환으로 만들어진 셸이다. 대부분의 Linux 배포판에서 `/bin/bash`로 기본 설치되어 있고, 서버 환경에서도 항상 사용 가능하다.

POSIX sh와 호환되어 어디서나 돌아가는 스크립트를 작성할 수 있다. `#!/bin/bash`로 시작하는 쉘 스크립트가 전 세계 수백만 개의 서버에서 실행된다.

```bash
# bash 버전 확인
bash --version
# GNU bash, version 5.2.21(1)-release

# 현재 셸 변경 (로그인 셸)
chsh -s /bin/bash

# bash 설정 파일
# ~/.bashrc        — 인터랙티브 비로그인 셸
# ~/.bash_profile  — 로그인 셸
```

Bash의 약점은 인터랙티브 경험이다. 기본 자동완성, 히스토리 검색, 문법 강조는 zsh나 fish에 비해 부족하다. 플러그인 없이는 입력 중인 명령어가 올바른지 틀린지 실행하기 전까지 알 수 없다.

## Zsh: 파워 유저의 선택

**Zsh(Z Shell)**는 1990년 Paul Falstad가 만들었다. bash와 대부분 호환되면서 훨씬 강력한 인터랙티브 기능을 제공한다. macOS는 Catalina(2019)부터 기본 셸을 zsh로 변경했다.

```bash
# zsh 설치 (Debian/Ubuntu)
sudo apt install zsh

# zsh를 기본 셸로 변경
chsh -s /usr/bin/zsh

# Oh My Zsh 설치 (플러그인 프레임워크)
sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)"

# zsh 설정 파일
# ~/.zshrc         — 인터랙티브 셸 설정
```

Zsh의 진짜 힘은 **Oh My Zsh** 같은 플러그인 프레임워크에서 나온다. `zsh-autosuggestions`(이전 명령어 기반 회색 제안)와 `zsh-syntax-highlighting`(입력 중 문법 색상)을 설치하면 경험이 크게 달라진다.

```bash
# Oh My Zsh 플러그인 활성화 (~/.zshrc)
plugins=(git docker kubectl zsh-autosuggestions zsh-syntax-highlighting)

# 재귀 glob (bash에서는 안 됨)
ls **/*.md    # 현재 디렉터리 아래 모든 .md 파일

# 확장 glob
ls *(.)       # 일반 파일만
ls *(/)       # 디렉터리만
```

## Fish: 현대적인 셸

**Fish(Friendly Interactive Shell)**는 2005년 등장한 셸로, 설정 없이 바로 쓸 수 있는 경험을 목표로 한다. 역사 기반 자동완성, 문법 강조, 색상 출력이 **기본 내장**이다.

단점은 bash/POSIX와 호환되지 않는 독자적 문법이다. `$(...)` 대신 `(...)`, `$1` 대신 `$argv[1]`, `if`/`fi` 대신 `if`/`end`를 사용한다. 기존 bash 스크립트를 바로 실행할 수 없다.

```bash
# fish 설치
sudo apt install fish

# fish 인터랙티브 구성 (웹 UI)
fish_config

# fish에서 환경 변수 설정 (bash와 다름)
set -x PATH $HOME/bin $PATH

# fish 함수 (독자 문법)
function mkcd
    mkdir -p $argv[1] && cd $argv[1]
end
```

![Bash · Zsh · Fish 비교](/assets/posts/linux-bash-vs-zsh-fish-comparison.svg)

## 문법 차이 직접 비교

![셸 문법 차이 예시](/assets/posts/linux-bash-vs-zsh-fish-syntax.svg)

가장 큰 차이는 Fish다. `if`/`fi` 대신 `if`/`end`, `function`/`}` 대신 `function`/`end`를 쓴다. 배열 인덱스가 1부터 시작하고(bash는 0), 변수 선언도 `set`을 사용한다.

## 어떤 셸을 골라야 하나

**스크립팅**: 반드시 **bash**로 작성하라. 셰뱅 라인에 `#!/bin/bash`를 명시하면 어느 서버에서나 실행된다. 셸 문법 오류는 `shellcheck` 도구로 검사할 수 있다.

**인터랙티브 터미널**: 입문자라면 **fish**가 설정 없이 좋은 경험을 준다. 기존 bash/zsh 경험자라면 **zsh + Oh My Zsh**가 호환성을 유지하면서 생산성을 높인다.

```bash
# 대표적인 조합
# 로그인 셸: zsh (인터랙티브 작업)
# 스크립트: bash (#!/bin/bash)
# 빠른 탐색: fish 임시 실행

# 셸 변경 없이 fish를 잠깐 사용
fish
exit   # 다시 이전 셸로
```

셸 선택은 취향 문제이기도 하다. 이 시리즈의 예제는 어디서나 실행되는 bash를 기준으로 작성된다.

---

**지난 글:** [셸과 터미널의 차이: 무엇이 명령어를 실행하는가](/posts/linux-shell-vs-terminal/)

**다음 글:** [Linux FHS: 디렉터리 구조 완전 정복](/posts/linux-fhs-directory-structure/)

<br>
읽어주셔서 감사합니다. 😊
