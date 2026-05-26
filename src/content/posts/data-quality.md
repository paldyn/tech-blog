---
title: "데이터 품질 관리: 쓰레기 in, 쓰레기 out을 막는 법"
description: "정확성·완전성·일관성·적시성·타당성·유일성 6대 차원으로 데이터 품질을 정의하고, Great Expectations·Pandera·dbt로 파이프라인에서 자동 검증하는 실무 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["데이터품질", "DataQuality", "GreatExpectations", "Pandera", "dbt", "데이터파이프라인"]
featured: false
draft: false
---

[지난 글](/posts/data-synthetic/)에서 합성 데이터를 만드는 방법을 살펴봤다. 합성이든 실제든, 데이터가 낮은 품질이라면 그 위에서 학습한 AI 모델도 신뢰할 수 없다. **"Garbage In, Garbage Out"**—이 오래된 격언이 ML 시대에도 그대로 통한다. 이번 글에서는 데이터 품질을 정의하는 6대 차원과, 파이프라인에서 자동으로 검증하는 실무 방법을 정리한다.

## 데이터 품질의 6대 차원

데이터 품질은 단일 지표가 아니라 여러 차원의 복합 개념이다.

![데이터 품질 6대 차원](/assets/posts/data-quality-dimensions.svg)

| 차원 | 질문 | 측정 방법 |
|---|---|---|
| **정확성** | 실제 세계를 올바르게 반영하는가? | 레퍼런스 데이터와 비교 |
| **완전성** | 필수 값이 빠짐없이 있는가? | NULL 비율, 레코드 수 |
| **일관성** | 여러 소스 간 모순이 없는가? | 교차 테이블 검증 |
| **적시성** | 필요할 때 최신 상태인가? | 마지막 업데이트 시간 |
| **타당성** | 형식·범위가 규칙을 따르는가? | 정규식, 범위 체크 |
| **유일성** | 중복 레코드가 없는가? | Primary key 중복 수 |

실무에서는 이 6가지를 모두 100% 달성하기 어렵다. 도메인에 따라 어떤 차원이 더 중요한지 우선순위를 정하고, 각 차원에 허용 임계값(threshold)을 설정하는 것이 현실적이다.

## 데이터 품질 파이프라인

![데이터 품질 파이프라인](/assets/posts/data-quality-pipeline.svg)

좋은 품질 파이프라인은 4단계로 구성된다.

**1. 프로파일링(Profiling)**: 데이터의 통계적 특성을 자동으로 탐색한다.
**2. 검증(Validation)**: 사전 정의된 규칙에 따라 데이터를 검사한다.
**3. 클리닝(Cleaning)**: 문제가 발견된 데이터를 수정·제거한다.
**4. 모니터링(Monitoring)**: 지속적으로 품질 지표를 추적하고 드리프트를 감지한다.

## Great Expectations로 검증 파이프라인 구축

**Great Expectations(GX)**는 파이썬 기반의 데이터 검증 프레임워크다. "Expectation"이라는 단위로 품질 규칙을 정의하고, 배치(batch) 단위로 검증을 실행한다.

```python
import great_expectations as gx

context = gx.get_context()

# 데이터 소스 등록
datasource = context.sources.add_pandas("my_source")
asset = datasource.add_dataframe_asset("user_data")

# Batch Request
batch_request = asset.build_batch_request(dataframe=df)

# Expectation Suite 생성
suite = context.add_expectation_suite("user_quality_suite")

validator = context.get_validator(
    batch_request=batch_request,
    expectation_suite=suite
)

# 품질 규칙 정의
validator.expect_column_values_to_not_be_null("user_id")
validator.expect_column_values_to_be_unique("user_id")
validator.expect_column_values_to_be_between("age", min_value=0, max_value=120)
validator.expect_column_values_to_match_regex("email", r"^[^@]+@[^@]+\.[^@]+$")
validator.expect_column_pair_values_A_to_be_greater_than_B(
    "order_date", "created_at"
)

validator.save_expectation_suite()

# 검증 실행
checkpoint = context.add_checkpoint(
    name="daily_check",
    batch_request=batch_request,
    expectation_suite_name="user_quality_suite"
)
results = checkpoint.run()
print(results.success)
```

### Pandera로 DataFrame 스키마 검증

**Pandera**는 선언적 방식으로 pandas DataFrame의 스키마를 정의하고 검증한다. 타입 힌트와 결합해 함수 인수에 직접 적용할 수 있어 데이터 파이프라인 함수에 자연스럽게 통합된다.

```python
import pandera as pa
from pandera.typing import DataFrame, Series

class UserSchema(pa.DataFrameModel):
    user_id: Series[int] = pa.Field(unique=True, gt=0)
    name: Series[str] = pa.Field(nullable=False)
    age: Series[int] = pa.Field(ge=0, le=120)
    email: Series[str] = pa.Field(
        str_matches=r"^[^@]+@[^@]+\.[^@]+$"
    )
    signup_date: Series[pa.DateTime]

    class Config:
        strict = True  # 정의되지 않은 컬럼 불허

@pa.check_types
def process_users(df: DataFrame[UserSchema]) -> DataFrame[UserSchema]:
    # 이 함수에 UserSchema를 만족하지 않는 df를 넘기면 자동으로 예외 발생
    return df[df['age'] >= 18]
```

### dbt로 SQL 파이프라인 검증

데이터 웨어하우스 환경에서는 **dbt tests**가 표준이다.

```yaml
# models/schema.yml
version: 2
models:
  - name: orders
    columns:
      - name: order_id
        tests:
          - unique
          - not_null
      - name: amount
        tests:
          - not_null
          - dbt_utils.accepted_range:
              min_value: 0
              max_value: 1000000
      - name: status
        tests:
          - accepted_values:
              values: ['pending', 'shipped', 'delivered', 'cancelled']
```

```bash
dbt test --select orders
# 테스트 결과를 메타데이터 스토어에 자동 기록
```

## 결측값 처리 전략

결측값은 품질 문제 중 가장 흔하다. 처리 전략은 결측 메커니즘에 따라 달라진다.

| 메커니즘 | 설명 | 권장 처리 |
|---|---|---|
| MCAR (완전 랜덤) | 결측이 다른 변수와 무관 | 행 삭제 또는 단순 대체 |
| MAR (랜덤) | 결측이 다른 관측 변수와 관련 | 조건부 대체, 다중 대체 |
| MNAR (비랜덤) | 결측 자체가 값과 관련 | 도메인 지식 활용, 결측 플래그 추가 |

```python
import pandas as pd
from sklearn.impute import KNNImputer, SimpleImputer

# 수치형: KNN 대체 (주변 k개 샘플 평균)
knn_imputer = KNNImputer(n_neighbors=5)
df[numeric_cols] = knn_imputer.fit_transform(df[numeric_cols])

# 범주형: 최빈값 대체
cat_imputer = SimpleImputer(strategy='most_frequent')
df[cat_cols] = cat_imputer.fit_transform(df[cat_cols])

# 시계열: 앞/뒤 값으로 채우기
df['sensor_value'] = df['sensor_value'].fillna(method='ffill').fillna(method='bfill')
```

## 이상값 탐지와 처리

이상값(Outlier)은 모델 학습에 큰 영향을 미친다.

```python
import numpy as np
from scipy import stats

# IQR 방법
Q1 = df['value'].quantile(0.25)
Q3 = df['value'].quantile(0.75)
IQR = Q3 - Q1
outlier_mask = (df['value'] < Q1 - 1.5 * IQR) | (df['value'] > Q3 + 1.5 * IQR)
print(f"이상값 수: {outlier_mask.sum()}")

# Z-score 방법
z_scores = np.abs(stats.zscore(df[numeric_cols]))
outlier_rows = (z_scores > 3).any(axis=1)

# Isolation Forest (고차원 데이터)
from sklearn.ensemble import IsolationForest
iso = IsolationForest(contamination=0.05, random_state=42)
df['is_outlier'] = iso.fit_predict(df[numeric_cols]) == -1
```

## 데이터 드리프트 모니터링

모델을 배포한 후에도 입력 데이터의 분포가 학습 시점과 달라질 수 있다(Data Drift). 이를 방치하면 모델 성능이 서서히 저하된다.

```python
from evidently.report import Report
from evidently.metric_preset import DataDriftPreset

report = Report(metrics=[DataDriftPreset()])
report.run(
    reference_data=train_df,   # 학습 시 데이터
    current_data=production_df  # 현재 서빙 데이터
)

# HTML 리포트 저장
report.save_html("drift_report.html")

# 드리프트 감지 결과
result = report.as_dict()
drifted_columns = [
    col for col, info in result['metrics'][0]['result']['drift_by_columns'].items()
    if info['drift_detected']
]
print(f"드리프트 감지 컬럼: {drifted_columns}")
```

## 실무 체크리스트

데이터 파이프라인을 구축하거나 점검할 때 사용할 수 있는 체크리스트다.

- [ ] 각 테이블의 Primary Key 유일성 검증이 자동화되어 있는가?
- [ ] 필수 컬럼의 NULL 비율 임계값이 설정되어 있는가?
- [ ] 파이프라인 실패 시 알림(Slack, PagerDuty 등)이 연결되어 있는가?
- [ ] 검증 결과가 메타스토어에 기록되어 히스토리를 볼 수 있는가?
- [ ] 프로덕션 데이터와 학습 데이터 간 분포 비교가 주기적으로 실행되는가?
- [ ] 이상값 처리 로직이 코드로 문서화되어 있는가?

---

**지난 글:** [합성 데이터: 실제 데이터 없이 AI 학습 데이터 만들기](/posts/data-synthetic/)

**다음 글:** [데이터 중복 제거: 정확한 매칭부터 시맨틱 디덥까지](/posts/data-deduplication/)

<br>
읽어주셔서 감사합니다. 😊
