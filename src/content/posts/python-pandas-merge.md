---
title: "pandas merge: 표를 키로 이어 붙이기"
description: "pandas merge로 서로 다른 두 DataFrame을 공통 키로 결합하는 법. inner·left·right·outer 조인의 차이, on과 how 인자, concat과의 차이까지 그림과 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["pandas", "merge", "join", "데이터분석", "파이썬"]
featured: false
draft: false
---

[지난 글](/posts/python-pandas-groupby/)에서 한 표를 그룹으로 묶어 요약했다면, 현실에서는 데이터가 한 표에 다 들어 있는 경우가 오히려 드물다. 주문 정보는 주문 테이블에, 회원 이름은 회원 테이블에 따로 있다. 분석을 하려면 이 둘을 공통 키로 이어 붙여야 한다. 데이터베이스의 JOIN에 해당하는 작업을, pandas에서는 `merge`가 담당한다.

## merge는 공통 키로 행을 짝짓는다

`merge`의 기본 발상은 단순하다. 두 표에 공통으로 존재하는 컬럼(키)을 기준으로, 같은 키 값을 가진 행끼리 옆으로 붙인다. 주문 표의 `user_id`와 회원 표의 `user_id`가 같은 행을 찾아 하나의 넓은 행으로 합치는 식이다.

![공통 키로 두 표를 잇기](/assets/posts/python-pandas-merge-on-key.svg)

```python
import pandas as pd

orders = pd.DataFrame({"user_id": [1, 2], "amount": [100, 250]})
users  = pd.DataFrame({"user_id": [1, 2], "name": ["Ana", "Bo"]})

pd.merge(orders, users, on="user_id")
#    user_id  amount name
# 0        1     100  Ana
# 1        2     250   Bo
```

`on="user_id"`는 어느 컬럼을 키로 쓸지 지정한다. 양쪽 컬럼 이름이 다르면 `left_on`, `right_on`으로 따로 지정한다. `df.merge(other, ...)`처럼 메서드로 호출해도 결과는 같다.

## how가 결정하는 것: 어떤 행을 남길까

merge에서 가장 중요한 인자는 `how`다. 한쪽에만 있고 다른 쪽엔 없는 키를 어떻게 처리할지를 정한다. 네 가지 방식이 있고, 집합의 교집합·합집합으로 이해하면 외우기 쉽다.

![how= 에 따라 남는 행이 달라진다](/assets/posts/python-pandas-merge-join-types.svg)

- **inner**(기본값): 양쪽에 모두 있는 키만 남긴다. 교집합.
- **left**: 왼쪽 표의 모든 행을 유지하고, 오른쪽에서 매칭되는 값을 붙인다. 매칭이 없으면 그 칸은 `NaN`.
- **right**: 반대로 오른쪽 표를 모두 유지한다.
- **outer**: 양쪽의 모든 키를 남긴다. 합집합.

```python
pd.merge(orders, users, on="user_id", how="left")
```

실무에서 가장 자주 쓰는 것은 `left`다. "기준이 되는 표(주문)는 한 행도 잃지 않으면서, 부가 정보(회원 이름)만 가져다 붙이고 싶다"는 요구가 흔하기 때문이다. 매칭되지 않은 행이 조용히 사라지는 `inner`와 달리, `left`는 원본 행 수를 보존한다.

## merge 후 행이 늘었다면: 중복 키를 의심하라

merge에서 가장 흔한 함정은 **한쪽 키에 중복이 있을 때 행이 곱으로 불어나는 것**이다. 회원 표에 같은 `user_id`가 두 줄 있으면, 주문 한 건이 두 줄로 복제된다. merge 전후로 행 개수를 확인하는 습관이 좋다.

```python
before = len(orders)
merged = orders.merge(users, on="user_id", how="left")
assert len(merged) == before   # 행이 늘었다면 키 중복을 의심
```

`validate="m:1"` 같은 인자를 주면 "다대일 관계가 맞는지"를 pandas가 검사해 주고, 위반 시 에러를 던진다. 데이터 무결성이 중요할 때 유용하다.

## merge vs concat

표를 합치는 또 다른 함수로 `concat`이 있다. 둘은 방향이 다르다. `merge`는 **키를 맞춰 옆으로(컬럼 방향)** 붙이는 반면, `concat`은 보통 **위아래로(행 방향)** 단순히 쌓는다. 같은 구조의 표 여러 개를 이어 붙일 때는 `concat`, 키 관계로 정보를 결합할 때는 `merge`를 쓴다.

```python
# 같은 컬럼 구조의 여러 표를 세로로 쌓기
all_months = pd.concat([jan, feb, mar], ignore_index=True)
```

merge는 데이터 분석에서 빠질 수 없는 연결 고리다. 키를 맞춰 짝짓고, `how`로 어느 행을 남길지 정하고, 행 수가 의도대로인지 확인한다. 이 흐름만 몸에 익히면 흩어진 표들을 자유롭게 하나로 모을 수 있다. 다음 글에서는 이렇게 정리한 데이터를 눈으로 확인하는 첫걸음, matplotlib을 다룬다.

---

**지난 글:** [pandas groupby: 나누고 적용하고 합치기](/posts/python-pandas-groupby/)

**다음 글:** [matplotlib 기초: 첫 그래프 그리기](/posts/python-matplotlib-basics/)

<br>
읽어주셔서 감사합니다. 😊
