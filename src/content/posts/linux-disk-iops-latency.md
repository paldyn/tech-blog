---
title: "디스크 IOPS와 지연 시간 — 스토리지 성능 측정과 분석"
description: "IOPS·처리량·지연 시간 세 지표의 의미와 관계, fio·dd·iostat·ioping으로 스토리지 성능을 측정하는 방법, HDD vs SSD vs NVMe 특성 비교를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 7
type: "knowledge"
category: "Linux"
tags: ["linux", "storage", "iops", "latency", "throughput", "fio", "iostat", "disk", "performance"]
featured: false
draft: false
---

[지난 글](/posts/linux-fuse-overview/)에서 FUSE로 사용자 공간 파일시스템을 구현하는 방법을 살펴봤습니다. 이번에는 스토리지 성능의 세 가지 핵심 지표인 **IOPS, 처리량(Throughput), 지연 시간(Latency)**을 이해하고 측정하는 방법을 알아봅니다.

## 세 가지 성능 지표

![IOPS vs 처리량 vs 지연 시간](/assets/posts/linux-disk-iops-latency-concept.svg)

### IOPS (I/O Operations Per Second)

초당 처리하는 I/O 요청 수입니다. **작은 블록의 랜덤 I/O** 성능을 측정할 때 핵심 지표입니다. 데이터베이스는 작은 레코드를 무작위 위치에서 읽고 쓰기 때문에 IOPS가 결정적입니다.

### 처리량 (Throughput, MB/s)

단위 시간당 이동하는 데이터 양입니다. **대형 순차 I/O** — 백업, 동영상 스트리밍, 머신러닝 학습 데이터 로딩에 중요합니다.

관계식: `처리량(MB/s) = IOPS × 블록 크기(KB) / 1024`

4KB 블록으로 50,000 IOPS = 약 195 MB/s, 1MB 블록으로 1,000 IOPS = 1,000 MB/s.

### 지연 시간 (Latency, ms/µs)

I/O 요청 발행 후 완료까지 걸리는 시간입니다. **응답성**이 중요한 OLTP 데이터베이스, 캐시 서버에서 결정적입니다. HDD는 플래터 회전과 헤드 이동으로 5~10ms, NVMe SSD는 20~100µs입니다.

## 측정 도구

![스토리지 성능 측정 도구](/assets/posts/linux-disk-iops-latency-tools.svg)

### fio — 정밀 벤치마크

가장 강력한 I/O 벤치마크 도구입니다. 랜덤/순차, 읽기/쓰기, 블록 크기, 병렬 수, I/O 깊이를 자유롭게 조합할 수 있습니다.

```bash
sudo apt install fio

# 4K 랜덤 읽기 IOPS 측정
fio --name=randread \
    --rw=randread \
    --bs=4k \
    --iodepth=32 \
    --numjobs=4 \
    --runtime=30 \
    --size=10G \
    --filename=/tmp/fio-test \
    --group_reporting

# 순차 쓰기 처리량 측정
fio --name=seqwrite \
    --rw=write \
    --bs=1M \
    --numjobs=1 \
    --size=4G \
    --filename=/tmp/fio-test \
    --group_reporting
```

출력에서 주목할 항목:
- `read: IOPS=...` — 초당 읽기 횟수
- `BW=...` — 처리량(MB/s)
- `lat (usec): min=..., avg=...` — 지연 시간 분포
- `clat percentiles` — p99, p999 지연 (꼬리 지연)

### iostat — 실시간 I/O 모니터링

```bash
# 1초 간격 상세 출력
iostat -x 1

# 특정 디바이스만
iostat -x sda nvme0n1 1

# 출력 항목 설명
# r/s     — 초당 읽기 요청 (IOPS)
# w/s     — 초당 쓰기 요청 (IOPS)
# rMB/s   — 읽기 처리량
# wMB/s   — 쓰기 처리량
# await   — 평균 I/O 대기 시간 (ms)
# r_await — 읽기 대기 시간
# w_await — 쓰기 대기 시간
# %util   — 디스크 포화도 (100%면 병목)
# aqu-sz  — 평균 큐 깊이
```

`%util`이 100%에 가깝고 `await`가 높다면 디스크가 병목입니다.

### dd — 간이 처리량 측정

빠르게 처리량을 확인할 때 씁니다. IOPS보다 처리량 측정에 더 적합합니다.

```bash
# 쓰기 속도 (fsync로 캐시 우회)
dd if=/dev/zero of=/tmp/testfile bs=1M count=2048 conv=fsync
# 2048+0 records in
# 2147483648 bytes ... copied, 4.5 s, 477 MB/s

# 읽기 전 페이지 캐시 비우기
echo 3 | sudo tee /proc/sys/vm/drop_caches

# 읽기 속도
dd if=/tmp/testfile of=/dev/null bs=1M
```

### ioping — 지연 시간 측정

```bash
sudo apt install ioping

# 디바이스 직접 지연 측정
ioping -c 20 /dev/sda

# 파일시스템 레벨
ioping -c 20 /tmp

# 출력 예시:
# 4 KiB <<< /tmp (tmpfs): request=1 time=11.4 us
# min/avg/max/mdev = 8.3/12.1/22.5/3.8 us
```

## I/O 스케줄러

리눅스 커널은 I/O 요청의 순서를 최적화하는 스케줄러를 사용합니다.

```bash
# 현재 스케줄러 확인
cat /sys/block/sda/queue/scheduler
# [mq-deadline] kyber none

# HDD에는 mq-deadline (회전 지연 최소화)
echo mq-deadline > /sys/block/sda/queue/scheduler

# NVMe/SSD에는 none (큐잉 불필요)
echo none > /sys/block/nvme0n1/queue/scheduler

# kyber (SSD 병렬성 활용)
echo kyber > /sys/block/sda/queue/scheduler
```

## 처리량 병목 분석 시나리오

```bash
# 1. I/O 대기 프로세스 확인
iotop -ao

# 2. 어느 파일에 I/O가 집중되는지
lsof | awk '{print $9}' | sort | uniq -c | sort -rn | head

# 3. BPF 기반 디스크 지연 분포
biolatency -D  # bpftrace 설치 필요

# 4. 스택 추적으로 I/O 유발 코드 찾기
perf record -e block:block_rq_issue -g sleep 10
perf report
```

## 스토리지 유형별 기대값

| 유형 | 순차 읽기 | 랜덤 4K IOPS | 지연 |
|------|-----------|-------------|------|
| HDD 7200rpm | ~150 MB/s | ~150 | ~5 ms |
| SATA SSD | ~550 MB/s | ~50K | ~100 µs |
| NVMe Gen3 | ~3.5 GB/s | ~400K | ~50 µs |
| NVMe Gen4 | ~7 GB/s | ~1M+ | ~20 µs |
| RAM (tmpfs) | ~40 GB/s | 무제한 | ~100 ns |

---

**지난 글:** [FUSE — 사용자 공간에서 파일시스템 만들기](/posts/linux-fuse-overview/)

**다음 글:** [프로세스 CPU 프로파일링 — perf와 FlameGraph로 병목 찾기](/posts/linux-process-cpu-profiling/)

<br>
읽어주셔서 감사합니다. 😊
