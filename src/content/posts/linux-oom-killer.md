---
title: "OOM Killer — 메모리 부족 시 리눅스가 프로세스를 선택하는 방법"
description: "Linux OOM Killer의 동작 원리, oom_score·oom_score_adj 계산, dmesg 로그 분석, 중요 서비스 보호 방법, overcommit 설정, earlyoom 활용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 7
type: "knowledge"
category: "Linux"
tags: ["linux", "oom", "memory", "oom-killer", "oom_score", "cgroup", "overcommit", "kernel"]
featured: false
draft: false
---

[지난 글](/posts/linux-page-cache/)에서 페이지 캐시가 메모리를 관리하는 방식을 살펴봤습니다. 이번에는 메모리가 완전히 바닥날 때 리눅스가 취하는 극단적인 조치인 **OOM Killer(Out-Of-Memory Killer)**를 알아봅니다.

## OOM이란

리눅스는 기본적으로 **메모리 오버커밋**을 허용합니다. `malloc()`으로 4GB를 할당해도 실제 접근 전까지는 물리 메모리를 사용하지 않습니다. 하지만 여러 프로세스가 실제로 대규모 메모리를 사용하기 시작하면 물리 RAM과 스왑이 모두 소진됩니다.

이 상황에서 커널은 **새 메모리 할당 요청을 거부하거나** 일부 프로세스를 강제 종료하는 선택을 해야 합니다. 후자를 담당하는 것이 OOM Killer입니다.

![OOM Killer 동작 원리](/assets/posts/linux-oom-killer-concept.svg)

## oom_score — 희생 대상 결정

OOM Killer는 각 프로세스에 `oom_score` (0~1000)를 부여합니다. 점수가 높을수록 먼저 종료됩니다.

```bash
# 특정 프로세스의 oom_score 확인
cat /proc/1234/oom_score

# 전체 프로세스 oom_score 순위
for p in /proc/[0-9]*/oom_score; do
  awk -v f="$p" '{print $1, f}' "$p"
done | sort -rn | head -10
```

점수 계산 요소:
- 메모리 사용량이 많을수록 높은 점수
- 자식 프로세스 메모리도 포함
- root 프로세스는 약간 낮은 점수
- 오래 실행된 프로세스는 약간 낮은 점수

## oom_score_adj — 수동 조정

`/proc/PID/oom_score_adj`에 -1000~1000 범위의 값을 쓰면 점수를 조정할 수 있습니다.

```bash
# 중요 서비스 보호 (낮은 점수)
echo -900 | sudo tee /proc/$(pgrep nginx)/oom_score_adj

# 절대 종료하지 않음 (-1000)
echo -1000 | sudo tee /proc/1/oom_score_adj

# 테스트/덜 중요한 프로세스 (높은 점수)
echo 500 | sudo tee /proc/$TEST_PID/oom_score_adj
```

systemd 서비스에서 영구 설정:

```ini
# /etc/systemd/system/myservice.service
[Service]
OOMScoreAdjust=-900
```

![OOM Killer 제어](/assets/posts/linux-oom-killer-control.svg)

## OOM 발생 감지

```bash
# 커널 로그에서 OOM 확인
sudo dmesg -T | grep -i 'oom\|killed' | tail -20

# systemd 저널 (더 보기 좋음)
sudo journalctl -k | grep -i 'out of memory\|killed process'

# 실시간 모니터링
sudo dmesg --follow | grep -i oom
```

OOM 로그 예시:
```
[Thu May 26 10:12:34 2026] Out of memory: Kill process 12345 (java) score 450 or sacrifice child
[Thu May 26 10:12:34 2026] Killed process 12345 (java) total-vm:2048000kB, anon-rss:1024000kB, file-rss:0kB
```

`total-vm`은 가상 메모리 크기, `anon-rss`는 실제 점유한 익명 페이지입니다.

## 메모리 오버커밋 설정

```bash
# 현재 오버커밋 모드 확인
cat /proc/sys/vm/overcommit_memory

# 0 (기본): 경험적 오버커밋 허용 (대부분의 malloc 허용)
# 1: 무조건 허용 (malloc이 절대 실패 안 함)
# 2: 제한 모드 (물리 RAM + swap의 N%만 허용)

# 오버커밋 비율 설정 (모드 2에서)
cat /proc/sys/vm/overcommit_ratio  # 기본 50 (50%)
```

Redis는 `vm.overcommit_memory=1`을 권장합니다. 백그라운드 저장(RDB)이 `fork()` 시 CoW로 메모리를 많이 쓰기 때문입니다.

```bash
# Redis 권장 설정
sudo sysctl vm.overcommit_memory=1
```

## cgroup으로 메모리 한도

OOM Killer보다 예방적인 방법입니다. cgroup v2로 프로세스 그룹의 메모리를 제한합니다.

```bash
# systemd 서비스에서 메모리 한도
# /etc/systemd/system/myapp.service
# [Service]
# MemoryMax=512M
# MemoryHigh=400M  # 소프트 한도 (회수 촉진)

# 컨테이너 (Docker)
docker run --memory=512m --memory-swap=512m myapp

# cgroup v2 직접 설정
echo 536870912 > /sys/fs/cgroup/myapp/memory.max
```

한도 초과 시 해당 cgroup 내에서만 OOM Killer가 작동하여 다른 서비스에 영향을 주지 않습니다.

## earlyoom — 더 스마트한 종료

커널 OOM Killer는 시스템이 이미 메모리 스래싱 상태에 빠진 후에야 발동합니다. **earlyoom**은 메모리 사용률이 임계값에 도달하면 미리 프로세스를 종료합니다.

```bash
# 설치
sudo apt install earlyoom

# 설정: 메모리 5% 이하, 스왑 5% 이하일 때 작동
# /etc/default/earlyoom
# EARLYOOM_ARGS="-m 5 -s 5 --avoid '(^|/) (init|sshd|systemd)'

sudo systemctl enable --now earlyoom
```

earlyoom은 `SIGTERM`을 먼저 보내 정상 종료할 기회를 주고, 응답 없으면 `SIGKILL`을 보냅니다. 커널 OOM Killer는 바로 `SIGKILL`을 씁니다.

## 트러블슈팅 시나리오

서버에서 프로세스가 갑자기 죽었을 때:

```bash
# 1. OOM 여부 확인
sudo dmesg -T | grep -E 'oom|killed' | tail -20

# 2. 어떤 프로세스가 많은 메모리를 쓰는지
ps aux --sort=-%mem | head -15

# 3. 현재 메모리 상태
free -h && cat /proc/meminfo | grep -E 'Cached|Dirty|Writeback|MemAvailable'

# 4. oom_score 높은 프로세스 목록
for p in /proc/[0-9]*/oom_score; do
  awk -v f="$p" '{if ($1 > 100) print $1, f}' "$p" 2>/dev/null
done | sort -rn | head -10
```

---

**지난 글:** [Page Cache — 리눅스 메모리 캐시의 핵심 구조](/posts/linux-page-cache/)

**다음 글:** [Container Namespaces 상세 — 컨테이너 격리의 실제 구현](/posts/linux-container-namespaces-detail/)

<br>
읽어주셔서 감사합니다. 😊
