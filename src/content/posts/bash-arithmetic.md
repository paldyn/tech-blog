---
title: "Bash 산술 연산"
description: "Bash에서 정수 산술을 수행하는 (( )), $(( )), let, expr 방식을 비교합니다. 산술 연산자, 비트 연산, 진법 변환, bc를 이용한 부동소수점 계산, awk와의 조합을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["bash", "arithmetic", "integer", "bc", "bitwise", "shell", "linux", "scripting"]
featured: false
draft: false
---

[지난 글](/posts/bash-process-substitution/)에서 프로세스 치환으로 명령 출력을 파일처럼 사용하는 방법을 살펴봤습니다. 이번엔 Bash 스크립트에서 숫자를 다루는 방법을 정리합니다. Bash는 기본적으로 정수만 지원하며, 소수점 계산은 `bc`나 `awk`에 위임해야 합니다.

## (( )) — 산술 확장 (권장)

정수 산술에서 가장 간결하고 빠른 방법입니다. `$` 없이 변수를 참조할 수 있습니다.

```bash
x=10
(( x += 5 ))    # x = 15
(( x++ ))       # x = 16 (후위 증가)
(( ++x ))       # x = 17 (전위 증가)

# 결과를 변수에 저장
result=$(( x * 2 ))

# 조건으로 사용 — 0이면 거짓, 1 이상이면 참
if (( x > 10 )); then
    echo "$x는 10 초과"
fi

# 삼항 연산자
max=$(( a > b ? a : b ))
```

![Bash 산술 연산 방법](/assets/posts/bash-arithmetic-methods.svg)

## 연산자 정리

```bash
# 사칙연산
echo $(( 10 + 3 ))   # 13
echo $(( 10 - 3 ))   # 7
echo $(( 10 * 3 ))   # 30
echo $(( 10 / 3 ))   # 3  (정수 나눗셈)
echo $(( 10 % 3 ))   # 1  (나머지)
echo $(( 2 ** 10 ))  # 1024 (거듭제곱)

# 비트 연산
echo $(( 0xFF & 0x0F ))   # 15  (AND)
echo $(( 1 | 2 ))         # 3   (OR)
echo $(( 3 ^ 5 ))         # 6   (XOR)
echo $(( ~0 ))             # -1  (NOT)
echo $(( 1 << 4 ))        # 16  (좌측 시프트)
echo $(( 256 >> 4 ))      # 16  (우측 시프트)
```

## 진법 표기

```bash
# 16진수, 8진수 입력
echo $(( 0xFF ))      # 255
echo $(( 017 ))       # 15
echo $(( 2#1010 ))    # 10  (2진수)
echo $(( 16#1F ))     # 31  (명시적 16진)

# printf로 출력 진법 변환
printf "0x%X\n" 255   # 0xFF
printf "0o%o\n" 255   # 0o377
printf "0b%b\n" 255   # 0b11111111 (일부 환경)
```

## 소수점 계산 — bc

Bash 산술은 정수 전용입니다. 소수점 계산이 필요하면 `bc` 명령을 사용합니다.

```bash
# scale = 소수점 자리수
pi=$(bc <<< "scale=6; 4*a(1)")    # atan(1)*4 = pi

# 기본 계산
rate=$(bc <<< "scale=2; 75 / 100 * 360")
echo "75% = ${rate}도"

# 표현식을 변수로
used=750
total=1024
pct=$(bc <<< "scale=1; $used * 100 / $total")
echo "사용률: ${pct}%"
```

`bc`에서 `scale`을 설정하지 않으면 정수 나눗셈처럼 소수 부분이 버려집니다.

![산술 연산 실전 패턴](/assets/posts/bash-arithmetic-patterns.svg)

## awk를 이용한 부동소수

```bash
# awk는 부동소수점 연산 기본 지원
awk 'BEGIN { printf "%.4f\n", 22/7 }'   # 3.1429

# 변수 전달
awk -v a=3.14 -v b=2.0 'BEGIN { printf "%.2f\n", a * b }'

# 스크립트 안에서
result=$(awk "BEGIN { printf \"%.2f\", $val / 100 }")
```

## printf로 정수 포매팅

```bash
n=42
printf "%05d\n" $n     # 00042 (5자리, 0 패딩)
printf "%+d\n"  $n     # +42 (부호 표시)
printf "%-10d|\n" $n   # 42        | (좌측 정렬)
printf "%x\n" 255      # ff (소문자 16진)
printf "%X\n" 255      # FF (대문자 16진)
printf "%08b\n" 42     # 00101010 (2진, bash printf 한정)
```

## 실전 예제 — 파일 크기 단위 변환

```bash
#!/usr/bin/env bash
human_size() {
    local bytes=$1
    if (( bytes >= 1073741824 )); then
        bc <<< "scale=1; $bytes / 1073741824" | xargs -I{} echo "{}G"
    elif (( bytes >= 1048576 )); then
        bc <<< "scale=1; $bytes / 1048576" | xargs -I{} echo "{}M"
    elif (( bytes >= 1024 )); then
        echo "$(( bytes / 1024 ))K"
    else
        echo "${bytes}B"
    fi
}

for f in /var/log/*.log; do
    size=$(stat -c%s "$f")
    echo "$(human_size $size)  $f"
done
```

---

**지난 글:** [Bash 프로세스 치환](/posts/bash-process-substitution/)

**다음 글:** [Bash 문자열 조작](/posts/bash-string-manipulation/)

<br>
읽어주셔서 감사합니다. 😊
