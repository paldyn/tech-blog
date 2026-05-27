---
title: "로그인이 안 될 때 — 계정·PAM·쉘 문제 진단"
description: "Linux에서 로그인이 거부될 때 비밀번호 오류, 계정 잠금, PAM 설정 문제, 잘못된 쉘, SSH 키 권한 등 원인별 진단과 해결 방법을 체계적으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 8
type: "knowledge"
category: "Linux"
tags: ["Linux", "로그인", "PAM", "SSH", "계정잠금", "troubleshooting", "인증"]
featured: false
draft: false
---

[지난 글](/posts/linux-rescue-mode/)에서 복구 모드로 부팅 실패를 극복하는 방법을 살펴봤습니다. 이번에는 시스템은 정상 부팅되지만 **로그인 자체가 거부**되는 상황의 진단법을 정리합니다.

![로그인 실패 진단 흐름도](/assets/posts/linux-cant-login-flow.svg)

## 1단계: 에러 메시지 파악

로그인 실패 메시지는 원인을 좁혀주는 단서입니다.

| 메시지 | 가능한 원인 |
|--------|------------|
| `Authentication failure` | 비밀번호 오류, 계정 잠금, PAM 실패 |
| `Permission denied` | SSH 키 문제, AllowUsers 목록 제외 |
| `Account is locked` | `passwd -l` 또는 로그인 시도 초과 |
| `This account is currently not available` | 쉘이 `/sbin/nologin` 또는 `/bin/false` |
| `sudo: unable to resolve host` | /etc/hosts 설정 문제 |

## 비밀번호 문제

```bash
# 비밀번호 상태 확인
passwd -S username
# username P 2026-05-28 0 99999 7 -1
# 두 번째 필드: P=정상, L=잠금, NP=비밀번호없음

# root로 비밀번호 강제 변경
sudo passwd username

# 비밀번호 만료 확인
chage -l username
# Last password change: May 28, 2026
# Password expires: Jul 27, 2026

# 비밀번호 만료 해제
sudo chage -M -1 username
```

## 계정 잠금

로그인 실패 횟수 초과 시 PAM이 계정을 잠글 수 있습니다.

```bash
# 잠금 상태 확인 (현대 시스템 - faillock)
faillock --user username
# When                Type  Source  Valid
# 2026-05-28 09:00    RHOST  192.168.1.x  V

# 잠금 해제
sudo faillock --user username --reset

# 또는 usermod
sudo usermod -U username    # -L로 잠근 경우

# 구버전 시스템 (pam_tally2)
sudo pam_tally2 --user=username --reset
```

## 쉘 문제

![PAM 인증 흐름과 주요 진단 명령](/assets/posts/linux-cant-login-pam.svg)

```bash
# 계정의 쉘 확인
getent passwd username
# username:x:1001:1001::/home/username:/sbin/nologin

# /sbin/nologin: 서비스 계정에 로그인을 막기 위한 쉘
# 정상 로그인 가능한 쉘로 변경
sudo chsh -s /bin/bash username

# 또는 직접 수정 (주의: 형식 정확히 맞춰야 함)
sudo usermod -s /bin/bash username
```

시스템 계정(www-data, nobody 등)은 의도적으로 `/sbin/nologin`을 씁니다. 잘못 바꾸면 보안 문제가 됩니다.

## SSH 로그인 문제

SSH는 추가적인 인증 레이어가 있습니다.

```bash
# SSH 설정 검사
sudo sshd -T | grep -E 'permitrootlogin|allowusers|passwordauth'

# root 로그인 허용 여부
grep PermitRootLogin /etc/ssh/sshd_config
# PermitRootLogin no (기본값 — root 직접 SSH 차단)

# 특정 사용자만 허용하는 경우
grep AllowUsers /etc/ssh/sshd_config
# AllowUsers alice bob   (목록에 없으면 거부)

# SSH 에러 로그 실시간 확인
sudo journalctl -u sshd -f

# 접속 시 -v로 상세 디버그
ssh -v user@server 2>&1 | grep -i 'auth\|debug\|error'
```

### SSH 키 인증 실패

```bash
# 키 권한 확인 (권한 너무 넓으면 무시됨)
ls -la ~/.ssh/
# drwx------ .ssh/           (700 필수)
# -rw------- authorized_keys (600 필수)

# 권한 수정
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys

# SELinux가 SSH 키 파일을 막는 경우
ls -laZ ~/.ssh/authorized_keys
restorecon -Rv ~/.ssh
```

## PAM 설정 문제

PAM 설정이 깨지면 모든 로그인이 차단됩니다.

```bash
# PAM 설정 파일 확인 (sshd)
cat /etc/pam.d/sshd | grep -v '^#'

# 흔한 실수: 잘못된 pam_require 설정
# pam_nologin.so 가 /etc/nologin 파일 존재 시 로그인 차단
ls /etc/nologin
# 파일 존재하면 root 외 모든 로그인 차단!
sudo rm /etc/nologin
```

## /etc/hosts.deny 확인

TCP Wrapper가 접근을 차단할 수 있습니다.

```bash
cat /etc/hosts.deny
# ALL: ALL   ← 이 설정이 있으면 모든 접근 차단

cat /etc/hosts.allow
# sshd: 192.168.1.0/24   ← 허용 목록
```

## 로그로 원인 확인

```bash
# 인증 로그 (Ubuntu/Debian)
sudo tail -f /var/log/auth.log

# systemd 환경 (대부분의 현대 배포판)
sudo journalctl -u sshd --since "1 hour ago"

# PAM 실패 메시지 찾기
sudo journalctl | grep -i 'pam\|authentication\|failed' | tail -20

# 마지막 로그인 기록
last username
lastb username    # 실패한 로그인 시도
```

## 요약 체크리스트

```
[ ] passwd -S username  → 계정 상태 확인
[ ] faillock --user username  → 잠금 여부
[ ] getent passwd username  → 쉘 확인
[ ] /etc/ssh/sshd_config  → AllowUsers, PermitRootLogin
[ ] ~/.ssh 권한 → 700/600
[ ] /etc/nologin 파일 존재 여부
[ ] journalctl -u sshd  → 에러 로그
```

---

**지난 글:** [복구 모드와 emergency 타겟 — 부팅 실패 시 살아남기](/posts/linux-rescue-mode/)

**다음 글:** [디스크 풀 문제 해결 — df·du·find로 공간 확보](/posts/linux-disk-full-troubleshoot/)

<br>
읽어주셔서 감사합니다. 😊
