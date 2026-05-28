---
title: "시간 동기화 문제 — NTP/chrony 트러블슈팅"
description: "TLS 인증서 오류, 로그 타임스탬프 불일치, 클러스터 노드 간 시각 차이 등 시간 동기화 문제를 timedatectl, chronyc, ntpq로 진단하고 makestep·타임존 설정으로 복구하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["linux", "ntp", "chrony", "timedatectl", "time-sync", "troubleshooting"]
featured: false
draft: false
---

[지난 글](/posts/linux-process-hung/)에서 응답 없는 프로세스를 추적하는 방법을 살펴봤다. 이번에는 조용하지만 시스템 전반에 영향을 주는 시간 동기화 문제를 다룬다. 시계가 몇 초만 틀려도 TLS 인증서 유효성 검사가 실패하고, 분산 시스템의 인증 토큰이 만료되며, 로그 파일의 타임스탬프가 어긋나 장애 분석이 불가능해진다.

## 시간 동기화 아키텍처

현대 리눅스 시스템의 시간 관리:

1. **하드웨어 시계 (RTC)** — 전원이 꺼져도 유지, 배터리로 동작
2. **시스템 시계** — 커널이 관리, 부팅 시 RTC에서 초기화
3. **NTP 데몬** — 외부 서버와 시스템 시계를 동기화 (`chronyd` 또는 `ntpd`)
4. **systemd-timesyncd** — 가벼운 SNTP 클라이언트 (기본 내장)

시간 오차가 생기는 주요 원인: VM/컨테이너 슬립, RTC 배터리 방전, NTP 서버 연결 실패, 잘못된 타임존 설정.

![시간 동기화 문제 트러블슈팅](/assets/posts/linux-time-sync-issues-flow.svg)

## 1단계 — timedatectl로 전체 상태 확인

```bash
timedatectl
```

출력 예:

```
Local time: Thu 2026-05-29 14:32:10 KST
Universal time: Thu 2026-05-29 05:32:10 UTC
RTC time: Thu 2026-05-29 05:32:09
Time zone: Asia/Seoul (KST, +0900)
System clock synchronized: yes
NTP service: active
```

확인 포인트:
- `System clock synchronized: yes` — NTP 동기화 성공 여부
- `NTP service: active` — NTP 데몬 실행 여부
- `Local time`과 `RTC time`의 차이 — UTC 오프셋과 맞는지

NTP가 비활성 상태라면:

```bash
sudo timedatectl set-ntp true
systemctl status chronyd   # 또는 systemd-timesyncd
```

## 2단계 — chrony 동기화 상태 점검

```bash
chronyc tracking
```

```
Reference ID    : A29FC87B (time.google.com)
Stratum         : 2
System time     : 0.000015 seconds slow of NTP time
RMS offset      : 0.000023 seconds
Frequency       : 2.345 ppm slow
```

- `System time` — 현재 오프셋. 수백 밀리초 이상이면 문제
- `Stratum` — NTP 계층 (1=원자시계 직접, 2=1계층 서버 참조)
- `RMS offset` — 안정성 지표

```bash
# NTP 서버 목록과 상태
chronyc sources -v
# *  = 현재 사용 중인 서버
# +  = 후보 서버
# ?  = 응답 없음
```

![시간 동기화 진단 명령어](/assets/posts/linux-time-sync-issues-commands.svg)

## 3단계 — 오프셋이 크면 강제 보정

chrony는 기본적으로 시간을 서서히 맞춘다(slewing). 수천 초 차이가 나면 자동 보정에 몇 시간이 걸린다.

```bash
# 즉각 한 번 강제 동기화 (시간 점프)
sudo chronyc makestep

# 또는 서비스 재시작 (시작 시 makestep 옵션이 있으면 자동 수행)
sudo systemctl restart chronyd
```

`/etc/chrony.conf`에 `makestep 1.0 3` 옵션이 있으면 재시작 시 자동으로 큰 오프셋을 즉각 보정한다.

## 4단계 — NTP 서버 연결 확인

```bash
# NTP 서버로 UDP 123 통신 가능한지 확인
nc -zu pool.ntp.org 123

# 방화벽 통과 여부
sudo tcpdump -n port 123
```

NTP 서버를 내부 서버로 변경해야 하는 경우:

```bash
# /etc/chrony.conf 수정
server ntp.internal.company.com iburst prefer
# 기존 pool 항목 주석 처리 후

sudo systemctl restart chronyd
chronyc sources
```

## 5단계 — 타임존 오류 수정

```bash
# 사용 가능한 타임존 목록
timedatectl list-timezones | grep Seoul

# 타임존 설정
sudo timedatectl set-timezone Asia/Seoul

# 환경 변수로 임시 설정 (현재 세션만)
export TZ='Asia/Seoul'
date
```

컨테이너에서는 호스트의 `/etc/localtime`을 마운트하거나 `TZ` 환경변수를 주입하는 것이 일반적이다.

## VM/컨테이너 시간 drift 문제

가상 머신이 슬립(suspend)됐다 깨어나면 시스템 시계가 크게 어긋난다. KVM/VMware에서는 Guest Additions나 하이퍼바이저 시간 동기화를 사용하고, 동시에 내부 NTP를 활성화해 이중 보정한다.

```bash
# KVM 게스트에서 하이퍼바이저 시간 동기화 확인
cat /sys/class/ptp/ptp0/clock_name
# KVM virtual PTP

# /etc/chrony.conf에 추가
refclock PHC /dev/ptp0 poll 2 dpoll -2 offset 0
```

## 하드웨어 시계와 시스템 시계 동기화

```bash
# 하드웨어 시계 확인
hwclock --show

# 시스템 → 하드웨어 시계에 쓰기
sudo hwclock --systohc

# 하드웨어 → 시스템 시계에 쓰기
sudo hwclock --hctosys
```

시간 동기화 문제의 핵심 진단 순서는 `timedatectl → chronyc tracking → chronyc sources → 방화벽 UDP 123` 이다. 오프셋이 크면 `makestep`으로 즉각 보정하고, 재발을 막으려면 NTP 데몬이 항상 실행 중인지 모니터링한다.

---

**지난 글:** [프로세스 멈춤 — Hung Process 조사](/posts/linux-process-hung/)

**다음 글:** [로케일 및 인코딩 문제 — 한글 깨짐 트러블슈팅](/posts/linux-locale-encoding-issues/)

<br>
읽어주셔서 감사합니다. 😊
