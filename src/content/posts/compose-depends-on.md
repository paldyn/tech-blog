---
title: "Docker Compose depends_on: 서비스 의존성과 시작 순서 제어"
description: "depends_on의 단축·긴 구문, service_started/service_healthy/service_completed_successfully 세 가지 condition 타입, restart 옵션까지 실전 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 1
type: "knowledge"
category: "Docker"
tags: ["docker", "compose", "depends_on", "healthcheck", "서비스의존성", "시작순서"]
featured: false
draft: false
---

[지난 글](/posts/compose-environment/)에서 환경 변수 전달 방법과 우선순위를 살펴봤다. 이번에는 서비스들의 시작 순서를 선언적으로 제어하는 `depends_on`을 깊이 파고든다.

## depends_on이 필요한 이유

멀티 서비스 애플리케이션에서 web이 api보다 먼저 뜨면 연결 오류가 난다. api는 db가 완전히 준비되기 전에 쿼리를 보내면 패닉한다. Compose는 `depends_on`으로 이 순서를 선언한다.

```yaml
services:
  web:
    image: nginx
    depends_on:
      - api
  api:
    image: my-api
    depends_on:
      - db
  db:
    image: postgres
```

위 설정에서 `compose up`을 실행하면 db → api → web 순으로 시작된다. `compose down`은 반대로 web → api → db 순으로 정지한다.

![depends_on 서비스 의존성 다이어그램](/assets/posts/compose-depends-on-diagram.svg)

## 단축 구문 vs 긴 구문

### 단축 구문

배열로 나열하면 `condition: service_started`가 묵시적으로 적용된다.

```yaml
depends_on:
  - db
  - redis
```

`service_started`는 컨테이너 프로세스가 시작됐다는 신호만 확인한다. PostgreSQL이 `ready to accept connections`를 출력하기 전일 수도 있어서, 앱 쪽에서 재시도 로직이 없으면 여전히 연결 오류가 발생할 수 있다.

### 긴 구문 — condition 명시

```yaml
services:
  api:
    depends_on:
      db:
        condition: service_healthy
        restart: true
      migrate:
        condition: service_completed_successfully
```

긴 구문에서는 세 가지 condition을 선택할 수 있다.

| condition | 의미 |
|-----------|------|
| `service_started` | 컨테이너 프로세스가 시작됨 (기본값) |
| `service_healthy` | `healthcheck`가 healthy 상태 |
| `service_completed_successfully` | 컨테이너가 exit code 0으로 종료됨 |

## service_healthy 실전 패턴

`service_healthy`를 쓰려면 의존 대상 서비스에 `healthcheck` 블록이 있어야 한다.

```yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_PASSWORD: secret
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 10s

  api:
    image: my-api
    depends_on:
      db:
        condition: service_healthy
```

`start_period`는 컨테이너가 초기화되는 동안 healthcheck 실패를 무시하는 유예 시간이다. DB 초기화가 오래 걸릴 때 유용하다.

![depends_on 구문 코드 예시](/assets/posts/compose-depends-on-code.svg)

## service_completed_successfully — 마이그레이션 패턴

DB 스키마 마이그레이션을 별도 서비스로 분리할 때 사용한다.

```yaml
services:
  migrate:
    image: my-api
    command: ["python", "manage.py", "migrate"]
    depends_on:
      db:
        condition: service_healthy

  api:
    image: my-api
    depends_on:
      migrate:
        condition: service_completed_successfully
      db:
        condition: service_healthy
```

`migrate` 서비스가 exit 0으로 끝난 뒤에야 `api`가 시작된다. 마이그레이션 실패(exit 1)이면 `api`는 아예 시작되지 않는다.

## restart 옵션

```yaml
depends_on:
  db:
    condition: service_healthy
    restart: true     # db가 재시작되면 api도 재시작
```

`restart: true`를 설정하면 의존 서비스가 비정상 종료·재시작될 때 현재 서비스도 함께 재시작된다. 기본값은 `false`다.

## 자주 빠지는 함정

**depends_on은 시작 순서만 보장한다.** DB 컨테이너가 시작됐다고 해서 PostgreSQL이 연결을 받을 준비가 됐다는 뜻이 아니다. `service_started`만 쓰면서 앱 쪽 재시도 로직이 없으면 연결 실패가 계속 발생한다.

해결책은 두 가지다.

1. `service_healthy` + `healthcheck` 조합으로 실제 준비 완료를 기다린다.
2. 앱 코드에 재시도 로직(exponential backoff)을 구현한다.

둘 다 적용하는 것이 가장 견고하다.

```bash
# depends_on 없이 순서 강제하는 확인 방법
docker compose up --wait  # 모든 서비스가 healthy 상태가 될 때까지 대기
```

`--wait` 플래그는 healthcheck 없는 서비스는 started 상태로 간주하고, healthcheck 있는 서비스는 healthy까지 기다린다.

---

**지난 글:** [Docker Compose environment: 환경 변수 완전 정복](/posts/compose-environment/)

**다음 글:** [Docker Compose healthcheck: 서비스 상태 검사 완전 정복](/posts/compose-healthcheck/)

<br>
읽어주셔서 감사합니다. 😊
