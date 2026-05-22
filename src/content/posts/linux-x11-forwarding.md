---
title: "X11 포워딩 — SSH로 원격 서버의 GUI 앱 실행하기"
description: "X11 포워딩의 작동 원리, sshd_config 설정, -X vs -Y 차이, macOS/Windows 클라이언트 설정, 보안 고려사항을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 7
type: "knowledge"
category: "Linux"
tags: ["linux", "x11", "ssh", "x11-forwarding", "xquartz", "vcxsrv", "remote-gui", "display"]
featured: false
draft: false
---

[지난 글](/posts/linux-mosh/)에서 mosh로 불안정한 네트워크에서도 SSH 세션을 유지하는 방법을 살펴봤습니다. SSH는 셸 접속 외에도 **원격 서버의 GUI 애플리케이션을 로컬 화면에 표시**하는 기능을 제공합니다. X11 포워딩이 그것입니다. Wireshark, gedit, IntelliJ 같은 GUI 도구를 서버에 설치하고 로컬에서 사용할 수 있습니다.

## X Window System 기초

Linux의 GUI 시스템인 X Window System(X11)은 **클라이언트-서버 모델**을 사용합니다. 이름이 다소 반직관적인데:

- **X Server**: 화면 출력과 입력 장치를 담당하는 쪽 — 즉 *내 로컬 머신*
- **X Client**: GUI 앱 — 즉 *원격 서버에서 실행되는 프로그램*

원격 서버의 GUI 앱(X Client)이 "창을 그려라"는 명령을 내 로컬의 X Server로 전달하고, X Server가 실제로 화면에 그립니다. SSH는 이 X11 트래픽을 암호화된 채널로 전달합니다.

![X11 포워딩 아키텍처](/assets/posts/linux-x11-forwarding-arch.svg)

## 서버 설정

X11 포워딩을 허용하려면 서버의 `sshd_config`에 설정이 필요합니다.

```bash
# /etc/ssh/sshd_config
X11Forwarding yes
X11UseLocalhost yes

# 설정 적용
sudo systemctl restart sshd

# xauth 패키지 필요 (쿠키 기반 인증)
sudo apt install xauth
```

## -X vs -Y: 신뢰 수준 선택

SSH 클라이언트에서 X11 포워딩을 활성화하는 옵션이 두 가지입니다.

```bash
# -X: 신뢰 안 함 (untrusted) — 보안 강함, 일부 앱 제한
ssh -X user@server

# -Y: 신뢰 (trusted) — 제약 없음, 더 많은 앱과 호환
ssh -Y user@server
```

`-X`는 X Security Extension으로 앱이 할 수 있는 일을 제한합니다. 악의적인 앱이 다른 창의 내용을 캡처하는 것을 막습니다. `-Y`는 이 제한을 없애서 더 많은 앱이 동작하지만 보안은 약해집니다. 신뢰할 수 있는 서버라면 `-Y`를 써도 무방합니다.

## 클라이언트 플랫폼별 설정

**Linux**: 로컬에 X Server가 이미 실행 중이므로 별도 설치 없이 `ssh -X` 바로 사용 가능.

**macOS**: [XQuartz](https://www.xquartz.org/)를 설치해야 합니다.
```bash
brew install --cask xquartz
# 설치 후 로그아웃/로그인
```

**Windows**: VcXsrv나 MobaXterm을 사용합니다. WSL2 환경에서는 WSLg가 X Server 역할을 내장 제공합니다.

![X11 포워딩 설정 체크리스트](/assets/posts/linux-x11-forwarding-setup.svg)

## 연결 및 테스트

```bash
# 접속
ssh -X user@devserver

# 테스트: xeyes (로컬 화면에 눈이 그려지면 성공)
xeyes &

# 실용 앱 예시
wireshark &      # 패킷 분석
gedit file.txt & # 텍스트 편집
gitk &           # git 히스토리 시각화
```

`&`로 백그라운드 실행해야 셸 프롬프트를 계속 쓸 수 있습니다.

## DISPLAY 변수 확인

X11 포워딩이 되면 환경 변수 `DISPLAY`가 자동으로 설정됩니다.

```bash
# 포워딩 활성 시 자동 설정
echo $DISPLAY
# localhost:10.0 같은 값 출력

# DISPLAY가 없으면 X11 포워딩 안 됨
# 수동 설정 (직접 연결된 경우)
export DISPLAY=:0
```

## 성능 최적화

X11 포워딩은 네트워크 지연에 취약합니다. 원격지가 멀다면 느릴 수 있습니다.

```bash
# 압축 활성화
ssh -XC user@server

# ~/.ssh/config에서 영구 설정
Host devserver
    ForwardX11 yes
    Compression yes
    ForwardX11Timeout 1h
```

## 대안: VNC와 비교

X11 포워딩이 앱 단위로 창을 전달하는 방식이라면, **VNC**는 서버의 전체 데스크탑을 스트리밍합니다. 데스크탑 환경 전체가 필요하면 VNC, 특정 GUI 앱 몇 개만 사용하면 X11 포워딩이 더 가볍습니다.

---

**지난 글:** [mosh — 불안정한 네트워크에서의 SSH 대안](/posts/linux-mosh/)

**다음 글:** [SELinux 기초 — 강제 접근 제어 입문](/posts/linux-selinux-basics/)

<br>
읽어주셔서 감사합니다. 😊
