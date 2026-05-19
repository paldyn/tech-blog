---
title: "Bash 함수 완전 정복"
description: "Bash 함수 선언 문법, 인자 전달, return과 명령 치환을 이용한 반환값, local로 변수 범위 제어, 재귀, export -f로 서브셸에 함수 전달하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["bash", "functions", "scope", "local", "return", "shell", "linux", "scripting"]
featured: false
draft: false
---

[지난 글](/posts/bash-loops/)에서 반복문으로 작업을 자동화하는 방법을 다뤘습니다. 반복이 많아지면 코드를 묶어서 재사용하는 구조가 필요합니다. Bash 함수는 코드를 이름으로 묶고, 인자를 받아 처리한 뒤 결과를 돌려주는 기본 재사용 단위입니다.

## 함수 선언

```bash
# 방법 1: function 키워드
function greet() {
    echo "Hello, $1"
}

# 방법 2: 이름만 (POSIX 호환, 권장)
greet() {
    echo "Hello, $1"
}

# 호출
greet "Alice"    # Hello, Alice
greet "Bob"      # Hello, Bob
```

두 문법은 완전히 동일하게 동작합니다. POSIX sh 호환이 필요하다면 `function` 키워드 없는 형태를 선택합니다.

![Bash 함수 구조](/assets/posts/bash-functions-anatomy.svg)

## 인자 전달

함수 내에서 인자는 `$1`, `$2`, `$3` 등의 위치 매개변수로 접근합니다.

```bash
sum_two() {
    local a=$1
    local b=$2
    echo $(( a + b ))
}
result=$(sum_two 3 7)
echo "합계: $result"   # 합계: 10

# $@ — 모든 인자
print_all() {
    for arg in "$@"; do
        echo "  인자: $arg"
    done
}
print_all "apple" "banana" "cherry"

# $# — 인자 수
check_args() {
    if [[ $# -lt 2 ]]; then
        echo "인자가 2개 이상 필요합니다" >&2
        return 1
    fi
}
```

## 반환값

Bash 함수의 `return`은 0~255 범위의 종료 코드만 반환합니다. 문자열이나 숫자를 돌려주려면 `echo`로 출력하고 명령 치환 `$()`으로 받습니다.

```bash
# return — 종료 코드
is_even() {
    (( $1 % 2 == 0 )) && return 0
    return 1
}

if is_even 4; then echo "짝수"; fi

# 문자열 반환 — echo + 명령 치환
to_upper() {
    echo "${1^^}"   # Bash 4.0+
}
result=$(to_upper "hello")
echo "$result"   # HELLO

# 전역 변수로 반환 (명령 치환 서브셸 오버헤드 없음)
RESULT=""
compute() {
    RESULT=$(( $1 * $1 ))
}
compute 5
echo "$RESULT"   # 25
```

## 변수 범위

`local` 키워드를 쓰지 않으면 함수 내 변수는 전역 범위에 영향을 미칩니다.

```bash
x="global"
demo() {
    local x="local"   # 함수 내에서만 유효
    echo "$x"         # local
}
demo
echo "$x"             # global — 변경되지 않음
```

항상 함수 내 임시 변수는 `local`로 선언하는 습관이 중요합니다. 그렇지 않으면 같은 이름의 전역 변수를 의도치 않게 덮어씁니다.

```bash
# local -r — 읽기 전용 지역 변수
process() {
    local -r CONFIG="/etc/myapp.conf"
    local -i counter=0   # 정수 전용
    local -a items=()    # 배열
    # CONFIG="other"  ← 오류 발생
}
```

![Bash 함수 패턴](/assets/posts/bash-functions-patterns.svg)

## 에러 핸들링 헬퍼

```bash
die() {
    echo "ERROR: $*" >&2
    exit 1
}

warn() {
    echo "WARN: $*" >&2
}

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

# 사용
[[ -f "$CONFIG" ]] || die "설정 파일이 없습니다: $CONFIG"
cp "$src" "$dst" || die "복사 실패: $src → $dst"
```

## 재귀 함수

```bash
factorial() {
    local n=$1
    (( n <= 1 )) && { echo 1; return; }
    echo $(( n * $(factorial $(( n - 1 ))) ))
}

echo "5! = $(factorial 5)"   # 5! = 120
```

Bash 재귀는 각 호출이 서브셸을 생성하므로 깊이가 커지면 느려집니다. 반복문으로 대체할 수 있으면 반복문을 우선 고려합니다.

## 함수 내보내기 — export -f

함수를 서브셸이나 `xargs`, `find -exec bash -c`에서 사용하려면 `export -f`로 내보내야 합니다.

```bash
process_file() {
    echo "처리: $1"
}
export -f process_file

# find와 함께 사용
find . -name "*.txt" -exec bash -c 'process_file "$1"' _ {} \;

# xargs와 함께
printf '%s\n' *.log | xargs -I{} bash -c 'process_file "{}"'
```

`export -f` 없이 서브셸에서 호출하면 "command not found" 오류가 발생합니다.

---

**지난 글:** [Bash 반복문 완전 정복](/posts/bash-loops/)

**다음 글:** [Bash 위치 매개변수](/posts/bash-positional-parameters/)

<br>
읽어주셔서 감사합니다. 😊
