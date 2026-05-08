---
title: "find 기초: 파일 이름·크기·날짜로 검색하기"
description: "find 명령어의 핵심 옵션인 -name, -type, -size, -mtime을 사용해 원하는 파일을 정확히 찾는 방법을 배운다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 8
type: "knowledge"
category: "Linux"
tags: ["Linux", "find", "파일검색", "파일시스템", "CLI"]
featured: false
draft: false
---

[지난 글](/posts/linux-touch-stat/)에서 파일 메타데이터를 조회하는 방법을 배웠다. 이번 글에서는 **Linux에서 가장 강력한 파일 검색 명령어인 `find`**를 다룬다. `find`는 이름, 크기, 날짜, 권한, 소유자 등 다양한 조건을 조합해 원하는 파일을 정밀하게 찾아내고, 찾은 파일에 명령을 실행하는 것까지 한 번에 처리할 수 있다.

## find의 기본 구조

```bash
find [검색 경로] [조건] [동작]
find /etc -name 'hosts'          # /etc 아래에서 hosts 라는 파일 찾기
find . -name '*.log'             # 현재 디렉터리 아래 *.log 파일
find /home -user alice           # alice 소유 파일
find / -type f -size +100M       # 전체 시스템의 100MB 초과 파일
```

경로를 지정하지 않으면 현재 디렉터리(`.`)에서 시작한다. `2>/dev/null`은 권한 오류 메시지를 숨길 때 자주 붙인다.

## -name: 파일 이름 조건

가장 자주 쓰는 조건이다. 쉘 글로브 패턴(`*`, `?`, `[...]`)을 사용한다. 반드시 따옴표로 감싸야 쉘이 글로브를 확장하지 않는다.

```bash
find . -name '*.txt'             # .txt 로 끝나는 파일
find . -name 'error*'            # error 로 시작하는 파일
find . -iname '*.Log'            # 대소문자 무시 (-iname)
find . -name 'config.??'         # config. 뒤에 두 글자
```

## -type: 파일 유형 조건

```bash
find . -type f                   # 일반 파일만
find . -type d                   # 디렉터리만
find . -type l                   # 심볼릭 링크만
find . -type b                   # 블록 디바이스
find . -type p                   # 명명된 파이프(FIFO)
```

`-type f`를 빠뜨리면 디렉터리도 결과에 포함돼 후속 처리에 문제가 생기는 경우가 많다.

## -size: 파일 크기 조건

크기 단위는 `c`(바이트), `k`(1024바이트), `M`(메가), `G`(기가)이다. `+`는 초과, `-`는 미만을 의미한다.

```bash
find . -size +10M                # 10MB 초과
find . -size -1k                 # 1kB 미만
find . -size 0c                  # 0바이트 (빈 파일)
find . -size +1G                 # 1GB 초과 (대용량 파일 탐지)
```

![find 핵심 조건 정리](/assets/posts/linux-find-basics-predicates.svg)

## -mtime / -mmin: 날짜 조건

날짜 조건은 파일의 `mtime`(최종 수정 시각)을 기준으로 한다.

```bash
find . -mtime -7                 # 최근 7일 이내 수정
find . -mtime +30                # 30일 전에 수정 (오래된 파일)
find . -mtime 1                  # 정확히 하루 전
find . -mmin -60                 # 최근 60분 이내 수정
find . -newer ref.txt            # ref.txt 보다 mtime 이 더 최신
```

`-mtime N`에서 N은 일 단위다. `-mtime -1`은 "24시간 이내"이고, `-mtime +1`은 "48시간 이전"이다.

## 깊이 제한: -maxdepth / -mindepth

```bash
find . -maxdepth 1               # 현재 디렉터리만 (하위 탐색 없음)
find . -maxdepth 2 -name '*.py'  # 2단계까지만 탐색
find . -mindepth 2 -type f       # 2단계 이하부터
```

`-maxdepth 1`을 붙이면 `ls`처럼 현재 디렉터리의 직접 자식만 검색한다.

## 조건 조합: AND, OR, NOT

`find`는 여러 조건을 논리 연산자로 결합한다. 기본은 AND(`-a`)다.

```bash
# AND: .log 파일 중 10MB 초과
find . -name '*.log' -size +10M

# OR: .log 또는 .txt 파일
find . \( -name '*.log' -o -name '*.txt' \)

# NOT: .git 디렉터리 제외
find . ! -name '.git' -type d

# -prune 으로 특정 디렉터리 제외 후 나머지 검색
find . -name '.git' -prune -o -name '*.md' -print
```

`\(`와 `\)`는 쉘에서 특수 문자이므로 반드시 역슬래시로 이스케이프한다.

## 권한·소유자 조건

```bash
find /home -user alice -type f   # alice 소유 파일
find /tmp -perm 777              # 정확히 777 권한인 파일
find . -perm /u+x                # 사용자 실행 권한 있는 파일
find / -perm -4000 2>/dev/null   # setuid 파일 (보안 점검)
```

`-perm /모드`는 "해당 비트 중 하나라도 설정된 파일", `-perm -모드`는 "해당 비트 모두 설정된 파일"이다.

![find 실전 예시 모음](/assets/posts/linux-find-basics-examples.svg)

## -empty와 빈 파일 정리

```bash
# 빈 파일 찾기
find . -type f -empty

# 빈 디렉터리 찾기
find . -type d -empty

# 빈 파일 일괄 삭제 (주의: 먼저 목록 확인)
find . -type f -empty -print     # 확인
find . -type f -empty -delete    # 삭제
```

---

**지난 글:** [touch & stat: 파일 생성과 메타데이터 조회](/posts/linux-touch-stat/)

**다음 글:** [find -exec & xargs: 찾은 파일에 명령 실행하기](/posts/linux-find-exec-xargs/)

<br>
읽어주셔서 감사합니다. 😊
