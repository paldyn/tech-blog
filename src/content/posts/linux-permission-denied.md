---
title: "Permission Denied — 권한 거부 트러블슈팅"
description: "파일 접근, 명령 실행, 디렉터리 이동 시 발생하는 Permission Denied 에러를 ls -la, id, getfacl, SELinux/AppArmor 순으로 계층별 진단하는 방법과 chmod·chown·setfacl 조치를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 3
type: "knowledge"
category: "Linux"
tags: ["linux", "permissions", "troubleshooting", "chmod", "chown", "SELinux", "ACL"]
featured: false
draft: false
---

[지난 글](/posts/linux-dns-resolution-fail/)에서 DNS 해석 실패를 계층별로 좁히는 방법을 살펴봤다. 이번에는 리눅스 운영 중 가장 자주 마주치는 에러 중 하나인 "Permission Denied"를 다룬다. 이 에러는 단순해 보이지만 유닉스 권한 비트, ACL, SELinux/AppArmor, 파일 속성까지 여러 계층이 관여하기 때문에 원인 파악 없이 `chmod 777`만 남발하면 보안 구멍이 생긴다.

## Permission Denied 발생 구조

커널은 파일 접근 시 다음 순서로 허가 여부를 결정한다.

1. **유닉스 권한 비트** (rwx) — 소유자 → 그룹 → 기타 순으로 비교
2. **POSIX ACL** — `getfacl`로 확인 가능한 확장 권한
3. **LSM (Linux Security Module)** — SELinux 또는 AppArmor
4. **파일 속성** — `chattr`로 설정된 immutable 플래그 등

한 단계라도 거부(deny)하면 최종 결과는 EACCES(Permission Denied)다.

![Permission Denied 트러블슈팅 흐름](/assets/posts/linux-permission-denied-flow.svg)

## 1단계 — 파일 권한 비트 확인

```bash
ls -la /path/to/file
# 예: -rw-r--r-- 1 root root 1024 May 29 file.txt
stat /path/to/file
```

출력에서 읽어야 할 세 가지:
- **소유자** (`root`)와 **그룹** (`root`)
- **권한 비트** (`-rw-r--r--`) — 소유자는 rw, 그룹/기타는 r 전용
- **특수 비트** — `s`(SUID/SGID), `t`(sticky) 포함 여부

파일을 읽어야 하는데 기타(other) 권한이 `---`이고 나는 소유자도 그룹도 아니라면, `chmod o+r file` 또는 chown으로 소유자 변경이 필요하다.

```bash
# 소유자에게 실행 권한 추가
chmod u+x script.sh

# 그룹 쓰기 허용
chmod g+w file.txt

# 숫자 표기 (rw-r--r--)
chmod 644 file.txt
```

## 2단계 — 현재 사용자 확인

```bash
id
# uid=1001(alice) gid=1001(alice) groups=1001(alice),4(adm),27(sudo)
```

파일 소유자와 현재 사용자가 다르고, 그룹도 일치하지 않으면 "기타" 권한이 적용된다. 그룹을 일치시키거나 소유자를 바꾼다.

```bash
# 소유자 변경
sudo chown alice:alice /path/to/file

# 사용자를 그룹에 추가 (다음 로그인부터 적용)
sudo usermod -aG developers alice

# 즉시 그룹 반영
newgrp developers
```

![권한 진단 핵심 명령어](/assets/posts/linux-permission-denied-commands.svg)

## 3단계 — ACL 확인

유닉스 권한 비트가 허용처럼 보여도 ACL에서 명시적으로 거부할 수 있다.

```bash
getfacl /path/to/file
# output: user::rw-
#         user:bob:---   (bob에 명시적 거부)
#         group::r--
#         other::---
```

ACL 수정:

```bash
# 특정 사용자에 rw 권한 추가
setfacl -m u:alice:rw /path/to/file

# 특정 사용자 ACL 제거
setfacl -x u:bob /path/to/file

# 기본 ACL 제거 (파일 기본으로 복구)
setfacl -b /path/to/file
```

## 4단계 — SELinux 확인 (RHEL 계열)

```bash
getenforce         # Enforcing / Permissive / Disabled
ls -Z /path/to/file   # SELinux 컨텍스트 확인
ausearch -m avc --since recent   # 최근 차단 로그
```

SELinux가 차단하는 경우 audit 로그에 `avc: denied` 메시지가 남는다.

```bash
# 컨텍스트 복구 (기본값으로)
sudo restorecon -Rv /path/to/file

# 수동 컨텍스트 설정
sudo chcon -t httpd_sys_content_t /var/www/html/index.html
```

## 5단계 — 파일 immutable 속성

chmod가 먹히지 않고, root도 접근 불가라면 immutable 속성을 확인한다.

```bash
lsattr /path/to/file
# ----i--------e-- file.txt  ← i 플래그: 수정 불가
```

```bash
sudo chattr -i /path/to/file    # immutable 해제
sudo chattr -a /path/to/file    # append-only 해제
```

## 자주 발생하는 패턴 요약

| 증상 | 원인 | 조치 |
|------|------|------|
| `ls -la` 권한 없음 | 유닉스 비트 부족 | chmod / chown |
| 비트 있지만 접근 불가 | ACL 거부 항목 | setfacl -m |
| root도 안 됨 | immutable 속성 | chattr -i |
| Enforcing SELinux | 컨텍스트 불일치 | restorecon / chcon |
| 디렉터리 traverse 불가 | 부모 디렉터리 x 없음 | chmod a+x dir |

디렉터리 내 파일 접근에는 디렉터리 자체에 **실행(x) 권한**이 필요하다는 점을 자주 놓친다. `ls` 권한(r)과 `cd` 권한(x)은 별개다.

```bash
# 디렉터리 실행 권한 확인
ls -ld /path/to/directory
chmod a+x /path/to/directory   # traverse 허용
```

권한 문제 해결의 핵심은 `chmod 777` 같은 광범위한 조치보다 최소 필요 권한만 부여하는 것이다. `ls -la → id → getfacl → SELinux` 순서로 좁혀가면 대부분 정확한 원인을 찾을 수 있다.

---

**지난 글:** [DNS 이름 해석 실패 트러블슈팅](/posts/linux-dns-resolution-fail/)

**다음 글:** [Segmentation Fault 조사 — 세그멘테이션 폴트 원인 분석](/posts/linux-segfault-investigation/)

<br>
읽어주셔서 감사합니다. 😊
