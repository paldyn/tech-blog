---
title: "nice와 renice — 프로세스 CPU 우선순위 조정"
description: "nice 값(-20~+19)의 의미와 CPU 스케줄링 영향, nice로 시작 시 우선순위 지정, renice로 실행 중 변경, ionice로 I/O 우선순위 제어하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["linux", "nice", "renice", "ionice", "priority", "scheduling", "cpu", "performance"]
featured: false
draft: false
---

[지난 글](/posts/linux-kill-signals/)에서 시그널로 프로세스를 제어하는 방법을 배웠습니다. 이번엔 CPU 스케줄러에게 "이 프로세스를 얼마나 배려해 줄지" 힌트를 주는 **nice** 값을 다룹니다.

## Nice 값이란

리눅스 CFS(Completely Fair Scheduler)는 각 프로세스에 공정하게 CPU 시간을 배분하는데, 이때 **nice 값**이 가중치 역할을 합니다. nice 값은 `-20`(가장 높은 우선순위)부터 `+19`(가장 낮은 우선순위)까지이며, 기본값은 `0`입니다.

```
nice -20                0              +19
  ↑                     ↑               ↑
높은 우선순위          기본값         낮은 우선순위
CPU 더 많이           일반 프로세스    CPU 더 적게
(root 전용)                          (일반 사용자 가능)
```

중요한 점: nice 값을 낮출수록(음수 방향) 우선순위가 **올라갑니다**. "내가 더 nice하게 물러서겠다"는 개념에서 양수 값이 겸손함을 의미합니다.

일반 사용자는 현재 nice 값보다 **높은(더 겸손한) 값으로만** 변경할 수 있습니다. 음수 nice 값은 `root`만 설정 가능합니다.

## nice로 시작 시 우선순위 설정

```bash
# nice 값 10으로 프로세스 시작
nice -n 10 ./heavy_compile.sh

# 가장 낮은 우선순위(+19)로 백그라운드 작업
nice -n 19 tar -czf backup.tar.gz /data &

# 빌드 작업 CPU를 적게 사용하도록
nice -n 15 make -j$(nproc)

# root: 음수 nice (-5)로 높은 우선순위
sudo nice -n -5 ./latency_critical
```

`nice` 없이 그냥 실행하면 부모 프로세스의 nice 값을 상속합니다. 셸에서 실행한 프로그램은 대개 nice 0입니다.

## renice로 실행 중 변경

실행 이후에도 nice 값을 바꿀 수 있습니다.

```bash
# PID로 변경
renice -n 15 -p 1234

# 특정 사용자의 모든 프로세스 변경
sudo renice -n 10 -u www-data

# 프로세스 그룹(PGID) 단위로 변경
renice -n 5 -g 1234

# 현재 nice 값 확인
ps -o pid,ni,comm -p 1234
```

`renice`로 nice 값을 **낮추는(우선순위 올리는)** 작업은 root만 할 수 있습니다. 일반 사용자는 현재 값보다 높은 nice 값으로만 변경 가능합니다.

## Nice 값과 실제 우선순위의 관계

![Nice 값 스케일과 사용 사례](/assets/posts/linux-nice-renice-scale.svg)

`ps`와 `top`에서는 `NI`(nice)와 `PR`(priority) 두 컬럼이 나옵니다.

```bash
# NI와 PR 모두 표시
ps -eo pid,ni,pri,comm | head -10
```

| NI 값 | PR 값 | 설명 |
|-------|-------|------|
| -20 | 0 | 최고 우선순위 |
| 0 | 20 | 기본값 |
| +19 | 39 | 최저 우선순위 |

`PR = 20 + NI`가 일반적인 관계입니다. `PR < 0`이면 실시간 스케줄링 클래스(RT)입니다.

## systemd 서비스에서 Nice 설정

```ini
# /etc/systemd/system/myapp.service
[Service]
Nice=-5
IOSchedulingClass=2
IOSchedulingPriority=3
ExecStart=/usr/bin/myapp
```

```bash
# 현재 서비스의 Nice 값 확인
systemctl show myapp.service -p Nice
```

## ionice — I/O 우선순위 조정

CPU nice와 별개로, 디스크 I/O에도 우선순위를 줄 수 있습니다. 리눅스 CFQ/BFQ I/O 스케줄러가 지원합니다.

![nice / renice / ionice 사용법](/assets/posts/linux-nice-renice-code.svg)

```bash
# 백업을 idle 클래스로 실행 (다른 I/O 없을 때만)
ionice -c3 rsync -av /src/ /dst/

# 실행 중인 rsync 프로세스를 idle로 변경
ionice -c3 -p $(pgrep rsync)

# best-effort 클래스 레벨 6 (기본 4보다 낮음)
ionice -c2 -n6 ./heavy_read.sh
```

| 클래스 | 이름 | 설명 |
|--------|------|------|
| 1 | RT | 실시간 — 다른 모든 I/O보다 먼저. root 전용 |
| 2 | BE | Best-Effort — 기본. 레벨 0(높음)~7(낮음) |
| 3 | Idle | 다른 I/O가 전혀 없을 때만 실행 |

백업, rsync, 로그 처리처럼 응답성보다 처리량이 중요한 작업에 `nice -n 19 ionice -c3`를 조합하면 시스템 체감 성능에 거의 영향 없이 백그라운드 작업을 돌릴 수 있습니다.

```bash
# 야간 백업 스크립트 — CPU와 I/O 모두 최저 우선순위
nice -n 19 ionice -c3 tar -czf /backup/$(date +%F).tar.gz /data
```

---

**지난 글:** [kill과 시그널 — 프로세스에 명령을 보내는 방법](/posts/linux-kill-signals/)

**다음 글:** [fg, bg, jobs — 포그라운드·백그라운드 작업 관리](/posts/linux-fg-bg-jobs/)

<br>
읽어주셔서 감사합니다. 😊
