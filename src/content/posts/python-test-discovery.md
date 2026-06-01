---
title: "테스트 디스커버리: 도구가 테스트를 찾는 규칙"
description: "pytest와 unittest가 테스트 파일·클래스·함수를 찾아내는 이름 규칙, rootdir와 conftest, 프로젝트 레이아웃과 import 문제까지 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["pytest", "테스트디스커버리", "conftest", "프로젝트구조", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-doctest/)에서 문서 속 예제를 테스트로 삼는 doctest를 다뤘다. 이 시리즈에서 우리는 unittest와 pytest로 테스트를 쓰고, fixture·parametrize·mock으로 다듬고, 커버리지로 점검하고, 여러 환경에서 돌렸다. 그런데 그동안 당연하게 여긴 것이 하나 있다. `pytest`라고만 입력했을 때, 도구는 도대체 **어떻게 테스트를 찾아내는가?** 이 디스커버리 규칙을 정확히 알면, "분명 테스트를 짰는데 실행되지 않는다"는 흔한 답답함에서 벗어날 수 있다. 시리즈를 마무리하며 이 마지막 조각을 맞춘다.

## 이름 규칙이 곧 발견 규칙

pytest는 정해진 이름 패턴에 맞는 것만 테스트로 수집한다. 기본 규칙은 단순하다. **파일**은 `test_*.py` 또는 `*_test.py`, **클래스**는 `Test`로 시작(단, `__init__` 메서드가 없어야 함), **함수·메서드**는 `test_`로 시작해야 한다.

![테스트를 찾는 기본 규칙](/assets/posts/python-test-discovery-rules.svg)

```python
# test_orders.py  ← test_ 로 시작하는 파일
def test_total():            # 수집됨
    assert total([1, 2]) == 3

def check_total():           # 무시됨 — test_ 로 시작 안 함
    assert total([1, 2]) == 3

class TestCart:              # 수집됨 — Test 로 시작
    def test_add(self):      # 수집됨
        assert add_item([], "a") == ["a"]
```

`check_total`처럼 이름이 규칙에서 벗어나면 pytest는 그것을 그냥 평범한 함수로 보고 지나친다. "테스트가 실행되지 않는다"는 문제의 절반은 이 이름 규칙을 어긴 경우다. unittest도 비슷해서, `python -m unittest`는 `test*.py` 파일에서 `TestCase` 하위 클래스의 `test_` 메서드를 찾는다.

## 어디서부터 찾을까: rootdir

pytest는 실행 위치에서 위로 올라가며 `pyproject.toml`, `tox.ini`, `setup.cfg` 같은 설정 파일을 찾아 **rootdir**를 정한다. 이 rootdir가 경로 계산과 설정 적용의 기준점이 된다. 어느 하위 디렉터리에서 실행하든 일관되게 동작하도록 해 주는 닻과 같다.

![프로젝트 구조와 수집 시작점](/assets/posts/python-test-discovery-layout.svg)

설정 파일에 디스커버리 동작을 명시해 둘 수도 있다.

```toml
# pyproject.toml
[tool.pytest.ini_options]
testpaths = ["tests"]                 # 여기부터 찾는다
python_files = ["test_*.py"]          # 파일 이름 패턴
python_functions = ["test_*"]         # 함수 이름 패턴
```

`testpaths`를 지정하면 매번 경로를 적지 않아도 `pytest`만으로 `tests/`를 훑는다. 규칙을 바꾸고 싶다면(예: `*_test.py`도 포함) 패턴을 여기서 조정한다.

## conftest.py: 발견과 공유의 중심

`conftest.py`는 pytest가 특별히 취급하는 파일이다. import하지 않아도 같은 디렉터리와 그 하위의 모든 테스트가 자동으로 인식한다. 공유 fixture, 플러그인 등록, 디스커버리 훅을 여기에 둔다. 디렉터리 계층마다 `conftest.py`를 두면, 각 영역에 맞는 설정을 계층적으로 적용할 수 있다.

```python
# tests/conftest.py
import pytest

@pytest.fixture
def client():
    return TestClient(app)
```

이제 `tests/` 아래 어떤 테스트든 `client`를 인자로 적기만 하면 받아 쓸 수 있다. 앞선 fixture 글에서 본 그 자동 주입이, 바로 이 디스커버리 메커니즘 위에서 동작한다.

## import 문제와 레이아웃

디스커버리에서 가장 골치 아픈 부분은 import다. 테스트 파일이 같은 이름(`test_utils.py`가 여러 폴더에 존재)일 때 충돌이 나거나, 패키지 구조에 따라 모듈을 못 찾는 일이 생긴다. 안정적인 해법은 소스를 `src/` 레이아웃에 두고 패키지를 설치 가능한 형태로 만든 뒤, 테스트는 설치된 패키지를 import하는 것이다.

```bash
pip install -e .        # 개발 모드로 설치
pytest                  # 설치된 패키지를 import 하므로 경로 혼란이 없다
```

각 테스트 디렉터리에 `__init__.py`를 넣어 패키지로 만들면 같은 이름의 테스트 파일 충돌도 피할 수 있다. 디스커버리가 꼬일 때는 대개 "어떤 경로에서, 어떤 import 기준으로 테스트가 로드되는가"를 따져 보면 실마리가 풀린다.

이렇게 테스트가 어떻게 발견되는지까지 알면, 작성·실행·디버깅의 전 과정이 손에 잡힌다. 이 시리즈에서 우리는 unittest의 기본기에서 출발해 pytest로 옮겨 가고, fixture와 parametrize로 테스트를 우아하게 다듬고, mock으로 의존성을 통제하고, 커버리지·tox·Hypothesis·doctest로 품질을 넓혔다. 테스트는 코드를 옭아매는 족쇄가 아니라, 마음 놓고 고칠 수 있게 해 주는 안전망이다. 이 안전망을 손에 쥐었다면, 이제 어떤 코드든 두려움 없이 바꿔 나갈 수 있다.

---

**지난 글:** [doctest: 문서 속 예제를 테스트로](/posts/python-doctest/)

<br>
읽어주셔서 감사합니다. 😊
