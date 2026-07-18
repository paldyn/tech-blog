---
title: "Docker No space left on device 에러 해결"
description: "Docker 빌드·실행 중 발생하는 디스크 부족 에러의 원인을 파악하고, system prune부터 로그 크기 제한까지 단계별 해결 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 2
type: "knowledge"
category: "Docker"
tags: ["docker", "no-space-left", "system-prune", "disk-cleanup", "트러블슈팅"]
featured: false
draft: false
---

[지난 글](/posts/docker-permission-denied/)에서 소켓 권한 에러를 해결했다. 이번에는 Docker를 오래 사용하다 보면 반드시 마주치는 **디스크 부족** 에러를 다룬다. `docker build`나 `docker run` 중에 갑자기 "No space left on device"가 뜨면 당황하기 쉽다. 원인을 알면 금방 해결된다.

## 에러 메시지 패턴

```text
Error response from daemon: write /var/lib/docker/overlay2/.../work/work:
no space left on device

ERROR: failed to solve: error writing layer:
no space left on device
```

빌드 중, 컨테이너 실행 중, 볼륨 마운트 중 등 다양한 상황에서 나타난다. 공통 원인은 하나다: Docker가 사용하는 디렉터리(`/var/lib/docker`)가 속한 파티션의 디스크가 가득 찼다.

## 현황 파악 먼저

```bash
# 시스템 전체 디스크 사용량
df -h /var/lib/docker

# Docker 리소스별 사용량
docker system df

# 상세 목록 (이미지·컨테이너·볼륨 개별)
docker system df -v
```

`docker system df` 출력에서 **RECLAIMABLE** 열을 보면 안전하게 회수 가능한 공간이 얼마인지 알 수 있다.

![디스크 공간 점유 구조](/assets/posts/docker-no-space-left-causes.svg)

## 무엇이 공간을 차지하나

Docker는 크게 네 가지 리소스가 디스크를 차지한다.

**이미지**: `docker pull`과 `docker build`로 쌓인다. 특히 같은 이미지를 여러 버전으로 받거나 태그 없는 *dangling 이미지*가 누적되면 수십 GB가 된다.

**컨테이너**: 정지된 컨테이너는 삭제하지 않으면 레이어 데이터가 남는다. `--rm` 없이 `docker run`하고 방치하면 금방 쌓인다.

**볼륨**: named 볼륨 중 사용하는 컨테이너가 없어도 자동 삭제되지 않는다. DB 볼륨이 계속 자라기도 한다.

**빌드 캐시**: BuildKit이 레이어 캐시를 쌓는다. 반복 빌드 환경에서 수 GB씩 누적된다.

## 로그 파일이 무한 증가하는 경우

```bash
# 컨테이너별 로그 크기 확인
du -sh /var/lib/docker/containers/*/*-json.log | sort -rh | head -10

# 실행 중인 컨테이너의 로그 경로
docker inspect --format='{{.LogPath}}' <컨테이너명>
```

`--log-opt max-size`를 지정하지 않으면 로그가 무한정 쌓인다. 오래 운영된 서버에서 로그만 수십 GB인 경우도 있다.

## 단계별 정리

![단계별 정리 전략](/assets/posts/docker-no-space-left-cleanup.svg)

### STEP 1: 정지된 컨테이너 제거

```bash
# 정지된 컨테이너 목록 확인
docker ps -a --filter "status=exited"

# 전부 삭제
docker container prune -f
```

실행 중인 컨테이너는 건드리지 않으므로 안전하다.

### STEP 2: dangling 이미지 제거

```bash
# dangling 이미지 목록 (태그 없는 이미지)
docker images -f "dangling=true"

# 삭제
docker image prune -f
```

### STEP 3: 사용하지 않는 이미지 제거

```bash
# 실행 중인 컨테이너에서 사용하지 않는 이미지 모두 삭제
docker image prune -a -f

# 특정 기간 이전 이미지만 삭제
docker image prune -a --filter "until=72h" -f
```

### STEP 4: 빌드 캐시 정리

```bash
# 빌드 캐시 전체 삭제
docker builder prune -f

# 7일 이전 캐시만 삭제
docker builder prune --filter "until=168h" -f
```

### 한 번에 전체 정리

```bash
# 볼륨 제외 전체 정리 (안전)
docker system prune -f

# 볼륨 포함 전체 정리 (데이터 삭제 위험!)
docker system prune --volumes -f
```

`--volumes` 플래그는 named 볼륨도 삭제하므로 **DB 데이터 등이 담긴 볼륨이 있다면 반드시 백업** 후 실행한다.

## 로그 크기 제한 설정

```json
// /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
```

```bash
# 설정 적용
sudo systemctl restart docker
```

이 설정은 이후 **새로 생성되는 컨테이너**에만 적용된다. 기존 컨테이너 로그는 직접 정리해야 한다.

## Docker Desktop 디스크 크기 조정 (macOS/Windows)

Docker Desktop을 쓰는 경우 VM 디스크 이미지 크기가 제한되어 있다.

```text
Docker Desktop → Settings → Resources → Disk image size
```

기본값(64GB)이 꽉 찼다면 크기를 늘리거나 `docker system prune`으로 공간을 회수한다. 실제 호스트 디스크가 아니라 VM 이미지 내부 공간이 부족한 것임을 인식해야 한다.

## 예방: 자동 정리 스크립트

```bash
#!/bin/bash
# /etc/cron.weekly/docker-cleanup
docker system prune -f
docker builder prune --filter "until=168h" -f
```

```bash
chmod +x /etc/cron.weekly/docker-cleanup
```

주 1회 자동으로 불필요한 리소스를 정리하면 디스크가 가득 차는 상황을 예방할 수 있다.

---

**지난 글:** [Docker Permission Denied 에러 완전 해결 가이드](/posts/docker-permission-denied/)

**다음 글:** [Docker Hub 이미지 Pull Rate Limit 해결](/posts/docker-image-pull-rate-limit/)

<br>
읽어주셔서 감사합니다. 😊
