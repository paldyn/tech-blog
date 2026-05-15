---
title: "프로세스 상태 완전 이해 — Running부터 Zombie까지"
description: "리눅스 프로세스 상태 R·S·D·Z·T·I·X의 정확한 의미, 상태 전이 조건, D 상태 프로세스를 찾아 대처하는 법, Zombie 프로세스 처리 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["linux", "process-state", "zombie", "running", "sleeping", "uninterruptible", "D-state", "ps"]
featured: false
draft: false
---

[지난 글](/posts/linux-pgrep-pkill/)에서 이름으로 프로세스를 찾고 종료하는 법을 다뤘습니다. `ps aux`의 STAT 컬럼이나 `top`의 S 컬럼에서 R, S, D, Z 같은 문자를 봤을 겁니다. 이번엔 이 상태 코드들이 무엇을 의미하는지, 그리고 각 상태에서 어떻게 대처해야 하는지 완전히 이해합니다.

## 프로세스 상태 코드 한눈에

```bash
# 모든 프로세스의 STAT 컬럼 보기
ps aux --sort=stat | head -20

# 상태별 개수
ps aux | awk 'NR>1 {print $8}' | sort | uniq -c | sort -rn
```

![프로세스 상태 전이 다이어그램](/assets/posts/linux-process-states-diagram.svg)

## R — Running (실행 중 / 실행 큐 대기)

가장 단순한 상태입니다. CPU에서 실제로 실행 중이거나, 실행될 준비가 되어 스케줄러 큐에서 대기 중인 프로세스입니다.

```bash
# 현재 실행 큐에 있는 프로세스
ps aux | awk '$8 ~ /^R/'

# top에서 R 상태 개수 확인 (Tasks: 줄의 running 값)
top -bn1 | grep Tasks
```

멀티코어 시스템에서 CPU 코어 수보다 R 상태 프로세스가 많으면 CPU 경합이 발생합니다.

## S — Sleeping (인터럽트 가능한 대기)

I/O 완료, 타이머, 세마포어 등 **특정 이벤트를 기다리는** 상태입니다. 시그널을 받으면 깨어납니다. 시스템에서 가장 많은 프로세스가 이 상태입니다.

```bash
# 어디서 대기 중인지 확인 (wchan = wait channel)
ps -o pid,wchan,comm -p 1234
# WCHAN 값이 'poll_s'이면 소켓 대기, 'futex_'이면 락 대기 등
```

## D — Uninterruptible Sleep (인터럽트 불가 대기)

디스크 I/O나 NFS 등의 **커널 I/O 완료를 기다리는** 상태입니다. S와 다르게 시그널을 받지 않습니다. 따라서 `kill -9`도 통하지 않습니다.

```bash
# D 상태 프로세스 찾기
ps aux | awk '$8 ~ /^D/'

# 몇 개나 있는지
ps aux | awk '$8 ~ /^D/' | wc -l
```

**D 상태가 계속 지속된다면:**

| 원인 | 대처 |
|------|------|
| NFS 마운트 행 | `umount -f -l /mnt/nfs` 또는 서버 확인 |
| 디스크 I/O 과부하 | `iostat -x 1`로 디바이스 포화 확인 |
| 파일시스템 버그 | `dmesg | grep "EXT4\|XFS\|error"` 확인 |
| 커널 버그 | 커널 업데이트 또는 재부팅 |

D 상태가 일시적이면 정상입니다. 수십 초 이상 지속된다면 문제를 조사해야 합니다.

## Z — Zombie (좀비)

**종료했지만 부모가 아직 `wait()` 시스템 콜을 호출하지 않은** 프로세스입니다. 프로세스 자체의 메모리와 자원은 이미 해제되었지만, 종료 상태를 보고하기 위한 PID 테이블 항목이 남아 있습니다.

```bash
# Zombie 프로세스 찾기
ps -eo pid,ppid,stat,comm | awk '$3 ~ /Z/'

# Zombie의 부모 확인
ps -o ppid= -p <zombie_pid>

# 부모에게 SIGCHLD 보내 처리 유도
kill -CHLD <parent_pid>
```

좀비 자체는 CPU를 쓰지 않고 PID만 차지합니다. 그러나 수백~수천 개가 쌓이면 PID 고갈(기본 32768개)로 새 프로세스를 생성할 수 없게 됩니다. 좀비가 많다면 부모 프로세스의 버그(wait() 호출 누락)입니다. 부모 프로세스를 종료하면 좀비도 PID 1에 의해 수거됩니다.

## T — Stopped (정지)

SIGSTOP 또는 Ctrl+Z(SIGTSTP)로 **일시 정지된** 상태입니다. SIGCONT를 받으면 재개됩니다.

```bash
# 정지된 프로세스 목록
ps aux | awk '$8 ~ /^T/'

# 재개
kill -CONT 1234
```

## I — Idle Kernel Thread

커널 스레드가 유휴 상태일 때 나타납니다. `[kworker]`, `[kswapd]` 같은 커널 스레드에서 볼 수 있습니다. 사용자 공간 프로세스에서는 볼 수 없습니다.

## STAT 수식자(두 번째 문자)

첫 문자 외에 수식자가 붙어 추가 정보를 줍니다.

```
s  세션 리더 (Ss = 세션 리더이며 슬리핑)
+  포그라운드 프로세스 그룹 (S+ = 포그라운드 슬리핑)
l  멀티스레드 (Sl = 슬리핑 멀티스레드)
<  높은 우선순위 (nice < 0)
N  낮은 우선순위 (nice > 0)
L  메모리 페이지 잠금 (mlock)
```

## 실전 진단 패턴

![프로세스 상태 확인 방법](/assets/posts/linux-process-states-check.svg)

```bash
# 시스템 전체 상태 요약
ps aux | awk 'NR>1{print substr($8,1,1)}' | sort | uniq -c

# D 상태가 지속될 때: I/O 대기 원인 추적
ps -eo pid,stat,wchan,comm | awk '$2 ~ /D/'

# Zombie 자동 리포트
watch -n 5 'ps aux | awk "$8 == \"Z\"" | wc -l'

# 상태 변화 스냅샷 (2초 간격)
for i in 1 2 3; do
  echo "=== $(date +%T) ==="
  ps aux | awk 'NR>1{print $8}' | sort | uniq -c
  sleep 2
done
```

---

**지난 글:** [pgrep과 pkill — 이름으로 프로세스 찾기와 종료](/posts/linux-pgrep-pkill/)

<br>
읽어주셔서 감사합니다. 😊
