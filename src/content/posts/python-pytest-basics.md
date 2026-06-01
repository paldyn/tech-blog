---
title: "pytest 기초: assert 한 줄로 쓰는 테스트"
description: "평범한 함수와 내장 assert만으로 테스트를 작성하는 pytest의 철학, 풍부한 실패 메시지, 실행과 선택 방법까지 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["pytest", "테스트", "assert", "단위테스트", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-unittest-basics/)에서 표준 라이브러리 `unittest`로 테스트의 기본기를 익혔다. 클래스를 만들고 `assertEqual` 같은 전용 메서드를 쓰는 방식이었는데, 막상 써 보면 검증 한 줄을 적기 위해 외워야 할 메서드가 꽤 많다고 느껴진다. 파이썬 생태계에서 사실상 표준으로 자리 잡은 `pytest`는 이 부담을 거의 없앤다. 평범한 함수와 파이썬 내장 `assert` 문만으로 테스트를 쓰게 해 주면서도, 실패했을 때는 `unittest`보다 더 친절한 정보를 보여 준다.

## 함수 하나가 테스트 하나

pytest에서는 클래스도, 상속도 필요 없다. `test_`로 시작하는 **그냥 함수**를 만들고 그 안에서 `assert`로 검증하면 끝이다. 먼저 `pip install pytest`로 설치한다.

![같은 검증, 두 가지 방식](/assets/posts/python-pytest-basics-vs-unittest.svg)

```python
# test_math.py
def add(a, b):
    return a + b

def test_add_positive():
    assert add(2, 3) == 5

def test_add_negative():
    assert add(-1, -1) == -2
```

`unittest`였다면 `class TestMath(unittest.TestCase)`로 감싸고 `self.assertEqual(...)`을 호출해야 했을 코드가, pytest에서는 모듈 수준 함수와 `assert` 한 줄로 줄어든다. 군더더기가 사라지니 "이 테스트가 무엇을 검증하는가"가 한눈에 들어온다.

## 평범한 assert인데 메시지는 풍부하다

파이썬의 기본 `assert x == y`는 실패하면 그저 `AssertionError`만 던진다. 어떤 값이었는지는 알려 주지 않는다. 그런데 pytest는 테스트를 실행하기 전에 코드를 다시 써서(assertion rewriting), `assert`가 실패하면 양쪽 값을 자세히 풀어 보여 준다.

```text
    def test_add_positive():
>       assert add(2, 3) == 6
E       assert 5 == 6
E        +  where 5 = add(2, 3)

test_math.py:5: AssertionError
```

`add(2, 3)`이 5였는데 6을 기대했다는 사실, 그 5가 `add(2, 3)`의 결과라는 점까지 친절하게 나온다. 별도 메서드를 외울 필요 없이 `==`, `in`, `<`, `is` 같은 익숙한 연산자를 그대로 쓰면서도 풍부한 진단을 얻는 것이 pytest의 큰 매력이다.

## 예외를 검증하기: pytest.raises

특정 코드가 예외를 던져야 하는 상황은 `pytest.raises`를 `with` 블록으로 쓴다. `unittest`의 `assertRaises`와 모양이 비슷하다.

```python
import pytest

def divide(a, b):
    if b == 0:
        raise ValueError("0으로 나눌 수 없습니다")
    return a / b

def test_divide_by_zero():
    with pytest.raises(ValueError) as exc_info:
        divide(10, 0)
    assert "0으로" in str(exc_info.value)
```

블록 안의 코드가 `ValueError`를 던지지 않으면 그 테스트는 실패한다. `as exc_info`로 잡은 예외 객체를 꺼내, 메시지 내용까지 추가로 검증할 수 있다.

## 실행과 선택

`pytest`라고만 입력하면 현재 디렉터리에서 테스트 파일을 알아서 찾아 모두 실행한다. 실행 흐름은 크게 세 단계다.

![pytest 실행 흐름](/assets/posts/python-pytest-basics-run-flow.svg)

자주 쓰는 옵션 몇 가지만 알면 일상 작업이 편해진다.

```bash
pytest -v              # 테스트별 결과를 자세히
pytest -q              # 조용히, 요약만
pytest test_math.py    # 특정 파일만
pytest -k "add"        # 이름에 add가 든 테스트만
pytest -x              # 첫 실패에서 즉시 중단
pytest --lf            # 지난번 실패한 것만 다시
```

특히 `-k`로 이름 일부만 매칭해 원하는 테스트만 골라 돌리거나, 고치는 중이라면 `--lf`(last failed)로 실패한 것만 빠르게 반복하는 패턴이 디버깅 속도를 크게 높여 준다.

pytest는 적은 양의 코드로 테스트를 쓰게 해 주는 데서 그치지 않는다. fixture, parametrize, 풍부한 플러그인 생태계까지 더해지면 테스트 작성이 훨씬 즐거워진다. 다음 글에서는 그 첫 단추인 **fixture**로, 테스트가 필요로 하는 준비물을 깔끔하게 주입하는 법을 살펴본다.

---

**지난 글:** [unittest 기초: 표준 라이브러리로 시작하는 테스트](/posts/python-unittest-basics/)

**다음 글:** [pytest fixture: 테스트 준비물을 우아하게 주입하기](/posts/python-pytest-fixtures/)

<br>
읽어주셔서 감사합니다. 😊
