---
title: "Hypothesis로 시작하는 속성 기반 테스트"
description: "내가 고른 예시 대신 라이브러리가 입력을 생성하는 속성 기반 테스트의 원리, @given과 전략, 반례 최소화(shrink)까지 Hypothesis로 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["hypothesis", "속성기반테스트", "테스트", "property-based", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-tox-nox/)에서 여러 환경에서 테스트를 자동화하는 법을 다뤘다. 지금까지의 테스트는 모두 "내가 고른 입력"에 의존했다. `square(2)==4`처럼 예시를 직접 정하는 방식이다. 그런데 우리가 떠올리는 예시는 대개 평범한 값들이고, 정작 버그는 빈 리스트·음수·아주 큰 수·유니코드 경계처럼 미처 생각 못 한 입력에서 터진다. **속성 기반 테스트**는 입력을 사람이 고르는 대신 라이브러리가 자동으로 만들게 해서, 이 사각지대를 공략한다. 파이썬의 대표 도구는 Hypothesis다.

## 예시가 아니라 속성을 적는다

발상의 전환이 핵심이다. 구체적인 입력-출력 쌍 대신, **"입력이 무엇이든 항상 성립해야 하는 성질(속성)"** 을 적는다. 그러면 Hypothesis가 다양한 입력을 생성해 그 속성을 두드린다.

![예시 기반 vs 속성 기반](/assets/posts/python-property-based-hypothesis-vs-example.svg)

```bash
pip install hypothesis
```

```python
from hypothesis import given
from hypothesis import strategies as st

@given(st.lists(st.integers()))
def test_sort_is_idempotent(xs):
    # 정렬을 두 번 해도 한 번 한 것과 같아야 한다
    assert sorted(sorted(xs)) == sorted(xs)

@given(st.lists(st.integers()))
def test_sort_preserves_length(xs):
    # 정렬해도 원소 개수는 그대로여야 한다
    assert len(sorted(xs)) == len(xs)
```

`@given` 데코레이터가 테스트 함수에 입력을 공급한다. `st.lists(st.integers())`는 "정수들의 리스트"를 만드는 **전략(strategy)** 이다. Hypothesis는 빈 리스트, 한 원소, 음수가 섞인 큰 리스트 등 수십~수백 가지를 생성해 매번 속성이 성립하는지 확인한다.

## 좋은 속성을 찾는 법

속성 기반 테스트의 어려움은 "무엇을 속성으로 삼을까"다. 자주 쓰이는 패턴 몇 가지가 길잡이가 된다.

```python
# 1. 왕복(round-trip): 인코딩 후 디코딩하면 원본
@given(st.text())
def test_json_roundtrip(s):
    assert json.loads(json.dumps(s)) == s

# 2. 불변(invariant): 연산 후에도 유지되는 성질
@given(st.lists(st.integers()))
def test_reverse_twice(xs):
    assert list(reversed(list(reversed(xs)))) == xs
```

왕복(직렬화↔역직렬화), 불변(개수·합 같은 성질 보존), 기존의 단순한 구현과 결과 비교(oracle) 같은 패턴이 대표적이다. 이런 속성은 특정 예시보다 훨씬 넓은 입력 공간을 한 번에 검증한다.

## 반례를 찾고 최소화한다

Hypothesis의 진짜 강력함은 실패했을 때 드러난다. 속성을 깨는 입력(반례)을 찾으면 거기서 멈추지 않고, **같은 실패를 내는 가장 작고 단순한 입력까지 줄여서**(shrink) 보여 준다.

![반례를 찾고 최소화(shrink)한다](/assets/posts/python-property-based-hypothesis-shrink.svg)

```text
Falsifying example: test_something(
    xs=[0],
)
```

처음 발견한 반례가 `[-37, 1024, 0, -5]`처럼 복잡했더라도, Hypothesis는 그것을 `[0]`처럼 최소한의 형태로 깎아 보여 준다. "거대한 무작위 입력"이 아니라 "디버깅하기 쉬운 최소 반례"를 손에 쥐는 것이다. 또 한 번 찾은 실패 입력은 데이터베이스에 저장해, 다음 실행에서 그 케이스를 먼저 재현한다.

## 예시 기반과 함께 쓰기

속성 기반 테스트가 예시 기반을 대체하는 것은 아니다. 둘은 보완 관계다. 핵심 시나리오는 예시로 명시해 문서 역할을 하게 하고, 경계와 사각지대는 속성으로 넓게 훑는다. `@example`로 반드시 검증하고 싶은 구체적 입력을 고정해 둘 수도 있다.

```python
from hypothesis import example

@given(st.integers())
@example(0)          # 0은 반드시 포함해서 검증
def test_abs_non_negative(n):
    assert abs(n) >= 0
```

속성 기반 테스트는 "내가 생각하지 못한 입력"을 대신 떠올려 주는 동료와 같다. 처음에는 속성을 찾는 게 어렵지만, 왕복·불변 같은 패턴에 익숙해지면 적은 코드로 놀랄 만큼 넓은 범위를 지킬 수 있다. 다음 글에서는 문서 안의 예제를 그대로 테스트로 삼는 **doctest**를 살펴본다.

---

**지난 글:** [tox와 nox: 여러 환경에서 자동으로 테스트하기](/posts/python-tox-nox/)

**다음 글:** [doctest: 문서 속 예제를 테스트로](/posts/python-doctest/)

<br>
읽어주셔서 감사합니다. 😊
