---
title: "종료 실패 — shutdown/reboot 멈춤 트러블슈팅"
description: "shutdown/reboot 명령 후 'A stop job is running' 메시지와 함께 멈추는 문제를 journalctl, systemctl list-jobs로 진단하고, TimeoutStopSec 조정과 Magic SysRq로 강제 종료하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 8
type: "knowledge"
category: "Linux"
tags: ["linux", "shutdown", "reboot", "systemd", "troubleshooting", "SysRq"]
featured: false
draft: false
---

[지난 글](/posts/linux-locale-encoding-issues/)에서 인코딩 문제를 다뤘다. 이번에는 `sudo shutdown -r now`를 입력했는데 수분째 "A stop job is running for..." 메시지가 표시되며 멈추는 상황을 살펴본다. systemd 기반 시스템에서 서비스 종료 타임아웃이 길거나, 특정 서비스가 SIGTERM을 무시하거나, D 상태 프로세스가 있을 때 이런 현상이 발생한다.

## 종료 프로세스 이해

systemd의 종료 흐름:

1. `shutdown` 또는 `systemctl poweroff` 명령
2. systemd가 모든 서비스에 `SIGTERM` 전송
3. `DefaultTimeoutStopSec`(기본 90초) 대기
4. 타임아웃 시 `SIGKILL` 전송
5. 파일 시스템 언마운트 후 전원 차단

이 흐름 중 어느 단계든 블로킹될 수 있다.

![shutdown / reboot 멈춤 트러블슈팅](/assets/posts/linux-shutdown-reboot-fail-flow.svg)

## 1단계 — 현재 상태 파악

별도 터미널(콘솔 또는 SSH)에서:

```bash
# 실시간 로그 (종료 중인 서비스 확인)
journalctl -xe -f

# 대기 중인 작업 목록
systemctl list-jobs

# 이전 종료 시도의 로그
journalctl -b -1 | grep -E "stop job|timed out|killed"
```

출력에서 "Timed out stopping service" 또는 "Killing process" 메시지가 보이면 해당 서비스가 원인이다.

## 2단계 — 블로킹 서비스 강제 종료

```bash
# 특정 서비스 강제 중단
sudo systemctl kill myservice.service
sudo systemctl stop myservice.service --force

# PID 직접 kill
pidof myservice
sudo kill -9 $(pidof myservice)
```

서비스가 D 상태(uninterruptible sleep)라면 SIGKILL도 즉시 효과가 없다. 이 경우 앞서 다룬 I/O 원인(NFS hang 등)을 먼저 해결한다.

![종료 실패 진단 및 조치 명령어](/assets/posts/linux-shutdown-reboot-fail-commands.svg)

## 3단계 — TimeoutStopSec 조정

재발 방지를 위해 문제 서비스의 종료 타임아웃을 줄인다.

```bash
# 특정 서비스 타임아웃 조정
sudo systemctl edit myservice.service
```

편집기에 추가:

```ini
[Service]
TimeoutStopSec=10s
```

또는 전역 기본값 조정:

```bash
# /etc/systemd/system.conf
sudo sed -i 's/#DefaultTimeoutStopSec.*/DefaultTimeoutStopSec=15s/' \
    /etc/systemd/system.conf
sudo systemctl daemon-reload
```

## 4단계 — D 상태 프로세스 처리

```bash
# D 상태 프로세스 목록
ps aux | awk '$8 == "D" { print }'

# 대기 중인 커널 함수 확인
ps -o pid,stat,wchan,comm ax | awk '$2 ~ /D/'
```

D 상태는 커널이 I/O 완료를 기다리는 중이므로 SIGKILL로도 종료 불가다. NFS 강제 언마운트나 디스크 오류 복구 후 프로세스가 자연 해소된다.

## 5단계 — Magic SysRq 비상 재부팅

물리 접근 가능 환경에서:

```bash
# SysRq 활성화 확인
cat /proc/sys/kernel/sysrq

# 활성화 (1=모든 SysRq 허용)
echo 1 | sudo tee /proc/sys/kernel/sysrq

# 안전 재부팅 순서 (REISUB)
echo r | sudo tee /proc/sysrq-trigger   # Raw mode (키보드 복구)
echo e | sudo tee /proc/sysrq-trigger   # SIGTERM to all
# 1~2초 대기
echo i | sudo tee /proc/sysrq-trigger   # SIGKILL to all
# 1~2초 대기
echo s | sudo tee /proc/sysrq-trigger   # Sync 버퍼 플러시
# 1~2초 대기
echo u | sudo tee /proc/sysrq-trigger   # 파일 시스템 읽기 전용
# 1~2초 대기
echo b | sudo tee /proc/sysrq-trigger   # 강제 재부팅
```

REISUB 순서는 데이터 무결성을 최대한 보호하는 비상 재부팅 방법이다.

## 재발 방지 — 서비스 종료 핸들러 개선

애플리케이션 서비스라면 `ExecStop` 스크립트에서 SIGTERM을 올바르게 처리하도록 수정한다.

```ini
# /etc/systemd/system/myapp.service
[Service]
ExecStop=/usr/bin/myapp --graceful-shutdown
TimeoutStopSec=30s
KillMode=mixed
KillSignal=SIGTERM
```

`KillMode=mixed`는 SIGTERM 후 타임아웃 시 SIGKILL을 자동으로 전송한다.

## 자주 발생하는 패턴 요약

| 원인 | 증상 | 해결 |
|------|------|------|
| 서비스가 SIGTERM 무시 | 90초 대기 후 SIGKILL | TimeoutStopSec 단축 |
| D 상태 프로세스 | SIGKILL도 효과 없음 | I/O 원인 제거 |
| NFS hang | 파일 시스템 언마운트 실패 | umount -f -l |
| 긴 백업/flush 작업 | 정상 종료이나 느림 | TimeoutStopSec 연장 또는 허용 |

종료 문제의 핵심은 어떤 서비스/프로세스가 종료를 지연시키는지 정확히 파악하는 것이다. `journalctl -xe`와 `systemctl list-jobs`로 원인을 찾고, TimeoutStopSec 조정으로 재발을 막는 것이 올바른 순서다.

---

**지난 글:** [로케일 및 인코딩 문제 — 한글 깨짐 트러블슈팅](/posts/linux-locale-encoding-issues/)

**다음 글:** [파일 시스템 읽기 전용 복구](/posts/linux-fs-readonly-recover/)

<br>
읽어주셔서 감사합니다. 😊
