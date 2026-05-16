---
title: "Protocol: 구조적 서브타이핑"
description: "Python typing.Protocol로 구조적 서브타이핑을 구현하는 방법, @runtime_checkable 데코레이터, ABC와의 차이점, 실용적인 Protocol 설계 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["python", "Protocol", "구조적타이핑", "typing", "덕타이핑", "타입힌트"]
featured: false
draft: false
---

[지난 글](/posts/python-abstract-base-class/)에서 ABC로 명목적 서브타이핑을 구현하는 방법을 살펴보았습니다. Python 3.8에 추가된 `typing.Protocol`은 다른 접근법인 구조적 서브타이핑(structural subtyping)을 제공합니다. 클래스가 특정 메서드를 가지고 있으면 명시적 상속 없이도 해당 타입으로 인정됩니다. 이 방식은 Python의 덕 타이핑 철학과 정적 타입 검사를 자연스럽게 연결합니다.

## Protocol 기본

`Protocol`을 상속한 클래스를 정의하고, 필요한 메서드 서명만 선언합니다.

```python
from typing import Protocol

class Drawable(Protocol):
    def draw(self, x: int, y: int) -> None: ...
```

이제 `draw(x, y)` 메서드를 가진 모든 클래스는 `Drawable`로 취급됩니다. 상속이 필요 없습니다.

## ABC와의 비교

![Protocol vs ABC: 두 가지 서브타이핑](/assets/posts/python-protocol-typing-compare.svg)

## 코드 예제

![Protocol 정의와 사용 예제](/assets/posts/python-protocol-typing-code.svg)

`Button`이 `Drawable`을 상속하지 않았지만 `draw()` 메서드를 구현했으므로 mypy·pyright 같은 정적 타입 검사기가 `Drawable` 타입으로 인정합니다.

## @runtime_checkable

기본 `Protocol`은 정적 타입 검사 전용입니다. 런타임에 `isinstance()`로 확인하려면 `@runtime_checkable`을 추가해야 합니다.

```python
from typing import Protocol, runtime_checkable

@runtime_checkable
class Closeable(Protocol):
    def close(self) -> None: ...

import io
isinstance(io.StringIO(), Closeable)  # True
```

`@runtime_checkable`은 메서드 존재 여부만 확인하고, 시그니처(인자 타입·반환 타입)는 검사하지 않습니다. 완전한 타입 안전성은 정적 검사기가 담당합니다.

## 속성을 포함한 Protocol

메서드뿐 아니라 속성도 선언할 수 있습니다.

```python
from typing import Protocol

class Named(Protocol):
    name: str  # 인스턴스가 name 속성을 가져야 함

def greet(obj: Named) -> str:
    return f"Hello, {obj.name}"
```

## 프로토콜 합성

여러 Protocol을 조합해 더 구체적인 프로토콜을 만들 수 있습니다.

```python
class Serializable(Protocol):
    def to_bytes(self) -> bytes: ...

class Hashable(Protocol):
    def __hash__(self) -> int: ...

class CacheKey(Serializable, Hashable, Protocol):
    pass
```

## 실용적 패턴: 외부 라이브러리 통합

Protocol의 진가는 수정할 수 없는 외부 클래스를 다룰 때 드러납니다.

```python
from typing import Protocol

class FileWriter(Protocol):
    def write(self, data: str) -> int: ...
    def flush(self) -> None: ...

def save(writer: FileWriter, content: str) -> None:
    writer.write(content)
    writer.flush()

import io
# io.StringIO를 수정하지 않아도 FileWriter로 사용 가능
save(io.StringIO(), "hello")
```

`io.StringIO`는 `FileWriter`를 상속하지 않지만 두 메서드를 모두 가지므로 정적 검사도 통과합니다.

## Protocol vs ABC 선택 기준

`ABC`가 적합한 경우:
- 공통 구현(믹스인 로직)을 제공하고 싶을 때
- 런타임 상속 계층이 중요할 때
- 미구현 강제 에러를 원할 때

`Protocol`이 적합한 경우:
- 외부 라이브러리 클래스와 인터페이스를 정의할 때
- 덕 타이핑을 정적으로 문서화하고 싶을 때
- 클래스를 수정하지 않고 타입 호환성을 표현할 때

---

**지난 글:** [추상 기반 클래스: ABC와 abstractmethod](/posts/python-abstract-base-class/)

**다음 글:** [@dataclass: 보일러플레이트 없는 데이터 클래스](/posts/python-dataclass/)

<br>
읽어주셔서 감사합니다. 😊
