---
title: "while 루프: 조건 기반 반복과 무한 루프 제어"
description: "Python while 루프의 실행 흐름, 무한 루프와 break 패턴, do-while 흉내 내기, for vs while 선택 기준, 무한 루프 방지 전략까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["Python", "while", "loop", "무한루프", "break", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-for-loop/)에서 이터러블을 순회하는 `for` 루프를 살펴봤다. `while`은 순회할 컬렉션이 없거나 반복 횟수를 미리 알 수 없을 때 쓰는 도구다. 조건이 `True`인 동안 계속 반복하고, 조건이 `False`가 되는 순간 빠져나온다.

## 기본 구조

```python
while 조건식:
    # 조건이 True인 동안 실행
    # 반드시 조건 변수를 갱신해야 함!
```

```python
count = 0
while count < 5:
    print(count)
    count += 1
# 0 1 2 3 4
```

`count += 1`을 빠뜨리면 조건이 영원히 `True`여서 **무한 루프**가 된다.

![while 루프 실행 흐름](/assets/posts/python-while-loop-overview.svg)

## 무한 루프와 break

`while True:`는 의도적인 무한 루프다. 내부에서 `break`로 탈출 조건을 명시한다. 반복 횟수가 불명확하거나 이벤트 기반 루프에서 자주 쓰는 패턴이다.

```python
while True:
    cmd = input("> ")
    if cmd == "quit":
        break
    print(f"명령 실행: {cmd}")
```

서버의 요청 처리 루프, CLI 인터랙티브 셸, 게임 메인 루프 등이 이 패턴을 따른다.

## do-while 흉내 내기

Python에는 `do-while` 문이 없다. 최소 1회 실행을 보장하려면 `while True` + `break` 로 구현한다.

```python
# 최소 1회 실행 보장
while True:
    password = input("비밀번호: ")
    if len(password) >= 8:
        break
    print("8자 이상 입력하세요.")
```

처음 실행 후 조건을 확인하는 구조이므로 do-while과 동일한 효과가 난다.

## 입력 검증 패턴

`while`이 `for`보다 적합한 대표적 사례가 사용자 입력 검증이다.

```python
while True:
    try:
        n = int(input("양수를 입력하세요: "))
        if n > 0:
            break
        print("양수여야 합니다.")
    except ValueError:
        print("숫자가 아닙니다.")

print(f"입력된 양수: {n}")
```

올바른 값이 들어올 때까지 계속 재요청한다. 이런 "조건 충족까지 반복" 패턴은 이터러블이 없으므로 `for`로는 자연스럽게 표현하기 어렵다.

## 최대 반복 횟수로 안전망 설정

네트워크 재시도처럼 무한 루프가 될 위험이 있는 경우 상한선을 둔다.

```python
MAX_RETRY = 3
attempt = 0

while attempt < MAX_RETRY:
    if connect_to_server():
        print("연결 성공")
        break
    attempt += 1
    print(f"재시도 {attempt}/{MAX_RETRY}")
else:
    print("연결 실패")
```

`for`/`while`에 `else`를 붙이면 `break` 없이 정상 종료됐을 때 실행된다 — 이 동작은 다음 글에서 자세히 다룬다.

![while vs for 비교](/assets/posts/python-while-loop-patterns.svg)

## for vs while 선택 기준

| 상황 | 권장 |
|------|------|
| 리스트·범위를 순회 | `for` |
| 반복 횟수가 명확 | `for` + `range()` |
| 종료 조건이 동적 | `while` |
| 사용자 입력 검증 | `while` |
| 이벤트 루프 | `while True` + `break` |

## 무한 루프 디버깅

루프가 멈추지 않을 때 확인할 것:

```python
# 조건 변수가 갱신되는지
i = 0
while i < 10:
    print(i)
    # i += 1 빠뜨림 → 무한 루프!

# 조건이 절대 False가 안 되는지
items = [1, 2, 3]
while items:
    items.append(items[-1] + 1)  # 영원히 추가 → 무한 루프
```

Ctrl+C로 강제 중단 후 조건 갱신 로직을 점검하자.

## 정리

- `while 조건:` — 조건이 `True`인 동안 반복, `False`가 되면 탈출
- 조건 변수 갱신이 필수 — 빠뜨리면 무한 루프
- `while True: ... break` — 무한 루프 + 내부 탈출 패턴 (이벤트 루프, do-while)
- `for`는 이터러블·횟수가 명확할 때, `while`은 조건이 동적일 때
- 안전망이 필요한 루프엔 최대 반복 횟수 상한 설정

---

**지난 글:** [for 루프: 반복 가능 객체 순회의 모든 것](/posts/python-for-loop/)

**다음 글:** [break와 continue: 루프 흐름 세밀하게 제어하기](/posts/python-break-continue/)

<br>
읽어주셔서 감사합니다. 😊
