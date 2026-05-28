---
title: "프로세스 멈춤 — Hung Process 조사"
description: "리눅스 프로세스가 응답하지 않을 때 ps 상태 코드(D/S/Z), strace, lsof를 이용해 블로킹 원인을 추적하고, SIGTERM/SIGKILL로 종료하거나 NFS hung 같은 근본 원인을 해결하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["linux", "troubleshooting", "process", "hung", "strace", "lsof", "D-state"]
featured: false
draft: false
---

[지난 글](/posts/linux-segfault-investigation/)에서 세그멘테이션 폴트로 인한 프로세스 크래시를 추적했다. 이번에는 반대 상황, 즉 프로세스가 죽지도 않으면서 아무 응답도 없는 "hung" 상태를 다룬다. kill 명령을 보내도 반응이 없고, 같은 자원을 기다리는 다른 프로세스들까지 줄지어 멈추는 최악의 상황이 여기서 시작된다.

## 프로세스 상태 코드 이해

`ps` 명령의 STAT 컬럼은 프로세스의 현재 상태를 알려준다.

| 코드 | 의미 | 설명 |
|------|------|------|
| `S` | Sleeping | 이벤트/신호 대기, 인터럽트 가능 |
| `D` | Disk Wait | I/O 대기, **인터럽트 불가** |
| `R` | Running | CPU 실행 중 |
| `T` | Stopped | SIGSTOP으로 일시 중단 |
| `Z` | Zombie | 종료됐지만 부모가 wait() 안 함 |

**D 상태가 핵심이다.** `kill -9`조차 D 상태 프로세스를 종료할 수 없다. 커널이 I/O 완료를 기다리는 동안 프로세스를 보호하기 때문이다.

![Hung Process 조사 흐름](/assets/posts/linux-process-hung-flow.svg)

## 1단계 — 프로세스 상태 확인

```bash
ps aux | grep myapp
# myapp  4567  0.0  0.1  D  ?  0:00 myapp

ps -o pid,stat,wchan,comm -p 4567
# PID STAT WCHAN     COMMAND
# 4567 D    nfs_flock myapp
```

`wchan` 컬럼은 프로세스가 커널의 어느 함수에서 대기 중인지 보여준다. `nfs_flock`, `nfs_wait`, `jbd2_log_wait` 같은 이름이 보이면 해당 I/O 시스템 문제다.

## 2단계 — 현재 blocking syscall 확인

```bash
sudo strace -p 4567
# read(4, ...  (syscall 반환 없이 멈춤)
```

`strace`가 어떤 syscall에서 멈췄는지 바로 보여준다. 반환이 없는 syscall은 해당 파일 디스크립터 번호를 단서로 삼는다.

```bash
# fd 4가 어떤 파일인지 확인
ls -la /proc/4567/fd/4
```

![Hung Process 진단 명령어](/assets/posts/linux-process-hung-commands.svg)

## 3단계 — 열린 파일과 소켓 확인

```bash
lsof -p 4567
# myapp  4567 user  4u  REG  0,52  0  1234 /mnt/nfs/data.db
# myapp  4567 user  7u  IPv4 123   0t0 TCP 10.0.0.2:45678->10.0.1.5:2049 (ESTABLISHED)
```

NFS 마운트된 파일이나 응답 없는 원격 소켓에서 블로킹되는 경우가 많다. 원격 서버 상태를 확인한다.

```bash
# NFS 서버 ping
ping nfs-server

# NFS 마운트 상태
mount | grep nfs
showmount -e nfs-server
```

## 4단계 — NFS hang 해결

NFS 서버가 다운됐거나 네트워크 단절로 NFS 연산이 무한 대기 중인 경우, 마운트 옵션 `intr`이 없으면 D 상태가 지속된다.

```bash
# 강제 언마운트 (즉시 해제)
sudo umount -f /mnt/nfs

# lazy 언마운트 (사용 중인 경우)
sudo umount -l /mnt/nfs
```

언마운트 후 D 상태 프로세스가 EINTR로 깨어나 종료되거나, 에러를 처리할 수 있다.

## 5단계 — 프로세스 종료 시도

```bash
# 정상 종료 신호
kill -TERM 4567

# 5초 후 확인
sleep 5 && kill -0 4567 && echo "still alive"

# 강제 종료
kill -KILL 4567
```

D 상태에서는 `SIGKILL`도 즉시 작동하지 않는다. I/O가 완료되거나 타임아웃돼야 신호가 처리된다.

## 데드락 감지

멀티스레드 프로세스에서 두 스레드가 서로의 락을 기다리는 데드락 상황:

```bash
# 모든 스레드 상태 확인
ps -eLf | grep 4567

# /proc/PID/status의 락 정보
cat /proc/4567/status | grep -E "State|Threads"

# gdb로 멀티스레드 스택 확인
gdb -p 4567 -ex "thread apply all bt" -ex quit
```

## 시스템 전체 D 상태 프로세스 모니터링

```bash
# D 상태 프로세스 목록
ps aux | awk '$8 == "D" {print}'

# 5초 간격으로 모니터링
watch -n 5 'ps aux | awk '"'"'$8=="D"'"'"''

# 커널 hung_task 감지 (D 상태 120초 이상 지속 시 경고)
cat /proc/sys/kernel/hung_task_timeout_secs
```

## 재발 방지 — NFS 마운트 옵션

```bash
# /etc/fstab — soft 마운트와 타임아웃 설정
nfs-server:/export /mnt/nfs nfs soft,timeo=30,retrans=2 0 0
```

`soft` 옵션은 타임아웃 시 에러를 반환해 프로세스가 D 상태에서 빠져나올 수 있게 한다. 단, 데이터 무결성이 중요한 경우에는 `hard` 마운트와 `intr` 옵션을 조합한다.

Hung process의 핵심은 D 상태 판별이다. D 상태라면 kill이 아니라 I/O 원인 해결이 먼저다. `ps wchan`, `strace`, `lsof`의 세 가지 도구로 블로킹 원인을 정확히 짚어야 한다.

---

**지난 글:** [Segmentation Fault 조사 — 세그멘테이션 폴트 원인 분석](/posts/linux-segfault-investigation/)

**다음 글:** [시간 동기화 문제 — NTP/chrony 트러블슈팅](/posts/linux-time-sync-issues/)

<br>
읽어주셔서 감사합니다. 😊
