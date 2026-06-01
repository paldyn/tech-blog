---
title: "코드 커버리지: 테스트가 닿지 않은 곳 찾기"
description: "coverage.py와 pytest-cov로 라인·브랜치 커버리지를 측정하고 보고서를 읽는 법, 그리고 커버리지 숫자를 올바르게 해석하는 관점을 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["coverage", "pytest-cov", "테스트", "커버리지", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-mock-monkeypatch/)에서 의존성을 가짜로 바꿔 테스트를 결정적으로 만드는 법을 다뤘다. 테스트를 점점 쌓다 보면 자연스럽게 떠오르는 질문이 있다. "내 테스트가 코드의 어디까지 검증하고 있지?" 분명 테스트는 통과하는데, 정작 중요한 분기 하나가 아무 테스트도 거치지 않고 있을 수 있다. 이 사각지대를 객관적으로 보여 주는 도구가 **코드 커버리지**다.

## 커버리지가 측정하는 것

커버리지는 테스트를 실행하는 동안 **어느 코드 줄이 실제로 실행됐는지**를 추적해, 전체 대비 실행된 비율을 알려 준다. 80% 커버리지란 코드 줄의 80%가 적어도 한 번은 테스트 중에 실행됐다는 뜻이다.

![커버리지: 어느 줄이 실행됐나](/assets/posts/python-coverage-lines.svg)

파이썬에서는 `coverage.py`가 표준 도구다. 먼저 설치한다.

```bash
pip install coverage
```

## 측정하고 보고하기

커버리지 측정은 세 단계로 이뤄진다. 테스트를 측정하며 실행하고, 요약을 출력하고, 필요하면 HTML로 시각화한다.

![커버리지 측정 워크플로우](/assets/posts/python-coverage-workflow.svg)

```bash
coverage run -m pytest      # 측정하며 테스트 실행
coverage report -m          # 콘솔 요약 (-m: 누락 줄 번호까지)
coverage html               # htmlcov/ 에 HTML 보고서 생성
```

`coverage report -m`을 실행하면 파일별 커버리지와 함께, 실행되지 않은 줄 번호가 `Missing` 칸에 나온다.

```text
Name              Stmts   Miss  Cover   Missing
-----------------------------------------------
grade.py              5      1    80%   8
service.py           24      0   100%
-----------------------------------------------
TOTAL                29      1    97%
```

`grade.py`의 8번 줄이 어떤 테스트에서도 실행되지 않았다는 뜻이다. HTML 보고서를 열면 실행된 줄은 초록, 누락된 줄은 빨강으로 칠해져 어느 분기를 놓쳤는지 한눈에 보인다.

## pytest-cov로 한 줄에

pytest를 쓴다면 `pytest-cov` 플러그인이 더 편하다. 측정과 보고를 `pytest` 한 번에 합쳐 준다.

```bash
pip install pytest-cov
pytest --cov=mypkg --cov-report=term-missing
```

`--cov=mypkg`로 측정 대상 패키지를 지정하고, `--cov-report=term-missing`으로 누락 줄까지 콘솔에 출력한다. CI에서는 `--cov-fail-under=80`을 더해, 커버리지가 기준 아래로 떨어지면 빌드를 실패시키는 식으로 품질 기준을 강제하기도 한다.

## 라인 커버리지를 넘어: 브랜치 커버리지

기본 라인 커버리지에는 함정이 있다. `if` 문이 있는 줄이 실행됐다고 해서 **참과 거짓 두 분기를 모두** 거쳤다는 보장은 없다. 조건이 참인 경우만 테스트하면, `if` 줄은 "실행됨"으로 집계되지만 거짓 경로는 검증되지 않은 채 남는다. `--cov-branch`(또는 `coverage run --branch`)를 켜면 분기까지 따져, 더 정직한 숫자를 준다.

```bash
pytest --cov=mypkg --cov-branch --cov-report=term-missing
```

## 숫자에 속지 않기

커버리지에서 가장 중요한 것은 **숫자 자체가 목표가 아니라는 사실**이다. 100% 커버리지여도 `assert` 없이 그냥 함수를 호출만 한 테스트라면 아무것도 검증하지 못한다. 반대로 커버리지가 낮은 곳은 "테스트가 한 번도 건드리지 않은 위험 지대"라는 신호이므로 들여다볼 가치가 있다.

```python
# 커버리지는 100%지만 아무것도 검증하지 않는 나쁜 예
def test_grade():
    grade(80)          # 실행만 하고 결과를 확인하지 않음
    grade(40)
```

커버리지는 "여기는 아직 안전망이 없다"를 알려 주는 지도이지, 품질의 증명서가 아니다. 빠진 곳을 찾아 **의미 있는 검증**을 더하는 데 쓸 때 가장 유용하다. 다음 글에서는 여러 파이썬 버전과 환경에서 테스트를 자동으로 돌리는 **tox와 nox**를 살펴본다.

---

**지난 글:** [mock과 monkeypatch: 의존성을 가짜로 바꾸기](/posts/python-mock-monkeypatch/)

**다음 글:** [tox와 nox: 여러 환경에서 자동으로 테스트하기](/posts/python-tox-nox/)

<br>
읽어주셔서 감사합니다. 😊
