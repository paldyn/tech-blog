---
title: "tox와 nox: 여러 환경에서 자동으로 테스트하기"
description: "여러 파이썬 버전·의존성 조합에서 격리된 가상환경으로 테스트를 자동화하는 tox와 nox의 구조, 선언형과 코드형의 차이, 활용법을 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 7
type: "knowledge"
category: "Python"
tags: ["tox", "nox", "테스트자동화", "가상환경", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-coverage/)에서 커버리지로 테스트의 사각지대를 찾는 법을 봤다. 그런데 테스트가 "내 컴퓨터, 내 파이썬 3.12"에서 통과하는 것만으로는 부족할 때가 있다. 라이브러리를 배포한다면 사용자는 3.10을 쓸 수도, 3.13을 쓸 수도 있다. 버전마다 동작이 미묘하게 다른 경우가 실제로 존재한다. 여러 파이썬 버전과 의존성 조합에서 테스트를 **자동으로, 격리된 환경에서** 돌려 주는 도구가 tox와 nox다.

## 매트릭스 테스트라는 발상

핵심 아이디어는 하나의 코드베이스를 여러 환경에 걸쳐 검증하는 것이다. tox·nox는 각 버전·조합마다 깨끗한 가상환경을 따로 만들고, 거기에 패키지를 설치한 뒤 테스트를 실행한다. 환경끼리 격리되어 있어 한 버전의 의존성이 다른 버전을 오염시키지 않는다.

![여러 환경에서 한 번에 테스트](/assets/posts/python-tox-nox-matrix.svg)

이 자동화 덕분에 "3.11에서는 되는데 3.9에서는 깨지는" 호환성 문제를 배포 전에 잡을 수 있다. CI 서버에서도 같은 설정을 그대로 돌리므로, 로컬과 CI의 결과가 일치한다.

## tox: 선언형 설정

tox는 `tox.ini`(또는 `pyproject.toml`의 `[tool.tox]`)에 환경을 **선언**한다. 무엇을 할지를 설정값으로 적으면 tox가 알아서 가상환경을 만들고 명령을 실행한다.

```ini
[tox]
envlist = py310, py311, py312

[testenv]
deps =
    pytest
    pytest-cov
commands =
    pytest --cov=mypkg {posargs}
```

`envlist`에 적은 버전마다 환경이 만들어지고, `[testenv]`의 `deps`를 설치한 뒤 `commands`를 실행한다. 터미널에서 `tox`라고만 입력하면 세 버전 모두에서 테스트가 순차적으로 돈다. `{posargs}`는 `tox -- -k login`처럼 추가 인자를 그대로 pytest에 넘겨주는 자리다.

## nox: 코드형 설정

nox는 같은 일을 **파이썬 코드**로 표현한다. `noxfile.py`에 세션을 함수로 정의하고, 그 안에서 설치·실행을 명령형으로 적는다.

![선언형(tox) vs 코드형(nox)](/assets/posts/python-tox-nox-config.svg)

```python
# noxfile.py
import nox

@nox.session(python=["3.10", "3.11", "3.12"])
def tests(session):
    session.install("pytest", "pytest-cov")
    session.run("pytest", "--cov=mypkg", *session.posargs)

@nox.session
def lint(session):
    session.install("ruff")
    session.run("ruff", "check", ".")
```

`@nox.session`을 붙인 함수가 하나의 작업 단위(세션)다. `python=[...]`에 적은 버전마다 세션이 펼쳐진다. 평범한 파이썬이므로 조건 분기, 반복, 외부 값 읽기 같은 로직을 자유롭게 넣을 수 있다. `nox`라고 실행하면 모든 세션이, `nox -s tests`처럼 이름을 주면 특정 세션만 돈다.

## 무엇을 고를까

둘 다 "격리 환경에서 매트릭스 테스트"라는 목표는 같다. 선택의 기준은 설정의 성격이다.

```bash
tox              # tox.ini에 선언된 모든 환경 실행
tox -e py311     # 특정 환경만
nox              # noxfile.py의 모든 세션 실행
nox -s tests     # 특정 세션만
```

설정이 단순하고 정적이라면 tox의 간결한 INI가 잘 맞는다. 환경 구성에 동적인 로직(예: 특정 조건에서만 추가 패키지 설치)이 필요하다면, 평범한 코드로 표현하는 nox가 유연하다. 둘은 경쟁한다기보다 취향과 복잡도에 따라 고르는 선택지에 가깝다.

테스트·린트·문서 빌드 같은 반복 작업을 한 명령으로 묶고, 여러 환경에서 한꺼번에 검증하는 습관은 라이브러리 품질을 크게 끌어올린다. 다음 글에서는 입력을 직접 고르는 대신 라이브러리가 자동으로 만들어 내는 **속성 기반 테스트(Hypothesis)** 를 살펴본다.

---

**지난 글:** [코드 커버리지: 테스트가 닿지 않은 곳 찾기](/posts/python-coverage/)

**다음 글:** [Hypothesis로 시작하는 속성 기반 테스트](/posts/python-property-based-hypothesis/)

<br>
읽어주셔서 감사합니다. 😊
