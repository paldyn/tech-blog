---
title: "auditd — 리눅스 감사 시스템 완전 정리"
description: "auditd 아키텍처, auditctl 규칙 작성(-w/-a/-S/-k), ausearch·aureport 조회, 주요 보안 이벤트 감사 예제, PCI DSS·CIS 연동 전략을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 3
type: "knowledge"
category: "Linux"
tags: ["linux", "security", "auditd", "auditctl", "ausearch", "aureport", "compliance", "logging"]
featured: false
draft: false
---

[지난 글](/posts/linux-rootkit-detection/)에서 루트킷을 탐지하는 도구를 살펴봤습니다. 이번에는 **auditd** — 리눅스 커널에 내장된 감사(Audit) 프레임워크를 다룹니다. auditd는 "무엇이 언제 어디서 누구에 의해 바뀌었는지"를 커널 레벨에서 기록하므로, 사후 추적과 컴플라이언스(PCI DSS, CIS) 요건을 충족하는 데 필수적입니다.

## auditd 아키텍처

![auditd 이벤트 흐름 아키텍처](/assets/posts/linux-auditd-architecture.svg)

auditd는 두 영역으로 나뉩니다.

- **커널 Audit 서브시스템** — syscall 호출 시 이벤트를 생성하고 Netlink 소켓으로 전달
- **auditd 데몬** — 이벤트를 수신해 `/var/log/audit/audit.log`에 기록

`auditctl`로 커널에 규칙을 로드하고, `ausearch`/`aureport`로 로그를 조회합니다.

## 설치 및 시작

```bash
# Debian/Ubuntu
sudo apt install auditd audispd-plugins

# RHEL/CentOS
sudo dnf install audit

# 서비스 시작
sudo systemctl enable --now auditd

# 현재 상태 확인
sudo auditctl -s
sudo auditctl -l    # 로드된 규칙 목록
```

## 규칙 작성

### 파일 감시 규칙 (-w)

```bash
# /etc/passwd 쓰기·속성변경 감사
sudo auditctl -w /etc/passwd -p wa -k passwd_changes

# 디렉터리 전체 감시
sudo auditctl -w /etc/ssh -p rwxa -k ssh_config
```

- `-w` 감시할 파일/디렉터리
- `-p rwxa` 퍼미션: r읽기 w쓰기 x실행 a속성변경
- `-k` 검색용 키워드(태그)

### syscall 감사 규칙 (-a)

```bash
# root가 실행한 모든 명령 감사
sudo auditctl -a always,exit -F arch=b64 -S execve -F euid=0 -k root_cmd

# 권한 상승 관련 syscall
sudo auditctl -a always,exit -F arch=b64 -S setuid -S setgid -k priv_esc
```

- `-a action,list` — `always,exit`가 가장 일반적
- `-F arch=b64` — 64비트 syscall 필터 (32비트는 b32)
- `-S` 감사할 syscall 이름

### 영구 규칙 파일

```bash
sudo nano /etc/audit/rules.d/custom.rules
```

![auditd 규칙 파일과 ausearch/aureport 명령](/assets/posts/linux-auditd-rules.svg)

```ini
# /etc/audit/rules.d/custom.rules
-w /etc/passwd -p wa -k passwd_changes
-w /etc/shadow -p wa -k shadow_changes
-w /etc/sudoers -p wa -k sudoers_changes
-a always,exit -F arch=b64 -S execve -F euid=0 -k root_cmd
-a always,exit -F arch=b64 -S connect -k network_conn
# 감사 고정 — 재부팅 전까지 규칙 변경 불가
-e 2
```

```bash
# 규칙 파일 적용
sudo augenrules --load
sudo auditctl -l    # 확인
```

## 로그 조회

### ausearch

```bash
# 키워드로 검색
sudo ausearch -k passwd_changes

# 사용자 UID로 검색
sudo ausearch -ua 1000

# 오늘 발생한 이벤트
sudo ausearch -ts today

# 해석 가능한 출력 (-i: UID를 이름으로 변환)
sudo ausearch -i -k root_cmd | head -40

# 특정 시간 범위
sudo ausearch -ts "2026-05-24 00:00:00" -te "2026-05-24 12:00:00"
```

### aureport

```bash
# 전체 요약
sudo aureport --summary

# 로그인 이벤트
sudo aureport --login

# 실패한 이벤트만
sudo aureport --failed

# 파일 접근 보고서
sudo aureport --file
```

## audit.log 형식 이해

```
type=SYSCALL msg=audit(1716534000.123:456): arch=c000003e syscall=59
success=yes exit=0 a0=55a1b... a1=7ffe... ppid=1234 pid=5678
auid=1000 uid=0 gid=0 euid=0 comm="passwd" exe="/usr/bin/passwd"
key="passwd_changes"
```

주요 필드:

| 필드 | 의미 |
|---|---|
| `type` | 이벤트 유형 (SYSCALL, PATH, USER_CMD 등) |
| `auid` | 실제 로그인한 사용자 UID (sudo 해도 원래 UID 기록) |
| `uid/euid` | 실행 시점 UID/유효 UID |
| `comm/exe` | 명령명/실행 파일 경로 |
| `key` | auditctl 규칙의 `-k` 키워드 |

## 주요 보안 감사 예제

### 1. 로그인 실패 추적

```bash
sudo ausearch -m USER_LOGIN -sv no
```

### 2. sudo 사용 추적

```bash
sudo ausearch -m USER_CMD | grep sudo
```

### 3. SUID 실행 파일 변경 감시

```bash
sudo auditctl -a always,exit -F arch=b64 -S chmod -S fchmod \
    -F perm=u+s -k suid_change
```

### 4. 특정 디렉터리 변경 추적

```bash
sudo auditctl -w /bin -p wa -k bin_modify
sudo auditctl -w /usr/bin -p wa -k usr_bin_modify
```

## auditd와 컴플라이언스

CIS Benchmark와 PCI DSS는 auditd 규칙 세트를 요구합니다. 이를 위해 사전 정의된 규칙 파일을 사용합니다.

```bash
# audit-rules 패키지에 포함된 CIS 규칙 세트 (Ubuntu)
ls /usr/share/doc/auditd/examples/
# 또는 GitHub: linux-audit/audit-userspace 의 rules 디렉터리
```

auditd 로그를 SIEM(Splunk, ELK)으로 전송하려면 `audisp-remote` 플러그인을 사용합니다.

```bash
sudo apt install audispd-plugins
# /etc/audisp/plugins.d/au-remote.conf 설정
```

## 성능 고려사항

광범위한 syscall 감사는 I/O와 CPU에 영향을 줍니다.

- `-S execve` 전체 캡처는 부하가 큼 — `euid=0`으로 root만 제한
- 바쁜 디렉터리(`/tmp`, `/var/log`)에 `-w`를 걸면 로그가 폭증
- `backlog_limit` 조정: `sudo auditctl -b 8192`

---

**지난 글:** [루트킷 탐지 — 숨은 침입자 찾기](/posts/linux-rootkit-detection/)

**다음 글:** [Secure Boot — 부팅 체인 검증](/posts/linux-secure-boot/)

<br>
읽어주셔서 감사합니다. 😊
