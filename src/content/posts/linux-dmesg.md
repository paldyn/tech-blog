---
title: "dmesg — 커널 링 버퍼와 부팅 메시지"
description: "dmesg 명령으로 커널 링 버퍼를 읽고, -T/-l/-w 옵션으로 타임스탬프·레벨 필터·실시간 추적을 활용하는 방법, OOM·디스크 오류·네트워크 오류 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["linux", "dmesg", "kernel", "ring-buffer", "boot", "OOM", "hardware", "debugging"]
featured: false
draft: false
---

[지난 글](/posts/linux-logrotate/)에서 logrotate로 로그를 자동 관리하는 방법을 배웠습니다. 시스템 장애, 하드웨어 오류, 부팅 문제를 진단할 때 가장 먼저 확인해야 하는 곳이 **커널 링 버퍼**입니다. `dmesg` 명령은 이 버퍼의 내용을 출력합니다.

## 커널 링 버퍼란

커널은 부팅 직후부터 모든 하드웨어 감지, 드라이버 초기화, I/O 오류, 네트워크 이벤트를 **링 버퍼(ring buffer)**에 기록합니다. 링 버퍼는 고정된 크기를 가지며, 꽉 차면 오래된 항목부터 덮어씁니다. 기본 크기는 커널 설정에 따라 다르지만 보통 수백 KB입니다.

```bash
# 링 버퍼 현재 크기 확인
dmesg --read-clear       # 읽은 후 버퍼 비우기 (root 필요)
dmesg -s 65536           # 버퍼 크기 65536 바이트로 지정
```

## 기본 사용법

```bash
dmesg            # 전체 출력 (페이저 없음)
dmesg | less     # 페이저로 보기
dmesg | tail -50 # 최근 50줄
```

기본 타임스탬프는 부팅 후 경과 초(`[12.345678]`) 형태입니다. 사람이 읽기 어렵기 때문에 `-T`로 절대 시각으로 변환합니다.

```bash
dmesg -T         # [Mon May 18 09:15:32 2026] 형식
```

![dmesg 출력 구조](/assets/posts/linux-dmesg-anatomy.svg)

## 레벨 필터

`-l` 옵션으로 syslog 수준을 필터합니다. 콤마로 여러 레벨을 동시에 지정할 수 있습니다.

```bash
dmesg -l err           # 오류만
dmesg -l err,warn      # 오류 + 경고
dmesg -l debug         # 디버그 메시지
```

`-f` 옵션은 facility(출처)를 필터합니다.

```bash
dmesg -f kern          # 커널 메시지만
dmesg -f user          # 사용자 공간 메시지
dmesg -f kern -l err   # 커널 오류만
```

## 실시간 모니터링

`-w`(watch) 모드로 새 메시지를 실시간으로 볼 수 있습니다. USB 장치 삽입, 네트워크 링크 변화 등을 즉시 확인할 때 유용합니다.

```bash
dmesg -w               # 새 메시지 실시간 출력
dmesg -T -l err -w     # 타임스탬프 + 오류 + 실시간
```

## 색상 출력

터미널이 지원하면 `-H`(human) 옵션으로 수준별 색상과 자동 타임스탬프를 함께 씁니다.

```bash
dmesg -H           # 색상 + 타임스탬프 + 페이저
```

## 주요 진단 패턴

![dmesg 주요 진단 패턴](/assets/posts/linux-dmesg-patterns.svg)

장애 진단 시 자주 검색하는 키워드들입니다.

```bash
# 모든 오류·경고 한꺼번에
dmesg -T | grep -iE 'error|fail|oom|killed|denied|segfault|panic'

# 특정 장치
dmesg | grep sda

# USB 이벤트
dmesg | grep usb

# 부팅 시 감지된 CPU/메모리
dmesg | grep -E 'CPU|Memory|BIOS'
```

**OOM Killer**: `Out of memory: Killed process`가 보이면 메모리 부족으로 프로세스가 강제 종료된 것입니다. 어떤 프로세스가 얼마나 메모리를 썼는지 같은 메시지에 기록됩니다.

**디스크 오류**: `I/O error, dev sda`, `SCSI error`가 반복되면 하드웨어 이상 신호입니다. `smartctl -a /dev/sda`로 S.M.A.R.T. 상태를 확인합니다.

## journalctl -k 와의 관계

`journalctl -k`는 journald가 수집한 커널 메시지를 보여주며 `dmesg -T`와 내용이 거의 같습니다. journald 기반에서는 `journalctl -k --since today`처럼 시간 범위 필터를 함께 쓸 수 있어 더 편리합니다.

```bash
# 이번 부팅의 커널 메시지 (journald 방식)
journalctl -k -b

# 이전 부팅의 커널 메시지
journalctl -k -b -1
```

---

**지난 글:** [logrotate — 로그 파일 로테이션 자동화](/posts/linux-logrotate/)

**다음 글:** [uptime과 load average — 시스템 부하 읽기](/posts/linux-uptime-load-average/)

<br>
읽어주셔서 감사합니다. 😊
