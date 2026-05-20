---
title: "awk 필드와 레코드"
description: "awk의 FS/OFS/RS/ORS 구분자 설정, 필드 수정과 $0 재구성, NR vs FNR로 여러 파일 처리, 연관 배열, 그리고 실전 조인 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["awk", "fields", "records", "FS", "OFS", "NR", "FNR", "linux", "text-processing"]
featured: false
draft: false
---

[지난 글](/posts/linux-awk-basics/)에서 awk의 기본 구조와 내장 변수를 살펴봤습니다. 이번엔 awk의 핵심인 **필드 분리 메커니즘**을 더 깊게 다룹니다. FS, OFS, RS 구분자를 자유자재로 다루면 CSV, TSV, 단락 구분 문서 등 다양한 형식을 처리할 수 있습니다.

## FS: 필드 구분자 심화

기본 FS는 공백이며, 이 경우 앞뒤 공백을 제거하고 연속 공백을 하나로 처리하는 특수 동작을 합니다.

```bash
# -F 옵션으로 설정
awk -F: '{print $1}' /etc/passwd
awk -F, '{print $2}' data.csv
awk -F'\t' '{print $3}' data.tsv

# BEGIN에서 설정 (같은 효과)
awk 'BEGIN{FS=":"} {print $1}' /etc/passwd

# 정규식 구분자
awk -F'[,;|]' '{print $1}' mixed.txt   # 쉼표, 세미콜론, 파이프
awk -F'  +' '{print $2}' aligned.txt  # 2개 이상 공백

# 멀티 캐릭터 구분자
awk -F'::' '{print $1}' file.txt
```

FS를 빈 문자열(`""`)로 설정하면 각 문자가 별도 필드가 됩니다.

## OFS: 출력 필드 구분자

OFS는 `print`에서 쉼표로 나열된 필드 사이에 삽입되는 구분자입니다.

```bash
# 기본값은 공백 한 칸
awk '{print $1, $2}' file   # $1 $2

# CSV로 출력
awk 'BEGIN{OFS=","} {print $1, $2, $3}' data.txt

# 핵심: $1=$1 트릭으로 $0 전체 재구성
awk -F: 'BEGIN{OFS="|"} {$1=$1; print}' /etc/passwd
# $1=$1 은 값을 바꾸지 않지만 awk가 $0을 OFS로 재구성하게 만듦
```

필드를 직접 수정하면 awk는 $0을 자동으로 OFS를 사용해 재구성합니다.

![awk 필드 분리 메커니즘](/assets/posts/linux-awk-fields-diagram.svg)

## RS: 레코드 구분자

RS를 변경하면 줄이 아닌 다른 단위로 레코드를 처리할 수 있습니다.

```bash
# 빈 줄로 구분된 단락 처리
awk 'BEGIN{RS=""; FS="\n"} {
  print "단락 시작:"
  for (i=1; i<=NF; i++) print "  줄", i":", $i
  print "---"
}' paragraphs.txt

# 특정 구분자로 분리
awk 'BEGIN{RS="=====\n"} {
  print NR"번째 섹션:", NF, "줄"
}' sections.txt

# 단일 문자 레코드 (각 문자를 레코드로)
awk 'BEGIN{RS=""} NR==1{gsub(/./,"&\n"); print}' <<< "hello"
```

## NR vs FNR: 여러 파일 처리

여러 파일을 awk에 전달할 때 NR은 전체 누적 번호, FNR은 현재 파일 내 번호입니다.

```bash
awk '{print FILENAME, NR, FNR, $0}' file1.txt file2.txt
# file1.txt  1  1  첫 줄
# file1.txt  2  2  두 번째 줄
# file2.txt  3  1  file2의 첫 줄  ← FNR은 1로 리셋

# 첫 번째 파일에서만 조건 처리
awk 'NR==FNR { ... ; next } { ... }' first.txt second.txt
# NR==FNR은 첫 번째 파일 처리 중일 때만 true
```

## 연관 배열과 조인 패턴

awk의 연관 배열(associative array)은 두 파일을 조인하는 데 유용합니다.

```bash
# 파일 1 (prices.txt): id  price
# 파일 2 (items.txt):  id  name
# 결과: name  price

awk '
  NR==FNR {
    price[$1] = $2    # id → price 매핑 저장
    next              # 두 번째 파일로 넘어가지 않음
  }
  {
    print $2, price[$1]   # 두 번째 파일에서 조인
  }
' prices.txt items.txt
```

![awk 여러 파일 처리 패턴](/assets/posts/linux-awk-multifile.svg)

## 필드 수정

```bash
# 특정 필드 값 변경
awk '{$2 = $2 * 1.1; print}' prices.txt   # 가격 10% 인상

# 새 필드 추가
awk '{$(NF+1) = "NEW"; print}' data.txt

# 필드 삭제 (빈 문자열로)
awk 'BEGIN{OFS=","} {$3=""; $1=$1; print}' data.csv

# 조건부 필드 변경
awk '{if ($3 > 100) $3 = $3 * 0.9; print}' prices.txt
```

## 실전: /etc/passwd 분석

```bash
# 로그인 가능한 사용자 (쉘이 /bin/bash 또는 /bin/sh)
awk -F: '$7 ~ /\/(ba)?sh$/ {print $1}' /etc/passwd

# UID 범위별 사용자 수 집계
awk -F: '
  $3 >= 1000 { user++ }
  $3 < 1000 && $3 >= 1 { sys++ }
  END { print "사용자:", user, "시스템:", sys }
' /etc/passwd

# 홈 디렉터리 목록 (중복 제거)
awk -F: '!seen[$6]++ {print $6}' /etc/passwd
```

`!seen[$6]++` 패턴은 awk에서 중복 제거의 관용구입니다. 배열에 없는 키면 0(false)이라 `!`에 의해 true가 되고, 그 후 값이 1로 증가합니다. 다음에 같은 키가 나오면 이미 1이므로 `!1`은 false가 됩니다.

---

**지난 글:** [awk 기초](/posts/linux-awk-basics/)

**다음 글:** [awk 내장 함수](/posts/linux-awk-builtin-functions/)

<br>
읽어주셔서 감사합니다. 😊
