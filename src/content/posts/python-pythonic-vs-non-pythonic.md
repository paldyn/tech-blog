---
title: "파이썬다운 코드란? — Pythonic vs Non-Pythonic"
description: "동작은 같지만 읽는 느낌이 다른 코드. '파이썬답다'는 말이 가리키는 구체적인 습관들을 컴프리헨션, EAFP, 언패킹 같은 실제 예제로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["Pythonic", "코드 스타일", "관용구", "베스트 프랙티스", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-floating-point-pitfalls/)에서 부동소수점이라는 보편적인 함정을 다뤘다면, 이번 글부터는 시리즈를 마무리하는 한 묶음으로 "파이썬을 파이썬답게 쓴다는 것"이 무엇인지 짚어 본다. 같은 문제를 풀어도 어떤 코드는 다른 언어를 파이썬 문법으로 옮겨 적은 것처럼 보이고, 어떤 코드는 처음부터 파이썬으로 생각하고 쓴 것처럼 읽힌다. 사람들은 후자를 두고 "파이썬답다(Pythonic)"고 말한다. 이 말은 칭찬이긴 한데 막연해서, 처음에는 정확히 무엇을 가리키는지 잡히지 않는다. 이 글에서는 그 막연함을 구체적인 습관 몇 가지로 풀어 본다.

## 같은 일을 하는 두 가지 코드

먼저 가장 흔한 예부터 보자. 리스트의 각 원소를 두 배로 만들어 새 리스트를 만드는 코드다.

```python
# Non-Pythonic — 인덱스를 직접 굴린다
result = []
i = 0
while i < len(items):
    result.append(items[i] * 2)
    i += 1

# Pythonic — 무엇을 만드는지를 곧장 말한다
result = [x * 2 for x in items]
```

두 코드의 결과는 완전히 같다. 하지만 위쪽은 "인덱스 `i`를 0부터 시작해서, 길이보다 작은 동안, 매번 1씩 늘리며, `items[i]`를 꺼내 두 배 한 뒤 추가한다"는 **절차**를 한 줄씩 따라 읽어야 의도가 보인다. 반면 아래쪽은 "`items`의 각 `x`를 두 배 한 리스트"라고 **무엇을** 만드는지를 먼저 말한다. 인덱스 변수, 경계 조건, 증가 처리 같은 부수적인 기계 장치가 통째로 사라지면서, 읽는 사람은 핵심만 본다.

![같은 일을 하는 두 가지 코드](/assets/posts/python-pythonic-vs-non-pythonic-compare.svg)

파이썬다움의 첫 번째 감각은 여기에 있다. **어떻게(how)보다 무엇을(what)을 먼저 말하고, 반복적인 기계 장치는 언어에 맡기는 것**이다. `range(len(items))`로 인덱스를 만들어 `items[i]`로 접근하는 패턴이 보이면, 거의 항상 더 직접적인 표현이 존재한다.

## 직접 순회한다

위 원칙의 가장 흔한 적용이 반복문이다. 파이썬의 `for`는 다른 언어의 카운터 기반 루프가 아니라, **순회 가능한 대상을 직접 도는** 루프다. 그러니 인덱스가 정말 필요한 게 아니라면 인덱스를 만들지 않는다.

```python
# 인덱스가 필요 없으면 원소를 직접 돈다
for name in names:
    print(name)

# 순서 번호가 필요하면 enumerate
for i, name in enumerate(names, start=1):
    print(f"{i}. {name}")

# 두 리스트를 나란히 돌면 zip
for name, score in zip(names, scores):
    print(name, score)
```

`enumerate`와 `zip`은 "인덱스를 직접 다루고 싶은" 거의 모든 상황을 덮는다. `for i in range(len(names)): name = names[i]` 같은 코드를 쓰고 있다면 `enumerate`로, `names[i]`와 `scores[i]`를 함께 꺼내고 있다면 `zip`으로 바꿀 수 있는지 먼저 떠올리는 것이 파이썬다운 반사 신경이다.

## 먼저 해보고 예외를 받는다 — EAFP

파이썬에는 코딩 문화 차원의 관용구가 하나 있다. **EAFP(Easier to Ask Forgiveness than Permission)** — "허락보다 용서를 구하는 게 쉽다"는 태도다. 어떤 작업이 가능한지 미리 일일이 검사(LBYL, Look Before You Leap)하는 대신, 일단 시도하고 안 되면 예외로 처리한다.

```python
# LBYL — 미리 검사 (덜 파이썬다움)
if "name" in data and isinstance(data["name"], str):
    name = data["name"]
else:
    name = "익명"

# EAFP — 일단 해보고 예외를 받는다
try:
    name = data["name"]
except KeyError:
    name = "익명"
```

EAFP가 선호되는 데는 실용적인 이유가 있다. 미리 검사하는 방식은 "검사한 시점"과 "실제로 쓰는 시점" 사이에 상태가 바뀔 수 있는 틈이 생기고, 검사해야 할 조건이 늘어날수록 코드가 너저분해진다. 반면 EAFP는 정상 경로를 곧장 적고 예외 상황만 따로 떼어 처리하므로, 흔히 일어나는 경우의 코드가 깔끔하게 유지된다. 물론 만능은 아니다. 검사 비용이 싸고 실패가 흔하게 예상되는 경우라면 미리 검사하는 편이 나을 때도 있다. 핵심은 "파이썬에서는 try/except가 부끄러운 게 아니라 정상적인 도구"라는 점이다.

![파이썬다움을 이루는 습관들](/assets/posts/python-pythonic-vs-non-pythonic-pillars.svg)

## 언패킹과 with — 작은 관용구들

나머지 파이썬다움은 작은 관용구들의 모음이다. 그중 두 가지만 보자.

값을 주고받을 때 임시 변수를 만들지 않고 **언패킹**을 쓴다.

```python
# 두 변수 교환 — 임시 변수가 필요 없다
a, b = b, a

# 함수가 여러 값을 돌려줄 때 한 번에 받기
first, *rest = [10, 20, 30, 40]   # first=10, rest=[20, 30, 40]
```

자원을 다룰 때는 직접 닫지 않고 **with**에 맡긴다.

```python
# 직접 닫기 — 예외가 나면 close()를 놓칠 수 있다
f = open("data.txt")
data = f.read()
f.close()

# with — 블록을 벗어나면 무조건 닫힌다
with open("data.txt") as f:
    data = f.read()
```

`with`는 파일뿐 아니라 잠금, 데이터베이스 연결, 임시 디렉터리 등 "열었으면 닫아야 하는" 모든 자원에 적용된다. "정리를 잊지 않게 언어가 보장해 준다"는 점에서 매우 파이썬답다.

## 파이썬다움은 규칙이 아니라 감각

지금까지 본 것들 — 컴프리헨션, 직접 순회, EAFP, 언패킹, with — 은 외워야 할 규칙이라기보다 하나의 일관된 태도에서 나온다. **부수적인 기계 장치를 줄이고, 의도를 직접 드러내고, 언어가 잘하는 일은 언어에 맡긴다.** 다만 파이썬다움을 좇다 보면 한 줄에 모든 걸 욱여넣은 난해한 코드를 "고급"이라 착각하기 쉬운데, 그건 오히려 반대 방향이다. 파이썬의 정신을 적은 『Zen of Python』의 한 줄이 기준이 된다 — "읽기 쉬운 것이 중요하다(Readability counts)." 간결함이 명확함을 해치기 시작하면, 그건 더 이상 파이썬답지 않다.

이어지는 글들에서는 이 "파이썬다움"이 구체적인 선택의 갈림길에서 어떻게 작동하는지 — 타입을 묻느냐 능력을 보느냐, 리스트냐 튜플이냐, 얕은 복사냐 깊은 복사냐 같은 실전 판단으로 들어가 본다.

## 정리

파이썬다운 코드는 화려한 문법이 아니라 "무엇을 하려는지가 곧장 읽히는 코드"다. 인덱스를 직접 굴리는 대신 순회 가능한 대상을 직접 돌고, 미리 검사하기보다 일단 해보고 예외를 받으며, 임시 변수와 수동 정리 대신 언패킹과 `with`에 맡긴다. 이 습관들의 공통점은 부수적인 절차를 언어에 넘기고 사람은 핵심만 읽게 한다는 것이다. 그리고 그 모든 것의 위에는 "읽기 쉬움이 우선한다"는 단 하나의 기준이 있다.

---

**지난 글:** [부동소수점의 함정](/posts/python-floating-point-pitfalls/)

**다음 글:** [덕 타이핑 vs isinstance — 타입을 묻지 않는 법](/posts/python-ducktyping-vs-isinstance/)

<br>
읽어주셔서 감사합니다. 😊
