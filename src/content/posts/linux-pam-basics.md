---
title: "PAM 기초 — 플러그인 가능한 인증 모듈"
description: "Linux PAM의 4가지 모듈 유형, /etc/pam.d/ 설정 문법, 제어 플래그, 주요 모듈(pam_unix, pam_tally2, pam_limits)을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["linux", "pam", "authentication", "pam_unix", "pam_tally2", "pam_limits", "security", "linux-admin"]
featured: false
draft: false
---

[지난 글](/posts/linux-getent-passwd-group/)에서 NSS와 getent를 살펴봤습니다. 이번에는 **PAM(Pluggable Authentication Modules)**을 다룹니다. PAM은 리눅스 인증 시스템의 핵심 레이어로, `login`, `sshd`, `sudo` 등이 모두 PAM을 통해 인증을 처리합니다.

## PAM이 해결하는 문제

인증 방식이 바뀔 때마다 `sshd`, `login`, `sudo` 등 각 프로그램을 수정해야 한다면 매우 번거롭습니다. PAM은 이 문제를 **역할 분리**로 해결합니다. 애플리케이션은 PAM 라이브러리에만 의존하고, 실제 인증 방식은 설정 파일로 교체합니다.

비밀번호 인증에서 LDAP 인증으로, 또는 OTP를 추가하는 것이 애플리케이션 코드 수정 없이 가능합니다.

## 4가지 모듈 유형

![PAM 아키텍처](/assets/posts/linux-pam-basics-architecture.svg)

| 유형 | 역할 |
|------|------|
| `auth` | 사용자 신원 확인 (비밀번호, 토큰, 생체 인증) |
| `account` | 접근 허용 여부 (만료, 잠금, 시간대 제한) |
| `password` | 비밀번호 변경 처리 (정책, 해시 알고리즘) |
| `session` | 로그인/로그아웃 시 환경 설정 (마운트, 감사) |

각 유형은 **모듈 스택**으로 구성됩니다. 여러 모듈이 쌓여 순서대로 실행되며, 제어 플래그가 실패 시 동작을 결정합니다.

## /etc/pam.d/ 설정 파일

서비스별 설정 파일이 `/etc/pam.d/`에 있습니다. 파일명이 서비스 이름과 일치합니다.

```bash
ls /etc/pam.d/
# common-auth  common-account  login  sshd  sudo  passwd  ...
```

![PAM 설정 파일 문법](/assets/posts/linux-pam-basics-config.svg)

각 줄은 `유형 제어플래그 모듈 [인수]` 형식입니다.

```
auth    required   pam_unix.so nullok
auth    sufficient pam_google_authenticator.so
account required   pam_unix.so
session required   pam_limits.so
```

`include`를 통해 공통 설정을 재사용합니다. Ubuntu/Debian에서는 `common-auth`, `common-account` 등에 공통 설정이 있고, 서비스별 파일에서 `@include common-auth` 로 포함합니다.

## 주요 PAM 모듈

### pam_unix.so — 전통적 Unix 인증

`/etc/shadow`의 비밀번호 해시로 인증합니다. 가장 기본적인 모듈입니다.

```
auth    required pam_unix.so nullok
# nullok: 빈 비밀번호 허용 (개발 환경에서만)
```

### pam_faillock.so — 로그인 실패 잠금

연속 로그인 실패 시 계정을 잠급니다. `pam_tally2`의 현대적 대체입니다.

```bash
# /etc/security/faillock.conf
deny = 5          # 5회 실패 시 잠금
unlock_time = 300 # 300초 후 자동 해제
fail_interval = 900

# 잠금 상태 확인
faillock --user alice

# 잠금 해제
sudo faillock --user alice --reset
```

### pam_limits.so — 자원 제한

`/etc/security/limits.conf`로 프로세스 자원을 제한합니다.

```bash
# /etc/security/limits.conf
alice   soft  nofile  10000   # 최대 열린 파일 수 (경고)
alice   hard  nofile  20000   # 최대 열린 파일 수 (한계)
@devops soft  nproc   200     # 최대 프로세스 수

# 현재 제한 확인
ulimit -a
ulimit -n  # 파일 디스크립터 수
```

### pam_env.so — 환경변수 설정

```bash
# /etc/security/pam_env.conf
JAVA_HOME DEFAULT=/usr/lib/jvm/java-17
PATH      DEFAULT=${PATH}:/opt/bin
```

로그인 시 자동으로 환경변수를 설정합니다.

## 실전: 비밀번호 정책 강화

Ubuntu/Debian에서 `libpam-pwquality`를 설치하면 비밀번호 복잡도를 강제할 수 있습니다.

```bash
sudo apt install libpam-pwquality

# /etc/security/pwquality.conf
minlen = 12        # 최소 12자
dcredit = -1       # 숫자 최소 1개
ucredit = -1       # 대문자 최소 1개
lcredit = -1       # 소문자 최소 1개
ocredit = -1       # 특수문자 최소 1개
maxrepeat = 3      # 같은 문자 최대 3회 반복

# /etc/pam.d/common-password 에 자동 추가됨
password requisite pam_pwquality.so retry=3
```

## PAM 디버깅

PAM 설정 오류는 로그인이 안 되는 치명적인 결과를 낳습니다. 변경 전에 반드시 **별도 세션을 열어 두고** 테스트하세요.

```bash
# PAM 인증 테스트 (root 필요)
sudo pamtester sshd alice authenticate

# /var/log/auth.log 또는 journalctl로 확인
sudo journalctl -u sshd -f
grep pam /var/log/auth.log | tail -20
```

설정 변경 후 즉시 `pamtester`로 검증하는 습관이 잠금 사고를 예방합니다.

---

**지난 글:** [getent — 사용자·그룹 데이터베이스 조회](/posts/linux-getent-passwd-group/)

**다음 글:** [systemd 개요 — 현대 Linux의 init 시스템](/posts/linux-systemd-overview/)

<br>
읽어주셔서 감사합니다. 😊
