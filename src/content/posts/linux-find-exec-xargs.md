---
title: "find -exec & xargs: 찾은 파일에 명령 실행하기"
description: "find의 -exec, -execdir 옵션과 xargs를 활용해 검색 결과에 일괄 명령을 수행하는 강력한 패턴을 익힌다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["Linux", "find", "exec", "xargs", "일괄처리", "자동화"]
featured: false
draft: false
---

[지난 글](/posts/linux-find-basics/)에서 `find`로 파일을 찾는 다양한 조건을 배웠다. 이번 글에서는 찾은 파일에 명령을 실행하는 **`-exec` 옵션과 `xargs`**를 다룬다. 이 두 가지를 자유롭게 다루면 반복적인 파일 일괄 처리 작업을 한 줄로 자동화할 수 있다.

## -exec: 찾은 파일에 명령 실행

`find`의 `-exec` 옵션은 찾은 각 파일에 대해 지정한 명령을 실행한다. `{}`는 현재 파일 경로로 치환되는 자리표시자이고, `\;`은 명령의 끝을 나타낸다.

```bash
# 기본 구조
find [조건] -exec 명령 {} \;

# .tmp 파일 모두 삭제
find . -name '*.tmp' -exec rm {} \;

# 모든 .py 파일에 pylint 실행
find . -name '*.py' -exec pylint {} \;

# 30일 이전 로그 파일 gzip 압축
find /var/log -name '*.log' -mtime +30 -exec gzip {} \;
```

`\;` 대신 `+`를 쓰면 모든 파일을 묶어 한 번만 실행한다.

```bash
# \; : 파일마다 한 번씩 실행 (N 파일 → N번 fork)
find . -name '*.c' -exec wc -l {} \;

# + : 파일을 묶어 한 번 실행 (훨씬 빠름)
find . -name '*.c' -exec wc -l {} +
```

`+`를 사용하면 내부적으로 `xargs`와 비슷하게 동작해 대용량 디렉터리에서 속도 차이가 크다.

![find -exec 동작 원리](/assets/posts/linux-find-exec-xargs-exec.svg)

## -execdir: 파일 위치에서 실행

`-exec` 대신 `-execdir`를 쓰면 찾은 파일이 있는 **디렉터리에서** 명령을 실행한다. 보안상 더 안전한 방식이다.

```bash
# -exec: 현재 작업 디렉터리에서 ./logs/err.log 처리
find . -name '*.log' -exec gzip {} \;

# -execdir: 파일이 있는 디렉터리로 이동 후 err.log 처리
find . -name '*.log' -execdir gzip {} \;
```

`-execdir`를 사용하면 `{}`가 `./파일명`처럼 상대 경로로 전달되므로 심볼릭 링크를 통한 경로 조작 공격에 덜 취약하다.

## xargs — stdin을 명령 인수로 변환

`xargs`는 표준 입력의 각 줄을 뒤에 오는 명령의 인수로 전달한다. `find` 결과를 파이프로 받아 처리하는 데 자주 사용된다.

```bash
# find 결과를 xargs 로 rm 에 전달
find . -name '*.tmp' | xargs rm

# 위 명령은 실질적으로 아래와 같이 동작
rm ./a.tmp ./b.tmp ./c.tmp ...
```

기본적으로 `xargs`는 한 줄씩 읽어 가능한 한 많은 인수를 하나의 명령 호출에 묶는다. 이는 `-exec {} \;`보다 `fork` 횟수가 적어 빠르다.

## 공백 파일명 안전 처리: -print0과 -0

파일명에 공백이나 개행이 포함된 경우 `xargs`가 잘못 분리할 수 있다. `find -print0`과 `xargs -0`을 함께 쓰면 널 바이트(`\0`)를 구분자로 사용해 안전하게 처리한다.

```bash
# 공백 포함 파일명도 안전
find . -name '*.log' -print0 | xargs -0 rm

# -exec 도 공백에 안전
find . -name '*.log' -exec rm {} +
```

실무에서 파일명에 공백이 없다고 확신하기 어려우므로, 스크립트에서는 `-print0 | xargs -0` 또는 `-exec {} +` 패턴을 기본으로 사용하는 것이 좋다.

![xargs 동작 원리와 실전 조합](/assets/posts/linux-find-exec-xargs-xargs.svg)

## xargs 주요 옵션

```bash
# -n: 한 번에 전달할 인수 개수 제한
find . -name '*.txt' | xargs -n 1 echo   # 한 번에 1개씩

# -P: 병렬 실행
find . -name '*.log' -print0 | xargs -0 -P 4 gzip    # 4개 병렬 압축

# -I: 위치 지정 ({}를 원하는 위치에)
find . -name '*.conf' | xargs -I {} cp {} {}.bak

# -t: 실행할 명령을 먼저 출력 (디버깅용)
find . -name '*.tmp' | xargs -t rm

# -r: 입력이 없을 때 명령 실행 안 함
find . -name '*.tmp' | xargs -r rm
```

## 권한 변경, 소유자 변경에 활용

```bash
# 모든 .sh 파일에 실행 권한 추가
find . -name '*.sh' -exec chmod +x {} +

# 특정 사용자 소유 파일을 다른 사용자로 변경
find /home -user olduser -exec chown newuser {} +

# 쓰기 권한 없는 파일 목록 확인
find . -type f ! -writable

# setuid 파일 점검 후 권한 정상화
find / -perm -4000 -type f 2>/dev/null | xargs ls -l
```

## -delete와 -print0 조합

`-delete` 옵션은 `-exec rm {} \;` 보다 빠르고 간결하다.

```bash
# -delete: 더 빠른 삭제
find . -name '*.tmp' -delete

# 디렉터리도 포함해서 정리 (깊은 곳부터 삭제해야 함)
find . -depth -name 'tmp' -type d -empty -delete
```

`-delete`는 내부적으로 `unlink` 또는 `rmdir` 시스템 콜을 직접 호출해 `exec` fork 비용이 없다. `-depth`를 함께 쓰면 하위 디렉터리부터 처리해 빈 디렉터리 삭제가 안전하게 동작한다.

---

**지난 글:** [find 기초: 파일 이름·크기·날짜로 검색하기](/posts/linux-find-basics/)

**다음 글:** [locate & updatedb: 초고속 파일 위치 검색](/posts/linux-locate-updatedb/)

<br>
읽어주셔서 감사합니다. 😊
