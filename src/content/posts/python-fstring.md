---
title: "f-string: 파이썬 문자열 포매팅의 정석"
description: "Python f-string의 기본 문법부터 포맷 명세, = 디버깅 출력, 조건식 삽입, 중첩 사용까지 완전히 다룹니다. 구식 % 포매팅 및 .format()과도 비교합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["Python", "f-string", "포매팅", "문자열", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-string-essentials/)에서 문자열의 기초인 생성과 인덱싱, 슬라이싱을 살펴봤다. 이번에는 Python 3.6에서 도입된 **f-string**(formatted string literal)을 깊이 다룬다. 현대 Python 코드에서 문자열 포매팅의 표준이 된 도구다.

## f-string이란

f-string은 문자열 리터럴 앞에 `f` 또는 `F`를 붙인 것이다. 중괄호 `{}`안에 **임의의 Python 표현식**을 넣을 수 있고, 실행 시점에 해당 값으로 치환된다.

```python
name = "파이썬"
version = 3.12

print(f"안녕하세요, {name}!")
print(f"현재 버전: {version}")
print(f"1 + 1 = {1 + 1}")
```

## 왜 f-string인가

Python에는 문자열 포매팅 방법이 여러 가지 있다.

```python
name, score = "Alice", 95

# % 포매팅 (Python 2 스타일)
"이름: %s, 점수: %d" % (name, score)

# str.format()
"이름: {}, 점수: {}".format(name, score)
"이름: {name}, 점수: {score}".format(name=name, score=score)

# f-string (권장)
f"이름: {name}, 점수: {score}"
```

f-string이 가장 간결하고, 세 방법 중 실행 속도도 가장 빠르다.

## 식 삽입

중괄호 안에는 변수뿐 아니라 **임의의 표현식**을 넣을 수 있다.

```python
a, b = 3, 4
print(f"합: {a + b}")                          # 합: 7
print(f"제곱: {a ** 2 + b ** 2}")              # 제곱: 25
print(f"거듭제곱: {2 ** 10}")                  # 거듭제곱: 1024
print(f"대문자: {'hello'.upper()}")            # 대문자: HELLO
print(f"타입: {type(3.14).__name__}")          # 타입: float
```

조건식(삼항 연산자)도 넣을 수 있다.

```python
score = 85
print(f"결과: {'합격' if score >= 60 else '불합격'}")
# 결과: 합격
```

![f-string 기본 문법](/assets/posts/python-fstring-syntax.svg)

## 포맷 명세 — {값:포맷}

중괄호 안에 콜론(`:`) 뒤에 **포맷 명세**를 붙이면 다양한 형식으로 출력할 수 있다.

### 소수점 자릿수

```python
pi = 3.141592653589793
print(f"{pi:.2f}")   # 3.14
print(f"{pi:.4f}")   # 3.1416
print(f"{pi:.0f}")   # 3
```

### 너비와 정렬

```python
print(f"{'left':<10}|")    # 'left      |' (왼쪽 정렬)
print(f"{'right':>10}|")   # '     right|' (오른쪽 정렬)
print(f"{'center':^10}|")  # '  center  |' (가운데 정렬)
print(f"{'fill':*^10}|")   # '***fill***|' (채우기 문자)
```

### 숫자 형식

```python
n = 1_000_000
print(f"{n:,}")      # 1,000,000  (천 단위 콤마)
print(f"{n:_}")      # 1_000_000  (언더스코어)
print(f"{0.75:.1%}") # 75.0%      (백분율)
print(f"{255:#x}")   # 0xff       (16진수)
print(f"{255:#b}")   # 0b11111111 (2진수)
print(f"{1.5e4:e}")  # 1.500000e+04 (지수)
```

### 부호

```python
print(f"{42:+}")    # +42
print(f"{-42:+}")   # -42
print(f"{42: }")    # 양수 앞에 공백 (음수와 자리 맞춤)
```

## = 자기 문서화 표현식 (Python 3.8+)

디버깅할 때 변수 이름과 값을 함께 출력하는 `{변수=}` 문법이 있다.

```python
x = 42
y = [1, 2, 3]

print(f"{x=}")     # x=42
print(f"{y=}")     # y=[1, 2, 3]
print(f"{x + 1=}") # x + 1=43
```

`print(f"x={x}")`를 반복해서 타이핑하는 대신 훨씬 간결하게 쓸 수 있다.

## 중첩과 여러 줄

f-string을 여러 줄로 나누려면 괄호로 감싼다.

```python
name = "Alice"
score = 95
grade = "A"

report = (
    f"이름: {name}\n"
    f"점수: {score}\n"
    f"등급: {grade}"
)
print(report)
```

삼중 따옴표 f-string도 가능하다.

```python
msg = f"""
이름: {name}
점수: {score}
""".strip()
```

## 변환 플래그

`!r`, `!s`, `!a`로 내장 변환 함수를 적용할 수 있다.

```python
name = "파이썬"
print(f"{name!r}")   # '파이썬'  (repr)
print(f"{name!s}")   # 파이썬   (str, 기본값)
print(f"{name!a}")   # '\\ud30c\\uc774\\uc36c' (ascii)
```

![f-string 고급 기능](/assets/posts/python-fstring-advanced.svg)

## 주의사항

### 람다와 조건부 표현식의 중괄호 충돌

f-string 안에서 딕셔너리 리터럴이나 집합 리터럴을 직접 쓰면 충돌이 생길 수 있다.

```python
d = {"key": "value"}
print(f"{d['key']}")   # OK: 다른 따옴표 사용
```

### 반복 성능

루프 안에서 f-string으로 문자열을 계속 더하는 패턴은 효율적이지 않다. 대신 `"".join()`을 사용한다.

```python
# 비권장
result = ""
for i in range(1000):
    result += f"{i} "

# 권장
result = " ".join(str(i) for i in range(1000))
```

## 정리

| 기능 | 문법 |
|------|------|
| 변수 삽입 | `f"{name}"` |
| 식 삽입 | `f"{1 + 2}"` |
| 소수점 | `f"{pi:.2f}"` |
| 너비·정렬 | `f"{'text':>10}"` |
| 천 단위 | `f"{n:,}"` |
| 디버깅 | `f"{x=}"` (3.8+) |

---

**지난 글:** [문자열 기초: 생성, 인덱싱, 슬라이싱](/posts/python-string-essentials/)

**다음 글:** [문자열 메서드: split, join, replace와 친구들](/posts/python-string-methods/)

<br>
읽어주셔서 감사합니다. 😊
