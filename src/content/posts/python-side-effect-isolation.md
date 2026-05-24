---
title: "부작용 격리 패턴: 순수와 불순을 분리하는 설계"
description: "부작용(side effect)을 순수 코어에서 분리하는 계층 분리 패턴, 의존성 주입, 효과를 반환값으로 표현하기, 테스트 전략을 코드 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["Python", "부작용격리", "SideEffect", "함수형설계", "의존성주입", "클린아키텍처"]
featured: false
draft: false
---

[지난 글](/posts/python-functional-data-pipelines/)에서 함수형 데이터 파이프라인을 설계했다. 이번 글은 함수형 프로그래밍 파트의 마지막 주제로, **부작용 격리(Side Effect Isolation)** 패턴을 정리한다. 어떤 코드도 IO를 완전히 없앨 수 없다. 핵심은 부작용을 없애는 것이 아니라, 어디에 위치시킬지 설계하는 것이다.

## 부작용이란?

부작용은 함수가 반환값 이외에 외부 세계에 미치는 모든 영향이다.

```python
# 부작용의 예시들
import datetime
import random

def get_now():
    return datetime.datetime.now()   # 매번 다른 결과 → 부작용(외부 상태 읽기)

def save_to_db(record):
    db.insert(record)   # DB 변경 → 부작용

def log_error(msg):
    print(f"ERROR: {msg}")   # 화면 출력 → 부작용

def roll_dice():
    return random.randint(1, 6)   # 비결정적 → 부작용
```

부작용 자체가 나쁜 것은 아니다. 문제는 부작용이 비즈니스 로직과 뒤섞여 있을 때다.

## 계층 분리 패턴

![부작용 격리 계층 구조](/assets/posts/python-side-effect-isolation-layers.svg)

가장 효과적인 부작용 격리 방법은 코드를 세 계층으로 나누는 것이다.

**순수 코어(Pure Core)**: 비즈니스 로직, 데이터 변환, 계산. 외부 의존성 없음. 100% 단위 테스트 가능.

**어댑터 계층(Adapter Layer)**: 외부 시스템을 순수 함수 인터페이스로 변환.

**외부 계층(IO Layer)**: 실제 DB, 파일, 네트워크 IO.

```python
# 계층 분리 예시

# 1. 순수 코어 — IO 없음
def calculate_discount(price: float, user_tier: str) -> float:
    rates = {"gold": 0.2, "silver": 0.1, "basic": 0.0}
    return price * (1 - rates.get(user_tier, 0.0))

def apply_coupon(price: float, coupon_code: str) -> float:
    coupons = {"SAVE10": 0.1, "HALF": 0.5}
    return price * (1 - coupons.get(coupon_code, 0.0))

# 2. 어댑터 — DB → 순수 타입 변환
def get_user_tier(user_id: int) -> str:
    row = db.query("SELECT tier FROM users WHERE id = ?", user_id)
    return row["tier"] if row else "basic"

# 3. 조합 (불순 경계)
def get_final_price(user_id: int, price: float, coupon: str) -> float:
    tier = get_user_tier(user_id)          # IO
    discounted = calculate_discount(price, tier)    # 순수
    return apply_coupon(discounted, coupon)         # 순수
```

`calculate_discount`와 `apply_coupon`은 완벽히 순수하므로 DB 없이 단위 테스트가 가능하다.

## 실전 격리 패턴들

![부작용 격리 실전 패턴](/assets/posts/python-side-effect-isolation-patterns.svg)

**패턴 1: 의존성 주입 (Dependency Injection)**

`datetime.now()`처럼 실행 시간에 따라 달라지는 값을 함수 인자로 받는다.

```python
from datetime import datetime

# 나쁜 패턴: 내부에서 현재 시간 생성 → 테스트 어려움
def is_expired_bad(item) -> bool:
    return item.expiry < datetime.now()

# 좋은 패턴: 현재 시간을 인자로 받음 → 테스트 쉬움
def is_expired(item, now: datetime) -> bool:
    return item.expiry < now

# 테스트
def test_is_expired():
    fake_now = datetime(2030, 1, 1)
    assert is_expired(expired_item, fake_now) is True
```

**패턴 2: 효과를 반환값으로 표현**

실제로 부작용을 일으키는 대신, "이런 부작용을 일으켜야 한다"는 데이터를 반환하고, 실행은 상위 코드에 위임한다.

```python
from dataclasses import dataclass
from typing import Union

@dataclass
class SendEmail:
    to: str
    subject: str
    body: str

@dataclass
class SaveRecord:
    table: str
    data: dict

Effect = Union[SendEmail, SaveRecord]

def process_order(order: dict) -> list[Effect]:
    effects = []
    if order["total"] > 100000:
        effects.append(SendEmail(
            to=order["email"],
            subject="VIP 혜택 안내",
            body="...",
        ))
    effects.append(SaveRecord(table="orders", data=order))
    return effects   # 순수! IO 없음

# 경계에서 실행
def run_order(order: dict) -> None:
    for effect in process_order(order):   # 순수 로직
        if isinstance(effect, SendEmail):
            email_service.send(effect)    # IO
        elif isinstance(effect, SaveRecord):
            db.save(effect)               # IO
```

**패턴 3: 랜덤과 시간을 인자로 받기**

```python
import random
from datetime import datetime

# 나쁜 패턴
def generate_token() -> str:
    return f"{random.randint(1000, 9999)}-{datetime.now().timestamp()}"

# 좋은 패턴
def generate_token(rand_num: int, timestamp: float) -> str:
    return f"{rand_num}-{timestamp}"

# 호출 시 주입
token = generate_token(random.randint(1000, 9999), datetime.now().timestamp())
```

## 테스트 관점에서의 이점

부작용을 격리하면 테스트 코드가 극적으로 단순해진다.

```python
# 의존성 주입 없이 → mock 필요
from unittest.mock import patch
with patch("mymodule.datetime") as mock_dt:
    mock_dt.now.return_value = datetime(2030, 1, 1)
    result = is_expired_bad(item)

# 의존성 주입 → mock 불필요
result = is_expired(item, now=datetime(2030, 1, 1))
```

mock을 많이 써야 하는 테스트는 부작용이 충분히 격리되지 않았다는 신호다.

## 실용적인 균형

모든 코드를 순수하게 만들려는 강박은 역효과를 낸다. 중요한 것은 **비즈니스 로직의 핵심은 순수하게, 나머지는 경계에 격리**하는 감각이다. 작은 유틸리티 함수에 의존성 주입을 강제할 필요는 없다. 테스트하기 어렵다고 느끼는 순간, 부작용이 잘못된 위치에 있다는 신호로 받아들이는 것으로 충분하다.

이번 글로 Python 함수형 프로그래밍 파트를 마친다. 다음 파트에서는 **데코레이터(Decorator)** 패턴을 심도 있게 다룬다.

---

**지난 글:** [함수형 데이터 파이프라인: 실전 설계 패턴](/posts/python-functional-data-pipelines/)

**다음 글:** [데코레이터의 본질: 함수를 감싸는 함수](/posts/python-decorator-essence/)

<br>
읽어주셔서 감사합니다. 😊
