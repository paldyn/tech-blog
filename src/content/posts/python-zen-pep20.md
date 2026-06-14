---
title: "The Zen of Python: PEP 20이 말하는 아름다운 코드"
description: "Python 설계 철학 19가지를 담은 PEP 20을 코드 예시와 함께 설명합니다. 왜 Python다운 코드를 써야 하는지 이해합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["Python", "PEP20", "Zen", "코딩철학", "Pythonic"]
featured: false
draft: false
---

[지난 글](/posts/python-install-pyenv/)에서 pyenv로 개발 환경을 준비했다. 이제 코드를 써볼 차례다. 그런데 Python에는 단순히 문법을 나열한 것 이상의 "철학"이 있다. 코드를 어떻게 써야 하는지에 대한 가이드라인이다. 이것이 PEP 20, "The Zen of Python"이다. Python 인터프리터 어디서나 `import this`를 실행하면 나타나는 이 격언들은 수십 년간 Python 커뮤니티를 이끌어온 설계 원칙이다.

## import this

Python을 설치했다면 지금 바로 해볼 수 있다.

```python
import this
```

실행하면 Tim Peters가 1999년에 쓴 19가지 격언이 출력된다.

```
Beautiful is better than ugly.
Explicit is better than implicit.
Simple is better than complex.
Complex is better than complicated.
Flat is better than nested.
Sparse is better than dense.
Readability counts.
Special cases aren't special enough to break the rules.
Although practicality beats purity.
Errors should never pass silently.
Unless explicitly silenced.
In the face of ambiguity, refuse the temptation to guess.
There should be one-- and preferably only one --obvious way to do it.
Although that way may not be obvious at first unless you're Dutch.
Now is better than never.
Although never is often better than *right* now.
If the implementation is hard to explain, it's a bad idea.
If the implementation is easy to explain, it may be a good idea.
Namespaces are one honking great idea -- let's do more of those!
```

19가지를 모두 외울 필요는 없다. 하지만 핵심 몇 가지는 Python 코드를 쓸 때마다 머릿속에 울려야 한다.

## 핵심 원칙 해부

![Zen of Python 핵심 원칙](/assets/posts/python-zen-pep20-principles.svg)

### 1. Beautiful is better than ugly (아름다움이 못생김보다 낫다)

코드는 실행만 되면 되는 게 아니다. 읽히는 아름다움이 있어야 한다. Python은 코드를 "예술 작품"처럼 다룬다.

```python
# 못생긴 코드
def f(l):
    r=[]
    for i in l:
        if i>0:r.append(i*2)
    return r

# 아름다운 코드
def double_positives(numbers):
    return [n * 2 for n in numbers if n > 0]
```

두 번째 코드는 한 줄이지만 의도가 명확하고 읽기 쉽다.

### 2. Explicit is better than implicit (명시적인 것이 암묵적인 것보다 낫다)

코드의 의도를 숨기지 마라. 읽는 사람이 추측하게 만들지 마라.

```python
# 암묵적: 0이 아닌지 확인하는 방법이 불명확
if count:
    process()

# 명시적: 의도가 분명
if count > 0:
    process()

# 암묵적: 변환 의도 불분명
result = not not value

# 명시적
result = bool(value)
```

### 3. Simple is better than complex (단순함이 복잡함보다 낫다)

복잡한 해법이 있을 때 단순한 해법을 먼저 찾아라. 때로는 "덜 영리한" 코드가 더 좋은 코드다.

```python
# 복잡한 방식 (one-liner를 위한 one-liner)
result = (lambda x: x**2 if x > 0 else 0)(value)

# 단순한 방식
if value > 0:
    result = value ** 2
else:
    result = 0
```

### 4. Readability counts (가독성은 중요하다)

코드는 쓰는 횟수보다 읽는 횟수가 훨씬 많다. 6개월 후의 나, 팀 동료, 오픈소스 기여자를 위해 읽기 쉽게 써라.

```python
# 가독성 낮은 코드
d = {k: v for k, v in [(x.split(':')[0].strip(),
  x.split(':')[1].strip()) for x in s.split(',')]}

# 가독성 높은 코드
def parse_key_value_pairs(text):
    pairs = {}
    for item in text.split(','):
        key, value = item.split(':')
        pairs[key.strip()] = value.strip()
    return pairs
```

### 5. Errors should never pass silently (오류는 결코 조용히 지나쳐선 안 된다)

![Zen 실전 적용](/assets/posts/python-zen-pep20-examples.svg)

오류를 그냥 무시하는 코드는 언젠가 원인을 알 수 없는 버그로 돌아온다.

```python
# 나쁜 예: 모든 예외를 조용히 무시
def get_user(user_id):
    try:
        return db.query(user_id)
    except:
        pass  # 오류가 있어도 None 반환

# 좋은 예: 예외를 명시적으로 처리
def get_user(user_id):
    try:
        return db.query(user_id)
    except DatabaseError as e:
        logger.error(f"사용자 조회 실패: {e}")
        raise
    except ValueError:
        raise ValueError(f"잘못된 user_id: {user_id}")
```

`except:` (bare except)는 `KeyboardInterrupt`, `SystemExit`까지 모든 예외를 잡는다. 프로그램을 Ctrl+C로 종료하는 것도 막을 수 있다. 항상 구체적인 예외 타입을 명시하라.

### 6. There should be one obvious way (명확한 방법이 하나 있어야 한다)

어떤 작업을 수행하는 "파이썬다운(Pythonic)" 방법이 있다. 여러 방법이 있을 때 그 중 가장 관용적인 방법을 선택하라.

```python
# 여러 방법이 있을 때 — Pythonic 방법을 선택
items = [1, 2, 3, 4, 5]

# Non-Pythonic
i = 0
while i < len(items):
    print(items[i])
    i += 1

# Pythonic: for-in이 명확한 방법
for item in items:
    print(item)

# 인덱스도 필요하다면
for i, item in enumerate(items):
    print(f"{i}: {item}")
```

격언에 "unless you're Dutch"라는 부분이 있다. Guido van Rossum이 네덜란드인이기 때문에 붙인 유머다. "명백한 방법이 처음엔 안 보일 수 있지만, Guido에게는 명확하다"는 뜻이다.

## "Pythonic" 코드란 무엇인가

Zen을 내면화하면 자연스럽게 "Pythonic" 코드를 쓰게 된다. Pythonic이란 Python의 관용적 표현과 철학을 따르는 코드를 말한다.

```python
# Pythonic 패턴 모음

# 1. 스왑 (언팩킹)
a, b = b, a  # C 스타일 temp 변수 불필요

# 2. 리스트 컴프리헨션
squares = [x**2 for x in range(10)]

# 3. f-string
name = "Alice"
greeting = f"Hello, {name}!"  # % 포매팅보다 명확

# 4. with 문으로 컨텍스트 관리
with open("file.txt") as f:
    content = f.read()  # 자동으로 파일 닫힘

# 5. 언더스코어로 불필요한 변수 표시
for _ in range(5):
    print("반복")

# 6. 참 값 확인
if items:           # 리스트가 비어있지 않으면
    process(items)
# if len(items) > 0: 보다 Pythonic
```

## Namespaces (네임스페이스)

마지막 격언 "Namespaces are one honking great idea"는 Python 모듈 시스템을 설명한다. Python에서 모든 것은 네임스페이스(모듈, 클래스, 함수)에 속한다. 전역 네임스페이스 오염을 피하고, 이름 충돌 없이 코드를 조직화할 수 있다.

```python
import math
import cmath

# 같은 이름 'sqrt'지만 다른 네임스페이스
print(math.sqrt(4))    # 2.0 (실수)
print(cmath.sqrt(-1))  # 1j (복소수)
# 충돌 없이 공존
```

## PEP 20을 실제로 적용하는 법

Zen을 이해하는 것과 코드에 적용하는 것은 다르다. 가장 좋은 방법은 코드 리뷰 시 이 원칙들을 체크리스트로 사용하는 것이다.

- 이 코드는 명시적인가? 읽는 사람이 추측해야 하는가?
- 더 단순한 방법이 있는가?
- 예외를 조용히 무시하고 있지는 않은가?
- 이 방법이 "명백한 방법"인가?

처음에는 의식적으로 생각해야 하지만, 시간이 지나면 자연스럽게 체화된다. Python 커뮤니티에서 "Pythonic" 코드를 작성한다는 것은 Zen의 원칙을 따르는 코드를 쓴다는 뜻이다.

다음 편에서는 Zen의 원칙을 코드 스타일 규칙으로 구체화한 PEP 8을 살펴본다. 들여쓰기, 줄 길이, 이름 규칙 등 실용적인 스타일 가이드다.

---

**지난 글:** [pyenv로 Python 버전 마스터하기](/posts/python-install-pyenv/)

**다음 글:** [PEP 8 스타일 가이드: 읽기 쉬운 코드의 기준](/posts/python-pep8-style/)

<br>
읽어주셔서 감사합니다. 😊
