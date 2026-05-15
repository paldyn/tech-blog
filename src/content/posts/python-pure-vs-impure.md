---
title: "순수 함수 vs 부수 효과 — 파이썬에서의 함수형 사고"
description: "순수 함수와 부순수 함수의 차이, 참조 투명성과 부수 효과의 의미, 그리고 실전에서 부수 효과를 경계로 격리하는 패턴을 파이썬 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["Python", "순수함수", "부수효과", "함수형프로그래밍", "lru_cache"]
featured: false
draft: false
---

[지난 글](/posts/python-call-stack-traceback/)에서 콜 스택과 트레이스백을 살펴봤습니다. 이번에는 **순수 함수(pure function)** 와 **부수 효과(side effect)** 개념을 다룹니다. 함수형 프로그래밍의 핵심 원칙이며, 파이썬 코드를 테스트하기 쉽고 예측 가능하게 만드는 실전 도구이기도 합니다.

## 순수 함수의 정의

두 조건을 모두 만족해야 순수 함수입니다.

1. **참조 투명성(referential transparency)**: 같은 인자를 넘기면 언제나 같은 값을 반환한다
2. **부수 효과 없음(no side effects)**: 함수 실행이 외부 상태를 변경하지 않는다

```python
# ✓ 순수 함수
def add(a: int, b: int) -> int:
    return a + b

# 같은 입력 → 언제나 같은 출력
add(1, 2)  # 3
add(1, 2)  # 3 — 항상

# ✗ 부순수 함수 (같은 입력에도 다른 출력)
import random
def random_add(a: int) -> int:
    return a + random.randint(0, 10)

random_add(1)  # 7? 3? 매번 다름
```

![순수 함수 vs 부순수 함수](/assets/posts/python-pure-vs-impure-comparison.svg)

## 부수 효과의 종류

부수 효과는 함수 외부에 영향을 미치는 모든 행위입니다.

```python
# 1. 전역 변수 수정
counter = 0
def increment():
    global counter
    counter += 1  # 부수 효과

# 2. 가변 인자 수정
def append_zero(lst: list) -> list:
    lst.append(0)  # 호출자의 리스트를 변경!
    return lst

# 3. I/O 작업
def save(data):
    with open("out.txt", "w") as f:
        f.write(str(data))  # 파일 시스템 변경

# 4. 네트워크 호출
# 5. 날짜/시간 읽기 (호출 시점에 따라 다름)
# 6. 예외 발생 (흐름 제어를 바꿈)
```

부수 효과 자체가 나쁜 것은 아닙니다. I/O 없는 유용한 프로그램은 없습니다. 문제는 부수 효과가 **숨어 있거나 예측 불가능한** 경우입니다.

## 순수 함수의 이점

### 테스트 용이성

외부 의존 없이 인자와 반환값만으로 검증 가능합니다.

```python
# 순수 함수 — mock 없이 직접 테스트
def calc_tax(amount: float, rate: float) -> float:
    return round(amount * rate, 2)

assert calc_tax(100.0, 0.1) == 10.0
assert calc_tax(200.0, 0.05) == 10.0
```

### 캐시 가능 — lru_cache

참조 투명성이 보장되므로 결과를 안전하게 캐시할 수 있습니다.

```python
from functools import lru_cache

@lru_cache(maxsize=256)
def fib(n: int) -> int:
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

fib(100)  # 빠름 — 중간 값들이 캐시됨
```

부수 효과가 있는 함수에 `lru_cache` 를 쓰면 첫 번째 호출의 효과가 반복되지 않아 버그가 생깁니다.

### 병렬·동시성 안전

외부 상태를 건드리지 않으므로 여러 스레드에서 동시에 실행해도 레이스 컨디션이 없습니다.

```python
from concurrent.futures import ProcessPoolExecutor

def square(n: int) -> int:
    return n * n  # 순수 함수

with ProcessPoolExecutor() as executor:
    results = list(executor.map(square, range(1000)))
```

## 가변 인자 함정 — 불변 복사본 반환

```python
# ✗ 인자를 수정하는 함수
def remove_negatives(nums: list[int]) -> list[int]:
    for i in range(len(nums) - 1, -1, -1):
        if nums[i] < 0:
            nums.pop(i)   # 호출자의 리스트 수정!
    return nums

# ✓ 새 리스트를 반환
def remove_negatives(nums: list[int]) -> list[int]:
    return [x for x in nums if x >= 0]  # 원본 불변

original = [1, -2, 3, -4, 5]
cleaned = remove_negatives(original)
print(original)  # [1, -2, 3, -4, 5] — 그대로
print(cleaned)   # [1, 3, 5]
```

## 부수 효과 격리 패턴

현실에서는 I/O, 데이터베이스, 네트워크가 필요합니다. 핵심 전략은 **비즈니스 로직(순수)과 효과(경계)를 분리**하는 것입니다.

![부수 효과 격리 패턴](/assets/posts/python-pure-vs-impure-refactor.svg)

```python
# ✓ 순수 함수 — 비즈니스 로직만
def apply_discount(total: float, threshold: float, rate: float) -> float:
    return total * (1 - rate) if total > threshold else total

def build_receipt(order: dict, final_total: float) -> dict:
    return {
        "order_id": order["id"],
        "items": order["items"],
        "original": order["total"],
        "final": final_total,
    }

# ✗ 부수 효과 — 경계에만 위치
def process_order(order_id: str) -> None:
    # 경계: I/O
    order = db.get_order(order_id)

    # 순수 함수들
    final = apply_discount(order["total"], 100.0, 0.1)
    receipt = build_receipt(order, final)

    # 경계: I/O
    db.save_receipt(receipt)
    email.send(order["customer_email"], receipt)
```

`apply_discount` 와 `build_receipt` 는 외부 의존 없이 단독으로 테스트할 수 있습니다.

## 날짜·시간 — 주입으로 순수화

```python
from datetime import datetime, date

# ✗ 비순수 — 실행 시점에 따라 결과 다름
def is_expired_impure(expiry: date) -> bool:
    return expiry < date.today()  # 오늘 날짜에 의존

# ✓ 순수 — 오늘 날짜를 인자로 주입
def is_expired(expiry: date, today: date) -> bool:
    return expiry < today

# 테스트에서 날짜 고정 가능
is_expired(date(2025, 1, 1), today=date(2025, 6, 1))  # True
is_expired(date(2030, 1, 1), today=date(2025, 6, 1))  # False
```

## 핵심 정리

- 순수 함수: 같은 입력 → 같은 출력, 외부 상태 무수정
- 부수 효과: 전역 변수 수정, I/O, 가변 인자 수정 등
- 순수 함수 → 테스트 쉬움, `lru_cache` 적용 가능, 병렬 안전
- 부수 효과는 없애는 게 아니라 **경계로 격리** 하는 것이 목표
- 날짜·설정 같은 환경값은 인자로 주입해 순수화

---

**지난 글:** [파이썬 콜 스택과 트레이스백 읽기](/posts/python-call-stack-traceback/)

**다음 글:** [파이썬 리스트 컴프리헨션 완전 정복](/posts/python-list-comprehension/)

<br>
읽어주셔서 감사합니다. 😊
