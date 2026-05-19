---
title: "Bash 반복문 완전 정복"
description: "Bash for/while/until 반복문의 문법과 차이를 설명합니다. 브레이스 확장, C 스타일 for, while read를 이용한 파일 처리, break/continue 제어, 병렬 처리 패턴까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 3
type: "knowledge"
category: "Linux"
tags: ["bash", "loops", "for", "while", "until", "shell", "linux", "scripting"]
featured: false
draft: false
---

[지난 글](/posts/bash-conditionals/)에서 Bash 조건문과 비교 연산자를 살펴봤습니다. 조건으로 분기를 만들었으니 이번엔 반복으로 작업을 자동화하는 차례입니다. Bash 반복문은 세 가지 형태가 있으며, 용도에 따라 선택 기준이 다릅니다.

## for ... in

목록을 순회할 때 가장 자주 쓰입니다.

```bash
# 명시적 목록
for fruit in apple banana cherry; do
    echo "과일: $fruit"
done

# 브레이스 확장 — 고정 범위
for i in {1..5}; do
    echo $i
done

# 스텝 지정 (Bash 4.0+)
for i in {0..10..2}; do   # 0 2 4 6 8 10
    echo $i
done

# 배열 순회
files=("a.txt" "b.txt" "c.txt")
for f in "${files[@]}"; do
    echo "$f"
done
```

브레이스 확장 `{1..N}`은 변수를 사용할 수 없습니다. N이 변수라면 `seq`나 C 스타일 for를 사용해야 합니다.

![Bash 반복문 종류](/assets/posts/bash-loops-types.svg)

## C 스타일 for

```bash
# 기본 형태
for (( i=0; i<5; i++ )); do
    echo $i
done

# 역방향
for (( i=10; i>0; i-=2 )); do
    echo $i   # 10 8 6 4 2
done

# 변수 범위 — {1..$N} 대신
N=10
for (( i=1; i<=N; i++ )); do
    echo $i
done
```

## while / until

조건이 참인 동안 반복(while), 조건이 거짓인 동안 반복(until)합니다.

```bash
# while
count=1
while [[ $count -le 5 ]]; do
    echo "count: $count"
    (( count++ ))
done

# until — while의 반대 조건
count=1
until [[ $count -gt 5 ]]; do
    echo "count: $count"
    (( count++ ))
done

# 무한 루프
while true; do
    if some_condition; then break; fi
    sleep 1
done
```

## 파일 줄별 읽기 — while read

```bash
# 가장 안전한 패턴
while IFS= read -r line; do
    echo "→ $line"
done < /etc/passwd

# 명령 출력 처리
ps aux | while IFS= read -r line; do
    echo "$line"
done

# 프로세스 치환으로 파이프라인 안 while
while IFS= read -r line; do
    echo "$line"
done < <(find /tmp -name "*.log")
```

`IFS=`는 앞뒤 공백을 보존합니다. `-r`은 백슬래시가 이스케이프로 처리되는 것을 막습니다. 이 두 옵션은 파일을 정확하게 읽으려면 항상 함께 사용해야 합니다.

`while ... done < <(cmd)` 형태를 쓰는 이유는 파이프라인이 서브셸을 생성하기 때문입니다. `cmd | while ... done` 형태에서는 while 내부에서 변수를 바꿔도 바깥 셸에서 보이지 않습니다.

![Bash 루프 실전 패턴](/assets/posts/bash-loops-patterns.svg)

## break / continue

```bash
# break — 루프 탈출
for i in {1..10}; do
    [[ $i -eq 5 ]] && break
    echo $i   # 1 2 3 4
done

# continue — 다음 반복으로 건너뜀
for i in {1..5}; do
    (( i % 2 == 0 )) && continue
    echo $i   # 1 3 5
done

# 중첩 루프 탈출 — break N
for i in {1..3}; do
    for j in {1..3}; do
        [[ $j -eq 2 ]] && break 2   # 바깥 for까지 탈출
        echo "$i $j"
    done
done
```

## 병렬 처리

```bash
# 백그라운드 &로 동시 실행
for host in server1 server2 server3; do
    ping -c1 "$host" &
done
wait   # 모든 백그라운드 프로세스 대기

# PID 수집 후 개별 대기
for url in "${urls[@]}"; do
    curl -s "$url" > /tmp/out_$$ &
    pids+=($!)
done
for pid in "${pids[@]}"; do
    wait "$pid"
done
```

`$!`는 마지막으로 백그라운드에서 실행된 프로세스의 PID입니다. 각 PID를 따로 보관해 두면 `wait $pid`로 개별 완료 상태를 확인할 수 있습니다.

## select 메뉴

대화형 메뉴를 만들 때 유용합니다.

```bash
options=("설치" "삭제" "종료")
PS3="선택: "
select opt in "${options[@]}"; do
    case $opt in
        "설치") install_packages ;;
        "삭제") remove_packages ;;
        "종료") break ;;
        *) echo "잘못된 선택" ;;
    esac
done
```

`PS3`는 select가 표시할 프롬프트 문자열입니다.

---

**지난 글:** [Bash 조건문 완전 정복](/posts/bash-conditionals/)

**다음 글:** [Bash 함수](/posts/bash-functions/)

<br>
읽어주셔서 감사합니다. 😊
