---
title: "Docker Rootless 모드 — root 없이 안전하게 실행하기"
description: "dockerd를 일반 사용자 권한으로 실행하는 Rootless 모드의 원리, 설치 방법, 제한 사항, 그리고 멀티테넌트 환경에서 보안을 강화하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 9
type: "knowledge"
category: "Docker"
tags: ["Docker", "Rootless", "보안", "user namespace", "cgroup v2"]
featured: false
draft: false
---

[지난 글](/posts/docker-desktop-vs-engine/)에서 Docker Desktop과 Docker Engine을 비교했습니다. 이번 글에서는 Docker 보안의 핵심 기능 중 하나인 **Rootless 모드**를 다룹니다. 기본 Docker 설치에서 dockerd는 root 권한으로 실행됩니다. 이는 편리하지만 보안 위협이 됩니다. Rootless 모드는 이 위험을 근본적으로 줄입니다.

## 왜 기본 Docker가 위험한가

기본(root) 모드에서 dockerd는 UID 0(root)으로 실행됩니다. 다음과 같은 위험이 있습니다:

1. **dockerd 취약점 악용**: dockerd에 보안 취약점이 있다면, 공격자는 호스트의 root 권한을 획득할 수 있습니다.
2. **docker.sock 노출**: `/var/run/docker.sock`에 접근할 수 있는 모든 사용자/프로세스는 사실상 root와 같은 권한을 가집니다.
3. **컨테이너 탈출**: 컨테이너 내에서 root로 실행되는 프로세스가 커널 취약점을 이용해 호스트로 탈출하면 호스트 root를 획득합니다.

Rootless 모드는 이 모든 시나리오에서 피해 범위를 **일반 사용자 권한으로 제한**합니다.

![Root 모드 vs Rootless 모드 비교](/assets/posts/docker-rootless-mode-compare.svg)

## Rootless 모드의 원리

Rootless 모드는 Linux **user namespace**를 활용합니다. 컨테이너 내의 root(UID 0)가 실제로는 호스트의 일반 사용자 UID(예: 1000)에 매핑됩니다.

```text
컨테이너 내부          호스트
  UID 0 (root)  →    UID 1000 (alice)
  UID 1 (daemon) →   UID 100001 (subuid 범위)
  UID 65534     →    UID 165534 (subuid 범위)
```

이 매핑 범위는 `/etc/subuid`와 `/etc/subgid` 파일로 정의됩니다.

```bash
# /etc/subuid 확인
cat /etc/subuid
# alice:100000:65536
# → alice는 100000~165535 범위의 서브 UID를 사용 가능
```

## 설치 방법

### 전제 조건 확인

```bash
# kernel 버전 확인 (5.11+ 권장, 4.18+ 최소)
uname -r

# cgroup v2 확인
cat /sys/fs/cgroup/cgroup.controllers
# 출력이 있으면 v2 사용 중

# subuid/subgid 확인
grep $USER /etc/subuid /etc/subgid
```

### Ubuntu에서 설치

```bash
# uidmap 패키지 설치 (root로)
sudo apt-get install -y uidmap dbus-user-session fuse-overlayfs

# rootless 설치 스크립트 실행 (일반 사용자로)
dockerd-rootless-setuptool.sh install
```

![Rootless 모드 설치 및 설정](/assets/posts/docker-rootless-mode-setup.svg)

### 환경 변수 설정

설치 완료 시 안내되는 내용을 `~/.bashrc`에 추가합니다:

```bash
export PATH=/usr/bin:$PATH
export DOCKER_HOST=unix://$XDG_RUNTIME_DIR/docker.sock
```

### systemd 사용자 서비스 등록

```bash
# 사용자 세션 서비스로 등록 및 시작
systemctl --user enable docker
systemctl --user start docker

# 로그인 없이도 서비스 유지 (loginctl)
sudo loginctl enable-linger $USER
```

### 동작 확인

```bash
docker info | grep -i rootless
# rootless: true

# 실행 중인 dockerd의 UID 확인
ps aux | grep dockerd
# alice  1234  ... dockerd  ← root가 아닌 alice로 실행
```

## 주요 제한 사항

### 낮은 포트 바인딩

1024 미만 포트(80, 443 등)를 컨테이너에서 직접 바인드할 수 없습니다.

```bash
# 해결 방법 1: unprivileged 포트 하한선 낮추기 (시스템 설정)
echo 'net.ipv4.ip_unprivileged_port_start=80' | \
  sudo tee /etc/sysctl.d/docker-rootless.conf
sudo sysctl --system

# 해결 방법 2: 높은 포트로 실행 후 포트 포워딩
docker run -p 8080:80 nginx
# iptables/nftables로 80 → 8080 포워딩
```

### 스토리지 드라이버

overlay2 대신 `fuse-overlayfs`를 사용합니다. 성능이 약간 낮지만 Linux 5.11+의 native overlay를 사용하도록 구성하면 성능 차이를 줄일 수 있습니다.

```bash
# 현재 사용 중인 스토리지 드라이버 확인
docker info | grep "Storage Driver"
# Storage Driver: fuse-overlayfs (또는 native-overlayfs)
```

## Root 모드와 Rootless 모드 공존

한 서버에서 root 모드 Docker(systemd 서비스)와 rootless 모드 Docker(사용자 서비스)가 공존할 수 있습니다. `DOCKER_HOST` 환경 변수로 어느 데몬에 연결할지 선택합니다.

```bash
# root 모드 Docker에 연결
export DOCKER_HOST=unix:///var/run/docker.sock

# rootless 모드 Docker에 연결
export DOCKER_HOST=unix://$XDG_RUNTIME_DIR/docker.sock
```

## Rootless 모드 사용을 권장하는 환경

- **공유 개발 서버**: 여러 팀원이 같은 서버를 사용할 때, 각자의 rootless Docker로 격리
- **CI/CD 워커**: 빌드 작업이 호스트 root 권한을 필요로 하지 않아야 할 때
- **보안 강화가 필요한 환경**: 금융, 의료 등 규정 준수가 필요한 환경

## 정리

Rootless 모드는 user namespace를 활용해 dockerd와 컨테이너를 일반 사용자 권한으로 실행합니다. 공격 표면을 크게 줄이지만 낮은 포트 바인딩, 일부 네트워크 기능 제한 등의 트레이드오프가 있습니다. Docker 20.10+에서 안정화됐으며, 보안이 중요한 환경에서 적극 권장됩니다. 다음 글에서는 여러 Docker 호스트나 컨텍스트를 관리하는 `docker context` 기능을 살펴봅니다.

---

**지난 글:** [Docker Desktop vs Docker Engine](/posts/docker-desktop-vs-engine/)

**다음 글:** [Docker Context — 여러 Docker 환경을 손쉽게 전환하기](/posts/docker-context/)

<br>
읽어주셔서 감사합니다. 😊
