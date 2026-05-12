---
title: "nohup과 disown — 터미널 종료 후에도 프로세스 유지하기"
description: "SIGHUP이 프로세스를 종료시키는 원리, nohup으로 시작 전 보호, disown으로 이미 실행 중인 작업을 셸에서 분리하는 방법, tmux와의 비교를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 8
type: "knowledge"
category: "Linux"
tags: ["linux", "nohup", "disown", "sighup", "background", "session", "terminal", "process"]
featured: false
draft: false
---

[지난 글](/posts/linux-fg-bg-jobs/)에서 fg/bg/jobs로 작업을 전환하는 법을 배웠습니다. 그런데 SSH를 끊거나 터미널 창을 닫으면 실행 중이던 백그라운드 작업도 함께 종료됩니다. 이 문제를 해결하는 도구가 `nohup`과 `disown`입니다.

## 왜 터미널 종료 시 프로세스가 죽을까

SSH 연결이 끊기거나 터미널이 닫히면 다음 순서로 일어납니다.

1. 터미널 드라이버가 **SIGHUP** 시그널을 세션 리더(셸)에게 보냄
2. 셸은 자신이 관리하는 **모든 작업 그룹**에 SIGHUP을 전파
3. SIGHUP을 처리하지 않는 프로세스는 기본 동작인 **종료**

따라서 백그라운드 작업이라도 셸의 작업 테이블에 남아 있으면 SIGHUP을 받고 죽습니다.

![SIGHUP 전파와 nohup/disown 보호](/assets/posts/linux-nohup-disown-flow.svg)

## nohup — 시작 전 보호

`nohup`("no hangup")은 프로세스에게 **SIGHUP을 무시하도록** 설정한 뒤 명령을 실행합니다.

```bash
# 기본: stdout/stderr가 ./nohup.out으로 리다이렉션
nohup ./long_job.sh &

# 출력 파일 직접 지정
nohup python app.py > /var/log/app.log 2>&1 &

# PID 저장 (나중에 종료할 때 사용)
nohup ./server.sh > server.log 2>&1 &
echo $! > /tmp/server.pid

# 종료
kill $(cat /tmp/server.pid)
```

`nohup` 없이 `&`만 붙이면 SIGHUP이 전파됩니다. `nohup`을 붙여야 SIGHUP이 무시됩니다.

`nohup.out` 파일은 작업 디렉터리에 생성됩니다. 그 위치에 쓰기 권한이 없으면 `$HOME/nohup.out`에 생성됩니다.

## disown — 이미 실행 중인 작업 분리

`nohup` 없이 시작한 작업을 사후에 보호하려면 `disown`을 사용합니다.

```bash
# 실수로 nohup 없이 시작했을 때
./heavy_job.sh &   # 이미 시작됨

# 셸 작업 테이블에서 제거 (SIGHUP 전파 차단)
disown %1          # 작업 번호로
disown -h %1       # 작업 테이블에 유지하되 SIGHUP만 무시
disown -a          # 모든 작업에 적용
```

`disown` 후에는 `jobs`로 조회되지 않습니다. 단, 이미 실행 중인 프로세스 자체는 계속 살아 있습니다. `ps aux | grep job`으로 확인할 수 있습니다.

![nohup · disown 사용 패턴](/assets/posts/linux-nohup-disown-code.svg)

### 긴급 처방: 포그라운드에서 실행 중일 때

포그라운드로 실행 중인 작업을 분리해야 할 때:

```bash
# 1. Ctrl+Z → 일시 정지
# 2. 백그라운드로 재개
bg %1
# 3. 셸에서 분리
disown %1
# 4. 이제 터미널을 닫아도 안전
```

## tmux/screen과의 비교

| | nohup | disown | tmux/screen |
|--|-------|--------|-------------|
| 작동 시점 | 시작 전 | 시작 후 | 시작 전 |
| 재접속 | 불가 | 불가 | 가능 |
| 인터랙션 | 불가 | 불가 | 가능 |
| 출력 확인 | 파일만 | 파일만 | 실시간 |

장기 실행 서버나 대화형 프로세스가 필요하다면 `tmux`가 훨씬 낫습니다. `nohup`/`disown`은 간단한 배치 작업에 적합합니다.

```bash
# tmux로 세션 만들고 detach
tmux new-session -d -s myjob './server.sh'

# 나중에 다시 attach
tmux attach -t myjob
```

## 실전: 원격 서버에서 긴 작업

```bash
# SSH 접속 후 배포 스크립트 실행
nohup ./deploy.sh > /tmp/deploy.log 2>&1 &
echo "PID: $!, 로그: /tmp/deploy.log"

# 다른 터미널에서 진행 상황 확인
tail -f /tmp/deploy.log

# 완료 여부 확인
kill -0 <PID> 2>/dev/null && echo "실행 중" || echo "완료"
```

---

**지난 글:** [fg, bg, jobs — 포그라운드·백그라운드 작업 관리](/posts/linux-fg-bg-jobs/)

**다음 글:** [pgrep과 pkill — 이름으로 프로세스 찾기와 종료](/posts/linux-pgrep-pkill/)

<br>
읽어주셔서 감사합니다. 😊
