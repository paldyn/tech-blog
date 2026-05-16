---
title: "systemd 개요 — 현대 Linux의 init 시스템"
description: "systemd가 SysV init을 대체한 이유, PID 1의 역할, 유닛 유형, 부팅 시퀀스, systemd-analyze로 성능을 분석하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 7
type: "knowledge"
category: "Linux"
tags: ["linux", "systemd", "init", "pid1", "unit", "target", "journald", "boot", "systemd-analyze"]
featured: false
draft: false
---

[지난 글](/posts/linux-pam-basics/)에서 PAM 인증 모듈을 살펴봤습니다. 이번에는 **systemd**를 다룹니다. 2012년 이후 대부분의 주요 Linux 배포판이 SysV init 대신 systemd를 채택했습니다. systemd를 이해하면 서비스 관리, 부팅 문제 해결, 로그 분석이 훨씬 수월해집니다.

## systemd란

systemd는 Linux에서 PID 1로 실행되는 프로그램입니다. 커널이 부팅을 마치면 가장 먼저 실행하는 프로세스가 PID 1이고, 모든 다른 프로세스는 PID 1의 후손입니다.

이름이 'system daemon'의 줄임말이지만, 단순한 init 시스템을 넘어서 로깅(`journald`), 네트워크(`networkd`), DNS(`resolved`), 로그인 세션(`logind`), 타이머(`timer`) 등을 통합 관리합니다.

```bash
# PID 1 확인
ps -p 1 -o comm=
# systemd

# systemd 버전
systemctl --version
```

## SysV init과의 차이

SysV init은 `/etc/init.d/` 스크립트를 **순차적으로** 실행했습니다. 앞 서비스가 완전히 시작돼야 다음 서비스가 시작할 수 있어 부팅이 느렸습니다.

systemd는 서비스 간 의존성을 분석해 **독립된 서비스는 병렬로 시작**합니다. 소켓 활성화(Socket Activation) 덕분에 실제 연결 요청이 있을 때까지 서비스 프로세스 자체는 미루고 소켓만 열어 두어, 빠른 부팅과 낮은 메모리 사용을 동시에 달성합니다.

## 유닛 (Unit)

systemd에서 관리하는 모든 개체는 **유닛**입니다. 유닛은 확장자로 유형을 구분합니다.

![systemd 아키텍처](/assets/posts/linux-systemd-overview-arch.svg)

가장 자주 다루는 유닛:

```bash
# 서비스 유닛 확인
systemctl list-units --type=service

# 활성 타이머 확인
systemctl list-units --type=timer

# 마운트 유닛
systemctl list-units --type=mount
```

유닛 파일은 세 위치에 있습니다.

| 위치 | 용도 |
|------|------|
| `/lib/systemd/system/` | 배포판 기본 (수정 금지) |
| `/etc/systemd/system/` | 관리자 커스텀 (우선순위 높음) |
| `~/.config/systemd/user/` | 사용자 유닛 |

## 부팅 시퀀스

![systemd 부팅 시퀀스](/assets/posts/linux-systemd-overview-boot.svg)

```
커널 → initrd → sysinit.target → basic.target
    → multi-user.target → (graphical.target)
```

타겟(`.target`)은 SysV 런레벨의 현대적 대체입니다. `multi-user.target`은 런레벨 3(텍스트 모드), `graphical.target`은 런레벨 5(GUI)와 대응합니다.

## 부팅 성능 분석

```bash
# 전체 부팅 시간
systemd-analyze

# 서비스별 시작 시간 (오래 걸린 순)
systemd-analyze blame | head -20

# 병목 체인 시각화
systemd-analyze critical-chain

# SVG로 부팅 타임라인 생성
systemd-analyze plot > boot.svg
```

부팅이 느리다면 `systemd-analyze blame`으로 시간이 긴 서비스를 찾고, 필요 없으면 `systemctl disable`로 비활성화합니다. `NetworkManager-wait-online.service`가 자주 범인입니다.

## systemd의 주요 서브시스템

### journald — 구조화 로깅

모든 서비스 로그를 바이너리 형식으로 수집합니다. `journalctl`로 조회합니다.

```bash
journalctl -u nginx        # nginx 로그
journalctl -b              # 이번 부팅 이후
journalctl -f              # 실시간 (tail -f)
journalctl --since "1h ago"
```

### socket activation — 지연 시작

소켓을 systemd가 먼저 열고, 첫 연결이 올 때 서비스를 시작합니다. 서비스가 느리게 시작해도 연결을 잃지 않습니다.

### cgroup 통합

각 서비스는 별도 cgroup에서 실행됩니다. CPU, 메모리, I/O를 유닛 파일에서 직접 제한할 수 있습니다.

```bash
# 서비스의 cgroup 확인
systemctl status nginx
cat /sys/fs/cgroup/system.slice/nginx.service/memory.current
```

## systemd 없이 서비스 상태 보기

```bash
# init 시스템 확인 (systemd가 아닐 수도 있음)
ps -p 1 -o comm=

# SysV init 남은 서비스 상태
service --status-all    # Debian/Ubuntu
chkconfig --list        # RHEL/CentOS (레거시)
```

WSL 1이나 일부 컨테이너 환경에서는 systemd가 PID 1이 아닐 수 있습니다. 이 경우 `systemctl`이 작동하지 않습니다.

---

**지난 글:** [PAM 기초 — 플러그인 가능한 인증 모듈](/posts/linux-pam-basics/)

**다음 글:** [systemctl 기본 — 서비스 관리의 핵심](/posts/linux-systemctl-basics/)

<br>
읽어주셔서 감사합니다. 😊
