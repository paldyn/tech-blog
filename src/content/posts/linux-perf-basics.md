---
title: "perf — 리눅스 성능 분석 기초"
description: "perf stat, perf record, perf report, perf top을 사용해 CPU 이벤트를 수집하고 핫스팟을 찾는 방법을 설명합니다. IPC, cache-miss, 플레임 그래프 생성까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 7
type: "knowledge"
category: "Linux"
tags: ["linux", "perf", "performance", "profiling", "flamegraph", "cpu", "cache", "ipc"]
featured: false
draft: false
---

[지난 글](/posts/linux-iotop-iftop/)에서 프로세스별 I/O·네트워크를 추적하는 방법을 배웠습니다. `iotop`이 "무엇이" I/O를 일으키는지 알려 준다면, `perf`는 "왜 CPU가 느린지"를 하드웨어 이벤트 카운터까지 파고들어 분석합니다.

## perf 설치

```bash
# Ubuntu/Debian
apt install linux-perf

# 또는 linux-tools 패키지 (커널 버전과 맞춰야 함)
apt install linux-tools-$(uname -r) linux-tools-generic

# 버전 확인
perf --version
```

## perf stat — 이벤트 카운터 요약

`perf stat`은 프로그램 실행 중 CPU 이벤트를 집계해 한눈에 보여 줍니다.

```bash
# 명령어 실행하며 통계 수집
perf stat ./mybinary

# 실행 중인 프로세스에 붙이기 (5초)
perf stat -p 1234 sleep 5

# 상세 이벤트 포함 (-d)
perf stat -d ./mybinary
```

![perf 서브명령 구조](/assets/posts/linux-perf-subcommands.svg)

## IPC와 cache-miss 해석

`perf stat` 출력에서 가장 중요한 두 지표는 **IPC**와 **cache-miss 비율**입니다.

```bash
$ perf stat -d ./mybinary

 Performance counter stats for './mybinary':

  5,234,123,456   instructions      #    0.85  insns per cycle   # IPC
     12,345,678   cache-misses      #    2.34% of all cache refs
     12,000,034   cache-references
      3,210,000   branch-misses     #    1.28% of all branches

       2.312345124 seconds time elapsed
```

IPC(Instructions Per Cycle)가 1.0 미만이면 CPU가 메모리를 기다리는 **메모리 바운드** 상태입니다. cache-miss 비율이 5% 이상이면 L3 캐시를 초과한 데이터 접근이 많습니다.

## perf top — 실시간 핫스팟

```bash
# 시스템 전체 실시간 핫스팟 (top과 유사)
sudo perf top

# 콜 그래프 포함 (어떤 호출 경로인지)
sudo perf top -g

# 특정 프로세스만
sudo perf top -p 1234
```

## perf record + report — 상세 프로파일링

```bash
# 샘플 수집 (-F: 초당 샘플 수, -g: 콜그래프)
perf record -F 99 -g ./mybinary
# → perf.data 파일 생성

# 수집 결과 분석
perf report

# 텍스트 출력 (CI 파이프라인용)
perf report --stdio | head -50

# 특정 함수로 필터
perf report --stdio --symbol-filter main
```

## FlameGraph 생성

`perf record` 결과를 시각화하면 어느 함수가 얼마나 CPU를 쓰는지 직관적으로 볼 수 있습니다.

![perf → FlameGraph 생성 흐름](/assets/posts/linux-perf-flamegraph-flow.svg)

```bash
# 30초 시스템 전체 샘플 수집
sudo perf record -F 99 -a -g --call-graph=dwarf sleep 30

# FlameGraph 생성
git clone https://github.com/brendangregg/FlameGraph
sudo perf script | \
  ./FlameGraph/stackcollapse-perf.pl | \
  ./FlameGraph/flamegraph.pl > flame.svg
```

플레임 그래프에서 가로 폭이 넓은 함수일수록 CPU를 많이 사용합니다. 상단에 있을수록 콜 스택의 깊은 곳에 있는 함수입니다.

## 권한과 주의사항

```bash
# 비 root 사용자가 perf 사용하려면
echo -1 > /proc/sys/kernel/perf_event_paranoid  # 임시 허용
# 영구 설정
echo 'kernel.perf_event_paranoid = 1' >> /etc/sysctl.d/99-perf.conf

# 커널 심볼 활성화 (kallsyms)
echo 0 > /proc/sys/kernel/kptr_restrict
```

---

**지난 글:** [iotop과 iftop — I/O·네트워크 실시간 모니터링](/posts/linux-iotop-iftop/)

**다음 글:** [bpftrace — eBPF 기반 동적 추적 입문](/posts/linux-bpftrace-intro/)

<br>
읽어주셔서 감사합니다. 😊
