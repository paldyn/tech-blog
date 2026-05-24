---
title: "심볼릭 링크의 함정 — 깨진 링크와 순환 참조 피하기"
description: "심볼릭 링크의 dangling link, circular symlink, 상대 경로 함정, 권한 오해를 사례로 살펴보고 readlink·ln -snf·find로 안전하게 관리하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["linux", "symlink", "symbolic-link", "filesystem", "ln", "readlink", "find"]
featured: false
draft: false
---

[지난 글](/posts/linux-quota/)에서 디스크 쿼터로 저장 공간을 제한하는 방법을 알아봤습니다. 이번에는 **심볼릭 링크(Symbolic Link, Symlink)**를 잘못 다뤘을 때 발생하는 함정들을 짚어 봅니다. 링크는 강력하지만, 의도치 않게 깨지거나 순환 참조를 만들어 시스템을 혼란에 빠뜨릴 수 있습니다.

## 심볼릭 링크란

심볼릭 링크는 다른 파일이나 디렉터리의 **경로를 담고 있는 특수 파일**입니다. 하드 링크와 달리 다른 파일시스템을 가리킬 수 있고, 디렉터리도 가리킬 수 있습니다.

```bash
# 기본 생성: ln -s 대상 링크이름
ln -s /etc/nginx/nginx.conf ./nginx.conf

# 링크 확인
ls -la nginx.conf
# lrwxrwxrwx 1 user user 22 May 25 nginx.conf -> /etc/nginx/nginx.conf
```

## 네 가지 주요 함정

![심볼릭 링크 함정 유형](/assets/posts/linux-symlink-pitfalls-types.svg)

### 1. 깨진 링크 (Dangling Symlink)

가장 흔한 함정입니다. 링크는 존재하는데 **대상 파일이 삭제·이동된 경우** 발생합니다.

```bash
# 원본 파일 삭제 후 링크만 남음
rm target.txt
cat link.txt
# cat: link.txt: No such file or directory

# 깨진 링크는 ls에서 빨간색으로 표시됨
ls -la link.txt  # lrwxrwxrwx ... link.txt -> target.txt (dangling)
```

특히 패키지 업그레이드 후 이전 버전의 라이브러리를 가리키는 링크가 남아 있을 때 자주 발생합니다.

### 2. 순환 링크 (Circular Symlink)

`a → b → a` 형태로 서로를 가리키면 커널이 루프를 감지해 `ELOOP: Too many levels of symbolic links` 에러를 냅니다. 실수로 디렉터리를 자기 자신 안에 링크할 때도 발생합니다.

```bash
ln -s b a
ln -s a b
cat a  # ELOOP error

# 중첩 링크 최대 40단계 (Linux 커널 기본값)
```

### 3. 이동 후 깨지는 상대 경로

상대 경로로 링크를 만든 뒤 **링크 파일을 다른 디렉터리로 이동**하면 상대 경로의 기준점이 바뀌어 깨집니다.

```bash
# /app/bin/ 디렉터리에서 생성
cd /app/bin
ln -s ../lib/run.sh run    # 상대 경로

# 링크를 /tools/bin/으로 이동하면
mv /app/bin/run /tools/bin/run
# /tools/bin/run → ../lib/run.sh → /tools/lib/run.sh (존재하지 않음!)
```

배포 스크립트에서 링크를 생성할 때 상대 경로를 쓰면 실행 위치에 따라 동작이 달라질 수 있습니다.

### 4. 권한 오해

심볼릭 링크 자체의 권한은 항상 `lrwxrwxrwx` (777)입니다. 실제 접근 권한은 **대상 파일의 권한**을 따릅니다. 링크에 `chmod`를 적용해도 대상 파일의 권한이 바뀝니다.

```bash
# 링크 자체 권한 변경은 무시됨 (대상에 적용됨)
chmod 600 link.txt  # 실제로는 target.txt가 600으로 변경됨

# 링크를 따라가지 않고 링크 자체 정보 보기
lstat link.txt  # stat의 no-follow 버전
```

## 안전한 사용 패턴

![심볼릭 링크 안전 패턴](/assets/posts/linux-symlink-pitfalls-bestpractice.svg)

### 원자적 링크 교체

배포 시 `rm` 후 `ln` 두 단계로 나누면 짧은 순간 링크가 없는 상태가 됩니다. `ln -snf`를 쓰면 단일 시스템 콜로 원자적으로 교체합니다.

```bash
# 안전: 원자적 교체 (-s symlink, -n 디렉터리 안에 생성 안 함, -f 덮어쓰기)
ln -snf /app/releases/v2.1 /app/current

# 위험: 짧은 순간 링크 부재
rm /app/current && ln -s /app/releases/v2.1 /app/current
```

### 링크 대상 확인

```bash
# 링크가 직접 가리키는 경로 (1단계만)
readlink /app/current

# 모든 링크를 해소한 최종 실제 경로
readlink -f /app/current
realpath /app/current

# 링크 존재 여부 테스트 (깨진 링크는 -e가 false)
[ -L /app/current ] && [ -e /app/current ] && echo "valid" || echo "broken"
```

### 깨진 링크 일괄 관리

```bash
# 깨진 심볼릭 링크 찾기
find /app -type l ! -e

# 정보와 함께 출력
find /app -type l ! -e -printf '%p -> %l\n'

# 일괄 삭제 (신중하게)
find /app -type l ! -e -delete
```

### 링크 체인 구조 확인

```bash
# 링크 계층 구조 추적
namei -l /app/current/bin/server

# 출력 예시:
# f: /app/current/bin/server
#  d /
#  d app
#  l current -> releases/v2.1
#  d releases
#  d v2.1
#  d bin
#  - server
```

## CI/CD 체크에 포함하기

배포 파이프라인에서 깨진 링크를 자동으로 검사하면 운영 장애를 예방할 수 있습니다.

```bash
#!/bin/bash
# 깨진 링크 검사 스크립트
broken=$(find /app -type l ! -e)
if [ -n "$broken" ]; then
    echo "BROKEN SYMLINKS FOUND:"
    echo "$broken"
    exit 1
fi
echo "All symlinks are valid."
```

---

**지난 글:** [디스크 쿼터 — 사용자·그룹별 저장 공간 제한하기](/posts/linux-quota/)

**다음 글:** [tmpfs·procfs·sysfs — 메모리와 커널이 만드는 가상 파일시스템](/posts/linux-tmpfs-procfs-sysfs/)

<br>
읽어주셔서 감사합니다. 😊
