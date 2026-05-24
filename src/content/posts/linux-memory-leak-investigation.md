---
title: "메모리 누수 조사 — valgrind·heaptrack·smaps로 원인 찾기"
description: "진성 누수·논리적 누수·단편화 세 유형 구분, RSS vs USS 지표 해석, valgrind·heaptrack·memleak(eBPF)·smaps 분석 방법, OOM Killer 대응 전략을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["linux", "memory", "leak", "valgrind", "heaptrack", "debugging", "performance", "oom", "smaps"]
featured: false
draft: false
---

[지난 글](/posts/linux-process-cpu-profiling/)에서 CPU 프로파일링으로 병목 함수를 찾는 방법을 살펴봤습니다. 이번에는 **메모리 누수(Memory Leak)** 조사 방법을 알아봅니다. 서버가 시간이 지날수록 점점 메모리를 먹어 결국 OOM으로 죽는 문제는, 원인을 찾지 못하면 재시작만 반복하게 됩니다.

## 세 가지 메모리 누수 유형

![메모리 누수 유형](/assets/posts/linux-memory-leak-investigation-types.svg)

### 진성 누수 (True Leak)

C/C++에서 `malloc()`으로 할당한 뒤 포인터를 잃어버려 `free()`를 호출할 수 없는 상태입니다. valgrind는 이를 "definitely lost"로 분류합니다. 프로세스가 살아있는 한 메모리가 계속 증가합니다.

### 논리적 누수 (Logical Leak)

GC 기반 언어(Java, Python, Node.js)에서 흔합니다. 객체 참조가 남아 있어 GC가 수거하지 못하는 경우입니다. 전역 캐시나 컬렉션에 객체를 계속 추가하면서 제거하지 않는 패턴이 대표적입니다.

### 단편화 (Fragmentation)

실제 누수는 없지만 힙이 파편화되어 사용하지 않는 빈 공간이 생깁니다. glibc `malloc`의 멀티스레드 arena 설계로 인해 많은 스레드가 있는 앱에서 자주 발생합니다.

## 메모리 지표 이해

프로세스 메모리를 정확히 측정하려면 올바른 지표를 선택해야 합니다.

```bash
# top/ps가 보여주는 기본 지표
ps aux | grep my_app
# VSZ(VIRT): 가상 주소 공간 — 과장됨, 신뢰하지 말 것
# RSS(RES): 실제 물리 메모리 — 공유 라이브러리 포함

# 더 정확한 측정
cat /proc/1234/smaps_rollup
# Pss: Proportional Set Size (공유 메모리 비례 배분)
# Private_Dirty: Unique Set Size (단독 사용, 누수 측정 최적)

# pmap으로 메모리 맵 전체 보기
pmap -x 1234 | tail -20
```

`Private_Dirty` 값이 시간이 지남에 따라 계속 증가하면 진성 누수입니다.

## 조기 탐지

```bash
# RSS를 5초마다 측정
while true; do
    date
    grep VmRSS /proc/1234/status
    sleep 5
done

# OOM Killer 발동 확인
dmesg | grep -i "out of memory"
dmesg | grep -i "oom"
journalctl -k | grep -i oom

# 스왑 사용량 증가 모니터링
watch -n 5 'free -h; swapon --show'
```

## 도구별 조사 방법

![메모리 누수 조사 도구](/assets/posts/linux-memory-leak-investigation-tools.svg)

### valgrind — C/C++ 진성 누수

```bash
# 메모리 누수 전체 검사
valgrind \
    --leak-check=full \
    --show-leak-kinds=all \
    --track-origins=yes \
    --verbose \
    ./my_program 2>&1 | tee valgrind.log

# 출력 해석
# definitely lost: 진성 누수 (반드시 수정)
# indirectly lost: 다른 누수로 인해 접근 불가
# possibly lost: 포인터가 내부를 가리킴 (확인 필요)
# still reachable: 프로그램 종료 시 해제 안 됨 (일반적으로 무시)
```

valgrind는 모든 메모리 접근을 인터셉트하므로 프로그램이 10~50배 느려집니다. 테스트 환경에서만 사용합니다.

### heaptrack — 낮은 오버헤드 힙 추적

```bash
# 설치
sudo apt install heaptrack heaptrack-gui

# 프로그램 시작부터 추적
heaptrack ./my_program

# 실행 중인 프로세스에 attach
heaptrack --pid 1234

# 10분 후 Ctrl+C로 중단, 파일 생성됨
# heaptrack.my_program.12345.zst

# CLI 분석
heaptrack_print heaptrack.*.zst | head -50

# GUI 분석 (FlameGraph 형태)
heaptrack_gui heaptrack.*.zst
```

### smaps + 시계열 분석 — 구체적 범위 파악

```bash
# 힙 영역의 크기만 추출
python3 - <<'EOF'
import re, time

pid = 1234
for i in range(60):
    with open(f'/proc/{pid}/smaps') as f:
        content = f.read()
    heap = sum(int(m) for m in re.findall(r'\[heap\].*?Size:\s+(\d+)', content, re.DOTALL))
    print(f'{time.strftime("%H:%M:%S")} heap={heap} kB')
    time.sleep(10)
EOF
```

### memleak (eBPF) — 프로덕션 환경

```bash
# bpfcc-tools 설치
sudo apt install bpfcc-tools

# 특정 프로세스의 미해제 할당 추적
sudo memleak-bpfcc -p 1234

# 30초 동안 5초마다 상위 누수 출력
sudo memleak-bpfcc -p 1234 -t 5 30

# 출력: 콜 스택 + 누적 미해제 바이트
# ADDRESS          SIZE    AGE(ms) COMM/PID
# [...]
# 1 bytes in 1 allocations from
#     malloc (in libc.so)
#     do_leak (/app/server.c:42)
#     main (/app/server.c:100)
```

valgrind와 달리 eBPF 기반이라 오버헤드가 낮아 프로덕션에서도 짧은 시간 사용 가능합니다.

## OOM Killer 대응

```bash
# OOM 우선순위 조정 (-1000: 절대 죽이지 않음, 1000: 가장 먼저 죽임)
echo -500 > /proc/1234/oom_score_adj

# 중요 서비스 보호
echo -900 > /proc/$(pidof postgres)/oom_score_adj

# 현재 OOM 점수 확인
cat /proc/1234/oom_score
```

## 언어별 논리적 누수 탐지

```python
# Python: tracemalloc으로 할당 추적
import tracemalloc
tracemalloc.start()

# ... 코드 실행 ...

snapshot = tracemalloc.take_snapshot()
stats = snapshot.statistics('lineno')
for stat in stats[:10]:
    print(stat)
```

```bash
# Java: heap dump 분석
jcmd 1234 VM.heap_info
jcmd 1234 GC.heap_dump /tmp/heap.hprof

# Eclipse MAT나 jhat으로 분석
jhat /tmp/heap.hprof
# http://localhost:7000 에서 브라우저로 확인
```

---

**지난 글:** [프로세스 CPU 프로파일링 — perf와 FlameGraph로 병목 찾기](/posts/linux-process-cpu-profiling/)

**다음 글:** [strace 기초 — 시스템 콜 추적으로 프로그램 내부 들여다보기](/posts/linux-strace-basics/)

<br>
읽어주셔서 감사합니다. 😊
