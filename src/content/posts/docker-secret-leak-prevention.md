---
title: "Docker 이미지에서 시크릿 유출 방지하기"
description: "Docker 이미지에서 API 키·비밀번호·토큰이 유출되는 경로, ENV/ARG/COPY .env의 위험성, BuildKit secret 마운트와 런타임 주입으로 안전하게 다루는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 7
type: "knowledge"
category: "Docker"
tags: ["docker", "security", "secret", "buildkit", "환경변수", "보안", "credential", "leak"]
featured: false
draft: false
---

[지난 글](/posts/docker-layer-caching-tips/)에서 레이어 캐시 전략을 다뤘다. 레이어에 대해 깊이 이해하면 자연스럽게 보안 문제와 마주친다 — 레이어는 영구적으로 기록되고, 잘못 넣은 비밀값은 삭제해도 기록에 남는다.

## 왜 이미지에서 시크릿이 유출되는가

Docker 이미지는 레이어의 스택이고, 각 레이어는 변경 불가능(immutable)하다. 어떤 레이어에서 파일을 `RUN rm`으로 삭제해도, 그 파일이 존재했던 이전 레이어는 그대로 남아 있다. 이미지를 tar로 추출하면 삭제 전 레이어에서 파일을 꺼낼 수 있다.

```bash
# 이미지 레이어 추출 후 비밀값 탐색
docker save myapp:latest | tar -xv
# 각 레이어 디렉터리에서 .env, .npmrc 등을 grep으로 검색 가능

# docker history로 RUN 명령어 확인
docker history --no-trunc myapp:latest | grep -i "token\|password\|secret\|key"
```

![Docker 이미지 시크릿 유출 경로](/assets/posts/docker-secret-leak-prevention-overview.svg)

## 유출 패턴 1: ENV 하드코딩

```dockerfile
# 위험: docker inspect로 바로 노출
ENV DB_PASSWORD=supersecret123
ENV API_KEY=sk-abc123def456
```

```bash
$ docker inspect myapp | grep -A5 "Env"
"Env": [
    "DB_PASSWORD=supersecret123",  # 누구나 볼 수 있음
    "API_KEY=sk-abc123def456",
```

## 유출 패턴 2: .env 파일 COPY

```dockerfile
# 위험: 이미지 레이어에 평문으로 저장됨
COPY .env /app/.env
```

`.dockerignore`에 `.env`를 추가해야 한다.

```gitignore
# .dockerignore (필수)
.env
.env.*
!.env.example
```

## 유출 패턴 3: RUN 명령어에 토큰 직접 사용

```dockerfile
# 위험: docker history --no-trunc에 토큰이 그대로 기록됨
RUN pip install --extra-index-url https://user:TOKEN@pypi.mycompany.com/simple mypackage
```

```bash
$ docker history --no-trunc myapp:latest
# pip install --extra-index-url https://user:TOKEN@... 이 보임
```

## 유출 패턴 4: ARG로 비밀값 전달 후 ENV에 보관

```dockerfile
# 위험: docker history에 ARG 값 기록됨
ARG NPM_TOKEN
ENV NPM_TOKEN=${NPM_TOKEN}    # ENV로 노출 고정
RUN npm ci
```

`ARG`는 이미지에 직접 저장되지 않지만, `--build-arg`로 전달된 값이 빌드 로그와 일부 환경에서 history에 남을 수 있다. `ENV`로 복사하면 완전히 이미지에 고정된다.

## 안전한 방법 1: BuildKit --mount=type=secret

BuildKit의 secret 마운트는 빌드 중에만 파일을 임시로 제공하고 이미지 레이어에 포함하지 않는다.

![BuildKit --mount=type=secret 사용법](/assets/posts/docker-secret-leak-prevention-fix.svg)

```dockerfile
# syntax=docker/dockerfile:1
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .

# .netrc 또는 토큰 파일을 임시 마운트
RUN --mount=type=secret,id=pip_token \
    PIP_INDEX_URL=$(cat /run/secrets/pip_token) \
    pip install -r requirements.txt
```

빌드 시:

```bash
# 환경변수에서 시크릿 생성
echo "https://user:$TOKEN@pypi.mycompany.com/simple/" | \
  docker build --secret id=pip_token,src=/dev/stdin .

# 파일에서 시크릿 제공
docker build --secret id=npmrc,src=$HOME/.npmrc .
```

## 안전한 방법 2: 런타임 환경변수 주입

빌드 시가 아닌 런타임(컨테이너 실행 시)에 비밀값을 주입한다. 이 방식에서 이미지는 비밀값을 전혀 포함하지 않는다.

```dockerfile
# Dockerfile: 비밀값 없이 앱만 빌드
FROM node:20-slim
WORKDIR /app
COPY . .
RUN npm ci --only=production
CMD ["node", "server.js"]
```

```bash
# 실행 시 환경변수 주입
docker run -d \
  -e DB_PASSWORD="$DB_PASSWORD" \
  -e API_KEY="$API_KEY" \
  myapp:latest

# 또는 환경파일 사용 (파일 자체는 호스트에만 존재)
docker run -d --env-file .env myapp:latest
```

## 안전한 방법 3: Docker Secrets (Swarm/Kubernetes)

오케스트레이터를 사용한다면 Secrets 기능을 활용한다.

```bash
# Docker Swarm
echo "mysecretpassword" | docker secret create db_password -

# docker-compose.yml
services:
  app:
    image: myapp:latest
    secrets:
      - db_password
    environment:
      DB_PASSWORD_FILE: /run/secrets/db_password

secrets:
  db_password:
    external: true
```

앱 코드에서 파일을 읽어 비밀값을 사용하는 방식이다:

```python
# Python 예시
with open(os.environ["DB_PASSWORD_FILE"]) as f:
    db_password = f.read().strip()
```

## 기존 이미지에서 시크릿 확인하기

```bash
# truffleHog로 이미지 스캔
trufflehog docker --image myapp:latest

# gitleaks으로 소스 코드 스캔
gitleaks detect --source . --verbose

# detect-secrets 사전 커밋 훅으로 방지
pip install detect-secrets
detect-secrets scan > .secrets.baseline
detect-secrets audit .secrets.baseline
```

## CI 파이프라인에 시크릿 스캔 통합

```yaml
# GitHub Actions: 빌드 전 시크릿 스캔
- name: Secret Scan
  uses: trufflesecurity/trufflehog@main
  with:
    path: ./
    base: main
    head: HEAD

- name: Build image
  uses: docker/build-push-action@v6
  with:
    secrets: |
      npmrc=${{ secrets.NPMRC_CONTENT }}
```

GitHub Actions의 `secrets`는 빌드 로그에서 마스킹되며, `--mount=type=secret`으로 안전하게 Dockerfile에 전달된다.

---

**지난 글:** [Docker 레이어 캐싱 전략과 실전 팁](/posts/docker-layer-caching-tips/)

**다음 글:** [Docker 레지스트리 완전 정복: 개념과 구조](/posts/docker-registry-overview/)

<br>
읽어주셔서 감사합니다. 😊
