---
title: "Too many open files — 파일 디스크립터 한도 문제 해결"
description: "EMFILE/ENFILE 에러의 원인인 파일 디스크립터 한도 구조를 이해하고, ulimit, /etc/security/limits.conf, systemd LimitNOFILE 설정으로 한도를 영구 조정하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["Linux", "파일디스크립터", "ulimit", "EMFILE", "limits.conf", "troubleshooting", "성능"]
featured: false
draft: false
---

[지난 글](/posts/linux-disk-full-troubleshoot/)에서 디스크 공간 문제를 다뤘습니다. 고부하 웹 서버나 데이터베이스에서 또 다른 흔한 장애 원인이 바로 `Too many open files` 에러입니다. 파일 디스크립터 한도를 초과했을 때 발생합니다.

![파일 디스크립터 한도 계층](/assets/posts/linux-too-many-open-files-limits.svg)

## 파일 디스크립터란

Linux에서 소켓, 파일, 파이프, 디바이스를 포함한 **모든 I/O 리소스**는 정수 번호인 파일 디스크립터(FD)로 참조됩니다. 프로세스당 열 수 있는 FD 수에 한도가 있으며, 이를 초과하면 `EMFILE`(프로세스 한도 초과) 또는 `ENFILE`(시스템 전체 한도 초과) 에러가 발생합니다.

```bash
# FD 번호 0, 1, 2는 항상 예약
ls -la /proc/$$/fd/
# 0 -> /dev/pts/0  (stdin)
# 1 -> /dev/pts/0  (stdout)
# 2 -> /dev/pts/0  (stderr)
# 3 -> /var/log/app.log
# ...
```

## 현재 한도 확인

![FD 한도 진단 및 설정 명령](/assets/posts/linux-too-many-open-files-diag.svg)

```bash
# 현재 쉘의 soft 한도
ulimit -n
# 1024  (기본값 — 고부하 서버에는 매우 부족)

# soft/hard 모두 확인
ulimit -Sn && ulimit -Hn

# 프로세스의 실제 한도 (PID로 직접 조회)
cat /proc/$(pgrep nginx | head -1)/limits | grep "Max open files"
# Max open files    65536    65536    files

# 시스템 전체 상황
cat /proc/sys/fs/file-nr
# 12800   0   2097152
# 현재사용  항상0  시스템한도
```

## 어떤 프로세스가 FD를 많이 쓰는지

```bash
# 프로세스별 FD 수 상위 10개
for pid in $(ls /proc | grep '^[0-9]'); do
  count=$(ls /proc/$pid/fd 2>/dev/null | wc -l)
  echo "$count $pid $(cat /proc/$pid/comm 2>/dev/null)"
done | sort -rn | head -10

# 특정 프로세스의 FD 상세 (lsof)
lsof -p $(pgrep nginx | head -1) | head -20

# 특정 사용자 전체 FD 수
lsof -u www-data | wc -l
```

## FD 한도 상향 설정

### 임시 변경 (현재 쉘 세션)

```bash
# soft 한도만 변경 (hard 이하까지 가능)
ulimit -n 65536

# 확인
ulimit -n
# 65536
```

임시 설정은 해당 쉘과 그 자식 프로세스에만 적용되며 재시작 시 초기화됩니다.

### 영구 변경 — /etc/security/limits.conf

```bash
# /etc/security/limits.conf 편집
cat << 'EOF' | sudo tee -a /etc/security/limits.conf
# 모든 사용자 (*)
*     soft  nofile  65536
*     hard  nofile  1048576

# 특정 사용자
nginx soft  nofile  65536
nginx hard  nofile  1048576
EOF

# /etc/security/limits.d/ 디렉터리에 별도 파일 (권장)
echo "* soft nofile 65536" | sudo tee /etc/security/limits.d/99-nofile.conf
echo "* hard nofile 1048576" | sudo tee -a /etc/security/limits.d/99-nofile.conf
```

`soft` 한도는 프로세스가 실행 중에 올릴 수 있는 기본값, `hard`는 올릴 수 있는 최대값입니다. 로그아웃 후 재로그인해야 적용됩니다.

### systemd 서비스의 경우 (가장 중요)

`limits.conf`는 systemd 서비스에 **적용되지 않습니다**. nginx, MySQL 등 systemd로 관리되는 서비스는 유닛 파일에서 직접 설정해야 합니다.

```bash
# 서비스 유닛 파일 편집
sudo systemctl edit nginx
# 아래 내용 입력 (override 파일 생성됨)
# [Service]
# LimitNOFILE=65536

# 또는 /etc/systemd/system/nginx.service.d/limits.conf 생성
sudo mkdir -p /etc/systemd/system/nginx.service.d/
cat << 'EOF' | sudo tee /etc/systemd/system/nginx.service.d/limits.conf
[Service]
LimitNOFILE=65536
EOF

# 적용
sudo systemctl daemon-reload
sudo systemctl restart nginx

# 확인
sudo systemctl show nginx | grep LimitNOFILE
# LimitNOFILE=65536
```

### 시스템 전체 한도 (fs.file-max)

```bash
# 시스템 전체 FD 한도 확인 및 변경
cat /proc/sys/fs/file-max
# 2097152

# 상향 (현재 세션)
sudo sysctl -w fs.file-max=2097152

# 영구 적용
echo "fs.file-max = 2097152" | sudo tee /etc/sysctl.d/99-fd.conf
sudo sysctl --system
```

## FD 누수 의심 시

프로세스가 FD를 열고 닫지 않는 FD 누수(leak)가 있을 경우 한도를 아무리 올려도 결국 고갈됩니다.

```bash
# 시간 경과에 따른 FD 수 모니터링
watch -n 2 'ls /proc/$(pgrep myapp)/fd | wc -l'

# 어떤 파일 타입이 많이 열려있는지
lsof -p $(pgrep myapp) | awk '{print $5}' | sort | uniq -c | sort -rn
# REG (일반 파일), IPv4 (소켓) 등
```

## 요약

| 범위 | 설정 위치 | 효과 |
|------|-----------|------|
| 즉각 (쉘) | `ulimit -n 65536` | 현재 세션만 |
| 사용자/일반 프로세스 | `/etc/security/limits.d/` | 재로그인 후 |
| systemd 서비스 | `LimitNOFILE=` (유닛 파일) | 서비스 재시작 후 |
| 시스템 전체 | `sysctl fs.file-max` | 즉시 (영구: sysctl.d) |

---

**지난 글:** [디스크 풀 문제 해결 — df·du·find로 공간 확보](/posts/linux-disk-full-troubleshoot/)

<br>
읽어주셔서 감사합니다. 😊
