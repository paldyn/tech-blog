---
title: "useradd & userdel — 사용자 생성과 삭제"
description: "useradd, usermod, userdel의 주요 옵션, /etc/passwd·shadow·group 파일 구조, 사용자 관리 실전 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["linux", "useradd", "userdel", "usermod", "passwd", "shadow", "user-management", "uid", "gid", "group"]
featured: false
draft: false
---

[지난 글](/posts/linux-rsync-over-ssh/)에서 rsync로 원격 파일을 동기화하는 방법을 살펴봤습니다. 이번에는 리눅스 시스템의 기반인 **사용자 관리**를 다룹니다. `useradd`, `usermod`, `userdel`은 시스템 관리자가 매일 사용하는 명령어입니다. 이 명령들이 실제로 수정하는 파일과 그 구조를 이해하면, 문제가 생겼을 때 직접 진단하고 고칠 수 있습니다.

## 사용자 정보 저장 파일

리눅스에서 사용자 정보는 세 개의 텍스트 파일에 분산 저장됩니다.

| 파일 | 권한 | 내용 |
|------|------|------|
| `/etc/passwd` | 644 (모두 읽기) | 사용자 기본 정보 |
| `/etc/shadow` | 640 또는 000 | 해시된 비밀번호 |
| `/etc/group` | 644 | 그룹 정보 |
| `/etc/gshadow` | 640 | 그룹 비밀번호 |

`/etc/passwd`의 비밀번호 필드가 `x`인 것은, 실제 비밀번호 해시가 `/etc/shadow`에 분리 저장된다는 뜻입니다. shadow 파일은 root와 shadow 그룹만 읽을 수 있어 해시 탈취를 방지합니다.

## /etc/passwd 파일 구조

![/etc/passwd 필드 구조](/assets/posts/linux-useradd-userdel-files.svg)

```
# 형식: 사용자명:비밀번호:UID:GID:GECOS:홈디렉터리:셸
alice:x:1001:1001:Alice Kim:/home/alice:/bin/bash
bob:x:1002:1001:Bob Lee:/home/bob:/bin/bash
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin
```

- **UID 0**: root
- **UID 1-999**: 시스템 계정 (서비스, 데몬)
- **UID 1000+**: 일반 사용자
- `/usr/sbin/nologin` 또는 `/bin/false`: 로그인이 불가능한 시스템 계정

## useradd — 사용자 생성

```bash
# 기본 사용자 생성 (홈 디렉터리 자동 생성)
useradd -m -s /bin/bash alice

# 상세 옵션 지정
useradd \
  -m \              # 홈 디렉터리 생성
  -s /bin/bash \    # 로그인 셸
  -c "Alice Kim" \  # 코멘트 (GECOS)
  -u 1500 \         # UID 지정
  -g developers \   # 기본 그룹
  -G sudo,docker \  # 보조 그룹
  alice

# 비밀번호 설정 (생성 직후 반드시 설정)
passwd alice
```

`useradd`만으로는 비밀번호가 설정되지 않아 계정이 잠긴 상태입니다. `passwd alice`로 비밀번호를 설정해야 로그인이 가능합니다.

![useradd 명령어](/assets/posts/linux-useradd-userdel-commands.svg)

## /etc/default/useradd — 기본값 설정

`useradd`의 기본 동작은 `/etc/default/useradd` 파일로 제어합니다.

```bash
# 기본값 확인
useradd -D

# /etc/default/useradd 내용 예시
GROUP=1000
HOME=/home
INACTIVE=-1          # 비밀번호 만료 후 계정 비활성 기간
EXPIRE=              # 계정 만료일 (비어있으면 만료 없음)
SHELL=/bin/sh        # 기본 셸
SKEL=/etc/skel       # 홈 디렉터리 템플릿
CREATE_MAIL_SPOOL=no
```

`/etc/skel`의 파일들은 사용자 홈 디렉터리 생성 시 자동으로 복사됩니다. 모든 신규 사용자에게 공통 설정(`.bashrc`, `.profile` 등)을 배포할 때 활용합니다.

## usermod — 사용자 수정

```bash
# 로그인 셸 변경
usermod -s /bin/zsh alice

# 홈 디렉터리 변경 (-m: 파일도 이동)
usermod -m -d /new/home/alice alice

# 보조 그룹 추가 (-a: 기존 그룹 유지, 필수)
usermod -aG sudo alice
usermod -aG docker,wheel alice

# 계정 잠금 (비밀번호 앞에 ! 추가)
usermod -L alice

# 계정 잠금 해제
usermod -U alice

# 계정 만료일 설정
usermod -e 2026-12-31 alice

# UID 변경 (파일 소유권은 별도로 변경해야 함)
usermod -u 2000 alice
```

`-aG`에서 `-a` 없이 `-G`만 쓰면 기존 보조 그룹이 모두 교체됩니다. 반드시 `-aG`를 함께 씁니다.

## userdel — 사용자 삭제

```bash
# 사용자만 삭제 (홈 디렉터리, 메일 유지)
userdel alice

# 홈 디렉터리와 메일 스풀도 함께 삭제
userdel -r alice

# 삭제 전 실행 중인 프로세스 확인 (살아있으면 삭제 실패)
ps aux | grep alice
# 또는
pkill -u alice   # 강제 종료 후 삭제
```

삭제된 사용자의 UID로 소유된 파일이 시스템에 남을 수 있습니다.

```bash
# 삭제된 사용자 UID의 파일 찾기
find / -nouser -print 2>/dev/null
find / -uid 1001 -print 2>/dev/null
```

## 사용자 정보 확인 명령어

```bash
# 현재 사용자 UID/GID/그룹 조회
id
id alice

# 로그인 중인 사용자 목록
who
w

# 사용자 정보 직접 조회 (getent은 LDAP 등도 지원)
getent passwd alice
getent group developers

# 마지막 로그인 기록
lastlog
last alice

# 실패한 로그인 기록
lastb
```

## 서비스 계정 생성 패턴

데몬 프로세스를 위한 서비스 계정은 로그인이 불가능하도록 만드는 것이 보안 원칙입니다.

```bash
# 시스템 계정 생성 (-r: UID < 1000, 홈 없음, 셸 nologin)
useradd -r -s /usr/sbin/nologin -d /var/lib/myapp myapp

# 또는 더 명시적으로
useradd \
  --system \
  --no-create-home \
  --home-dir /var/lib/myapp \
  --shell /usr/sbin/nologin \
  --comment "MyApp Service" \
  myapp
```

## 배치 사용자 생성

많은 사용자를 한 번에 생성할 때는 `newusers` 명령을 씁니다.

```bash
# 파일 형식: 사용자명:비밀번호:UID:GID:GECOS:홈:셸
cat > /tmp/new_users.txt <<EOF
alice:P@ssword1:1001:1001:Alice Kim:/home/alice:/bin/bash
bob:P@ssword2:1002:1001:Bob Lee:/home/bob:/bin/bash
EOF

# 일괄 생성
newusers /tmp/new_users.txt
rm /tmp/new_users.txt  # 비밀번호 파일 즉시 삭제
```

사용자 관리는 시스템 보안의 기초입니다. 최소 권한 원칙에 따라 필요한 그룹에만 추가하고, 사용하지 않는 계정은 잠금(`-L`)이나 삭제로 정리하는 습관이 중요합니다.

---

**지난 글:** [rsync over SSH — 원격 파일 동기화](/posts/linux-rsync-over-ssh/)

**다음 글:** [passwd & shadow — 비밀번호 관리](/posts/linux-passwd-shadow/)

<br>
읽어주셔서 감사합니다. 😊
