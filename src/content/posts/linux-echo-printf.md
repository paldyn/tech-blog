---
title: "echo & printf: 표준 출력 제어하기"
description: "echo와 printf의 차이를 이해하고, printf 포맷 문자열로 정렬·패딩·숫자 형식 출력을 다루는 방법을 익힌다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["Linux", "echo", "printf", "출력", "포맷", "bash"]
featured: false
draft: false
---

[지난 글](/posts/linux-alias/)에서 alias로 자주 쓰는 명령을 단축하는 방법을 배웠다. 이번에는 셸 스크립트의 가장 기본적인 출력 도구인 `echo`와 `printf`를 비교한다. 단순히 문자열을 출력하는 것처럼 보이지만, 두 명령의 동작 방식에는 중요한 차이가 있다. 이식성 있는 스크립트를 작성하려면 언제 어느 것을 써야 하는지 명확히 알아야 한다.

## echo — 단순하지만 이식성 함정이 있다

`echo`는 인자를 공백으로 이어 붙여 표준 출력으로 보내고 마지막에 개행 문자를 추가한다.

```bash
echo "Hello, World"          # Hello, World
echo Hello World             # Hello World (인자 여러 개)
echo -n "no newline"         # 개행 없이 출력
echo -e "tab\there"          # \t를 탭 문자로 해석
```

문제는 `-e` 옵션이다. Bash 내장 `echo`에서는 동작하지만 `/bin/sh`나 일부 시스템에서는 `-e`를 리터럴 문자로 출력하거나 전혀 다르게 처리한다. POSIX는 `echo`의 `-e` 동작을 정의하지 않는다. 따라서 이스케이프 문자를 포함한 출력이 필요할 때는 `printf`를 쓰는 것이 안전하다.

## printf — 이식성 높은 포맷 출력

`printf`는 C언어의 `printf()`에서 유래한 POSIX 표준 명령이다. 첫 번째 인자가 포맷 문자열이고, 이후 인자가 포맷에 채워진다. 개행은 자동으로 추가되지 않으므로 `\n`을 명시해야 한다.

```bash
printf "Hello, %s!\n" "World"     # Hello, World!
printf "%d + %d = %d\n" 3 5 8     # 3 + 5 = 8
printf "%.2f\n" 3.14159           # 3.14
printf "%-10s %5d\n" "item" 42    # item           42
printf "%05d\n" 42                # 00042
printf "%x %o\n" 255 255          # ff 377 (16진·8진)
```

포맷 인자가 값보다 적으면 `printf`는 포맷을 반복 적용한다.

```bash
printf "%d\n" 1 2 3
# 1
# 2
# 3
```

## echo vs printf 비교

![echo vs printf 비교](/assets/posts/linux-echo-printf-comparison.svg)

## printf 포맷 완전 정리

![printf 포맷 문자열](/assets/posts/linux-echo-printf-formatting.svg)

### 주요 형식 지정자

| 지정자 | 의미 | 예시 |
|---|---|---|
| `%s` | 문자열 | `printf "%s" "hello"` |
| `%d` | 10진 정수 | `printf "%d" 42` |
| `%f` | 부동소수점 | `printf "%.2f" 3.14` |
| `%x` | 16진수 | `printf "%x" 255` → `ff` |
| `%o` | 8진수 | `printf "%o" 255` → `377` |
| `%-10s` | 왼쪽 정렬, 10칸 | `printf "%-10s|" "hi"` |
| `%05d` | 0 패딩, 5칸 | `printf "%05d" 7` → `00007` |

### 이스케이프 시퀀스

```bash
printf "name\tvalue\n"     # 탭 구분
printf "line1\nline2\n"    # 개행
printf "\e[32mOK\e[0m\n"   # 초록색 텍스트 (ANSI)
```

## 실전 스크립트 패턴

```bash
# 정렬된 테이블 출력
printf "%-15s %-10s %8s\n" "Name" "Status" "Size"
printf "%-15s %-10s %8d\n" "nginx.conf"   "OK"   1024
printf "%-15s %-10s %8d\n" "httpd.conf"  "WARN" 2048

# 진행 바
for i in {1..10}; do
    printf "\rProgress: %3d%%" $((i * 10))
    sleep 0.1
done
printf "\n"

# 파일에 여러 줄 쓰기
printf "%s\n" "line1" "line2" "line3" > output.txt
```

## $'...' 문법 — 또 다른 이스케이프 방법

Bash에서는 `$'string'` 문법으로 이스케이프 시퀀스가 해석된 문자열을 만들 수 있다.

```bash
NL=$'\n'
TAB=$'\t'
echo "first${NL}second"     # 두 줄 출력
printf "col1${TAB}col2\n"   # 탭으로 구분
```

변수에 개행이나 탭이 포함된 문자열을 미리 만들어 두고 여러 곳에서 재사용할 때 유용하다.

---

**지난 글:** [alias: 나만의 명령어 단축키 만들기](/posts/linux-alias/)

**다음 글:** [tee: 파이프라인을 분기하는 T자 이음새](/posts/linux-tee/)

<br>
읽어주셔서 감사합니다. 😊
