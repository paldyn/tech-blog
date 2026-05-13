---
title: "cgroups 완전 개요 — 자원 격리의 뼈대"
description: "리눅스 cgroups(Control Groups)의 개념, v1과 v2 차이, 계층 구조, cpu/memory/io/pids 컨트롤러, systemd 연동 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 3
type: "knowledge"
category: "Linux"
tags: ["linux", "cgroups", "cgroup-v2", "systemd", "container", "resource-limit", "cpu", "memory"]
featured: false
draft: false
---

[지난 글](/posts/linux-zombie-orphan/)에서 zombie와 orphan 프로세스를 정리했습니다. 이번엔 컨테이너, 가상화, 시스템 안정성의 핵심 기술인 **cgroups(Control Groups)** 를 처음부터 끝까지 살펴봅니다. 도커가 컨테이너에 메모리 제한을 거는 것도, systemd가 서비스별로 CPU를 할당하는 것도 모두 cgroups 위에서 동작합니다.

## cgroups란?

**Control Groups**는 리눅스 커널 기능으로, 프로세스 집합(그룹)에 대한 **자원 사용을 제한·우선순위 부여·격리·계량**할 수 있게 합니다. 2008년 커널 2.6.24에 처음 합류했으며, 이후 cgroup v2가 커널 4.5(2016)에 도입되어 현재 주력으로 쓰입니다.

```bash
# cgroup v2 마운트 확인
mount | grep cgroup
# cgroup2 on /sys/fs/cgroup type cgroup2 (rw,nosuid,nodev,noexec,...)

# 현재 시스템이 v2 단독인지 확인
cat /proc/filesystems | grep cgroup
```

## v1 vs v2

| 항목 | cgroup v1 | cgroup v2 |
|------|-----------|-----------|
| 계층 구조 | 컨트롤러별 독립 계층 | 단일 통합 계층 |
| 설정 파일 | 여러 마운트포인트 분산 | `/sys/fs/cgroup/` 하나 |
| 위임(delegation) | 복잡 | 안전하고 단순 |
| 기본값 | 오래된 배포판 | Ubuntu 22.04+, RHEL 9+ |

v2는 `cgroup.controllers`와 `cgroup.subtree_control`로 컨트롤러를 명시적으로 위임합니다.

## 계층 구조

cgroup은 디렉터리 트리로 표현됩니다. 부모 그룹의 제한 안에서 자식 그룹이 추가 제한을 걸 수 있으며, 모든 프로세스는 정확히 하나의 리프 cgroup에 속합니다.

```bash
# 트리 보기
systemd-cgls
# 또는
ls /sys/fs/cgroup/
cat /sys/fs/cgroup/system.slice/nginx.service/memory.current
```

![cgroups 계층 구조와 컨트롤러](/assets/posts/linux-cgroups-overview-hierarchy.svg)

## 주요 컨트롤러

### cpu 컨트롤러

CFS(Completely Fair Scheduler)와 연동해 CPU 시간을 제한합니다.

```bash
# cpu.max: "quota period" 형식
# 500000 1000000 = 100ms마다 50ms = CPU 50%
cat /sys/fs/cgroup/system.slice/nginx.service/cpu.max

# cpu.weight: 상대적 가중치 (기본 100)
echo 200 > /sys/fs/cgroup/myapp/cpu.weight
```

### memory 컨트롤러

```bash
# 하드 한도
echo 536870912 > /sys/fs/cgroup/myapp/memory.max  # 512MB

# 소프트 한도 (메모리 부족 시 먼저 회수)
echo 268435456 > /sys/fs/cgroup/myapp/memory.high  # 256MB

# 현재 사용량
cat /sys/fs/cgroup/myapp/memory.current

# OOM kill 이벤트
cat /sys/fs/cgroup/myapp/memory.events
```

### io 컨트롤러

```bash
# 디바이스 번호 확인 (major:minor)
ls -l /dev/sda  # 8:0

# IOPS 제한
echo "8:0 riops=1000 wiops=500" > /sys/fs/cgroup/myapp/io.max

# 대역폭 제한 (bytes/s)
echo "8:0 rbps=10485760 wbps=5242880" > /sys/fs/cgroup/myapp/io.max
```

### pids 컨트롤러

fork 폭탄을 막는 가장 간단한 방법입니다.

```bash
# 최대 프로세스/스레드 수 제한
echo 100 > /sys/fs/cgroup/myapp/pids.max

# 현재 수
cat /sys/fs/cgroup/myapp/pids.current
```

## systemd로 cgroup 제한

실제 운영에서는 파일을 직접 건드리기보다 systemd를 통해 관리하는 것이 권장됩니다.

![cgroup v2 조작 명령](/assets/posts/linux-cgroups-overview-commands.svg)

```bash
# 서비스 자원 확인
systemctl show nginx.service -p CPUQuota,MemoryMax,TasksMax

# 임시 변경 (재부팅 후 초기화)
systemctl set-property --runtime nginx.service MemoryMax=512M

# 영구 변경 (drop-in 파일 생성)
systemctl set-property nginx.service CPUQuota=50% MemoryMax=512M
```

## 프로세스를 cgroup에 직접 추가

```bash
# 새 cgroup 만들기
mkdir /sys/fs/cgroup/mytest

# 컨트롤러 활성화 (부모에서 먼저 위임 필요)
echo "+cpu +memory +pids" > /sys/fs/cgroup/cgroup.subtree_control
echo "+cpu +memory +pids" > /sys/fs/cgroup/mytest/cgroup.subtree_control

# PID 추가
echo $$ > /sys/fs/cgroup/mytest/cgroup.procs

# 제한 설정
echo 268435456 > /sys/fs/cgroup/mytest/memory.max
```

## cgroup 현황 파악

```bash
# 전체 트리
systemd-cgls

# 특정 서비스 상세
systemd-cgtop

# 프로세스가 속한 cgroup
cat /proc/$$/cgroup
```

## 정리

cgroups는 프로세스 그룹의 자원을 **제한(limit)**, **우선순위(weight)**, **계량(accounting)** 하는 커널 메커니즘입니다. v2는 단일 계층 구조로 v1보다 훨씬 단순하며, systemd가 완전히 통합해 서비스 단위 자원 관리를 쉽게 만들어 줍니다. 컨테이너가 자원을 격리하는 원리의 절반이 cgroups라면, 나머지 절반은 다음 글에서 다룰 **namespaces** 입니다.

---

**지난 글:** [zombie와 orphan 프로세스 완전 정복](/posts/linux-zombie-orphan/)

**다음 글:** [namespaces 완전 개요 — 프로세스 격리의 원리](/posts/linux-namespaces-overview/)

<br>
읽어주셔서 감사합니다. 😊
