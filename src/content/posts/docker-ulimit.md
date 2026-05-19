---
title: "Docker ulimit: 컨테이너 리소스 한도 미세 조정"
description: "nofile·nproc·memlock 등 ulimit 타입별 의미, docker run --ulimit 플래그, Compose ulimits 블록, 데몬 기본값 설정, 실전 문제 시나리오를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 1
type: "knowledge"
category: "Docker"
tags: ["docker", "ulimit", "nofile", "nproc", "memlock", "리소스한도", "컨테이너"]
featured: false
draft: false
---

[지난 글](/posts/docker-resource-limits-cpu-memory/)에서 CPU·메모리 하드 제한을 살펴봤다. 이번에는 운영체제 레벨의 리소스 한도인 ulimit을 Docker에서 어떻게 설정하고, 어떤 상황에서 조정이 필요한지 정리한다.

## ulimit이란

ulimit은 Linux 커널이 프로세스(또는 사용자)에게 허용하는 리소스 양을 제한하는 메커니즘이다. `RLIMIT_*` 계열 syscall로 구현되며, soft limit은 현재 적용 값, hard limit은 soft가 올라갈 수 있는 최댓값이다. 일반 프로세스는 soft를 hard까지 올릴 수 있지만, hard를 초과할 수는 없다.

Docker 컨테이너는 격리된 프로세스 트리이므로 ulimit도 별도로 설정할 수 있다. 단, 컨테이너의 hard limit은 호스트 hard limit을 초과할 수 없다.

![ulimit 주요 타입](/assets/posts/docker-ulimit-types.svg)

## 주요 ulimit 타입

**nofile** — 프로세스가 동시에 열 수 있는 파일 디스크립터 수다. 소켓도 파일 디스크립터로 취급되므로 고성능 네트워크 서버에서 가장 자주 조정한다. 기본값 1024는 nginx, Redis 등을 프로덕션에서 운영하기에 너무 낮다.

**nproc** — 사용자가 생성할 수 있는 프로세스/스레드 수다. 호스트 커널 설정에 종속되며, fork bomb 방지나 스레드 수가 많은 JVM 기반 서비스에서 조정한다.

**memlock** — 스왑 불가능하게 메모리에 잠글 수 있는 양이다. Elasticsearch, Kafka 같은 서비스는 페이지 폴트를 줄이기 위해 `-1`(unlimited)로 설정하기를 권장한다.

**stack** — 스레드 스택 크기다. Java의 `-Xss` 설정과 맞물리며, 재귀가 깊거나 스레드 수가 많은 서비스에서 조정한다.

**core** — 크래시 덤프 파일 최대 크기다. 기본값 0은 코어 덤프를 비활성화한다. 프로덕션 디버깅이 필요하면 unlimited로 변경한다.

## docker run에서 설정

```bash
docker run -d \
  --ulimit nofile=65536:65536 \
  --ulimit nproc=4096:4096 \
  --ulimit memlock=-1:-1 \
  nginx
```

형식은 `타입=soft:hard`다. soft와 hard를 같은 값으로 맞추는 것이 일반적이다. `-1`은 unlimited를 의미한다.

설정 확인은 `docker inspect`로 한다.

```bash
docker inspect <container> \
  --format '{{json .HostConfig.Ulimits}}' | python3 -m json.tool
```

## Compose에서 설정

```yaml
services:
  elasticsearch:
    image: elasticsearch:8.13.0
    ulimits:
      nofile:
        soft: 65536
        hard: 65536
      memlock: -1       # soft=hard=-1 단축 표기
      nproc: 4096
```

단일 값을 쓰면 soft와 hard에 동일하게 적용된다.

## 데몬 기본값 변경

모든 컨테이너에 같은 ulimit을 적용하려면 `/etc/docker/daemon.json`에서 기본값을 바꾼다.

```json
{
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Soft": 65536,
      "Hard": 65536
    }
  }
}
```

변경 후 `sudo systemctl reload docker`로 반영한다. 개별 컨테이너의 `--ulimit`은 데몬 기본값을 덮어쓴다.

![ulimit 설정 방법](/assets/posts/docker-ulimit-code.svg)

## 실전 시나리오

**Elasticsearch 시작 직후 크래시** — `bootstrap checks failed` 오류와 함께 종료된다면 `memlock=unlimited` 또는 `vm.max_map_count` 부족이 원인인 경우가 많다.

```bash
# 호스트에서 vm.max_map_count 확인
sysctl vm.max_map_count
# 262144 미만이면
sudo sysctl -w vm.max_map_count=262144
```

```yaml
services:
  elasticsearch:
    ulimits:
      memlock: -1
      nofile:
        soft: 65536
        hard: 65536
    environment:
      - bootstrap.memory_lock=true
```

**nginx "too many open files"** — `nofile`을 높여야 한다.

```bash
docker run -d --ulimit nofile=65536:65536 nginx
```

**Java OOM이 아닌 `OutOfMemoryError: unable to create native thread`** — `nproc`이 너무 낮아 스레드를 더 만들지 못하는 것이다. `nproc=65536:65536`으로 늘린다.

## 컨테이너 내부에서 현재 ulimit 확인

```bash
# 컨테이너 셸에서
ulimit -a
ulimit -n     # nofile
ulimit -u     # nproc
ulimit -l     # memlock (KB)
```

`/proc/self/limits` 파일에서도 hard/soft 모두 확인할 수 있다.

```bash
cat /proc/self/limits
```

## 주의사항

- 컨테이너의 hard limit은 호스트의 hard limit을 초과할 수 없다. 호스트 자체의 `nofile` hard limit이 낮으면 컨테이너에서도 높일 수 없다.
- `nproc` hard limit은 호스트 커널 `pid_max`에도 영향을 받는다.
- `memlock=-1`은 컨테이너가 호스트 물리 메모리를 모두 잠글 수 있는 권한을 준다. 신뢰할 수 없는 이미지에는 사용하지 않는다.
- Docker Desktop(macOS/Windows)에서는 LinuxKit VM의 ulimit이 적용되므로 Linux 호스트와 동작이 다를 수 있다.

---

**지난 글:** [Docker 리소스 제한: CPU·메모리 완전 정복](/posts/docker-resource-limits-cpu-memory/)

**다음 글:** [Docker 컨테이너 우아한 종료: SIGTERM과 stop 완전 정복](/posts/docker-stop-graceful/)

<br>
읽어주셔서 감사합니다. 😊
