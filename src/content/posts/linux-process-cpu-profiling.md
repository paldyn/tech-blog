---
title: "프로세스 CPU 프로파일링 — perf와 FlameGraph로 병목 찾기"
description: "CPU 프로파일링의 샘플링 원리, perf record/report/stat 사용법, FlameGraph 생성 파이프라인, On-CPU vs Off-CPU 프로파일링, bpftrace 활용까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 8
type: "knowledge"
category: "Linux"
tags: ["linux", "performance", "profiling", "perf", "flamegraph", "cpu", "bpftrace", "debugging"]
featured: false
draft: false
---

[지난 글](/posts/linux-disk-iops-latency/)에서 스토리지 성능 지표를 측정하는 방법을 살펴봤습니다. 이번에는 **CPU 프로파일링** — 프로세스의 어느 함수가 CPU를 많이 쓰는지 찾아내는 기법을 알아봅니다. 느린 서비스의 병목을 코드 레벨에서 정확히 찾을 때 필수 기술입니다.

## 샘플링 프로파일러 원리

![CPU 프로파일링 스택 추적 원리](/assets/posts/linux-process-cpu-profiling-stack.svg)

CPU 프로파일러는 일정 주기(예: 99Hz)로 **인터럽트를 걸어 현재 콜 스택을 기록**합니다. 수만 번의 샘플을 수집한 뒤 각 함수가 스택 최상단에 있던 횟수를 집계하면, 실제로 CPU를 쓴 코드가 어디인지 통계적으로 알 수 있습니다.

- **99Hz로 샘플링하는 이유**: 100Hz는 타이머 인터럽트(100Hz)와 위상이 맞아 편향이 생길 수 있음. 소수 주파수로 오차를 줄임
- **On-CPU 프로파일링**: CPU를 실제로 사용하는 코드 발견 (CPU 집약 문제)
- **Off-CPU 프로파일링**: I/O 대기, 락 경쟁으로 잠든 코드 발견 (레이턴시 문제)

## perf 기본 사용법

`perf`는 리눅스 커널에 내장된 성능 도구입니다. 하드웨어 카운터, 커널 트레이싱, 샘플링 프로파일링을 모두 지원합니다.

```bash
# 설치
sudo apt install linux-perf linux-tools-$(uname -r)

# 특정 프로세스 30초 프로파일링
sudo perf record -g -p 1234 sleep 30

# 시스템 전체 (모든 CPU, 모든 프로세스)
sudo perf record -ag -F 99 sleep 30

# 결과 보기 (대화형 TUI)
perf report

# 텍스트 형식
perf report --stdio | head -50

# 특정 함수 어노테이션
perf annotate compress_data
```

`-g` 플래그는 콜 그래프(스택 추적)를 활성화합니다. 없으면 함수명만 수집하고 호출 관계를 알 수 없습니다.

## FlameGraph 생성

![CPU 프로파일링 도구](/assets/posts/linux-process-cpu-profiling-tools.svg)

FlameGraph는 수천~수만 개의 스택 샘플을 한눈에 보여주는 SVG 시각화입니다. 너비가 넓을수록 해당 함수의 CPU 사용 비율이 높습니다.

```bash
# FlameGraph 스크립트 다운로드
git clone https://github.com/brendangregg/FlameGraph
cd FlameGraph

# 1. 스택 샘플 수집
sudo perf record -g -F 99 -p 1234 sleep 30

# 2. 텍스트로 변환
sudo perf script > /tmp/stacks.txt

# 3. 집계 + SVG 생성
./stackcollapse-perf.pl /tmp/stacks.txt | ./flamegraph.pl > flame.svg

# 브라우저에서 열기 (인터랙티브)
xdg-open flame.svg
```

FlameGraph 읽는 법:
- 아래에서 위로 = 콜 스택 (아래가 호출자, 위가 피호출자)
- 너비 = 전체 샘플 중 해당 함수가 차지한 비율
- **가장 위에 넓은 막대 = 실제 CPU를 쓰는 핫스팟**
- 색상은 기본적으로 의미 없음 (구분용)

## perf stat — 하드웨어 카운터

```bash
# 기본 통계 (캐시 미스, IPC 등)
perf stat ls /

# 특정 이벤트 측정
perf stat -e cache-misses,cache-references,instructions,cycles \
    ./my_program

# 결과 해석
# Instructions per cycle (IPC) < 1 이면 메모리 병목 가능성
# LLC-load-misses 높으면 L3 캐시 미스 많음
# branch-misses 높으면 분기 예측 실패 많음
```

## perf top — 실시간 모니터링

```bash
# 전체 시스템 핫스팟 실시간 확인
sudo perf top

# 특정 프로세스
sudo perf top -p 1234

# 커널 함수만
sudo perf top --call-graph dwarf
```

## Off-CPU 분석 (레이턴시 문제)

CPU를 많이 쓰지 않는데 응답이 느린 경우, 프로세스가 I/O 대기나 락 경쟁으로 잠들어 있는 경우가 많습니다.

```bash
# bpfcc-tools 설치
sudo apt install bpfcc-tools

# Off-CPU 시간 측정 (20초)
sudo offcputime-bpfcc -p 1234 20

# 결과를 FlameGraph로
sudo offcputime-bpfcc -p 1234 20 | ./flamegraph.pl \
    --title="Off-CPU Time" --colors=io > offcpu.svg
```

## 실전 시나리오: Python 앱 병목 찾기

```bash
# py-spy: Python 전용 샘플링 프로파일러 (root 불필요)
pip install py-spy

# 실시간 top 형식
py-spy top --pid 1234

# FlameGraph 생성
py-spy record -o profile.svg --pid 1234

# 특정 함수 확인 후 최적화 포인트 파악
```

Java, Go, Node.js 등 각 런타임에 맞는 프로파일러가 있지만, 리눅스 `perf`는 네이티브 코드 경계를 포함해 가장 낮은 레벨까지 추적합니다.

## 디버그 심볼 문제

프로파일 결과에 함수명 대신 주소(`[unknown]`)가 나타나면 디버그 심볼이 없는 것입니다.

```bash
# 커널 심볼
sudo apt install linux-image-$(uname -r)-dbg

# 라이브러리 심볼
sudo apt install libc6-dbg

# 자신의 프로그램: -g 플래그로 컴파일
gcc -g -O2 -o app app.c

# frame pointer 없는 바이너리는 --call-graph dwarf 사용
perf record --call-graph dwarf -p 1234 sleep 30
```

---

**지난 글:** [디스크 IOPS와 지연 시간 — 스토리지 성능 측정과 분석](/posts/linux-disk-iops-latency/)

**다음 글:** [메모리 누수 조사 — valgrind·heaptrack·smaps로 원인 찾기](/posts/linux-memory-leak-investigation/)

<br>
읽어주셔서 감사합니다. 😊
