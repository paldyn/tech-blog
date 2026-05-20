---
title: "Bash 파라미터 확장 완전 정복"
description: "Bash 파라미터 확장의 기본값 설정, 변수 존재 검사, 오류 처리, 간접 참조, 변환 확장 패턴을 코드 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["bash", "parameter-expansion", "shell", "scripting", "linux", "variables"]
featured: false
draft: false
---

[지난 글](/posts/bash-string-manipulation/)에서 문자열 조작을 위한 파라미터 확장 기법들을 살펴봤습니다. 이번엔 **변수의 존재 여부와 값 여부에 따라 조건부로 동작하는 확장 연산자**들을 깊게 다룹니다. 스크립트를 방어적으로 작성하고 싶을 때 이 패턴들이 핵심입니다.

## 네 가지 조건부 확장 연산자

Bash에서 가장 자주 쓰이는 파라미터 확장 패턴은 변수가 설정되지 않았거나 빈값일 때의 처리입니다.

```bash
# ${var:-default} — 미설정/빈값이면 default 반환 (var는 유지)
NAME=""
echo "${NAME:-홍길동}"    # 홍길동
echo "$NAME"             # (여전히 빈값)

# ${var:=default} — 미설정/빈값이면 default로 대입하고 반환
echo "${LOG:=/var/log/app.log}"  # /var/log/app.log
echo "$LOG"                      # /var/log/app.log (대입됨)

# ${var:?msg} — 미설정/빈값이면 msg를 stderr에 출력하고 종료
: "${DB_HOST:?환경변수 DB_HOST가 필요합니다}"

# ${var:+alt} — 설정되어 있으면 alt 반환 (역방향 검사)
DEBUG=1
echo "${DEBUG:+--verbose}"   # --verbose
echo "${QUIET:+--silent}"    # (QUIET 미설정이면 빈 문자열)
```

콜론(`:`)을 빼면 동작이 달라집니다. `${var-default}`는 변수가 **완전히 미설정**일 때만 기본값을 사용하고, 빈 문자열로 설정된 경우는 통과시킵니다. 실무에서는 거의 항상 콜론 포함 버전을 씁니다.

![Bash 파라미터 확장 조건부 연산자](/assets/posts/bash-parameter-expansion-operators.svg)

## 길이와 부분 문자열

`${#var}`로 길이를, `${var:offset:length}`로 부분 문자열을 추출합니다.

```bash
STR="Hello, World!"
echo "${#STR}"         # 13

echo "${STR:7}"        # World!
echo "${STR:7:5}"      # World
echo "${STR: -6}"      # orld!  (음수 오프셋은 앞에 공백 필요)
echo "${STR: -6:4}"    # orld

# 배열에도 동일하게 적용
ARR=(a b c d e)
echo "${ARR[@]:1:3}"   # b c d
```

음수 오프셋 앞에 공백을 반드시 넣어야 합니다. `${var:-6}`으로 붙여 쓰면 기본값 확장(`:-`)으로 해석됩니다.

## 패턴 제거

`#`, `##`, `%`, `%%`로 앞/뒤에서 패턴을 제거합니다.

```bash
FILE="/home/user/docs/report.txt"

# 앞에서 제거 — # 최단, ## 최장
echo "${FILE#*/}"      # home/user/docs/report.txt
echo "${FILE##*/}"     # report.txt  (basename과 동일)

# 뒤에서 제거 — % 최단, %% 최장
echo "${FILE%.txt}"    # /home/user/docs/report
echo "${FILE%/*}"      # /home/user/docs  (dirname과 동일)

# 확장자 교체 패턴
for f in *.txt; do
  mv "$f" "${f%.txt}.md"
done
```

## 치환 확장

`${var/pattern/replacement}`로 패턴을 치환합니다.

```bash
STR="foo bar foo baz foo"

echo "${STR/foo/FOO}"    # FOO bar foo baz foo  (첫 번째만)
echo "${STR//foo/FOO}"   # FOO bar FOO baz FOO  (전체)
echo "${STR/#foo/FOO}"   # FOO bar foo baz foo  (시작 패턴)
echo "${STR/%foo/FOO}"   # foo bar foo baz FOO  (끝 패턴)

# 패턴 삭제 (replacement 생략)
echo "${STR//foo/}"      #  bar  baz
```

## 간접 참조와 고급 확장

```bash
# 간접 참조 ${!var} — var 값을 변수명으로 사용
VAR=greeting
greeting="안녕하세요"
echo "${!VAR}"           # 안녕하세요

# DB_ 로 시작하는 변수명 목록
DB_HOST=localhost
DB_PORT=5432
echo "${!DB_@}"          # DB_HOST DB_PORT

# 배열 인덱스 목록
ARR=(apple banana cherry)
echo "${!ARR[@]}"        # 0 1 2
echo "${#ARR[@]}"        # 3 (길이)
```

![Bash 파라미터 확장 고급 패턴](/assets/posts/bash-parameter-expansion-indirect.svg)

## 변환 확장 (Bash 4.4+)

`${var@operator}` 형식의 변환 확장은 Bash 4.4에서 도입되었습니다.

```bash
STR="Hello World"

echo "${STR@U}"   # HELLO WORLD (대문자)
echo "${STR@L}"   # hello world (소문자)
echo "${STR@Q}"   # 'Hello World' (쉘 인용 형식)
echo "${STR@E}"   # 이스케이프 시퀀스 해석
echo "${STR@a}"   # 변수 속성 플래그 (배열이면 a, 읽기전용이면 r 등)

# 실용 예: 로그 출력 시 변수 안전하게 인용
log() { echo "$(date) [INFO] ${1@Q}"; }
log "사용자 입력: $(cat /tmp/input)"
```

## 실전 패턴: 필수 변수 검사 함수

```bash
#!/usr/bin/env bash

check_required_vars() {
  local missing=0
  for var in "$@"; do
    if [[ -z "${!var}" ]]; then
      echo "오류: 환경변수 $var 가 설정되지 않았습니다" >&2
      missing=1
    fi
  done
  return $missing
}

check_required_vars DB_HOST DB_PORT DB_NAME || exit 1

# 기본값이 있는 옵션 변수
WORKERS=${WORKERS:-4}
TIMEOUT=${TIMEOUT:-30}
LOG_LEVEL=${LOG_LEVEL:-info}
```

파라미터 확장은 외부 명령어(sed, awk, cut 등)를 호출하지 않아도 되므로 **서브셸 생성 비용 없이** 빠르게 동작합니다. 특히 루프 안에서 문자열을 처리할 때 성능 차이가 큽니다.

---

**지난 글:** [Bash 문자열 조작](/posts/bash-string-manipulation/)

**다음 글:** [trap으로 시그널 처리와 정리](/posts/bash-trap-cleanup/)

<br>
읽어주셔서 감사합니다. 😊
