---
title: "yield from: 서브제너레이터 위임과 투명한 전달"
description: "yield from의 동작 원리, 서브제너레이터 위임, send/throw/close 투명 전달, return 값 수집 패턴을 실습 코드와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["Python", "yield from", "제너레이터", "위임", "서브제너레이터", "PEP380"]
featured: false
draft: false
---

[지난 글](/posts/python-generator-function/)에서 `yield`로 제너레이터 함수를 만드는 방법을 익혔다. 제너레이터 여러 개를 합쳐야 할 때, 또는 한 제너레이터가 다른 제너레이터에 작업을 위임하고 싶을 때 `yield from`이 등장한다. Python 3.3에서 PEP 380으로 도입된 이 구문은 단순한 문법 설탕처럼 보이지만 훨씬 깊은 의미를 담고 있다.

## yield from의 기본 사용

`yield from iterable`은 이터러블의 모든 값을 차례로 yield한다. 가장 간단한 예:

```python
def gen_a():
    yield 1
    yield 2

def gen_b():
    yield 3
    yield 4

def combined():
    yield from gen_a()   # gen_a의 모든 값을 yield
    yield from gen_b()   # gen_b의 모든 값을 yield

print(list(combined()))  # [1, 2, 3, 4]
```

리스트나 range 같은 일반 이터러블에도 사용할 수 있다.

```python
def flatten(nested):
    for item in nested:
        if isinstance(item, list):
            yield from flatten(item)   # 재귀 위임
        else:
            yield item

data = [1, [2, 3], [4, [5, 6]]]
print(list(flatten(data)))  # [1, 2, 3, 4, 5, 6]
```

## 위임의 진정한 의미

`yield from`은 단순히 값을 전달하는 것 이상이다. 위임 제너레이터는 **투명한 통로**가 된다.

![yield from 위임 구조](/assets/posts/python-yield-from-delegation.svg)

세 개의 역할이 있다.
1. **호출자(caller)**: for 루프나 `next()`를 호출하는 코드
2. **위임 제너레이터(delegating generator)**: `yield from sub`를 포함한 제너레이터
3. **서브 제너레이터(subgenerator)**: `yield from`이 가리키는 제너레이터

`yield from`이 활성화된 동안 호출자와 서브 제너레이터는 위임 제너레이터를 거치지 않고 **직접 통신**한다.

- `next()`와 `send()`: 서브 제너레이터의 `__next__`/`send`로 전달
- `throw()`: 서브 제너레이터의 `throw()`로 전달
- `close()`: 서브 제너레이터의 `close()` 호출
- `StopIteration.value`: 위임 제너레이터에서 `yield from` 식의 반환값으로 수집

## 리팩터링 비교

![yield from 리팩터링 비교](/assets/posts/python-yield-from-refactoring.svg)

수동으로 for 루프를 이중으로 쓰는 방법과 `yield from`의 차이는 단순히 줄 수가 아니다. 수동 방법은 `send()`와 `throw()`를 서브 제너레이터에 전달하지 않는다.

```python
def manual(sub):
    for item in sub:
        yield item           # send()가 sub에 전달되지 않음

def delegating(sub):
    yield from sub           # send()가 sub.send()로 투명하게 전달됨
```

코루틴 패턴에서 이 차이는 매우 중요하다.

## return 값 수집

서브 제너레이터가 `return` 으로 값을 반환하면 `yield from` 식의 결과값으로 받을 수 있다.

```python
def compute():
    yield "계산 중..."
    yield "조금만 더..."
    return 42               # StopIteration(42)

def main():
    result = yield from compute()   # 42를 받음
    print(f"결과: {result}")
    yield "완료"

g = main()
print(next(g))   # "계산 중..."
print(next(g))   # "조금만 더..."
print(next(g))   # "완료" 출력 전에 "결과: 42" 도 출력됨
```

이 패턴은 제너레이터 기반 비동기 코드에서 `await`가 등장하기 전에 널리 쓰였다.

## 재귀 제너레이터와 yield from

트리 구조 순회는 `yield from`의 재귀 패턴이 빛나는 곳이다.

```python
class Node:
    def __init__(self, value, children=None):
        self.value = value
        self.children = children or []

def dfs(node):
    yield node.value
    for child in node.children:
        yield from dfs(child)   # 재귀 위임

root = Node(1, [Node(2, [Node(4), Node(5)]), Node(3)])
print(list(dfs(root)))  # [1, 2, 4, 5, 3]
```

`yield from dfs(child)` 없이 작성하려면 내부 for 루프를 중첩해야 하고, `send()`/`throw()` 지원도 끊긴다.

## yield from과 asyncio

`yield from`이 비동기 프로그래밍과 연결되는 지점이다. Python 3.4의 asyncio는 `yield from`으로 코루틴을 위임했다.

```python
# Python 3.4 스타일 (역사적 이해용)
import asyncio

@asyncio.coroutine
def old_style():
    result = yield from asyncio.sleep(1)
    return result
```

Python 3.5부터 `async def` / `await`가 이를 대체했다. `await expr`은 사실 `yield from expr`의 더 명확한 형태다.

```python
async def new_style():
    result = await asyncio.sleep(1)
    return result
```

`yield from`을 이해하면 `await`의 동작 원리도 자연스럽게 따라온다.

## 중첩 yield from

`yield from`을 여러 단계로 중첩할 수 있다.

```python
def level3():
    yield 1
    yield 2
    return "level3 done"

def level2():
    r = yield from level3()
    print(f"level2가 받은 값: {r}")
    return "level2 done"

def level1():
    r = yield from level2()
    print(f"level1가 받은 값: {r}")

for _ in level1():
    pass
# level2가 받은 값: level3 done
# level1가 받은 값: level2 done
```

중간 단계가 얼마나 많아도 호출자는 최하위 서브 제너레이터와 직접 통신한다.

## 정리

| 기능 | for 루프 수동 위임 | yield from |
|------|-------------------|------------|
| 값 전달 | ✓ | ✓ |
| send() 전달 | ✗ | ✓ |
| throw() 전달 | ✗ | ✓ |
| close() 전달 | ✗ | ✓ |
| return 값 수집 | ✗ | ✓ |

`yield from`은 제너레이터 프로토콜을 완전히 존중하는 위임 메커니즘이다. 다음 글에서는 `yield from`이 코루틴 패턴에 어떻게 활용되는지, 그리고 `send()`로 값을 제너레이터에 주입하는 방법을 살펴본다.

---

**지난 글:** [제너레이터 함수: yield로 만드는 지연 이터레이터](/posts/python-generator-function/)

**다음 글:** [제너레이터 기반 코루틴: send()와 초기 코루틴 패턴](/posts/python-coroutine-basics/)

<br>
읽어주셔서 감사합니다. 😊
