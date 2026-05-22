---
title: "실패한 컨테이너 원인 분석하기"
description: "종료 코드별 실패 원인 분류, OOM 분석, 종료된 컨테이너에서 로그와 파일 추출, entrypoint 교체로 내부 진입하는 실전 디버깅 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 7
type: "knowledge"
category: "Docker"
tags: ["docker", "debug", "exitcode", "OOM", "CrashLoop", "디버깅", "트러블슈팅"]
featured: false
draft: false
---

[지난 글](/posts/docker-debug-running-container/)에서 실행 중인 컨테이너를 디버깅하는 방법을 다뤘다. 이번엔 더 까다로운 상황 — 컨테이너가 시작되자마자 종료되거나, 반복적으로 재시작하는 경우를 다룬다.

## 종료 코드(Exit Code) 해석

컨테이너가 종료되면 반드시 종료 코드를 확인한다. 코드 자체가 원인을 가리키는 경우가 많다.

| 코드 | 의미 | 주요 원인 |
|------|------|-----------|
| 0 | 정상 종료 | 의도적 종료 (배치 작업 완료 등) |
| 1 | 애플리케이션 오류 | 예외 처리되지 않은 오류, 설정 오류 |
| 2 | 잘못된 사용 | 셸 명령 오류 |
| 126 | 권한 없음 | 실행 권한 없는 바이너리 |
| 127 | 명령 없음 | ENTRYPOINT 바이너리 경로 오류 |
| 137 | SIGKILL | OOM Killer 또는 `docker kill` |
| 139 | Segfault | SIGSEGV — 잘못된 메모리 접근 |
| 143 | SIGTERM | 정상 종료 신호 (graceful shutdown) |

![컨테이너 실패 원인 분류](/assets/posts/docker-debug-failed-container-causes.svg)

## 기본 진단 절차

```bash
# 종료된 컨테이너 목록
docker ps -a --filter status=exited

# 종료 코드 + OOM 여부 확인
docker inspect myapp | jq '.[0].State | {ExitCode, Error, OOMKilled, FinishedAt}'

# 마지막 로그 확인 (종료됐어도 로그 남아있음)
docker logs myapp 2>&1 | tail -50
```

## 종료 코드별 대응

### ExitCode 127: 바이너리 없음

```bash
# ENTRYPOINT 경로 확인
docker inspect myapp --format '{{.Config.Entrypoint}}'
docker inspect myapp --format '{{.Config.Cmd}}'

# 임시 컨테이너에서 경로 확인
docker run --rm --entrypoint sh myapp:latest -c "which myapp; ls -la /app/"
```

### ExitCode 1: 앱 오류/설정 누락

```bash
# 환경변수 확인
docker run --rm --entrypoint env myapp:latest | sort

# 필요한 env 없이 실행해 오류 메시지 확인
docker run --rm myapp:latest

# 의존 서비스 없이 실행 시 오류가 나면
# 환경변수 주입 + 네트워크 연결로 재시도
docker run --rm \
  -e DATABASE_URL=postgres://localhost:5432/mydb \
  --network mynet \
  myapp:latest
```

### ExitCode 137: OOM (메모리 부족)

```bash
# OOM 확인
docker inspect myapp | jq '.[0].State.OOMKilled'
# true → OOM

# 호스트 커널 로그에서 OOM 이벤트 확인
dmesg | grep -E "oom|Out of memory|killed process" | tail -20
journalctl -k --since="1 hour ago" | grep -i oom

# 메모리 사용량 기록 (컨테이너 실행 중일 때)
docker stats --no-stream myapp

# 메모리 제한 늘리기 (임시 검증)
docker run -m 512m myapp:latest
```

![종료된 컨테이너 분석 명령](/assets/posts/docker-debug-failed-container-recovery.svg)

## 핵심 기법: ENTRYPOINT 교체

컨테이너가 시작되자마자 종료된다면, ENTRYPOINT를 `sh`나 `sleep`으로 교체해 내부 상태를 확인할 수 있다.

```bash
# 같은 이미지로 셸 진입
docker run --rm -it --entrypoint sh myapp:latest

# sleep으로 시작 후 exec으로 진입
docker run -d --entrypoint sleep --name debug-myapp myapp:latest 3600
docker exec -it debug-myapp sh

# 컨테이너 내부에서 실제 엔트리포인트 수동 실행
# /app/server --config /etc/app/config.yaml
```

이 방법은 시작 시 오류가 나는 경우를 재현하면서 파일/권한/환경변수를 직접 확인하는 데 매우 효과적이다.

## 종료된 컨테이너에서 파일 추출

컨테이너가 이미 종료됐어도 삭제되지 않으면 레이어가 남아 있다. `docker cp`와 `docker export`로 파일을 추출할 수 있다.

```bash
# 특정 파일 복사
docker cp myapp:/app/logs/error.log ./error.log
docker cp myapp:/etc/app/config.yaml ./config.yaml

# 전체 파일시스템 덤프
docker export myapp | tar -xf - -C ./fs-dump/

# 로그 파일 목록만 확인
docker export myapp | tar -tf - | grep -E "\.log$"
```

## 의존성 순서 문제 (depends_on 한계)

Compose에서 `depends_on`은 컨테이너 **시작**만 기다리고, 서비스 **준비**는 기다리지 않는다. DB가 아직 초기화 중일 때 앱이 시작해 연결 실패로 종료되는 경우가 많다.

```yaml
# compose.yml — 헬스체크 기반 대기
services:
  db:
    image: postgres:16
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 10

  app:
    image: myapp:latest
    depends_on:
      db:
        condition: service_healthy  # db가 healthy 상태가 될 때까지 대기
```

또는 앱 코드 수준에서 재시도 로직(exponential backoff)을 구현하는 것이 더 견고하다.

## CrashLoop 디버깅

재시작 정책 `always`나 `on-failure`로 인해 컨테이너가 무한 재시작하는 경우 로그 창이 너무 빠르게 지나간다.

```bash
# 재시작 횟수 확인
docker inspect myapp --format '{{.RestartCount}}'

# 마지막 재시작 시점의 로그 (--previous는 Docker에서 안 되지만)
# 대신 timestamps로 최근 재시작 이후 로그만 보기
docker logs --since="5m" myapp

# 재시작 정책을 no로 바꿔 한 번만 실행
docker update --restart no myapp
docker stop myapp
docker start myapp  # 한 번 실행 후 종료됨 → 로그 천천히 분석
```

## Dockerfile 오류로 인한 빌드 실패

빌드 실패는 컨테이너 실패와 다르지만 자주 혼동된다.

```bash
# BuildKit 활성화 후 상세 오류 확인
DOCKER_BUILDKIT=1 docker build --progress=plain . 2>&1 | tail -30

# 특정 레이어에서 실패하면 그 이전 레이어까지 이미지 생성됨
# --target으로 중간 단계 이미지 빌드 후 진입
docker build --target build-stage -t debug-build .
docker run --rm -it debug-build sh
```

---

**지난 글:** [실행 중인 컨테이너 디버깅 전략](/posts/docker-debug-running-container/)

**다음 글:** [컨테이너에 셸로 접속하기: exec, attach, nsenter](/posts/docker-shell-into/)

<br>
읽어주셔서 감사합니다. 😊
