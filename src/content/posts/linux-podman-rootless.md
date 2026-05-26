---
title: "Podman 루트리스 컨테이너 — 데몬 없이 안전하게"
description: "Podman의 루트리스(rootless) 컨테이너 동작 원리, Docker 데몬과의 차이, User Namespace·slirp4netns 기반 네트워크, systemd 통합 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["linux", "podman", "rootless", "container", "user-namespace", "slirp4netns", "systemd"]
featured: false
draft: false
---

[지난 글](/posts/linux-runc-detail/)에서 runc가 OCI Bundle을 받아 Linux 커널 기능을 직접 호출하는 과정을 살펴봤습니다. 이번에는 runc 위에서 동작하지만 Docker와 달리 **루트 권한 데몬 없이** 컨테이너를 실행할 수 있는 **Podman**을 다룹니다.

## Docker vs Podman: 데몬 유무

Docker는 항상 `dockerd`라는 루트 권한 데몬이 떠 있어야 합니다. CLI 명령은 Unix 소켓(`/var/run/docker.sock`)을 통해 데몬에 요청을 보내고, 데몬이 실제 컨테이너를 생성합니다. 데몬이 손상되거나 취약점이 생기면 호스트 전체가 위험해집니다.

Podman은 **데몬리스(daemonless)** 설계입니다. `podman` 명령 자체가 직접 `conmon`(컨테이너 모니터 프로세스)과 `runc`를 호출합니다. 별도 데몬 프로세스 없이, 일반 사용자 권한으로 컨테이너를 실행할 수 있습니다.

![Podman 루트리스 아키텍처](/assets/posts/linux-podman-rootless-arch.svg)

## 루트리스 동작 원리: User Namespace

루트리스 컨테이너의 핵심은 **User Namespace(user ns)** 입니다.

```bash
# 호스트에서: alice (UID 1000)
# 컨테이너 안에서: root (UID 0)으로 보임
# 실제 호스트 UID: 100000 (subuid 매핑)
```

`/etc/subuid`와 `/etc/subgid` 파일에 사용자별 UID/GID 범위가 정의됩니다.

```
# /etc/subuid
alice:100000:65536
# alice가 100000~165535 범위의 UID를 user ns 내에서 사용 가능
```

루트리스 모드를 활성화하려면:

```bash
# subuid/subgid 설정 (root가 1회 설정)
sudo usermod --add-subuids 100000-165535 alice
sudo usermod --add-subgids 100000-165535 alice

# 설정 확인
podman unshare cat /proc/self/uid_map
```

## 설치와 첫 실행

```bash
# Ubuntu/Debian
sudo apt install -y podman

# RHEL/Fedora
sudo dnf install -y podman

# 버전 확인
podman version

# 루트 없이 nginx 실행
podman run -d -p 8080:80 --name webserver nginx:alpine
podman ps
curl http://localhost:8080
```

`sudo` 없이 실행됩니다. 이미지는 `~/.local/share/containers/storage/`에 저장됩니다.

![Podman 주요 명령어](/assets/posts/linux-podman-rootless-commands.svg)

## 네트워크: slirp4netns

루트리스 모드에서는 실제 네트워크 인터페이스를 만들 수 없으므로 **slirp4netns**가 사용자 공간 TCP/IP 스택을 제공합니다.

```bash
# 컨테이너가 외부로 나가는 트래픽
# 호스트 → slirp4netns → 컨테이너 eth0

# 1024 미만 포트 바인딩 (rootlessport 사용)
podman run -d -p 80:80 nginx
# 일반 사용자가 80번 포트를 열 수 있음 (커널 net.ipv4.ip_unprivileged_port_start 설정 필요)
```

성능은 루트 네트워크보다 약간 낮지만 대부분의 워크로드에서 차이가 미미합니다.

## 이미지와 레지스트리 설정

```bash
# 레지스트리 우선순위 설정
cat ~/.config/containers/registries.conf
# unqualified-search-registries = ["docker.io", "quay.io"]

# 이미지 검색 (레지스트리 명시 없이)
podman search nginx

# 특정 레지스트리에서 pull
podman pull quay.io/fedora/fedora:latest

# 이미지 빌드 (Dockerfile 호환)
podman build -t myapp:latest .

# 이미지 저장/로드
podman save myapp:latest -o myapp.tar
podman load -i myapp.tar
```

## systemd 통합

Podman은 systemd와 긴밀하게 통합됩니다. 컨테이너를 systemd 사용자 서비스로 자동 시작할 수 있습니다.

```bash
# 실행 중인 컨테이너로부터 systemd 유닛 생성
podman generate systemd --new --name webserver \
  > ~/.config/systemd/user/container-webserver.service

# 서비스 활성화 (로그인 없이 부팅 시 시작)
systemctl --user enable --now container-webserver
loginctl enable-linger alice   # 로그아웃 후에도 유지

# 상태 확인
systemctl --user status container-webserver
journalctl --user -u container-webserver -f
```

Podman 4.x부터는 **Quadlet**(`~/.config/containers/systemd/*.container`) 방식이 권장됩니다. ini 형식으로 컨테이너 정의를 작성하면 systemd가 자동으로 유닛을 생성합니다.

```ini
# ~/.config/containers/systemd/webserver.container
[Container]
Image=nginx:alpine
PublishPort=8080:80
Volume=/srv/html:/usr/share/nginx/html:ro

[Service]
Restart=always

[Install]
WantedBy=default.target
```

## Pod 지원

Podman은 Kubernetes의 Pod 개념을 지원합니다. 같은 pod 내 컨테이너는 네트워크와 IPC를 공유합니다.

```bash
# Pod 생성
podman pod create --name mypod -p 8080:80

# Pod에 컨테이너 추가
podman run -d --pod mypod nginx:alpine
podman run -d --pod mypod --name sidecar alpine sleep 3600

# Pod 상태 확인
podman pod ps
podman pod inspect mypod

# Kubernetes YAML 내보내기
podman generate kube mypod > mypod.yaml
```

## Docker Compose 호환

`podman-compose` 패키지를 설치하면 `docker-compose.yml`을 그대로 사용할 수 있습니다.

```bash
sudo apt install podman-compose  # 또는 pip install podman-compose

podman-compose up -d
podman-compose ps
podman-compose down
```

또는 Docker Compose v2를 `DOCKER_HOST` 환경변수로 Podman 소켓에 연결해 사용할 수도 있습니다.

```bash
# Podman socket 활성화 (사용자 서비스)
systemctl --user enable --now podman.socket

# Docker Compose를 Podman 소켓으로
export DOCKER_HOST="unix://$XDG_RUNTIME_DIR/podman/podman.sock"
docker compose up -d
```

---

**지난 글:** [runc 상세 — OCI Runtime Spec과 컨테이너 생성 원리](/posts/linux-runc-detail/)

**다음 글:** [systemd-nspawn — systemd 내장 컨테이너 런타임](/posts/linux-systemd-nspawn/)

<br>
읽어주셔서 감사합니다. 😊
