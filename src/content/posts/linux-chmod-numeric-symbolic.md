---
title: "chmod — 숫자·심볼릭으로 권한 바꾸기"
description: "chmod의 8진수(숫자) 모드와 심볼릭 모드를 완전히 이해하고, 재귀 적용(-R), X 플래그, 참조 복사(--reference) 등 실무에서 자주 쓰는 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["linux", "chmod", "permissions", "security", "file-system"]
featured: false
draft: false
---

[지난 글](/posts/linux-permissions-rwx/)에서 리눅스 권한 시스템의 구조를 살펴봤습니다. 이번에는 실제로 권한을 바꾸는 `chmod` 명령을 두 가지 모드 — **숫자(8진수)** 와 **심볼릭** — 로 완전히 익혀봅니다.

## chmod 기본 문법

```bash
chmod [옵션] MODE 파일...
```

MODE는 숫자 또는 심볼릭 표현식 중 하나를 씁니다.

## 숫자(8진수) 모드

각 그룹(소유자·그룹·기타)의 권한을 숫자 합계로 표현합니다.

```
r = 4,  w = 2,  x = 1
```

![chmod 8진수 변환표](/assets/posts/linux-chmod-octal-chart.svg)

자주 쓰는 패턴:

```bash
chmod 755 script.sh    # rwxr-xr-x  (공개 실행 파일)
chmod 644 readme.txt   # rw-r--r--  (공개 읽기 파일)
chmod 600 id_rsa       # rw-------  (개인 키)
chmod 700 ~/.ssh       # rwx------  (개인 디렉터리)
chmod 664 shared.txt   # rw-rw-r--  (그룹 협업)
chmod 000 lockfile     # ---------- (모든 접근 차단)
```

## 심볼릭 모드

대상·연산자·권한을 조합하는 표현식을 씁니다.

![chmod 심볼릭 모드 문법](/assets/posts/linux-chmod-symbolic-syntax.svg)

기본 형식: `[ugo a][+−=][rwxX]`

```bash
# 소유자에게 실행 권한 추가
chmod u+x deploy.sh

# 그룹과 기타에서 쓰기 제거
chmod go-w config.yaml

# 기타 권한을 읽기 전용으로 지정 (기존 기타 권한 무시)
chmod o=r report.pdf

# 여러 변경을 쉼표로 연결
chmod u+x,go-w script.sh
```

### X 플래그 — 안전한 재귀 실행 권한

소문자 `x`는 모든 파일에 실행 권한을 부여합니다. 대문자 `X`는 **이미 실행 권한이 있거나 디렉터리인 경우에만** 적용합니다.

```bash
# 잘못된 방법: 일반 파일에도 실행 권한이 붙음
chmod -R a+x /var/www/html

# 올바른 방법: 디렉터리만 x, 파일은 기존 상태 유지
chmod -R a+X /var/www/html
```

## 재귀 적용 (-R)

```bash
# 디렉터리 전체에 755 적용
chmod -R 755 /var/www/html

# 파일은 644, 디렉터리는 755로 각각 설정
find /var/www/html -type f -exec chmod 644 {} +
find /var/www/html -type d -exec chmod 755 {} +
```

`-R` 단독 사용 시 파일과 디렉터리에 동일한 권한이 적용됩니다. 파일에 `755`를 주면 실행 권한까지 붙으므로, 위 `find` 조합이 더 안전합니다.

## 권한 참조 복사 (--reference)

다른 파일의 권한을 그대로 복사합니다.

```bash
# reference.sh 권한을 target.sh에 복사
chmod --reference=reference.sh target.sh
```

## 숫자 모드 vs 심볼릭 모드 — 언제 무엇을?

| 상황 | 추천 |
|------|------|
| 절대적 권한 지정 | 숫자 (`chmod 644`) |
| 특정 비트만 추가·제거 | 심볼릭 (`chmod u+x`) |
| 스크립트에서 명확성 중요 | 숫자 |
| 현재 권한을 보존하면서 수정 | 심볼릭 |

## 실수 방지 팁

**777은 대부분 잘못된 선택입니다.** 웹 파일에 `chmod 777`을 적용하면 누구나 쓰고 실행할 수 있어 보안 취약점이 됩니다. `644`(파일)와 `755`(디렉터리)가 기본입니다.

```bash
# 현재 권한 확인 후 수정
stat -c '%a %n' myfile   # 숫자로 권한 확인
ls -l myfile             # 심볼릭으로 확인
```

**SSH 키 권한**: `~/.ssh/id_rsa`는 반드시 `600`이어야 합니다. SSH 클라이언트는 권한이 너무 넓으면 키 사용을 거부합니다.

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_rsa
chmod 644 ~/.ssh/id_rsa.pub
chmod 600 ~/.ssh/authorized_keys
```

---

**지난 글:** [리눅스 파일 권한 — rwx 완전 이해](/posts/linux-permissions-rwx/)

**다음 글:** [chown·chgrp — 소유자와 그룹 변경](/posts/linux-chown-chgrp/)

<br>
읽어주셔서 감사합니다. 😊
