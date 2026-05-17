---
title: "Docker Compose YAML 기초 문법"
description: "compose.yaml의 최상위 키 구조, 변수 치환, 앵커·앨리어스 재사용, env_file vs environment 차이를 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 5
type: "knowledge"
category: "Docker"
tags: ["docker", "compose", "yaml", "문법", "환경변수", "앵커", "변수치환"]
featured: false
draft: false
---

[지난 글](/posts/compose-overview/)에서 Docker Compose의 개념과 핵심 명령어를 살펴봤다. 이번에는 `compose.yaml` 파일의 구조와 자주 쓰는 YAML 패턴을 정리한다.

## 최상위 키 구조

`compose.yaml`은 다섯 개의 최상위 키로 구성된다.

```yaml
services:    # 필수 — 컨테이너가 될 서비스 목록
  web: ...
  api: ...

networks:    # 선택 — 커스텀 네트워크 정의
  frontend:
  backend:

volumes:     # 선택 — named volume 정의
  pgdata:

configs:     # 선택 — 설정 파일 마운트
secrets:     # 선택 — 민감 데이터
```

![compose.yaml 구조](/assets/posts/compose-yaml-basics-structure.svg)

`version` 키는 Compose v2에서 제거되었다. 파일 최상단에 `version: "3.8"` 같은 줄이 있어도 동작하지만 더 이상 필요하지 않다.

## 변수 치환

셸 변수 또는 `.env` 파일의 값을 `compose.yaml`에서 참조할 수 있다.

```bash
# .env 파일
TAG=v2.1.0
DB_PASSWORD=mysecret
```

```yaml
services:
  api:
    image: myapp:${TAG:-latest}   # TAG 없으면 latest
    environment:
      DB_PASSWORD: ${DB_PASSWORD}
```

`${VAR:-default}` 형식으로 기본값을 설정한다. `${VAR:?error message}` 형식을 쓰면 변수가 없을 때 오류를 발생시켜 실수를 조기에 잡는다.

```bash
# 특정 TAG로 실행
TAG=v2.1.0 docker compose up -d

# .env 파일 지정
docker compose --env-file .env.prod up -d
```

## 앵커·앨리어스로 중복 제거

여러 서비스에 공통 설정이 반복될 때 YAML 앵커(`&`)와 앨리어스(`*`)로 중복을 줄인다.

```yaml
x-common-env: &common-env
  RAILS_ENV: production
  LOG_LEVEL: info

x-restart: &restart-policy
  restart: unless-stopped
  logging:
    driver: json-file
    options:
      max-size: "10m"

services:
  web:
    image: my-rails:latest
    <<: *restart-policy
    environment:
      <<: *common-env
      PORT: "3000"

  worker:
    image: my-rails:latest
    <<: *restart-policy
    environment:
      <<: *common-env
      WORKER: "true"
    command: bundle exec sidekiq
```

`x-` 접두사는 Compose가 무시하는 확장 필드다. 재사용 블록을 여기 정의한다.

## env_file vs environment

```yaml
services:
  api:
    # 파일에서 환경 변수 로드 (시크릿 분리)
    env_file:
      - .env
      - .env.local    # 로컬 오버라이드

    # 인라인 선언 (리스트 형식)
    environment:
      - NODE_ENV=production
      - PORT=3000

    # 인라인 선언 (맵 형식, 동일 효과)
    environment:
      NODE_ENV: production
      PORT: "3000"
```

`env_file`은 파일을 통째로 불러오고, `environment`는 개별 변수를 선언한다. 둘을 함께 쓸 수 있으며, `environment`가 `env_file`보다 우선한다.

## YAML 핵심 패턴

![YAML 패턴](/assets/posts/compose-yaml-basics-tips.svg)

### 여러 파일 오버라이드

```bash
# 기본 + 오버라이드 파일 병합
docker compose -f compose.yaml -f compose.override.yaml up -d

# 또는 compose.override.yaml이 존재하면 자동 병합
docker compose up -d
```

`compose.override.yaml`이 있으면 `docker compose up` 실행 시 자동으로 병합된다. 개발 환경용 볼륨 마운트나 디버그 포트를 오버라이드에 넣는 패턴이 일반적이다.

## 자주 하는 실수

| 실수 | 올바른 방법 |
|------|-----------|
| 탭 인덴트 사용 | YAML은 반드시 스페이스 |
| `version` 키 추가 | Compose v2에서 불필요 |
| 포트 숫자를 따옴표 없이 선언 | `"8080:80"` — 문자열로 감싸기 |
| `.env`를 git에 커밋 | `.gitignore`에 추가 |

## 정리

- `compose.yaml`은 `services`, `networks`, `volumes`, `configs`, `secrets` 다섯 최상위 키로 구성된다.
- `${VAR:-default}` 변수 치환으로 환경별 값을 분리한다.
- YAML 앵커·앨리어스(`&`, `*`, `<<:`)로 반복 설정을 재사용한다.
- `env_file`은 파일 전체를, `environment`는 개별 변수를 선언하며 함께 쓸 수 있다.

---

**지난 글:** [Docker Compose 개요: 멀티 컨테이너 앱 관리](/posts/compose-overview/)

**다음 글:** [Docker Compose services 완전 정복](/posts/compose-services/)

<br>
읽어주셔서 감사합니다. 😊
