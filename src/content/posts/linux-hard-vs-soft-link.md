---
title: "하드 링크 vs 심볼릭 링크: 연결의 두 가지 방식"
description: "하드 링크와 심볼릭 링크의 inode 수준 차이를 이해하고, ln 명령어로 링크를 생성·관리하며 댕글링 링크 문제를 다루는 방법을 익힌다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["Linux", "하드링크", "심볼릭링크", "ln", "inode", "파일시스템"]
featured: false
draft: false
---

[지난 글](/posts/linux-inode-essence/)에서 inode 구조를 살펴봤다. 이번에는 inode 개념을 기반으로 **하드 링크**와 **심볼릭 링크(소프트 링크)**의 차이를 파헤친다. 둘 다 `ln` 명령으로 만들지만 동작 방식이 완전히 다르다. 잘못 사용하면 원본 삭제 후 파일이 사라지거나, 파일시스템 경계에서 동작하지 않는 문제가 생긴다.

## 하드 링크 — 같은 inode를 가리키는 또 다른 이름

```bash
ln original.txt hardlink.txt    # 하드 링크 생성
ls -li original.txt hardlink.txt
# 42381 -rw-r--r-- 2 user user 2048 hardlink.txt
# 42381 -rw-r--r-- 2 user user 2048 original.txt
```

하드 링크는 **동일한 inode 번호**를 가진다. `original.txt`와 `hardlink.txt`는 완전히 동등한 이름이다. 어느 쪽을 수정해도 같은 데이터를 변경하며, 어느 쪽을 삭제해도 inode의 링크 수가 1 감소할 뿐 나머지 이름을 통해 데이터에 계속 접근할 수 있다.

inode의 링크 수가 0이 됐을 때만 실제 데이터가 해제된다.

## 심볼릭 링크 — 경로 문자열을 저장하는 별도 파일

```bash
ln -s /path/to/original.txt symlink.txt    # 심볼릭 링크 생성
ls -li symlink.txt original.txt
# 99999 lrwxrwxrwx 1 user user 20 symlink.txt -> /path/to/original.txt
# 42381 -rw-r--r-- 1 user user 2048 original.txt
```

심볼릭 링크는 **자체 inode**(#99999)를 가지며, 그 데이터로 대상 경로 문자열을 저장한다. `ls -l`에서 `l`로 시작하고 `→ 경로`가 표시된다. 원본 파일이 삭제되면 심볼릭 링크는 존재하지 않는 경로를 가리키는 **댕글링 링크(dangling link)**가 된다.

![하드 링크 vs 심볼릭 링크](/assets/posts/linux-hard-vs-soft-link-concept.svg)

## 링크 생성 실전

```bash
# 하드 링크 — 동일 파일시스템, 파일만 가능
ln file.txt file_hard.txt

# 심볼릭 링크 — 절대 경로 권장
ln -s /etc/nginx/nginx.conf ~/nginx.conf

# 디렉터리 심볼릭 링크
ln -s /var/log/nginx ~/nginx-logs

# 심볼릭 링크 덮어쓰기 (-f)
ln -sf /new/target link.txt

# 여러 파일을 디렉터리에 한 번에 링크
ln -s /path/a /path/b /dest/dir/
```

## 비교 요약

![링크 생성 & 비교 표](/assets/posts/linux-hard-vs-soft-link-comparison.svg)

## 댕글링 링크 탐지

```bash
# 깨진 심볼릭 링크 찾기
find . -type l ! -exec test -e {} \; -print

# -L: 링크가 가리키는 파일의 실제 존재 여부
ls -L symlink.txt      # 오류 없으면 링크가 유효
```

## 실전 활용 패턴

```bash
# 버전 관리 — 현재 버전을 가리키는 심볼릭 링크
ln -s /opt/app-2.1.0 /opt/app-current
# 업그레이드 시: ln -sfn /opt/app-2.2.0 /opt/app-current

# 설정 파일 중앙화
ln -s /shared/config/app.conf /etc/app/app.conf

# 하드 링크로 백업 (스냅샷과 유사)
cp -al /home/user/data /backup/data-snapshot
# cp -al: 파일을 하드 링크로 복사 → 변경 전까지 추가 공간 0
```

`cp -al`은 수정하기 전까지 원본과 디스크 공간을 공유하는 증분 백업 방식으로, rsnapshot 같은 도구가 이 원리를 사용한다.

## readlink — 링크 대상 확인

```bash
readlink symlink.txt           # 저장된 경로 출력
readlink -f symlink.txt        # 최종 절대 경로 (모든 링크 해석)
readlink -e symlink.txt        # 최종 경로 + 존재 여부 확인
```

스크립트에서 실행 중인 파일의 실제 경로를 얻을 때도 `readlink -f "$0"`을 자주 쓴다.

---

**지난 글:** [inode 완전 해부: 파일 시스템의 심장](/posts/linux-inode-essence/)

**다음 글:** [리눅스 파일 유형 7가지: - d l c b p s](/posts/linux-file-types/)

<br>
읽어주셔서 감사합니다. 😊
