---
title: "컨테이너 중지·시작·재시작 — stop, start, restart 명령"
description: "docker stop, start, restart 명령의 동작 원리, SIGTERM→SIGKILL 종료 시퀀스, grace period 조정, 그리고 restart 명령이 내부적으로 하는 일을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 3
type: "knowledge"
category: "Docker"
tags: ["Docker", "docker stop", "docker start", "docker restart", "SIGTERM", "라이프사이클"]
featured: false
draft: false
---

[지난 글](/posts/docker-ps/)에서 실행 중인 컨테이너를 조회하는 방법을 익혔습니다. 이번에는 컨테이너를 중지하고, 다시 시작하고, 재시작하는 세 명령의 동작 원리를 살펴봅니다.

## 컨테이너 상태 전환 전체 그림

컨테이너는 `Created → Running → Exited → Removed` 경로를 따릅니다.

![컨테이너 라이프사이클](/assets/posts/docker-stop-start-restart-lifecycle.svg)

`docker stop`은 `Running → Exited`, `docker start`는 `Exited → Running`, `docker restart`는 `Running → Exited → Running` 순서로 상태를 전환합니다.

## docker stop — 정상 종료

```bash
docker stop web               # 기본 grace period 10초
docker stop -t 30 web         # grace period 30초로 연장
docker stop web db cache      # 여러 컨테이너 동시 중지
```

`docker stop`은 컨테이너의 PID 1 프로세스에 **SIGTERM**을 먼저 보냅니다. 프로세스가 자체적으로 종료 처리를 마치면 즉시 종료됩니다. 지정 시간(grace period) 내에 종료하지 않으면 **SIGKILL**로 강제 종료합니다.

![docker stop 종료 시퀀스](/assets/posts/docker-stop-start-restart-signals.svg)

grace period를 길게 설정해야 하는 경우는 다음과 같습니다.

- 데이터베이스: 트랜잭션 커밋, WAL 플러시
- 웹 서버: 처리 중인 요청 완료(connection drain)
- 메시지 브로커: 미처리 메시지 flush

Dockerfile에서 기본 종료 시그널을 변경할 수도 있습니다.

```dockerfile
STOPSIGNAL SIGQUIT
```

## docker start — 재시작

```bash
docker start web          # 컨테이너를 백그라운드에서 시작
docker start -ai web      # 컨테이너를 붙여서(attach + interactive) 시작
```

`docker start`는 `docker run`과 달리 **이미 존재하는 컨테이너**를 다시 실행합니다. 이전 `docker run` 때 지정한 옵션(-p, -v, -e 등)이 그대로 적용됩니다. 새 이미지로 교체하려면 컨테이너를 삭제하고 `docker run`을 다시 실행해야 합니다.

## docker restart — 재시작

```bash
docker restart web
docker restart -t 5 web   # grace period 5초 후 강제 재시작
```

`docker restart`는 내부적으로 `docker stop` 후 `docker start`를 순서대로 실행합니다. 설정 변경 없이 프로세스를 새로 띄우고 싶을 때 사용합니다. `-t` 옵션으로 stop 단계의 grace period를 지정합니다.

## 여러 컨테이너 한번에 제어

```bash
# 이름 패턴으로 선택해 중지
docker stop $(docker ps -qf name=app)

# 모든 실행 중인 컨테이너 중지
docker stop $(docker ps -q)

# 특정 이미지 기반 컨테이너 재시작
docker restart $(docker ps -qf ancestor=nginx)
```

## docker kill — 즉시 강제 종료

```bash
docker kill web              # SIGKILL (grace period 없음)
docker kill --signal SIGUSR1 web   # 커스텀 시그널 전송
```

`docker stop`과 달리 grace period가 없습니다. 프로세스가 응답하지 않거나 즉시 종료가 필요할 때만 사용합니다. 일반적인 운영에서는 `docker stop`을 우선합니다.

## 정리

`stop`은 부드럽고, `kill`은 즉각적입니다. grace period를 서비스 특성에 맞게 조정하고, `STOPSIGNAL`을 Dockerfile에 명시해 두면 예측 가능한 종료 동작을 보장할 수 있습니다.

---

**지난 글:** [docker ps — 실행 중인 컨테이너 조회 완전 정복](/posts/docker-ps/)

**다음 글:** [docker rm — 컨테이너 삭제 완전 정복](/posts/docker-rm/)

<br>
읽어주셔서 감사합니다. 😊
