---
title: "kill과 시그널 — 프로세스에 명령을 보내는 방법"
description: "리눅스 시그널의 개념, SIGTERM·SIGKILL·SIGHUP 등 주요 시그널의 의미와 차이, kill 명령어 사용법, bash trap으로 시그널 핸들러를 등록하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["linux", "kill", "signals", "sigterm", "sigkill", "sighup", "trap", "process"]
featured: false
draft: false
---

[지난 글](/posts/linux-top-htop/)에서 `top`과 `htop`으로 프로세스를 실시간 모니터링하는 법을 다뤘습니다. 모니터링 중 문제가 된 프로세스를 종료하거나 제어해야 할 때 필요한 도구가 바로 **시그널(Signal)**과 `kill`입니다.

## 시그널이란

시그널은 **운영체제가 프로세스에게 비동기적으로 보내는 짧은 알림**입니다. 프로세스는 시그널을 받으면 기본 동작을 수행하거나, 미리 등록한 핸들러 함수를 실행하거나, 시그널을 무시할 수 있습니다. 단, SIGKILL과 SIGSTOP은 예외로 커널이 강제 처리하여 프로세스가 캐치하거나 무시할 수 없습니다.

![리눅스 주요 시그널 표](/assets/posts/linux-kill-signals-table.svg)

## kill 명령어

이름은 `kill`이지만 사실 **시그널을 보내는 명령어**입니다. 시그널을 지정하지 않으면 기본적으로 SIGTERM(15)을 보냅니다.

```bash
# 기본: SIGTERM(15) 전송
kill 1234

# 강제 종료: SIGKILL(9)
kill -9 1234
kill -KILL 1234

# 설정 리로드: SIGHUP(1)
kill -HUP $(cat /run/nginx.pid)
kill -1 $(pidof nginx | awk '{print $1}')

# 프로세스 일시 정지: SIGSTOP
kill -STOP 1234

# 정지된 프로세스 재개: SIGCONT
kill -CONT 1234
```

`kill -l`로 시스템에서 지원하는 모든 시그널 목록을 확인할 수 있습니다.

## SIGTERM vs SIGKILL

가장 중요한 구분입니다.

| | SIGTERM (15) | SIGKILL (9) |
|--|------|-----|
| 프로세스 처리 | 핸들러 등록 가능 | 불가 — 커널 강제 |
| 정리(cleanup) | 가능 (임시 파일 삭제, 연결 종료) | 불가 |
| 데이터 일관성 | 높음 | 위험 |
| 사용 시점 | 기본 종료 요청 | SIGTERM으로 안 죽을 때 최후 수단 |

올바른 순서: SIGTERM 전송 → 몇 초 대기 → 아직 살아있으면 SIGKILL.

```bash
# 정중하게 먼저, 그래도 안 되면 강제 종료
kill -TERM 1234
sleep 5
kill -0 1234 2>/dev/null && kill -KILL 1234
```

`kill -0 PID`는 실제 시그널을 보내지 않고 **프로세스가 존재하는지만 확인**합니다. 종료 코드 0이면 살아있음, 1이면 없음.

## 프로세스 그룹에 시그널 보내기

PID 앞에 음수 부호를 붙이면 **해당 PGID 전체**에 시그널이 전송됩니다.

```bash
# PGID 1234에 속한 모든 프로세스에 SIGTERM
kill -TERM -1234

# 현재 셸 프로세스 그룹의 PGID 확인
ps -o pgid= -p $$

# 파이프라인 프로세스 그룹 종료
kill -TERM -$(ps -o pgid= -p $! | tr -d ' ')
```

## bash trap — 시그널 핸들러 등록

![kill 명령어 사용 패턴과 bash trap](/assets/posts/linux-kill-signals-code.svg)

스크립트가 종료될 때 임시 파일 삭제 같은 정리 작업을 하려면 `trap`으로 핸들러를 등록합니다.

```bash
#!/bin/bash
TMPFILE=$(mktemp)

cleanup() {
    echo "정리 중: $TMPFILE 삭제"
    rm -f "$TMPFILE"
    exit 0
}

# SIGTERM, SIGINT(Ctrl+C), EXIT(정상 종료) 모두 처리
trap cleanup SIGTERM SIGINT EXIT

echo "작업 시작. PID=$$"
echo "데이터" > "$TMPFILE"
sleep 60
```

`EXIT`에 trap을 걸면 시그널 수신뿐 아니라 스크립트가 어떻게든 종료될 때 항상 cleanup이 실행됩니다.

## 특수 용도 시그널

```bash
# nginx: SIGHUP으로 설정 무중단 리로드
kill -HUP $(cat /run/nginx.pid)

# logrotate: SIGUSR1로 로그 파일 재열기
kill -USR1 $(cat /run/syslog.pid)

# Java GC 강제 실행 (JVM 내부 신호)
kill -QUIT $(pgrep -f MyApp)   # 스레드 덤프 출력

# Ctrl+C 와 같음
kill -INT $(pgrep -n sleep)
```

데몬은 보통 SIGHUP을 "설정 파일 다시 읽기"로, SIGUSR1/SIGUSR2를 애플리케이션 정의 동작으로 사용합니다. 사용 중인 데몬의 man 페이지에서 어떤 시그널을 지원하는지 확인하는 습관을 들이세요.

## 시그널 확인 및 디버깅

```bash
# 프로세스가 블로킹하는 시그널 확인 (/proc/[pid]/status)
grep -E "^Sig(Blk|Ign|Cgt)" /proc/1234/status

# strace로 시그널 수신 관찰
strace -e signal -p 1234

# 시그널 이름 ↔ 번호 변환
kill -l TERM     # 출력: 15
kill -l 9        # 출력: KILL
```

---

**지난 글:** [top과 htop — 실시간 프로세스 모니터링](/posts/linux-top-htop/)

**다음 글:** [nice와 renice — 프로세스 CPU 우선순위 조정](/posts/linux-nice-renice/)

<br>
읽어주셔서 감사합니다. 😊
