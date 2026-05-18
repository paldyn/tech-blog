---
title: "Docker Compose logs/ps: 서비스 상태 조회와 로그 분석"
description: "compose logs의 -f·--tail·--since 옵션, compose ps로 서비스 상태 확인, compose top으로 프로세스 조회, 실전 디버깅 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 8
type: "knowledge"
category: "Docker"
tags: ["docker", "compose", "logs", "ps", "top", "모니터링", "디버깅"]
featured: false
draft: false
---

[지난 글](/posts/compose-up-down/)에서 서비스를 시작하고 종료하는 방법을 살펴봤다. 이번에는 실행 중인 서비스의 상태를 확인하고 로그를 분석하는 `logs`·`ps`·`top` 명령을 정리한다.

## compose ps — 서비스 상태 한눈에

```bash
docker compose ps
```

각 서비스의 컨테이너 이름, 이미지, 상태, 포트 매핑을 테이블로 출력한다. `(healthy)`, `(unhealthy)`, `Exited (0)` 같은 상태 표시로 문제를 빠르게 파악할 수 있다.

```bash
docker compose ps -a                   # 종료된 컨테이너도 포함
docker compose ps --status running     # running 상태만
docker compose ps --status exited      # 종료된 것만
docker compose ps --format json        # JSON 출력 (스크립트용)
```

![compose logs/ps 조회 다이어그램](/assets/posts/compose-logs-ps-diagram.svg)

## compose logs — 로그 조회

기본 명령은 모든 서비스의 로그를 혼합해서 출력한다. 서비스 이름으로 필터링할 수 있다.

```bash
docker compose logs            # 전체 서비스 로그
docker compose logs api        # api 서비스만
docker compose logs web api    # web과 api 동시에
```

### 주요 옵션

**`-f` / `--follow`** — 실시간으로 새 로그를 스트리밍한다. `tail -f`와 같은 방식이다.

**`--tail=N`** — 마지막 N줄만 출력한다. 기본값은 `all`로 전체 출력이라 컨테이너 로그가 많으면 느릴 수 있다.

```bash
docker compose logs --tail=100          # 마지막 100줄
docker compose logs --tail=0 -f         # 신규 로그만 스트리밍
```

**`-t` / `--timestamps`** — 각 줄에 타임스탬프를 붙인다. 여러 서비스 로그를 같이 볼 때 순서 파악에 필수다.

**`--since`** — 특정 시점 이후 로그만 출력한다.

```bash
docker compose logs --since=10m         # 최근 10분
docker compose logs --since=2026-05-18  # 날짜 기준
docker compose logs --since=10m -f -t   # 최근 10분 + 실시간 + 타임스탬프
```

## 실전 디버깅 조합

```bash
# 에러 로그 검색
docker compose logs api | grep -i error

# 최근 5분 api 로그를 타임스탬프와 함께 실시간으로
docker compose logs -f -t --since=5m api

# 특정 패턴이 나올 때까지 기다리기 (CI에서 유용)
docker compose logs -f api | grep -m1 "Application started"
```

![compose logs/ps 명령 코드 예시](/assets/posts/compose-logs-ps-code.svg)

## compose top — 컨테이너 내부 프로세스

```bash
docker compose top           # 모든 서비스의 프로세스 목록
docker compose top web       # web 서비스만
```

각 컨테이너에서 실행 중인 프로세스의 PID, UID, 명령을 호스트 관점에서 보여준다. 좀비 프로세스나 예상치 못한 프로세스가 실행 중인지 확인할 때 유용하다.

## compose events — 이벤트 스트림

서비스 생명주기 이벤트(start, stop, die, health_status 등)를 실시간으로 확인한다.

```bash
docker compose events        # 모든 서비스 이벤트
docker compose events --json # JSON 형식
```

## compose port — 포트 매핑 확인

```bash
docker compose port web 80   # web 서비스의 80번 포트가 호스트 어디에 매핑됐는지
```

`--publish 0:80`처럼 랜덤 포트를 사용할 때 실제 할당된 포트를 확인하는 데 쓴다.

## 모니터링 스크립트 예시

```bash
#!/bin/bash
# 서비스 중 unhealthy인 것 감지
unhealthy=$(docker compose ps --format json \
  | python3 -c "
import sys, json
for c in json.load(sys.stdin):
    if 'unhealthy' in c.get('Status',''):
        print(c['Name'])
")

if [ -n "$unhealthy" ]; then
  echo "Unhealthy: $unhealthy"
  docker compose logs --tail=50 "${unhealthy##*-}"
fi
```

## 멀티 서비스 로그 색상 구분

`docker compose logs`는 서비스별로 색상이 다른 접두사를 붙여 여러 서비스 로그를 동시에 추적할 때 시각적으로 구분하기 쉽게 해준다. 색상이 필요 없는 파이프 환경에서는 `--no-color`를 쓴다.

```bash
docker compose logs -f web api db --no-color 2>&1 | tee debug.log
```

---

**지난 글:** [Docker Compose up/down: 서비스 생명주기 완전 정복](/posts/compose-up-down/)

**다음 글:** [Docker 재시작 정책: restart 완전 정복](/posts/docker-restart-policy/)

<br>
읽어주셔서 감사합니다. 😊
