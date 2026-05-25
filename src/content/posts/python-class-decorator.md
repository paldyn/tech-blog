---
title: "클래스로 만드는 데코레이터"
description: "__call__을 구현한 callable 클래스로 데코레이터를 만드는 패턴, 클래스에 데코레이터를 적용하는 패턴, 함수 데코레이터와의 차이를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["Python", "데코레이터", "클래스", "__call__", "singleton"]
featured: false
draft: false
---

[지난 글](/posts/python-decorator-args/)에서 인자를 받는 3겹 데코레이터 패턴을 살펴봤다. 이번 글에서는 데코레이터를 함수가 아닌 **클래스로 구현하는 방법**과 **클래스 자체에 데코레이터를 적용하는 방법**을 다룬다. 클래스 기반 데코레이터는 상태를 명확하게 관리하고, 메서드를 추가해 인터페이스를 풍부하게 만들 때 함수 클로저보다 더 적합하다.

## callable 클래스로 함수 데코레이터 구현

`__call__` 메서드를 구현한 클래스의 인스턴스는 함수처럼 호출할 수 있다. 이를 이용해 데코레이터를 클래스로 표현한다.

```python
from functools import update_wrapper

class CountCalls:
    def __init__(self, func):
        update_wrapper(self, func)
        self.func = func
        self.count = 0

    def __call__(self, *args, **kwargs):
        self.count += 1
        return self.func(*args, **kwargs)

@CountCalls
def add(a, b):
    return a + b

add(1, 2); add(3, 4)
print(add.count)   # 2
```

`@CountCalls`가 적용되면 `add = CountCalls(add)`가 실행된다. `add`는 이제 `CountCalls` 인스턴스다. `add(1, 2)`를 호출하면 `CountCalls.__call__(1, 2)`가 실행된다.

`update_wrapper(self, func)`를 `__init__`에서 호출해 메타데이터를 보존한다. `@wraps(func)`는 함수에만 쓸 수 있으므로 클래스에서는 `update_wrapper`를 직접 사용한다.

![클래스 데코레이터 두 패턴](/assets/posts/python-class-decorator-concept.svg)

## 함수 데코레이터 vs 클래스 데코레이터

클래스 데코레이터가 유리한 경우는 상태 관리가 명시적이어야 할 때다.

```python
# 함수 클로저로 상태 관리 (비교용)
def count_calls(func):
    from functools import wraps
    count_calls.count = 0   # 함수 속성으로 상태 (어색함)
    @wraps(func)
    def wrapper(*args, **kwargs):
        wrapper.count += 1
        return func(*args, **kwargs)
    wrapper.count = 0
    return wrapper

# 클래스로 상태 관리 (명시적)
class CountCalls:
    def __init__(self, func):
        update_wrapper(self, func)
        self.func = func
        self.count = 0          # 인스턴스 속성, 명확함

    def reset(self):            # 메서드 추가 가능
        self.count = 0

    def __call__(self, *args, **kwargs):
        self.count += 1
        return self.func(*args, **kwargs)
```

클래스는 `reset()` 같은 메서드를 자연스럽게 추가할 수 있다. 상태가 복잡하거나 인터페이스가 필요하면 클래스 데코레이터가 더 적합하다.

![클래스 데코레이터 코드 예시](/assets/posts/python-class-decorator-code.svg)

## 클래스 자체에 데코레이터 적용

데코레이터는 함수뿐 아니라 클래스에도 적용할 수 있다. 가장 유명한 예는 싱글턴 패턴이다.

```python
def singleton(cls):
    instances = {}
    def get_instance(*args, **kwargs):
        if cls not in instances:
            instances[cls] = cls(*args, **kwargs)
        return instances[cls]
    return get_instance

@singleton
class Database:
    def __init__(self, url):
        self.url = url
        print(f"DB 연결: {url}")

db1 = Database("postgresql://localhost/mydb")
db2 = Database("postgresql://localhost/mydb")
print(db1 is db2)   # True — 같은 인스턴스
```

`@singleton`이 적용되면 `Database = singleton(Database)`가 실행된다. 이후 `Database(...)`는 실제 클래스 생성자가 아니라 `get_instance`를 호출한다.

## 클래스 속성 수정 데코레이터

클래스 데코레이터로 클래스에 메서드나 속성을 동적으로 추가할 수 있다.

```python
def add_repr(cls):
    """클래스에 자동 __repr__ 추가"""
    def __repr__(self):
        attrs = {k: v for k, v in self.__dict__.items()
                 if not k.startswith('_')}
        return f"{cls.__name__}({attrs})"
    cls.__repr__ = __repr__
    return cls   # 같은 cls 반환

@add_repr
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y

p = Point(1, 2)
print(p)   # Point({'x': 1, 'y': 2})
```

여기서는 `cls`를 수정한 뒤 그대로 반환한다. 새 객체를 만드는 게 아니라 기존 클래스에 속성을 추가하는 방식이다.

## 메서드에 데코레이터 적용 주의점

클래스 내부 메서드에 클래스 기반 데코레이터를 적용하면 `self` 바인딩 문제가 생길 수 있다.

```python
class CountCalls:
    def __init__(self, func):
        update_wrapper(self, func)
        self.func = func
        self.count = 0

    def __call__(self, *args, **kwargs):
        self.count += 1
        return self.func(*args, **kwargs)

    def __get__(self, obj, objtype=None):
        # 메서드로 쓸 때 self 바인딩
        from functools import partial
        if obj is None:
            return self
        return partial(self, obj)

class MyClass:
    @CountCalls
    def method(self):
        print("method called")
```

`__get__`을 구현해야 디스크립터 프로토콜을 따르므로 메서드로 정상 동작한다. 일반 함수 데코레이터에는 이 문제가 없지만, 클래스 기반 데코레이터를 메서드에 쓸 때는 `__get__`을 추가해야 한다.

---

**지난 글:** [인자를 받는 데코레이터 만들기](/posts/python-decorator-args/)

**다음 글:** [중첩 데코레이터와 적용 순서](/posts/python-stacked-decorators/)

<br>
읽어주셔서 감사합니다. 😊
