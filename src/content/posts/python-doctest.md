---
title: "doctest: 문서 속 예제를 테스트로"
description: "docstring 안의 >>> 예제를 그대로 실행해 검증하는 doctest의 원리와 실행법, 옵션 플래그, 그리고 적합한 자리와 한계를 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["doctest", "docstring", "테스트", "문서화", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-property-based-hypothesis/)에서 라이브러리가 입력을 생성하는 속성 기반 테스트를 다뤘다. 이번에는 정반대로, 가장 소박하지만 독특한 매력을 가진 테스트 방식을 본다. 우리는 함수에 docstring을 적을 때 흔히 `>>> func(2, 3)` 같은 사용 예시를 넣는다. 그런데 코드가 바뀌면 이 예시는 슬그머니 거짓말이 되곤 한다. `doctest`는 docstring 안의 그 예시를 **실제로 실행해서** 출력이 맞는지 검증한다. 문서와 테스트가 같은 글이 되는 셈이다.

## docstring의 예제가 곧 테스트

doctest는 docstring에서 `>>>`로 시작하는 줄을 찾아, 그것을 파이썬 대화형 셸에 입력한 것처럼 실행한다. 그리고 바로 다음 줄에 적힌 **기대 출력**과 실제 출력을 비교한다.

![docstring 안의 예시가 곧 테스트](/assets/posts/python-doctest-docstring.svg)

```python
def add(a, b):
    """두 수를 더한다.

    >>> add(2, 3)
    5
    >>> add(-1, 1)
    0
    """
    return a + b
```

`>>> add(2, 3)`을 실행한 결과가 `5`와 일치하면 통과, 다르면 실패다. 별도의 테스트 파일을 만들 필요 없이, 함수 바로 옆 문서가 검증 가능한 테스트로 변한다.

## 실행하는 법

doctest는 표준 라이브러리라 설치가 필요 없다. 모듈을 직접 실행하거나, 코드 안에서 호출하거나, pytest로 함께 돌릴 수 있다.

```bash
python -m doctest mymodule.py -v   # 직접 실행 (-v: 자세히)
pytest --doctest-modules           # pytest로 doctest까지 함께
```

```python
# 파일 끝에 넣어 두면 직접 실행 시 doctest가 돈다
if __name__ == "__main__":
    import doctest
    doctest.testmod()
```

특히 `pytest --doctest-modules`는 일반 테스트와 doctest를 한 번에 수집해 실행하므로, 평소 테스트 파이프라인에 자연스럽게 끼워 넣기 좋다.

## 까다로운 출력 다루기

doctest는 출력을 **문자 그대로** 비교하기 때문에, 출력이 미묘하게 흔들리는 경우 손이 간다. 대표적으로 딕셔너리 표현, 예외 메시지, 긴 출력이 그렇다. 이럴 때 옵션 플래그를 주석으로 달아 비교 방식을 누그러뜨린다.

```python
def get_user():
    """사용자 정보를 돌려준다.

    >>> get_user()  # doctest: +ELLIPSIS
    {'name': 'kim', ...}

    >>> 1 / 0
    Traceback (most recent call last):
        ...
    ZeroDivisionError: division by zero
    """
```

`+ELLIPSIS`를 켜면 `...`가 임의의 텍스트와 매칭되어, 일부만 보이고 나머지를 생략할 수 있다. 예외는 `Traceback (most recent call last):`로 시작하고 `...`로 중간을 생략한 뒤 마지막 예외 줄만 적으면 검증된다. 공백 차이를 무시하려면 `+NORMALIZE_WHITESPACE`를 쓴다.

## 어디에 쓰고, 어디엔 쓰지 말까

doctest의 진짜 가치는 "문서가 항상 정확함을 보장한다"는 데 있다. 하지만 모든 테스트를 doctest로 짜려 들면 금세 한계에 부딪힌다.

![doctest의 자리: 문서와 테스트의 일치](/assets/posts/python-doctest-tradeoff.svg)

짧고 순수한 함수의 사용법 시연, README나 튜토리얼의 코드가 깨지지 않게 지키는 용도에는 더없이 좋다. 반면 복잡한 setup이나 mock이 필요하거나, 출력이 매번 달라지는 값(시각·메모리 주소·집합 순서)을 다루거나, 수많은 경계값을 검증해야 한다면 doctest는 부적합하다. 그런 영역은 pytest로 처리하고, doctest는 **문서를 살아 있게 지키는 가벼운 보조 도구**로 쓰는 것이 알맞은 균형이다.

doctest는 본격적인 테스트 프레임워크의 대체재가 아니라, "이 예제는 정말 동작한다"는 신뢰를 문서에 더해 주는 작은 장치다. 마지막 글에서는 지금까지 만든 테스트들을 도구가 어떻게 찾아내는지, 그 **테스트 디스커버리** 규칙을 정리한다.

---

**지난 글:** [Hypothesis로 시작하는 속성 기반 테스트](/posts/python-property-based-hypothesis/)

**다음 글:** [테스트 디스커버리: 도구가 테스트를 찾는 규칙](/posts/python-test-discovery/)

<br>
읽어주셔서 감사합니다. 😊
