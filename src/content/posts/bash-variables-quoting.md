---
title: "Bash 변수와 인용 부호"
description: "Bash 변수 선언·참조·유형(셸/환경/특수/readonly)과 큰따옴표·작은따옴표·백슬래시 인용 규칙을 설명합니다. 단어 분리(word splitting)와 글로빙 억제의 원리와 실전 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["bash", "variables", "quoting", "word-splitting", "export", "environment", "shell", "linux"]
featured: false
draft: false
---

[지난 글](/posts/bash-shebang-and-execution/)에서 셔뱅과 스크립트 실행 방식을 알아봤습니다. Bash 스크립트 버그의 상당수는 변수에 따옴표를 빠뜨리거나 잘못 사용하는 데서 비롯됩니다. 규칙을 한 번 정확히 이해하면 이 종류의 오류는 거의 사라집니다.

## 변수 선언과 참조

```bash
# 선언 — = 앞뒤 공백 없음 (필수!)
MY_VAR="hello"
count=0

# 참조 — $ 또는 ${} 사용
echo $MY_VAR        # hello
echo ${MY_VAR}      # hello (명확한 경계가 필요할 때)
echo "${MY_VAR}s"   # hellos (중괄호로 경계 명시)
```

변수 선언 시 `=` 주위에 공백이 있으면 Bash가 명령으로 해석합니다. `MY_VAR = "hello"`는 `MY_VAR`라는 명령에 `=`와 `"hello"`를 인자로 넘기는 것으로 처리됩니다.

## 변수 유형

![Bash 변수 유형](/assets/posts/bash-variable-types.svg)

```bash
# 환경 변수 — 서브프로세스에 전달
export DB_HOST="localhost"
export DB_PORT=5432

# 한 줄로 선언과 동시에 export
export GREETING="Hello"

# 현재 환경 변수 목록 확인
printenv | grep DB_
env | grep DB_
```

## 큰따옴표와 작은따옴표

![Bash 인용 부호 규칙](/assets/posts/bash-quoting-rules.svg)

```bash
NAME="World"
# 큰따옴표: 변수 확장 허용
echo "Hello, $NAME"    # Hello, World
echo "Today: $(date)"  # Today: Mon May 19 ...

# 작은따옴표: 완전한 리터럴
echo 'Hello, $NAME'    # Hello, $NAME
echo '$(date)'         # $(date) 그대로

# 백슬래시: 단일 문자 이스케이프
echo "She said \"hi\""  # She said "hi"
echo \$NAME             # $NAME 그대로
```

## 단어 분리와 글로빙

Bash는 따옴표 없는 변수를 **IFS**(기본값: 공백·탭·줄바꿈) 기준으로 나눕니다. 이를 단어 분리(word splitting)라고 합니다.

```bash
FILES="a.txt b.txt c.txt"
for f in $FILES; do    # 3번 반복 (정상)
    echo "$f"
done

FILENAME="my file.txt"
rm $FILENAME           # ❌ "my"와 "file.txt" 두 인자로 분리
rm "$FILENAME"         # ✅ 하나의 인자로 처리
```

글로빙(globbing)도 따옴표 없는 확장에서 발생합니다.

```bash
PATTERN="*.txt"
ls $PATTERN    # *.txt가 현재 디렉터리의 파일로 확장됨
ls "$PATTERN"  # "*.txt" 문자열 그대로 전달
```

## $@ vs $*

여러 인자를 다룰 때 `$@`와 `$*`의 차이가 중요합니다.

```bash
# 스크립트: myscript.sh "hello world" foo
# $1 = "hello world", $2 = "foo"

for arg in "$@"; do   # "hello world", "foo" — 각 인자 보존
    echo "arg: $arg"
done

for arg in "$*"; do   # "hello world foo" — 하나로 합쳐짐
    echo "arg: $arg"
done

for arg in $@; do     # "hello", "world", "foo" — 단어 분리 발생
    echo "arg: $arg"
done
```

`"$@"`를 쓰면 원래 인자의 공백이 보존됩니다.

## 기본값과 치환 문법

```bash
# 변수가 비어있으면 기본값 사용
echo "${NAME:-Guest}"          # NAME이 비거나 미설정이면 "Guest"
echo "${NAME:="Default"}"      # 미설정이면 "Default"로 설정 후 출력
echo "${NAME:+set}"            # NAME이 설정되어 있으면 "set" 출력
echo "${NAME:?"NAME is required"}"  # 미설정이면 오류로 종료

# 문자열 길이
echo "${#NAME}"                # 문자열 길이

# 부분 문자열
STR="Hello World"
echo "${STR:6}"                # World
echo "${STR:6:5}"              # World (offset:length)
echo "${STR,,}"                # hello world (소문자)
echo "${STR^^}"                # HELLO WORLD (대문자)
```

---

**지난 글:** [Bash 셔뱅과 스크립트 실행 방식](/posts/bash-shebang-and-execution/)

**다음 글:** [Bash 배열 완전 정복](/posts/bash-arrays/)

<br>
읽어주셔서 감사합니다. 😊
