---
title: "Page Cache — 리눅스 메모리 캐시의 핵심 구조"
description: "리눅스 Page Cache의 동작 원리(캐시 히트/미스·dirty 페이지·writeback), free 출력 해석, vmstat·/proc/meminfo 모니터링, vm.dirty_* 파라미터 튜닝, drop_caches 주의사항을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["linux", "page-cache", "memory", "performance", "writeback", "vmstat", "sysctl", "tuning"]
featured: false
draft: false
---

[지난 글](/posts/linux-perf-record-report/)에서 perf 도구로 CPU 성능을 분석하는 방법을 배웠습니다. 이번에는 리눅스 메모리 관리의 핵심인 **Page Cache**를 살펴봅니다. 파일 I/O 성능의 대부분이 여기서 결정됩니다.

## Page Cache란

리눅스는 파일을 읽을 때 디스크에서 읽은 데이터를 메모리에 캐시합니다. 같은 파일을 다시 읽으면 디스크 접근 없이 메모리에서 바로 반환합니다. 이것이 **Page Cache**입니다.

![Page Cache 아키텍처](/assets/posts/linux-page-cache-arch.svg)

4KB 단위(페이지)로 관리되며, **LRU(Least Recently Used)** 알고리즘으로 오래 쓰이지 않은 페이지부터 회수합니다. 여유 메모리가 생기면 더 많은 파일을 캐시하고, 메모리가 부족하면 자동으로 캐시를 회수합니다.

## free 출력 이해

```bash
free -h
```

```
              total  used  free  shared  buff/cache  available
Mem:           16Gi  4.2Gi  802Mi   234Mi      11Gi     11Gi
Swap:          2.0Gi     0     0
```

- **used**: 프로세스가 실제 사용 중인 메모리
- **buff/cache**: 페이지 캐시 + 버퍼 캐시
- **available**: 실제 사용 가능한 메모리 (buff/cache 대부분 회수 가능)

`used`가 높아도 `available`이 충분하면 문제없습니다. buff/cache는 프로세스가 더 많은 메모리를 요청하면 커널이 자동으로 돌려줍니다.

## /proc/meminfo 상세 분석

```bash
grep -E 'Cached|Dirty|Writeback|Active|Inactive' /proc/meminfo
```

주요 항목:
| 항목 | 의미 |
|------|------|
| Cached | 파일 페이지 캐시 |
| Dirty | 수정됐지만 아직 디스크에 미반영 |
| Writeback | 현재 디스크에 쓰는 중 |
| Active(file) | 최근 사용된 캐시 페이지 |
| Inactive(file) | 최근 미사용 (회수 대상) |

## dirty 페이지와 writeback

`write()` 시스템 콜은 즉시 디스크에 쓰지 않고 페이지 캐시에만 기록합니다. 이 상태를 **dirty page**라고 합니다. 커널의 writeback 데몬(`kworker`)이 주기적으로 dirty 페이지를 디스크에 플러시합니다.

```bash
# 현재 dirty 페이지 모니터링
watch -n 1 'grep -E "Dirty|Writeback" /proc/meminfo'

# vmstat로 I/O 상태
vmstat 1 | head -20

# iostat으로 디스크 쓰기 확인
iostat -x 1
```

![Page Cache 모니터링](/assets/posts/linux-page-cache-commands.svg)

## vm.dirty_* 파라미터 튜닝

```bash
# 현재 값 확인
sysctl vm.dirty_ratio
sysctl vm.dirty_background_ratio
sysctl vm.dirty_expire_centisecs
sysctl vm.dirty_writeback_centisecs

# 즉각 변경 (재부팅 후 초기화)
sudo sysctl vm.dirty_ratio=10
sudo sysctl vm.dirty_background_ratio=5

# 영구 설정 (/etc/sysctl.conf)
# vm.dirty_ratio = 10
# vm.dirty_background_ratio = 5
```

데이터베이스 서버처럼 쓰기가 많은 경우:
- `dirty_ratio`를 낮춰(10~15) dirty 페이지가 너무 쌓이지 않도록 제한
- `dirty_background_ratio`도 낮춰(3~5) 조기에 writeback 시작

반대로 큰 파일을 빠르게 쓰는 배치 작업이라면:
- `dirty_ratio`를 높여(40~60) 버퍼링을 최대화하고 디스크 쓰기 횟수 감소

## 특정 파일의 캐시 상태 확인

```bash
# vmtouch 설치
sudo apt install vmtouch

# 파일이 캐시에 얼마나 있는지
vmtouch /var/lib/mysql/ib_data1

# 디렉터리 전체
vmtouch /var/lib/mysql/

# 파일을 강제로 캐시에 올리기
vmtouch -t /var/lib/mysql/ib_data1

# 캐시에서 특정 파일만 제거
vmtouch -e /tmp/large_file
```

## drop_caches — 주의해서 사용

```bash
# 반드시 sync 먼저 (dirty 페이지 플러시)
sync

# 페이지 캐시 드롭
echo 1 | sudo tee /proc/sys/vm/drop_caches

# 페이지 캐시 + dentries/inodes 드롭
echo 3 | sudo tee /proc/sys/vm/drop_caches
```

⚠ 프로덕션 서버에서 drop_caches를 실행하면 다음 I/O가 모두 캐시 미스로 처리되어 성능이 급격히 저하됩니다. **벤치마크 전 초기 상태 만들기** 또는 **메모리 부족 긴급 상황**에서만 사용하세요.

## mmap과 페이지 캐시

`mmap()`은 파일을 메모리 주소 공간에 직접 매핑합니다. 내부적으로는 페이지 캐시를 공유합니다.

```c
// C 예시
int fd = open("data.bin", O_RDONLY);
void *map = mmap(NULL, size, PROT_READ, MAP_SHARED, fd, 0);
// 이 접근은 페이지 캐시를 통해 처리됨
char c = ((char*)map)[0];
```

여러 프로세스가 같은 파일을 mmap하면 **페이지 캐시를 공유**하므로 메모리를 중복 사용하지 않습니다. PostgreSQL의 shared_buffers가 이 방식을 이용합니다.

## O_DIRECT — 페이지 캐시 우회

데이터베이스가 자체 버퍼 캐시를 갖는 경우, 페이지 캐시가 이중 캐싱이 되어 메모리 낭비가 됩니다.

```c
// O_DIRECT: 커널 페이지 캐시 우회, 직접 I/O
int fd = open("dbfile", O_RDWR | O_DIRECT);
```

MySQL InnoDB의 `innodb_flush_method=O_DIRECT`, PostgreSQL의 `direct_io`가 이 방식입니다. 단, 읽기 패턴이 순차적이지 않으면 오히려 느려질 수 있습니다.

---

**지난 글:** [perf record/report — 리눅스 성능 분석의 스위스 아미 나이프](/posts/linux-perf-record-report/)

**다음 글:** [OOM Killer — 메모리 부족 시 리눅스가 프로세스를 선택하는 방법](/posts/linux-oom-killer/)

<br>
읽어주셔서 감사합니다. 😊
