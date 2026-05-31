---
title: "스택 (Stack)"
description: "LIFO 원칙으로 동작하는 스택의 개념, 배열·연결 리스트 구현, 괄호 검사·함수 호출 스택 등 핵심 응용을 알아봅니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 3
type: "knowledge"
category: "Algorithm"
tags: ["스택", "stack", "LIFO", "자료구조", "괄호검사"]
featured: false
draft: false
---

[지난 글](/posts/dsa-master-theorem/)에서 마스터 정리를 통해 분할 정복 알고리즘의 복잡도를 분석하는 법을 배웠습니다. 이번 글부터는 본격적인 자료구조 파트입니다. 먼저 가장 기본적이면서도 활용도가 높은 **스택(Stack)**을 살펴봅니다. 스택은 단순한 구조지만 함수 호출, 수식 계산, DFS까지 폭넓게 쓰이는 핵심 도구입니다.

## 스택이란

스택은 **LIFO(Last In, First Out)** 원칙을 따르는 선형 자료구조입니다. 마지막에 삽입된 원소가 가장 먼저 꺼내집니다. 접시를 쌓아두는 것과 같은 원리입니다.

핵심 연산은 세 가지입니다.

| 연산 | 설명 | 시간 복잡도 |
|------|------|-------------|
| `push(x)` | 원소 x를 맨 위에 삽입 | O(1) |
| `pop()` | 맨 위 원소 제거 후 반환 | O(1) |
| `peek()` | 맨 위 원소 조회 (제거 없음) | O(1) |
| `is_empty()` | 스택이 비어있는지 확인 | O(1) |

![스택 연산](/assets/posts/dsa-stack-operations.svg)

## 배열로 구현하기

가장 단순한 방법은 고정 크기 배열에 `top` 인덱스를 유지하는 것입니다.

```python
class ArrayStack:
    def __init__(self, capacity=100):
        self._data = [None] * capacity
        self._top = -1            # -1이면 empty

    def push(self, val):
        if self._top == len(self._data) - 1:
            raise OverflowError("스택이 가득 찼습니다")
        self._top += 1
        self._data[self._top] = val

    def pop(self):
        if self._top == -1:
            raise IndexError("스택이 비어 있습니다")
        val = self._data[self._top]
        self._top -= 1
        return val

    def peek(self):
        if self._top == -1:
            raise IndexError("스택이 비어 있습니다")
        return self._data[self._top]

    def is_empty(self):
        return self._top == -1
```

Python에서는 `list` 자체가 스택처럼 동작합니다 (`append` = push, `pop` = pop).

## 연결 리스트로 구현하기

연결 리스트 방식은 크기 제한이 없습니다. 헤드 노드가 `top` 역할을 합니다.

```python
class Node:
    def __init__(self, val):
        self.val = val
        self.next = None

class LinkedStack:
    def __init__(self):
        self._head = None

    def push(self, val):
        node = Node(val)
        node.next = self._head
        self._head = node        # 새 노드가 top

    def pop(self):
        if not self._head:
            raise IndexError("스택이 비어 있습니다")
        val = self._head.val
        self._head = self._head.next
        return val

    def peek(self):
        if not self._head:
            raise IndexError("스택이 비어 있습니다")
        return self._head.val
```

## 응용 1 — 괄호 유효성 검사

가장 대표적인 스택 응용입니다. 여는 괄호를 push하고, 닫는 괄호가 나오면 top과 짝이 맞는지 확인합니다.

```python
def is_valid_brackets(s: str) -> bool:
    stack = []
    pairs = {')': '(', '}': '{', ']': '['}

    for ch in s:
        if ch in '({[':
            stack.append(ch)
        elif ch in ')}]':
            if not stack or stack[-1] != pairs[ch]:
                return False
            stack.pop()

    return len(stack) == 0   # 남은 여는 괄호 없어야 유효

print(is_valid_brackets("({[]})"))   # True
print(is_valid_brackets("([)]"))     # False
```

![스택 응용: 괄호 검사 & 함수 호출 스택](/assets/posts/dsa-stack-applications.svg)

## 응용 2 — 후위 표기법(Postfix) 계산

인간이 쓰는 중위 표기법(3 + 4)을 컴퓨터가 처리하기 쉬운 후위 표기법(3 4 +)으로 변환 후 스택으로 평가합니다.

```python
def eval_postfix(tokens: list) -> int:
    stack = []
    ops = {'+': lambda a, b: a + b,
           '-': lambda a, b: a - b,
           '*': lambda a, b: a * b,
           '/': lambda a, b: a // b}

    for tok in tokens:
        if tok in ops:
            b, a = stack.pop(), stack.pop()
            stack.append(ops[tok](a, b))
        else:
            stack.append(int(tok))

    return stack[0]

# "3 4 + 2 *" → (3+4)*2 = 14
print(eval_postfix(['3', '4', '+', '2', '*']))  # 14
```

## 응용 3 — DFS 반복 구현

재귀 대신 명시적 스택을 사용하면 스택 오버플로를 방지할 수 있습니다.

```python
def dfs_iterative(graph, start):
    visited = set()
    stack = [start]

    while stack:
        node = stack.pop()       # LIFO: 가장 최근 노드 먼저
        if node in visited:
            continue
        visited.add(node)
        print(node, end=' ')
        for neighbor in graph[node]:
            if neighbor not in visited:
                stack.append(neighbor)
```

## 함수 호출 스택

프로그램이 실행될 때 운영체제는 자동으로 **콜 스택(Call Stack)**을 관리합니다. 함수를 호출할 때마다 스택 프레임(반환 주소, 지역 변수, 매개변수)이 push되고, 함수가 반환되면 pop됩니다. 재귀 호출이 너무 깊어지면 스택 공간이 소진되어 `StackOverflowError`가 발생하는 것도 이 원리입니다.

## 정리

- 스택은 LIFO 구조로 push/pop/peek이 모두 **O(1)** 입니다.
- 배열 구현은 메모리 효율이 좋고, 연결 리스트 구현은 크기 제한이 없습니다.
- 괄호 검사, 후위 표기법 계산, DFS, 콜 스택 등 수많은 알고리즘의 핵심 부품입니다.

---

**지난 글:** [마스터 정리](/posts/dsa-master-theorem/)

**다음 글:** [큐](/posts/dsa-queue/)

<br>
읽어주셔서 감사합니다. 😊
