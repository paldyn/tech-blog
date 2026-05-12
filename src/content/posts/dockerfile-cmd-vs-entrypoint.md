---
title: "CMD vs ENTRYPOINT: 컨테이너 시작 명령"
description: "Dockerfile CMD와 ENTRYPOINT의 역할 차이, shell form과 exec form, 두 인스트럭션을 함께 쓰는 패턴, PID 1 시그널 처리, 런타임 오버라이드 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 7
type: "knowledge"
category: "Docker"
tags: ["docker", "dockerfile", "CMD", "ENTRYPOINT", "시작명령", "PID1", "시그널처리"]
featured: false
draft: false
---

[지난 글](/posts/dockerfile-env-arg/)에서 ENV와 ARG로 값을 주입하는 방법을 알아봤다. 이번에는 컨테이너 시작 명령을 정의하는 `CMD`와 `ENTRYPOINT`, 그리고 두 인스트럭션이 만날 때 어떤 일이 벌어지는지 정리한다.

## 두 인스트럭션의 역할 구분

- `ENTRYPOINT` — 컨테이너의 **실행 파일**을 고정한다. `docker run`에 인수를 넘겨도 덮어쓸 수 없다(단, `--entrypoint` 플래그로 강제 교체 가능).
- `CMD` — 컨테이너의 **기본 인수**를 정의한다. `docker run`에 인수를 주면 쉽게 교체된다.

```dockerfile
# CMD만 있을 때
CMD ["node", "server.js"]
# docker run img          → node server.js
# docker run img bash     → bash (CMD가 교체됨)
```

## Shell Form vs Exec Form

두 인스트럭션 모두 두 가지 형식을 지원한다.

```dockerfile
# Shell form — /bin/sh -c로 실행됨
CMD node server.js
ENTRYPOINT node server.js

# Exec form — exec() 직접 실행, PID 1이 됨 (권장)
CMD ["node", "server.js"]
ENTRYPOINT ["node", "server.js"]
```

**Exec form을 권장하는 이유**: Shell form으로 실행하면 `sh`가 PID 1이 되고, `node`는 자식 프로세스로 실행된다. `docker stop`이 보내는 `SIGTERM`이 `sh`에만 전달되어 `node`는 시그널을 받지 못한다. Exec form은 `node`가 직접 PID 1이 되므로 시그널이 정확히 전달된다.

## ENTRYPOINT + CMD 조합 매트릭스

![CMD vs ENTRYPOINT 조합 매트릭스](/assets/posts/dockerfile-cmd-vs-entrypoint-matrix.svg)

가장 중요한 조합은 **ENTRYPOINT exec form + CMD exec form**이다.

```dockerfile
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
```

- `docker run img` → `nginx -g "daemon off;"`
- `docker run img -t` → `nginx -t` (CMD가 `-t`로 교체됨)

`CMD`가 `ENTRYPOINT`의 기본 인수 역할을 한다. `docker run`에 인수를 넘기면 `CMD`만 교체되고 `ENTRYPOINT`는 유지된다.

## 실전 패턴

![실전 패턴: ENTRYPOINT + CMD](/assets/posts/dockerfile-cmd-vs-entrypoint-patterns.svg)

### 래퍼 스크립트 패턴

```bash
#!/bin/sh
# docker-entrypoint.sh

# DB 마이그레이션 등 초기화 작업
./migrate.sh

# CMD로 넘어온 인수를 exec로 실행 (PID 1 유지)
exec "$@"
```

```dockerfile
COPY docker-entrypoint.sh /
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "server.js"]
```

래퍼 스크립트에서 초기화 로직을 수행하고 마지막에 `exec "$@"`를 호출하면, `CMD`로 넘어온 명령이 PID 1을 이어받는다. 이 패턴은 MySQL, Redis, Nginx 공식 이미지에서도 사용된다.

### CLI 도구 이미지

```dockerfile
FROM alpine
ENTRYPOINT ["curl"]
CMD ["--help"]
# docker run curl-img https://example.com → ENTRYPOINT 고정, URL이 CMD 교체
```

도구 이미지를 만들 때 `ENTRYPOINT`로 실행 파일을 고정하면 사용자가 항상 같은 도구를 사용하면서 인수만 바꿀 수 있다.

## 런타임 오버라이드

```bash
# CMD 교체 (ENTRYPOINT 유지)
docker run myimage sh

# ENTRYPOINT 교체
docker run --entrypoint /bin/bash myimage

# Compose에서 오버라이드
services:
  app:
    entrypoint: ["/bin/sh"]
    command: ["-c", "echo hello"]
```

## PID 1과 좀비 프로세스

```dockerfile
# tini를 init 프로세스로 사용해 좀비 프로세스 방지
FROM node:20-alpine
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
```

또는 `docker run --init`으로 tini 없이도 같은 효과를 얻을 수 있다. PID 1 프로세스가 시그널을 올바르게 처리하지 못하면 컨테이너가 30초 강제 종료 대기에 빠진다.

## 핵심 정리

- `CMD`는 기본 인수 — `docker run` 인수로 쉽게 교체 가능
- `ENTRYPOINT`는 실행 파일 — `--entrypoint`로만 교체 가능
- **Exec form(`["cmd","arg"]`)을 사용**해야 시그널이 PID 1로 정확히 전달됨
- ENTRYPOINT + CMD 조합으로 고정 실행파일 + 교체 가능한 기본 인수를 구현
- 래퍼 스크립트 마지막에 반드시 `exec "$@"` 호출

---

**지난 글:** [ENV vs ARG: 환경변수와 빌드 인수](/posts/dockerfile-env-arg/)

**다음 글:** [EXPOSE 인스트럭션 완전 정복](/posts/dockerfile-expose/)

<br>
읽어주셔서 감사합니다. 😊
