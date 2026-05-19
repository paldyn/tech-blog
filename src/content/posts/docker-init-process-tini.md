---
title: "Docker init 프로세스: tini로 좀비·시그널 문제 해결"
description: "컨테이너 PID 1의 init 역할, 좀비 프로세스 발생 원인, tini·dumb-init·docker --init 비교, Dockerfile 통합 방법, Compose init 설정을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 4
type: "knowledge"
category: "Docker"
tags: ["docker", "tini", "init", "PID1", "zombie", "dumb-init", "프로세스"]
featured: false
draft: false
---

[지난 글](/posts/docker-signal-propagation/)에서 PID 1이 시그널을 전파하지 않아 생기는 문제를 살펴봤다. 이번에는 그 해결책인 init 프로세스, 특히 tini가 무엇을 해결하고 어떻게 사용하는지를 정리한다.

## 컨테이너에서 init이 필요한 이유

Linux 시스템의 PID 1(init)은 두 가지 핵심 역할을 한다.

**시그널 전달** — SIGTERM처럼 시스템 종료 시그널을 받아 모든 자식 프로세스에 전달하고, 종료를 조율한다.

**좀비 수거** — 자식 프로세스가 종료되면 부모가 `wait()`로 상태를 수거해야 한다. 부모가 수거하기 전까지 해당 프로세스는 좀비 상태로 PID 테이블을 점유한다. 일반 프로세스가 PID 1이면 이 수거가 이루어지지 않아 PID가 고갈될 수 있다.

앱 프로세스가 PID 1이면 이 두 역할을 직접 구현해야 한다. 대부분의 앱은 그렇게 설계되지 않는다.

## tini란

tini는 컨테이너를 위해 설계된 매우 가벼운(~20KB) init 프로세스다. 딱 두 가지만 한다.

1. **SIGTERM을 자식 프로세스 그룹에 전달**한다.
2. **고아/좀비 프로세스를 `wait()`로 수거**한다.

![tini가 해결하는 두 가지 문제](/assets/posts/docker-init-tini-overview.svg)

## Dockerfile에 tini 추가

```dockerfile
FROM node:20-alpine

# apk로 tini 설치
RUN apk add --no-cache tini

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# tini를 ENTRYPOINT로, 앱을 CMD로
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
```

`--` 는 tini에게 이후 인자를 실행할 명령으로 전달하라는 구분자다.

**Debian/Ubuntu 기반:**

```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends tini \
    && rm -rf /var/lib/apt/lists/*
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["python", "app.py"]
```

## docker run --init 플래그

Dockerfile을 수정하지 않고도 런타임에 tini를 주입할 수 있다.

```bash
docker run --init myimage
```

Docker가 자체 내장 tini(`docker-init`)를 PID 1으로 삽입한다. 이미지를 수정할 수 없거나 빠른 테스트가 필요할 때 유용하다.

단, 이 방법은 런타임 플래그에 의존하므로 `--init` 없이 실행하면 효과가 없다. 프로덕션에서는 Dockerfile에 명시적으로 포함시키는 것이 낫다.

## Compose에서 init 설정

```yaml
services:
  app:
    image: myapp
    init: true          # docker run --init 과 동일
```

또는 tini가 이미지에 포함된 경우:

```yaml
services:
  app:
    build: .
    # ENTRYPOINT ["/sbin/tini", "--"] 이 Dockerfile에 있으면 별도 설정 불필요
```

## dumb-init: Python 생태계의 대안

Yelp가 만든 dumb-init도 tini와 유사한 역할을 한다. 특징적으로 **프로세스 그룹 전체에 시그널을 전달**한다. Python 이미지에서 자주 쓰인다.

```dockerfile
FROM python:3.11-slim
RUN pip install dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["gunicorn", "app:app"]
```

![init 프로세스 옵션 비교](/assets/posts/docker-init-tini-options.svg)

## 어떤 것을 선택할까

- **일반적인 경우**: tini (공식 init for containers, Docker 공식 이미지 다수 사용)
- **Dockerfile 수정 불가**: `docker run --init` 또는 Compose `init: true`
- **Python/pip 기반**: dumb-init
- **앱이 직접 시그널 처리**: tini 불필요하지만 좀비 수거 목적으로는 여전히 유용

## tini 동작 확인

```bash
# tini를 적용한 컨테이너에서 프로세스 트리 확인
docker run --rm -it --entrypoint /sbin/tini myimage -- ps aux

# PID 1이 tini인지 확인
docker exec <container> cat /proc/1/cmdline | tr '\0' ' '
```

tini가 PID 1이면 `/proc/1/cmdline`에 `tini`가 보인다.

---

**지난 글:** [Docker 시그널 전파: PID 1과 시그널 처리 완전 정복](/posts/docker-signal-propagation/)

**다음 글:** [Docker 좀비 프로세스: 발생 원인과 방지 전략](/posts/docker-zombie-process/)

<br>
읽어주셔서 감사합니다. 😊
