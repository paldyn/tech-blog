---
title: "디스크 풀 문제 해결 — df·du·find로 공간 확보"
description: "No space left on device 오류가 발생했을 때 df, du, find, lsof를 이용해 원인을 단계적으로 좁히고 공간을 확보하는 방법, inode 고갈과 삭제된 파일 문제까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["Linux", "디스크풀", "df", "du", "inode", "lsof", "troubleshooting", "디스크관리"]
featured: false
draft: false
---

[지난 글](/posts/linux-cant-login/)에서 로그인 실패 원인을 진단하는 법을 살펴봤습니다. 이번에는 `No space left on device` 오류가 발생했을 때의 대응법입니다. 서버가 갑자기 멈추는 가장 흔한 원인 중 하나입니다.

![디스크 풀 진단 흐름](/assets/posts/linux-disk-full-troubleshoot-flow.svg)

## 1단계: 어느 파티션인지 확인

```bash
# 파티션별 디스크 사용량 (사람이 읽기 편한 단위)
df -h
# Filesystem      Size  Used Avail Use% Mounted on
# /dev/sda1        50G   50G    0  100% /
# /dev/sda2       200G   80G  110G  42% /data

# inode 사용량 확인 (블록 여유 있어도 inode 고갈 가능)
df -i
# Filesystem     Inodes  IUsed   IFree IUse% Mounted on
# /dev/sda1      3276800 3276800     0  100% /  ← inode 고갈!
```

`Use%`가 100%여도 `IUse%`가 100%여도 "No space left"가 발생합니다. **반드시 두 가지 모두 확인**해야 합니다.

## 2단계: 큰 디렉터리 찾기

![df / du 실전 패턴](/assets/posts/linux-disk-full-troubleshoot-du.svg)

```bash
# 루트부터 내려가며 단계적으로 찾기
du -sh /* 2>/dev/null | sort -rh | head -15

# 용의자 디렉터리로 좁히기 (예: /var)
du -sh /var/* 2>/dev/null | sort -rh | head -10

# 로그 디렉터리
du -sh /var/log/* | sort -rh
```

## 흔한 원인과 해결책

### 로그 파일 폭발

```bash
# 저널 크기 확인
journalctl --disk-usage

# 즉시 정리 (500MB로 제한)
sudo journalctl --vacuum-size=500M
# 또는 30일 이전 삭제
sudo journalctl --vacuum-time=30d

# 로그 파일 직접 정리
sudo truncate -s 0 /var/log/syslog
sudo find /var/log -name "*.gz" -mtime +7 -delete
sudo find /var/log -name "*.1" -delete
```

### 패키지 캐시

```bash
# apt 캐시 (Debian/Ubuntu)
sudo apt clean        # 다운로드 캐시 삭제
sudo apt autoremove   # 불필요한 패키지 삭제

# dnf/yum 캐시 (RHEL/CentOS/Fedora)
sudo dnf clean all

# pip 캐시
pip cache purge
```

### Docker 데이터

```bash
# Docker 사용량 확인
docker system df

# 정지된 컨테이너, 미사용 이미지·볼륨 삭제
docker system prune -f
docker volume prune -f
docker image prune -a -f
```

### 코어 덤프 파일

```bash
# 코어 덤프 위치 확인
cat /proc/sys/kernel/core_pattern
# /var/crash/core.%e.%p

# 코어 덤프 정리
sudo find / -name "core.*" -type f -size +10M -ls 2>/dev/null
sudo find /var/crash -type f -delete
```

## 삭제된 파일이 공간을 차지하는 경우

`df`는 100%를 보여주는데 `du`로 합산해도 공간이 맞지 않는 경우, **프로세스가 파일 디스크립터를 열어 놓은 채로 파일을 삭제**했을 가능성이 높습니다. 파일 디스크립터가 닫혀야 실제 블록이 해제됩니다.

```bash
# 삭제됐지만 열려있는 파일 찾기 (link count = 0)
lsof +L1
# COMMAND   PID  USER   FD   TYPE  ...  SIZE  NLINK  NAME
# nginx    1234  www    4w   REG   ...  8.5G      0  /var/log/nginx.log (deleted)

# 해결: 해당 프로세스 재시작
sudo systemctl restart nginx
# 또는 트런케이트 (파일 내용 비우기)
echo "" > /proc/1234/fd/4
```

## inode 고갈 진단

```bash
# 어느 디렉터리에 파일이 많은지 찾기
find / -xdev -printf '%h\n' 2>/dev/null \
  | sort | uniq -c | sort -rn | head -10

# 예: /var/spool/postfix/deferred 에 메일 큐 쌓임
ls /var/spool/postfix/deferred | wc -l
# 1234567  ← 소파일 수백만 개

# 빠르게 삭제 (rm은 인자 제한 있음)
find /var/spool/postfix/deferred -type f -delete
```

inode 고갈은 임시 파일 디렉터리(`/tmp`, `/var/tmp`, `/var/spool`)에서 소파일이 대량 생성될 때 발생합니다.

## 예방 — logrotate와 모니터링

```bash
# /etc/logrotate.d/nginx 예시
# /var/log/nginx/*.log {
#     daily
#     rotate 7
#     compress
#     delaycompress
#     missingok
#     notifempty
# }

# 디스크 사용량 경보 (cron)
# df -h | awk '$5+0 > 80 {print}' | mail -s "Disk Alert" admin@example.com

# 현재 상위 디렉터리 사용량 모니터링
watch -n 5 'df -h && echo "---" && du -sh /var/* 2>/dev/null | sort -rh | head -5'
```

## 빠른 응급 처치 체크리스트

```bash
# 1. 파티션 확인
df -h && df -i

# 2. 로그 정리
sudo journalctl --vacuum-size=200M

# 3. 패키지 캐시 정리
sudo apt clean 2>/dev/null || sudo dnf clean all 2>/dev/null

# 4. 임시 파일 정리
sudo find /tmp /var/tmp -mtime +7 -delete 2>/dev/null

# 5. 삭제 파일 FD 확인
lsof +L1 | awk '{if(NR>1) print $1,$2,$7,$NF}' | head -10
```

---

**지난 글:** [로그인이 안 될 때 — 계정·PAM·쉘 문제 진단](/posts/linux-cant-login/)

**다음 글:** [Too many open files — 파일 디스크립터 한도 문제 해결](/posts/linux-too-many-open-files/)

<br>
읽어주셔서 감사합니다. 😊
