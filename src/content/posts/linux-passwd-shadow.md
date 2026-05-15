---
title: "passwd & shadow — 비밀번호 관리"
description: "/etc/shadow 파일 구조, passwd·chpasswd·chage 명령어, 비밀번호 만료 정책, 해시 알고리즘, 계정 잠금 원리를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["linux", "passwd", "shadow", "chpasswd", "chage", "password-policy", "sha512", "pam", "account-security"]
featured: false
draft: false
---

[지난 글](/posts/linux-useradd-userdel/)에서 `useradd`와 `userdel`로 사용자 계정을 생성·삭제하는 방법을 살펴봤습니다. 이번에는 비밀번호 자체를 관리하는 **`passwd`**, **`chpasswd`**, **`chage`** 명령어와, 비밀번호 해시가 실제로 저장되는 **`/etc/shadow`** 파일 구조를 깊이 살펴봅니다.

## /etc/shadow 파일 구조

`/etc/shadow`는 9개의 콜론 구분 필드로 구성됩니다.

```
alice:$6$salt$hash...:19900:0:99999:7:::
```

![/etc/shadow 필드 구조](/assets/posts/linux-passwd-shadow-fields.svg)

**필드별 의미:**

| 필드 | 예시 | 설명 |
|------|------|------|
| 사용자명 | alice | `/etc/passwd`와 연결되는 키 |
| 해시 비밀번호 | `$6$salt$hash` | 해시 알고리즘 + salt + 해시 |
| 마지막 변경일 | 19900 | 1970-01-01 기준 일수 |
| 최소 유효기간 | 0 | 변경 후 최소 이 기간 유지 |
| 최대 유효기간 | 99999 | 이 기간 경과 후 만료 |
| 경고 기간 | 7 | 만료 N일 전부터 경고 |
| 비활성 기간 | (빈칸) | 만료 후 유예 기간 |
| 계정 만료일 | (빈칸) | epoch days, 빈칸=만료 없음 |
| 예약 | (빈칸) | 미래 사용 예약 |

## 비밀번호 해시 형식

`$알고리즘$salt$hash` 형식으로 구성됩니다.

```
$6$rounds=656000$randomsalt$hashedvalue
```

- `$1$`: MD5 (사용 금지)
- `$5$`: SHA-256
- `$6$`: SHA-512 (현재 기본값, 권장)
- `$y$`: yescrypt (최신 배포판의 기본값)
- `!` 또는 `!!`: 계정 잠금 (비밀번호 없음)
- `*`: 비밀번호로 로그인 불가

```bash
# 현재 사용 중인 해시 알고리즘 확인
grep ENCRYPT_METHOD /etc/login.defs

# 특정 사용자의 shadow 항목 확인 (root 필요)
sudo grep alice /etc/shadow
```

## passwd — 비밀번호 변경

```bash
# 현재 사용자 비밀번호 변경 (대화형)
passwd

# root가 특정 사용자 비밀번호 변경
sudo passwd alice

# 비밀번호 없이 계정 활성화 (빈 비밀번호)
sudo passwd -d alice

# 계정 잠금 (shadow의 해시 앞에 ! 추가)
sudo passwd -l alice

# 계정 잠금 해제
sudo passwd -u alice

# 비밀번호 즉시 만료 (다음 로그인 시 변경 강제)
sudo passwd -e alice
```

`passwd -l`은 `usermod -L`과 같은 효과입니다. 두 명령 모두 `/etc/shadow`의 비밀번호 필드 앞에 `!`를 추가해 비밀번호를 무효화합니다.

![passwd & chpasswd 명령어](/assets/posts/linux-passwd-shadow-commands.svg)

## chpasswd — 일괄 비밀번호 변경

스크립트나 자동화에서 대화형 프롬프트 없이 비밀번호를 변경할 때 씁니다.

```bash
# 단일 사용자
echo 'alice:NewP@ssword123' | sudo chpasswd

# 여러 사용자 (파일에서 읽기)
cat > /tmp/passwords.txt <<EOF
alice:AliceP@ss1
bob:BobP@ss2
carol:CarolP@ss3
EOF
sudo chpasswd < /tmp/passwords.txt
shred -u /tmp/passwords.txt   # 비밀번호 파일 안전 삭제
```

`chpasswd`는 기본적으로 `/etc/login.defs`에 설정된 해시 알고리즘을 사용합니다.

## chage — 비밀번호 만료 정책

`chage`(change age)는 `/etc/shadow`의 날짜 관련 필드를 관리합니다.

```bash
# 현재 만료 정책 조회
sudo chage -l alice

# 비밀번호 최대 유효기간 90일로 설정
sudo chage -M 90 alice

# 만료 7일 전부터 경고
sudo chage -W 7 alice

# 비밀번호 최소 유효기간 (변경 후 최소 1일 유지)
sudo chage -m 1 alice

# 다음 로그인 시 비밀번호 변경 강제 (0=오늘 만료)
sudo chage -d 0 alice

# 계정 만료일 설정 (YYYY-MM-DD 또는 -1=만료없음)
sudo chage -E 2026-12-31 alice
sudo chage -E -1 alice   # 만료일 제거
```

## /etc/login.defs — 전역 비밀번호 정책

새 사용자의 기본 비밀번호 정책은 `/etc/login.defs`에서 설정합니다.

```bash
# 주요 설정 항목 확인
grep -E 'PASS_|ENCRYPT_METHOD|LOGIN_RETRIES' /etc/login.defs
```

```
PASS_MAX_DAYS   90       # 비밀번호 최대 유효기간 (일)
PASS_MIN_DAYS   0        # 비밀번호 최소 유효기간 (일)
PASS_WARN_AGE   7        # 만료 경고 일수
PASS_MIN_LEN    8        # 최소 길이 (PAM이 재정의할 수 있음)
ENCRYPT_METHOD  SHA512   # 해시 알고리즘
LOGIN_RETRIES   5        # 로그인 실패 허용 횟수
```

이 설정은 이미 생성된 사용자에게는 적용되지 않고, 새로 생성(`useradd`)하는 사용자부터 적용됩니다. 기존 사용자는 `chage`로 개별 설정해야 합니다.

## PAM과 비밀번호 복잡도

비밀번호 복잡도 강제는 `/etc/pam.d/` 설정을 통해 PAM(Pluggable Authentication Modules)이 담당합니다.

```bash
# Ubuntu/Debian: libpam-pwquality 설치
sudo apt install libpam-pwquality

# /etc/pam.d/common-password 설정 예시
password requisite pam_pwquality.so \
  minlen=12 dcredit=-1 ucredit=-1 ocredit=-1 lcredit=-1
```

**pam_pwquality 주요 옵션:**
- `minlen=12`: 최소 12자
- `dcredit=-1`: 숫자 최소 1개 (`-N`이면 N개 이상)
- `ucredit=-1`: 대문자 최소 1개
- `ocredit=-1`: 특수문자 최소 1개
- `lcredit=-1`: 소문자 최소 1개
- `maxrepeat=3`: 같은 문자 최대 3회 연속
- `reject_username`: 사용자명 포함 금지

## 비밀번호 없이 인증: SSH 키

보안 베스트 프랙티스는 비밀번호 대신 SSH 키를 사용하고, 비밀번호 로그인 자체를 비활성화하는 것입니다.

```bash
# sshd_config에서 비밀번호 로그인 비활성화
sudo sed -i 's/^#PasswordAuthentication yes/PasswordAuthentication no/' \
  /etc/ssh/sshd_config
sudo systemctl reload sshd
```

서버 계정은 SSH 키 인증만 허용하고, 비밀번호는 sudo 승급 시에만 요구하는 구조가 현재 권장되는 패턴입니다.

## 비밀번호 관련 감사

```bash
# 비밀번호 없는 계정 확인 (shadow의 해시 필드가 비어있거나 !!)
sudo awk -F: '($2 == "" || $2 == "!!" || $2 == "!") \
  { print $1 " has no password!" }' /etc/shadow

# 만료된 비밀번호를 가진 사용자 목록
sudo chage -l $(awk -F: '{print $1}' /etc/passwd) 2>/dev/null \
  | grep -B1 "Password expires.*Expired"
```

비밀번호 정책은 계정 보안의 기초입니다. 강력한 해시 알고리즘, 적절한 만료 정책, PAM 복잡도 강제, SSH 키 우선 사용을 조합하면 계정 탈취 위험을 크게 낮출 수 있습니다.

---

**지난 글:** [useradd & userdel — 사용자 생성과 삭제](/posts/linux-useradd-userdel/)

**다음 글:** [groupadd & usermod — 그룹 관리](/posts/linux-groupadd-usermod/)

<br>
읽어주셔서 감사합니다. 😊
