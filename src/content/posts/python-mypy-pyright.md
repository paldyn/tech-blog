---
title: "mypy와 pyright: 두 정적 타입 검사기 비교"
description: "파이썬 대표 타입 검사기 mypy와 pyright의 구조·속도·엄격성 차이를 비교하고, 설정과 strict 모드, CI 통합까지 실전 운영법을 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["mypy", "pyright", "정적분석", "타입검사", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-typing-paramspec/)까지 우리는 타입을 "표현"하는 다양한 도구를 익혔다. 그런데 타입 힌트는 그것을 실제로 검사하는 도구가 있어야 의미가 있다. 파이썬 생태계에서 가장 널리 쓰이는 두 검사기가 mypy와 pyright다. 둘 다 같은 타입 힌트를 읽지만, 구현 언어부터 속도, 엄격함, 통합 방식까지 성격이 사뭇 다르다.

## mypy: 사실상의 표준

mypy는 파이썬 타입 힌트의 출발점이자 참조 구현에 가깝다. 파이썬으로 작성됐고, `pip`로 간단히 설치한다.

```bash
pip install mypy
mypy app.py
```

대부분의 오픈소스 프로젝트가 CI에서 mypy를 돌린다. 타이핑 명세(PEP)의 동작을 결정하는 기준 역할을 오래 해 왔기에, "표준을 따른다"는 신뢰가 있다.

## pyright: 빠르고 편집기 친화적

pyright는 마이크로소프트가 TypeScript로 만든 검사기다. 핵심 강점은 **속도**와 **편집기 통합**이다. VS Code의 Pylance가 바로 이 pyright 엔진을 쓴다.

```bash
npm install -g pyright
pyright app.py
```

![mypy vs pyright](/assets/posts/python-mypy-pyright-compare.svg)

pyright는 파일을 저장하는 즉시 타입 오류를 표시할 만큼 빠르고, 타입 좁히기 추론이 정교하다. 대형 코드베이스에서 mypy가 수 초 걸리는 검사를 pyright는 훨씬 빠르게 끝내는 경우가 많다.

## 같은 오류, 다른 리포트

두 검사기 모두 같은 종류의 오류를 잡지만, 메시지 형식과 옵션 이름이 조금 다르다.

```text
$ mypy app.py
app.py:7: error: Argument 1 to "add" has
  incompatible type "str"; expected "int"
Found 1 error in 1 file

$ pyright app.py
app.py:7:9 - error: "str" 형식의 인수를
  "int" 매개변수에 할당할 수 없습니다
```

![검사기 실행과 오류 리포트](/assets/posts/python-mypy-pyright-workflow.svg)

세부 메시지는 다르지만 잡아내는 본질은 같다. 같은 코드에 대해 두 도구가 서로 다른 결과를 내는 경우는 주로 엄격성 설정과 추론 정밀도 차이에서 비롯된다.

## 설정 파일

mypy는 `pyproject.toml`(또는 `mypy.ini`), pyright는 `pyrightconfig.json`이나 `pyproject.toml`로 설정한다.

```toml
# pyproject.toml — mypy 설정
[tool.mypy]
python_version = "3.12"
strict = true
warn_unused_ignores = true

# pyright 설정
[tool.pyright]
typeCheckingMode = "strict"
reportMissingImports = true
```

`strict` 모드를 켜면 힌트가 빠진 함수, 암묵적 `Any`, 잡지 못한 None 등을 모두 경고한다. 새 프로젝트는 처음부터 strict로 시작하는 것이 좋고, 기존 프로젝트는 모듈별로 점진적으로 올리는 전략이 현실적이다.

## 어떻게 함께 쓸까

둘 중 하나만 골라야 하는 것은 아니다. 실무에서 흔한 조합은 이렇다. **개발 중에는 편집기에서 pyright(Pylance)** 로 즉각적인 피드백을 받고, **CI에서는 mypy** 로 표준 검증을 돌린다. 두 도구가 같은 코드를 통과시키면 타입 안전성에 대한 확신이 커진다. 다만 strict 설정의 세부가 달라 한쪽만 통과하는 경우가 있으니, 팀의 기준 검사기를 하나 정하고 그 결과를 머지 기준으로 삼는 것이 혼란을 줄인다. 다음 글에서는 이 정적 검사를 넘어, 런타임에 타입을 확인하는 방법과 그 한계를 다룬다.

---

**지난 글:** [ParamSpec: 데코레이터의 시그니처를 보존하기](/posts/python-typing-paramspec/)

**다음 글:** [런타임 타입 검사: runtime_checkable과 그 한계](/posts/python-typing-runtime-checked/)

<br>
읽어주셔서 감사합니다. 😊
