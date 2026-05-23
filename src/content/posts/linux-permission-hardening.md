---
title: "권한 강화 — 최소 권한 원칙으로 공격 표면 줄이기"
description: "SUID/world-writable 제거, umask 설정, 계정 잠금, systemd 서비스 샌드박싱(NoNewPrivileges·ProtectSystem·CapabilityBoundingSet), Linux capabilities 제한을 실전 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["linux", "security", "hardening", "permissions", "capabilities", "systemd", "least-privilege", "suid"]
featured: false
draft: false
---

[지난 글](/posts/linux-disk-encryption-luks/)에서 LUKS로 디스크를 암호화하는 방법을 살펴봤습니다. 이번에는 **권한 강화** — 최소 권한 원칙(Principle of Least Privilege)을 시스템에 적용하는 실전 방법을 다룹니다. 공격자가 취약점을 통해 진입하더라도 이동 범위를 제한합니다.

## 최소 권한 원칙

![권한 강화 핵심 영역](/assets/posts/linux-permission-hardening-concepts.svg)

최소 권한 원칙은 세 영역에 적용됩니다.

1. **파일 권한** — 불필요한 SUID, world-writable 비트 제거
2. **사용자·그룹** — 불필요 계정 잠금, root 로그인 제한
3. **서비스 격리** — systemd 샌드박싱, capabilities 최소화

## 파일 권한 점검

### SUID/SGID 파일 점검

SUID 파일은 실행 시 파일 소유자의 권한으로 동작합니다. root 소유 SUID는 권한 상승 벡터가 될 수 있습니다.

```bash
# root 소유 SUID 파일 목록
find / -perm -4000 -user root -type f 2>/dev/null

# SGID 파일 목록
find / -perm -2000 -type f 2>/dev/null

# 불필요한 SUID 제거
sudo chmod u-s /usr/bin/unnecessary_suid
```

표준 배포판에서 기본 제공하는 SUID 파일 목록(예: `/usr/bin/passwd`, `/usr/bin/sudo`)과 비교해 불필요한 것을 제거합니다.

### world-writable 파일/디렉터리

```bash
# world-writable 파일 (o+w)
find / -perm -002 -type f -not -path "/proc/*" 2>/dev/null

# world-writable 디렉터리 (sticky bit 없는 것)
find / -perm -002 -type d -not -path "/proc/*" 2>/dev/null | \
    grep -v "^/tmp$\|^/var/tmp$"

# world-writable 파일 수정
chmod o-w /path/to/file
```

### umask 강화

```bash
# 현재 umask 확인
umask

# /etc/profile 또는 /etc/bash.bashrc 에 추가
echo "umask 027" | sudo tee -a /etc/profile.d/umask.sh

# 027 = 파일 640 (rw-r-----), 디렉터리 750 (rwxr-x---)
```

### 소유자 없는 파일

```bash
find / -nouser -o -nogroup 2>/dev/null | grep -v "/proc"
# 소유자 없는 파일은 패키지 제거 후 남은 잔재이거나 해킹 흔적일 수 있음
```

## 사용자·계정 강화

### 불필요 계정 잠금

```bash
# 시스템 계정에 잠금 및 쉘 비활성화
sudo passwd -l daemon
sudo usermod -s /usr/sbin/nologin daemon

# 사용하지 않는 계정 목록
awk -F: '$7 ~ /bash|sh$/{print $1}' /etc/passwd

# 로그인 가능한 계정 중 마지막 로그인 날짜 확인
lastlog | grep -v "Never"
```

### root SSH 로그인 금지

```bash
# /etc/ssh/sshd_config
PermitRootLogin no
PasswordAuthentication no    # 키 인증만 허용
AllowUsers alice bob         # 명시적 허용 목록

sudo systemctl restart sshd
```

### sudo 권한 최소화

```bash
# visudo 편집
sudo visudo

# 특정 명령만 허용
alice ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart nginx
bob   ALL=(ALL) /usr/bin/apt-get update, /usr/bin/apt-get upgrade

# NOPASSWD 남용 금지 — 꼭 필요한 명령만
```

## 서비스별 전용 계정

서비스를 root로 실행하는 대신 최소 권한의 전용 계정을 만듭니다.

```bash
# 로그인 불가 시스템 계정 생성
sudo useradd -r -s /usr/sbin/nologin -d /var/lib/myservice myservice

# 서비스 디렉터리 소유권
sudo chown -R myservice:myservice /var/lib/myservice
sudo chmod 750 /var/lib/myservice
```

## systemd 서비스 권한 강화

![systemd 서비스 샌드박싱 옵션](/assets/posts/linux-permission-hardening-systemd.svg)

```bash
# 현재 서비스 보안 점수 확인
systemd-analyze security nginx
# UNSAFE / OK / SAFE 등급 표시

# 서비스 파일 편집 (drop-in 방식)
sudo systemctl edit nginx
```

드롭-인 파일 예시:

```ini
[Service]
NoNewPrivileges=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/log/nginx /var/lib/nginx
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_BIND_SERVICE
SystemCallFilter=@system-service
LockPersonality=yes
RestrictRealtime=yes
```

```bash
sudo systemctl daemon-reload
sudo systemctl restart nginx
# 테스트 후 이상 없으면 유지
```

## Linux Capabilities

root 권한을 세분화한 것이 capabilities입니다. 특권 포트(1024 미만) 바인딩, 패킷 캡처 등 기능별로 분리합니다.

```bash
# 프로세스의 capabilities 확인
cat /proc/$(pgrep nginx | head -1)/status | grep Cap
capsh --decode=00000000a80425fb

# 실행 파일에 capability 부여 (setuid 대안)
sudo setcap 'cap_net_bind_service=+eip' /usr/bin/node

# 부여된 capability 확인
getcap /usr/bin/node

# 제거
sudo setcap -r /usr/bin/node
```

### 주요 Capabilities

| Capability | 설명 |
|---|---|
| `CAP_NET_BIND_SERVICE` | 1024 이하 포트 바인딩 |
| `CAP_NET_RAW` | raw 소켓 (ping, tcpdump) |
| `CAP_SYS_PTRACE` | 다른 프로세스 디버깅 |
| `CAP_DAC_OVERRIDE` | 파일 퍼미션 무시 |
| `CAP_SYS_ADMIN` | 광범위 관리 — 가능한 피할 것 |

## /proc 마운트 하드닝

```bash
# /etc/fstab 에 추가
proc  /proc  proc  defaults,hidepid=2,gid=proc  0  0

# hidepid=2: root 외에는 자신의 프로세스 정보만 볼 수 있음
sudo mount -o remount,hidepid=2 /proc
```

## 커널 sysctl 강화

```bash
# /etc/sysctl.d/99-hardening.conf
kernel.dmesg_restrict = 1         # 일반 유저 dmesg 금지
kernel.kptr_restrict = 2          # 커널 포인터 노출 금지
kernel.yama.ptrace_scope = 1      # ptrace 제한
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
fs.suid_dumpable = 0              # SUID 프로세스 core dump 금지

sudo sysctl -p /etc/sysctl.d/99-hardening.conf
```

---

**지난 글:** [LUKS — 리눅스 디스크 전체 암호화](/posts/linux-disk-encryption-luks/)

**다음 글:** [CVE 모니터링 — 취약점 추적과 패치 전략](/posts/linux-cve-monitoring/)

<br>
읽어주셔서 감사합니다. 😊
