---
title: "mosh — 불안정한 네트워크에서의 SSH 대안"
description: "mosh의 SSP 프로토콜 원리, 로컬 에코 예측, IP 변경 자동 재연결 동작 방식과 설치·방화벽 설정을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["linux", "mosh", "ssh", "mobile-shell", "udp", "ssp", "remote-access", "network"]
featured: false
draft: false
---

[지난 글](/posts/linux-screen-tmux/)에서 tmux와 screen으로 SSH 세션이 끊겨도 프로세스를 유지하는 방법을 살펴봤습니다. tmux가 세션 유지를 담당한다면, **mosh(Mobile Shell)**는 한 걸음 더 나아가 연결 자체가 끊기지 않도록 합니다. 이동 중 Wi-Fi 전환, LTE↔Wi-Fi 전환, 노트북을 닫았다 열기 — 이런 상황에서도 셸 세션이 살아 있습니다.

## mosh의 핵심 아이디어

SSH는 TCP 연결 위에서 동작합니다. TCP는 연결 지향 프로토콜이라 IP가 바뀌거나 연결이 일정 시간 끊기면 세션이 소멸합니다. mosh는 이 문제를 **UDP + SSP(State Synchronization Protocol)**로 해결합니다.

mosh의 동작 순서:
1. SSH로 서버에 접속해 `mosh-server`를 시작하고 인증을 처리
2. SSH 연결을 닫고 **UDP**로 전환 (기본 포트: 60001~60010)
3. 이후 UDP 패킷으로 화면 diff만 교환

UDP는 신뢰적이지 않지만, mosh는 화면 **현재 상태**를 동기화하기 때문에 패킷이 유실되거나 순서가 바뀌어도 괜찮습니다. 어차피 최신 상태로 덮어씁니다.

![mosh vs SSH 비교](/assets/posts/linux-mosh-vs-ssh.svg)

## 로컬 에코 예측

mosh의 또 다른 특징은 **로컬 에코 예측**입니다. 일반 SSH에서는 키를 누르면 서버 응답이 돌아올 때까지 기다려야 화면에 보입니다. 위성 인터넷처럼 지연이 600ms 이상인 환경에서는 타이핑이 답답하게 느껴집니다.

mosh는 클라이언트가 입력을 즉시 화면에 표시합니다(로컬 에코). 서버 응답이 오면 예측이 맞으면 확정하고, 틀리면 화면을 수정합니다. 예측값은 밑줄로 표시되므로 "아직 확인 중"임을 알 수 있습니다.

![mosh SSP 동작 원리](/assets/posts/linux-mosh-ssp.svg)

## 설치와 방화벽 설정

mosh는 클라이언트와 서버 양쪽에 설치해야 합니다.

```bash
# Ubuntu/Debian
sudo apt install mosh

# CentOS/RHEL
sudo dnf install mosh

# macOS (Homebrew)
brew install mosh
```

방화벽에서 UDP 포트를 열어야 합니다.

```bash
# UFW 사용 시
sudo ufw allow 60000:60010/udp

# firewalld 사용 시
sudo firewall-cmd --permanent --add-port=60001-60010/udp
sudo firewall-cmd --reload

# iptables 직접
sudo iptables -A INPUT -p udp --dport 60001:60010 -j ACCEPT
```

## 접속 방법

```bash
# 기본 접속 (SSH 키 자동 사용)
mosh user@server

# 비표준 SSH 포트
mosh --ssh="ssh -p 2222" user@server

# tmux와 함께 사용 (권장)
mosh user@server -- tmux new -A -s main
```

`mosh ... -- tmux new -A -s main` 패턴이 강력합니다. mosh가 IP 변경에도 연결을 유지하고, tmux가 세션을 보존합니다. 두 도구의 강점을 결합한 최적 패턴입니다.

## mosh의 한계

**포트 포워딩 불가**: mosh는 셸 접속 전용입니다. `-L`, `-R`, `-D` 같은 SSH 포트 포워딩이 필요하면 SSH를 병행 사용해야 합니다.

**방화벽 통과 어려움**: UDP 60001-60010이 막힌 엄격한 방화벽 환경(기업 네트워크 등)에서는 사용할 수 없습니다. 이 경우 SSH + tmux 조합이 대안입니다.

**스크롤백 제한**: 기본 스크롤백이 SSH+tmux에 비해 제한적입니다. tmux를 병용하면 해결됩니다.

**서버 설치 필요**: 서버에도 mosh-server가 있어야 합니다. 접근 권한이 없는 서버에는 사용 불가입니다.

## 언제 쓸까

노트북을 들고 다니거나 모바일 네트워크 환경에서 서버 작업을 하는 경우, 또는 고지연 환경(해외 서버, 위성 인터넷)에서 타이핑 반응이 느린 게 불편할 때 mosh가 즉각적인 해결책이 됩니다. 방화벽 제약이 없는 환경이라면 `mosh + tmux` 조합을 기본으로 쓰는 것을 권장합니다.

---

**지난 글:** [screen & tmux — 터미널 멀티플렉서 완전 정리](/posts/linux-screen-tmux/)

**다음 글:** [X11 포워딩 — SSH로 GUI 앱 원격 실행](/posts/linux-x11-forwarding/)

<br>
읽어주셔서 감사합니다. 😊
