---
title: "match 문: Python 3.10 구조적 패턴 매칭"
description: "Python 3.10에서 도입된 match/case 구문의 리터럴·캡처·시퀀스·매핑·클래스 패턴, 가드 조건, OR 패턴, if-elif와의 비교까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["Python", "match", "case", "패턴매칭", "3.10", "중급"]
featured: false
draft: false
---

[지난 글](/posts/python-else-on-loop/)에서 루프의 `else` 구문을 살펴봤다. Python 3.10에는 완전히 새로운 제어 흐름 구문이 추가됐다. 바로 **구조적 패턴 매칭(Structural Pattern Matching)** — `match` / `case` 문이다. 단순한 switch-case가 아니라, 값·구조·타입을 동시에 검사하고 변수에 바인딩까지 할 수 있다.

## 기본 문법

```python
match 대상:
    case 패턴1:
        # 처리1
    case 패턴2:
        # 처리2
    case _:
        # 와일드카드 (기본 케이스)
```

`match`는 대상 값을 위에서 아래로 각 `case` 패턴과 비교한다. 처음 매칭되는 케이스 하나만 실행된다. `_`는 어떤 값에도 매칭되는 와일드카드로, `else` 역할을 한다.

## 리터럴 패턴

가장 단순한 형태. 특정 값과 일치하는지 확인한다.

```python
def http_status(status):
    match status:
        case 200:
            return "OK"
        case 404:
            return "Not Found"
        case 500:
            return "Server Error"
        case _:
            return "Unknown"
```

![match / case 구조적 패턴 매칭](/assets/posts/python-match-statement-overview.svg)

## OR 패턴

`|`로 여러 패턴을 하나의 케이스로 묶을 수 있다.

```python
match status:
    case 200 | 201 | 204:
        return "성공"
    case 400 | 401 | 403:
        return "클라이언트 오류"
    case 500 | 502 | 503:
        return "서버 오류"
```

## 캡처 패턴 — 변수 바인딩

단순 변수명은 해당 값을 캡처한다.

```python
match point:
    case (0, 0):
        print("원점")
    case (x, 0):
        print(f"x축 위 ({x}, 0)")
    case (0, y):
        print(f"y축 위 (0, {y})")
    case (x, y):
        print(f"일반 좌표 ({x}, {y})")
```

`x`, `y`는 새 변수로 값이 바인딩된다. 이미 존재하는 변수와 매칭하려면 `case Point.ORIGIN:` 같이 점 표기법을 써야 한다.

## 시퀀스 패턴

리스트나 튜플의 구조를 매칭한다.

```python
def process(cmd):
    match cmd.split():
        case ["quit"]:
            quit()
        case ["go", direction]:
            move(direction)
        case ["go", direction, *args]:
            move(direction, *args)
        case _:
            print("알 수 없는 명령")
```

`*args`로 나머지 요소를 캡처할 수 있다.

## 매핑 패턴

딕셔너리의 특정 키를 검사하고 값을 추출한다.

```python
match event:
    case {"type": "click", "x": x, "y": y}:
        on_click(x, y)
    case {"type": "keypress", "key": key}:
        on_key(key)
    case {"type": str(event_type)}:
        print(f"알 수 없는 이벤트: {event_type}")
```

매핑 패턴은 **부분 매칭** — 딕셔너리에 다른 키가 더 있어도 패턴에 명시된 키만 확인한다.

## 클래스 패턴

dataclass나 일반 클래스 인스턴스의 속성을 검사한다.

```python
from dataclasses import dataclass

@dataclass
class Point:
    x: float
    y: float

match point:
    case Point(x=0, y=0):
        print("원점")
    case Point(x=0, y=y):
        print(f"y축 위: y={y}")
    case Point(x=x, y=y):
        print(f"일반 좌표: ({x}, {y})")
```

## 가드 조건

`case 패턴 if 조건:` 형태로 추가 조건을 붙일 수 있다.

```python
match point:
    case Point(x, y) if x == y:
        print("대각선 위")
    case Point(x, y) if x > 0 and y > 0:
        print("1사분면")
    case Point(x, y):
        print(f"기타: ({x}, {y})")
```

가드 조건이 `False`면 그 케이스는 매칭 실패로 처리되어 다음 케이스로 넘어간다.

![match 고급 패턴](/assets/posts/python-match-statement-patterns.svg)

## match vs if-elif 선택 기준

| 상황 | 권장 |
|------|------|
| 단일 값 비교, 범위 조건 | `if-elif` |
| 여러 케이스 값 열거 | `match` (OR 패턴) |
| 구조 분해 + 바인딩 | `match` |
| Python 3.9 이하 지원 | `if-elif` |
| 복잡한 불리언 조합 | `if-elif` |

## 주의: 변수명 충돌

`case` 안에서 기존 변수명을 쓰면 바인딩(캡처)이 아니라 **점 표기법**으로 써야 한다.

```python
OK = 200
match status:
    case OK:        # 이건 OK에 바인딩 — 항상 매칭!
        pass
    case http.OK:   # 이건 http.OK 값과 비교
        pass
```

로컬 변수를 패턴에서 상수로 쓰려면 반드시 `모듈.변수` 형태를 사용해야 한다.

## 정리

- `match`/`case` — Python 3.10+, 구조적 패턴 매칭
- 리터럴·OR·캡처·시퀀스·매핑·클래스 6가지 패턴 유형
- `_` — 와일드카드, 바인딩 없이 모든 값 매칭
- 가드 조건 `if` — 패턴 매칭 후 추가 조건 검사
- 구조 분해 + 타입/값 동시 검사가 필요할 때 `if-elif` 보다 표현력이 좋다

---

**지난 글:** [루프의 else: break 없이 완주했을 때만 실행되는 블록](/posts/python-else-on-loop/)

**다음 글:** [조건 표현식: x if 조건 else y 삼항 연산자](/posts/python-conditional-expression/)

<br>
읽어주셔서 감사합니다. 😊
