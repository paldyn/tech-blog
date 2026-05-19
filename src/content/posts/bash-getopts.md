---
title: "Bash getopts로 옵션 파싱"
description: "Bash 내장 getopts로 단일 문자 옵션과 값을 갖는 옵션을 파싱하는 방법을 설명합니다. OPTIND, OPTARG 작동 원리, 에러 처리 모드, shift로 나머지 인자 추출하는 완성 템플릿을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["bash", "getopts", "option-parsing", "OPTARG", "OPTIND", "shell", "linux", "scripting"]
featured: false
draft: false
---

[지난 글](/posts/bash-positional-parameters/)에서 위치 매개변수와 `shift`를 배웠습니다. 스크립트에 `-v`, `-o output.txt` 같은 POSIX 스타일 단일 문자 옵션을 붙이고 싶다면 Bash 내장 명령 `getopts`가 가장 적합한 도구입니다.

## getopts 기본 구조

```bash
getopts OPTSTRING opt
```

`getopts`는 `while` 루프와 함께 씁니다. 인식할 옵션 문자를 OPTSTRING에 나열하고, 현재 처리 중인 옵션을 `opt` 변수(이름은 자유)에 저장합니다.

```bash
while getopts "hvo:" opt; do
    case $opt in
        h) echo "도움말"; exit 0 ;;
        v) VERBOSE=1 ;;
        o) OUTPUT="$OPTARG" ;;
        ?) echo "오류: 알 수 없는 옵션 -$OPTARG" >&2; exit 1 ;;
    esac
done
```

OPTSTRING에서 문자 뒤에 `:`을 붙이면 해당 옵션은 값을 받습니다. 위 예제에서 `o:`는 `-o value` 형태로 사용하며 값이 `$OPTARG`에 들어옵니다.

![getopts 파싱 흐름](/assets/posts/bash-getopts-flow.svg)

## OPTARG와 OPTIND

| 변수 | 역할 |
|------|------|
| `$OPTARG` | 현재 옵션의 값 (`:`이 붙은 옵션에서만) |
| `$OPTIND` | 다음에 처리할 인자의 인덱스 |
| `$opt` | 현재 처리 중인 옵션 문자 |

```bash
# OPTIND는 루프가 끝난 뒤 옵션 이후의 인자 위치를 가리킴
shift $(( OPTIND - 1 ))
# 이제 $1, $2 ... 는 옵션이 아닌 일반 인자
```

## 에러 처리 모드

OPTSTRING 첫 글자에 `:`을 붙이면 **silent 모드**가 됩니다. 이 모드에서는 getopts가 직접 에러 메시지를 출력하지 않고, 호출 스크립트가 오류를 처리합니다.

```bash
# silent 모드 — 첫 :
while getopts ":hvo:" opt; do
    case $opt in
        h) usage ;;
        v) VERBOSE=1 ;;
        o) OUTPUT="$OPTARG" ;;
        :)                        # 값 없는 옵션
            echo "-$OPTARG 에 값이 필요합니다" >&2
            exit 1
            ;;
        \?)                       # 알 수 없는 옵션
            echo "알 수 없는 옵션: -$OPTARG" >&2
            exit 1
            ;;
    esac
done
```

silent 모드에서 오류가 나면:
- 알 수 없는 옵션: `opt`에 `?`이 들어오고 `$OPTARG`에 문제의 옵션 문자가 들어옴
- 값 없는 옵션: `opt`에 `:`이 들어오고 `$OPTARG`에 문제의 옵션 문자가 들어옴

## 완성 템플릿

![getopts 완성 템플릿](/assets/posts/bash-getopts-template.svg)

```bash
#!/usr/bin/env bash
set -euo pipefail

VERBOSE=0
OUTPUT=""

usage() {
    cat <<EOF
사용법: $(basename "$0") [옵션] <소스>

옵션:
  -h           도움말
  -v           상세 출력
  -o <파일>    출력 파일 지정
EOF
    exit 0
}

while getopts ":hvo:" opt; do
    case $opt in
        h) usage ;;
        v) VERBOSE=1 ;;
        o) OUTPUT="$OPTARG" ;;
        :) echo "-$OPTARG 에 값이 필요합니다" >&2; exit 1 ;;
        \?) echo "알 수 없는 옵션: -$OPTARG" >&2; exit 1 ;;
    esac
done
shift $(( OPTIND - 1 ))

# 나머지 위치 인자
SRC="${1:-}"
[[ -z "$SRC" ]] && { echo "소스 인자가 필요합니다" >&2; usage; }
```

## 옵션 묶어 쓰기

`getopts`는 `-vho output.txt`처럼 값 없는 옵션을 묶어 쓰는 것을 지원합니다.

```bash
./script.sh -vh -o output.txt source.txt
# -v, -h 는 묶음, -o 는 값 필요
```

`-vh`를 하나의 인자로 넘겨도 getopts가 `v`와 `h`를 각각 두 번 반복해서 처리합니다.

## getopts vs getopt

| | getopts | getopt |
|---|---|---|
| 유형 | Bash 내장 | 외부 명령 |
| 긴 옵션 (`--help`) | 불가 | 가능 |
| POSIX 호환 | 완전 | 구현마다 다름 |
| 공백 있는 값 | 안전 | 처리 주의 필요 |

긴 옵션이 필요하면 `case $1 in` + `shift` 방식의 수동 파싱이나 외부 명령 `getopt`(GNU 버전)를 검토합니다.

---

**지난 글:** [Bash 위치 매개변수](/posts/bash-positional-parameters/)

**다음 글:** [Bash Here Document와 Here String](/posts/bash-here-doc-here-string/)

<br>
읽어주셔서 감사합니다. 😊
