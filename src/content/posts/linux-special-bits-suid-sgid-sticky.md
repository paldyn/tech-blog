---
title: "SUID · SGID · Sticky 비트 — 특수 권한 완전 정복"
description: "리눅스 특수 권한 비트 세 가지(SUID, SGID, Sticky bit)의 동작 원리, 설정 방법, 대표 예시(/tmp, /usr/bin/passwd), 보안 감사 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 7
type: "knowledge"
category: "Linux"
tags: ["linux", "suid", "sgid", "sticky-bit", "permissions", "security", "privilege-escalation"]
featured: false
draft: false
---

[지난 글](/posts/linux-umask/)에서 파일 생성 시 기본 권한을 정하는 `umask`를 다뤘습니다. 이번에는 일반적인 rwx 비트 외에 존재하는 **세 가지 특수 권한 비트**를 다룹니다. 이 비트들은 보안 메커니즘이자 잠재적 취약점의 근원이기도 합니다.

## 특수 비트 개요

8진수 권한의 네 번째(맨 앞) 자리가 특수 비트를 나타냅니다.

```
4 = SUID (Set User ID)
2 = SGID (Set Group ID)
1 = Sticky bit
```

`chmod 4755`에서 맨 앞의 `4`가 SUID입니다.

![SUID · SGID · Sticky 비트 개요](/assets/posts/linux-special-bits-overview.svg)

## SUID — Set User ID

### 동작 원리

실행 파일에 SUID 비트가 설정되면, **프로그램이 실행될 때 파일 소유자의 UID로 실행**됩니다. 실행자의 UID가 아닙니다.

![SUID 동작 흐름 — passwd 예시](/assets/posts/linux-special-bits-suid-flow.svg)

가장 대표적인 예시가 `/usr/bin/passwd`입니다.

```bash
ls -l /usr/bin/passwd
# -rwsr-xr-x 1 root root 68208 ... /usr/bin/passwd
#    ^--- 소문자 s = SUID 설정 + 소유자 실행 권한 있음
```

일반 사용자가 자신의 비밀번호를 바꾸려면 root만 쓸 수 있는 `/etc/shadow`를 수정해야 합니다. SUID 덕분에 `passwd` 실행 중에만 root 권한을 빌려 사용할 수 있습니다.

### SUID 설정 · 제거

```bash
# SUID 설정
sudo chmod u+s myscript     # 심볼릭
sudo chmod 4755 myscript    # 숫자

# SUID 제거
sudo chmod u-s myscript

# 확인 (소문자 s: x 있음 / 대문자 S: x 없음)
ls -l myscript
# -rwSr--r-- (S = SUID 있지만 x 없음 → 효과 없음, 의심스러운 구성)
```

### SUID 보안 감사

```bash
# 시스템 전체 SUID 파일 목록
find / -perm -4000 -type f 2>/dev/null

# 일반적으로 보여야 할 파일들
# /usr/bin/passwd, /usr/bin/sudo, /usr/bin/su, /usr/bin/newgrp ...
```

예상치 못한 SUID 파일이 있으면 즉시 조사하세요.

## SGID — Set Group ID

### 파일에 설정 시

파일에 SGID가 있으면 실행 중 **파일 소유 그룹의 GID**로 동작합니다.

```bash
ls -l /usr/bin/write
# -rwxr-sr-x 1 root tty 14592 ... /usr/bin/write
#       ^--- 그룹 실행 위치의 s = SGID
```

### 디렉터리에 설정 시 — 협업 디렉터리

디렉터리에 SGID를 설정하면 **해당 디렉터리에 생성되는 모든 파일이 부모 디렉터리의 그룹을 상속**합니다.

```bash
# 공유 디렉터리 설정
sudo mkdir /srv/team
sudo chown root:devteam /srv/team
sudo chmod 2775 /srv/team   # SGID + rwxrwxr-x

# devteam 멤버가 만든 파일이 자동으로 devteam 그룹을 가짐
ls -l /srv/team/newfile
# -rw-r--r-- 1 alice devteam ... newfile
#                    ↑ 부모 그룹 상속
```

SGID 없이 공유 폴더를 만들면 각자가 만든 파일이 자신의 기본 그룹을 가져 그룹 권한이 제각각이 됩니다.

### SGID 설정 · 제거

```bash
sudo chmod g+s /srv/team    # 심볼릭
sudo chmod 2775 /srv/team   # 숫자

ls -ld /srv/team
# drwxrwsr-x  ← 그룹 실행 위치의 s
```

## Sticky Bit — 제한된 삭제

Sticky bit는 디렉터리에서만 실용적으로 쓰입니다. 설정된 디렉터리에서는 **파일을 소유자나 root만 삭제**할 수 있습니다.

가장 대표적인 예가 `/tmp`입니다.

```bash
ls -ld /tmp
# drwxrwxrwt 18 root root 4096 ... /tmp
#          ^--- t = Sticky bit (모든 사용자에게 x가 있어 소문자 t)
```

`/tmp`는 777이라 모든 사용자가 파일을 만들 수 있지만, 다른 사용자의 파일은 삭제할 수 없습니다.

```bash
# /tmp/test는 alice가 소유
# bob이 삭제 시도
rm /tmp/test
# rm: cannot remove '/tmp/test': Operation not permitted
```

### Sticky 설정 · 제거

```bash
sudo chmod +t /shared       # 심볼릭
sudo chmod 1777 /shared     # 숫자 (전통적 임시 디렉터리)

ls -ld /shared
# drwxrwxrwt  ← 마지막 t
```

## 특수 비트 조합

```bash
# SUID + SGID 동시 설정
chmod 6755 file   # 4+2=6

# Sticky + 일반 권한
chmod 1755 dir    # 1=Sticky

# 현재 특수 비트 확인
stat -c '%a %n' /tmp   # 1777
stat -c '%a %n' /usr/bin/passwd  # 4755
```

## 보안 관점 정리

| 비트 | 위험도 | 주의 포인트 |
|------|--------|-------------|
| SUID | 높음 | 취약점 발견 시 LPE 가능. 최소한으로 유지 |
| SGID (파일) | 중간 | SUID와 유사, 그룹 단위 권한 상승 |
| SGID (디렉터리) | 낮음 | 협업용, 의도적 설정 |
| Sticky | 낮음 | 공유 디렉터리 보호, 안전한 패턴 |

```bash
# 감사 명령
find / -perm -4000 -o -perm -2000 2>/dev/null | sort
# SUID(4000)와 SGID(2000) 파일 전체 목록
```

---

**지난 글:** [umask — 파일 생성 기본 권한 설정](/posts/linux-umask/)

**다음 글:** [ACL — getfacl·setfacl로 세밀한 권한 제어](/posts/linux-acl-getfacl-setfacl/)

<br>
읽어주셔서 감사합니다. 😊
