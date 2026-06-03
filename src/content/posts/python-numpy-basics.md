---
title: "NumPy 기초: ndarray와 벡터화 연산"
description: "NumPy의 핵심 자료구조 ndarray가 파이썬 리스트와 무엇이 다른지, shape·dtype·ndim의 의미, 그리고 루프 없이 배열 전체를 한 번에 계산하는 벡터화의 원리를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 1
type: "knowledge"
category: "Python"
tags: ["NumPy", "ndarray", "벡터화", "데이터분석", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-icecream-debug/)에서 디버깅 출력을 깔끔하게 다루는 도구를 봤다면, 이제부터는 데이터를 본격적으로 다루는 도구들로 눈을 돌린다. 그 출발점은 거의 항상 NumPy다. pandas도, scikit-learn도, matplotlib도 속을 들여다보면 NumPy 배열 위에 지어져 있다. 그래서 데이터 분석의 첫 단추는 NumPy의 핵심 자료구조인 `ndarray`가 파이썬 리스트와 무엇이 다른지를 이해하는 것이다.

## 리스트로도 되는데 왜 배열인가

파이썬 리스트는 무엇이든 담는다. 정수, 문자열, 다른 리스트까지 한 리스트에 섞어 넣을 수 있다. 유연한 대신, 원소마다 타입이 제각각일 수 있어서 숫자 계산을 할 때는 매 원소마다 "이게 정수인가 실수인가"를 확인하며 파이썬 인터프리터가 한 칸씩 루프를 돈다. 데이터가 수백만 개라면 이 오버헤드가 그대로 시간으로 쌓인다.

`ndarray`는 정반대다. **배열 전체가 단 하나의 타입(dtype)을 공유하고, 메모리에 빈틈없이 연속으로 놓인다.** 덕분에 NumPy는 같은 연산을 파이썬 루프가 아니라 C로 짠 내부 루프에서 한 번에 처리한다.

![리스트 반복 vs 배열 벡터화](/assets/posts/python-numpy-basics-list-vs-array.svg)

```python
import numpy as np

data = [1, 2, 3, 4, 5]

# 리스트: 원소마다 파이썬 루프
result = [x * 2 for x in data]

# 배열: 곱셈 한 줄이 전체에 적용됨
arr = np.array(data)
result = arr * 2          # array([ 2,  4,  6,  8, 10])
```

`arr * 2`에는 보이는 루프가 없다. 이렇게 배열 전체에 연산을 한 번에 적용하는 방식을 **벡터화(vectorization)** 라고 부른다. 코드가 짧아지는 것은 덤이고, 본질적인 이득은 속도다. 원소 백만 개짜리 배열을 2배 하는 작업은 벡터화하면 파이썬 루프보다 수십 배 빠르다.

## ndarray를 이루는 세 속성

배열을 다룰 때 가장 자주 들여다보는 세 가지 속성이 있다. `shape`, `dtype`, `ndim`이다.

![ndarray의 세 가지 속성](/assets/posts/python-numpy-basics-ndarray-anatomy.svg)

```python
arr = np.array([[1, 2, 3],
                [4, 5, 6]])

arr.shape    # (2, 3)  — 2행 3열
arr.dtype    # dtype('int64')  — 원소 타입
arr.ndim     # 2  — 차원 수
arr.size     # 6  — 전체 원소 개수
```

`shape`는 각 차원의 크기를 튜플로 보여 준다. `(2, 3)`이면 2행 3열이다. `dtype`은 원소의 타입인데, 리스트와 달리 **배열 전체가 같은 dtype을 갖는다**는 점이 핵심이다. 정수 배열에 실수를 넣으면 배열 전체가 실수로 바뀐다. `ndim`은 차원 수로, 1차원 벡터면 1, 2차원 행렬이면 2다.

## 배열을 만드는 흔한 방법들

매번 리스트를 손으로 적어 변환할 필요는 없다. 자주 쓰는 생성 함수 몇 개만 알아도 대부분의 상황이 해결된다.

```python
np.zeros((2, 3))        # 0으로 채운 2x3
np.ones(5)              # 1로 채운 길이 5
np.arange(0, 10, 2)     # array([0, 2, 4, 6, 8])
np.linspace(0, 1, 5)    # 0~1을 5등분
np.random.rand(3, 3)    # 0~1 난수 3x3
```

`arange`는 파이썬 `range`의 배열 버전이고, `linspace`는 시작과 끝 사이를 균등하게 나눈다. 그래프의 x축 값을 만들 때 `linspace`를 자주 쓰게 된다.

## 인덱싱과 슬라이싱, 그리고 브로드캐스팅

배열은 리스트처럼 인덱싱·슬라이싱이 되지만, 차원이 늘면 콤마로 축을 구분한다. 또 조건을 직접 인덱스로 쓰는 불리언 인덱싱이 강력하다.

```python
arr = np.array([[1, 2, 3],
                [4, 5, 6]])

arr[0, 1]        # 2  — 0행 1열
arr[:, 0]        # array([1, 4])  — 첫 번째 열 전체
arr[arr > 3]     # array([4, 5, 6])  — 조건에 맞는 원소만
```

마지막으로, 크기가 다른 배열끼리 연산할 때 NumPy가 자동으로 모양을 맞춰 주는 **브로드캐스팅(broadcasting)** 이 있다. `arr + 10`처럼 스칼라를 더하면 그 10이 모든 원소에 퍼져서 더해진다. 이 규칙 덕분에 "행마다 평균을 빼기" 같은 작업도 루프 없이 한 줄로 끝난다.

NumPy의 진짜 힘은 이 작은 규칙들이 합쳐질 때 드러난다. 배열 하나에 타입을 통일하고, 연산을 벡터화하고, 모양이 다르면 브로드캐스팅으로 맞춘다. 이 세 가지가 pandas의 컬럼 연산부터 scikit-learn의 행렬 계산까지 전부를 떠받친다. 다음 글에서는 이 배열에 행·열 이름표를 붙여 표처럼 다루게 해 주는 pandas의 DataFrame을 살펴본다.

---

**지난 글:** [icecream: print 디버깅을 견딜 만하게](/posts/python-icecream-debug/)

**다음 글:** [pandas DataFrame: 표 데이터의 기본 단위](/posts/python-pandas-dataframe/)

<br>
읽어주셔서 감사합니다. 😊
