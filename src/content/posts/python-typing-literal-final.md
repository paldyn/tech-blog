---
title: "Literal과 Final: 값과 불변을 타입으로 표현하기"
description: "Literal로 허용 값을 특정 상수로 제한하고, Final로 재할당을 금지하는 법, 그리고 둘을 조합한 안전한 상수 설계까지 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["Literal", "Final", "상수", "타입힌트", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-typing-union-optional/)에서 여러 타입 중 하나를 허용하는 법을 배웠다. 이번에는 한 걸음 더 들어가, "타입"이 아니라 **특정 값**으로 제한하고 싶을 때를 다룬다. 파일 모드는 `"r"`, `"w"`, `"a"` 중 하나여야 하고, 설정 상수는 한 번 정하면 바뀌면 안 된다. `Literal`과 `Final`이 바로 이런 제약을 타입으로 표현하는 도구다.

## Literal: 값을 제한하기

`Literal`은 변수나 인자가 가질 수 있는 값을 **구체적인 상수들**로 한정한다. `str`이라고만 하면 어떤 문자열이든 통과하지만, `Literal["r", "w", "a"]`는 정확히 세 문자열만 허용한다.

```python
from typing import Literal

def open_file(path: str, mode: Literal["r", "w", "a"]) -> None:
    ...

open_file("a.txt", "w")   # OK
open_file("a.txt", "x")   # 오류: "x"는 허용 값이 아니다
```

이전에는 잘못된 모드 문자열을 런타임에 가서야 발견했지만, `Literal` 덕분에 코드를 작성하는 순간 IDE가 잡아낸다.

## Final: 재할당 금지

`Final`은 "이 변수는 한 번 할당하면 다시 바뀌지 않는다"고 선언한다. 즉 상수를 표현하는 방법이다. 대문자 이름 관례만으로는 검사기가 강제하지 못하지만, `Final`을 쓰면 재할당 시 오류로 잡힌다.

```python
from typing import Final

MAX_RETRIES: Final = 3
RATE: Final[float] = 0.05

MAX_RETRIES = 5    # 오류: Final 변수는 재할당 금지
```

![Literal vs Final — 무엇을 제약하나](/assets/posts/python-typing-literal-final-concept.svg)

`Final`은 타입을 함께 적을 수도(`Final[float]`), 생략하고 값에서 추론하게 할 수도(`Final = 3`) 있다. 클래스 속성에 `Final`을 붙이면 서브클래스에서 덮어쓰는 것도 막는다.

## 둘을 함께 쓰기

`Literal`과 `Final`은 자주 함께 등장한다. 특히 타입 별칭과 결합하면 코드가 훨씬 읽기 좋아진다.

```python
from typing import Literal, Final

Mode = Literal["r", "w", "a"]    # 타입 별칭

DEFAULT_MODE: Final[Mode] = "r"

def open_file(path: str, mode: Mode = DEFAULT_MODE) -> None:
    ...
```

![Literal과 Final 사용 예](/assets/posts/python-typing-literal-final-code.svg)

`Mode`라는 별칭을 한 번 정의해 두면 여러 함수에서 재사용할 수 있고, 허용 값을 바꿀 때 한 곳만 고치면 된다.

## Literal과 좁히기

`Literal`은 좁히기와 결합할 때 진가를 발휘한다. 값에 따라 분기하면 검사기가 각 분기의 타입을 정밀하게 추론한다.

```python
from typing import Literal

def fetch(fmt: Literal["json", "csv"]) -> str | list:
    if fmt == "json":
        return "{}"        # 이 분기에서 fmt는 "json"
    else:
        return []          # 이 분기에서 fmt는 "csv"
```

값 기반 좁히기는 상태 머신이나 디스패치 로직을 타입 안전하게 만드는 강력한 패턴이다.

## 언제 무엇을 쓰나

정리하면 이렇다. **허용되는 값의 집합을 제한**하고 싶으면 `Literal`을, **재할당을 금지**하고 싶으면 `Final`을 쓴다. 둘 다 런타임에 강제되는 것은 아니고, 정적 검사기에 의도를 알려 주는 장치다. 그래도 enum이 과한 단순한 플래그나 모드 문자열에는 `Literal`이, 모듈 수준 상수에는 `Final`이 가볍고 명확한 선택이다. 다음 글에서는 딕셔너리에 구조를 부여하는 TypedDict를 다룬다.

---

**지난 글:** [Union과 Optional: 여러 타입을 허용하기](/posts/python-typing-union-optional/)

**다음 글:** [TypedDict: 딕셔너리에 구조를 부여하기](/posts/python-typing-typed-dict/)

<br>
읽어주셔서 감사합니다. 😊
