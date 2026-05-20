---
title: "awk 내장 함수"
description: "awk의 문자열 함수(gsub/sub/split/substr/match/sprintf), 수학 함수, I/O 함수, gensub 캡처 그룹, 그리고 사용자 정의 함수 작성법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["awk", "gawk", "builtin-functions", "gsub", "split", "gensub", "linux", "text-processing"]
featured: false
draft: false
---

[지난 글](/posts/linux-awk-fields-records/)에서 awk의 필드/레코드 처리와 연관 배열을 살펴봤습니다. 이번엔 awk를 더욱 강력하게 만드는 **내장 함수들**을 정리합니다. 문자열 조작, 수학 연산, I/O 함수와 함께 직접 함수를 정의하는 방법까지 다룹니다.

## 문자열 함수

### gsub / sub

```bash
# gsub: 전체 치환 (global substitution)
# 반환값: 치환 횟수
awk '{gsub(/foo/, "bar"); print}' file.txt

# sub: 첫 번째만 치환
awk '{sub(/^[[:space:]]+/, ""); print}' file.txt   # 앞 공백 제거

# 특정 필드만 치환
awk '{gsub(/:/, "-", $3); print}' file.txt   # 3번째 필드에서만

# & 는 매칭 문자열 참조
awk '{gsub(/[0-9]+/, "[&]"); print}' file.txt
# 123 → [123]
```

### substr / index / length

```bash
# substr(string, start, length) — 1 기반 인덱스
echo "Hello World" | awk '{print substr($0, 1, 5)}'   # Hello
echo "Hello World" | awk '{print substr($0, 7)}'       # World (끝까지)

# index(string, target) — 위치 반환 (없으면 0)
awk '{pos = index($0, "error"); if (pos > 0) print pos, $0}' log.txt

# length — 배열에도 사용 가능
awk '{print length($1), $1}' file.txt
awk 'END{print length(arr)}' file.txt   # 배열 크기
```

### split

```bash
# split(string, array, separator) — 요소 수 반환
awk '{
  n = split($1, parts, "-")
  for (i=1; i<=n; i++) print i":", parts[i]
}' <<< "2026-05-21"
# 1: 2026
# 2: 05
# 3: 21

# 정규식 구분자
awk '{n = split($0, a, /[,;]/); print n}' file.txt
```

### match

```bash
# match(string, regex) — 매칭 위치 반환 (없으면 0)
# RSTART: 매칭 시작 위치, RLENGTH: 매칭 길이

awk '{
  if (match($0, /[0-9]{4}/)) {
    print "연도:", substr($0, RSTART, RLENGTH)
  }
}' file.txt
```

### sprintf

```bash
# 포맷 지정 문자열 반환 (printf와 동일 형식, 출력 안 함)
awk '{
  formatted = sprintf("%-20s %6.2f", $1, $2)
  print formatted
}' prices.txt

# 숫자를 0 패딩 문자열로
awk '{print sprintf("%05d", $1)}' nums.txt
```

### tolower / toupper

```bash
awk '{print tolower($0)}' file.txt
awk '{print toupper($1), $2}' file.txt

# 대소문자 무시 비교
awk 'tolower($1) == "error"' log.txt
```

![awk 내장 함수 레퍼런스](/assets/posts/linux-awk-functions-table.svg)

## gensub: 캡처 그룹 지원 (gawk 전용)

`gsub`/`sub`는 캡처 그룹을 지원하지 않지만, gawk의 `gensub`은 지원합니다.

```bash
# gensub(regex, replacement, how, target)
# how: "g" = 전체, "1"/"2"... = N번째

# 단어를 대괄호로 감싸기
awk '{print gensub(/([a-z]+)/, "[\\1]", "g")}' <<< "hello world"
# [hello] [world]

# 이름 앞뒤 반전
echo "Kim Minsu" | gawk '{print gensub(/(\w+) (\w+)/, "\\2 \\1", 1)}'
# Minsu Kim

# 날짜 형식 변환
echo "2026-05-21" | gawk '{print gensub(/([0-9]+)-([0-9]+)-([0-9]+)/, "\\3/\\2/\\1", 1)}'
# 21/05/2026
```

gensub은 원본을 수정하지 않고 결과를 반환하므로 `print gensub(...)`처럼 사용합니다.

## 수학 함수

```bash
# int: 정수 변환 (버림)
awk '{print int($1 / 3)}' nums.txt

# sqrt, exp, log
awk 'BEGIN{print sqrt(2), exp(1), log(2)}'

# rand + srand: 난수
awk 'BEGIN{
  srand()    # 시드 초기화 (time 기반)
  for (i=1; i<=5; i++)
    print int(rand() * 100)   # 0~99 난수
}'

# 반올림 (내장 함수 없음)
awk '{rounded = int($1 + 0.5); print rounded}' file.txt
```

## I/O 함수

```bash
# getline: 파일에서 한 줄 읽기
awk '{
  while ((getline line < "other.txt") > 0)
    print line
}' NR==1 input.txt

# 파이프로 읽기
awk '{
  cmd = "date -d " $1 " +%Y-%m-%d"
  cmd | getline result
  close(cmd)
  print result
}' dates.txt

# system: 셸 명령 실행
awk '{system("mkdir -p " $1)}' dirs.txt
```

## 사용자 정의 함수

![awk 내장 함수 실전 예제](/assets/posts/linux-awk-functions-code.svg)

```bash
awk '
function max(a, b) {
  return (a > b) ? a : b
}

function trim(s,    result) {    # result는 로컬 변수
  gsub(/^[[:space:]]+|[[:space:]]+$/, "", s)
  return s
}

function zero_pad(n, width,    fmt) {
  fmt = sprintf("%%0%dd", width)
  return sprintf(fmt, n)
}

{
  printf "%s: max=%d, name=%s\n",
    zero_pad(NR, 4), max($1, $2), trim($3)
}
' data.txt
```

awk 함수에서 로컬 변수는 매개변수 목록 뒤에 공백을 여러 개 두고 선언하는 관용구를 씁니다. awk는 선언되지 않은 변수를 모두 전역으로 처리하기 때문입니다.

## 실전: 로그 분석 스크립트

```bash
# access.log: IP method URL status bytes
awk '
BEGIN {
  print "=== 상태 코드별 카운트 ==="
}
{
  status[$9]++
  bytes[$9] += $10
}
END {
  for (code in status)
    printf "%-6s %5d 요청  %s bytes\n",
      code, status[code],
      sprintf("%.1fK", bytes[code]/1024)
}
' /var/log/nginx/access.log | sort
```

awk의 내장 함수들을 조합하면 Python이나 Perl 없이도 복잡한 텍스트 처리와 분석을 처리할 수 있습니다. 특히 로그 집계, 보고서 생성, 데이터 형식 변환에서 한 줄이나 간단한 스크립트로 강력한 결과를 얻을 수 있습니다.

---

**지난 글:** [awk 필드와 레코드](/posts/linux-awk-fields-records/)

<br>
읽어주셔서 감사합니다. 😊
