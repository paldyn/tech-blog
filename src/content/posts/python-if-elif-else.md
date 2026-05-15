---
title: "if / elif / else: Python 조건문 완전 정복"
description: "Python 조건문 if/elif/else의 구조와 실행 흐름, 다양한 조건식 작성법, 중첩 조건문 vs elif 체인 비교, 실전 패턴까지 체계적으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["Python", "if", "elif", "else", "조건문", "분기", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-hash-and-equality/)에서 `__hash__`와 `__eq__`의 관계를 살펴봤다. 이번 글부터는 **제어 흐름(control flow)** 파트로 넘어간다. 프로그램이 상황에 따라 다른 경로를 선택하게 만드는 첫 번째 도구가 바로 `if` 문이다.

## 기본 구조

Python 조건문의 기본 형태는 세 부분으로 이루어진다.

```python
if 조건식:
    # True일 때 실행
elif 다른_조건식:
    # 첫 조건이 False이고 이 조건이 True일 때 실행
else:
    # 모든 조건이 False일 때 실행
```

`elif`는 0개 이상 쓸 수 있고, `else`는 선택 사항이다. 블록 구분은 **들여쓰기(4 spaces)** 로만 한다.

![if/elif/else 실행 흐름](/assets/posts/python-if-elif-else-overview.svg)

## 조건 평가 순서

조건은 반드시 **위에서 아래로** 평가된다. 처음으로 `True`가 되는 블록 하나만 실행되고, 나머지는 전부 건너뛴다.

```python
score = 75

if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
elif score >= 70:
    grade = "C"
else:
    grade = "F"

print(grade)  # C
```

`score = 75`는 `>= 90`과 `>= 80` 조건을 모두 통과하지 못하고, `>= 70`에서 처음으로 `True`가 되므로 `"C"`가 배정된다. 이후 `else`는 실행되지 않는다.

## 조건식에 쓸 수 있는 것들

비교 연산자, 논리 연산자, 멤버십 연산자를 자유롭게 조합할 수 있다.

```python
x = 15
name = "Alice"
items = [1, 2, 3]

# 비교 연산자
if x > 10:
    print("10보다 크다")

# 논리 연산자
if x > 0 and x < 100:
    print("0~100 사이")

# 멤버십
if name in ["Alice", "Bob"]:
    print("허용된 사용자")

# not
if 5 not in items:
    print("5는 없음")
```

Python은 `0 < x < 100` 같은 **연속 비교**도 지원한다.

```python
if 0 < x < 100:
    print("범위 내")
```

내부적으로 `0 < x and x < 100`과 동일하게 평가된다.

## elif 체인 vs 중첩 if

동일한 변수를 여러 경우로 나눌 때는 중첩 `if` 대신 `elif` 체인을 써야 가독성이 좋다.

```python
# 나쁜 예: 중첩 if
if score >= 60:
    if score >= 80:
        grade = "B 이상"
    else:
        grade = "C"
else:
    grade = "F"

# 좋은 예: elif 체인
if score >= 80:
    grade = "B 이상"
elif score >= 60:
    grade = "C"
else:
    grade = "F"
```

중첩이 깊어질수록 코드 읽기가 어려워지고 버그가 숨기 쉬워진다.

## Truthy / Falsy 활용

조건식에 꼭 비교 연산자를 쓸 필요는 없다. 값 자체가 Truthy/Falsy로 평가된다.

```python
name = ""
items = []
count = 0

if name:           # 빈 문자열 → False
    print(name)
else:
    print("이름 없음")

if not items:      # 빈 리스트 → False → not False = True
    print("목록 비어 있음")

if count:          # 0 → False
    print("카운트 있음")
```

`None`, `0`, `""`, `[]`, `{}`, `set()` 등은 모두 `False`로 평가된다는 점을 기억하자.

## 자주 하는 실수

```python
# 실수 1: elif 대신 if를 연속으로 쓰기
x = 15
if x > 0:
    print("양수")  # 실행됨
if x > 10:
    print("10 초과")  # 이것도 실행됨 (독립 조건)

# elif였다면 첫 번째만 실행됨
if x > 0:
    print("양수")
elif x > 10:  # 첫 조건이 True라 여기는 절대 안 옴
    print("10 초과")
```

상황에 따라 둘 다 실행해야 하는 경우에는 `if`-`if` 연속이 맞고, 상호 배타적인 분기라면 반드시 `elif`를 써야 한다.

```python
# 실수 2: == 대신 = 사용
if x = 10:   # SyntaxError
    pass

if x == 10:  # 올바른 비교
    pass
```

![조건문 패턴 비교](/assets/posts/python-if-elif-else-patterns.svg)

## 한 줄 if (인라인)

본문이 단순한 경우 한 줄로 쓸 수 있다.

```python
if score >= 60: print("합격")

# else와 함께
if score >= 60: print("합격")
else: print("불합격")
```

단, 가독성을 위해 실무에서는 보통 여러 줄 형태를 선호한다. 표현식(값)이 필요하다면 **삼항 표현식**(`x if 조건 else y`)을 쓰는 게 더 Pythonic하다 — 이건 곧 별도 글에서 다룬다.

## 정리

- `if` → `elif`(0+) → `else`(선택) 순서, 위에서 아래로 첫 `True`만 실행
- 들여쓰기가 블록 구분자 — 4 spaces 표준
- 조건식에 비교·논리·멤버십·연속 비교 모두 사용 가능
- 상호 배타적 분기엔 `if`-`if` 연속이 아닌 `elif` 체인
- Truthy/Falsy 덕분에 `if x:` 형태로 간결하게 쓸 수 있다

---

**다음 글:** [for 루프: 반복 가능 객체 순회의 모든 것](/posts/python-for-loop/)

<br>
읽어주셔서 감사합니다. 😊
