---
title: "Python의 탄생과 역사: Guido에서 3.12까지"
description: "Python이 어떻게 탄생했고 어떤 과정을 거쳐 오늘날의 모습이 되었는지 살펴봅니다. Guido van Rossum, ABC 언어, Python 1~3의 역사."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["Python", "역사", "Guido", "Python3", "CPython"]
featured: false
draft: false
---

[지난 글](/posts/python-what-is-python/)에서 Python이 인터프리터 기반 범용 언어라는 것을 살펴봤다. 그렇다면 이 언어는 어떻게 만들어졌을까? 어떤 문제를 해결하기 위해 탄생했고, 지금의 모습이 되기까지 어떤 굴곡을 겪었을까? Python의 역사는 단순한 기술 연대기가 아니라, 언어 설계에서 커뮤니티가 얼마나 중요한지, 그리고 하위 호환성을 깨는 결정이 얼마나 어려운지를 보여주는 이야기다.

## 탄생: 크리스마스 연휴의 실험

1989년 12월, 네덜란드 암스테르담에 있는 CWI(수학·컴퓨터과학 국립연구소)의 연구원 Guido van Rossum은 크리스마스 연휴를 맞았다. 그는 연휴 동안 "취미 프로젝트"로 새 프로그래밍 언어를 만들기로 했다. 그 결과물이 Python이다.

왜 새 언어를 만들었을까? Guido는 당시 ABC라는 교육용 언어 프로젝트에 참여하고 있었다. ABC는 코드 가독성과 사용자 친화성에서 탁월했지만, 심각한 한계가 있었다. OS에 직접 접근할 수 없었고, 확장 모듈을 추가하기 어려웠으며, 인터프리터가 독립형 배포판으로만 존재했다. Guido는 "ABC의 장점은 살리되 이 문제들을 해결한 언어"를 만들고 싶었다.

![Python의 탄생 배경](/assets/posts/python-history-origin.svg)

이름은 당시 Guido가 즐겨 보던 영국 코미디 쇼 "Monty Python's Flying Circus"에서 따왔다. 뱀(python)과는 관계없다. 짧고 기억하기 쉬운 이름이면서도, 언어의 특성처럼 재치 있고 유쾌한 느낌을 주길 원했다.

## Python 역사 타임라인

![Python 역사 타임라인](/assets/posts/python-history-timeline.svg)

### Python 0.9.0 ~ 1.x (1991~1994)

1991년 2월, Python 0.9.0이 alt.sources 뉴스그룹에 공개되었다. 첫 버전부터 클래스, 예외 처리, 함수, 핵심 자료형(`list`, `dict`, `str`)이 포함되어 있었다. ABC에서는 볼 수 없었던 모듈 시스템과 OS 접근 기능도 갖췄다.

1994년 Python 1.0이 출시되었다. 이 버전에서 `lambda`, `map()`, `filter()`, `reduce()`가 추가되었다. 함수형 프로그래밍 스타일을 지원하기 시작했다. 흥미로운 점은 Guido가 나중에 `lambda`와 `reduce()`를 추가한 것을 다소 후회했다는 발언을 남긴 것이다. 하지만 이미 사용자들이 많이 쓰고 있어서 제거하기 어려웠다.

```python
# Python 1.x에서도 이런 코드가 가능했다
numbers = [1, 2, 3, 4, 5]
evens = filter(lambda x: x % 2 == 0, numbers)
doubled = map(lambda x: x * 2, evens)
# [4, 8]
```

### Python 2.x (2000~2020)

2000년 Python 2.0이 출시되었다. 이 버전의 핵심 변화는 두 가지다.

첫째, **가비지 컬렉션(Garbage Collection)** 개선. 기존 레퍼런스 카운팅 방식에 순환 참조(circular reference) 탐지 기능이 추가되었다. `a.ref = b; b.ref = a` 같은 상황에서 메모리 누수가 발생하던 문제가 해결되었다.

둘째, **리스트 컴프리헨션(list comprehension)** 도입. 이제 파이썬다운 코드 작성의 핵심 문법이 된 그 기능이 2.0에서 처음 등장했다.

```python
# Python 2.0에서 등장한 리스트 컴프리헨션
squares = [x**2 for x in range(10)]
# [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
```

Python 2는 장기간(2000~2010) 사용되며 생태계가 크게 성장했다. Django, NumPy, pip 등 중요한 프로젝트들이 이 시기에 탄생했다.

### Python 3.0: 과감한 결단 (2008)

2008년 Python 3.0이 출시되었다. 이 버전의 핵심 목표는 "언어의 일관성과 완결성을 높이되, 과거의 설계 실수를 과감히 수정하는 것"이었다. 문제는 이 과정에서 **하위 호환성(backward compatibility)을 깼다**는 것이다.

Python 3은 Python 2 코드를 그대로 실행할 수 없었다. 주요 변경 사항은 다음과 같다.

- `print "hello"` → `print("hello")` (문 → 함수)
- `5 / 2 = 2` → `5 / 2 = 2.5` (정수 나누기 기본값 변경)
- 기본 문자열이 bytes → Unicode
- `raw_input()` → `input()`
- `range()`가 리스트 대신 이터레이터 반환

```python
# Python 2와 3의 print 차이
# Python 2: print "hello"    — 문(statement)
# Python 3: print("hello")  — 함수 호출

# Python 3에서의 나누기
print(5 / 2)   # → 2.5 (float)
print(5 // 2)  # → 2   (floor division)

# Python 3의 기본 문자열 = Unicode
s = "안녕하세요"
print(type(s))  # <class 'str'> — 기본이 유니코드
```

이 결정은 커뮤니티에 큰 혼란을 야기했다. 수많은 라이브러리와 코드가 Python 2로 작성되어 있었고, 모두 3으로 이식해야 했다. Python 2와 3이 **10년 이상 동시에 유지보수**되는 이례적인 상황이 발생했다.

### 긴 전환기 (2008~2020)

Python 3 초기에는 주요 라이브러리들이 지원하지 않아 실무에서 3을 쓰기 어려웠다. 개발자들은 `from __future__ import print_function`처럼 2와 3을 동시에 지원하는 코드를 작성하는 `python-future` 같은 도구를 썼다.

전환이 완전히 이루어진 계기는 **2020년 1월 1일 Python 2.7 EOL(End of Life)** 이었다. 공식 지원이 종료되자, 모든 주요 프레임워크와 라이브러리가 2.x 지원을 종료하고 3.x로 완전히 전환했다. NumPy, pandas, Django, Flask 모두 이 시점 이후로는 Python 3만 지원한다.

### 현대 Python 3 (2020~현재)

Python 3는 각 버전마다 눈에 띄는 개선이 이어지고 있다.

**Python 3.8 (2019)**: 바다코끼리 연산자(walrus operator) `:=` 도입.
```python
# := 는 조건문 안에서 값을 동시에 대입
while chunk := f.read(8192):
    process(chunk)
```

**Python 3.10 (2021)**: `match/case` 구조적 패턴 매칭 도입. 다른 언어의 switch문과 유사하지만 훨씬 강력하다.
```python
match command:
    case "quit":
        quit_game()
    case "go" | "move":
        move()
    case _:
        print("알 수 없는 명령")
```

**Python 3.11 (2022)**: 에러 메시지 대폭 개선, 실행 속도 약 10~60% 향상.

**Python 3.12 (2023)**: 타입 파라미터 문법 도입, 성능 추가 향상.

**Python 3.13 (2024)**: 실험적 GIL(Global Interpreter Lock) 비활성화 옵션 도입. 멀티코어 활용성 향상의 신호탄.

## BDFL과 Python의 거버넌스

Python의 역사에서 빠질 수 없는 것이 **Guido van Rossum의 역할**이다. 그는 "BDFL(Benevolent Dictator For Life, 자비로운 종신 독재자)"로 불렸다. 커뮤니티가 제안(PEP)을 작성하고 토론하지만, 최종 결정권은 Guido에게 있었다.

2018년, Python 3.8에 바다코끼리 연산자(`:=`)를 둘러싼 격렬한 논쟁 끝에 Guido는 BDFL 역할을 공식적으로 내려놓겠다고 선언했다. 이후 Python은 **5인의 Steering Council**이 운영하는 민주적 거버넌스 구조로 전환되었다.

Guido는 2020년에 Microsoft에 입사하여 CPython 개발에 계속 기여하고 있다.

## Python의 버전 확인

```python
import sys

print(sys.version)
# 3.12.3 (main, Apr  9 2024, 08:09:14) [GCC 13.2.0]

print(sys.version_info)
# sys.version_info(major=3, minor=12, micro=3, ...)

# 버전 체크 (3.10 이상인지)
if sys.version_info >= (3, 10):
    print("Python 3.10 이상")
```

터미널에서도 확인할 수 있다.

```bash
python --version
# Python 3.12.3
python3 --version
# Python 3.12.3
```

## Python의 설계 철학이 역사에 미친 영향

Python 역사에서 반복적으로 나타나는 주제가 있다. "지금 옳은 결정을 내려라, 과거의 실수를 그냥 지고 가지 마라." Python 3의 하위 비호환 변경은 커뮤니티에 엄청난 고통을 주었지만, 장기적으로 언어를 더 일관되고 올바르게 만들었다. `print`가 함수가 된 것, `range()`가 이터레이터가 된 것, 기본 문자열이 Unicode가 된 것 모두 올바른 방향이었다.

다음 편에서는 Python 2와 3의 차이를 코드로 직접 비교해본다. 마이그레이션 과정에서 무엇이 바뀌고 어떤 도구가 도움이 되는지 살펴볼 것이다.

---

**지난 글:** [Python이란 무엇인가? 언어의 본질을 파악하다](/posts/python-what-is-python/)

**다음 글:** [Python 2 vs 3: 왜 모두가 3으로 넘어왔는가](/posts/python-2-vs-3/)

<br>
읽어주셔서 감사합니다. 😊
