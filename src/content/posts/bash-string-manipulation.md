---
title: "Bash 문자열 조작"
description: "Bash 파라미터 확장을 이용한 문자열 조작을 설명합니다. 길이, 부분 문자열, 대소문자 변환, 앞/뒤 패턴 제거(#/%), 치환(//), 기본값 설정, 파일 경로 분해 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["bash", "string", "parameter-expansion", "substring", "pattern", "shell", "linux", "scripting"]
featured: false
draft: false
---

[지난 글](/posts/bash-arithmetic/)에서 Bash 산술 연산의 다양한 방법을 살펴봤습니다. 이번엔 문자열을 자르고, 바꾸고, 합치는 파라미터 확장 기법을 정리합니다. 외부 명령 없이 `${}` 문법만으로 대부분의 문자열 변환을 처리할 수 있습니다.

## 길이와 부분 문자열

```bash
STR="Hello, World!"

# 길이
echo "${#STR}"        # 13

# 부분 문자열: ${var:offset:length}
echo "${STR:7}"       # World!
echo "${STR:7:5}"     # World
echo "${STR: -6}"     # orld!  (음수 offset — 뒤에서)
echo "${STR: -6:4}"   # orld
```

음수 오프셋 앞에 공백을 넣어야 합니다(`${var: -n}`). 붙여 쓰면(`${var:-n}`) 기본값 문법으로 해석됩니다.

![Bash 문자열 조작 문법](/assets/posts/bash-string-manipulation-syntax.svg)

## 대소문자 변환 (Bash 4.0+)

```bash
STR="Hello World"

echo "${STR^^}"    # HELLO WORLD  (전체 대문자)
echo "${STR,,}"    # hello world  (전체 소문자)
echo "${STR^}"     # Hello World  (첫 글자 대문자)
echo "${STR,}"     # hello World  (첫 글자 소문자)

# 특정 문자만
echo "${STR^^[aeiou]}"   # HEllO WOrld  (모음 대문자)
```

## 패턴 제거 — # / ## / % / %%

`#`과 `%`는 각각 앞쪽(왼쪽)과 뒤쪽(오른쪽)에서 패턴을 제거합니다. 단일 기호는 **최단 일치**, 이중 기호는 **최장 일치**입니다.

```bash
FILE="/path/to/file.tar.gz"

# 앞에서 제거
echo "${FILE#*/}"     # path/to/file.tar.gz  (첫 / 까지)
echo "${FILE##*/}"    # file.tar.gz           (마지막 / 까지)

# 뒤에서 제거
echo "${FILE%.*}"     # /path/to/file.tar    (마지막 . 부터)
echo "${FILE%%.*}"    # /path/to/file         (첫 . 부터)

# 실용 패턴
filename="${FILE##*/}"     # 파일명 (basename)
dir="${FILE%/*}"           # 디렉터리 (dirname)
ext="${filename##*.}"      # 확장자
stem="${filename%%.*}"     # 확장자 제거한 이름
```

이 패턴을 외우면 `basename`, `dirname` 외부 명령 없이도 경로를 처리할 수 있습니다.

## 치환 — / 와 //

```bash
STR="foo bar foo baz"

echo "${STR/foo/FOO}"    # FOO bar foo baz  (첫 번째만)
echo "${STR//foo/FOO}"   # FOO bar FOO baz  (전체)
echo "${STR/#foo/FOO}"   # FOO bar foo baz  (앞에서만)
echo "${STR/%baz/BAZ}"   # foo bar foo BAZ  (뒤에서만)
echo "${STR// /}"        # foobarf oobaz    (공백 제거)
```

치환 문자열을 비우면 삭제와 같습니다.

```bash
# 줄바꿈 제거
clean="${STR//$'\n'/}"

# 경로에서 특수 문자 이스케이프
safe="${PATH//:/\\:}"
```

![문자열 조작 실전 패턴](/assets/posts/bash-string-manipulation-patterns.svg)

## 기본값과 존재 확인

```bash
# 변수가 미설정이거나 빈 문자열이면 기본값 반환
echo "${NAME:-Anonymous}"

# 미설정이면 값을 설정하고 반환
echo "${NAME:=DefaultName}"

# 설정되어 있을 때만 대체 값 반환
echo "${DEBUG:+verbose}"

# 미설정이면 오류 메시지와 함께 종료
echo "${REQUIRED:?'REQUIRED가 설정되어야 합니다'}"

# 설정 여부만 확인
[[ -v NAME ]] && echo "설정됨"
```

`:-`와 `-`의 차이: `:-`은 빈 문자열도 미설정으로 간주하고, `-`는 실제로 unset인 경우만 처리합니다.

## 구분자로 분리하고 결합

```bash
# IFS + read로 분리
IFS=',' read -ra items <<< "apple,banana,cherry"
echo "${items[0]}"   # apple
echo "${#items[@]}"  # 3

# IFS + echo로 결합
arr=("a" "b" "c")
joined=$(IFS=','; echo "${arr[*]}")
echo "$joined"   # a,b,c
```

## printf로 문자열 포매팅

```bash
# 폭과 정렬
printf "%-20s %s\n" "파일명" "크기"
printf "%-20s %10d\n" "report.pdf" 1234567

# 16진수로 인코딩
printf '%s' "hello" | xxd -p   # 68656c6c6f

# URL 인코딩 흉내 (간단 버전)
encode() {
    printf '%s' "$1" | od -An -tx1 | tr ' ' '%' | tr -d '\n' | tr -d ' '
}
```

## 실전 예제 — 설정 파일 파서

```bash
#!/usr/bin/env bash
parse_config() {
    local file=$1
    while IFS='=' read -r key value; do
        # 주석과 빈 줄 건너뜀
        [[ $key =~ ^[[:space:]]*# ]] && continue
        [[ -z "${key// /}" ]] && continue

        # 앞뒤 공백 제거
        key="${key#"${key%%[![:space:]]*}"}"
        key="${key%"${key##*[![:space:]]}"}"
        value="${value#"${value%%[![:space:]]*}"}"
        value="${value%"${value##*[![:space:]]}"}"

        # 동적 변수 설정
        declare -g "CFG_${key^^}=$value"
    done < "$file"
}

parse_config myapp.conf
echo "${CFG_HOST}"
echo "${CFG_PORT}"
```

---

**지난 글:** [Bash 산술 연산](/posts/bash-arithmetic/)

**다음 글:** [Bash 파라미터 확장 심화](/posts/bash-parameter-expansion/)

<br>
읽어주셔서 감사합니다. 😊
