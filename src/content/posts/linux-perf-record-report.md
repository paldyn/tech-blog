---
title: "perf record/report — 리눅스 성능 분석의 스위스 아미 나이프"
description: "perf record·report·stat·top·annotate·diff 서브커맨드 사용법, 하드웨어 PMU 카운터 해석(IPC·캐시미스·브랜치미스), FlameGraph 연동, 실전 CPU 프로파일링 워크플로를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["linux", "perf", "performance", "profiling", "PMU", "cpu", "cache", "debugging"]
featured: false
draft: false
---

[지난 글](/posts/linux-flame-graphs/)에서 Flame Graph로 CPU 병목을 시각화하는 방법을 배웠습니다. Flame Graph를 만들 때 핵심 도구가 바로 **perf**입니다. 이번에는 perf의 주요 서브커맨드를 체계적으로 살펴봅니다.

perf는 리눅스 커널 소스에 포함된 공식 성능 분석 도구로, 하드웨어 PMU(Performance Monitoring Unit) 카운터부터 소프트웨어 이벤트, 커널 트레이스포인트까지 다룹니다.

## 설치

```bash
# Ubuntu/Debian
sudo apt install linux-perf linux-tools-common \
  linux-tools-$(uname -r)

# RHEL/Fedora
sudo dnf install perf

# 버전 확인
perf --version
```

커널 심볼을 보려면 `/proc/sys/kernel/kptr_restrict`를 0으로 낮춰야 합니다.

```bash
sudo sh -c 'echo 0 > /proc/sys/kernel/kptr_restrict'
sudo sh -c 'echo -1 > /proc/sys/kernel/perf_event_paranoid'
```

## perf record — 샘플 수집

```bash
# 특정 프로세스, 99Hz, 콜 그래프 포함
sudo perf record -F 99 -g -p 1234 -- sleep 30

# 전체 시스템 (-a)
sudo perf record -F 99 -g -a -- sleep 30

# 특정 이벤트 (캐시 미스)
sudo perf record -e LLC-load-misses -g -p 1234 -- sleep 10

# DWARF 기반 콜 그래프 (JIT/Go용)
sudo perf record --call-graph dwarf -F 99 -p 1234 -- sleep 30
```

결과는 `perf.data` 파일에 저장됩니다.

## perf report — 결과 분석

```bash
# TUI 인터랙티브 분석
sudo perf report

# 텍스트 모드 (파이프 처리용)
sudo perf report --stdio

# 콜 체인 포함
sudo perf report --call-graph

# 특정 함수만 필터
sudo perf report --symbol-filter=parseJSON
```

TUI에서 `Enter`를 누르면 드릴다운하여 호출 체인을 볼 수 있고, `a`를 누르면 어셈블리 어노테이션을 볼 수 있습니다.

![perf 서브커맨드 구조](/assets/posts/linux-perf-record-report-arch.svg)

## perf stat — 하드웨어 카운터

프로그램 실행 중 PMU 카운터를 수집합니다.

```bash
# 기본 카운터
perf stat ./myapp

# 특정 카운터 지정
perf stat -e cycles,instructions,cache-misses ./myapp

# 반복 실행 (평균/분산 계산)
perf stat -r 5 ./myapp

# 실행 중인 프로세스에 attach
perf stat -p 1234 -- sleep 10

# 더 많은 카운터
perf stat -e \
  cycles,instructions,\
  cache-references,cache-misses,\
  branch-instructions,branch-misses \
  ./myapp
```

![perf stat 출력 해석](/assets/posts/linux-perf-record-report-stat.svg)

## perf top — 실시간 모니터링

저장 없이 실시간으로 CPU를 많이 쓰는 함수를 보여줍니다.

```bash
# 전체 시스템
sudo perf top

# 특정 프로세스
sudo perf top -p 1234

# 커널 함수만
sudo perf top --no-children

# 1초 간격 갱신
sudo perf top -d 1
```

## perf annotate — 어셈블리 수준 분석

핫 함수의 어느 인스트럭션이 많은 시간을 소비하는지 확인합니다.

```bash
# perf record 후 실행
sudo perf annotate parseJSON

# 어셈블리 + 소스 (디버그 정보 필요)
sudo perf annotate --source parseJSON
```

## 사용 가능한 이벤트 목록

```bash
# 모든 이벤트 목록
perf list

# 하드웨어 이벤트만
perf list hw

# 소프트웨어 이벤트
perf list sw

# 커널 트레이스포인트
perf list tracepoint | grep syscalls
```

자주 쓰는 이벤트:
- `cycles`, `instructions`: IPC 계산
- `cache-references`, `cache-misses`: L3 캐시 효율
- `branch-instructions`, `branch-misses`: 분기 예측 효율
- `LLC-load-misses`: 마지막 레벨 캐시 미스 (메모리 접근 비용)
- `page-faults`: 페이지 폴트 횟수

## perf diff — 성능 회귀 분석

두 `perf.data`를 비교하여 최적화 전후를 확인합니다.

```bash
# 최적화 전 수집
sudo perf record -F 99 -g ./app_old -- sleep 10
mv perf.data perf.data.before

# 최적화 후 수집
sudo perf record -F 99 -g ./app_new -- sleep 10

# 비교
sudo perf diff perf.data.before perf.data
```

## FlameGraph 연동 (복습)

```bash
sudo perf record -F 99 -g -p 1234 -- sleep 30
sudo perf script | stackcollapse-perf.pl | flamegraph.pl > flame.svg
```

## 실전 워크플로: DB 쿼리 느린 경우

```bash
# 1. PostgreSQL 프로세스 PID 찾기
pgrep -f postgres

# 2. 30초 샘플링
sudo perf record -F 99 -g -p 1234 -- sleep 30

# 3. 빠른 확인
sudo perf report --stdio | head -30

# 4. 캐시 미스 집중 분석
sudo perf stat -e LLC-load-misses,LLC-store-misses -p 1234 -- sleep 10

# 5. FlameGraph 생성
sudo perf script | stackcollapse-perf.pl | flamegraph.pl > db.svg
```

---

**지난 글:** [Flame Graph — CPU 병목을 시각화하는 플레임 그래프](/posts/linux-flame-graphs/)

**다음 글:** [Page Cache — 리눅스 메모리 캐시의 핵심 구조](/posts/linux-page-cache/)

<br>
읽어주셔서 감사합니다. 😊
