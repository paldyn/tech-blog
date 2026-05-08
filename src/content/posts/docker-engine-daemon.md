---
title: "Docker 엔진과 데몬 — dockerd 내부 동작"
description: "dockerd가 어떻게 작동하는지, containerd-shim 구조가 왜 중요한지, daemon.json 설정과 데몬 재시작 시 컨테이너 유지(live-restore)까지 상세히 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 5
type: "knowledge"
category: "Docker"
tags: ["Docker", "dockerd", "containerd-shim", "daemon.json", "live-restore"]
featured: false
draft: false
---

[지난 글](/posts/docker-architecture/)에서 Docker 아키텍처의 큰 그림을 살펴봤습니다. 이번 글에서는 그 중심인 `dockerd` 데몬의 내부 구조와 설정 방법을 깊이 파고듭니다. 특히 `containerd-shim`이 왜 존재하는지, 데몬을 재시작해도 왜 컨테이너가 죽지 않는지를 이해하면 운영 중에 당황하지 않을 수 있습니다.

## dockerd의 역할 분리

Docker Engine은 단일 바이너리가 아니라 여러 프로세스로 나뉩니다.

```bash
# 실행 중인 Docker 관련 프로세스 확인
ps aux | grep -E "dockerd|containerd|docker-proxy"
```

실행 결과에서 보통 세 가지 프로세스를 볼 수 있습니다:

- `dockerd`: Docker 데몬 메인 프로세스
- `containerd`: 컨테이너 런타임 데몬
- `containerd-shim-runc-v2`: 각 컨테이너마다 하나씩 존재하는 shim 프로세스

![Docker Engine 내부 컴포넌트](/assets/posts/docker-engine-daemon-components.svg)

## containerd-shim의 존재 이유

가장 중요하지만 잘 알려지지 않은 개념입니다. `containerd-shim`이 없다면 어떻게 될까요?

containerd가 직접 컨테이너 프로세스의 부모(parent)가 되면, containerd를 재시작할 때마다 모든 자식 컨테이너가 SIGHUP을 받거나 고아 프로세스가 됩니다.

`containerd-shim`은 이 문제를 해결합니다:

1. runc가 컨테이너 프로세스를 시작한 뒤 종료
2. shim이 컨테이너 프로세스의 부모 역할을 넘겨받음
3. shim은 containerd와 독립적으로 실행 — containerd가 죽어도 컨테이너는 살아 있음
4. shim이 컨테이너의 stdin/stdout/stderr를 중계하고 exit code를 회수

```text
containerd ← shim ← Container Process (nginx, app 등)
    |
   재시작해도 shim/컨테이너에 영향 없음
```

## dockerd 설정 파일: daemon.json

`/etc/docker/daemon.json`으로 dockerd 동작을 제어합니다. 파일이 없으면 기본값이 사용됩니다.

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "data-root": "/var/lib/docker",
  "live-restore": true,
  "default-ulimits": {
    "nofile": {
      "Hard": 64000,
      "Name": "nofile",
      "Soft": 64000
    }
  }
}
```

설정 변경 후 적용하는 두 가지 방법:

```bash
# 방법 1: 데몬 완전 재시작 (컨테이너 영향 있음)
sudo systemctl restart docker

# 방법 2: SIGHUP으로 일부 설정 재로드 (컨테이너 영향 없음)
sudo kill -SIGHUP $(cat /var/run/docker.pid)
# 또는
sudo systemctl reload docker
```

SIGHUP으로 재로드할 수 있는 설정은 제한적입니다. 스토리지 드라이버, live-restore는 전체 재시작이 필요합니다.

## live-restore: 데몬 재시작 시 컨테이너 유지

기본적으로 `dockerd`를 재시작하면 실행 중인 컨테이너가 모두 중지됩니다. `live-restore: true`를 설정하면 데몬 재시작 중에도 컨테이너가 계속 실행됩니다.

```json
{
  "live-restore": true
}
```

```bash
# live-restore 설정 확인
docker info | grep "Live Restore"
# Live Restore Enabled: true
```

프로덕션 환경에서 `dockerd` 업그레이드나 설정 변경 시 서비스 중단을 막을 수 있는 중요한 옵션입니다.

![dockerd 소켓 설정 및 관리](/assets/posts/docker-engine-daemon-socket.svg)

## docker.sock — 권한과 보안

`/var/run/docker.sock`은 dockerd와 통신하는 Unix 도메인 소켓입니다. 이 소켓에 접근할 수 있다는 것은 사실상 **root 권한**과 동등합니다. 컨테이너 실행, 이미지 삭제, 호스트 파일시스템 마운트가 모두 가능하기 때문입니다.

```bash
# docker 그룹에 사용자 추가 (재로그인 필요)
sudo usermod -aG docker $USER

# 소켓 권한 확인
ls -la /var/run/docker.sock
# srw-rw---- 1 root docker ...
```

컨테이너 안에서 `docker.sock`을 마운트하는 패턴(Docker-in-Docker 대안)은 편리하지만, 해당 컨테이너가 호스트 전체를 제어할 수 있게 된다는 점을 항상 인지해야 합니다.

## 주요 디렉터리 구조

```bash
/var/lib/docker/
├── containers/     # 컨테이너 메타데이터 및 로그
├── image/          # 이미지 메타데이터
├── overlay2/       # OverlayFS 레이어 실제 데이터
├── volumes/        # named 볼륨 데이터
└── network/        # 네트워크 설정

# dockerd 로그 확인
journalctl -u docker.service --since "1 hour ago"
```

## 데몬 디버그 모드

문제 진단 시 디버그 모드를 켜면 상세 로그가 출력됩니다.

```json
{
  "debug": true
}
```

또는 실행 중 즉시 활성화:

```bash
sudo kill -SIGUSR1 $(pidof dockerd)
```

## 정리

`dockerd`는 API 처리부터 이미지 관리, 네트워크·볼륨 관리까지 담당하고, 실제 컨테이너 실행은 `containerd`에 위임합니다. `containerd-shim` 덕분에 데몬 재시작 시에도 컨테이너가 살아남을 수 있습니다. `daemon.json`으로 로그 드라이버, 스토리지 드라이버, `live-restore` 등을 설정해 운영 환경에 맞게 조정할 수 있습니다. 다음 글에서는 이 모든 것을 실제로 제어하는 Docker CLI의 전체 명령어 구조를 살펴봅니다.

---

**지난 글:** [Docker 아키텍처 완전 이해](/posts/docker-architecture/)

**다음 글:** [Docker CLI 완전 가이드 — 명령어 체계 총정리](/posts/docker-cli-overview/)

<br>
읽어주셔서 감사합니다. 😊
