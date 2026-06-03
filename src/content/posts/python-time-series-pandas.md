---
title: "pandas 시계열: 날짜 인덱스와 리샘플링"
description: "pandas로 시계열 데이터를 다루는 기본기. DatetimeIndex로 날짜 기반 슬라이싱을 열고, resample로 시간 단위를 바꾸고, rolling으로 이동평균을 구하는 흐름을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["pandas", "시계열", "resample", "데이터분석", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-csv-large-files/)에서 큰 데이터를 메모리 안에 욱여넣지 않고 다루는 법을 봤다면, 이번엔 데이터에 **시간**이라는 축이 더해질 때의 이야기다. 매출, 센서 측정값, 주가, 로그 — 현실 데이터의 상당수는 시간을 따라 기록된다. pandas는 이런 시계열을 위한 강력한 기능을 갖추고 있는데, 그 모든 것의 출발점은 날짜를 그냥 컬럼이 아니라 **인덱스**로 올리는 것이다.

## 먼저 날짜를 진짜 날짜로

CSV에서 읽은 날짜는 대개 `"2026-01-01"` 같은 문자열이다. 문자열 상태로는 날짜끼리 빼거나, 특정 달만 잘라 보는 일이 안 된다. 먼저 `to_datetime`으로 진짜 날짜 타입(datetime64)으로 바꾸고, 그 컬럼을 인덱스로 올린다.

![날짜를 인덱스로 — DatetimeIndex](/assets/posts/python-time-series-pandas-datetimeindex.svg)

```python
import pandas as pd

df = pd.read_csv("sales.csv")
df["date"] = pd.to_datetime(df["date"])   # 문자열 → datetime64
df = df.set_index("date")                  # 날짜를 인덱스로
df = df.sort_index()                       # 시간순 정렬
```

읽을 때 한 번에 처리할 수도 있다. `pd.read_csv("sales.csv", parse_dates=["date"], index_col="date")`면 위 과정을 한 줄로 끝낸다. 인덱스가 `DatetimeIndex`가 되는 순간, 시계열 전용 기능들이 전부 열린다.

## 날짜로 자르기: 부분 문자열 인덱싱

`DatetimeIndex`의 첫 번째 선물은 직관적인 슬라이싱이다. 날짜를 문자열로 적어 그 기간만 골라낼 수 있다.

```python
df.loc["2026-01"]              # 2026년 1월 전체
df.loc["2026-01-01":"2026-01-07"]   # 첫 주
df.loc["2026"]                 # 2026년 전체
```

`"2026-01"`처럼 부분만 적어도 pandas가 "그 달 전체"로 알아듣는다. 날짜를 손으로 비교하는 조건문을 쓸 필요 없이, 원하는 기간을 자연스럽게 잘라 낸다.

## resample: 시간 단위를 바꾸기

시계열에서 가장 자주 쓰는 것이 `resample`이다. groupby의 시간 버전이라고 보면 된다. 일별 데이터를 월별 합계로 묶거나, 분 단위를 시간 단위로 줄이는 식으로 **시간 단위를 다시 정한다.**

![resample: 시간 단위로 다시 묶기](/assets/posts/python-time-series-pandas-resample.svg)

```python
df.resample("M").sum()      # 월별 합계 (다운샘플링)
df.resample("W").mean()     # 주별 평균
df.resample("D").asfreq()   # 일 단위로 맞추기 (빈 날은 NaN)
```

`"M"`은 월, `"W"`는 주, `"D"`는 일이다. 잘게 쪼개진 데이터를 더 큰 단위로 요약하는 것을 다운샘플링이라 하고, 위 예가 거기 해당한다. 반대로 더 잘게 쪼개면 빈 구간이 생기므로 채우기 전략(`ffill` 등)이 함께 필요하다.

## rolling: 이동평균으로 추세 보기

날짜별 값은 들쭉날쭉해서 추세가 잘 안 보인다. 이럴 때 일정 구간의 평균을 미끄러뜨리며 계산하는 **이동평균(rolling)** 이 노이즈를 부드럽게 깎아 추세를 드러낸다.

```python
df["ma7"] = df["value"].rolling(7).mean()    # 7일 이동평균
df["ma30"] = df["value"].rolling(30).mean()  # 30일 이동평균
```

`rolling(7)`은 "현재와 직전 6개"를 묶은 창(window)으로, 그 평균을 매 시점마다 구한다. 주가 차트의 이동평균선이 바로 이것이다. 단기·장기 이동평균을 함께 그리면 추세 전환을 가늠하기 좋다.

## 시간 차이와 이동

날짜 인덱스는 시점 간 변화를 계산하기도 쉽게 만든다. 전날 대비 증감 같은 계산은 `diff`와 `shift`로 한다.

```python
df["change"] = df["value"].diff()        # 직전 값과의 차이
df["pct"] = df["value"].pct_change()     # 증감률
df["prev"] = df["value"].shift(1)        # 한 칸 뒤로 민 값
```

`shift`는 데이터를 시간축으로 밀어, "어제 값"을 오늘 행에 가져다 둔다. 이를 이용하면 전일 대비, 전주 대비 같은 비교를 벡터화된 한 줄로 끝낼 수 있다.

여기까지가 데이터 분석 묶음의 마무리다. NumPy 배열에서 출발해 pandas로 표를 다루고, groupby와 merge로 집계·결합하고, matplotlib과 Jupyter로 들여다보고, scikit-learn으로 예측하고, 정제와 대용량 처리, 그리고 시계열까지 왔다. 시계열의 핵심은 늘 같다. 날짜를 인덱스로 올리고, `resample`로 단위를 바꾸고, `rolling`으로 추세를 보는 것이다. 이 도구들을 손에 익히면, 시간이 흐르는 데이터에서 의미 있는 흐름을 읽어 낼 수 있다.

---

**지난 글:** [대용량 CSV: 메모리 안에서 다 읽지 않기](/posts/python-csv-large-files/)

<br>
읽어주셔서 감사합니다. 😊
