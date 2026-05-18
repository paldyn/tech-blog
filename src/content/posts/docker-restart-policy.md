---
title: "Docker 재시작 정책: restart 완전 정복"
description: "Docker restart 정책 4가지(no·on-failure·always·unless-stopped) 동작 차이, exponential backoff 재시도 간격, Compose 선언법, docker update 활용을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 9
type: "knowledge"
category: "Docker"
tags: ["docker", "restart", "재시작정책", "on-failure", "always", "unless-stopped"]
featured: false
draft: false
---

[지난 글](/posts/compose-logs-ps/)에서 Compose 서비스 상태 조회 방법을 살펴봤다. 이번에는 컨테이너가 종료되거나 크래시가 났을 때 Docker가 어떻게 재시작하는지 제어하는 restart 정책을 정리한다.

## restart 정책 4가지

Docker에는 4가지 재시작 정책이 있다. 기본값은 `no`다.

```bash
docker run -d --restart <policy> my-image
```

**`no`** — 컨테이너가 어떤 이유로 종료되든 재시작하지 않는다. 기본값이며 개발 환경이나 일회성 작업에 적합하다.

**`on-failure[:max-retries]`** — exit code가 0이 아닐 때만 재시작한다. 정상 종료(exit 0)는 재시작하지 않는다. `:5`처럼 최대 재시도 횟수를 지정할 수 있다.

**`always`** — 종료 이유에 상관없이 항상 재시작한다. `docker stop`으로 수동으로 멈춰도 Docker daemon이 재시작될 때 다시 시작된다.

**`unless-stopped`** — 수동으로 정지하지 않는 한 항상 재시작한다. `docker stop`으로 명시적으로 멈춘 컨테이너는 daemon 재시작 후에도 다시 시작되지 않는다.

![restart 정책 다이어그램](/assets/posts/docker-restart-policy-diagram.svg)

## always vs unless-stopped 차이

가장 혼동되는 부분이다. 차이는 **수동 stop 이후 daemon이 재시작될 때** 동작이다.

```bash
docker stop mycontainer
systemctl restart docker   # daemon 재시작
```

- `always`: daemon 재시작 후 컨테이너가 다시 시작된다.
- `unless-stopped`: daemon 재시작 후 컨테이너가 시작되지 않는다 (마지막 상태가 stopped였으므로).

서버 부팅 시 자동으로 서비스를 시작해야 하는 프로덕션 환경에서는 `unless-stopped`가 더 자연스럽다. 수동으로 멈춘 것은 의도적인 행위이므로 재시작하지 않는 것이 맞다.

## on-failure — exponential backoff

`on-failure`로 재시작할 때 Docker는 재시도 간격을 점점 늘린다. 첫 번째는 즉시, 이후 1s, 2s, 4s, ..., 최대 약 120s 간격으로 재시도한다.

```bash
docker run -d --restart on-failure:5 my-app
```

5회 실패 후에는 더 이상 재시작하지 않는다. 이후 `docker start <container>`로 수동 재시작할 수 있다.

재시도 횟수 제한 없이 계속 시도하려면 숫자를 빼면 된다.

```bash
docker run -d --restart on-failure my-app
```

## Compose에서 선언

```yaml
services:
  web:
    image: nginx
    restart: unless-stopped

  worker:
    image: my-worker
    restart: on-failure      # 무제한 재시도

  migrate:
    image: my-app
    command: python manage.py migrate
    restart: "no"            # 일회성 — 재시작 안 함
```

`restart: "no"`는 YAML에서 `no`가 boolean false로 해석되므로 반드시 따옴표로 감싸야 한다. Compose v2에서는 자동으로 처리하지만 명시하는 것이 안전하다.

![restart 정책 코드 예시](/assets/posts/docker-restart-policy-code.svg)

## 실행 중 정책 변경

컨테이너를 재생성하지 않고도 restart 정책을 바꿀 수 있다.

```bash
docker update --restart unless-stopped mycontainer
docker update --restart no mycontainer  # 비활성화
```

여러 컨테이너를 한 번에 변경할 수도 있다.

```bash
docker update --restart always $(docker ps -q)
```

## 정책 선택 가이드

| 용도 | 권장 정책 |
|------|-----------|
| 프로덕션 상시 서비스 | `unless-stopped` |
| 크래시 복구 필요 | `on-failure` |
| 부팅 시 반드시 자동 시작 | `always` |
| 개발 환경 | `no` (기본값) |
| 마이그레이션·일회성 작업 | `no` |

## 재시작 횟수 확인

```bash
docker inspect --format='{{.RestartCount}}' mycontainer
docker events --filter event=restart  # 실시간 재시작 이벤트
```

---

**지난 글:** [Docker Compose logs/ps: 서비스 상태 조회와 로그 분석](/posts/compose-logs-ps/)

**다음 글:** [Docker 리소스 제한: CPU·메모리 완전 정복](/posts/docker-resource-limits-cpu-memory/)

<br>
읽어주셔서 감사합니다. 😊
