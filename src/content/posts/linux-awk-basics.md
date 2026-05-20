---
title: "awk 기초"
description: "awk의 프로그램 구조(BEGIN/main/END), 내장 변수(NR/NF/FS/OFS), 필드 접근, 패턴 매칭, 조건문, 반복문, 그리고 CSV 처리 실전 예제를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 8
type: "knowledge"
category: "Linux"
tags: ["awk", "gawk", "linux", "text-processing", "csv", "shell", "scripting"]
featured: false
draft: false
---

[지난 글](/posts/linux-sed-substitute/)에서 sed 치환 패턴을 정리했습니다. sed가 스트림 편집기라면, `awk`는 구조화된 텍스트를 처리하는 **작은 프로그래밍 언어**입니다. 컬럼 기반 데이터, CSV, 로그 파일 분석에 sed보다 훨씬 강력합니다.

## awk 프로그램 구조

awk 프로그램은 `pattern { action }` 블록의 연속입니다. 각 블록은 패턴이 매칭되는 줄에 대해 action을 실행합니다.

```bash
# 기본 구조
awk 'pattern { action }' file

# BEGIN: 입력 읽기 전 실행 (초기화)
# 패턴+액션: 각 줄에 대해 반복
# END: 입력 끝난 후 실행 (집계, 요약)

awk '
  BEGIN { print "이름 목록:" }
  { print $1 }
  END   { print "총", NR, "명" }
' users.txt
```

패턴 없이 `{ action }`만 쓰면 모든 줄에 적용됩니다. `{ print }`는 `{ print $0 }`와 동일하며 현재 줄 전체를 출력합니다.

![awk 프로그램 구조](/assets/posts/linux-awk-structure.svg)

## 필드 접근

awk는 각 줄을 필드(field)로 자동 분리합니다. 기본 구분자는 공백(연속 공백도 하나로 처리)입니다.

```bash
# $1 = 첫 번째 필드, $2 = 두 번째 필드 ...
# $0 = 전체 줄, $NF = 마지막 필드

echo "Alice 30 Engineer Seoul" | awk '{print $1, $3}'
# Alice Engineer

# 마지막 필드
echo "a b c d e" | awk '{print $NF}'    # e
echo "a b c d e" | awk '{print $(NF-1)}' # d
```

`-F` 옵션으로 구분자를 변경합니다.

```bash
# 콜론 구분 (/etc/passwd)
awk -F: '{print $1, $7}' /etc/passwd

# CSV (쉼표)
awk -F, '{print $1, $3}' data.csv

# 탭 구분
awk -F'\t' '{print $2}' tsv_file.txt

# 정규식 구분자
awk -F'[,;]' '{print $1}' file.txt
```

## 내장 변수

![awk 내장 변수](/assets/posts/linux-awk-variables.svg)

```bash
# NR: 전체 레코드 번호 (여러 파일에 걸쳐 누적)
# FNR: 현재 파일 내 레코드 번호

# 헤더 줄 건너뛰기
awk 'NR>1 {print $2}' data.csv

# 특정 줄 범위
awk 'NR>=10 && NR<=20' file.txt

# OFS: 출력 구분자
awk -F: 'BEGIN{OFS=","} {print $1,$3,$7}' /etc/passwd
```

## 패턴 매칭

```bash
# 문자열 포함
awk '/error/' app.log           # error 포함 줄

# 반전
awk '!/^#/' config.txt          # 주석 아닌 줄

# 필드 값 비교
awk '$3 > 100' data.txt         # 3번째 필드가 100 초과
awk '$1 == "Alice"' users.txt   # 1번째 필드가 Alice

# 범위 패턴
awk '/START/,/END/' file.txt    # START ~ END 사이 줄

# 정규식으로 특정 필드 매칭
awk '$2 ~ /^[0-9]+$/' file.txt  # 2번째 필드가 숫자만
awk '$2 !~ /error/' log.txt     # 2번째 필드에 error 없는 줄
```

## 조건문과 반복문

awk는 C 유사 문법을 지원합니다.

```bash
# if-else
awk '{
  if ($3 > 100)
    print $1, "높음"
  else
    print $1, "낮음"
}' data.txt

# for 루프로 각 필드 출력
awk '{
  for (i=1; i<=NF; i++)
    printf "필드%d: %s\n", i, $i
}' file.txt

# while 루프
awk 'BEGIN {
  i = 1
  while (i <= 5) {
    print i
    i++
  }
}'
```

## 변수와 연산

```bash
# 합계 계산
awk '{sum += $2} END {print "합계:", sum}' data.txt

# 평균
awk '{sum += $2} END {print "평균:", sum/NR}' data.txt

# 최댓값
awk 'BEGIN{max=-999} $1>max{max=$1} END{print max}' nums.txt

# 카운트
awk '/error/{count++} END{print count, "errors"}' log.txt
```

## 출력 형식

```bash
# printf로 포맷 출력
awk '{printf "%-20s %5d\n", $1, $2}' data.txt

# 파일로 출력
awk '{print > "output.txt"}' input.txt

# 여러 파일로 분리
awk '{print > $3 ".txt"}' data.txt   # 3번째 필드를 파일명으로
```

awk는 sed로는 어려운 집계, 카운트, 조건 분기, 여러 파일 조인 같은 작업에 특히 강합니다. 간단한 한 줄 처리부터 수십 줄 스크립트까지 유연하게 활용할 수 있습니다.

---

**지난 글:** [sed 치환과 주소 지정](/posts/linux-sed-substitute/)

**다음 글:** [awk 필드와 레코드](/posts/linux-awk-fields-records/)

<br>
읽어주셔서 감사합니다. 😊
