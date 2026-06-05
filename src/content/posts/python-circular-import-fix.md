---
title: "순환 임포트 해결하기"
description: "두 모듈이 서로를 import할 때 발생하는 ImportError의 원인을 모듈 로딩 과정으로 이해하고, 구조 분리·지연 import·TYPE_CHECKING으로 푸는 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["순환 임포트", "import", "모듈", "디버깅", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-dependency-vulnerability-scan/)에서 외부 패키지의 위험을 점검했다면, 이번 글부터는 우리가 직접 짠 코드에서 자주 터지는 버그들을 다룬다. 그 첫 번째는 프로젝트가 조금만 커지면 누구나 한 번쯤 마주치는 **순환 임포트**(circular import)다. `ImportError: cannot import name 'X' from partially initialized module`라는 메시지를 본 적이 있다면 바로 이것이다.

## 왜 발생하는가 — 모듈은 위에서 아래로 "실행"된다

핵심은 파이썬에서 `import`가 단순한 선언이 아니라 **모듈 코드를 위에서 아래로 한 번 실행하는 일**이라는 점이다. `a.py`를 처음 import하면, 파이썬은 `a` 모듈 객체를 만들어 캐시(`sys.modules`)에 등록한 뒤, `a.py`의 코드를 한 줄씩 실행해 나간다.

문제는 두 모듈이 서로를 import할 때 생긴다. `a.py`가 실행되다가 `import b`를 만나면 `b.py` 실행으로 넘어가고, 그 `b.py`가 다시 `from a import User`를 시도한다. 그런데 이 시점에 `a` 모듈은 아직 `User`를 정의하는 줄까지 가지 못한 **"부분적으로 초기화된"** 상태다. 그래서 `User`라는 이름을 찾지 못하고 에러가 난다.

![순환 임포트가 막히는 이유](/assets/posts/python-circular-import-fix-cycle.svg)

흥미로운 점은, 같은 순환이라도 `import b`(모듈 전체)는 통과하고 `from b import Order`(이름 직접 가져오기)는 실패하는 경우가 많다는 것이다. 모듈 객체 자체는 캐시에 이미 등록돼 있어 참조할 수 있지만, 그 안의 특정 이름은 아직 만들어지지 않았기 때문이다.

## 해결법은 보통 "설계 문제"의 신호

순환 임포트가 생겼다는 건 종종 두 모듈의 책임이 제대로 나뉘지 않았다는 신호다. 그래서 가장 좋은 해결은 구조를 바로잡는 것이다.

![순환 임포트 해결법 세 가지](/assets/posts/python-circular-import-fix-solutions.svg)

### ① 구조 분리 — 가장 근본적

두 모듈이 공통으로 쓰는 무언가 때문에 서로를 참조한다면, 그 공통 부분을 제3의 모듈로 빼낸다. 그러면 `a`와 `b`는 서로가 아니라 `common`을 import하게 되어 순환이 사라진다.

```python
# common.py
class BaseEntity:
    ...

# a.py
from common import BaseEntity   # b를 import하지 않음

# b.py
from common import BaseEntity   # a를 import하지 않음
```

### ② 지연 import — 함수 안으로

순환이 일부 함수에서만 필요하다면, 그 import를 모듈 최상단이 아니라 **함수 본문 안**으로 옮긴다. import는 모듈 로딩이 끝난 뒤, 함수가 실제로 호출되는 시점에 실행되므로 순환이 풀려 있다.

```python
# a.py
def create_order(user):
    from b import Order   # 호출될 때 import → 그땐 b가 완전히 로드됨
    return Order(user=user)
```

약간의 런타임 비용이 있지만(매 호출 시 캐시 조회), import 자체는 한 번만 실제 실행되므로 대부분의 경우 무시할 만하다.

### ③ 타입 힌트만 필요하면 TYPE_CHECKING

서로의 클래스를 **타입 힌트로만** 참조하는 경우라면, 런타임에는 import할 필요가 없다. `typing.TYPE_CHECKING`은 타입 검사 도구에게는 `True`로 보이지만 실제 실행 시에는 `False`라서, 그 블록의 import는 런타임에 실행되지 않는다.

```python
# a.py
from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from b import Order        # mypy/pyright만 보고, 런타임엔 무시

def process(order: Order) -> None:   # 문자열로 평가되어 OK
    ...
```

`from __future__ import annotations`를 함께 쓰면 모든 어노테이션이 문자열로 지연 평가되어, 런타임에 실제 타입 객체가 필요 없어진다.

## 정리

순환 임포트는 "모듈 import는 코드 실행이고, 그 실행은 끝까지 가기 전엔 미완성 상태"라는 사실에서 비롯된다. 가장 좋은 답은 공통 부분을 분리해 의존 방향을 단방향으로 정리하는 것이고, 그게 어려우면 함수 안 지연 import나 `TYPE_CHECKING`으로 우회한다. 에러 메시지를 임시방편으로 누르기보다, 모듈 간 의존 관계를 다시 들여다보는 계기로 삼는 편이 좋다. 다음 글에서는 문자열과 바이트 사이에서 자주 터지는 인코딩·디코딩 에러를 다룬다.

---

**지난 글:** [의존성 취약점 스캔](/posts/python-dependency-vulnerability-scan/)

**다음 글:** [인코딩·디코딩 에러 다루기](/posts/python-encoding-decoding-errors/)

<br>
읽어주셔서 감사합니다. 😊
