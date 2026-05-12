---
title: "pgrep과 pkill — 이름으로 프로세스 찾기와 종료"
description: "ps+grep+kill 파이프라인의 문제점, pgrep으로 이름·사용자·커맨드라인으로 PID 조회, pkill로 한 번에 시그널 전송하는 방법과 주요 옵션을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["linux", "pgrep", "pkill", "process", "kill", "signals", "monitoring", "psmisc"]
featured: false
draft: false
---

[지난 글](/posts/linux-nohup-disown/)에서 터미널 종료 후에도 프로세스를 유지하는 방법을 다뤘습니다. 이번엔 이름으로 프로세스를 찾아 시그널을 보내는 `pgrep`과 `pkill`을 살펴봅니다.

## 기존 방법의 문제

`nginx`를 재시작하려면 PID를 알아야 합니다. 전통적인 방법은 이렇습니다.

```bash
# ps + grep + kill 파이프라인
ps aux | grep nginx | grep -v grep | awk '{print $2}' | xargs kill -HUP
```

이 방식에는 몇 가지 문제가 있습니다. `grep nginx` 자체가 결과에 포함될 수 있고, `grep -v grep` 우회책은 불안정하며, 파이프라인이 길어 에러가 어디서 났는지 파악하기 어렵습니다.

![pgrep/pkill vs 기존 방법 비교](/assets/posts/linux-pgrep-pkill-compare.svg)

## pgrep — 이름으로 PID 조회

```bash
# nginx의 PID 목록
pgrep nginx

# PID + 프로세스 이름 함께 출력 (-a)
pgrep -a nginx

# 정확한 이름 매칭 (-x)
pgrep -x bash      # "bash"만, "bash5" 제외

# 가장 최근/오래된 프로세스 1개
pgrep -n nginx     # newest (PID가 가장 큰 것)
pgrep -o nginx     # oldest (PID가 가장 작은 것)
```

### -f 옵션: 전체 커맨드라인 매칭

기본적으로 `pgrep`은 프로세스 이름(`comm`)으로 매칭합니다. `-f`를 추가하면 인수를 포함한 **전체 커맨드라인**으로 매칭합니다.

```bash
# 포트 8080으로 실행된 gunicorn만
pgrep -f "gunicorn.*8080"

# 특정 스크립트를 실행 중인 python만
pgrep -f "python.*app.py"
pgrep -fa "python.*app.py"   # -a로 커맨드라인도 출력
```

### 필터 옵션

```bash
# 특정 사용자의 nginx만
pgrep -u www-data nginx

# 특정 PPID의 자식만
pgrep -P 1204       # nginx master(1204)의 워커들

# 여러 사용자
pgrep -u user1,user2 python
```

### 스크립트에서 활용

`pgrep`의 종료 코드를 활용하면 프로세스 존재 여부를 깔끔하게 확인할 수 있습니다.

```bash
# 0: 찾음, 1: 없음
if pgrep -x nginx > /dev/null; then
    echo "nginx 실행 중"
else
    echo "nginx 없음"
    sudo systemctl start nginx
fi
```

## pkill — 이름으로 시그널 전송

`pkill`은 `pgrep`과 동일한 필터 옵션으로 매칭되는 **모든 프로세스에 시그널**을 보냅니다.

```bash
# SIGTERM(기본) 전송
pkill nginx

# 시그널 지정
pkill -HUP nginx       # 설정 리로드
pkill -9 zombie_app    # 강제 종료

# 커맨드라인 패턴으로 매칭
pkill -f "celery worker"
pkill -f "python.*app.py"
```

![pgrep · pkill 주요 옵션](/assets/posts/linux-pgrep-pkill-options.svg)

### 안전한 사용: -e와 dry run

실수로 잘못된 프로세스를 죽이지 않으려면 먼저 `pgrep -a`로 대상을 확인합니다.

```bash
# 1단계: 대상 확인
pgrep -af "python.*worker"

# 2단계: 확인 후 pkill
pkill -f "python.*worker"

# -e 옵션: 어떤 프로세스에 시그널 보냈는지 출력
pkill -e nginx
# nginx killed (pid 1204)
# nginx killed (pid 1205)
```

### 특정 사용자 프로세스만

```bash
# alice 계정의 python 프로세스만 종료
pkill -u alice python

# www-data의 모든 프로세스 종료 (주의!)
pkill -u www-data
```

## 실전 패턴

```bash
# nginx 무중단 설정 리로드
pkill -HUP nginx

# 특정 포트의 서버 종료
pkill -f ":8080"

# 오래된 작업자 순차 재시작
while pgrep -f "old_worker" > /dev/null; do
    pkill -n -f "old_worker"   # 가장 오래된 것 하나씩
    sleep 1
done

# 프로세스 완전 종료 확인
pkill myapp && sleep 3 && pkill -0 myapp 2>/dev/null \
    && echo "아직 실행 중" || echo "종료 완료"
```

`pgrep`과 `pkill`은 `psmisc` 패키지에 포함됩니다. `pstree`와 같은 패키지이므로 이미 설치되어 있을 가능성이 높습니다.

---

**지난 글:** [nohup과 disown — 터미널 종료 후에도 프로세스 유지하기](/posts/linux-nohup-disown/)

**다음 글:** [프로세스 상태 완전 이해 — Running부터 Zombie까지](/posts/linux-process-states/)

<br>
읽어주셔서 감사합니다. 😊
