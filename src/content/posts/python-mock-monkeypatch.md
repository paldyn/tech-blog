---
title: "mock과 monkeypatch: 의존성을 가짜로 바꾸기"
description: "외부 API·시간·랜덤처럼 통제하기 어려운 의존성을 테스트 중에만 가짜로 대체하는 monkeypatch와 unittest.mock의 사용법과 검증 패턴을 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["mock", "monkeypatch", "테스트", "의존성", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-pytest-parametrize/)에서 같은 로직을 여러 입력으로 펼치는 parametrize를 다뤘다. 그런데 어떤 코드는 입력만 바꾼다고 테스트할 수 없다. 외부 날씨 API를 호출하거나, 현재 시각에 의존하거나, 무작위 값을 쓰는 코드는 실행할 때마다 결과가 달라지고, 네트워크가 끊기면 테스트도 멈춘다. 이런 **통제하기 어려운 의존성**을 테스트 중에만 정해진 가짜로 바꿔치기하는 기법이 mock(목)과 monkeypatch(몽키패치)다.

## 왜 가짜로 바꾸나

테스트는 빠르고, 결정적(deterministic)이며, 외부 상태에 흔들리지 않아야 한다. 실제 외부 API를 호출하는 테스트는 느리고, 상대 서버가 불안정하면 내 코드 잘못이 아닌데도 실패한다. 그래서 "이 함수가 API 응답을 받았을 때 올바르게 처리하는가"만 검증하고 싶다면, API 호출 자체는 정해진 값을 즉시 돌려주는 가짜로 대체하는 것이 맞다.

![테스트 중에만 가짜로 바꿔치기](/assets/posts/python-mock-monkeypatch-replace.svg)

## monkeypatch: pytest의 간결한 교체 도구

pytest는 `monkeypatch`라는 내장 fixture를 제공한다. 인자로 받기만 하면 되고, 테스트가 끝나면 **바꾼 것을 자동으로 원래대로 복원**해 준다. 가장 자주 쓰는 것은 `setattr`로 어떤 속성·함수를 가짜로 교체하는 패턴이다.

```python
import weather

def get_forecast(city):
    data = weather.fetch(city)   # 실제 외부 API
    return f"{city}: {data['temp']}도"

def test_get_forecast(monkeypatch):
    def fake_fetch(city):
        return {"temp": 21}
    monkeypatch.setattr(weather, "fetch", fake_fetch)

    assert get_forecast("Seoul") == "Seoul: 21도"
```

`weather.fetch`를 `fake_fetch`로 갈아끼웠기 때문에, 테스트는 네트워크 없이도 항상 같은 결과를 낸다. `monkeypatch`는 `setattr` 외에도 환경 변수를 바꾸는 `setenv`, 딕셔너리 항목을 바꾸는 `setitem` 등을 제공해, 시간·환경 설정 같은 의존성도 손쉽게 통제한다.

## unittest.mock: 호출 자체를 검증하기

표준 라이브러리 `unittest.mock`은 값 교체를 넘어 **호출 여부와 인자까지 검증**하는 강력한 기능을 제공한다. `MagicMock` 객체는 어떤 속성에 접근하거나 호출해도 에러 없이 받아 주고, 자신이 어떻게 호출됐는지 전부 기록한다.

![monkeypatch와 mock.patch](/assets/posts/python-mock-monkeypatch-compare.svg)

```python
from unittest.mock import patch

def send_welcome(emailer, user):
    emailer.send(user.email, subject="환영합니다")

def test_send_welcome():
    with patch("myapp.emailer") as mock_emailer:
        send_welcome(mock_emailer, user)

        mock_emailer.send.assert_called_once_with(
            user.email, subject="환영합니다"
        )
```

여기서는 `send`가 **정확히 한 번**, 그것도 **지정한 인자로** 호출됐는지를 검증한다. 이메일을 실제로 보내지 않으면서도 "보내는 동작이 올바른 인자로 일어났는가"를 확인하는 것이다. `return_value`로 가짜 반환값을 정하거나, `side_effect`로 예외를 던지게 만들 수도 있다.

```python
mock_api.return_value = {"status": "ok"}     # 호출 시 이 값 반환
mock_api.side_effect = TimeoutError          # 호출 시 예외 발생
```

## 어디를 패치할지가 핵심

mock에서 가장 흔히 실수하는 지점은 "패치 대상의 경로"다. 원칙은 **정의된 곳이 아니라 사용되는 곳을 패치**하라는 것이다. `myapp.service`가 `from utils import fetch`로 가져왔다면, `utils.fetch`가 아니라 `myapp.service.fetch`를 패치해야 그 모듈이 실제로 참조하는 이름이 바뀐다.

```python
# myapp/service.py 에서 from utils import fetch 했다면
with patch("myapp.service.fetch") as m:   # 사용되는 곳
    ...
```

mock은 강력하지만 과하면 "실제 코드가 아니라 mock을 테스트하는" 함정에 빠진다. 외부 경계(네트워크·시간·파일 같은 통제 불가능한 부분)만 가짜로 바꾸고, 내 도메인 로직은 진짜로 실행해 검증하는 균형이 좋다. 다음 글에서는 테스트가 코드의 어느 부분까지 닿았는지 측정하는 **코드 커버리지**를 살펴본다.

---

**지난 글:** [parametrize: 하나의 테스트를 여러 입력으로 펼치기](/posts/python-pytest-parametrize/)

**다음 글:** [코드 커버리지: 테스트가 닿지 않은 곳 찾기](/posts/python-coverage/)

<br>
읽어주셔서 감사합니다. 😊
