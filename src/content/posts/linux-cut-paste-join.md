---
title: "cut · paste · join — 열 기반 텍스트 처리"
description: "cut으로 특정 필드·바이트를 추출하고, paste로 파일을 열 방향으로 합치며, join으로 공통 키로 두 파일을 결합하는 방법을 실전 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["cut", "paste", "join", "텍스트처리", "Linux", "쉘"]
featured: false
draft: false
---

[지난 글](/posts/linux-awk-builtin-functions/)에서 awk의 내장 함수와 사용자 정의 함수를 살펴봤습니다. 이번 글에서는 열(column) 단위로 데이터를 자르고 붙이는 세 가지 명령어 `cut`, `paste`, `join`을 다룹니다. 세 명령어 모두 CSV, TSV, passwd 같은 구조화된 텍스트 파일을 다룰 때 파이프라인의 핵심 도구가 됩니다.

![cut · paste · join 개념 다이어그램](/assets/posts/linux-cut-paste-join-overview.svg)

## cut — 원하는 열만 추출하기

`cut`은 텍스트의 각 줄에서 **필드(-f), 문자(-c), 바이트(-b)** 단위로 필요한 부분만 잘라냅니다.

```bash
# 콜론을 구분자로, 1번 필드(사용자명)만 추출
cut -d: -f1 /etc/passwd

# CSV의 1~3번 열
cut -d, -f1-3 data.csv

# 1번, 3번, 5번 열 (비연속)
cut -d, -f1,3,5 data.csv

# 3번 필드부터 끝까지
cut -d: -f3- /etc/passwd

# 처음부터 3번 필드까지
cut -d: -f-3 /etc/passwd

# 바이트 위치 기준 (syslog의 타임스탬프 15자)
cut -b1-15 /var/log/syslog
```

필드 번호 범위 지정 규칙은 직관적입니다. `-f3-`는 3번부터 끝까지, `-f-3`는 처음부터 3번까지, `-f2,4`는 2번과 4번을 각각 선택합니다.

### --complement: 특정 열만 제외하기

```bash
# 2번 열만 제외하고 나머지 출력
cut -d, --complement -f2 data.csv
```

### 탭 구분자 다루기

기본 구분자는 탭(`\t`)입니다. `-d` 없이 사용하면 탭으로 분리된 파일에서 동작합니다.

```bash
# 탭 구분 파일의 2번 필드
cut -f2 scores.tsv
```

### cut의 한계

`cut`은 **연속된 구분자를 하나로 취급하지 않습니다.** 여러 공백으로 정렬된 파일은 `awk '{print $1}'` 방식이 적합합니다.

---

## paste — 파일을 열 방향으로 합치기

`paste`는 여러 파일의 같은 줄 번호의 행을 가로로 이어붙입니다. 기본 구분자는 탭이며 `-d`로 변경할 수 있습니다.

```bash
# names.txt와 scores.txt를 탭으로 병합
paste names.txt scores.txt

# 세 파일을 쉼표로 병합
paste -d, a.txt b.txt c.txt

# 여러 구분자를 순환 적용
paste -d':,' a.txt b.txt c.txt
```

### -s: 파일 행을 하나의 줄로 합치기

```bash
# list.txt의 각 행을 쉼표 구분으로 한 줄에
paste -s -d, list.txt
```

예를 들어, 한 줄에 하나씩 적힌 IP 목록을 `192.168.1.1,192.168.1.2,...` 형식으로 만들 때 유용합니다.

```bash
# /etc/hosts에서 IP 목록 추출 후 쉼표 합산
grep -v '^#' /etc/hosts | awk '{print $1}' | paste -s -d,
```

---

## join — 공통 키로 두 파일 결합하기

`join`은 SQL의 INNER JOIN과 유사합니다. **두 파일 모두 미리 정렬**되어 있어야 정확히 동작합니다.

```bash
# 기본: 두 파일의 1번 필드를 키로 join
sort users.txt -o users.txt
sort roles.txt -o roles.txt
join users.txt roles.txt
```

프로세스 치환을 쓰면 원본 파일을 덮지 않고 정렬할 수 있습니다.

```bash
join <(sort users.txt) <(sort roles.txt)
```

### 필드 번호 지정

```bash
# file1의 2번 필드와 file2의 1번 필드를 키로
join -1 2 -2 1 file1.txt file2.txt
```

### Outer JOIN (일치 없는 행도 출력)

```bash
# LEFT OUTER JOIN (file1의 매칭 안 된 행도 포함)
join -a 1 <(sort users.txt) <(sort roles.txt)

# FULL OUTER JOIN
join -a 1 -a 2 <(sort users.txt) <(sort roles.txt)
```

### 출력 필드 제어

```bash
# 키, file1의 2번, file2의 2번만 출력
join -o 1.1,1.2,2.2 <(sort users.txt) <(sort roles.txt)
```

![cut · paste · join 실전 코드 예시](/assets/posts/linux-cut-paste-join-code.svg)

## 세 명령어 조합 실전 예제

```bash
# /etc/passwd에서 사용자명:UID만 추출하여 CSV로
cut -d: -f1,3 /etc/passwd | tr ':' ','

# 두 CSV 파일의 첫 번째 컬럼 키로 JOIN 후 3번 열만 추출
join <(sort -t, -k1 a.csv) <(sort -t, -k1 b.csv) | cut -d' ' -f3

# 로그에서 날짜 컬럼 제거 (1~15바이트)
cat access.log | cut -b16-
```

### 간단한 리포트 생성

```bash
# 사용자명과 홈디렉터리만 추출해 파일로 저장
cut -d: -f1,6 /etc/passwd | paste - - | sort > user_homes.txt
```

`-`는 표준입력을 파일 인수로 사용하는 관례입니다. `paste`에 `-`를 두 번 쓰면 두 줄씩 짝지어 한 줄로 합칩니다.

## 정리

| 명령어 | 핵심 역할 | 주의점 |
|--------|-----------|--------|
| `cut` | 각 줄에서 열/바이트 추출 | 연속 공백 처리 못함 |
| `paste` | 여러 파일 행을 가로 병합 | 파일 길이가 다르면 빈 칸 |
| `join` | 공통 키 기준 두 파일 결합 | 사전 정렬 필수 |

세 명령어 모두 파이프와 조합할 때 진가를 발휘합니다. 특히 `sort | join`은 대용량 로그를 SQL 없이 관계 연산하는 강력한 조합입니다.

---

**다음 글:** [sort · uniq — 정렬과 중복 제거](/posts/linux-sort-uniq/)

<br>
읽어주셔서 감사합니다. 😊
