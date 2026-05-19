---
title: "Bash 위치 매개변수"
description: "Bash 스크립트의 위치 매개변수 $0~$9, $#, $@, $* 사용법과 shift로 인자를 소비하는 패턴, set --로 직접 설정하는 방법, 인자 유효성 검사 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["bash", "positional-parameters", "arguments", "shift", "shell", "linux", "scripting"]
featured: false
draft: false
---

[지난 글](/posts/bash-functions/)에서 Bash 함수 선언, 반환값, 변수 범위를 다뤘습니다. 함수와 스크립트 모두 외부에서 인자를 받아야 할 때가 많습니다. 이번엔 그 인자를 다루는 위치 매개변수의 전체 메커니즘을 살펴봅니다.

## 기본 위치 매개변수

스크립트를 `./script.sh arg1 "arg 2" arg3`으로 실행하면 각 인자가 순서대로 번호 변수에 들어갑니다.

```bash
#!/usr/bin/env bash
echo "스크립트: $0"    # ./script.sh
echo "첫 번째: $1"    # arg1
echo "두 번째: $2"    # arg 2  (공백 포함)
echo "세 번째: $3"    # arg3
echo "인자 수: $#"    # 3
```

`$0`은 스크립트 이름(또는 함수 내에서는 여전히 스크립트 이름)입니다. 10번째 이후 인자는 `${10}`, `${11}` 처럼 중괄호로 감쌉니다.

![위치 매개변수 구조](/assets/posts/bash-positional-parameters-map.svg)

## $@ vs $*

```bash
# 전달: ./script.sh "hello world" foo bar
show_args() {
    echo "인자 수: $#"

    echo "--- \"\$@\" 방식 ---"
    for arg in "$@"; do
        echo "  [$arg]"
    done
    # [hello world], [foo], [bar]

    echo "--- \"\$*\" 방식 ---"
    for arg in "$*"; do
        echo "  [$arg]"
    done
    # [hello world foo bar]  (하나로 합쳐짐)
}
show_args "$@"
```

`"$@"`는 각 원래 인자를 따옴표로 보호한 채 전달합니다. 함수나 다른 명령에 인자를 그대로 넘길 때는 항상 `"$@"`를 사용해야 합니다.

## 특수 변수 요약

| 변수 | 의미 |
|------|------|
| `$0` | 스크립트 이름 |
| `$1`~`$9` | 위치 인자 |
| `${10}` 이상 | 중괄호 필요 |
| `$#` | 인자 개수 |
| `"$@"` | 각 인자 개별 보존 |
| `"$*"` | IFS로 결합된 하나의 문자열 |
| `$?` | 마지막 명령 종료 코드 |
| `$$` | 현재 셸 PID |
| `$!` | 마지막 백그라운드 프로세스 PID |
| `$_` | 마지막 명령의 마지막 인자 |

## shift — 인자 소비

`shift`는 `$1`을 버리고 나머지를 한 칸 당깁니다. 옵션과 인자를 순서대로 소비하는 패턴에 자주 쓰입니다.

```bash
#!/usr/bin/env bash
while [[ $# -gt 0 ]]; do
    case $1 in
        -v|--verbose)
            VERBOSE=1
            shift          # $1 소비
            ;;
        -o|--output)
            OUTPUT="$2"
            shift 2        # $1과 $2 동시 소비
            ;;
        -*)
            echo "알 수 없는 옵션: $1" >&2
            exit 1
            ;;
        *)
            POSITIONAL+=("$1")
            shift
            ;;
    esac
done
```

## set -- 로 위치 매개변수 재설정

![set -- 활용 패턴](/assets/posts/bash-positional-parameters-set.svg)

```bash
# 직접 설정
set -- "alpha" "beta" "gamma"
echo "$1 $2 $3"   # alpha beta gamma

# IFS로 문자열 분리해 위치 매개변수로
IFS=',' read -r -a parts <<< "a,b,c"
set -- "${parts[@]}"
echo "$1 $2 $3"   # a b c

# 날짜 분리 예시
IFS='-' read -r year month day <<< "2026-05-20"
echo "$year / $month / $day"
```

## 인자 유효성 검사 패턴

```bash
#!/usr/bin/env bash
PROG=$(basename "$0")

usage() {
    cat <<EOF
사용법: $PROG [옵션] <소스> <대상>

옵션:
  -v, --verbose   상세 출력
  -h, --help      도움말 출력
EOF
    exit 0
}

# 최소 인자 검사
[[ $# -lt 2 ]] && { echo "인자가 부족합니다" >&2; usage; }

SRC="$1"
DST="$2"

[[ -f "$SRC" ]] || { echo "소스 파일 없음: $SRC" >&2; exit 1; }
```

## basename/dirname으로 $0 활용

```bash
PROG=$(basename "$0")         # 경로 제거, 파일명만
DIR=$(dirname "$(realpath "$0")")   # 스크립트가 있는 디렉터리
```

스크립트 자신이 있는 디렉터리를 알아야 상대 경로로 관련 파일을 찾을 때 `DIR` 변수를 기준점으로 사용합니다.

---

**지난 글:** [Bash 함수 완전 정복](/posts/bash-functions/)

**다음 글:** [Bash getopts로 옵션 파싱](/posts/bash-getopts/)

<br>
읽어주셔서 감사합니다. 😊
