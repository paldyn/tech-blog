---
title: "바다코끼리 연산자 :=: 할당 표현식"
description: "Python 3.8에서 추가된 walrus 연산자 :=의 동작 원리, while 루프·if 조건·컴프리헨션에서의 활용, 일반 = 할당과의 차이, 과용 금지 원칙을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["Python", "walrus", ":=", "할당표현식", "3.8", "중급"]
featured: false
draft: false
---

[지난 글](/posts/python-conditional-expression/)에서 조건 표현식을 다뤘다. Python 3.8에 도입된 **바다코끼리 연산자(walrus operator)** `:=` 는 "할당 표현식(assignment expression)"이라고도 부른다. `:=` 기호가 바다코끼리의 눈과 엄니처럼 보인다는 이유로 붙은 별명이다.

## := 가 하는 일

`:=`는 **표현식 안에서 변수에 값을 할당하고, 그 값을 반환한다**.

```python
# 일반 = 은 문(statement), 값 반환 안 함
x = 10

# := 는 표현식, 값 반환
if (n := len(data)) > 10:
    print(f"데이터가 너무 많음: {n}개")
```

`n := len(data)` 는 `n`에 `len(data)` 결과를 할당하고, **동시에 그 값을 표현식 자리에서 반환**한다. 그래서 `> 10` 비교에 즉시 쓸 수 있고, `if` 블록 안에서 `n`도 사용 가능하다.

## while 루프에서

가장 효과적인 사용처다. 반복마다 계산하고 결과를 조건과 바디에서 모두 쓸 때.

```python
# 파일 청크 읽기 — 전통적 방식
while True:
    chunk = file.read(4096)
    if not chunk:
        break
    process(chunk)

# walrus 사용
while chunk := file.read(4096):
    process(chunk)
```

`chunk`가 빈 바이트 `b""`(Falsy)이면 루프 조건이 `False`가 되어 자동 종료된다. 코드가 훨씬 간결해진다.

![바다코끼리 연산자 해부](/assets/posts/python-walrus-operator-overview.svg)

## if 조건에서 — 정규식 패턴

함수 호출 결과를 조건 검사와 바디에서 모두 사용할 때.

```python
import re

# 기존 방식
m = re.search(r"\d+", text)
if m:
    print(m.group())

# walrus 방식
if m := re.search(r"\d+", text):
    print(m.group())
```

`re.search()`를 두 번 호출하지 않고도 결과 `m`을 바로 쓸 수 있다.

## 컴프리헨션에서 — 중복 계산 제거

비용이 큰 함수의 결과를 조건과 값에 모두 쓸 때.

```python
# expensive()를 두 번 호출 (낭비)
results = [expensive(x) for x in data if expensive(x) > 0]

# walrus: 한 번만 호출
results = [y for x in data if (y := expensive(x)) > 0]
```

![walrus 실전 패턴](/assets/posts/python-walrus-operator-patterns.svg)

## = 과 := 의 차이

| 특성 | `=` (할당 문) | `:=` (할당 표현식) |
|------|------------|----------------|
| 사용 위치 | 단독 문장 | 표현식 내부 |
| 값 반환 | 안 함 | 함 |
| 우선순위 | — | 낮음 (괄호 필요) |
| 컴프리헨션 | 불가 | 가능 |

`:=`의 우선순위는 다른 대부분 연산자보다 낮으므로, 조건 안에서 쓸 때 **괄호가 필요**하다.

```python
while (n := len(data)) > 0:   # 올바름
while n := len(data) > 0:     # 위험! n에 bool이 바인딩됨
```

## 과용 주의

`:=`는 가독성을 높일 수도 있지만, 과용하면 오히려 코드를 읽기 어렵게 만든다.

```python
# 나쁜 예: 굳이 := 쓸 이유 없음
x := 10          # SyntaxError — 단독 문장 불가
(x := 10)        # 문법상 가능하지만 그냥 x = 10을 쓸 것

# 나쁜 예: 복잡한 중첩
if (a := f()) and (b := g(a)) and (c := h(b)):
    use(a, b, c)  # 읽기 어려움
```

**다음 두 경우에만 사용하는 것을 권장**한다:
1. `while 루프` 조건에서 반복 읽기 패턴
2. `if`/컴프리헨션에서 비용 큰 함수 결과 재사용

## 정리

- `:=` — 표현식 안에서 할당 + 값 반환, Python 3.8+
- 가장 유용한 곳: `while chunk := file.read(N):` 패턴
- `if`/컴프리헨션에서 함수 결과 중복 호출 제거
- 괄호를 빠뜨리면 우선순위 문제로 예상과 다른 바인딩 발생
- 단독 문장, 복잡한 중첩에서는 사용 자제

---

**지난 글:** [조건 표현식: x if 조건 else y 삼항 연산자](/posts/python-conditional-expression/)

**다음 글:** [pass 키워드: 아무것도 하지 않는 것의 역할](/posts/python-pass-keyword/)

<br>
읽어주셔서 감사합니다. 😊
