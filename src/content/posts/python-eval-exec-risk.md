---
title: "eval과 exec의 위험성"
description: "문자열을 코드로 실행하는 eval과 exec이 왜 위험한지, 그리고 ast.literal_eval, json, 디스패치 딕트 같은 안전한 대안으로 같은 목적을 달성하는 법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["eval", "exec", "보안", "코드 인젝션", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-pickle-security/)에서 신뢰할 수 없는 데이터를 unpickle하면 코드가 실행된다는 점을 봤다면, 이번에는 그 위험을 더 노골적으로 드러내는 두 내장 함수 — `eval`과 `exec` — 을 살펴본다. 이름부터 "평가"와 "실행"이다. 문자열을 받아 파이썬 코드로 해석해 실제로 돌린다. 편리해 보이지만, 그 문자열에 외부 입력이 한 글자라도 섞이는 순간 심각한 코드 인젝션 취약점이 된다.

## eval과 exec이 하는 일

`eval`은 하나의 **표현식**을 평가해 값을 돌려준다. `eval("2 + 3")`은 `5`가 된다. `exec`은 한 발 더 나가 **임의의 문장**(대입, 반복문, 함수 정의, import 등)을 실행한다. 둘 다 받은 문자열을 진짜 파이썬 코드로 취급한다는 점이 핵심이다.

문제는 여기서 시작된다. 코드로 취급한다는 건, 그 문자열이 할 수 있는 모든 일을 할 수 있다는 뜻이다. 파일 삭제, 네트워크 접속, 환경 변수 탈취 — 파이썬으로 가능한 일이라면 무엇이든.

![eval에 들어온 입력이 코드로 실행된다](/assets/posts/python-eval-exec-risk-injection.svg)

위 예시처럼 "간단한 계산기"를 만든다며 사용자 입력을 `eval`에 넘기면, 공격자는 계산식 대신 `__import__('os').system(...)` 같은 코드를 보내 서버에서 명령을 실행할 수 있다.

## "샌드박스"는 믿을 게 못 된다

흔한 오해 중 하나는 `eval`에 전역/지역 네임스페이스를 비워 넘기면 안전하다는 것이다.

```python
# 안전해 보이지만 — 실제로는 우회 가능
eval(user_input, {"__builtins__": {}}, {})
```

이런 식의 "샌드박싱"은 거의 항상 뚫린다. 파이썬은 객체 그래프가 촘촘히 연결돼 있어서, 빈 네임스페이스에서 출발해도 `().__class__.__bases__[0].__subclasses__()` 같은 경로로 위험한 클래스에 도달할 수 있다. 보안 전문가들이 수없이 시도했지만, 순수 파이썬만으로 `eval`을 완전히 가두는 신뢰할 만한 방법은 없다는 게 통설이다. 그러니 **"입력을 검증하면 되지 않나"**라는 접근 자체를 버리는 편이 안전하다.

## 대안: 목적부터 다시 생각하기

`eval`을 쓰고 싶어지는 상황은 대개 몇 가지로 정해져 있고, 각각에 더 안전한 도구가 있다.

![eval의 안전한 대안들](/assets/posts/python-eval-exec-risk-alternatives.svg)

**리스트·딕트·숫자 같은 파이썬 리터럴을 문자열에서 복원**하고 싶다면 `ast.literal_eval`을 쓴다. 이 함수는 리터럴 구조만 해석하고, 함수 호출이나 연산자, 이름 참조는 거부한다.

```python
import ast

ast.literal_eval("[1, 2, {'a': 3}]")   # OK → 리스트
ast.literal_eval("__import__('os')")    # ValueError — 거부됨
```

**외부에서 구조화된 데이터를 받는 것**이라면 `json.loads`가 정답이다. 데이터만 다루므로 코드 실행 경로가 아예 없다.

**이름으로 동작을 고르는 것**(예: `"add"`라는 문자열로 더하기 함수를 부르는 것)이라면, `eval(f"{name}(...)")` 대신 딕셔너리로 매핑한다.

```python
# 위험: eval(f"{op}({a}, {b})")
# 안전: 허용된 동작만 담은 디스패치 딕트
import operator

OPS = {"add": operator.add, "sub": operator.sub, "mul": operator.mul}

def calc(op: str, a: float, b: float) -> float:
    func = OPS.get(op)
    if func is None:
        raise ValueError(f"허용되지 않은 연산: {op}")
    return func(a, b)
```

이렇게 하면 사용자가 어떤 문자열을 보내든, 미리 등록한 동작만 실행되고 그 외에는 거부된다. 실행 가능한 동작의 집합을 코드가 완전히 통제하게 되는 것이다.

## 정리

`eval`과 `exec`은 "문자열을 코드로 바꾸는" 강력한 도구지만, 그 강력함이 곧 위험이다. 입력에 외부 데이터가 섞일 가능성이 조금이라도 있다면 절대 쓰지 않는다. 동적 동작이 필요하면 거의 항상 `ast.literal_eval`, `json`, 디스패치 딕트, 또는 명시적으로 설계된 작은 파서로 대체할 수 있다. "코드를 평가"하는 게 아니라 "데이터를 해석"하거나 "허용된 동작을 선택"하도록 문제를 다시 정의하는 것이 핵심이다. 다음 글에서는 우리가 쓰는 외부 패키지 자체의 취약점을 점검하는 의존성 스캔을 다룬다.

---

**지난 글:** [pickle의 보안 위험](/posts/python-pickle-security/)

**다음 글:** [의존성 취약점 스캔](/posts/python-dependency-vulnerability-scan/)

<br>
읽어주셔서 감사합니다. 😊
