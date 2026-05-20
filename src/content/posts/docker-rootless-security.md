---
title: "Docker Rootless Mode: daemon 자체를 비루트로 실행"
description: "Docker daemon을 일반 사용자 권한으로 실행하는 Rootless Mode의 보안 이점, User Namespace 매핑 원리, 설치 및 설정 방법, 제약사항 해결법, Rootless와 비루트 컨테이너의 차이를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 9
type: "knowledge"
category: "Docker"
tags: ["docker", "security", "rootless", "user-namespace", "daemon", "보안"]
featured: false
draft: false
---

[지난 글](/posts/docker-apparmor-selinux/)에서 AppArmor와 SELinux로 MAC을 적용하는 방법을 다뤘다. 이번에는 **Docker daemon 자체를 비루트 사용자로 실행하는 Rootless Mode**를 살펴본다. 이전 글들에서 다룬 비루트 컨테이너(`USER` 지시어)와는 다른 개념이다.

## Rootful과 Rootless의 차이

```bash
# Rootful (기존 방식)
ps aux | grep dockerd
# root  xxx  dockerd --host=unix:///var/run/docker.sock
# ↑ daemon이 root로 실행

# Rootless
ps aux | grep dockerd
# user1 xxx  dockerd --host=unix:///run/user/1000/docker.sock
# ↑ daemon이 일반 사용자로 실행
```

Rootful 방식에서 `/var/run/docker.sock`에 접근할 수 있으면 사실상 호스트 root 권한을 얻는다. CI/CD 봇, 악성 컨테이너, 내부 공격자 등 누군가 이 소켓을 탈취하면 전체 호스트가 위험해진다.

Rootless Mode는 daemon을 일반 사용자 권한으로 실행해 이 취약점을 제거한다.

![Rootful vs Rootless Docker 아키텍처](/assets/posts/docker-rootless-security-arch.svg)

## User Namespace 매핑

Rootless의 핵심 메커니즘은 **User Namespace**다. 컨테이너 내부의 UID와 호스트의 UID를 다르게 매핑한다.

```bash
# 컨테이너 내부에서 본 PID 1의 UID
docker exec mycontainer id
# uid=0(root) gid=0(root)

# 호스트에서 본 같은 프로세스의 UID
ps aux | grep mycontainer-pid
# user1  100000  ... ← 호스트에서는 UID 100000 (비특권)

# UID 매핑 확인
cat /proc/self/uid_map
# 0  100000  65536
# (컨테이너 UID 0 = 호스트 UID 100000)
# (컨테이너 UID 1 = 호스트 UID 100001, ...)
```

컨테이너 안에서는 root처럼 보이지만 호스트에서는 비특권 UID다. 컨테이너 탈출에 성공해도 공격자는 일반 사용자 권한만 갖는다.

## 설치

```bash
# 전제 조건 확인
cat /proc/sys/kernel/unprivileged_userns_clone
# → 1 (0이면 sudo sysctl -w kernel.unprivileged_userns_clone=1)

# uidmap 패키지 설치 (Ubuntu/Debian)
sudo apt-get install -y uidmap

# 서브UID/GID 범위 확인
cat /etc/subuid
# user1:100000:65536

# 범위가 없으면 추가
sudo usermod --add-subuids 100000-165535 user1
sudo usermod --add-subgids 100000-165535 user1
```

![Rootless Docker 설치 및 설정](/assets/posts/docker-rootless-security-setup.svg)

```bash
# rootless 설치 (일반 사용자로 실행)
dockerd-rootless-setuptool.sh install

# 설치 성공 메시지 예시
# [INFO] Creating /home/user1/.config/systemd/user/docker.service
# [INFO] Installed docker.service successfully.

# 서비스 시작
systemctl --user enable --now docker

# DOCKER_HOST 설정 (~/.bashrc에 추가)
export DOCKER_HOST=unix://$XDG_RUNTIME_DIR/docker.sock
```

## 검증

```bash
# rootless 모드 확인
docker info | grep -i rootless
# Security Options:
#   rootless

# 기본 동작 테스트
docker run --rm hello-world

# daemon 프로세스 확인 (root가 아닌 것 확인)
ps aux | grep dockerd
# user1  ... /usr/bin/dockerd  ← root가 아님!

# User Namespace 매핑 확인
docker run --rm alpine sh -c "cat /proc/self/uid_map"
# 0  100000  65536
```

## 제약사항과 해결방법

### 1024 미만 포트 바인딩

```bash
# 기본적으로 비루트는 1024 미만 포트 불가
docker run -p 80:80 nginx
# → Error: bind: permission denied

# 해결 1: 고번호 포트 사용 (권장)
docker run -p 8080:80 nginx

# 해결 2: 저번호 포트 허용 (root 권한 필요)
sudo sysctl -w net.ipv4.ip_unprivileged_port_start=80

# 영구 설정
echo "net.ipv4.ip_unprivileged_port_start=80" | sudo tee -a /etc/sysctl.conf
```

### fuse-overlayfs (일부 커널에서 overlay2 제한)

```bash
# fuse-overlayfs 설치
sudo apt-get install -y fuse-overlayfs

# docker info로 스토리지 드라이버 확인
docker info | grep "Storage Driver"
# → Storage Driver: fuse-overlayfs
```

### cgroup v2 권장

메모리 제한(`--memory`)과 CPU 제한을 Rootless에서 정상 작동시키려면 cgroup v2가 필요하다.

```bash
# cgroup v2 확인
cat /sys/fs/cgroup/cgroup.controllers
# → cpuset cpu io memory hugetlb pids rdma misc

# GRUB에서 cgroup v2 활성화 (재부팅 필요)
sudo sed -i 's/GRUB_CMDLINE_LINUX="/GRUB_CMDLINE_LINUX="systemd.unified_cgroup_hierarchy=1 /' /etc/default/grub
sudo update-grub
```

## Rootless vs Rootful 선택 기준

| 상황 | 권장 |
|------|------|
| 개발 환경 | Rootless |
| CI/CD 빌드 서버 | Rootless |
| 고포트(8080+) 서비스 | Rootless |
| 80/443 포트 서비스 | Rootful + cap-drop |
| --privileged 필요 | Rootful (불가피한 경우) |
| 멀티 테넌트 환경 | Rootless (강력 권장) |

## Rootless 모드와 비루트 컨테이너 조합

가장 안전한 조합은 Rootless daemon + 비루트 컨테이너다.

```dockerfile
# Rootless daemon 위에서 비루트 컨테이너 실행
FROM node:20-alpine
RUN addgroup -S app && adduser -S app -G app
USER app
WORKDIR /app
COPY --chown=app:app . .
CMD ["node", "server.js"]
```

```bash
# Rootless daemon으로 실행
# DOCKER_HOST 설정 후
docker run \
  --cap-drop=ALL \
  --read-only \
  --security-opt=no-new-privileges \
  myapp:latest
```

컨테이너가 침해되어도:
1. 컨테이너 내 권한은 비루트 `app` 사용자
2. 설령 컨테이너를 탈출해도 Rootless daemon이 일반 사용자
3. 호스트의 다른 파일에 접근 불가

## 기존 설치 제거

```bash
# rootless 제거
dockerd-rootless-setuptool.sh uninstall
systemctl --user stop docker
```

---

**지난 글:** [Docker AppArmor/SELinux: 강제 접근 제어 적용](/posts/docker-apparmor-selinux/)

**다음 글:** [Docker 이미지 크기 줄이기: 경량 이미지 최적화 전략](/posts/docker-image-size-reduction/)

<br>
읽어주셔서 감사합니다. 😊
