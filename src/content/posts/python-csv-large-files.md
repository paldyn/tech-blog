---
title: "대용량 CSV: 메모리 안에서 다 읽지 않기"
description: "RAM보다 큰 CSV를 다루는 pandas 기법. chunksize로 조각내 읽기, usecols와 dtype으로 메모리 줄이기, 그리고 Parquet 같은 대안까지 메모리 한계를 넘는 실전 전략을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["pandas", "CSV", "대용량", "메모리", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-data-cleaning-tips/)에서 데이터를 정제하는 흐름을 봤는데, 거기엔 한 가지 숨은 전제가 있었다. 데이터가 메모리에 다 들어간다는 것이다. 그런데 로그 파일이나 거래 내역처럼 수천만 행짜리 CSV를 만나면 `pd.read_csv()` 한 줄에서 곧장 `MemoryError`가 난다. 파일이 RAM보다 크기 때문이다. 이럴 때 필요한 것은 더 큰 컴퓨터가 아니라, **데이터를 통째로 올리지 않는 전략**이다.

## 왜 터지는가: 통째로 올리면 RAM을 다 쓴다

`pd.read_csv("big.csv")`는 파일 전체를 메모리로 읽어 하나의 DataFrame을 만든다. 게다가 CSV는 텍스트라, 파싱 과정에서 일시적으로 원본보다 더 많은 메모리를 쓰기도 한다. 디스크의 5GB 파일이 메모리에서는 그보다 커질 수 있다는 뜻이다.

![메모리 사용: 통째로 vs 조각으로](/assets/posts/python-csv-large-files-memory.svg)

해법의 핵심 아이디어는 단순하다. **전체를 한꺼번에 올리지 말고, 한 조각씩 읽어 처리하고 버린다.** 메모리에는 늘 한 조각만 머물게 한다.

## chunksize: 조각으로 흘려보내기

`read_csv`에 `chunksize`를 주면, DataFrame 하나가 아니라 조각을 차례로 내놓는 반복자(iterator)가 반환된다. `for`로 돌면서 한 조각씩 처리하면 된다.

![한 번에 다 읽지 말고, 조각으로](/assets/posts/python-csv-large-files-chunking.svg)

```python
import pandas as pd

total = 0
count = 0

# 10만 행씩 끊어서 읽는다
for chunk in pd.read_csv("big.csv", chunksize=100_000):
    total += chunk["amount"].sum()    # 조각의 부분합을 누적
    count += len(chunk)

mean = total / count
print(f"전체 평균: {mean}")
```

여기서 메모리에 상주하는 것은 언제나 10만 행짜리 한 조각뿐이다. 파일이 1억 행이든 10억 행이든 메모리 사용량은 일정하게 유지된다. 합계·평균·개수 같은 **누적 가능한 집계**는 이런 조각 처리와 잘 맞는다.

조각마다 필터링해서 모았다가 마지막에 합치는 패턴도 흔하다.

```python
parts = []
for chunk in pd.read_csv("big.csv", chunksize=100_000):
    parts.append(chunk[chunk["amount"] > 1000])   # 조건에 맞는 행만

result = pd.concat(parts, ignore_index=True)       # 걸러진 결과는 작다
```

원본은 거대해도 조건을 통과한 행은 작다면, 이렇게 필요한 부분만 모아 메모리에 담을 수 있다.

## 애초에 적게 읽기: usecols와 dtype

조각내기 전에, 읽는 양 자체를 줄이는 것도 강력하다. 대부분의 분석은 전체 컬럼이 아니라 **몇 개 컬럼만** 필요하다.

```python
df = pd.read_csv(
    "big.csv",
    usecols=["date", "user_id", "amount"],   # 필요한 컬럼만
    dtype={"user_id": "int32", "amount": "float32"},  # 더 작은 타입
)
```

`usecols`로 컬럼을 골라 읽으면 그만큼 메모리가 줄고, `dtype`을 명시하면 pandas가 기본으로 잡는 64비트 대신 더 작은 타입을 쓴다. 반복되는 문자열 컬럼이라면 `category` 타입이 메모리를 극적으로 줄여 준다. 이 두 가지만으로도 통째로 읽기가 가능해지는 경우가 많다.

## 더 나은 형식: CSV를 벗어나기

같은 데이터를 반복해서 다룬다면, 한 번은 CSV로 읽되 그 뒤로는 **Parquet** 같은 컬럼형 이진 형식으로 저장하는 것이 좋다.

```python
# 한 번만 변환해 두면
df.to_parquet("big.parquet")

# 이후엔 필요한 컬럼만 빠르게, 작게 읽는다
df = pd.read_parquet("big.parquet", columns=["date", "amount"])
```

Parquet은 컬럼 단위로 저장하고 압축까지 되어, 같은 데이터를 더 작은 용량과 더 빠른 속도로 읽는다. 데이터가 정말 메모리를 한참 넘어선다면, 조각 처리를 알아서 해 주는 Polars나 Dask 같은 도구로 넘어가는 것도 방법이다.

대용량 CSV의 핵심은 "전부 올리지 않는다"는 한 문장이다. `chunksize`로 흘려보내고, `usecols`와 `dtype`으로 읽는 양을 줄이고, 반복 작업이라면 Parquet으로 갈아탄다. 데이터 크기가 RAM을 넘어도 분석을 이어 갈 수 있다. 다음 글에서는 데이터에 날짜라는 축이 더해질 때 강력해지는 pandas 시계열 기능을 다룬다.

---

**지난 글:** [데이터 클리닝: 결측치와 이상치 다루기](/posts/python-data-cleaning-tips/)

**다음 글:** [pandas 시계열: 날짜 인덱스와 리샘플링](/posts/python-time-series-pandas/)

<br>
읽어주셔서 감사합니다. 😊
