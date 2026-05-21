---
title: "tr · fold · fmt — 문자 변환과 줄 포맷"
description: "tr로 문자를 변환·삭제·압축하고, fold로 줄 길이를 강제 제한하며, fmt로 문단을 리플로우하는 방법을 실전 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 3
type: "knowledge"
category: "Linux"
tags: ["tr", "fold", "fmt", "텍스트처리", "Linux", "쉘"]
featured: false
draft: false
---

[지난 글](/posts/linux-sort-uniq/)에서 sort와 uniq로 데이터를 정렬하고 집계하는 방법을 익혔습니다. 이번 글에서는 문자 수준의 변환을 담당하는 `tr`, 그리고 줄 길이를 제어하는 `fold`와 `fmt`를 다룹니다. 세 도구 모두 크기는 작지만 파이프라인에서 꼭 필요한 역할을 합니다.

![tr · fold · fmt 개념 다이어그램](/assets/posts/linux-tr-fold-fmt-overview.svg)

## tr — 문자를 1:1로 변환하기

`tr`(translate)은 표준 입력에서 문자를 읽어 변환하거나 삭제합니다. 파일 인수를 받지 않으므로 반드시 리다이렉션(`<`)이나 파이프로 입력을 넘겨야 합니다.

```bash
# 기본 사용법: SET1의 각 문자를 SET2의 대응 문자로 치환
tr SET1 SET2 < input.txt
```

### 대소문자 변환

```bash
# 소문자로 변환
echo "Hello World" | tr '[:upper:]' '[:lower:]'
# → hello world

# 대문자로 변환
echo "hello world" | tr 'a-z' 'A-Z'
# → HELLO WORLD
```

범위 표현(`a-z`)과 POSIX 문자 클래스(`[:lower:]`) 두 방식 모두 동작합니다. 멀티바이트 문자(한글 등)를 처리할 때는 범위 방식이 예상치 못한 동작을 할 수 있으므로 `[:lower:]` 형식을 권장합니다.

### -d: 문자 삭제

```bash
# 모든 공백 삭제
echo "hello world" | tr -d ' '
# → helloworld

# 숫자 이외 문자 삭제 (-c: 보완 집합)
echo "abc123def456" | tr -cd '[:digit:]'
# → 123456

# 개행 문자 삭제 (여러 줄을 한 줄로)
cat file.txt | tr -d '\n'
```

### -s: 연속 문자 압축

```bash
# 연속 공백을 하나로 압축
echo "a    b     c" | tr -s ' '
# → a b c

# 연속 개행을 하나로 (빈 줄 제거)
cat file.txt | tr -s '\n'
```

### 구분자 변환

```bash
# CSV를 TSV로 변환
tr ',' '\t' < data.csv

# 콜론을 줄바꿈으로 (PATH 목록 표시)
echo $PATH | tr ':' '\n'
```

### 줄 목록을 한 줄로 합치기

```bash
# 한 줄씩 있는 항목을 쉼표 구분 한 줄로
cat items.txt | tr '\n' ',' | sed 's/,$/\n/'
```

`tr '\n' ','`는 파일 끝에도 쉼표가 붙으므로 `sed`로 마지막 쉼표를 제거해 줍니다.

---

## fold — 긴 줄 강제 줄바꿈

`fold`는 지정한 폭을 초과하는 줄을 강제로 잘라 여러 줄로 나눕니다.

```bash
# 80자 폭에서 강제 줄바꿈
fold -w 80 longtext.txt
```

기본적으로 정확히 N번째 바이트에서 줄을 자릅니다. 단어 중간에서도 잘리기 때문에 가독성이 나쁠 수 있습니다.

### -s: 단어 단위 줄바꿈

```bash
# 72자 이내에서 가장 가까운 공백 위치에서 줄바꿈
fold -w 72 -s email.txt
```

이메일 본문이나 문서를 RFC 준수 72자 폭으로 포맷할 때 유용합니다.

### base64 포맷

```bash
# base64로 인코딩 후 76자 MIME 폭으로 분리
base64 attachment.bin | fold -w 76
```

---

## fmt — 문단 리플로우

`fmt`는 단어 단위로 텍스트를 재배치해 지정 폭에 맞춥니다. 빈 줄이 있으면 문단 경계로 인식해 그 사이는 리플로우하지 않습니다.

```bash
# 75자 폭으로 리플로우
fmt -w 75 draft.txt
```

![tr · fold · fmt 실전 패턴](/assets/posts/linux-tr-fold-fmt-code.svg)

### -s: 짧은 줄 보존

```bash
# 이미 짧은 줄은 합치지 않음
fmt -s -w 80 mixed.txt
```

`-s` 없이 쓰면 짧은 줄들을 하나로 합쳐 리플로우합니다. 한 문장 한 줄로 쓴 문서를 보존하려면 `-s`가 필요합니다.

---

## 실전 조합 예제

```bash
# /etc/passwd에서 사용자명 추출 후 쉼표 구분 한 줄로
cut -d: -f1 /etc/passwd | tr '\n' ',' | sed 's/,$/\n/'

# 로그에서 대소문자 무관 ERROR 수 세기
tr '[:upper:]' '[:lower:]' < app.log | grep -c 'error'

# 환경 변수 값의 공백 정리 후 비교
echo "$VALUE" | tr -s ' ' | tr -d '\n'

# 스크립트에서 사용자 입력 정규화
read -r input
normalized=$(echo "$input" | tr '[:upper:]' '[:lower:]' | tr -s ' ')
```

### 패스워드·토큰 생성

```bash
# 무작위 32자 영숫자 문자열 생성
tr -dc '[:alnum:]' < /dev/urandom | head -c 32
```

`/dev/urandom`에서 알파벳과 숫자(`[:alnum:]`) 이외의 문자를 모두 삭제(`-dc`)해 지정 길이만큼 잘라냅니다.

## 정리

| 명령어 | 핵심 역할 | 주의 |
|--------|-----------|------|
| `tr SET1 SET2` | 문자 1:1 변환 | 표준입력 전용 |
| `tr -d SET` | 문자 삭제 | |
| `tr -s SET` | 연속 문자 압축 | |
| `fold -w N` | 강제 줄 자르기 | 단어 중간도 자름 |
| `fold -w N -s` | 단어 단위 줄바꿈 | |
| `fmt -w N` | 문단 리플로우 | 빈 줄이 문단 경계 |

---

**지난 글:** [sort · uniq — 정렬과 중복 제거](/posts/linux-sort-uniq/)

**다음 글:** [wc · nl — 줄/단어/문자 세기와 행 번호](/posts/linux-wc-nl/)

<br>
읽어주셔서 감사합니다. 😊
