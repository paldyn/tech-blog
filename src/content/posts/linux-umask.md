---
title: "umask — 파일 생성 기본 권한 제어"
description: "umask가 파일과 디렉터리의 기본 권한을 결정하는 원리, 8진수 계산법, 환경별 권장 umask 값, 영구 설정 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["linux", "umask", "permissions", "security", "file-system"]
featured: false
draft: false
---

[지난 글](/posts/linux-chown-chgrp/)에서 `chown`과 `chgrp`으로 파일 소유권을 바꾸는 법을 배웠습니다. 이번에는 파일을 **처음 만들 때** 어떤 권한이 붙는지를 결정하는 `umask`를 다룹니다. `chmod`가 이미 있는 권한을 바꾼다면, `umask`는 새 파일에 처음부터 어떤 권한을 부여할지 설정합니다.

## umask란

`umask`(user file creation mode mask)는 새로 생성되는 파일이나 디렉터리에서 **제거할 권한 비트**를 정의하는 마스크값입니다.

직관적으로: `umask 022`는 "새 파일·디렉터리에서 그룹과 기타의 쓰기 권한을 제거하라"는 뜻입니다.

```bash
# 현재 umask 확인
umask          # 숫자: 0022
umask -S       # 심볼릭: u=rwx,g=rx,o=rx
```

## 계산 원리

파일시스템이 새 파일을 만들 때 기본 최대 권한을 가정합니다.

- 일반 파일: **666** (rw-rw-rw-) — 기본적으로 실행 권한은 없음
- 디렉터리: **777** (rwxrwxrwx)

여기서 umask에 지정된 비트를 제거(AND NOT)한 값이 실제 권한이 됩니다.

![umask 계산 원리](/assets/posts/linux-umask-calculation.svg)

### 예시: umask 022

```
파일:     666 - 022 = 644  (rw-r--r--)
디렉터리: 777 - 022 = 755  (rwxr-xr-x)
```

### 예시: umask 027

```
파일:     666 - 027 = 640  (rw-r-----)
디렉터리: 777 - 027 = 750  (rwxr-x---)
```

## 실습으로 확인

```bash
# umask 확인
umask
# 0022

# 파일 생성 후 권한 확인
touch testfile
ls -l testfile
# -rw-r--r-- 1 user user 0 ... testfile

# 디렉터리 생성 후 권한 확인
mkdir testdir
ls -ld testdir
# drwxr-xr-x 2 user user 4096 ... testdir/

# umask 변경 후 테스트
umask 077
touch privatefile
ls -l privatefile
# -rw------- 1 user user 0 ... privatefile
```

## 자주 쓰는 umask 값

![umask 값별 결과와 용도](/assets/posts/linux-umask-common-values.svg)

| umask | 파일 | 디렉터리 | 용도 |
|-------|------|----------|------|
| 022 | 644 | 755 | 일반 사용자 (기본값) |
| 027 | 640 | 750 | 서버·공유 환경 |
| 077 | 600 | 700 | root, 개인 비밀 파일 |
| 002 | 664 | 775 | 그룹 협업 |

## umask 영구 설정

현재 셸에서 `umask 027`을 입력하면 해당 세션에만 적용됩니다. 영구 설정은 셸 초기화 파일을 사용합니다.

```bash
# 특정 사용자 (Bash)
echo 'umask 027' >> ~/.bashrc
source ~/.bashrc

# 시스템 전역 (모든 사용자)
# /etc/profile 또는 /etc/profile.d/custom-umask.sh
echo 'umask 027' | sudo tee /etc/profile.d/custom-umask.sh
```

로그인 기본값은 `/etc/login.defs`의 `UMASK` 항목으로도 설정할 수 있습니다.

```bash
grep UMASK /etc/login.defs
# UMASK           022
```

## PAM과 umask

일부 배포판에서는 `pam_umask` 모듈이 `/etc/login.defs`의 값을 반영합니다. SSH 로그인이나 su 전환 후 umask가 예상과 다를 때 이 모듈을 확인하세요.

```bash
# PAM umask 확인
grep umask /etc/pam.d/common-session
# session optional pam_umask.so
```

## 서비스 프로세스의 umask

서비스 데몬은 보통 `/etc/init.d/` 스크립트나 systemd 유닛 파일에서 umask를 설정합니다.

```bash
# systemd 유닛에 umask 설정
# /etc/systemd/system/myapp.service
[Service]
UMask=0027
```

웹 서버, DB 서버 등의 생성 파일이 예상보다 넓은 권한을 가진다면 서비스 umask를 확인하세요.

---

**지난 글:** [chown·chgrp — 파일 소유자와 그룹 변경](/posts/linux-chown-chgrp/)

**다음 글:** [SUID·SGID·Sticky 비트 — 특수 권한 완전 정복](/posts/linux-special-bits-suid-sgid-sticky/)

<br>
읽어주셔서 감사합니다. 😊
