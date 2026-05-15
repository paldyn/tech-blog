---
title: "리눅스 파일 권한 — rwx 완전 이해"
description: "ls -l이 출력하는 10자리 권한 문자열의 구조, 파일과 디렉터리에서 r/w/x가 갖는 서로 다른 의미, 숫자 표기(8진수)와 심볼릭 표기를 체계적으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 3
type: "knowledge"
category: "Linux"
tags: ["linux", "permissions", "rwx", "chmod", "security", "file-system"]
featured: false
draft: false
---

[지난 글](/posts/linux-zfs-btrfs/)에서 ZFS와 Btrfs를 살펴봤습니다. 이번에는 리눅스 보안의 가장 기본인 **파일 권한(Permission)** 시스템을 다룹니다. 처음 배울 때 헷갈리지만, 원리를 한 번 이해하면 이후 `chmod`, `chown`, `umask`, ACL까지 모든 권한 관련 개념이 자연스럽게 연결됩니다.

## ls -l 출력 읽기

```bash
$ ls -l /usr/bin/passwd
-rwsr-xr-x 1 root root 68208 2026-01-15 /usr/bin/passwd
```

첫 번째 필드의 10자리 문자열이 핵심입니다.

![리눅스 권한 비트 해부](/assets/posts/linux-permissions-rwx-anatomy.svg)

| 위치 | 내용 | 설명 |
|------|------|------|
| 1번째 | `d`, `-`, `l` 등 | 파일 유형 |
| 2~4번째 | `rwx` | 소유자(Owner) 권한 |
| 5~7번째 | `r-x` | 그룹(Group) 권한 |
| 8~10번째 | `r-x` | 기타(Others) 권한 |

## 파일 유형 비트

```bash
$ ls -l /dev/sda /tmp/pipe /var/run/docker.sock
brw-rw---- root disk  /dev/sda         ← b: 블록 장치
prw-r--r-- alice alice /tmp/pipe        ← p: Named pipe
srw-rw---- root docker /var/run/docker.sock  ← s: 소켓
```

가장 자주 보이는 유형:

- `-`: 일반 파일 (텍스트, 바이너리, 스크립트 등)
- `d`: 디렉터리
- `l`: 심볼릭 링크

## r, w, x 의 의미

![디렉터리 권한과 파일 권한의 차이](/assets/posts/linux-permissions-rwx-directory.svg)

**파일**에서:

| 비트 | 숫자 | 의미 |
|------|------|------|
| r | 4 | 파일 내용을 읽을 수 있다 |
| w | 2 | 파일 내용을 수정할 수 있다 |
| x | 1 | 파일을 프로그램으로 실행할 수 있다 |

**디렉터리**에서 의미가 달라집니다:

| 비트 | 의미 |
|------|------|
| r | 디렉터리 안의 파일 목록을 볼 수 있다 (`ls`) |
| w | 디렉터리 안에서 파일을 만들고 지울 수 있다 |
| x | 디렉터리에 진입하거나 경로로 통과할 수 있다 (`cd`) |

> 디렉터리에서 `x`(실행)는 가장 중요한 권한입니다. `x` 없이 `r`만 있으면 파일 이름은 볼 수 있지만 파일을 열거나 경로를 통과할 수 없습니다.

## 8진수 숫자 표기

권한의 각 그룹(소유자·그룹·기타)은 세 비트(r=4, w=2, x=1)의 합으로 표현합니다.

```
rwx = 4+2+1 = 7
rw- = 4+2+0 = 6
r-x = 4+0+1 = 5
r-- = 4+0+0 = 4
--- = 0+0+0 = 0
```

자주 쓰는 숫자 조합:

```bash
755  → rwxr-xr-x  (일반 실행 파일, 디렉터리)
644  → rw-r--r--  (일반 설정 파일, 소스 파일)
600  → rw-------  (개인 키, 비밀 파일)
700  → rwx------  (개인 디렉터리, 스크립트)
664  → rw-rw-r--  (그룹 협업 파일)
```

## 심볼릭 표기 읽기

`ls -l` 출력은 `-rwxr-xr-x`처럼 심볼릭 형식으로 표시됩니다. 이를 직접 해석하는 연습을 해봅니다.

```bash
$ ls -l /etc/shadow
-rw-r----- 1 root shadow 1234 2026-05-01 /etc/shadow
```

해석:
- `-`: 일반 파일
- `rw-`: 소유자(root) → 읽기·쓰기 가능
- `r--`: 그룹(shadow) → 읽기만 가능
- `---`: 기타 → 아무 권한 없음

숫자로: `640`

## 권한 확인 실습

```bash
# 현재 디렉터리 전체 권한 확인
ls -la

# 특정 파일만
ls -l /etc/passwd

# 숫자(8진수)로 보기
stat -c '%a %n' /etc/passwd
# 출력: 644 /etc/passwd
```

## 권한이 적용되는 순서

리눅스 커널은 파일에 접근할 때 세 그룹을 **순서대로** 확인합니다.

1. 프로세스의 UID == 파일 소유자 UID → **소유자 권한** 적용
2. 프로세스의 GID가 파일 그룹과 일치 → **그룹 권한** 적용
3. 위 모두 해당 없음 → **기타 권한** 적용

중요: **소유자이면 그룹 권한은 보지 않습니다.** 소유자 권한이 `---`이고 그룹 권한이 `rwx`여도, 소유자 본인이 접근하면 차단됩니다(드물지만 실수로 이런 상황이 생깁니다).

---

**지난 글:** [ZFS·Btrfs — Copy-on-Write 파일시스템 완전 정복](/posts/linux-zfs-btrfs/)

**다음 글:** [chmod — 숫자·심볼릭으로 권한 바꾸기](/posts/linux-chmod-numeric-symbolic/)

<br>
읽어주셔서 감사합니다. 😊
