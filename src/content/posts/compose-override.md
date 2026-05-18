---
title: "Docker Compose override: 환경별 설정 재정의 패턴"
description: "compose.override.yaml 자동 병합 메커니즘, -f 플래그로 환경별 파일 조합, 로컬 개발·CI·프로덕션 분리 패턴을 실전 예시와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 5
type: "knowledge"
category: "Docker"
tags: ["docker", "compose", "override", "환경분리", "로컬개발", "compose.override.yaml"]
featured: false
draft: false
---

[지난 글](/posts/compose-extends-merge/)에서 extends와 파일 병합 기초를 살펴봤다. 이번에는 `compose.override.yaml`의 자동 병합 메커니즘과 환경별 설정 분리 패턴을 정리한다.

## compose.override.yaml — 자동 병합

같은 디렉터리에 `compose.yaml`과 `compose.override.yaml`이 함께 있으면 `docker compose up` 실행 시 두 파일이 자동으로 병합된다. `-f`를 명시할 필요가 없다.

```bash
myapp/
├── compose.yaml           # 기본 설정 (git 커밋)
├── compose.override.yaml  # 로컬 재정의 (.gitignore)
└── .env
```

`compose.override.yaml`에 선언된 값이 `compose.yaml`을 덮어쓴다.

![override 자동 병합 다이어그램](/assets/posts/compose-override-diagram.svg)

## 병합 동작 상세

```yaml
# compose.yaml
services:
  api:
    image: my-api:1.0
    environment:
      LOG_LEVEL: warn
    restart: always
```

```yaml
# compose.override.yaml
services:
  api:
    build: .              # image 대신 빌드
    volumes:
      - .:/app            # 소스 코드 마운트
    environment:
      LOG_LEVEL: debug    # warn 덮어씀
```

결과적으로 api 서비스는 `image: my-api:1.0` 대신 현재 디렉터리로 빌드하고, `LOG_LEVEL=debug`, `restart: always`는 유지된다. `volumes`는 override에서 추가된다.

## 로컬 개발 패턴

```yaml
# compose.override.yaml — 로컬에서만 쓰는 재정의
services:
  api:
    build: .
    volumes:
      - .:/app            # 핫 리로드를 위한 소스 마운트
    environment:
      DEBUG: "true"
    command: npm run dev  # 개발 모드 실행

  db:
    ports:
      - "5432:5432"       # 외부에서 직접 접속 가능
```

`compose.yaml`에는 프로덕션 기준으로만 선언하고, 개발자별 로컬 설정은 `compose.override.yaml`에 넣는다. 팀원마다 다른 포트나 볼륨 경로를 쓸 수 있다.

## .gitignore 처리

```gitignore
# .gitignore
compose.override.yaml
.env
*.local
```

`compose.override.yaml`은 개인 로컬 설정이라 저장소에 넣지 않는다. 대신 `compose.override.yaml.example`을 만들어 팀원이 복사해서 쓰도록 안내한다.

```bash
cp compose.override.yaml.example compose.override.yaml
```

## 환경별 파일 조합 (-f)

자동 병합 대신 명시적으로 파일을 조합하는 방법도 있다.

```bash
# 로컬 개발
docker compose -f compose.yaml -f compose.dev.yaml up

# 스테이징
docker compose -f compose.yaml -f compose.staging.yaml up

# 프로덕션 (override 파일 없이 기본만)
docker compose -f compose.yaml up -d
```

![override 코드 예시](/assets/posts/compose-override-code.svg)

프로덕션 서버에 `compose.override.yaml`이 없는 상태로 배포하면 `compose.yaml`만 적용된다.

## CI 파이프라인 패턴

```yaml
# compose.ci.yaml — CI 전용 재정의
services:
  db:
    tmpfs:
      - /var/lib/postgresql/data  # 임시 파일시스템으로 속도 향상

  api:
    environment:
      DATABASE_URL: postgresql://postgres:ci@db/testdb
```

```bash
# CI에서
docker compose -f compose.yaml -f compose.ci.yaml run --rm api pytest
```

## 파일 우선순위

`-f`를 여러 번 쓰면 뒤에 오는 파일이 앞의 파일을 덮어쓴다.

```bash
docker compose -f a.yaml -f b.yaml -f c.yaml up
# c > b > a 순으로 덮어씀
```

현재 병합 결과를 확인하려면 `config` 명령을 쓴다.

```bash
docker compose config          # 자동 감지된 파일들의 병합 결과
docker compose -f a.yaml -f b.yaml config  # 명시한 파일들의 병합 결과
```

---

**지난 글:** [Docker Compose extends와 merge: 설정 재사용과 공통 베이스](/posts/compose-extends-merge/)

**다음 글:** [Docker Compose watch: 소스 변경 자동 감지 핫 리로드](/posts/compose-watch/)

<br>
읽어주셔서 감사합니다. 😊
