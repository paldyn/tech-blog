---
title: "Python의 역사 — 탄생부터 현재까지"
description: "1989년 귀도 반 로섬이 크리스마스 연휴에 시작한 Python이 어떻게 세계에서 가장 인기 있는 언어가 됐는지 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["Python", "역사", "귀도 반 로섬", "Python 3"]
featured: false
draft: false
---

[지난 글](/posts/python-what-is-python/)에서 Python이 어떤 언어인지 살펴봤습니다. 이번에는 그 언어가 어떻게 탄생하고 발전해 왔는지 역사를 따라가 봅니다. 언어의 역사를 알면 설계 결정의 이유와 버전 간 차이가 훨씬 명확하게 이해됩니다.

## 1989년 — 크리스마스 프로젝트

Python의 탄생은 우연에 가깝습니다. 네덜란드 프로그래머 **귀도 반 로섬(Guido van Rossum)**은 1989년 크리스마스 연휴 동안 취미 삼아 새로운 언어를 만들기 시작했습니다. 당시 그가 일하던 CWI(네덜란드 수학·컴퓨터 과학 연구소)에서 ABC 언어 프로젝트에 참여했던 경험이 직접적인 영감이 됐습니다.

ABC는 교육용 언어로 읽기 쉬운 문법을 목표로 했지만 확장성이 부족했습니다. 귀도는 ABC의 장점을 취하면서 운영체제와 더 잘 연동되고, 확장 모듈을 쉽게 작성할 수 있는 언어를 구상했습니다. 언어 이름은 그가 좋아하던 영국 코미디 그룹 **Monty Python's Flying Circus**에서 따왔습니다.

## 1991년 — 최초 공개

1991년 Python 0.9.0이 Usenet 뉴스그룹에 공개되었습니다. 이 버전에는 이미 클래스, 예외 처리, 핵심 자료구조(list, dict)가 포함되어 있었습니다. 귀도는 개발을 혼자 시작했지만 공개 직후 빠르게 커뮤니티가 형성됐습니다.

![Python 역사 타임라인](/assets/posts/python-history-timeline.svg)

## 1994년 — Python 1.0

Python 1.0에는 함수형 프로그래밍 도구인 `lambda`, `map`, `filter`, `reduce`가 추가됐습니다. 이 시점부터 Python은 단순한 스크립트 언어를 넘어 범용 언어로 자리 잡기 시작했습니다.

```python
# Python 1.0 시대의 코드 (지금도 동작)
squares = list(map(lambda x: x**2, [1, 2, 3, 4, 5]))
print(squares)  # [1, 4, 9, 16, 25]
```

## 2000년 — Python 2.0과 커뮤니티 전환

Python 2.0은 **리스트 컴프리헨션**과 **가비지 컬렉터(garbage collector)**를 도입했습니다. 동시에 개발 방식도 바뀌어 PEP(Python Enhancement Proposal) 프로세스가 공식화됐습니다. 새 기능을 추가하려면 공개적으로 제안서를 작성하고 커뮤니티 리뷰를 거치는 방식입니다.

Python 2는 이후 10년 넘게 산업 표준으로 쓰였고, Django, NumPy 등 주요 생태계가 이 기반 위에 자랐습니다.

## 2008년 — Python 3.0과 분열

2008년 발표된 Python 3.0은 역사적으로 가장 논쟁적인 릴리즈입니다. Python 2와의 **하위 호환성을 의도적으로 포기**하고 언어의 여러 일관성 문제를 한꺼번에 해결했습니다.

핵심 변경 사항:
- `print` 문이 `print()` 함수로 변경
- `str`이 기본적으로 유니코드 처리
- `//` 정수 나눗셈 명시적 구분
- 많은 함수가 리스트 대신 이터레이터 반환

```python
# Python 2 vs Python 3
# Python 2: print "hello"
# Python 3:
print("hello")

# Python 2: 3/2 == 1
# Python 3: 3/2 == 1.5, 3//2 == 1
print(3 / 2)   # 1.5
print(3 // 2)  # 1
```

이로 인해 2008년부터 2015년까지 Python 2와 3가 공존하는 긴 과도기가 이어졌습니다.

## 2020년 — Python 2의 종료

2020년 1월 1일, Python 2의 공식 지원이 종료됐습니다. 거의 12년 동안 이어진 마이그레이션이 마무리된 것입니다. 이제 모든 주요 라이브러리가 Python 3 전용으로 전환됐고, 새 프로젝트에서 Python 2를 쓸 이유는 없습니다.

## Python 3의 진화

![Python 3 버전별 마일스톤](/assets/posts/python-history-versions.svg)

Python 3 출시 이후에도 언어는 계속 발전했습니다.

- **3.5**: `async/await` 문법으로 비동기 프로그래밍 표준화
- **3.6**: f-string 도입으로 문자열 포매팅 혁신
- **3.8**: 바다코끼리 연산자(`:=`) 추가
- **3.10**: `match/case` 패턴 매칭 도입
- **3.11**: 인터프리터 속도 25% 개선
- **3.13**: 실험적 JIT 컴파일러, 선택적 GIL 해제(free-threaded 모드)

## BDFL과 운영 체계

귀도 반 로섬은 2018년까지 **BDFL(Benevolent Dictator For Life, 자비로운 종신 독재자)**이라는 비공식 직함으로 Python을 이끌었습니다. 2018년 PEP 572(왈러스 연산자) 논쟁 이후 그는 BDFL 자리에서 물러났고, 이후 Python은 선출된 5명의 운영 위원회가 이끌고 있습니다.

## 정리

Python은 1989년 한 프로그래머의 크리스마스 프로젝트로 시작해, 오늘날 세계에서 가장 많이 쓰이는 언어 중 하나로 성장했습니다. 2에서 3으로의 험난한 전환을 거쳐 이제 Python 3가 확고한 표준이 됐습니다. 다음 글에서는 Python 2와 3의 실질적인 차이점을 코드 수준에서 비교해 봅니다.

---

**지난 글:** [Python이란 무엇인가? — 언어의 본질과 설계 철학](/posts/python-what-is-python/)

**다음 글:** [Python 2 vs 3 — 무엇이 얼마나 달라졌나](/posts/python-2-vs-3/)

<br>
읽어주셔서 감사합니다. 😊
