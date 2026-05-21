---
title: "wc · nl — 줄/단어/문자 세기와 행 번호"
description: "wc로 파일의 줄·단어·바이트 수를 세고, nl과 cat -n으로 행 번호를 붙이는 방법을 실전 활용 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["wc", "nl", "텍스트처리", "Linux", "쉘"]
featured: false
draft: false
---

[지난 글](/posts/linux-tr-fold-fmt/)에서 tr, fold, fmt로 문자를 변환하고 줄을 재배치하는 방법을 살펴봤습니다. 이번 글에서는 파일의 통계(줄 수, 단어 수, 바이트 수)를 구하는 `wc`와 출력에 행 번호를 붙이는 `nl`을 다룹니다. 두 명령어 모두 단순하지만 스크립트와 파이프라인에서 자주 사용됩니다.

![wc · nl 개념 다이어그램](/assets/posts/linux-wc-nl-overview.svg)

## wc — 파일 통계 측정

`wc`(word count)는 파일이나 표준 입력의 줄 수, 단어 수, 바이트 수를 출력합니다.

```bash
# 기본 출력: 줄 수  단어 수  바이트 수  파일명
wc /etc/passwd
# →     54    108   2923 /etc/passwd
```

### 개별 옵션

```bash
# 줄 수만
wc -l /etc/passwd

# 단어 수만
wc -w document.txt

# 바이트 수만
wc -c image.png

# 문자 수 (멀티바이트 인코딩 고려)
wc -m utf8.txt
```

줄 수(`-l`)는 개행 문자 `\n`의 수를 셉니다. 마지막 줄에 개행이 없으면 그 줄은 집계에 포함되지 않으므로 주의하세요.

### 여러 파일 합산

```bash
# 각 파일의 통계와 합계 표시
wc -l *.py
# →    34 main.py
# →    18 utils.py
# →    52 total
```

### 파이프라인에서 사용

```bash
# grep 결과 줄 수 (grep -c 와 동일)
grep "ERROR" app.log | wc -l

# 현재 디렉터리 파일 수
ls -1 | wc -l

# 프로세스 수
ps aux | wc -l

# 열린 파일 수 (lsof)
lsof | wc -l
```

파이프 끝에서 `wc -l`을 쓸 때는 파일명이 출력되지 않으므로 깔끔한 숫자만 얻을 수 있습니다.

### 스크립트에서 숫자만 추출

```bash
# 공백 제거 후 변수에 담기
count=$(wc -l < /etc/passwd)
echo "User count: $count"
```

`wc < file`처럼 리다이렉션을 쓰면 파일명이 출력되지 않아 변수 할당에 편리합니다.

---

## nl — 행 번호 붙이기

`nl`(number lines)은 파일의 각 줄 앞에 번호를 붙여 출력합니다.

```bash
# 기본: 비어 있지 않은 줄에 번호
nl script.sh

# cat -n: 빈 줄 포함 모든 줄에 번호
cat -n script.sh
```

`nl`과 `cat -n`의 차이는 기본 동작에 있습니다. `nl`은 빈 줄을 번호 없이 출력하고, `cat -n`은 빈 줄에도 번호를 붙입니다.

### -b: 번호 붙이는 줄 선택

```bash
# 모든 줄에 번호 붙이기 (빈 줄 포함)
nl -ba file.txt

# 빈 줄에만 번호 없음 (기본)
nl -bt file.txt
```

### -v: 시작 번호, -i: 증가량

```bash
# 0부터 시작
nl -v 0 file.txt

# 10씩 증가 (10, 20, 30...)
nl -i 10 file.txt
```

### 번호 형식 지정

```bash
# 오른쪽 정렬, 0 패딩, 6자리
nl -nrz -w 6 -ba file.txt
# → 000001  첫 번째 줄

# 왼쪽 정렬
nl -nln -w 6 file.txt
```

`-n` 옵션값: `ln`(좌측 정렬), `rn`(우측 정렬), `rz`(우측 정렬 + 0 패딩).

![wc · nl 실전 코드 예시](/assets/posts/linux-wc-nl-code.svg)

## 실전 활용

### 코드 리뷰용 번호 붙이기

```bash
# 함수만 번호 붙여 확인 (grep 라인 번호와 함께)
nl -ba main.py | grep "def "
```

### 로그 줄 번호로 위치 파악

```bash
# ERROR 발생 줄 번호 확인
nl -ba app.log | grep "ERROR" | head -5
```

### 빈 줄 수 세기

```bash
# 빈 줄 수 = 전체 줄 수 - 비어있지 않은 줄 수
total=$(wc -l < file.txt)
nonempty=$(grep -c '.' file.txt)
empty=$((total - nonempty))
echo "빈 줄: $empty"
```

### 파일 크기 비교

```bash
# 두 파일의 바이트 크기를 비교
a=$(wc -c < file1.bin)
b=$(wc -c < file2.bin)
echo "file1: ${a}B, file2: ${b}B"
```

## 정리

| 명령어 | 역할 |
|--------|------|
| `wc -l` | 줄 수 |
| `wc -w` | 단어 수 |
| `wc -c` | 바이트 수 |
| `wc -m` | 문자 수 (UTF-8 인식) |
| `nl` | 행 번호 (비어있지 않은 줄) |
| `nl -ba` | 행 번호 (모든 줄) |
| `cat -n` | 행 번호 (모든 줄, nl -ba 와 동일) |

---

**지난 글:** [tr · fold · fmt — 문자 변환과 줄 포맷](/posts/linux-tr-fold-fmt/)

**다음 글:** [diff · patch — 파일 비교와 패치 적용](/posts/linux-diff-patch/)

<br>
읽어주셔서 감사합니다. 😊
