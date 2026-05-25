---
title: "Flame Graph — CPU 병목을 시각화하는 플레임 그래프"
description: "Flame Graph의 읽는 법, perf record + flamegraph.pl 생성 워크플로, BCC profile 방식, Off-CPU/Memory 변형, 심볼 없을 때 대처법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["linux", "flame-graph", "performance", "profiling", "perf", "BCC", "cpu", "debugging"]
featured: false
draft: false
---

[지난 글](/posts/linux-eBPF-overview/)에서 eBPF의 전체 생태계를 살펴봤습니다. 이번에는 eBPF/perf 샘플링 결과를 직관적으로 시각화하는 **Flame Graph(플레임 그래프)**를 알아봅니다. Brendan Gregg가 설계한 이 시각화 기법은 수천 개의 스택 트레이스를 한 화면에서 병목을 즉시 파악할 수 있게 해줍니다.

## Flame Graph 읽는 법

플레임 그래프는 CPU 프로파일링 샘플을 집계한 결과물입니다. 각 직사각형(bar)은 하나의 스택 프레임을 나타냅니다.

![Flame Graph 구조](/assets/posts/linux-flame-graphs-concept.svg)

핵심 규칙:
- **가로 너비** = 전체 샘플 중 해당 함수가 차지한 비율 (CPU 시간)
- **세로 위치** = 스택 깊이 (아래 = 호출자, 위 = 피호출자)
- **색상** = 의미 없음, 단순 구분용 (기본은 붉은 계열)
- **맨 위 함수** = 실제로 CPU를 소비하는 "리프" 함수

병목을 찾는 방법:
1. 가장 **넓은 바**를 찾는다 → 가장 많은 CPU를 쓰는 호출 체인
2. 그 바의 **맨 위**를 본다 → 최적화 대상 함수
3. "평평한 고원(plateau)"이 보이면 → 그 함수 자체가 CPU 소비

## 생성 도구 설치

```bash
# FlameGraph 스크립트 클론
git clone https://github.com/brendangregg/FlameGraph
export PATH=$PATH:$PWD/FlameGraph

# perf 도구
sudo apt install linux-perf linux-tools-common

# BCC 도구 (Ubuntu)
sudo apt install bpfcc-tools
```

## perf 방식으로 생성

가장 전통적인 방법입니다. 커널 심볼과 유저스페이스 심볼을 함께 수집합니다.

```bash
# 1. 30초간 99Hz 샘플링 (-g: 콜 그래프 포함)
sudo perf record -F 99 -g -p 1234 -- sleep 30

# 전체 시스템 프로파일링
sudo perf record -F 99 -g -a -- sleep 30

# 2. 스택 트레이스 텍스트 추출
sudo perf script > /tmp/perf.out

# 3. 접힌(folded) 형식으로 변환
stackcollapse-perf.pl /tmp/perf.out > /tmp/folded.txt

# 4. SVG 생성
flamegraph.pl /tmp/folded.txt > /tmp/flame.svg

# 5. 브라우저에서 열기
xdg-open /tmp/flame.svg
```

![Flame Graph 생성 워크플로](/assets/posts/linux-flame-graphs-workflow.svg)

## BCC profile 방식 (더 간편)

```bash
# 30초간 99Hz 샘플링 (접힌 형식으로 바로 출력)
sudo profile -F 99 -f 30 > /tmp/out.txt

# SVG 생성
flamegraph.pl /tmp/out.txt > /tmp/flame.svg

# 특정 프로세스만
sudo profile -F 99 -f -p 1234 30 | flamegraph.pl > flame.svg
```

`profile`은 `/usr/share/bcc/tools/profile` 또는 `bcc-tools` 패키지에 포함되어 있습니다.

## bpftrace 방식

```bash
# bpftrace로 스택 수집
sudo bpftrace -e 'profile:hz:99 { @[kstack, ustack, comm] = count(); }' \
  -c './myapp' > /tmp/bpf.out

# 변환 후 SVG 생성
stackcollapse-bpftrace.pl /tmp/bpf.out | flamegraph.pl > flame.svg
```

## 심볼이 없을 때

프레임에 주소만 나오고 함수명이 없는 경우입니다.

```bash
# Java: perf-map-agent 사용
# Go: 빌드 시 인라인 최적화 끄기
go build -gcflags="-N -l" ./myapp

# Node.js
node --perf-basic-prof myapp.js &
sudo perf record -F 99 -g -p $! -- sleep 30
node-v8-flamegraph /tmp/perf.data > flame.svg

# 커널 심볼 누락: /proc/sys/kernel/kptr_restrict 확인
echo 0 | sudo tee /proc/sys/kernel/kptr_restrict
```

## Off-CPU Flame Graph

On-CPU 프로파일링은 CPU를 쓰는 코드를 잡지만, I/O 대기나 락 경합처럼 **CPU를 쓰지 않고 기다리는 시간**은 잡히지 않습니다.

```bash
# Off-CPU 시간 추적 (BCC)
sudo offcputime -f -p 1234 30 > /tmp/offcpu.txt
flamegraph.pl --color=io --title="Off-CPU Flame Graph" \
  /tmp/offcpu.txt > offcpu.svg
```

On-CPU와 Off-CPU를 비교하면 "CPU를 많이 써서 느린지" vs "I/O를 기다려서 느린지"를 명확히 구분할 수 있습니다.

## 인터랙티브 기능

생성된 SVG는 브라우저에서 열면 인터랙티브합니다:
- **클릭**: 해당 스택 프레임으로 줌인 (드릴다운)
- **Ctrl+F**: 함수명 검색 (매칭되는 프레임 하이라이트)
- **더블클릭**: 전체 보기로 복귀

```bash
# 색상 테마 지정
flamegraph.pl --color=java /tmp/folded.txt > java.svg
flamegraph.pl --color=mem /tmp/folded.txt > mem.svg

# 제목 지정
flamegraph.pl --title="Production API Server" /tmp/folded.txt > api.svg

# 너비 조정
flamegraph.pl --width 1400 /tmp/folded.txt > wide.svg
```

## 실전 팁

`perf record -F 99` 에서 99Hz를 쓰는 이유는 100Hz가 타이머 인터럽트(100Hz)와 동기화되어 정확한 샘플을 못 얻을 수 있기 때문입니다. 997처럼 소수를 쓰기도 합니다.

프로덕션 서버에서 perf를 실행하면 CPU 오버헤드가 1~5% 정도 발생합니다. BCC의 `profile`은 eBPF 기반이라 오버헤드가 더 낮습니다.

---

**지난 글:** [eBPF 개요 — 커널을 재컴파일 없이 관찰하는 혁신적 기술](/posts/linux-eBPF-overview/)

**다음 글:** [perf record/report — 리눅스 성능 분석의 스위스 아미 나이프](/posts/linux-perf-record-report/)

<br>
읽어주셔서 감사합니다. 😊
