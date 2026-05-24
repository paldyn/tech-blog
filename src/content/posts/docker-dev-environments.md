---
title: "Docker로 개발 환경 구성하기"
description: "Docker Compose를 활용한 로컬 개발 환경 구성, bind mount + hot reload 패턴, 멀티 스테이지 Dockerfile에서 dev/prod 분리, node_modules 익명 볼륨 트릭, 실전 개발 워크플로를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 7
type: "knowledge"
category: "Docker"
tags: ["docker", "compose", "개발환경", "hot-reload", "bind-mount", "devops"]
featured: false
draft: false
---

[지난 글](/posts/docker-test-in-container/)에서 컨테이너 안에서 테스트를 실행하는 패턴을 살펴봤다. 테스트뿐 아니라 **개발 자체**를 컨테이너 안��서 할 수 있다. "내 컴퓨터에서는 됐는데"를 완전히 없애려면 개발 환경도 컨테이너화해야 한다. Docker Compose로 앱 컨테이너와 DB·캐시 등 부속 서비스를 한 번에 띄우면 팀 전체가 동일한 개발 환경을 쓸 수 있다.

## 개발 환경 구성 요소

![Docker 개발 환경 구성](/assets/posts/docker-dev-environments-setup.svg)

핵심은 **bind mount**다. 호스트의 소스 코드를 컨테이너 안으로 마운트해 파일이 변경되면 즉시 컨테이너에 반영된다. 개발 서버가 hot reload를 지원하면 저장 즉시 변경 사항을 볼 수 있다.

## 멀티 스테��지 Dockerfile — dev/prod 분리

```dockerfile
# Dockerfile
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci

# 개발 스테이지: devDependencies + 개발 도구 포함
FROM base AS dev
RUN npm install --include=dev
COPY . .
CMD ["npm", "run", "dev"]   # hot reload

# 프로덕션 스테이지: 최소화
FROM base AS production
COPY src/ ./src/
RUN npm run build
CMD ["node", "dist/main.js"]
```

개발용과 프로덕션용 이미지를 같은 Dockerfile에서 target으로 분리한다. `dev` 스테이지는 devDependencies와 소스 전체를 포함하고, `production` 스테이지는 빌드 결과물만 담는다.

## compose.yaml — 개발 환경 전체 구성

![개발 환경 compose.yaml 예시](/assets/posts/docker-dev-environments-compose.svg)

```yaml
# compose.yaml
services:
  app:
    build:
      context: .
      target: dev        # dev 스테이��� 사용
    volumes:
      - .:/app           # bind mount: 소스 실시간 반영
      - /app/node_modules  # 익명 볼륨: 호스트 node_modules 무시
    ports:
      - "3000:3000"      # 앱 포트
      - "9229:9229"      # Node.js 디버거 포트
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://dev:dev@db:5432/devdb
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: devdb
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev -d devdb"]
      interval: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

## node_modules 익명 볼륨 트릭

```yaml
volumes:
  - .:/app               # 호스트 전체를 마운트
  - /app/node_modules    # node_modules는 컨테이너 내부 유지
```

호스트 OS(특히 macOS)의 `node_modules`와 Linux 컨테이너 안의 `node_modules`는 바이너리 호환이 안 될 �� 있다. 컨테이너 안에서 설치한 `node_modules`를 익명 볼륨으로 보호해 호스트 디렉터리가 덮어쓰지 않도록 한다.

Python에서는 `__pycache__`를 같은 방식으로 처리하는 경우도 있다.

```yaml
volumes:
  - .:/app
  - /app/__pycache__
  - /app/.pytest_cache
```

## 개발 서버 hot reload 설정

```dockerfile
# Node.js (nodemon)
FROM node:20-alpine AS dev
RUN npm install -g nodemon
WORKDIR /app
COPY package*.json ./
RUN npm install
CMD ["nodemon", "--watch", "src", "src/index.js"]
```

```dockerfile
# Python (uvicorn)
FROM python:3.12-slim AS dev
WORKDIR /app
COPY requirements*.txt ./
RUN pip install -r requirements-dev.txt
CMD ["uvicorn", "main:app", "--reload", "--host", "0.0.0.0"]
```

```dockerfile
# Go (air)
FROM golang:1.22-alpine AS dev
RUN go install github.com/air-verse/air@latest
WORKDIR /app
COPY go.* ./
RUN go mod download
CMD ["air"]
```

## 개발 환경 시작/종료 명령

```bash
# ��발 환경 시작 (백그라운드)
docker compose up -d

# 로그 실시간 확인
docker compose logs -f app

# 앱 컨테이너만 재시작 (소스 변경이 아닌 환경 변수 등 변경 시)
docker compose restart app

# 이미지 재빌드가 ��요한 경우 (Dockerfile·의존성 변경)
docker compose up -d --build app

# 전체 종료 및 볼륨 삭제 (DB 초기화 포함)
docker compose down -v
```

## compose.override.yml — 로컬 커스터마이징

```yaml
# compose.override.yml (gitignore에 추���)
services:
  app:
    environment:
      DEBUG: "true"
      MY_PERSONAL_TOKEN: "local-only-value"
    ports:
      - "3001:3000"   # 내 로컬 포트 충돌 해결
```

`compose.override.yml`은 `docker compose up` 시 자동으로 `compose.yaml`에 병합된다. 팀은 공통 `compose.yaml`을 공유하고, 개인 설정은 `.gitignore`에 추가한 `compose.override.yml`에��� 관���한다.

## 실전 팁: 데이터베이스 마이그레이션 자동화

```yaml
# compose.yaml에 init 서비��� 추가
services:
  migrate:
    build: .
    command: ["python", "manage.py", "migrate"]
    depends_on:
      db:
        condition: service_healthy
    profiles: ["migrate"]   # 별도 profile로 분리
```

```bash
# DB 마이그레이션 실행 후 종료
docker compose --profile migrate run --rm migrate

# 앱 시작 (migrate 서비스는 포함 안 됨)
docker compose up -d
```

---

**지난 글:** [컨테이너 안에서 테스트 실행하기](/posts/docker-test-in-container/)

**다음 글:** [VS Code Dev Containers로 팀 개발 환경 표준화하기](/posts/docker-devcontainer/)

<br>
읽어주셔서 감사합니다. 😊
