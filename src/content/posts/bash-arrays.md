---
title: "Bash 배열 완전 정복"
description: "Bash 인덱스 배열과 연관 배열의 선언, 접근, 추가·삭제·슬라이스 방법을 설명합니다. @와 *의 차이, mapfile을 이용한 파일 읽기, 배열을 함수에 넘기는 패턴까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["bash", "array", "associative-array", "shell", "linux", "scripting"]
featured: false
draft: false
---

[지난 글](/posts/bash-variables-quoting/)에서 Bash 변수와 인용 부호의 동작 원리를 살펴봤습니다. 변수 하나에 값 하나를 담는 방법을 알았으니, 이번엔 여러 값을 한꺼번에 관리하는 배열로 나아갑니다. Bash 배열은 두 가지 종류로 나뉩니다. 정수 인덱스로 접근하는 **인덱스 배열**과 문자열 키로 접근하는 **연관 배열**입니다.

## 인덱스 배열

```bash
# 소괄호로 선언 — 공백으로 원소 구분
fruits=("apple" "banana" "cherry")

# 개별 인덱스에 직접 대입
colors[0]="red"
colors[1]="green"
colors[2]="blue"

# 특정 인덱스부터 선언 (0, 1, 5 — 구멍이 생겨도 됨)
sparse[0]="first"
sparse[5]="sixth"
```

원소를 참조할 때는 `${배열[인덱스]}` 형식을 씁니다.

```bash
echo "${fruits[0]}"    # apple
echo "${fruits[-1]}"   # cherry (마지막 원소, Bash 4.3+)
echo "${fruits[@]}"    # 전체 원소
echo "${#fruits[@]}"   # 원소 수: 3
```

![Bash 배열 선언과 접근](/assets/posts/bash-arrays-declaration.svg)

## @ vs * — 큰따옴표 안에서의 차이

`"${arr[@]}"`와 `"${arr[*]}"`는 큰따옴표 안에서 동작이 다릅니다.

```bash
arr=("hello world" "foo" "bar")

# "$@" — 각 원소를 독립적으로 유지
for x in "${arr[@]}"; do
    echo "[$x]"   # [hello world], [foo], [bar]
done

# "$*" — IFS(기본값 공백)로 이어 붙인 하나의 문자열
for x in "${arr[*]}"; do
    echo "[$x]"   # [hello world foo bar]
done
```

파일 경로처럼 공백이 포함될 수 있는 원소를 다룰 때는 항상 `"${arr[@]}"`를 사용해야 합니다.

## 인덱스 구조와 슬라이스

![Bash 배열 인덱스 구조](/assets/posts/bash-arrays-indexing.svg)

```bash
fruits=("apple" "banana" "cherry" "date")

# 슬라이스: ${arr[@]:시작:개수}
echo "${fruits[@]:1:2}"   # banana cherry

# 마지막 2개
echo "${fruits[@]: -2}"   # cherry date (음수 앞 공백 필수)

# 인덱스 목록
echo "${!fruits[@]}"      # 0 1 2 3
```

## 배열 조작

```bash
# 원소 추가
fruits+=("elderberry")
fruits[10]="fig"   # 인덱스 지정 추가

# 원소 삭제
unset fruits[1]    # banana 삭제, 인덱스 구멍 발생

# 인덱스를 재정렬하여 구멍 없애기
fruits=("${fruits[@]}")

# 배열 전체 삭제
unset fruits
```

## 연관 배열

연관 배열은 반드시 `declare -A`로 미리 선언해야 합니다.

```bash
declare -A config
config["host"]="localhost"
config["port"]="5432"
config["db"]="myapp"

# 키로 접근
echo "${config["host"]}"    # localhost

# 키 목록
echo "${!config[@]}"        # host port db

# 값 목록
echo "${config[@]}"         # localhost 5432 myapp

# 키 존재 여부 확인
if [[ -v config["port"] ]]; then
    echo "port is set"
fi
```

## mapfile로 파일을 배열에 읽기

```bash
# 파일의 각 줄을 배열 원소로
mapfile -t lines < /etc/passwd

echo "${#lines[@]}"    # 줄 수
echo "${lines[0]}"     # 첫 번째 줄

# 명령 출력을 배열로
mapfile -t pids < <(pgrep nginx)
for pid in "${pids[@]}"; do
    echo "nginx PID: $pid"
done
```

`mapfile`(또는 동의어 `readarray`)은 Bash 4.0부터 사용할 수 있습니다. `-t` 옵션은 줄바꿈 문자를 제거합니다.

## 배열을 함수에 전달하기

Bash 배열은 그대로 함수에 넘길 수 없습니다. 이름 참조(nameref)를 쓰거나 `"${arr[@]}"`로 펼쳐서 전달합니다.

```bash
# 방법 1: 펼쳐서 전달 — 간단한 경우
process_items() {
    local items=("$@")
    for item in "${items[@]}"; do
        echo "처리: $item"
    done
}
process_items "${fruits[@]}"

# 방법 2: 이름 참조 (Bash 4.3+)
modify_array() {
    local -n arr_ref=$1   # 이름 참조
    arr_ref+=("new_item")
}
modify_array fruits   # fruits 배열 직접 수정
```

---

**지난 글:** [Bash 변수와 인용 부호](/posts/bash-variables-quoting/)

**다음 글:** [Bash 조건문](/posts/bash-conditionals/)

<br>
읽어주셔서 감사합니다. 😊
