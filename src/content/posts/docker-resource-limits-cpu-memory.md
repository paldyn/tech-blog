---
title: "Docker 리소스 제한: CPU·메모리 완전 정복"
description: "--cpus·--memory 하드 제한, --cpu-shares 상대 비중, --memory-swap·--memory-reservation 소프트 제한, Compose deploy.resources 선언법, OOM 동작을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 10
type: "knowledge"
category: "Docker"
tags: ["docker", "리소스제한", "cpu", "memory", "cgroup", "OOM", "deploy.resources"]
featured: false
draft: false
---

[지난 글](/posts/docker-restart-policy/)에서 restart 정책을 살펴봤다. 이번에는 컨테이너가 호스트 CPU와 메모리를 얼마나 쓸 수 있는지 제한하는 방법을 정리한다. 제한을 걸지 않으면 단일 컨테이너가 호스트 전체 리소스를 점유할 수 있다.

## 왜 리소스 제한이 필요한가

Docker는 cgroup(Control Group)을 사용해 컨테이너별로 CPU와 메모리 사용을 제한한다. 제한이 없으면 OOM(Out Of Memory)이 발생하거나 다른 컨테이너의 성능이 저하된다. 프로덕션에서는 모든 서비스에 상한을 설정하는 것이 원칙이다.

## CPU 제한

### --cpus (가장 많이 쓰는 옵션)

```bash
docker run -d --cpus=1.5 my-api
```

호스트 4코어 중 1.5코어 분량의 CPU를 사용할 수 있다. 내부적으로 CFS(Completely Fair Scheduler) 쿼터를 설정한다. `--cpu-period`와 `--cpu-quota`로도 같은 효과를 낼 수 있지만 `--cpus`가 더 직관적이다.

### --cpu-shares (상대적 비중)

```bash
docker run -d --cpu-shares=512 my-worker  # 기본 1024의 절반
```

절대적인 상한이 아니라 CPU 경합 시 상대적인 비중이다. 아무도 CPU를 안 쓰면 512 shares도 100% 쓸 수 있다. 우선순위 조정용으로 쓰인다.

### --cpuset-cpus (특정 코어 고정)

```bash
docker run -d --cpuset-cpus=0,1 my-api  # 0번, 1번 코어만 사용
docker run -d --cpuset-cpus=0-3 my-api  # 0~3번 코어
```

NUMA 아키텍처에서 메모리 지역성 최적화나 실시간 처리에서 코어를 격리할 때 쓴다.

![CPU·메모리 제한 구조 다이어그램](/assets/posts/docker-resource-limits-diagram.svg)

## 메모리 제한

### --memory (하드 상한)

```bash
docker run -d --memory=512m my-api   # 512 MiB
docker run -d --memory=2g my-api     # 2 GiB
```

컨테이너가 이 값을 초과하면 커널 OOM Killer가 프로세스를 종료하고 컨테이너가 exit code 137로 종료된다.

### --memory-swap (스왑 포함 상한)

```bash
docker run -d --memory=512m --memory-swap=1g my-api
```

`--memory-swap`은 메모리와 스왑을 합친 총량이다. `--memory=512m --memory-swap=1g`이면 스왑은 최대 512m(1g - 512m)까지 사용할 수 있다.

`--memory-swap=-1`은 스왑을 무제한으로 허용한다. `--memory-swap=0`은 `--memory`와 같은 값으로 스왑을 사용하지 않는다.

### --memory-reservation (소프트 상한)

```bash
docker run -d --memory=512m --memory-reservation=256m my-api
```

호스트 메모리가 부족할 때만 이 값으로 메모리를 회수하려 시도한다. 평상시에는 `--memory` 한도까지 쓸 수 있다. 소프트 상한이라 강제력은 없다.

## Compose에서 선언 — deploy.resources

Compose v2에서는 `deploy.resources`로 리소스 제한을 선언한다. `limits`는 하드 상한, `reservations`는 소프트 하한이다.

```yaml
services:
  api:
    image: my-api
    deploy:
      resources:
        limits:
          cpus: '1.5'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 128M
```

`cpus`는 반드시 문자열(`'1.5'`)로 선언해야 한다. 숫자 `1.5`로 쓰면 파싱 문제가 생길 수 있다.

![리소스 제한 코드 예시](/assets/posts/docker-resource-limits-code.svg)

## OOM이 발생했을 때

컨테이너가 exit code 137로 종료됐다면 OOM Kill이다.

```bash
docker inspect --format='{{.State.OOMKilled}}' my-api
# true 이면 OOM으로 종료됨

docker events --filter event=oom  # OOM 이벤트 실시간
```

OOM이 반복되면 `--memory` 값을 높이거나 앱의 메모리 누수를 찾아야 한다. `docker stats`로 실제 사용량을 먼저 모니터링한다.

```bash
docker stats my-api --no-stream  # 현재 사용량 스냅샷
docker stats                     # 모든 컨테이너 실시간
```

## 실전 권장 설정

```bash
# 웹 서버 (메모리 여유있게)
docker run -d \
  --cpus=1.0 \
  --memory=256m \
  --memory-swap=256m \
  nginx

# 데이터 처리 워커 (CPU 집중)
docker run -d \
  --cpus=2.0 \
  --memory=1g \
  --memory-swap=1g \
  my-worker
```

`--memory-swap`을 `--memory`와 같게 설정하면 스왑을 사용하지 않아 예측 가능한 성능을 얻는다. 스왑을 허용하면 메모리 부족 시 성능이 급격히 저하된다.

---

**지난 글:** [Docker 재시작 정책: restart 완전 정복](/posts/docker-restart-policy/)

<br>
읽어주셔서 감사합니다. 😊
