---
title: "데이터 클리닝: 결측치와 이상치 다루기"
description: "pandas로 데이터를 정제하는 실전 흐름. 결측치를 제거·대치·표시하는 세 갈래 선택, 타입과 중복 처리, 이상치를 찾는 방법까지 분석 전 반드시 거치는 단계를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 8
type: "knowledge"
category: "Python"
tags: ["pandas", "데이터클리닝", "결측치", "전처리", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-scikit-learn-intro/)에서 모델 학습의 흐름을 봤지만, 현실의 데이터는 그렇게 깔끔하게 들어오지 않는다. 빈칸이 있고, 숫자여야 할 컬럼에 문자열이 섞여 있고, 같은 행이 두 번 들어와 있다. "쓰레기를 넣으면 쓰레기가 나온다"는 말처럼, 분석과 모델링의 품질은 그 앞단의 정제에서 거의 결정된다. 데이터 클리닝은 화려하지 않지만, 데이터 작업 시간의 가장 큰 몫을 차지하는 진짜 핵심이다.

## 먼저 데이터의 상태를 진단한다

정제의 첫걸음은 손대기 전에 **무엇이 문제인지 파악**하는 것이다. 어디에 결측이 있고, 타입은 맞는지, 중복은 없는지를 먼저 본다.

![정제는 단계의 연속이다](/assets/posts/python-data-cleaning-tips-pipeline.svg)

```python
df.info()              # 컬럼별 비결측 개수와 dtype
df.isna().sum()        # 컬럼별 결측치 개수
df.duplicated().sum()  # 중복 행 개수
df.describe()          # 숫자 컬럼의 분포 — 이상치 단서
```

`df.isna().sum()` 한 줄이면 어느 컬럼에 빈칸이 얼마나 있는지 한눈에 들어온다. 정제는 이 진단에서 출발한다. 무엇이 문제인지 알아야 어떻게 고칠지 정할 수 있다.

## 결측치: 제거·대치·표시 중 무엇인가

결측치(NaN) 처리는 데이터 클리닝에서 가장 자주 마주치는 결정이다. 정답은 하나가 아니라, **그 값이 왜 비었는지**에 달려 있다. 크게 세 갈래가 있다.

![결측치(NaN)에 대처하는 세 갈래](/assets/posts/python-data-cleaning-tips-missing.svg)

```python
df.dropna()                          # 결측 행 제거
df.dropna(subset=["age"])            # 특정 컬럼이 비면 제거

df["age"].fillna(df["age"].median()) # 중앙값으로 대치
df["city"].fillna("unknown")         # 범주형은 명시값으로

df["age_missing"] = df["age"].isna() # "결측이었음"을 별도 표시
```

- **제거**(`dropna`)는 가장 간단하지만 데이터가 줄어든다. 결측이 드물 때 적합하다.
- **대치**(`fillna`)는 평균·중앙값·0 등으로 채운다. 데이터 양은 보존되지만 분포가 인위적으로 왜곡될 수 있어, 평균보다는 이상치에 둔감한 **중앙값**이 흔히 안전하다.
- **표시**는 "이 값이 원래 비어 있었다"는 사실 자체가 정보일 때 쓴다. 결측 여부를 새 불리언 컬럼으로 남기고 값을 채운다.

어느 쪽이든, "왜 비었는가"를 먼저 묻는 것이 순서다. 측정이 누락된 것과, 애초에 해당 없음인 것은 다르게 다뤄야 한다.

## 타입과 중복 바로잡기

CSV에서 읽어 온 숫자가 문자열로 들어오는 일은 흔하다. 타입을 맞추고, 중복 행을 정리한다.

```python
df["price"] = pd.to_numeric(df["price"], errors="coerce")
df["date"] = pd.to_datetime(df["date"])

df = df.drop_duplicates()                     # 완전히 같은 행 제거
df = df.drop_duplicates(subset=["user_id"])   # 특정 키 기준 중복 제거
```

`pd.to_numeric(..., errors="coerce")`는 숫자로 못 바꾸는 값을 `NaN`으로 만들어, 잘못된 값을 결측치 처리 단계로 넘긴다. 문자열의 앞뒤 공백이나 대소문자 불일치도 흔한 문제라, `df["name"].str.strip().str.lower()`처럼 문자열 메서드로 정규화한다.

## 이상치: 분포에서 벗어난 값 찾기

나이가 200살, 가격이 음수 — 이런 이상치는 입력 오류이거나 특이 케이스다. 통계와 도메인 지식 둘 다로 걸러 낸다.

```python
# IQR(사분위 범위) 기반 간단한 이상치 탐지
q1, q3 = df["price"].quantile([0.25, 0.75])
iqr = q3 - q1
mask = (df["price"] < q1 - 1.5 * iqr) | (df["price"] > q3 + 1.5 * iqr)
outliers = df[mask]
```

다만 통계적으로 "벗어났다"고 해서 무조건 틀린 값은 아니다. 진짜 드문 사건일 수도 있다. 그래서 이상치는 자동으로 지우기보다, **먼저 들여다보고** 도메인 맥락에서 판단하는 것이 안전하다.

데이터 클리닝에는 정해진 정답이 없다. 진단하고, 결측을 어떻게 다룰지 정하고, 타입과 중복을 바로잡고, 이상치를 살피는 흐름을 반복할 뿐이다. 한 가지 습관만 기억하자. **원본은 보존하고, 각 단계를 새 변수로 받으며 되돌릴 수 있게** 진행하는 것이다. 다음 글에서는 메모리에 다 올릴 수 없을 만큼 큰 CSV를 다루는 법을 살펴본다.

---

**지난 글:** [scikit-learn 입문: fit과 predict의 흐름](/posts/python-scikit-learn-intro/)

**다음 글:** [대용량 CSV: 메모리 안에서 다 읽지 않기](/posts/python-csv-large-files/)

<br>
읽어주셔서 감사합니다. 😊
