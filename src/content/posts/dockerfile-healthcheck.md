---
title: "HEALTHCHECK 인스트럭션 완전 정복"
description: "Dockerfile HEALTHCHECK로 컨테이너 상태를 자동 감지하는 방법, 옵션 설정, HTTP·DB·TCP 체크 패턴, Compose 연동, 운영 시 주의사항을 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 1
type: "knowledge"
category: "Docker"
tags: ["docker", "dockerfile", "HEALTHCHECK", "헬스체크", "컨테이너 모니터링"]
featured: false
draft: false
---

[지난 글](/posts/dockerfile-user/)에서 USER 인스트럭션으로 컨테이너를 비루트로 실행하는 방법을 살펴봤다. 이번에는 컨테이너가 실제로 '살아있는지'를 Docker 스스로 판단하게 만드는 `HEALTHCHECK` 인스트럭션을 정리한다.

## HEALTHCHECK가 필요한 이유

프로세스가 실행 중이라고 해서 서비스가 정상인 것은 아니다. 웹 서버 프로세스는 살아 있지만 DB 연결이 끊겨 500 에러를 반환할 수도 있고, JVM은 떠 있지만 OOM 직전으로 요청을 처리하지 못할 수도 있다. `HEALTHCHECK`는 이런 상황을 감지해 Docker에게 알려주고, Compose나 Swarm이 자동으로 재시작·교체 판단을 내리도록 돕는다.

![HEALTHCHECK 문법과 옵션](/assets/posts/dockerfile-healthcheck-syntax.svg)

## 기본 문법

```dockerfile
HEALTHCHECK [OPTIONS] CMD <command>
HEALTHCHECK NONE
```

`CMD` 뒤의 명령은 컨테이너 내부에서 실행된다. 종료 코드가 **0**이면 healthy, **1**이면 unhealthy다. 코드 **2**는 예약되어 있어 사용하지 않는다. `NONE`은 부모 이미지의 HEALTHCHECK를 비활성화할 때 쓴다.

## 옵션 상세

| 옵션 | 기본값 | 의미 |
|---|---|---|
| `--interval` | 30s | 체크 실행 주기 |
| `--timeout` | 30s | 명령 최대 대기 시간 |
| `--start-period` | 0s | 초기화 유예 기간 |
| `--retries` | 3 | unhealthy 확정 전 재시도 횟수 |
| `--start-interval` | 5s | start-period 중 체크 주기 (Docker 25+) |

`--start-period`는 컨테이너 시작 직후 느린 초기화 단계에서 실패해도 unhealthy로 표시하지 않는 유예 시간이다. 이 구간에서의 실패는 재시도 카운트에 포함되지 않는다.

## 헬스 상태 머신

![컨테이너 헬스 상태 머신](/assets/posts/dockerfile-healthcheck-states.svg)

컨테이너는 세 가지 상태를 갖는다:

- **starting** — 컨테이너 시작 직후, 아직 충분한 체크가 이루어지지 않은 상태
- **healthy** — 최근 체크가 성공한 상태
- **unhealthy** — `--retries` 횟수 연속 실패한 상태

`docker ps`의 STATUS 컬럼에서 `(healthy)`, `(unhealthy)`, `(health: starting)` 형태로 확인할 수 있다.

## 실전 패턴

### HTTP 서버

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci
HEALTHCHECK --interval=15s --timeout=5s \
            --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3000/health \
        || exit 1
CMD ["node", "server.js"]
```

Alpine에는 `curl`이 없으므로 `wget`을 사용한다. `-q`는 조용히, `-O-`는 stdout 출력이다.

### PostgreSQL

```dockerfile
HEALTHCHECK --interval=10s --timeout=5s \
            --start-period=30s --retries=5 \
    CMD pg_isready -U postgres -d mydb
```

`pg_isready`는 PostgreSQL 공식 이미지에 내장되어 있다. `--start-period=30s`로 DB 초기화 시간을 확보한다.

### Redis

```dockerfile
HEALTHCHECK --interval=10s --timeout=3s \
    CMD redis-cli ping | grep -q PONG
```

### TCP 포트 확인 (curl 없는 환경)

```dockerfile
HEALTHCHECK --interval=20s \
    CMD nc -z localhost 8080 || exit 1
```

`nc`(netcat)로 포트가 열려 있는지만 확인한다. 애플리케이션 레벨 응답이 필요 없는 경우에 유용하다.

## Docker Compose 연동

```yaml
services:
  api:
    build: .
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 20s

  worker:
    image: myapp/worker
    depends_on:
      api:
        condition: service_healthy
```

`depends_on`에 `condition: service_healthy`를 지정하면 `api`가 healthy 상태가 되어야 `worker`가 시작된다. 시작 순서 의존성을 정확히 제어할 수 있어 DB가 뜨기 전에 앱이 연결을 시도하는 문제를 방지한다.

## 상태 확인 명령어

```bash
# 상태 확인
docker inspect --format='{{.State.Health.Status}}' <컨테이너>

# 최근 로그 확인
docker inspect --format='{{json .State.Health}}' <컨테이너> \
  | python3 -m json.tool

# 필터로 unhealthy 컨테이너만 조회
docker ps --filter health=unhealthy
```

## 주의사항

**체크 명령 의존성**: `curl`이나 `wget`이 이미지에 없으면 헬스체크가 항상 실패한다. Alpine 이미지라면 `wget`이 포함되어 있지만 `curl`은 별도 설치가 필요하다. 이미지 크기를 늘리고 싶지 않다면 `nc`나 `/dev/tcp`를 활용한다.

```bash
# bash 내장 TCP (curl/wget 없이)
CMD bash -c 'echo > /dev/tcp/localhost/8080' || exit 1
```

**interval 짧게 설정 주의**: interval을 너무 짧게 하면 체크 명령 자체가 CPU/메모리를 낭비한다. 프로덕션에서는 15~30s가 적당하다.

**Swarm/K8s**: Docker Swarm은 unhealthy 컨테이너를 자동으로 교체한다. Kubernetes는 HEALTHCHECK 대신 자체 livenessProbe/readinessProbe를 사용하므로 Dockerfile의 HEALTHCHECK는 무시된다.

## 핵심 정리

- `HEALTHCHECK CMD`는 컨테이너 내에서 명령을 실행해 종료 코드로 상태를 판단
- `--start-period`로 초기화 유예 시간을 주어 false unhealthy 방지
- HTTP: `wget -qO-` 또는 `curl -f`, DB: 전용 CLI 도구, TCP: `nc -z`
- Compose `depends_on: condition: service_healthy`로 시작 순서 보장
- Kubernetes 환경에서는 livenessProbe/readinessProbe가 우선

---

**지난 글:** [USER 인스트럭션 완전 정복](/posts/dockerfile-user/)

**다음 글:** [ONBUILD 인스트럭션 완전 정복](/posts/dockerfile-onbuild/)

<br>
읽어주셔서 감사합니다. 😊
