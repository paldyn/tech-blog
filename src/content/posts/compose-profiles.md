---
title: "Docker Compose profiles: 환경별 서비스 선택 실행"
description: "Compose profiles로 dev/test/debug 서비스를 분리하는 방법, --profile 플래그와 COMPOSE_PROFILES 환경변수, depends_on과의 연동 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 3
type: "knowledge"
category: "Docker"
tags: ["docker", "compose", "profiles", "dev", "환경분리", "선택실행"]
featured: false
draft: false
---

[지난 글](/posts/compose-healthcheck/)에서 healthcheck 옵션을 살펴봤다. 이번에는 같은 `compose.yaml` 안에서 개발/테스트/디버그용 서비스를 분리해 선택적으로 실행하는 `profiles` 기능을 다룬다.

## profiles가 해결하는 문제

하나의 `compose.yaml`에 모든 서비스를 넣으면 로컬 개발에서 `phpmyadmin`이나 `mailhog`처럼 개발자만 필요한 서비스가 CI나 스테이징 환경에서도 불필요하게 시작된다. `profiles`로 서비스에 태그를 붙이면 필요한 것만 골라 시작할 수 있다.

```yaml
services:
  web:
    image: nginx         # 항상 시작

  phpmyadmin:
    image: phpmyadmin
    profiles: ["dev"]    # --profile dev 일 때만 시작
```

`profiles` 선언이 없는 서비스는 항상 시작된다. `profiles`가 있는 서비스는 해당 프로필이 활성화될 때만 시작된다.

## 기본 사용법

```bash
# 기본 서비스만 (profiles 없는 것)
docker compose up

# dev 프로필 포함
docker compose --profile dev up

# 복수 프로필
docker compose --profile dev --profile test up

# 환경변수로 지정
COMPOSE_PROFILES=dev docker compose up
COMPOSE_PROFILES=dev,test docker compose up
```

![profiles 서비스 선택 다이어그램](/assets/posts/compose-profiles-diagram.svg)

## 복수 프로필 할당

서비스에 여러 프로필을 할당하면 어느 하나라도 활성화되면 시작된다.

```yaml
services:
  seeder:
    image: my-seeder
    profiles:
      - dev
      - test
```

`--profile dev` 또는 `--profile test` 중 하나라도 지정하면 `seeder`가 실행된다.

![profiles 코드 예시](/assets/posts/compose-profiles-code.svg)

## depends_on과 profiles

profiles 설정된 서비스가 다른 서비스에 `depends_on`으로 의존할 때, 해당 프로필이 활성화되지 않으면 의존 체인도 무시된다.

```yaml
services:
  db:
    image: postgres

  seeder:
    image: my-seeder
    profiles: ["dev"]
    depends_on:
      db:
        condition: service_healthy
```

`--profile dev`를 주지 않으면 `seeder`와 그 `depends_on`은 무시된다. 프로필이 활성화되면 `db`가 healthy 상태가 될 때까지 기다린다.

반대로, profiles 없는 서비스가 profiles 있는 서비스에 `depends_on`을 걸면 오류가 발생한다. profiles 없는 서비스는 항상 시작돼야 하는데 의존 서비스가 선택적이라 모순이기 때문이다.

## 실전 구성 예

```yaml
services:
  # 모든 환경 공통
  web:
    image: nginx
  api:
    image: my-api
  db:
    image: postgres:16

  # 로컬 개발 전용
  phpmyadmin:
    image: phpmyadmin
    profiles: ["dev"]
    environment:
      PMA_HOST: db
    ports:
      - "8080:80"

  mailhog:
    image: mailhog/mailhog
    profiles: ["dev"]
    ports:
      - "8025:8025"

  # 테스트 전용
  test-runner:
    image: my-api
    command: pytest
    profiles: ["test"]
    depends_on:
      db:
        condition: service_healthy
```

## .env에서 프로필 고정

로컬 개발 환경에서 매번 `--profile dev`를 붙이기 번거로우면 `.env` 파일에 고정한다.

```bash
# .env
COMPOSE_PROFILES=dev
```

이 파일은 git에 커밋하지 않는다. `.env.example`에 빈 값이나 기본 설명만 남겨 팀원에게 안내한다.

```bash
# .env.example
COMPOSE_PROFILES=   # dev, test, debug 중 선택
```

## 주의 사항

`--profile`로 활성화된 서비스를 내릴 때도 같은 프로필을 지정해야 한다.

```bash
# dev 프로필로 올렸으면 내릴 때도 같은 프로필 필요
docker compose --profile dev down
```

지정 없이 `down`하면 profiles 없는 서비스만 내려가고, phpmyadmin 같은 dev 전용 컨테이너는 남아있다.

---

**지난 글:** [Docker Compose healthcheck: 서비스 상태 검사 완전 정복](/posts/compose-healthcheck/)

**다음 글:** [Docker Compose extends와 merge: 설정 재사용과 공통 베이스](/posts/compose-extends-merge/)

<br>
읽어주셔서 감사합니다. 😊
