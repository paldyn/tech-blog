---
title: "pandas groupby: 나누고 적용하고 합치기"
description: "pandas groupby의 핵심 개념인 split-apply-combine을 그림으로 이해하고, 단일 집계부터 agg로 여러 통계를 동시에 구하는 법, transform과의 차이까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["pandas", "groupby", "집계", "데이터분석", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-pandas-dataframe/)에서 DataFrame으로 표를 다루는 기본기를 익혔다면, 실전에서 가장 자주 던지는 질문은 "그룹별로 어떻게 되는가"다. 도시별 평균 매출, 부서별 인원 수, 카테고리별 합계 — 이런 요약은 거의 전부 `groupby`로 풀린다. groupby는 처음엔 마법처럼 느껴지지만, 그 속은 **나누고(split), 적용하고(apply), 합치는(combine)** 세 단계의 단순한 반복이다.

## split-apply-combine, 한 문장으로 끝나는 세 단계

groupby의 작동 원리를 한 번 그림으로 보면 이후로는 헷갈릴 일이 없다. 데이터를 기준 컬럼(key)에 따라 그룹으로 **나누고**, 각 그룹에 집계 함수를 **적용하고**, 그 결과를 다시 하나의 표로 **합친다.**

![split → apply → combine](/assets/posts/python-pandas-groupby-split-apply-combine.svg)

직접 코드로 이 세 단계를 짜려면 그룹마다 행을 모으고, 평균을 내고, 결과를 모으는 루프를 써야 한다. groupby는 그걸 한 줄로 압축한다.

```python
import pandas as pd

df = pd.DataFrame({
    "city": ["Seoul", "Seoul", "Busan", "Busan", "Seoul"],
    "sales": [100, 200, 80, 120, 150],
})

df.groupby("city")["sales"].mean()
# city
# Busan    100.0
# Seoul    150.0
```

`groupby("city")`가 split, `["sales"]`로 대상 컬럼을 고르고, `.mean()`이 apply, 결과 Series가 combine이다. 결과의 index가 그룹 키(city)가 된다는 점도 기억해 두자.

## 여러 통계를 한 번에: agg

평균 하나만 필요한 경우는 드물다. 합계도, 개수도, 최댓값도 같이 보고 싶을 때 `.agg()`를 쓴다. 결과 컬럼의 이름까지 지정할 수 있어서 깔끔하다.

![하나의 함수 vs 여러 집계](/assets/posts/python-pandas-groupby-agg.svg)

```python
df.groupby("city").agg(
    total=("sales", "sum"),
    avg=("sales", "mean"),
    n=("sales", "count"),
)
#        total   avg  n
# Busan    200   100  2
# Seoul    450   150  3
```

`이름=(컬럼, 함수)` 형태를 named aggregation이라고 부른다. 어떤 컬럼에 어떤 함수를 적용해 어떤 이름으로 받을지를 한 줄에 담을 수 있어, 결과가 읽기 좋은 표로 바로 나온다.

## 그룹별 결과를 원래 행에 되돌리기: transform

`agg`는 그룹당 한 줄로 **줄여서** 돌려준다. 반대로, 그룹별 평균을 구하되 **원래 행 개수를 그대로 유지**하고 싶을 때가 있다. 예를 들어 "각 행의 매출이 그 도시 평균보다 높은가"를 계산하려면 행마다 자기 그룹의 평균이 필요하다. 이럴 때 `transform`을 쓴다.

```python
df["city_avg"] = df.groupby("city")["sales"].transform("mean")
df["above_avg"] = df["sales"] > df["city_avg"]
```

`transform("mean")`은 그룹별 평균을 계산하되, 그 값을 **각 행에 다시 펼쳐서** 원래 길이의 Series로 돌려준다. 덕분에 그룹 통계를 원본 데이터에 새 컬럼으로 붙이는 일이 자연스럽다. `agg`는 줄이고 `transform`은 펼친다 — 이 차이만 잡으면 둘을 헷갈리지 않는다.

## 여러 키로 묶기

기준이 둘 이상일 때는 컬럼 이름을 리스트로 넘긴다.

```python
df.groupby(["city", "category"])["sales"].sum()
```

이러면 결과의 index가 (city, category) 조합인 멀티인덱스가 된다. `reset_index()`를 붙이면 다시 평범한 컬럼으로 펼쳐져, 이후 다루기 편한 DataFrame이 된다.

groupby는 데이터 분석에서 가장 자주 쓰는 도구 중 하나다. 핵심은 늘 같다. 기준으로 나누고, 함수를 적용하고, 결과를 합친다. 줄이고 싶으면 `agg`, 원래 행에 되돌리고 싶으면 `transform`이다. 다음 글에서는 서로 다른 두 표를 공통 키로 이어 붙이는 `merge`를 살펴본다.

---

**지난 글:** [pandas DataFrame: 표 데이터의 기본 단위](/posts/python-pandas-dataframe/)

**다음 글:** [pandas merge: 표를 키로 이어 붙이기](/posts/python-pandas-merge/)

<br>
읽어주셔서 감사합니다. 😊
