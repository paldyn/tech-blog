---
title: "조건 표현식: x if 조건 else y 삼항 연산자"
description: "Python 조건 표현식(삼항 연산자)의 문법과 평가 순서, if/else 문과의 차이, f-string·람다·컴프리헨션 활용, 중첩 금지 원칙까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["Python", "삼항연산자", "조건표현식", "ternary", "f-string", "초급"]
featured: false
draft: false
---

[지난 글](/posts/python-match-statement/)에서 `match`/`case` 구조적 패턴 매칭을 살펴봤다. 이번에는 훨씬 단순하지만 자주 쓰이는 **조건 표현식(conditional expression)** — 흔히 삼항 연산자라고 부르는 구문을 다룬다.

## 문법

```
값_참  if  조건  else  값_거짓
```

C/Java의 `조건 ? 참 : 거짓`과 유사하지만, Python은 **영어 문장처럼 읽힌다**는 점이 다르다.

```python
score = 75
result = "합격" if score >= 60 else "불합격"
print(result)   # 합격
```

## 평가 순서

1. `조건`을 먼저 평가
2. `True`면 `값_참`을 반환, `False`면 `값_거짓`을 반환
3. 선택되지 않은 쪽은 **평가하지 않는다** (단락 평가)

```python
def f():
    print("f 호출됨")
    return 10

x = f() if True else 999   # f 호출됨 → x = 10
x = f() if False else 999  # f는 호출 안 됨 → x = 999
```

![조건 표현식 구조](/assets/posts/python-conditional-expression-overview.svg)

## if/else 문과의 차이

**if/else 문** — 실행할 코드 블록을 선택, **값**을 반환하지 않음.

**조건 표현식** — **값(expression)** 을 반환, 값이 필요한 어디서든 사용 가능.

```python
# 문(statement): 할당에만 쓸 수 있음
if x > 0:
    val = 1
else:
    val = -1

# 표현식: 함수 인수, f-string, 리스트 내부 등 어디든
val = 1 if x > 0 else -1
print(1 if x > 0 else -1)
[1 if n > 0 else -1 for n in nums]
```

## 실전 활용 패턴

**함수 인수에 직접**

```python
print("even" if n % 2 == 0 else "odd")
log(level, "pass" if ok else "fail")
```

**f-string 내부**

```python
status = f"{'✓' if success else '✗'} {message}"
label = f"{count} {'item' if count == 1 else 'items'}"
```

**리스트 컴프리헨션**

```python
labels = ["짝" if n % 2 == 0 else "홀" for n in range(10)]
```

**람다 함수**

```python
sign = lambda x: 1 if x > 0 else -1
clamp = lambda v, lo, hi: lo if v < lo else (hi if v > hi else v)
```

**None 기본값**

```python
# or를 쓸 수도 있지만, None과 명시적으로 구분할 때
display = user.name if user is not None else "게스트"
```

![조건 표현식 활용과 주의사항](/assets/posts/python-conditional-expression-patterns.svg)

## 중첩 금지

두 단계 이상 중첩하면 가독성이 급격히 떨어진다.

```python
# 나쁜 예: 중첩 삼항
grade = "A" if s >= 90 else "B" if s >= 80 else "C" if s >= 70 else "F"

# 좋은 예: if-elif 체인
if s >= 90:
    grade = "A"
elif s >= 80:
    grade = "B"
elif s >= 70:
    grade = "C"
else:
    grade = "F"
```

여러 값이 매핑된다면 딕셔너리도 고려한다.

```python
grade = {90: "A", 80: "B", 70: "C"}.get(
    (s // 10) * 10, "F"
)
```

## 줄 바꿈

긴 조건 표현식은 괄호로 감싸 줄 바꿈이 가능하다.

```python
message = (
    "정상 범위"
    if 0 <= value <= 100
    else "범위 초과"
)
```

## 정리

- `값_참 if 조건 else 값_거짓` — 조건 표현식, **값**을 반환하는 표현식
- 평가 순서: 조건 → True면 왼쪽, False면 오른쪽 (선택 안 된 쪽 미평가)
- f-string, 람다, 컴프리헨션, 함수 인수 — 값이 필요한 어디서든 사용 가능
- 중첩 2단계 이상은 금지 — `if-elif`나 `dict` 매핑으로 대체

---

**지난 글:** [match 문: Python 3.10 구조적 패턴 매칭](/posts/python-match-statement/)

**다음 글:** [바다코끼리 연산자 :=: 할당 표현식](/posts/python-walrus-operator/)

<br>
읽어주셔서 감사합니다. 😊
