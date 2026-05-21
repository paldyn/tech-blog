---
title: "sort · uniq — 정렬과 중복 제거"
description: "sort의 숫자/필드/다중 키 정렬과 uniq의 중복 집계·필터링을 파이프라인 패턴으로 익히고, 로그 분석에 바로 쓸 수 있는 실전 조합을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["sort", "uniq", "텍스트처리", "Linux", "쉘", "로그분석"]
featured: false
draft: false
---

[지난 글](/posts/linux-cut-paste-join/)에서 열 단위 텍스트 처리 도구인 cut, paste, join을 살펴봤습니다. 이번에는 데이터를 순서대로 나열하는 `sort`와 인접 중복을 제거하거나 집계하는 `uniq`를 다룹니다. 두 명령어는 항상 파이프로 연결돼 쓰이며, 로그 분석·빈도 집계·집합 연산에서 빠지지 않는 조합입니다.

![sort · uniq 개념과 파이프라인](/assets/posts/linux-sort-uniq-overview.svg)

## sort — 텍스트 정렬의 모든 것

`sort`는 파일의 각 줄을 기준에 따라 정렬합니다. 기본값은 사전식(lexicographic) 오름차순입니다.

```bash
# 기본: 사전식 오름차순
sort names.txt

# 숫자 정렬 (-n)
sort -n numbers.txt

# 역방향 (-r)
sort -r names.txt

# 숫자 역방향 (가장 큰 값 먼저)
sort -rn numbers.txt
```

### 필드 기준 정렬: -k

`-k` 옵션은 정렬 기준 필드를 지정합니다. `-k2`는 2번 필드 시작부터 줄 끝까지를 기준으로 삼습니다. 단일 필드만 비교하려면 `-k2,2`처럼 시작과 끝 필드를 동일하게 씁니다.

```bash
# 콜론 구분, 3번 필드(UID) 숫자 정렬
sort -t: -k3 -n /etc/passwd

# 2번 필드 숫자 역순, 동점이면 1번 필드 사전순
sort -t, -k2rn -k1 data.csv
```

### 다중 키 정렬

`-k` 옵션을 여러 번 쓰면 우선순위 순서로 정렬 기준이 적용됩니다.

```bash
# 국가 오름차순 → 같은 국가면 점수 내림차순
sort -k2,2 -k3rn scores.csv
```

### 파일에 직접 저장: -o

```bash
# 제자리 정렬 (sort file > file 은 file을 먼저 지움 — 위험)
sort -o file.txt file.txt
```

`sort file.txt > file.txt`는 리다이렉션이 파일을 먼저 빈 파일로 만들기 때문에 입력 데이터가 사라집니다. `-o` 옵션은 안전하게 같은 파일에 결과를 씁니다.

### 사람 읽기형 크기 정렬: -h

```bash
# df, du 출력의 용량 순 정렬
du -sh /var/* | sort -h

# 내림차순
du -sh /var/* | sort -rh
```

### 안정 정렬: -s

```bash
# 이미 정렬된 입력에서 2번 필드만 추가 정렬 (나머지 순서 보존)
sort -s -k2,2 already_sorted.txt
```

---

## uniq — 인접 중복 처리

`uniq`는 **인접한 동일한 줄**을 처리합니다. 떨어져 있는 중복 줄은 제거하지 않으므로 반드시 `sort`를 먼저 실행해야 합니다.

```bash
# 기본: 인접 중복 줄 제거
sort file.txt | uniq

# sort -u 는 sort | uniq 와 동일
sort -u file.txt
```

### -c: 빈도 집계

```bash
# 각 줄이 몇 번 등장하는지 앞에 붙여 출력
sort words.txt | uniq -c
```

출력 형식은 `   횟수 줄내용`이며, 앞에 공백이 붙습니다. `awk '{print $2, $1}'`로 열을 바꿀 수 있습니다.

### -d / -u: 중복 여부로 필터링

```bash
# 두 번 이상 등장한 줄만 출력
sort file.txt | uniq -d

# 정확히 한 번만 등장한 줄 출력
sort file.txt | uniq -u
```

두 명령어를 합치면 교집합·차집합을 구할 수 있습니다.

```bash
# file1에만 있는 줄 (차집합 A - B)
sort file1.txt file2.txt file2.txt | uniq -u

# 두 파일 모두에 있는 줄 (교집합)
sort file1.txt file2.txt | uniq -d
```

### -i: 대소문자 무시

```bash
sort tags.txt | uniq -ic
```

![sort · uniq 실전 코드 패턴](/assets/posts/linux-sort-uniq-code.svg)

## 실전 로그 분석 패턴

```bash
# 접속 로그에서 IP별 요청 횟수 (내림차순 TOP 20)
awk '{print $1}' /var/log/nginx/access.log \
  | sort | uniq -c | sort -rn | head -20

# HTTP 상태 코드 빈도
awk '{print $9}' /var/log/nginx/access.log \
  | sort | uniq -c | sort -rn

# 오늘 로그인한 사용자 목록 (중복 없이)
last | awk '{print $1}' | sort -u | grep -v 'wtmp\|reboot\|^$'
```

### 두 파일 비교

```bash
# 공통 줄 찾기
sort a.txt > a_sorted.txt
sort b.txt > b_sorted.txt
sort a_sorted.txt b_sorted.txt | uniq -d

# a.txt에는 있지만 b.txt에는 없는 줄
sort a_sorted.txt b_sorted.txt b_sorted.txt | uniq -u
```

## 성능 팁

대용량 파일 정렬 시 메모리와 임시 디렉터리를 지정하면 속도를 올릴 수 있습니다.

```bash
# 4GB 메모리 사용, SSD 임시 디렉터리 지정
sort -S 4G -T /tmp/fastsort bigfile.txt

# 병렬 정렬 (CPU 코어 활용)
sort --parallel=4 -n bigfile.txt
```

## 정리

| 명령어 | 핵심 역할 |
|--------|-----------|
| `sort -n` | 숫자 정렬 |
| `sort -k N,N` | N번 단일 필드 기준 정렬 |
| `sort -u` | 정렬 + 중복 제거 |
| `sort \| uniq -c` | 빈도 집계 |
| `sort \| uniq -d` | 중복 줄만 필터 |
| `sort \| uniq -u` | 고유 줄만 필터 |

`sort | uniq -c | sort -rn | head`는 어떤 데이터든 빈도 분석의 첫 번째 도구로 기억해 두세요.

---

**지난 글:** [cut · paste · join — 열 기반 텍스트 처리](/posts/linux-cut-paste-join/)

**다음 글:** [tr · fold · fmt — 문자 변환과 줄 포맷](/posts/linux-tr-fold-fmt/)

<br>
읽어주셔서 감사합니다. 😊
