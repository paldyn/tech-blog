---
title: "chown · chgrp — 파일 소유자와 그룹 변경"
description: "chown과 chgrp 명령으로 파일 소유자와 그룹을 변경하는 방법, UID/GID 숫자 지정, 심볼릭 링크 처리, 실전 웹 서버 권한 분리 시나리오까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["linux", "chown", "chgrp", "permissions", "ownership", "security"]
featured: false
draft: false
---

[지난 글](/posts/linux-chmod-numeric-symbolic/)에서 `chmod`로 권한 비트를 바꾸는 방법을 배웠습니다. 권한 비트가 **무엇을 허용하는지**를 정의한다면, `chown`과 `chgrp`은 **누가 소유자인지**를 바꿉니다. 두 명령은 한 쌍으로 이해해야 리눅스 권한 시스템 전체가 완성됩니다.

## 소유권이란

모든 파일·디렉터리에는 두 가지 소유 정보가 있습니다.

```bash
$ ls -l file.txt
-rw-r--r-- 1 alice devteam 1024 2026-05-12 file.txt
#             ↑      ↑
#           소유자   그룹
```

- **소유자(Owner, UID)**: 파일을 만든 사용자. 소유자 권한 비트(첫 세 자리)가 적용됩니다.
- **그룹(Group, GID)**: 파일이 속한 그룹. 그룹 권한 비트(가운데 세 자리)가 적용됩니다.

![chown · chgrp 문법과 소유권 모델](/assets/posts/linux-chown-chgrp-syntax.svg)

## chown 사용법

`chown`은 소유자(또는 소유자+그룹)를 변경합니다. **root 권한이 필요**합니다.

```bash
# 소유자만 변경
sudo chown alice file.txt

# 소유자 + 그룹 동시 변경 (콜론 구분)
sudo chown alice:devteam file.txt

# 그룹만 변경 (소유자 생략, 콜론 앞을 비움)
sudo chown :devteam file.txt

# UID/GID 숫자로도 지정 가능
sudo chown 1000:1001 file.txt
```

## chgrp 사용법

`chgrp`은 그룹만 변경합니다. 비-root 사용자도 자신이 속한 그룹으로는 변경할 수 있습니다.

```bash
# 그룹 변경
chgrp devteam file.txt

# 재귀 적용
chgrp -R webteam /var/www/

# 숫자 GID 사용
chgrp 1001 file.txt
```

## 재귀 적용 (-R)

디렉터리 전체 소유권을 바꿀 때는 `-R`을 사용합니다.

```bash
sudo chown -R alice:devteam /home/alice/project/
```

## 심볼릭 링크 처리

기본적으로 `chown -R`은 심볼릭 링크가 가리키는 실제 파일(target)이 아닌 링크 자체를 변경합니다. 링크 대상을 바꾸려면 `-h`(또는 `--no-dereference`)를 명시합니다.

```bash
# 링크 자체의 소유자 변경
sudo chown -h alice symlink

# 재귀 적용 시 링크 대상 변경
sudo chown -R --dereference alice:devteam /path/
```

## 참조 파일로 소유권 복사

```bash
# ref_file과 동일한 소유권으로 target_file 변경
sudo chown --reference=ref_file target_file
```

## 실전: 웹 서버 권한 분리

운영 서버에서 가장 흔한 실수는 웹 루트 파일 전체를 `root:root 777`로 설정하는 것입니다. 올바른 구성은 배포 계정을 소유자로, 웹 서버 프로세스 계정을 그룹으로 분리하는 패턴입니다.

![웹 서버 배포 소유권 구성](/assets/posts/linux-chown-chgrp-webserver.svg)

```bash
# Nginx/Apache가 www-data로 실행된다고 가정
# deploy 계정이 배포 담당

sudo chown -R deploy:www-data /var/www/html

# 파일: 소유자 읽기/쓰기, 그룹 읽기, 기타 없음
find /var/www/html -type f -exec chmod 640 {} +

# 디렉터리: 소유자 전체, 그룹 읽기/실행, 기타 없음
find /var/www/html -type d -exec chmod 750 {} +
```

이 구성에서:
- `deploy` 계정만 파일 수정 가능
- 웹 서버(`www-data`)는 읽기만 가능
- 외부에서 접근 불가

## 소유자 변경이 불가능한 경우

일반 사용자는 **자신이 소유한 파일의 소유권을 다른 사람에게 줄 수 없습니다.** 이는 의도적인 보안 설계입니다(다른 계정을 사칭하거나 디스크 쿼터를 우회하는 수단이 될 수 있기 때문).

```bash
# alice가 root에게 소유권 이전 시도 → 실패
alice@host:~$ chown root myfile
chown: changing ownership of 'myfile': Operation not permitted
```

소유권 이전은 root만 할 수 있습니다.

---

**지난 글:** [chmod — 숫자·심볼릭으로 권한 바꾸기](/posts/linux-chmod-numeric-symbolic/)

**다음 글:** [umask — 기본 파일 권한 설정](/posts/linux-umask/)

<br>
읽어주셔서 감사합니다. 😊
