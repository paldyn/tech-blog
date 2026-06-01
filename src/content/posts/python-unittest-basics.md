---
title: "unittest 기초: 표준 라이브러리로 시작하는 테스트"
description: "파이썬에 내장된 unittest로 TestCase를 작성하는 법, assert 메서드와 setUp·tearDown 생명주기, 테스트를 실행하고 읽는 법까지 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["unittest", "테스트", "TestCase", "단위테스트", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-version-pinning/)에서 의존성을 lock으로 고정해 재현 가능한 빌드를 만드는 법을 다뤘다. 환경이 안정됐다면 이제 코드가 실제로 의도대로 동작하는지 자동으로 확인할 차례다. 테스트는 "내가 짠 코드가 지금도, 그리고 내일 고친 뒤에도 맞게 동작한다"는 사실을 사람이 일일이 손으로 확인하지 않아도 되게 해 준다. 그 출발점으로 가장 좋은 것이 파이썬에 처음부터 들어 있는 `unittest`다. 외부 패키지를 설치하지 않아도, 표준 라이브러리만으로 곧바로 테스트를 짤 수 있다.

## TestCase가 테스트의 단위다

`unittest`의 세계에서 테스트는 클래스 안에 모인다. `unittest.TestCase`를 상속한 클래스를 만들고, 그 안에 `test_`로 시작하는 메서드를 정의하면 각 메서드가 하나의 독립된 테스트가 된다. 이름 규칙이 핵심이다 — 메서드 이름이 `test_`로 시작해야만 테스트 러너가 그것을 테스트로 인식한다.

![unittest의 기본 구조](/assets/posts/python-unittest-basics-structure.svg)

```python
import unittest

def add(a, b):
    return a + b

class TestMath(unittest.TestCase):
    def test_add_positive(self):
        self.assertEqual(add(1, 1), 2)

    def test_add_negative(self):
        self.assertEqual(add(-1, -1), -2)

if __name__ == "__main__":
    unittest.main()
```

이 파일을 `python test_math.py`로 직접 실행하거나, 더 흔하게는 `python -m unittest`로 실행한다. 러너는 `TestMath` 안에서 `test_`로 시작하는 메서드를 모두 찾아 **각각을 따로** 실행한다. 한 메서드가 실패해도 다른 메서드는 멈추지 않고 계속 돌아간다.

## assert 메서드로 기대를 표현한다

`unittest`는 단순한 `assert` 문 대신 전용 검증 메서드를 제공한다. 이 메서드들은 실패했을 때 "무엇이 기대됐고 실제로 무엇이 나왔는지"를 친절하게 출력해 준다. 가장 자주 쓰는 것들만 봐도 충분하다.

```python
class TestAssertions(unittest.TestCase):
    def test_examples(self):
        self.assertEqual(2 + 2, 4)          # ==
        self.assertNotEqual(2 + 2, 5)       # !=
        self.assertTrue(3 > 1)              # 참인지
        self.assertFalse(1 > 3)             # 거짓인지
        self.assertIn(2, [1, 2, 3])         # 멤버십
        self.assertIsNone(None)             # None 인지

    def test_exception(self):
        with self.assertRaises(ZeroDivisionError):
            1 / 0
```

`assertEqual(a, b)`가 실패하면 단순히 "False"가 아니라 `2 != 5` 같은 비교 정보를 보여 준다. 예외가 발생해야 하는 상황은 `assertRaises`를 `with` 블록과 함께 써서, 블록 안의 코드가 해당 예외를 던지는지 검증한다.

## setUp과 tearDown: 준비와 뒷정리

여러 테스트가 같은 준비물을 필요로 할 때가 많다. 임시 파일, 데이터베이스 연결, 초기화된 객체 같은 것이다. 매 테스트 메서드마다 똑같은 준비 코드를 복사하는 대신, `setUp` 메서드에 한 번 적어 두면 된다. `setUp`은 **각 테스트 메서드가 실행되기 직전에** 자동으로 호출되고, `tearDown`은 **각 테스트가 끝난 직후에** 호출된다.

![테스트 메서드의 생명주기](/assets/posts/python-unittest-basics-lifecycle.svg)

```python
class TestAccount(unittest.TestCase):
    def setUp(self):
        # 테스트마다 새 계좌를 만든다
        self.account = Account(balance=100)

    def test_deposit(self):
        self.account.deposit(50)
        self.assertEqual(self.account.balance, 150)

    def test_withdraw(self):
        self.account.withdraw(30)
        self.assertEqual(self.account.balance, 70)
```

중요한 점은 `setUp`이 테스트 클래스당 한 번이 아니라 **테스트 메서드마다 매번** 실행된다는 것이다. 그래서 `test_deposit`에서 잔액을 바꿔도 `test_withdraw`는 다시 100으로 초기화된 깨끗한 계좌에서 시작한다. 이렇게 각 테스트가 서로의 상태에 영향을 주지 않는 **격리(isolation)** 가 좋은 테스트의 핵심 원칙이다. 테스트 사이에 순서 의존성이 생기면, 어느 날 실행 순서가 바뀌었을 때 이유 없이 깨지는 테스트가 된다.

## 실행 결과를 읽는 법

`python -m unittest -v`로 실행하면 각 테스트의 이름과 결과가 한 줄씩 나온다. 점(`.`)은 통과, `F`는 실패(assert 불일치), `E`는 에러(예상치 못한 예외)를 뜻한다. 실패하면 어느 테스트의 몇 번째 줄에서, 무엇을 기대했는데 무엇이 나왔는지가 함께 출력된다.

```text
test_add_negative (test_math.TestMath) ... ok
test_add_positive (test_math.TestMath) ... ok

----------------------------------------------------------------------
Ran 2 tests in 0.000s

OK
```

이 출력의 마지막 줄 `OK` 하나를 보기 위해 테스트를 짠다고 해도 과언이 아니다. 리팩터링을 하거나 기능을 추가한 뒤 이 `OK`가 그대로 떠 있으면, 적어도 테스트가 검증하는 범위 안에서는 망가뜨린 게 없다는 뜻이다.

`unittest`는 표준 라이브러리라는 점, 그리고 클래스 기반의 명시적인 구조 덕분에 견고하다. 다만 클래스와 전용 assert 메서드를 매번 쓰는 것이 다소 장황하게 느껴질 수 있는데, 다음 글에서 살펴볼 pytest는 바로 그 장황함을 덜어 준다. 하지만 `setUp`·`tearDown`·격리 같은 핵심 개념은 도구가 바뀌어도 그대로 쓰이니, 여기서 익힌 사고방식이 토대가 된다.

---

**지난 글:** [버전 고정과 lock 파일: 재현 가능한 빌드](/posts/python-version-pinning/)

**다음 글:** [pytest 기초: assert 한 줄로 쓰는 테스트](/posts/python-pytest-basics/)

<br>
읽어주셔서 감사합니다. 😊
