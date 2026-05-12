---
title: "ps 완전 가이드 — aux와 -ef로 프로세스 목록 읽기"
description: "ps aux와 ps -ef의 차이, 출력 컬럼(PID·%CPU·RSS·STAT) 해석, --sort/-o 옵션으로 원하는 정보만 뽑는 실전 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["linux", "ps", "process", "monitoring", "aux", "ps-ef", "system-administration"]
featured: false
draft: false
---

[지난 글](/posts/linux-process-anatomy/)에서 프로세스가 내부적으로 어떻게 구성되는지 살펴봤습니다. 이번엔 실행 중인 프로세스 전체 목록을 확인하는 `ps` 명령어를 완전히 파헤칩니다.

## ps — Process Status의 두 가지 얼굴

`ps`는 유닉스 계열 운영체제에서 수십 년 동안 사용된 도구입니다. 문제는 유닉스 진영(System V)과 BSD 진영이 서로 다른 문법을 발전시켰고, 리눅스가 두 가지를 모두 흡수했다는 점입니다.

| 스타일 | 대표 명령 | 특징 |
|--------|-----------|------|
| **BSD** | `ps aux` | 대시 없는 옵션, `a`=모든 사용자, `u`=사용자 정보, `x`=터미널 없는 프로세스 포함 |
| **UNIX** | `ps -ef` | 대시 있는 옵션, `-e`=모든 프로세스, `-f`=풀 포맷(PPID 포함) |
| **GNU** | `ps --sort` | 긴 옵션, `procps-ng` 패키지에서 제공 |

BSD와 UNIX 스타일 모두 거의 동일한 결과를 내지만, **PPID(부모 PID)**를 기본 출력에 포함하려면 `-ef`가 유리합니다.

## ps aux 출력 컬럼 해석

![ps aux 출력 컬럼 해설](/assets/posts/linux-ps-aux-ef-columns.svg)

```bash
# 기본 실행
ps aux

# 출력 예시
# USER       PID  %CPU  %MEM    VSZ   RSS TTY      STAT  START   TIME COMMAND
# root         1   0.0   0.1  21708  9812 ?        Ss   09:01   0:02 /sbin/init
```

각 컬럼의 의미를 정확히 알아야 모니터링 데이터를 제대로 읽을 수 있습니다.

- **USER**: 프로세스를 실행 중인 사용자 계정
- **PID**: 프로세스 고유 번호
- **%CPU**: 최근 CPU 사용률 (순간이 아닌 수명 평균)
- **%MEM**: 물리 메모리 사용 비율 (RSS / 총 RAM × 100)
- **VSZ**: 가상 주소 공간 전체 크기 (KB). 실제 점유 메모리가 아님
- **RSS**: Resident Set Size — 실제 물리 메모리에 올라온 크기 (KB)
- **TTY**: 연결된 터미널. `?`는 터미널 없음(데몬)
- **STAT**: 프로세스 상태 코드 (아래 설명)
- **START**: 프로세스 시작 시각 또는 날짜
- **TIME**: 누적 CPU 사용 시간 (분:초)
- **COMMAND**: 실행 명령어 + 인수 (대괄호는 커널 스레드)

### STAT 상태 코드

첫 문자가 메인 상태, 두 번째 문자가 수식자입니다.

```
R  Running 또는 실행 대기열에 있음
S  Sleeping — 인터럽트 가능한 대기
D  Uninterruptible Sleep — 주로 I/O 대기. kill 불가
Z  Zombie — 종료했지만 부모가 wait() 안 함
T  Stopped — SIGSTOP 또는 Ctrl+Z

수식자:
s  세션 리더      +  포그라운드 프로세스 그룹
l  멀티스레드     <  높은 우선순위 (nice < 0)
N  낮은 우선순위  L  메모리 잠금 (mlock)
```

## 실전 패턴

![ps 주요 옵션 비교](/assets/posts/linux-ps-aux-ef-code.svg)

### CPU·메모리 Top 10 조회

```bash
# CPU 사용률 상위 10개
ps aux --sort=-%cpu | head -11

# 메모리 사용 상위 10개
ps aux --sort=-%mem | head -11
```

### 특정 프로세스 찾기

```bash
# 이름으로 찾기 (grep 자체가 결과에 포함되는 걸 방지)
ps aux | grep '[n]ginx'

# 커스텀 컬럼 — pid, ppid, user, stat, cmd만
ps -eo pid,ppid,user,stat,cmd --sort=pid | grep python
```

### 프로세스 계층 확인

```bash
# PPID 포함 전체 목록 (부모-자식 관계 파악)
ps -ef | head -20

# 특정 PID의 상세 정보 (풀 포맷)
ps -f -p 1234
```

### 스레드 단위 조회

```bash
# 특정 프로세스의 스레드 상세
ps -Lf -p $(pgrep -n java)

# 스레드 포함 전체 목록 (H = HIERACHICAL 아닌 스레드 포함)
ps auxH | awk '$3 > 1.0'   # CPU 1% 이상 스레드만
```

## -o 옵션으로 원하는 컬럼만

`-o`(또는 `--format`)로 출력할 컬럼을 직접 지정할 수 있습니다. 스크립트에서 특히 유용합니다.

```bash
# 사용 가능한 키워드 목록 조회
ps L | head -30

# PID와 커맨드만 출력 (헤더 없이 — 공백)
ps -eo pid=,cmd= | head -10

# 프로세스 시작 시각을 포함한 출력
ps -eo pid,lstart,user,cmd | grep nginx

# RSS를 MB로 계산 (awk 활용)
ps aux | awk 'NR>1 {sum[$1]+=$6} END {for(u in sum) printf "%s\t%.1f MB\n", u, sum[u]/1024}' | sort -t$'\t' -k2 -rn
```

## watch로 반복 갱신

`ps`는 순간 스냅샷입니다. 지속 모니터링이 필요하면 `watch`와 조합합니다.

```bash
# 2초마다 CPU 상위 5개 갱신
watch -n 2 'ps aux --sort=-%cpu | head -6'
```

실시간 인터랙티브 모니터링은 다음 글에서 다룰 `top`/`htop`이 더 적합합니다.

---

**지난 글:** [프로세스 해부학 — 리눅스 프로세스의 구조와 생명주기](/posts/linux-process-anatomy/)

**다음 글:** [pstree — 프로세스 부모-자식 트리 한눈에 보기](/posts/linux-pstree/)

<br>
읽어주셔서 감사합니다. 😊
