---
title: "Git 설치 가이드: macOS, Windows, Linux"
description: "플랫폼별 Git 설치 방법과 설치 후 환경 점검 방법을 정리한다. Homebrew, winget, apt 등 각 환경의 권장 방법을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 4
type: "knowledge"
category: "Git"
tags: ["Git", "설치", "macOS", "Windows", "Linux"]
featured: false
draft: false
---

[지난 글](/posts/git-history/)에서 Git이 어떻게 탄생했는지 살펴봤다. 이제 실제로 Git을 사용할 차례다. 플랫폼별로 권장하는 설치 방법과 설치 후 확인 단계를 정리한다.

## macOS

macOS에는 Apple Git이 기본으로 설치되어 있지만, 버전이 구식인 경우가 많다. Homebrew를 통해 최신 버전을 설치하는 것을 권장한다.

```bash
# Homebrew가 없다면 먼저 설치
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Git 설치 (또는 업데이트)
brew install git

# Apple Git이 아닌 Homebrew Git이 우선순위를 갖도록 확인
which git    # /usr/local/bin/git 또는 /opt/homebrew/bin/git 이어야 함
git --version
```

Homebrew를 사용하지 않는 경우, Xcode Command Line Tools를 설치하면 Git이 함께 포함된다.

```bash
xcode-select --install
```

macOS Ventura 이상에서는 다음과 같이 Rosetta 없이 ARM(Apple Silicon) 네이티브 Git이 설치된다.

```bash
arch -arm64 brew install git   # M1/M2/M3 Mac에서 명시적으로 ARM 빌드 설치
```

## Windows

Windows 환경에서는 **Git for Windows**가 표준이다. Git Bash(Unix 환경 에뮬레이션)와 Git GUI가 함께 제공된다.

```powershell
# winget 사용 (Windows 10 1809 이상에서 기본 제공)
winget install --id Git.Git -e --source winget

# 또는 Chocolatey 사용
choco install git

# 설치 후 확인 (Git Bash 또는 PowerShell에서)
git --version
```

공식 설치 파일은 [git-scm.com/download/win](https://git-scm.com/download/win)에서 다운로드할 수 있다. 설치 옵션 중 중요한 것들이 있다.

- **Default editor**: VS Code나 Vim 중 선택
- **Initial branch name**: `main`으로 설정 권장 (GitHub 기본과 일치)
- **PATH environment**: "Git from the command line and also from 3rd-party software" 선택
- **Line ending**: `Checkout Windows-style, commit Unix-style` 권장

**WSL2를 사용하는 경우**, WSL 내부에서 Linux 방식으로 Git을 설치하는 것이 더 자연스럽다.

```bash
# WSL2 Ubuntu 내부에서
sudo apt update && sudo apt install git
```

![플랫폼별 설치 방법](/assets/posts/git-install-platforms.svg)

## Linux

대부분의 Linux 배포판에는 패키지 매니저로 간단히 설치할 수 있다.

```bash
# Debian / Ubuntu / 파생 배포판
sudo apt update
sudo apt install git

# Fedora / RHEL 8+
sudo dnf install git

# Arch Linux
sudo pacman -S git

# openSUSE
sudo zypper install git
```

패키지 매니저의 Git은 최신 버전이 아닐 수 있다. 최신 버전이 필요하다면 PPA(Ubuntu) 또는 소스 빌드를 사용한다.

```bash
# Ubuntu에서 최신 Git (PPA)
sudo add-apt-repository ppa:git-core/ppa
sudo apt update
sudo apt install git
```

## 설치 확인

어떤 플랫폼이든 설치 후 반드시 확인한다.

```bash
git --version          # git version 2.47.0 같은 출력이 나오면 성공
git help               # 기본 명령어 목록 확인
```

![설치 후 확인 단계](/assets/posts/git-install-verify.svg)

버전 2.x.x 이상이면 이 시리즈의 모든 예제를 실행할 수 있다. 일부 고급 기능(Partial Clone, Sparse Checkout, Worktree 등)은 2.36 이상을 권장한다.

## GUI 도구

커맨드라인이 불편하다면 GUI 클라이언트를 함께 사용할 수 있다. 그러나 Git의 동작 원리를 이해하려면 CLI를 먼저 익히는 것이 중요하다.

- **GitHub Desktop**: GitHub 워크플로에 최적화, 무료
- **SourceTree**: Atlassian 제품, 무료
- **GitKraken**: 시각화에 강점, 일부 기능 유료
- **Tower**: macOS/Windows, 유료, 가장 완성도 높음
- **VS Code 내장 Git**: 에디터와 통합, 기본 작업에 충분

설치를 마쳤다면 다음 단계는 Git에게 자신을 소개하는 전역 설정이다. 이름과 이메일을 설정하지 않으면 첫 커밋부터 오류를 만나게 된다.

---

**지난 글:** [Git의 탄생과 역사](/posts/git-history/)

**다음 글:** [Git 전역 설정](/posts/git-config-global/)

<br>
읽어주셔서 감사합니다. 😊
