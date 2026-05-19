---
title: "Bash 조건문 완전 정복"
description: "Bash의 if/elif/else, case 문법과 [ ], [[ ]], (( )) 세 가지 조건 표현식을 비교합니다. 숫자·문자열·파일 비교 연산자, 정규식 매칭, 논리 연산자를 실전 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["bash", "conditionals", "if-else", "case", "test", "shell", "linux", "scripting"]
featured: false
draft: false
---

[지난 글](/posts/bash-arrays/)에서 배열로 여러 값을 관리하는 방법을 살펴봤습니다. 이번엔 스크립트에서 분기를 만드는 조건문을 다룹니다. Bash 조건문에서 가장 많이 실수하는 지점은 `[ ]`와 `[[ ]]`의 차이, 그리고 숫자 비교와 문자열 비교 연산자를 혼동하는 것입니다.

## if / elif / else

Bash의 if 문은 `then`과 `fi`로 블록을 감쌉니다.

```bash
score=85

if [[ $score -ge 90 ]]; then
    echo "A등급"
elif [[ $score -ge 80 ]]; then
    echo "B등급"
elif [[ $score -ge 70 ]]; then
    echo "C등급"
else
    echo "재시험"
fi
```

`then`은 `if`와 같은 줄에 세미콜론(`;`)을 붙여 이어 쓰거나 줄을 바꿔 쓸 수 있습니다. 두 방식 모두 유효합니다.

![Bash 조건문 구조](/assets/posts/bash-conditionals-structure.svg)

## 세 가지 조건 표현식

![Bash 비교 연산자](/assets/posts/bash-conditionals-operators.svg)

Bash에는 조건을 표현하는 세 가지 방법이 있습니다.

```bash
# [ ] — POSIX 호환 (외부 명령 test 와 동일)
[ "$a" = "$b" ]      # 문자열 비교 (=, !=)
[ $a -eq $b ]        # 숫자 비교

# [[ ]] — Bash 확장 (권장)
[[ $a == $b ]]       # 문자열 같다 (== 사용 가능)
[[ $a =~ ^[0-9]+$ ]] # 정규식 매칭
[[ -f "$file" && -r "$file" ]]  # 복합 조건

# (( )) — 산술 조건
(( a > b ))
(( a % 2 == 0 ))
```

`[[ ]]`는 Bash 내장이라 단어 분리와 글로빙이 발생하지 않습니다. 변수를 따옴표로 감싸지 않아도 안전하게 동작합니다. 단, POSIX sh 호환이 필요하면 `[ ]`를 써야 합니다.

## 파일 검사 연산자

```bash
FILE="/etc/passwd"

if [[ -f "$FILE" ]]; then
    echo "일반 파일"
fi

if [[ -d "/tmp" ]]; then
    echo "디렉터리"
fi

if [[ -e "$FILE" && -r "$FILE" ]]; then
    echo "존재하고 읽기 가능"
fi

if [[ -s "$FILE" ]]; then
    echo "비어 있지 않음"
fi

# 파일 비교
if [[ "$FILE1" -nt "$FILE2" ]]; then
    echo "FILE1이 더 최신"
fi
```

자주 쓰이는 파일 플래그 요약: `-f`(일반 파일), `-d`(디렉터리), `-e`(존재), `-r`(읽기), `-w`(쓰기), `-x`(실행), `-s`(크기>0), `-L`(심볼릭 링크).

## 문자열 비교

```bash
STR="hello"

# 빈 문자열 검사
if [[ -z "$STR" ]]; then echo "비어 있음"; fi   # zero
if [[ -n "$STR" ]]; then echo "값 있음"; fi     # non-zero

# 같다/다르다
if [[ "$STR" == "hello" ]]; then echo "같음"; fi
if [[ "$STR" != "world" ]]; then echo "다름"; fi

# 와일드카드 패턴 ([[ ]] 에서만)
if [[ "$STR" == h* ]]; then echo "h로 시작"; fi

# 정규식 매칭 ([[ ]] 에서만, ~ 오른쪽 따옴표 사용 금지)
if [[ "$STR" =~ ^[a-z]+$ ]]; then echo "소문자만"; fi
```

## case 문

여러 값을 비교할 때 중첩 if 대신 case를 쓰면 가독성이 높아집니다.

```bash
OS=$(uname -s)

case $OS in
    Linux)
        echo "리눅스"
        ;;
    Darwin)
        echo "macOS"
        ;;
    CYGWIN*|MINGW*)
        echo "Windows(Cygwin/Git Bash)"
        ;;
    *)
        echo "알 수 없는 OS: $OS"
        ;;
esac
```

패턴은 `|`로 OR를 표현합니다. 와일드카드 `*`, `?`, `[...]`도 지원합니다. 각 블록은 `;;`로 종료합니다. `;&`을 쓰면 다음 패턴으로 **폴스루**(fall-through), `;;&`을 쓰면 다음 패턴도 **계속 검사**합니다.

## 단락 평가

`&&`와 `||`는 명령 수준에서도 단락 평가로 사용할 수 있습니다.

```bash
# 파일 있을 때만 실행
[[ -f "$CONFIG" ]] && source "$CONFIG"

# 실패하면 종료
mkdir -p /tmp/mydir || { echo "디렉터리 생성 실패" >&2; exit 1; }

# 체인
[[ -d "$DIR" ]] && [[ -w "$DIR" ]] && echo "쓸 수 있는 디렉터리"
```

중괄호 `{ ... }` 안에 여러 명령을 묶으면 실패 처리를 한 블록으로 표현할 수 있습니다.

## (( )) 산술 조건

```bash
count=5

if (( count > 3 )); then
    echo "3 초과"
fi

# 0이면 거짓, 0이 아니면 참
if (( count )); then
    echo "0이 아님"
fi

# 삼항 연산자 흉내
result=$(( count > 3 ? 1 : 0 ))
```

`(( ))` 안에서는 변수에 `$`를 붙이지 않아도 됩니다.

---

**지난 글:** [Bash 배열 완전 정복](/posts/bash-arrays/)

**다음 글:** [Bash 반복문](/posts/bash-loops/)

<br>
읽어주셔서 감사합니다. 😊
