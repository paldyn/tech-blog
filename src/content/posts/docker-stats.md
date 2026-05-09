---
title: "docker stats — 실시간 리소스 모니터링"
description: "docker stats의 출력 컬럼 해석(CPU%, MEM, NET I/O, BLOCK I/O, PIDS), --no-stream/--format 옵션, 리소스 제한과의 연계를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 9
type: "knowledge"
category: "Docker"
tags: ["Docker", "docker stats", "리소스 모니터링", "CPU", "메모리", "cgroup"]
featured: false
draft: false
---

[지난 글](/posts/docker-inspect/)에서 컨테이너의 정적 메타데이터를 조회하는 방법을 살펴봤습니다. 이번에는 CPU, 메모리, 네트워크, 디스크 I/O를 **실시간으로 모니터링**하는 `docker stats`를 다룹니다.

## 기본 사용법

```bash
docker stats                  # 모든 실행 중인 컨테이너 실시간 표시
docker stats web db           # 특정 컨테이너만
docker stats --no-stream      # 1회 스냅샷 후 종료
```

기본적으로 `top`처럼 화면을 갱신하며 실시간으로 표시합니다. `Ctrl+C`로 종료합니다.

## 출력 컬럼 해부

![docker stats 출력 컬럼 해부](/assets/posts/docker-stats-output.svg)

| 컬럼 | 의미 |
|------|------|
| CPU% | 전체 CPU 코어 대비 사용률. 4코어 환경에서 최대 400% |
| MEM USAGE/LIMIT | 실제 메모리 사용량 / 설정된 제한 (제한 없으면 호스트 전체) |
| MEM% | MEM LIMIT 대비 사용 비율 |
| NET I/O | 컨테이너 시작 이후 수신 / 송신 누계 |
| BLOCK I/O | 디스크 읽기 / 쓰기 누계 |
| PIDS | 컨테이너 내 프로세스(쓰레드 포함) 수 |

## CPU% 주의사항

멀티코어 환경에서 CPU%는 **전체 코어 수 × 100%**가 최대입니다. 4코어 서버에서 400%면 모든 코어를 다 쓰고 있는 상태입니다.

```bash
# --cpus 제한 시 해당 비율까지만 표시
docker run --cpus 2.0 myapp
# → CPU% 최대 200%
```

## 리소스 제한과의 연계

![리소스 제한과 stats 연계](/assets/posts/docker-stats-limits.svg)

`--memory` 제한을 설정하지 않으면 MEM LIMIT이 호스트 전체 메모리로 표시됩니다. 제한을 설정해야 MEM% 값이 의미 있고, 초과 시 OOMKilled가 발생합니다.

```bash
# 메모리 제한 설정
docker run --memory 512m --memory-swap 512m myapp

# 제한 초과 여부 확인
docker inspect -f '{{.State.OOMKilled}}' myapp
```

`--memory-swap`을 메모리와 동일하게 설정하면 스왑 사용을 비활성화합니다.

## --format 옵션

```bash
# 커스텀 포맷 (이름, CPU, 메모리만)
docker stats --format '{{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}'

# JSON Lines 형식 (스크립트·모니터링에)
docker stats --no-stream --format '{{json .}}'

# 표 헤더 포함
docker stats --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemPerc}}'
```

Go 템플릿 필드: `.Name`, `.CPUPerc`, `.MemUsage`, `.MemPerc`, `.NetIO`, `.BlockIO`, `.PIDs`

## 스크립트 활용

```bash
# 메모리 사용량 높은 순으로 정렬 출력
docker stats --no-stream | sort -k4 -hr

# 특정 컨테이너 CPU만 반복 추출 (5초 간격)
while true; do
  docker stats --no-stream --format '{{.CPUPerc}}' web
  sleep 5
done
```

## docker stats vs /sys/fs/cgroup

`docker stats`는 내부적으로 cgroup의 통계 파일을 읽어서 계산합니다.

```bash
# cgroup 직접 확인 (Linux 호스트)
cat /sys/fs/cgroup/memory/docker/<container-id>/memory.usage_in_bytes
cat /sys/fs/cgroup/cpu/docker/<container-id>/cpuacct.usage
```

Prometheus + cAdvisor를 사용하면 이 지표를 시계열로 수집·시각화할 수 있습니다.

## 정리

`docker stats`는 운영 중인 컨테이너의 리소스 현황을 빠르게 파악하는 도구입니다. `--no-stream`으로 일회성 스냅샷을 찍거나, `--format`으로 필요한 컬럼만 추출해 모니터링 스크립트에 통합할 수 있습니다.

---

**지난 글:** [docker inspect — 컨테이너·이미지 상세 정보 조회](/posts/docker-inspect/)

**다음 글:** [docker top — 컨테이너 내부 프로세스 확인](/posts/docker-top/)

<br>
읽어주셔서 감사합니다. 😊
