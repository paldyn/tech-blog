---
title: "Python의 선 (Zen of Python) — PEP 20"
description: "import this로 볼 수 있는 19개 Python 설계 격언의 의미와 코드에서 어떻게 적용하는지 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["Python", "Zen of Python", "PEP 20", "코딩 철학", "Pythonic"]
featured: false
draft: false
---

[지난 글](/posts/python-install-pyenv/)에서 개발 환경을 설정했습니다. 이제 도구가 준비됐으니 Python이라는 언어가 어떤 가치를 추구하는지 깊게 들여다볼 차례입니다. Python 인터프리터에는 특별한 이스터에그가 숨어 있습니다.

```python
import this
```

이 한 줄을 실행하면 Tim Peters가 1999년에 작성한 19개의 격언이 출력됩니다. 이것이 **Zen of Python(파이썬의 선)**이며 PEP 20으로 공식화됐습니다.

## 전문 출력

```
The Zen of Python, by Tim Peters

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

![Zen of Python 격언](/assets/posts/python-zen-pep20-principles.svg)

## 핵심 격언 해설

### "Explicit is better than implicit" — 명시적인 것이 낫다

Python이 Java의 `import *` 같은 암시적 가져오기를 지양하는 이유입니다. 코드를 처음 읽는 사람도 어디서 무엇이 왔는지 명확히 알 수 있어야 합니다.

```python
# 암시적 — 어디서 왔는지 불명확
from os.path import *
exists("file.txt")

# 명시적 — 출처가 분명
from os.path import exists
exists("file.txt")

# 또는
import os.path
os.path.exists("file.txt")
```

### "Simple is better than complex" — 단순함이 낫다

기능을 추가할 때마다 "이게 정말 필요한가?"를 묻는 원칙입니다. 추상화 계층이 늘수록 이해와 디버깅이 어려워집니다.

```python
# 복잡한 클래스 계층 대신
def process_users(users, predicate):
    return [u for u in users if predicate(u)]

# 간단하고 명확
active_users = process_users(users, lambda u: u.is_active)
```

### "Readability counts" — 가독성은 중요하다

Python에서 코드는 한 번 쓰고 여러 번 읽힙니다. 팀원이, 6개월 후의 자신이 읽을 코드를 씁니다.

```python
# 영리하지만 읽기 어려운 코드
result = [x for x in range(100) if x % 2 == 0 if x % 3 == 0]

# 명확한 코드
result = [x for x in range(100) if x % 2 == 0 and x % 3 == 0]
```

### "Errors should never pass silently" — 오류를 조용히 넘기지 마라

빈 `except:` 블록은 버그를 숨깁니다. 예외는 항상 처리하거나 전파해야 합니다.

```python
# 나쁜 예 — 모든 오류를 무시
try:
    result = compute()
except:
    pass

# 좋은 예 — 구체적 처리
try:
    result = compute()
except ValueError as e:
    logger.error("잘못된 입력: %s", e)
    raise
```

### "There should be one obvious way to do it" — 명확한 방법은 하나

같은 일을 여러 방법으로 할 수 있지만, Python은 명확하고 관용적인 방법을 선호합니다.

```python
# 여러 방법 중 Pythonic한 방법
names = ["Alice", "Bob", "Charlie"]

# 인덱스 기반 (비Pythonic)
for i in range(len(names)):
    print(i, names[i])

# enumerate 사용 (Pythonic)
for i, name in enumerate(names):
    print(i, name)
```

![Zen 원칙 코드 예시](/assets/posts/python-zen-pep20-examples.svg)

### "Flat is better than nested" — 평탄함이 중첩됨보다 낫다

조건문이 3단계 이상 중첩되면 "early return" 패턴으로 평탄화하는 것이 좋습니다.

### "Namespaces are one honking great idea" — 네임스페이스

Python의 모듈 시스템은 이름 충돌을 방지합니다. `import` 없이 전역 네임스페이스를 오염시키는 것을 피해야 하는 이유입니다.

```python
import math
import cmath

# 같은 이름 sin이지만 네임스페이스로 구분
math.sin(1.0)   # 실수
cmath.sin(1.0)  # 복소수
```

## Zen은 법칙이 아닌 방향

Zen of Python의 격언들은 서로 상충하기도 합니다. "Simple is better than complex"와 "Practicality beats purity"가 그 예입니다. 이는 의도적입니다. 격언은 트레이드오프를 안내하는 방향이지, 기계적으로 적용할 규칙이 아닙니다.

코드를 짤 때 "Zen의 몇 번 격언에 맞는가?"를 따지는 것보다 "이 코드를 처음 보는 사람이 쉽게 이해할 수 있는가?"를 묻는 것이 더 실용적입니다.

## 정리

Zen of Python은 언어의 표면 문법보다 깊은 곳에 있는 철학입니다. 명시성, 단순성, 가독성이라는 세 축을 이해하면 Pythonic한 코드가 왜 그런 모습인지 자연스럽게 이해됩니다. 다음 글에서는 이 철학이 코드 스타일 가이드로 구체화된 PEP 8을 살펴봅니다.

---

**지난 글:** [pyenv로 Python 버전 관리하기](/posts/python-install-pyenv/)

**다음 글:** [PEP 8 — Python 코드 스타일 가이드](/posts/python-pep8-style/)

<br>
읽어주셔서 감사합니다. 😊
