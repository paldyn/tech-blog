---
title: "Shell 폼 vs Exec 폼 완전 정복"
description: "Dockerfile의 RUN, CMD, ENTRYPOINT에서 Shell 폼과 Exec 폼의 차이, 프로세스 트리, 시그널 전달 문제, 환경변수 확장을 실전 예시와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 3
type: "knowledge"
category: "Docker"
tags: ["docker", "dockerfile", "shell form", "exec form", "CMD", "ENTRYPOINT", "시그널"]
featured: false
draft: false
---

[지난 글](/posts/dockerfile-onbuild/)에서 자식 이미지에 동작을 예약하는 ONBUILD를 살펴봤다. 이번에는 Dockerfile 초보자가 가장 많이 헷갈리는 개념 중 하나인 **Shell 폼과 Exec 폼**의 차이를 정확히 짚는다.

## 두 가지 폼이란

`RUN`, `CMD`, `ENTRYPOINT` 인스트럭션은 명령을 두 가지 방식으로 표현할 수 있다.

```dockerfile
# Shell 폼 — 문자열
RUN apt-get update && apt-get install -y vim
CMD node server.js

# Exec 폼 — JSON 배열
RUN ["apt-get", "update"]
CMD ["node", "server.js"]
```

겉보기에는 작은 차이지만, 실제 동작 방식이 근본적으로 다르다.

![Shell 폼 vs Exec 폼 비교](/assets/posts/dockerfile-shell-exec-comparison.svg)

## 내부 동작 차이

**Shell 폼**은 내부적으로 `/bin/sh -c "<명령>"`으로 실행된다. 따라서 셸 프로세스가 PID 1을 차지하고, 실제 애플리케이션은 자식 프로세스가 된다.

**Exec 폼**은 셸을 거치지 않고 `exec()` 시스템 콜로 직접 실행된다. 명령이 PID 1이 된다.

```bash
# Shell 폼으로 시작한 컨테이너의 프로세스 트리
PID 1: /bin/sh -c "node server.js"
  PID 7: node server.js       ← 실제 앱

# Exec 폼으로 시작한 컨테이너의 프로세스 트리
PID 1: node server.js         ← 실제 앱이 직접 PID 1
```

## 시그널 전달 문제

![시그널 전달 — Shell 폼의 함정](/assets/posts/dockerfile-shell-exec-signal.svg)

`docker stop`은 컨테이너의 PID 1에 `SIGTERM`을 보낸다. Shell 폼으로 실행했다면 PID 1은 `/bin/sh`이고, sh는 기본적으로 SIGTERM을 자식 프로세스에 전달하지 않는다. 10초 후 Docker는 강제로 `SIGKILL`을 보낸다.

결과적으로 애플리케이션이 graceful shutdown할 기회를 얻지 못한다. 열려 있는 DB 커넥션이 끊기거나, 진행 중인 트랜잭션이 롤백되거나, 캐시를 flush하지 못하는 문제가 생긴다.

**CMD와 ENTRYPOINT는 항상 Exec 폼을 써야 하는 이유**가 바로 이것이다.

## 환경변수 확장

Shell 폼은 셸을 거치므로 환경변수 확장이 자동으로 된다.

```dockerfile
ENV PORT=3000
CMD node server.js --port $PORT   # Shell 폼 → 정상 동작
CMD ["node", "server.js", "--port", "$PORT"]  # Exec 폼 → $PORT 그대로 전달 (오류)
```

Exec 폼에서 환경변수를 써야 한다면 명시적으로 셸을 호출한다.

```dockerfile
CMD ["sh", "-c", "node server.js --port $PORT"]
```

## RUN에서의 권장 방법

`RUN`에서는 파이프, 리다이렉션, 환경변수가 자주 필요하므로 Shell 폼이 일반적이다.

```dockerfile
# Shell 폼 — 파이프, &&, 환경변수 모두 가능
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl vim && \
    rm -rf /var/lib/apt/lists/*

# 위와 동일한 Exec 폼 (불편하고 장황함)
RUN ["sh", "-c", "apt-get update && apt-get install -y curl vim"]
```

## ENTRYPOINT + CMD 조합

Exec 폼에서 ENTRYPOINT와 CMD를 함께 쓰면 CMD가 ENTRYPOINT의 인수로 전달된다.

```dockerfile
ENTRYPOINT ["node"]
CMD ["server.js"]
# 결과: node server.js

# docker run 시 CMD 오버라이드 가능
# docker run myimage app.js → node app.js
```

Shell 폼 ENTRYPOINT는 CMD와 docker run 인수를 모두 무시한다. ENTRYPOINT를 Shell 폼으로 쓰면 CMD 오버라이드가 불가능해진다.

```dockerfile
# 잘못된 패턴 — Shell 폼 ENTRYPOINT
ENTRYPOINT node server.js   # docker run 인수 무시됨
```

## 정리표

| 인스트럭션 | 권장 폼 | 이유 |
|---|---|---|
| `RUN` | Shell 폼 | 파이프, &&, 환경변수 필요 |
| `CMD` | Exec 폼 | 시그널 정상 전달 |
| `ENTRYPOINT` | Exec 폼 | CMD 인수 결합, 시그널 전달 |

## 흔한 실수

```dockerfile
# 실수 1: CMD Shell 폼으로 graceful shutdown 안 됨
CMD python manage.py runserver   # /bin/sh -c ... → SIGTERM 못 받음

# 수정
CMD ["python", "manage.py", "runserver"]

# 실수 2: Exec 폼에서 환경변수 확장 안 됨
CMD ["sh", "-c", "exec python app.py --host $HOST"]  # exec로 감싸야 PID 1 유지
```

`sh -c`로 감쌀 때 `exec` 키워드를 앞에 붙이면 sh가 exec로 교체되어 앱이 PID 1을 차지할 수 있다.

## 핵심 정리

- Shell 폼: 셸(`/bin/sh -c`)을 거쳐 실행, 환경변수·파이프 지원
- Exec 폼: 직접 exec, 셸 없음, 시그널 정상 전달
- `CMD`, `ENTRYPOINT`는 반드시 Exec 폼 — graceful shutdown 보장
- `RUN`은 Shell 폼이 편리 (파이프, 조건, 환경변수)
- Exec 폼에서 환경변수가 필요하면 `["sh", "-c", "exec ..."]` 패턴 사용

---

**지난 글:** [ONBUILD 인스트럭션 완전 정복](/posts/dockerfile-onbuild/)

**다음 글:** [Dockerfile 레이어 캐시 전략](/posts/dockerfile-cache-strategy/)

<br>
읽어주셔서 감사합니다. 😊
