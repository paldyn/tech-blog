---
title: "pytest fixture: 테스트 준비물을 우아하게 주입하기"
description: "함수 인자 이름으로 자동 주입되는 pytest fixture의 원리, yield 기반 정리, scope로 재생성 주기를 조절하는 법까지 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["pytest", "fixture", "테스트", "의존성주입", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-pytest-basics/)에서 pytest의 기본기를 익히며 평범한 함수와 `assert`로 테스트를 쓰는 법을 봤다. 그런데 실제 테스트는 검증만 하지 않는다. 검증 전에 데이터베이스 연결을 열고, 임시 디렉터리를 만들고, 샘플 객체를 준비해야 한다. `unittest`에서는 이 준비를 `setUp`에 담았는데, pytest는 더 유연하고 재사용하기 좋은 도구를 제공한다. 바로 **fixture**다.

## 인자 이름으로 주입된다

pytest fixture의 핵심은 의외로 단순하다. `@pytest.fixture`를 붙인 함수를 만들면, **테스트 함수가 그 함수와 똑같은 이름의 인자를 선언**할 때 pytest가 fixture를 실행해 그 반환값을 인자로 넣어 준다. 직접 호출하는 게 아니라 "이름을 적으면 알아서 들어온다"는 점이 처음엔 낯설지만, 익숙해지면 매우 편하다.

![fixture는 인자 이름으로 주입된다](/assets/posts/python-pytest-fixtures-injection.svg)

```python
import pytest

@pytest.fixture
def sample_user():
    return {"name": "kim", "age": 30}

def test_name(sample_user):
    assert sample_user["name"] == "kim"

def test_age(sample_user):
    assert sample_user["age"] == 30
```

`test_name`과 `test_age` 둘 다 `sample_user`를 인자로 받았다. pytest는 각 테스트가 시작될 때 `sample_user()` fixture를 실행하고, 그 반환값을 인자로 전달한다. 준비 코드를 한 곳에 모으고 여러 테스트에서 재사용하는 것이다.

## yield로 준비와 정리를 한 함수에

준비물 중에는 다 쓰고 나서 정리(close, delete)해야 하는 것이 많다. fixture 안에서 `return` 대신 `yield`를 쓰면, `yield` **앞은 준비**, `yield` **뒤는 정리** 코드가 된다. 테스트가 끝나면 pytest가 자동으로 `yield` 이후를 실행한다.

```python
@pytest.fixture
def db_connection():
    conn = connect_to_db()       # 준비
    yield conn                   # 테스트에 전달
    conn.close()                 # 정리 (테스트 종료 후)

def test_query(db_connection):
    rows = db_connection.execute("SELECT 1")
    assert rows is not None
```

`yield conn`에서 멈춰 테스트에 연결을 넘겨주고, 테스트가 끝나면 다시 돌아와 `conn.close()`를 실행한다. `setUp`과 `tearDown`으로 나뉘어 있던 코드를 하나의 흐름으로 자연스럽게 적을 수 있다. pytest에는 `tmp_path`, `monkeypatch`, `capsys` 같은 **내장 fixture**도 있어서, 임시 디렉터리나 출력 캡처처럼 흔한 준비물은 따로 만들 필요도 없다.

## scope로 재생성 주기를 조절한다

기본적으로 fixture는 **테스트 함수마다 새로** 만들어진다. 이는 격리에는 좋지만, 만드는 비용이 큰 자원(예: 데이터베이스 컨테이너 기동)이라면 매번 새로 만드는 것이 너무 느리다. 이때 `scope` 인자로 재생성 주기를 넓힐 수 있다.

![fixture의 scope: 재생성 주기](/assets/posts/python-pytest-fixtures-scope.svg)

```python
@pytest.fixture(scope="module")
def heavy_resource():
    print("\n무거운 자원 준비")
    resource = build_expensive_thing()
    yield resource
    resource.shutdown()
```

`scope="function"`(기본)은 테스트마다, `"class"`는 클래스마다, `"module"`은 파일마다, `"session"`은 전체 실행에 단 한 번 fixture를 만든다. 왼쪽일수록 테스트 간 격리가 강하지만 느리고, 오른쪽일수록 공유되어 빠르지만 상태 오염에 주의해야 한다. 비용이 큰 자원은 scope를 넓혀 공유하되, 그 자원의 상태를 테스트가 함부로 바꾸지 않도록 신경 써야 한다.

## conftest.py로 공유하기

여러 테스트 파일이 같은 fixture를 쓴다면, `conftest.py`라는 특별한 파일에 정의해 둔다. 이 파일에 있는 fixture는 import 없이도 같은 디렉터리와 하위 디렉터리의 모든 테스트에서 자동으로 쓸 수 있다.

```python
# tests/conftest.py
import pytest

@pytest.fixture
def app_config():
    return {"debug": True, "db": "sqlite://:memory:"}
```

이제 `tests/` 아래 어느 테스트 함수든 `app_config`를 인자로 적기만 하면 이 설정을 받는다. fixture는 다른 fixture를 인자로 받아 조합할 수도 있어서, 작은 준비물들을 레고처럼 쌓아 복잡한 테스트 환경을 구성하게 해 준다. 다음 글에서는 같은 테스트 로직을 여러 입력으로 자동 반복하는 **parametrize**를 살펴본다.

---

**지난 글:** [pytest 기초: assert 한 줄로 쓰는 테스트](/posts/python-pytest-basics/)

**다음 글:** [parametrize: 하나의 테스트를 여러 입력으로 펼치기](/posts/python-pytest-parametrize/)

<br>
읽어주셔서 감사합니다. 😊
