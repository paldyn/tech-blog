---
title: "WORKDIR 인스트럭션 완전 정복"
description: "Dockerfile WORKDIR 인스트럭션의 동작 원리, 절대·상대 경로 누적 규칙, ENV 변수 활용, 멀티 스테이지 빌드에서의 쓰임새, 그리고 RUN cd와의 차이를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 5
type: "knowledge"
category: "Docker"
tags: ["docker", "dockerfile", "WORKDIR", "작업디렉터리", "경로", "멀티스테이지"]
featured: false
draft: false
---

[지난 글](/posts/dockerfile-copy-vs-add/)에서 COPY와 ADD로 파일을 이미지 안으로 가져오는 방법을 살펴봤다. 이번에는 RUN, COPY, CMD, ENTRYPOINT 등 이후 인스트럭션의 **현재 디렉터리**를 설정하는 `WORKDIR`을 알아본다.

## WORKDIR이란

`WORKDIR`은 이후 모든 인스트럭션이 동작하는 **작업 디렉터리**를 지정한다. 지정한 경로가 없으면 자동으로 생성한다(별도 `RUN mkdir`이 필요 없다).

```dockerfile
WORKDIR /app
```

컨테이너를 `docker exec -it container bash`로 접속할 때도 `WORKDIR`에 설정한 경로가 시작 디렉터리가 된다.

## RUN cd와의 차이

![WORKDIR 동작 원리](/assets/posts/dockerfile-workdir-diagram.svg)

```dockerfile
# 잘못된 예 — cd는 RUN 레이어 안에서만 유효
RUN cd /app && npm install
RUN npm start   # 여기서는 / 가 현재 디렉터리

# 올바른 예 — WORKDIR은 레이어를 넘어 유지
WORKDIR /app
RUN npm install
RUN npm start   # 여기서도 /app 기준
```

`RUN cd /path`로 변경한 디렉터리는 해당 `RUN` 레이어 안에서만 유효하다. 다음 인스트럭션은 이전 `WORKDIR` 값으로 돌아간다. **레이어 경계를 넘어 작업 디렉터리를 유지하려면 반드시 `WORKDIR`을 써야 한다**.

## 절대 경로와 상대 경로

![WORKDIR 연속 사용 — 경로 누적](/assets/posts/dockerfile-workdir-chaining.svg)

```dockerfile
WORKDIR /a
WORKDIR b       # → /a/b (상대 경로는 이전에 누적)
WORKDIR c       # → /a/b/c
WORKDIR /reset  # → /reset (절대 경로는 리셋)
```

상대 경로로 지정하면 이전 `WORKDIR`에 **누적**된다. 절대 경로로 지정하면 이전 값을 무시하고 리셋된다.

## ENV 변수와 결합

```dockerfile
ENV APP_HOME=/app
WORKDIR $APP_HOME
# 실제 경로: /app

ARG BUILD_ENV=production
WORKDIR /workspace/$BUILD_ENV
# 실제 경로: /workspace/production
```

`WORKDIR` 인수에서 `ENV`와 `ARG`로 정의한 변수를 참조할 수 있다. 여러 스테이지에서 같은 경로를 반복할 때 변수로 중앙화하면 변경이 편리하다.

## 멀티 스테이지 빌드에서의 WORKDIR

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /build
COPY . .
RUN npm ci && npm run build

FROM nginx:alpine
WORKDIR /usr/share/nginx/html
# builder 스테이지의 /build/dist 를 현재 WORKDIR로 복사
COPY --from=builder /build/dist .
```

각 스테이지는 독립된 `WORKDIR`을 가진다. `COPY --from`의 목적지를 `.`로 쓰면 현재 스테이지의 `WORKDIR`이 기준이 된다.

## 베스트 프랙티스

```dockerfile
# 권장 패턴
FROM python:3.12-slim
WORKDIR /app

# 의존성 먼저, 소스 나중 (캐시 최적화)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# WORKDIR 덕분에 파일명만 쓰면 됨
CMD ["python", "main.py"]
```

- **OS 루트(`/`)를 작업 디렉터리로 쓰지 않는다** — 기존 파일을 덮어쓸 위험이 있다
- **`/app`, `/workspace`, `/srv`, `/code` 등 의미 있는 경로**를 사용한다
- Dockerfile 상단에 한 번 선언하고, 중간에 절대 경로로 리셋이 필요한 경우에만 추가 사용한다
- `RUN mkdir -p /app && cd /app` 패턴을 발견하면 `WORKDIR /app` 한 줄로 대체한다

## 핵심 정리

- `WORKDIR`은 디렉터리가 없으면 **자동 생성**한다
- `RUN cd`와 달리 **레이어 경계를 넘어** 유지된다
- 상대 경로는 이전 `WORKDIR`에 누적, 절대 경로는 리셋
- `ENV`·`ARG` 변수를 `$VAR` 형식으로 참조할 수 있다
- 컨테이너 진입 시(`docker exec bash`) 시작 디렉터리도 `WORKDIR`이다

---

**지난 글:** [COPY vs ADD: 무엇을 써야 하는가](/posts/dockerfile-copy-vs-add/)

**다음 글:** [ENV vs ARG: 환경변수와 빌드 인수](/posts/dockerfile-env-arg/)

<br>
읽어주셔서 감사합니다. 😊
