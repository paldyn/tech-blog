---
title: "pandas DataFrame: 표 데이터의 기본 단위"
description: "pandas의 핵심 자료구조 DataFrame이 무엇인지, 인덱스와 컬럼(Series)으로 어떻게 구성되는지, 그리고 컬럼 선택과 loc·iloc로 데이터를 골라내는 기본기를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["pandas", "DataFrame", "Series", "데이터분석", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-numpy-basics/)에서 본 NumPy 배열은 숫자 계산에는 강하지만, 한 가지가 아쉽다. "3번째 열이 나이"라는 걸 사람이 외우고 있어야 한다는 점이다. 현실의 데이터는 엑셀 시트처럼 열마다 이름이 있고, 행마다 의미가 있다. pandas의 `DataFrame`은 NumPy 배열에 바로 그 **이름표**를 붙여, 데이터를 표처럼 직관적으로 다루게 해 준다. 데이터 분석 코드에서 가장 자주 보게 될 객체이기도 하다.

## DataFrame은 라벨이 붙은 2차원 표

`DataFrame`은 행과 열로 이루어진 2차원 표인데, 핵심은 **행에는 index, 열에는 column 이름이라는 라벨이 붙어 있다**는 것이다. 각 열은 그 자체로 `Series`라는 1차원 자료구조이고, DataFrame은 이 Series들을 같은 index로 묶은 묶음이라고 보면 된다.

![DataFrame = 인덱스 + 컬럼(Series)](/assets/posts/python-pandas-dataframe-anatomy.svg)

```python
import pandas as pd

df = pd.DataFrame({
    "name": ["Ana", "Bo", "Cho"],
    "age":  [30, 25, 41],
    "city": ["Seoul", "Busan", "Daegu"],
})

df.shape      # (3, 3)
df.columns    # Index(['name', 'age', 'city'], ...)
df.dtypes     # name: object, age: int64, city: object
```

NumPy 배열과 달리 **컬럼마다 dtype이 다를 수 있다.** `name`은 문자열(object), `age`는 정수다. 이것이 현실 데이터에 잘 맞는 이유다. 한 표 안에 이름·나이·도시가 자연스럽게 공존한다.

## 먼저 데이터를 들여다보기

분석을 시작하면 가장 먼저 하는 일은 데이터를 훑어보는 것이다. pandas는 이를 위한 메서드를 잘 갖춰 두었다.

```python
df.head()         # 앞 5행
df.tail(3)        # 뒤 3행
df.info()         # 컬럼·dtype·결측치 개수 요약
df.describe()     # 숫자 컬럼의 통계 (평균·표준편차 등)
```

`info()`는 컬럼별 비결측 개수와 dtype을 한눈에 보여 줘서, 데이터를 받자마자 가장 먼저 호출하게 되는 메서드다. `describe()`는 숫자 컬럼의 분포를 빠르게 감 잡게 해 준다.

## 컬럼 선택과 행 선택

데이터를 골라내는 방법은 "무엇을 기준으로 고르느냐"에 따라 갈린다. 컬럼은 이름으로, 행은 라벨(`loc`)이나 정수 위치(`iloc`)로 선택한다.

![선택: 무엇을 고르느냐로 갈린다](/assets/posts/python-pandas-dataframe-select.svg)

```python
df["age"]                 # 컬럼 하나 → Series
df[["name", "age"]]       # 여러 컬럼 → DataFrame

df.loc[0, "age"]          # index 0, age 컬럼 (라벨 기반)
df.iloc[0, 1]             # 0번째 행, 1번째 열 (위치 기반)

df.loc[df["age"] > 28]    # age가 28 초과인 행만
```

가장 자주 혼동하는 지점이 `loc`와 `iloc`다. **`loc`는 라벨(이름표)로, `iloc`는 정수 위치(순번)로** 선택한다. index가 0, 1, 2처럼 정수일 때는 둘이 비슷해 보이지만, index를 날짜나 이름으로 바꾸는 순간 차이가 분명해진다. `loc`는 그 라벨을 그대로 쓰고, `iloc`는 여전히 "몇 번째냐"를 본다.

## 새 컬럼 만들기

기존 컬럼으로 새 컬럼을 만드는 일도 흔하다. 벡터화 덕분에 루프 없이 한 줄로 끝난다.

```python
df["age_next"] = df["age"] + 1
df["is_adult"] = df["age"] >= 20
```

`df["age"] + 1`은 age 컬럼 전체에 1을 더한 새 Series를 만들고, 그것을 새 컬럼으로 붙인다. 바로 NumPy에서 본 벡터화가 pandas에서도 그대로 작동하는 것이다.

DataFrame은 결국 "라벨이 붙은 표"라는 한 문장으로 요약된다. 행은 index로, 열은 이름으로 식별하고, 각 열은 dtype을 가진 Series다. 이 구조를 손에 익히면 데이터를 고르고, 거르고, 새 컬럼을 만드는 일이 자연스러워진다. 다음 글에서는 이 표를 특정 기준으로 묶어 집계하는 `groupby`를 다룬다.

---

**지난 글:** [NumPy 기초: ndarray와 벡터화 연산](/posts/python-numpy-basics/)

**다음 글:** [pandas groupby: 나누고 적용하고 합치기](/posts/python-pandas-groupby/)

<br>
읽어주셔서 감사합니다. 😊
