---
title: "parametrize: 하나의 테스트를 여러 입력으로 펼치기"
description: "@pytest.mark.parametrize로 같은 검증 로직을 여러 입력에 자동 적용하는 법, 루프와의 차이, id와 fixture 조합까지 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["pytest", "parametrize", "테스트", "데이터주도", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-pytest-fixtures/)에서 fixture로 테스트 준비물을 깔끔하게 주입하는 법을 익혔다. 이번에는 다른 종류의 반복을 다룬다. 같은 함수를 여러 입력값으로 검증하고 싶을 때다. 예를 들어 `square(2)==4`, `square(3)==9`, `square(-1)==1`처럼 입력만 다르고 검증 구조는 똑같은 케이스가 줄줄이 있다고 하자. 이걸 매번 별도 함수로 복사하면 지루하고, 함수 안에서 `for` 루프로 도는 것은 더 나쁜 함정이 있다. pytest의 `parametrize`가 정답이다.

## 케이스 목록을 데코레이터로

`@pytest.mark.parametrize`는 인자 이름들과 케이스 목록을 받아, **케이스 개수만큼 독립적인 테스트를 자동 생성**한다.

![하나의 함수가 여러 테스트로 펼쳐진다](/assets/posts/python-pytest-parametrize-expand.svg)

```python
import pytest

def square(n):
    return n * n

@pytest.mark.parametrize("n, expected", [
    (2, 4),
    (3, 9),
    (-1, 1),
    (0, 0),
])
def test_square(n, expected):
    assert square(n) == expected
```

첫 번째 인자 `"n, expected"`는 테스트 함수가 받을 파라미터 이름이고, 두 번째 인자는 그 값들의 튜플 목록이다. pytest는 이 함수를 네 번, 각각 다른 `(n, expected)` 조합으로 실행한다. 출력에는 `test_square[2-4]`, `test_square[3-9]`처럼 입력값이 박힌 이름으로 나타나, 어떤 케이스가 통과·실패했는지 한눈에 보인다.

## 왜 함수 안의 for 루프는 안 되나

같은 일을 함수 하나 안에서 `for` 루프로 처리할 수도 있다. 하지만 그렇게 하면 두 가지를 잃는다.

![루프 대신 parametrize를 쓰는 이유](/assets/posts/python-pytest-parametrize-vs-loop.svg)

첫째, `assert`는 **첫 실패에서 즉시 멈춘다.** 루프 안에서 세 번째 입력이 실패하면 나머지 입력은 아예 검증되지 않는다. 둘째, 실패 메시지에 어떤 입력이 문제였는지 드러나지 않아 디버깅이 어렵다. parametrize는 각 케이스가 별도 테스트이므로 하나가 실패해도 나머지는 끝까지 돌고, 실패한 입력이 테스트 이름에 그대로 박혀 나온다.

```python
# 권장하지 않는 방식 — 첫 실패에서 멈추고 입력을 가린다
def test_square_loop():
    for n, expected in [(2, 4), (3, 8), (4, 16)]:
        assert square(n) == expected   # (3, 8)에서 멈춤, (4,16)은 미검증
```

## id로 케이스에 이름 붙이기

입력이 복잡한 객체이거나 의미를 분명히 하고 싶을 때는 `ids`로 각 케이스에 읽기 좋은 이름을 줄 수 있다.

```python
@pytest.mark.parametrize(
    "value, is_valid",
    [
        ("user@example.com", True),
        ("no-at-sign", False),
        ("", False),
    ],
    ids=["정상이메일", "골뱅이없음", "빈문자열"],
)
def test_email_validation(value, is_valid):
    assert validate_email(value) == is_valid
```

이제 출력에 `test_email_validation[정상이메일]`처럼 의미가 담긴 이름이 나온다. 실패 보고만 봐도 어떤 시나리오가 깨졌는지 즉시 파악된다.

## fixture와 함께 쓰기, 그리고 곱집합

parametrize는 fixture와 자연스럽게 섞인다. 또 데코레이터를 **여러 개 쌓으면** 입력의 모든 조합(곱집합)이 자동으로 만들어진다.

```python
@pytest.mark.parametrize("base", [2, 10])
@pytest.mark.parametrize("exp", [0, 1, 2])
def test_power(base, exp):
    # (2,0) (2,1) (2,2) (10,0) (10,1) (10,2) → 6개 테스트
    assert pow(base, exp) == base ** exp
```

`base` 2개와 `exp` 3개가 곱해져 6개의 테스트가 생성된다. 다만 조합이 기하급수적으로 늘 수 있으니, 정말 모든 조합이 의미 있을 때만 쌓는 것이 좋다.

parametrize는 "테스트 코드는 그대로 두고 입력만 데이터로 분리한다"는 발상이다. 새 경계값이 떠오르면 목록에 한 줄 추가하기만 하면 된다. 다음 글에서는 외부 의존성을 가짜로 바꿔치기하는 **mock과 monkeypatch**를 다룬다.

---

**지난 글:** [pytest fixture: 테스트 준비물을 우아하게 주입하기](/posts/python-pytest-fixtures/)

**다음 글:** [mock과 monkeypatch: 의존성을 가짜로 바꾸기](/posts/python-mock-monkeypatch/)

<br>
읽어주셔서 감사합니다. 😊
