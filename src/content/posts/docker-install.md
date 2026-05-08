---
title: "Docker 설치 완전 가이드 — Linux · macOS · Windows"
description: "Ubuntu, RHEL, macOS, Windows 각 플랫폼에서 Docker를 올바르게 설치하고, 설치 후 반드시 해야 할 설정과 검증 방법을 단계별로 안내합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 7
type: "knowledge"
category: "Docker"
tags: ["Docker", "설치", "Ubuntu", "macOS", "Windows", "Docker Desktop"]
featured: false
draft: false
---

[지난 글](/posts/docker-cli-overview/)에서 Docker CLI의 전체 명령어 체계를 살펴봤습니다. 이제 실제로 Docker를 설치할 차례입니다. 플랫폼마다 방법이 다르고 주의할 점도 다릅니다. 특히 리눅스에서 `apt install docker.io`로 설치하면 구버전이 설치되는 함정이 있으니 주의가 필요합니다.

## 설치 전 확인: 올바른 설치 소스

Ubuntu의 기본 패키지 저장소에는 `docker.io`라는 패키지가 있습니다. 이것은 **Canonical이 따로 패키징한 구버전**입니다. Docker 공식 저장소에서 `docker-ce`를 설치해야 최신 버전을 사용할 수 있습니다.

![Docker 설치 방법 비교](/assets/posts/docker-install-methods.svg)

## Linux (Ubuntu/Debian) — 공식 저장소 사용

```bash
# 1. 기존 비공식 패키지 제거
sudo apt-get remove docker docker-engine docker.io containerd runc

# 2. 필수 패키지 설치
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg

# 3. Docker 공식 GPG 키 추가
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# 4. 저장소 추가
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 5. 설치
sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

## Linux (RHEL/CentOS/Fedora)

```bash
# dnf 사용 (RHEL 8+, CentOS Stream 8+, Fedora)
sudo dnf -y install dnf-plugins-core
sudo dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
sudo dnf install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo systemctl start docker
sudo systemctl enable docker
```

## Linux — convenience script (테스트 환경용)

빠른 설치가 필요한 테스트/CI 환경에서는 공식 스크립트를 사용할 수 있습니다. **프로덕션 서버에는 권장하지 않습니다.**

```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

## macOS

macOS에서는 Linux 커널이 없기 때문에 Docker Engine을 직접 실행할 수 없습니다. Docker Desktop이 내부적으로 경량 Linux VM을 띄워 그 위에서 Docker를 실행합니다.

```bash
# 방법 1: Docker Desktop (공식, GUI 포함)
# https://www.docker.com/products/docker-desktop 에서 .dmg 다운로드

# 방법 2: Homebrew
brew install --cask docker

# 방법 3: Colima (오픈소스, 경량)
brew install colima docker docker-compose
colima start
```

Apple Silicon(M1/M2/M3)에서 `--platform linux/amd64` 이미지를 실행할 때 Rosetta 에뮬레이션이 필요하며 성능이 다소 낮을 수 있습니다.

## Windows

Windows에서도 Docker Desktop이 WSL 2(Windows Subsystem for Linux 2) 위에서 Linux 컨테이너를 실행합니다.

```powershell
# WSL 2 활성화 (관리자 PowerShell)
wsl --install
wsl --set-default-version 2

# Docker Desktop 설치
# https://www.docker.com/products/docker-desktop 에서 .exe 다운로드
```

WSL 2 통합을 활성화하면 WSL 2 Linux 환경에서도 `docker` 명령어를 바로 사용할 수 있습니다.

## 설치 후 반드시 할 일 (Linux)

```bash
# 1. docker 그룹에 사용자 추가 (sudo 없이 docker 사용)
sudo usermod -aG docker $USER

# 변경사항 즉시 적용 (재로그인 없이)
newgrp docker

# 2. 부팅 시 자동 시작
sudo systemctl enable docker.service
sudo systemctl enable containerd.service

# 3. 설치 확인
docker run hello-world
```

![Docker 설치 후 검증 단계](/assets/posts/docker-install-verify.svg)

## 설치 확인

```bash
# 버전 확인
docker --version
docker compose version

# 상세 시스템 정보
docker info

# hello-world 컨테이너 실행
docker run hello-world
# "Hello from Docker!" 메시지가 나오면 성공
```

## UFW(방화벽)와의 충돌 주의

Ubuntu에서 UFW를 사용하는 경우, Docker가 iptables를 직접 조작하기 때문에 UFW 규칙이 무력화될 수 있습니다. `daemon.json`에 다음을 추가하면 Docker의 iptables 직접 조작을 막을 수 있지만 네트워크 기능에 제한이 생깁니다.

```json
{
  "iptables": false
}
```

방화벽 충돌 문제는 상황에 따라 접근 방법이 다르므로, 운영 서버 설정 시 공식 문서를 참고하는 것을 권장합니다.

## 버전 고정 (프로덕션)

프로덕션 환경에서는 특정 버전을 고정해서 의도치 않은 업그레이드를 방지합니다.

```bash
# 설치 가능한 버전 목록 확인
apt-cache madison docker-ce

# 특정 버전 설치
sudo apt-get install docker-ce=5:27.0.0-1~ubuntu.22.04~jammy

# 버전 고정 (apt-mark)
sudo apt-mark hold docker-ce docker-ce-cli containerd.io
```

## 정리

리눅스에서는 반드시 Docker 공식 APT/DNF 저장소를 사용해야 최신 버전을 안정적으로 받을 수 있습니다. macOS와 Windows는 Docker Desktop이 가장 편리하며, 대안으로 Colima(macOS)나 Rancher Desktop을 선택할 수 있습니다. 설치 후에는 `docker` 그룹 추가, systemd 자동 시작 설정, `hello-world` 실행 확인을 반드시 합니다. 다음 글에서는 Docker Desktop과 Docker Engine의 차이를 깊이 비교합니다.

---

**지난 글:** [Docker CLI 완전 가이드](/posts/docker-cli-overview/)

**다음 글:** [Docker Desktop vs Docker Engine — 언제 무엇을 쓸까?](/posts/docker-desktop-vs-engine/)

<br>
읽어주셔서 감사합니다. 😊
