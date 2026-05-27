---
title: "sysctl — 커널 파라미터를 런타임에 조정하기"
description: "sysctl 명령으로 네트워크 스택, 가상 메모리, 파일시스템 한도 등 커널 파라미터를 조회하고 수정하는 방법, 그리고 재부팅 후에도 유지되는 영구 설정 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 3
type: "knowledge"
category: "Linux"
tags: ["Linux", "sysctl", "커널파라미터", "성능튜닝", "vm.swappiness", "ip_forward"]
featured: false
draft: false
---

[지난 글](/posts/linux-modprobe-modinfo/)에서 모듈 파라미터를 `modprobe`로 전달하는 법을 봤습니다. 커널 자체의 동작 방식도 런타임에 조정할 수 있는데, 그 창구가 `sysctl`입니다.

![sysctl 파라미터 계층 구조](/assets/posts/linux-sysctl-tree.svg)

## sysctl이란

`sysctl`은 커널 파라미터를 읽고 쓰는 인터페이스입니다. 내부적으로는 `/proc/sys/` 가상 파일시스템에 매핑됩니다. `vm.swappiness`는 실제로 `/proc/sys/vm/swappiness` 파일입니다. 점(`.`)이 경로 구분자(`/`)를 대체한 표기입니다.

```bash
# 두 표기는 같은 파일
cat /proc/sys/vm/swappiness
sysctl vm.swappiness
# vm.swappiness = 60
```

## 파라미터 조회

![sysctl 명령 패턴](/assets/posts/linux-sysctl-commands.svg)

```bash
# 단일 파라미터 조회
sysctl vm.swappiness
# vm.swappiness = 60

# 전체 조회 (수백 개)
sysctl -a | wc -l

# 특정 네임스페이스만
sysctl -a | grep '^net.ipv4.tcp'
```

## 런타임 수정

```bash
# -w 플래그로 즉시 수정 (재부팅 시 초기화)
sudo sysctl -w vm.swappiness=10
# vm.swappiness = 10

# /proc/sys 직접 쓰기 (동일 효과)
echo 10 | sudo tee /proc/sys/vm/swappiness

# 확인
sysctl vm.swappiness
# vm.swappiness = 10
```

`-w`로 적용한 변경은 현재 부팅 세션에서만 유효합니다. 재부팅하면 기본값으로 돌아갑니다.

## 영구 설정

영구 적용은 `/etc/sysctl.conf` 또는 `/etc/sysctl.d/*.conf` 파일에 작성합니다.

```bash
# /etc/sysctl.d/99-custom.conf 작성
cat << 'EOF' | sudo tee /etc/sysctl.d/99-custom.conf
# 스왑 최소화 (SSD 서버)
vm.swappiness = 10

# IPv4 포워딩 (라우터/컨테이너 호스트)
net.ipv4.ip_forward = 1

# 대량 연결 처리
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535

# 파일 디스크립터 한도
fs.file-max = 2097152
EOF

# 적용 (재부팅 없이)
sudo sysctl --system
```

`/etc/sysctl.d/` 디렉터리의 파일은 파일명 순으로 로드됩니다. `99-custom.conf`처럼 높은 숫자를 붙이면 패키지가 만든 설정을 오버라이드할 수 있습니다.

## 자주 쓰는 파라미터

### vm 네임스페이스 — 메모리 관리

```bash
# 스왑 사용 적극성 (0~100, 낮을수록 RAM 우선)
vm.swappiness = 10

# 더티 페이지 비율 (RAM의 20%까지만 더티 허용)
vm.dirty_ratio = 20
vm.dirty_background_ratio = 5

# 메모리 오버커밋 허용 (컨테이너 환경)
vm.overcommit_memory = 1
```

### net 네임스페이스 — 네트워크 스택

```bash
# TCP 연결 큐 크기
net.core.somaxconn = 65535

# SYN 공격 방어
net.ipv4.tcp_syncookies = 1

# TIME_WAIT 소켓 재사용
net.ipv4.tcp_tw_reuse = 1

# 로컬 포트 범위 확장
net.ipv4.ip_local_port_range = 1024 65535
```

### kernel 네임스페이스 — 커널 동작

```bash
# panic 시 자동 재부팅 (초)
kernel.panic = 10

# 코어 덤프 파일명 패턴
kernel.core_pattern = /tmp/core.%e.%p.%t

# 최대 PID 값 (기본 32768)
kernel.pid_max = 4194304
```

### fs 네임스페이스 — 파일시스템

```bash
# 시스템 전체 파일 디스크립터 한도
fs.file-max = 2097152

# inotify 감시 한도 (VS Code, docker 등이 소모)
fs.inotify.max_user_watches = 524288
```

## 현재 설정 출처 파악

```bash
# 어느 파일이 파라미터를 설정했는지 확인
sudo sysctl --system --dry-run 2>&1 | grep swappiness
```

## 설정 파일 우선순위

| 경로 | 우선순위 |
|------|---------|
| `/etc/sysctl.d/*.conf` | 숫자 순 (99 > 10) |
| `/etc/sysctl.conf` | 구버전 호환 |
| `/run/sysctl.d/*.conf` | 런타임 (재부팅 시 초기화) |
| `/usr/lib/sysctl.d/*.conf` | 패키지 기본값 |

높은 숫자의 파일이 낮은 숫자를 오버라이드합니다.

## 요약

| 작업 | 명령 |
|------|------|
| 값 조회 | `sysctl key` |
| 런타임 수정 | `sudo sysctl -w key=value` |
| 영구 적용 | `/etc/sysctl.d/99-*.conf` + `sudo sysctl --system` |
| 전체 조회 | `sysctl -a` |

`sysctl`은 커널 재컴파일 없이 시스템 동작을 미세 조정하는 가장 강력한 도구입니다. 특히 고부하 웹 서버나 컨테이너 호스트에서 네트워크 스택과 파일 디스크립터 한도 조정은 필수 튜닝 항목입니다.

---

**지난 글:** [modprobe와 modinfo — 의존성을 고려한 모듈 관리](/posts/linux-modprobe-modinfo/)

**다음 글:** [/proc/sys 완전 탐방 — 커널이 열어놓은 가상 파일시스템](/posts/linux-proc-sys-tour/)

<br>
읽어주셔서 감사합니다. 😊
