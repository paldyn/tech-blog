---
title: "cgroups v1 vs v2 — 리소스 제한의 두 세대 비교"
description: "cgroups v1의 다중 계층 구조 한계, v2의 단일 통합 계층과 개선사항, 실전 CPU/메모리/I/O 제한 설정, PSI(Pressure Stall Information), systemd 서비스 연동, 컨테이너 환경 마이그레이션을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["linux", "cgroups", "cgroup-v2", "container", "resource-limit", "systemd", "PSI", "kubernetes"]
featured: false
draft: false
---

[지난 글](/posts/linux-container-namespaces-detail/)에서 Linux Namespace가 프로세스를 격리하는 방법을 배웠습니다. 이번에는 컨테이너의 두 번째 핵심 기술인 **cgroups(Control Groups)**를 살펴봅니다. Namespace가 "무엇이 보이는가"를 제한한다면, cgroups는 "얼마나 쓸 수 있는가"를 제한합니다.

## cgroups란

cgroups는 프로세스 그룹의 CPU·메모리·I/O·네트워크 대역폭 등 리소스 사용량을 **제한·집계·격리**하는 커널 기능입니다. Docker의 `--memory=512m`, Kubernetes의 `resources.limits`가 모두 cgroups 위에서 동작합니다.

## cgroups v1의 한계

2007년 Linux 2.6.24에 도입된 v1은 **서브시스템별로 독립된 계층 구조**를 가집니다.

```
/sys/fs/cgroup/
  memory/
    myapp/
  cpu/
    myapp/
  blkio/
    myapp/
```

한 프로세스가 여러 계층에 분산될 수 있어 관리가 복잡합니다.

![cgroups v1 vs v2 구조](/assets/posts/linux-cgroups-v1-vs-v2-compare.svg)

주요 문제:
- 같은 프로세스의 memory 계층과 cpu 계층이 다른 경로에 있어 일관성이 깨지기 쉬움
- "nogroup" 프로세스가 어느 계층에도 속하지 않는 문제
- rootless 컨테이너 지원 어려움 (권한 위임 모델 부재)

## cgroups v2 — 단일 통합 계층

2016년 Linux 4.5에 도입된 v2는 **단일 계층**에 모든 서브시스템을 통합합니다.

```
/sys/fs/cgroup/
  myapp/
    cgroup.procs     (프로세스 목록)
    memory.max       (메모리 하드 한도)
    memory.high      (소프트 한도)
    cpu.weight       (상대적 CPU 가중치)
    cpu.max          (CPU 절대 한도)
    io.max           (I/O 한도)
```

v2 사용 여부 확인:

```bash
stat -fc %T /sys/fs/cgroup/
# cgroup2fs: v2 사용 중
# tmpfs: v1 사용 중
```

## v2 기본 사용법

```bash
# cgroup 생성 (디렉터리만 만들면 됨)
sudo mkdir /sys/fs/cgroup/myapp

# 사용할 서브시스템 활성화 (부모 계층에서 위임)
echo "+cpu +memory +io" | sudo tee \
  /sys/fs/cgroup/cgroup.subtree_control

# 현재 프로세스를 myapp cgroup에 추가
echo $$ | sudo tee /sys/fs/cgroup/myapp/cgroup.procs

# 포함된 프로세스 확인
cat /sys/fs/cgroup/myapp/cgroup.procs
```

![cgroups v2 실전 사용법](/assets/posts/linux-cgroups-v1-vs-v2-usage.svg)

## 리소스 제한 설정

### 메모리 제한

```bash
# 하드 한도: 512MB 초과 시 OOM
echo 536870912 | sudo tee /sys/fs/cgroup/myapp/memory.max

# 소프트 한도: 400MB 초과 시 적극적 회수
echo 419430400 | sudo tee /sys/fs/cgroup/myapp/memory.high

# 스왑 포함 한도
echo 1073741824 | sudo tee /sys/fs/cgroup/myapp/memory.swap.max

# 현재 사용량 확인
cat /sys/fs/cgroup/myapp/memory.current
```

### CPU 제한

```bash
# 상대적 가중치 (기본 100, 높을수록 더 많은 CPU)
echo 200 | sudo tee /sys/fs/cgroup/myapp/cpu.weight

# 절대적 한도: 50ms/100ms = CPU의 50%
# "quota period" 형식
echo "50000 100000" | sudo tee /sys/fs/cgroup/myapp/cpu.max

# 현재 사용량
cat /sys/fs/cgroup/myapp/cpu.stat
```

### I/O 제한

```bash
# 디바이스 번호 확인
ls -la /dev/sda  # 8:0

# 읽기/쓰기 각각 10MB/s 제한
echo "8:0 rbps=10485760 wbps=10485760" | sudo tee \
  /sys/fs/cgroup/myapp/io.max
```

## PSI — 압박 지표 (v2 전용)

**PSI(Pressure Stall Information)**는 CPU·메모리·I/O 부족으로 프로세스가 실제 정체된 시간을 측정합니다.

```bash
# 시스템 전체 메모리 압박
cat /proc/pressure/memory
# some avg10=1.23 avg60=0.45 avg300=0.12 total=12345678
# full avg10=0.00 ...

# some: 일부 프로세스가 기다리는 시간 비율
# full: 모든 프로세스가 기다리는 시간 비율

# CPU 압박
cat /proc/pressure/cpu

# 특정 cgroup의 압박
cat /sys/fs/cgroup/myapp/memory.pressure
```

PSI `avg10`이 지속적으로 높으면 리소스가 부족한 것입니다.

## systemd 서비스 연동

v2 시스템에서 systemd는 자동으로 cgroup v2를 사용합니다.

```ini
# /etc/systemd/system/myapp.service
[Service]
ExecStart=/usr/bin/myapp
MemoryMax=512M
MemoryHigh=400M
CPUQuota=50%
IOWeight=100
TasksMax=1000
```

```bash
# 적용
sudo systemctl daemon-reload
sudo systemctl restart myapp

# 현재 리소스 사용 확인
systemctl status myapp
# CGroup: /system.slice/myapp.service
#          ├─ 1234 /usr/bin/myapp

# 상세 통계
systemd-cgtop /system.slice/myapp.service
```

## 컨테이너 환경

Docker Compose v2 cgroup 설정:

```yaml
services:
  web:
    image: nginx
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
```

Kubernetes Pod 리소스 설정:

```yaml
resources:
  limits:
    memory: "512Mi"
    cpu: "500m"
  requests:
    memory: "256Mi"
    cpu: "250m"
```

k8s 1.25부터 cgroup v2(cgroupsV2)가 GA 상태입니다. 이를 통해 메모리 QoS, PSI 기반 eviction이 가능해졌습니다.

---

**지난 글:** [Container Namespaces 상세 — 컨테이너 격리의 실제 구현](/posts/linux-container-namespaces-detail/)

**다음 글:** [OverlayFS 상세 — 컨테이너 이미지 레이어 스토리지의 원리](/posts/linux-overlayfs-detail/)

<br>
읽어주셔서 감사합니다. 😊
