---
title: "Python의 역사: Guido van Rossum부터 현재까지"
description: "Python이 어떻게 탄생하고 발전해 왔는지 역사를 정리합니다. ABC 언어의 영향, Python 3의 출현, TIOBE 1위까지의 여정을 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["Python", "역사", "GuidoVanRossum", "Python3", "버전"]
featured: false
draft: false
---

[지난 글](/posts/python-what-is-python/)에서 Python이 어떤 언어인지 개략적으로 살펴봤다. 언어를 더 깊이 이해하려면 그 언어가 왜 만들어졌는지, 어떤 고민으로 설계됐는지를 알 필요가 있다. Python의 역사는 단순한 연표가 아니라, 언어 설계 철학이 실제로 어떻게 형성되는지를 보여주는 이야기다.

## 시작: 크리스마스 휴가의 사이드 프로젝트

1989년 12월, 네덜란드 CWI(수학·컴퓨터 과학 연구소)의 연구원 **Guido van Rossum**은 크리스마스 연휴 기간 동안 개인 프로젝트를 시작했다. 목표는 당시 자신이 작업하던 **ABC 언어**의 후계자를 만드는 것이었다.

ABC 언어는 교육용으로 설계된 언어였다. 읽기 쉽고 배우기 쉬웠지만, 치명적인 단점이 있었다. 확장성이 없었다. 사용자가 직접 모듈을 추가하거나 OS 시스템 콜을 사용하기 어려웠다. Guido는 ABC의 장점(가독성, 간결함)을 유지하면서 확장성과 예외 처리를 갖춘 언어를 만들고 싶었다.

이름은 당시 BBC에서 방영하던 코미디 쇼 **Monty Python's Flying Circus**에서 따왔다. Python이라는 이름이 실제 뱀과 관계없다는 점은 잘 알려진 사실이다.

```python
# Guido의 초기 설계 철학: 읽기 쉬운 코드
# ABC에서 영향받은 들여쓰기 기반 블록 구조
numbers = [1, 2, 3, 4, 5]
for n in numbers:
    if n % 2 == 0:
        print(f"{n}은 짝수")
```

## Python 1.x: 공개와 성장 (1991~2000)

1991년 2월, Guido는 Python 0.9.0을 Usenet 뉴스그룹에 공개했다. 이미 초기 버전부터 클래스, 예외 처리, 함수, 리스트/딕셔너리 등 핵심 기능이 포함돼 있었다.

**1994년 Python 1.0** 출시 때는 `lambda`, `map()`, `filter()`, `reduce()` 같은 함수형 프로그래밍 도구가 추가됐다. 흥미롭게도 Guido는 나중에 이 기능들이 Python의 복잡성을 높인다며 Python 3에서 `reduce()`를 `functools`로 옮기기도 했다.

## Python 2.x: 주류가 되다 (2000~2020)

**2000년 Python 2.0** 출시는 Python 역사에서 중요한 전환점이었다. 이 버전에서 **리스트 컴프리헨션**이 도입됐고, 쓰레기 수집(garbage collection) 방식이 개선됐다. 개발 방식도 Sourceforge를 통한 오픈소스 커뮤니티 방식으로 전환됐다.

2008년까지 Python 2는 2.7 버전으로 발전하면서 폭넓은 사용자 기반을 확보했다. Django(2005), NumPy, SQLAlchemy 등 생태계를 구성하는 핵심 라이브러리들이 이 시기에 탄생했다.

![Python 주요 역사 타임라인](/assets/posts/python-history-timeline.svg)

## Python 3.0: 파괴적 혁신 (2008)

**2008년 Python 3.0**은 역사상 가장 논쟁적인 릴리스였다. Guido와 코어 팀은 Python 2의 설계 결함을 고치기 위해 **하위 호환성을 포기**하는 결단을 내렸다.

주요 변화는 다음과 같다.

```python
# Python 2 → Python 3 대표적 차이
# 1. print: 문(statement) → 함수(function)
print "hello"       # Python 2
print("hello")      # Python 3

# 2. 정수 나누기
5 / 2   # Python 2: 2  (정수 나누기)
5 / 2   # Python 3: 2.5 (실수 나누기)
5 // 2  # Python 3: 2  (명시적 정수 나누기)

# 3. str과 bytes 분리
"hello"   # Python 3: 유니코드 str
b"hello"  # Python 3: bytes (명시적 구분)
```

이 변화는 옳은 방향이었지만, 거대한 코드베이스를 가진 기업들의 마이그레이션에 수년이 걸렸다. Python 2와 3이 10년 넘게 공존하는 이례적인 상황이 벌어졌다. Python 2.7은 원래 2015년에 지원 종료 예정이었지만, 커뮤니티의 요청으로 2020년 1월 1일까지 연장됐다.

## Python 3의 성숙: 3.5에서 3.12까지

Python 3은 느린 시작 이후 빠르게 발전했다.

**3.5 (2015)**: `async`/`await` 문법이 도입됐다. 비동기 프로그래밍이 Python의 일급 기능이 됐다.

**3.6 (2016)**: **f-string**이 도입됐다. `f"Hello, {name}!"` 형태의 문자열 포매팅은 즉시 커뮤니티의 표준이 됐다.

**3.10 (2021)**: `match-case` 구문이 추가됐다. 구조적 패턴 매칭이 가능해졌고, 오류 메시지도 크게 개선됐다.

**3.11 (2022)**: CPython 인터프리터가 대규모로 최적화되어 평균 **25% 이상** 실행 속도가 향상됐다.

**3.12~3.13**: 추가 성능 향상과 함께 실험적인 GIL(전역 인터프리터 락) 제거 옵션이 도입됐다.

![Python 3.x 주요 버전 변화](/assets/posts/python-history-versions.svg)

## BDFL에서 커뮤니티로

Guido는 2018년, Python 3.8의 `walrus operator` 논쟁 이후 **BDFL(자비로운 종신 독재자)** 직위에서 사임했다. 이후 Python은 **5인으로 구성된 운영 위원회(Steering Council)** 방식으로 거버넌스가 바뀌었다. 언어의 미래를 특정 개인이 아닌 커뮤니티가 결정하는 구조가 됐다.

Guido는 현재 Microsoft에서 근무하며 Python 성능 개선 프로젝트에 기여하고 있다.

## 현재: TIOBE 1위

2023년 이후 Python은 **TIOBE 프로그래밍 언어 인기 지수** 1위를 유지하고 있다. AI/ML 분야의 폭발적 성장이 Python 수요를 더욱 높였다. TensorFlow, PyTorch, Hugging Face 등 AI 생태계의 사실상 표준이 모두 Python 기반이다.

이 역사는 언어 설계에서 중요한 교훈을 준다. 단기적 호환성보다 장기적으로 올바른 설계를 선택하는 것이 결국 더 큰 성공으로 이어질 수 있다는 것, 그리고 오픈소스 커뮤니티의 힘이 언어의 성장을 이끈다는 것이다.

---

**지난 글:** [Python이란 무엇인가: 언어의 핵심 개념 이해](/posts/python-what-is-python/)

**다음 글:** [CPython vs PyPy: Python 구현체의 세계](/posts/python-implementations-cpython-pypy/)

<br>
읽어주셔서 감사합니다. 😊
