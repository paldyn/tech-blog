---
title: "top과 htop — 실시간 프로세스 모니터링"
description: "top의 헤더 영역(load average, CPU, 메모리) 해석법, 인터랙티브 단축키 완전 가이드, htop의 추가 기능(컬러 게이지·트리뷰·마우스 지원)을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["linux", "top", "htop", "monitoring", "performance", "process", "load-average"]
featured: false
draft: false
---

[지난 글](/posts/linux-pstree/)에서 `pstree`로 프로세스 계층을 한눈에 보는 법을 다뤘습니다. `ps`와 `pstree`가 순간 스냅샷을 찍는 도구라면, `top`과 `htop`은 초 단위로 갱신되는 **실시간 모니터링** 도구입니다.

## top 실행과 기본 화면 구성

```bash
# 기본 실행 (기본 갱신 간격 3초)
top

# 갱신 간격 지정 (초)
top -d 1

# 특정 사용자만
top -u www-data

# 특정 PID들만
top -p 1234,5678

# 배치 모드 (비인터랙티브, 스크립트용)
top -bn1 | head -30
```

화면은 크게 **요약 헤더(5줄)**와 **프로세스 목록**으로 나뉩니다.

![top 출력 레이아웃 해설](/assets/posts/linux-top-htop-layout.svg)

## 요약 헤더 읽기

### 1행 — 시스템 개요

```
top - 14:23:05 up 3 days,  2:15,  2 users,  load average: 0.52, 0.61, 0.58
```

- `up 3 days, 2:15`: 마지막 부팅 이후 가동 시간
- `2 users`: 로그인된 사용자 수
- `load average: 0.52, 0.61, 0.58`: 1분·5분·15분 평균 실행 큐 길이

**load average 해석**: CPU 코어 수가 기준입니다. 4코어 시스템에서 `load average 4.0`이면 모든 코어가 꽉 찬 상태, `8.0`이면 2배 과부하입니다. `nproc` 명령으로 코어 수를 확인하세요.

### 3행 — CPU 사용률

```
%Cpu(s):  3.2 us,  1.1 sy,  0.0 ni, 94.3 id,  0.8 wa,  0.0 hi,  0.6 si
```

| 항목 | 의미 |
|------|------|
| `us` | user — 사용자 공간 코드 |
| `sy` | system — 커널 코드 |
| `ni` | nice — nice 값이 변경된 사용자 프로세스 |
| `id` | idle — 유휴 |
| `wa` | I/O wait — I/O 완료 대기 (높으면 디스크/네트워크 병목) |
| `hi` | hardware IRQ |
| `si` | software IRQ |

`wa`가 20% 이상이면 I/O 병목을 의심합니다. `sy`가 높으면 시스템 콜 집중 워크로드(파일 I/O, 네트워크)를 검토합니다.

### 4·5행 — 메모리

```
MiB Mem :  15872.0 total,   2341.5 free,   9812.3 used,   3718.2 buff/cache
MiB Swap:   2048.0 total,   2048.0 free,      0.0 used.   5214.7 avail Mem
```

`buff/cache`는 커널이 성능을 위해 사용하는 버퍼·페이지 캐시입니다. 애플리케이션이 메모리를 요청하면 즉시 반납되므로 **사실상 사용 가능한 메모리**입니다. `avail Mem`이 실제 할당 가능한 양을 나타냅니다.

## 인터랙티브 단축키

![top / htop 인터랙티브 단축키](/assets/posts/linux-top-htop-keys.svg)

### 정렬 및 필터

```
P    CPU 사용률 내림차순 정렬
M    메모리(RES) 내림차순 정렬
T    누적 CPU 시간 내림차순 정렬
N    PID 오름차순 정렬
R    현재 정렬 방향 반전 (오름/내림)
u    특정 사용자 프로세스만 표시 (입력 후 Enter)
```

### 표시 제어

```
1    CPU 코어별 사용률 분리 (토글)
H    스레드 표시 (토글)
V    부모-자식 트리 표시 (토글)
c    COMMAND 전체 경로 표시 (토글)
```

### 프로세스 조작

```
k    kill — PID 입력 → 시그널 번호 입력 (기본 15=SIGTERM)
r    renice — PID 입력 → nice 값 입력
```

### 설정 저장

```
W    현재 화면 설정을 ~/.toprc에 저장 (다음 실행 때도 적용)
d    갱신 간격(초) 변경
```

## htop — 더 나은 사용성

`htop`은 `top`과 같은 역할을 하지만 컬러 UI, 마우스 지원, 함수키 기반 메뉴로 사용성이 훨씬 좋습니다.

```bash
# 설치
sudo apt install htop     # Debian/Ubuntu
sudo dnf install htop     # RHEL 계열

# 실행
htop
```

주요 함수키:

| 키 | 동작 |
|----|------|
| `F2` | Setup — 표시 컬럼, 색상 커스터마이즈 |
| `F3` or `/` | 이름으로 프로세스 검색 |
| `F4` | 필터 문자열 입력 |
| `F5` | 트리 보기 토글 (pstree 스타일) |
| `F6` | 정렬 기준 선택 메뉴 |
| `F9` | Kill 시그널 선택 |
| `Space` | 프로세스 선택 (멀티 선택) |
| `q` | 종료 |

## 스크립트에서 top 활용

`top` 배치 모드(`-bn`)는 스크립트에서 순간 스냅샷을 뽑을 때 유용합니다.

```bash
# 현재 CPU 유휴율 추출
top -bn1 | grep '%Cpu' | awk '{print "idle:", $8}'

# CPU 상위 5개 프로세스 (헤더 제외)
top -bn1 -o %CPU | awk 'NR>7 {print}' | head -5
```

`htop`은 배치 모드가 없으므로 스크립트 자동화에는 `top -bn1` 또는 `ps aux`를 사용합니다.

---

**지난 글:** [pstree — 프로세스 부모-자식 트리 한눈에 보기](/posts/linux-pstree/)

**다음 글:** [kill과 시그널 — 프로세스에 명령을 보내는 방법](/posts/linux-kill-signals/)

<br>
읽어주셔서 감사합니다. 😊
