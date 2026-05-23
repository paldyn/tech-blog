---
title: "피처 스토어: 피처 재사용과 일관성 확보"
description: "피처 스토어의 아키텍처, 온라인·오프라인 저장소 분리, 학습-서빙 일관성 문제 해결, Feast 실전 가이드를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 7
type: "knowledge"
category: "AI"
tags: ["피처스토어", "Feast", "Tecton", "온라인피처", "오프라인피처", "학습서빙일관성", "MLOps"]
featured: false
draft: false
---

[지난 글](/posts/mlops-experiment-tracking/)에서 실험 트래킹으로 모델 재현성을 확보하는 방법을 다뤘다. 이번에는 데이터 측면에서 학습과 서빙 사이의 일관성을 보장하는 **피처 스토어**를 살펴본다.

---

## 피처 스토어가 필요한 이유

ML 시스템에서 가장 조용하고 치명적인 버그 중 하나는 **학습-서빙 스큐(Training-Serving Skew)**다. 학습할 때는 배치로 정제된 과거 데이터를 사용하고, 서빙할 때는 실시간으로 들어오는 원시 데이터를 변환해 피처를 만든다. 이 두 경로가 조금이라도 다르면 모델은 오프라인 평가에서 뛰어난 성능을 내지만 실제 서비스에서 전혀 다른 예측을 내놓는다.

### 학습-서빙 스큐의 원인

학습-서빙 스큐는 여러 지점에서 발생한다.

**데이터 소스 불일치**: 학습에는 BigQuery에서 집계한 값을 쓰고, 서빙에는 Python 코드로 직접 계산한 값을 쓰면, 타임존 처리나 NULL 처리 방식이 달라지는 순간 두 값은 달라진다.

**피처 계산 로직 중복**: 구매 빈도, 평균 주문 금액 같은 피처는 데이터 과학자 팀마다, 서비스 팀마다 각자 구현한다. 미묘한 구현 차이가 수개월 후 예측 편향으로 나타난다.

**시간 개념 혼동**: 학습 시에는 `event_timestamp` 기준으로 집계하지만, 서빙 시에는 현재 시간 기준으로 집계하면 미래 데이터가 누출(data leakage)된다.

### 피처 재사용 문제

팀이 커질수록 동일한 피처가 여러 곳에서 중복으로 계산된다. 추천 팀, 검색 팀, 리스크 팀이 각자 `user_30d_purchase_count`를 별도 파이프라인으로 계산한다면, 인프라 비용이 3배가 되고 일관성도 보장되지 않는다.

피처 스토어는 이 두 문제를 한 번에 해결한다. **피처를 한 번 정의하고, 어디서든 동일하게 조회한다.**

---

## 피처 스토어 아키텍처

![피처 스토어 아키텍처](/assets/posts/mlops-feature-store-arch.svg)

피처 스토어는 네 가지 핵심 컴포넌트로 구성된다.

### 1. 피처 레지스트리 (Feature Registry)

피처 레지스트리는 피처 스토어의 중추다. 모든 피처의 **메타데이터**, **계보(lineage)**, **버전**을 관리한다. "이 피처는 어떤 소스에서 왔는가?", "최근에 누가 수정했는가?", "어떤 모델들이 이 피처를 사용하는가?"에 답한다.

레지스트리 덕분에 팀은 이미 존재하는 피처를 검색해 재사용할 수 있다. 새 모델을 만들 때마다 피처를 처음부터 만들 필요가 없다.

### 2. 오프라인 스토어 (Offline Store)

오프라인 스토어는 **학습용 Historical 피처**를 저장한다. 수개월, 수년 치의 피처 값을 타임스탬프와 함께 저장하기 때문에 `point-in-time correct` 조회가 가능하다.

Point-in-time correct 조회란, 특정 시점의 엔티티 상태를 그 시점에서의 최신 피처 값으로 조회하는 것을 의미한다. 예를 들어 2025-01-10에 이뤄진 구매에 대해 학습 데이터를 만들 때, 2025-01-10 당시의 사용자 구매 빈도를 조회한다. 미래 값을 사용하지 않으므로 데이터 누출이 없다.

오프라인 스토어의 대표 기술: S3 + Parquet, BigQuery, Redshift, Delta Lake

### 3. 온라인 스토어 (Online Store)

온라인 스토어는 **서빙용 최신 피처**를 저장한다. 모델 추론 시점에 수 밀리초 안에 피처를 읽어야 하기 때문에 저지연 Key-Value 스토어를 사용한다.

피처 파이프라인이 주기적으로(또는 스트리밍으로) 최신 피처 값을 온라인 스토어에 적재(materialize)한다. 서빙 코드는 DB를 직접 집계하지 않고, 이미 계산된 피처를 읽기만 한다.

온라인 스토어의 대표 기술: Redis, DynamoDB, Cassandra, Bigtable

### 4. 피처 파이프라인 (Transform Layer)

원시 데이터를 피처로 변환하는 파이프라인이다. 배치 변환(Spark, dbt)과 스트리밍 변환(Flink, Beam) 모두 지원하며, 동일한 변환 로직이 오프라인과 온라인 양쪽에 적용된다. 이것이 학습-서빙 일관성의 핵심이다.

---

## 온라인/오프라인 분리 패턴

피처 스토어의 핵심 설계 결정은 온라인 스토어와 오프라인 스토어를 분리하는 것이다. 이 분리는 트레이드오프를 명시적으로 다룬다.

| 구분 | 오프라인 스토어 | 온라인 스토어 |
|------|-------------|-------------|
| 용도 | 모델 학습, 피처 분석 | 실시간 모델 추론 |
| 지연 | 수초~수분 | 수 밀리초 |
| 저장 비용 | 낮음 (콜드 스토리지) | 높음 (인메모리) |
| 데이터 범위 | 전체 히스토리 | 엔티티별 최신 값 |
| 쿼리 방식 | SQL, DataFrame | Key-Value 조회 |

**Materialization**: 오프라인 스토어의 데이터를 온라인 스토어로 동기화하는 과정이다. 배치 피처는 주기적으로(예: 매 1시간), 스트리밍 피처는 거의 실시간으로 Materialization된다.

```
오프라인 스토어 (S3/BigQuery)
    │
    │  feast materialize 또는 스트리밍 파이프라인
    ▼
온라인 스토어 (Redis/DynamoDB)
    │
    │  store.get_online_features()
    ▼
모델 서빙 (API 서버)
```

---

## Feast 실전 가이드

![Feast 피처 스토어 코드](/assets/posts/mlops-feature-store-feast.svg)

Feast(Feature Store)는 가장 널리 쓰이는 오픈소스 피처 스토어다. 클라우드 벤더에 종속되지 않고, Parquet 파일부터 BigQuery, Redshift까지 다양한 소스를 지원한다.

### 설치 및 초기화

```bash
pip install feast

# 새 Feast 리포지토리 초기화
feast init my_feature_repo
cd my_feature_repo
```

### 피처 정의

```python
from feast import (
    Entity, FeatureView, Field, FileSource
)
from feast.types import Float32, Int64

# 엔티티 정의
user = Entity(name="user_id", join_keys=["user_id"])

# 피처 소스
user_stats_source = FileSource(
    path="data/user_stats.parquet",
    timestamp_field="event_timestamp",
)

# 피처 뷰 정의
user_features = FeatureView(
    name="user_purchase_features",
    entities=[user],
    schema=[
        Field(name="purchase_count_30d", dtype=Int64),
        Field(name="avg_order_value",    dtype=Float32),
        Field(name="churn_probability",  dtype=Float32),
    ],
    source=user_stats_source,
    ttl=timedelta(days=1),
)
```

`FeatureView`는 피처 그룹의 단위다. `ttl`은 온라인 스토어에서 피처 값이 유효한 기간을 정의한다. TTL이 지난 값은 자동으로 만료된다.

### 적재 (Materialization)

```bash
# 오프라인 스토어에서 온라인 스토어로 피처 적재
feast materialize-incremental $(date -u +"%Y-%m-%dT%H:%M:%S")
```

증분 Materialization(`materialize-incremental`)은 마지막으로 적재된 시점 이후의 새 데이터만 처리하므로 효율적이다.

### 피처 조회

```python
from feast import FeatureStore

store = FeatureStore(repo_path=".")

# 오프라인: 학습용 과거 피처 조회
training_df = store.get_historical_features(
    entity_df=entity_df,  # user_id, event_timestamp
    features=[
        "user_purchase_features:purchase_count_30d",
        "user_purchase_features:avg_order_value",
    ],
).to_df()

# 온라인: 서빙용 최신 피처 조회
online_features = store.get_online_features(
    features=["user_purchase_features:churn_probability"],
    entity_rows=[{"user_id": 12345}],
).to_dict()
```

`get_historical_features()`는 `entity_df`의 각 행에 있는 `event_timestamp` 기준으로 Point-in-time correct 조회를 수행한다. 학습 데이터를 만들 때 미래 데이터 누출이 없다.

`get_online_features()`는 Redis 등 온라인 스토어에서 수 밀리초 안에 최신 피처를 읽는다. 서빙 코드에 집계 로직이 없고, 읽기만 한다.

### 피처 적용 패턴 (전체 흐름)

```python
import pandas as pd
from feast import FeatureStore
import mlflow

store = FeatureStore(repo_path=".")

# 1. 학습 데이터 준비
entity_df = pd.DataFrame({
    "user_id": [101, 202, 303, 404],
    "event_timestamp": pd.to_datetime([
        "2025-12-01", "2025-12-05", "2025-12-10", "2025-12-15"
    ]),
    "label": [1, 0, 1, 0],
})

training_df = store.get_historical_features(
    entity_df=entity_df,
    features=[
        "user_purchase_features:purchase_count_30d",
        "user_purchase_features:avg_order_value",
        "user_purchase_features:churn_probability",
    ],
).to_df()

# 2. 모델 학습
X = training_df[["purchase_count_30d", "avg_order_value", "churn_probability"]]
y = training_df["label"]

with mlflow.start_run():
    model = train_model(X, y)
    mlflow.sklearn.log_model(model, "model")

# 3. 서빙: 동일한 피처 이름으로 조회
def predict(user_id: int) -> float:
    features = store.get_online_features(
        features=[
            "user_purchase_features:purchase_count_30d",
            "user_purchase_features:avg_order_value",
            "user_purchase_features:churn_probability",
        ],
        entity_rows=[{"user_id": user_id}],
    ).to_dict()
    
    X_serve = [[
        features["purchase_count_30d"][0],
        features["avg_order_value"][0],
        features["churn_probability"][0],
    ]]
    return model.predict_proba(X_serve)[0][1]
```

학습과 서빙이 **동일한 피처 이름과 정의**를 사용하므로 스큐가 원천 차단된다.

---

## 상용 솔루션 비교

오픈소스 Feast 외에도 여러 관리형 피처 스토어가 있다.

### Feast vs Tecton vs Vertex Feature Store

| 항목 | Feast | Tecton | Vertex Feature Store |
|------|-------|--------|----------------------|
| 유형 | 오픈소스 | 상용 SaaS | Google Cloud 관리형 |
| 비용 | 무료 (인프라 별도) | 구독료 높음 | GCP 사용량 기반 |
| 스트리밍 지원 | 제한적 | 네이티브 지원 | 지원 |
| 온프레미스 | 가능 | 불가 | 불가 |
| UI/모니터링 | 기본 | 풍부 | GCP 콘솔 |
| 학습 곡선 | 낮음 | 중간 | 낮음 (GCP 친숙 시) |
| 추천 환경 | 스타트업, 멀티 클라우드 | 엔터프라이즈 | GCP 중심 팀 |

**Feast**: 가장 유연하고 벤더 독립적이다. AWS, GCP, Azure 어디서든 동일하게 동작한다. 단, 스트리밍 피처 지원이 아직 성숙하지 않았고, 운영 부담을 팀이 직접 진다.

**Tecton**: 엔터프라이즈급 기능(실시간 스트리밍 피처, 데이터 품질 모니터링, 역할 기반 접근 제어)을 제공한다. 구독료가 상당하지만 운영 부담이 거의 없다.

**Vertex Feature Store**: GCP 생태계(BigQuery, Vertex AI)와 긴밀하게 통합된다. GCP를 주 클라우드로 사용하는 팀에게 자연스러운 선택이다.

### 선택 기준

- 팀 규모가 작고 인프라 제어가 중요하다 → Feast
- 대규모 팀이고 실시간 피처가 핵심이다 → Tecton
- GCP를 이미 사용 중이다 → Vertex Feature Store
- Azure 환경이다 → Azure ML Feature Store

---

## 피처 스토어 도입 시 주의사항

**점진적 도입**: 기존 파이프라인을 한 번에 마이그레이션하려 하지 말고, 신규 피처부터 피처 스토어를 통해 관리한다.

**TTL 설계**: 온라인 스토어의 TTL이 너무 짧으면 서빙 시 빈 값(None)이 반환된다. 비즈니스 특성에 맞게 설계해야 한다. 구매 빈도 피처라면 30일 TTL이 적절하다.

**Materialization 지연**: 배치 Materialization은 주기적이므로, 온라인 스토어의 피처가 수 시간 지연될 수 있다. 이 지연이 모델 성능에 영향을 준다면 스트리밍 Materialization을 검토한다.

**피처 모니터링**: 피처 분포 변화(Feature Drift)를 지속적으로 모니터링한다. 피처 스토어를 도입하더라도 데이터 품질 감시는 별도로 필요하다.

---

피처 스토어는 단순한 도구가 아니라 ML 팀의 **데이터 협업 방식**을 바꾼다. 팀마다 피처를 중복 구현하던 방식에서, 한 번 정의한 피처를 모든 팀이 안전하게 재사용하는 방식으로 전환된다. 학습-서빙 스큐가 사라지고, 신규 모델 개발 속도가 빨라진다.

다음 글에서는 학습 완료된 모델을 체계적으로 버전 관리하고 안전하게 배포하기 위한 **모델 레지스트리**를 살펴본다.

---

**지난 글:** [MLOps 실험 트래킹: 재현 가능한 ML 개발](/posts/mlops-experiment-tracking/)

**다음 글:** [모델 레지스트리: 모델 생애주기 관리](/posts/mlops-model-registry/)

읽어주셔서 감사합니다. 😊
