---
title: "iotop과 iftop — I/O·네트워크 실시간 모니터링"
description: "iotop으로 프로세스별 디스크 I/O를 추적하고, iftop으로 연결별 네트워크 대역폭을 실시간 모니터링하는 방법을 설명합니다. 주요 옵션과 병목 프로세스 찾는 실전 기법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["linux", "iotop", "iftop", "io", "network", "bandwidth", "monitoring", "performance"]
featured: false
draft: false
---

[지난 글](/posts/linux-free-memory/)에서 메모리 사용량을 분석하는 방법을 배웠습니다. `iostat`과 `vmstat`으로 I/O 병목을 발견했다면, **어느 프로세스**가 원인인지 찾아야 합니다. `iotop`은 `top`처럼 프로세스별 디스크 I/O를 실시간으로 보여 주고, `iftop`은 어느 연결이 네트워크를 얼마나 쓰는지 추적합니다.

## iotop 설치와 실행

```bash
# 설치
apt install iotop        # Ubuntu/Debian
dnf install iotop        # Fedora/RHEL

# 기본 실행 (root 필요)
sudo iotop

# I/O 중인 프로세스만 표시
sudo iotop -o

# 비대화형 배치 모드 (스크립트 통합)
sudo iotop -b -n 5 -d 2
```

![iotop — 프로세스별 I/O 실시간 모니터링](/assets/posts/linux-iotop-view.svg)

## iotop 핵심 컬럼

`DISK READ`, `DISK WRITE`는 실시간 I/O 속도이고, `IO>` 퍼센트는 해당 스레드가 I/O 대기에 소모하는 시간 비율입니다. `SWAPIN`이 0이 아니면 메모리 부족으로 스왑에서 페이지를 읽고 있습니다.

```bash
# 특정 사용자의 I/O만 추적
sudo iotop -u mysql -o

# 특정 PID 추적
sudo iotop -p 1234 -o

# 실시간 로그로 저장
sudo iotop -b -n 30 -d 1 | tee /tmp/io-$(date +%H%M).log
```

## iotop 없이 I/O 원인 프로세스 찾기

iotop이 없는 환경에서는 `/proc` 파일시스템으로 같은 정보를 얻을 수 있습니다.

```bash
# 프로세스별 I/O 누적 통계
cat /proc/1234/io
# rchar: 읽은 바이트 (페이지 캐시 포함)
# wchar: 쓴 바이트
# syscr/syscw: 읽기/쓰기 시스템 콜 수
# read_bytes: 실제 디스크 읽기
# write_bytes: 실제 디스크 쓰기
```

## iftop — 연결별 네트워크 대역폭

```bash
# 설치
apt install iftop

# eth0 인터페이스 모니터링 (root 필요)
sudo iftop -i eth0

# DNS 역조회 끄기 (빠른 응답)
sudo iftop -n -i eth0

# 포트 번호 표시
sudo iftop -P -i eth0

# BPF 필터 적용 (특정 대역만)
sudo iftop -f "dst host 8.8.8.8" -i eth0
```

![iftop — 네트워크 대역폭 실시간 모니터링](/assets/posts/linux-iftop-view.svg)

## iftop 결과 읽기

화면에 표시되는 세 숫자는 **2초 / 10초 / 40초 이동 평균**입니다. 순간 스파이크는 2초 값에 반영되지만 40초 평균은 지속적인 트래픽을 보여 줍니다.

```bash
# iftop 없을 때 대안: nethogs (프로세스별 네트워크)
apt install nethogs
sudo nethogs eth0

# ss로 연결당 전송량 확인
ss -s              # 소켓 통계 요약
ss -tp             # TCP 연결 + 프로세스
```

## 두 도구의 조합 활용

서버가 느릴 때 진단 순서는 다음과 같습니다.

```bash
# 1. vmstat으로 전반적 시스템 상태 확인
vmstat 1 5

# 2-a. wa(iowait) 높음 → iotop으로 원인 프로세스 추적
sudo iotop -o

# 2-b. 네트워크 트래픽 과다 → iftop으로 연결 확인
sudo iftop -nP -i eth0

# 3. 원인 PID 확보 후 strace로 syscall 추적
sudo strace -p 1234 -e trace=read,write 2>&1 | head -50
```

---

**지난 글:** [free — 메모리 사용량 정확하게 읽기](/posts/linux-free-memory/)

**다음 글:** [perf — 리눅스 성능 분석 기초](/posts/linux-perf-basics/)

<br>
읽어주셔서 감사합니다. 😊
