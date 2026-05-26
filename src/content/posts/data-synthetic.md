---
title: "합성 데이터: 실제 데이터 없이 AI 학습 데이터 만들기"
description: "Faker·SDV·GAN·Diffusion 모델까지 합성 데이터 생성 방법 전체를 정리하고, 품질 검증·프라이버시 보호·다운스트림 성능 평가까지 실무 관점에서 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["합성데이터", "SyntheticData", "Faker", "SDV", "GAN", "데이터생성", "프라이버시"]
featured: false
draft: false
---

[지난 글](/posts/data-augmentation/)에서 기존 데이터를 변형해 양을 늘리는 증강(Augmentation)을 다뤘다. 증강이 '있는 것을 변형'하는 방법이라면, **합성 데이터(Synthetic Data)**는 실제 데이터를 아예 처음부터 생성하는 접근이다. 의료 기록처럼 수집 자체가 어렵거나, GDPR·개인정보보호법으로 원본 데이터를 공유하기 어려운 상황에서 합성 데이터는 실질적인 대안이 된다.

## 왜 합성 데이터인가

합성 데이터가 주목받는 이유는 크게 세 가지다.

첫째, **데이터 부족 해결**. 의료·금융·자율주행 도메인에서는 레이블이 붙은 데이터 수집 자체가 수개월에서 수년이 걸리기도 한다. 합성 데이터는 이 병목을 제거한다.

둘째, **프라이버시 보호**. 원본 데이터에서 통계적 특성만 학습해 새 데이터를 생성하면, 특정 개인을 재식별할 수 없게 만들 수 있다. 이 특성 덕분에 병원 EMR 데이터나 금융 거래 내역을 연구 목적으로 공유할 때 합성 버전을 활용하는 사례가 늘고 있다.

셋째, **엣지 케이스 확보**. 실제 사고 데이터, 시스템 장애 로그, 금융 사기 거래는 본질적으로 희귀하다. 시뮬레이션이나 GAN으로 이런 희귀 케이스를 의도적으로 생성해 모델의 강건성을 높일 수 있다.

## 합성 데이터 생성 접근법

![합성 데이터 생성 방법](/assets/posts/data-synthetic-methods.svg)

### 규칙 기반 생성

가장 단순한 방법이다. 미리 정의된 규칙이나 포맷에 따라 데이터를 생성한다.

**Faker** 라이브러리는 이름, 주소, 전화번호, 이메일 등 현실적인 가짜 데이터를 빠르게 만든다. 한국어(`ko_KR`)를 포함한 수십 개 로케일을 지원한다.

```python
from faker import Faker
import pandas as pd

fake = Faker('ko_KR')

records = []
for _ in range(5000):
    records.append({
        'name': fake.name(),
        'phone': fake.phone_number(),
        'email': fake.email(),
        'address': fake.address(),
        'birth': fake.date_of_birth(minimum_age=18, maximum_age=65).isoformat(),
    })

df = pd.DataFrame(records)
print(df.head())
```

규칙 기반 방식의 강점은 **결정론적**이라는 점이다. 시드를 고정하면 동일한 데이터가 재현된다. 단, 변수 간 실제 상관관계는 반영하지 않는다.

### 통계·수식 기반 생성

실제 데이터의 분포와 상관 구조를 학습해 새 샘플을 뽑는 방법이다. **SDV(Synthetic Data Vault)**가 대표적이다.

![합성 데이터 코드 예시](/assets/posts/data-synthetic-code.svg)

```python
from sdv.single_table import GaussianCopulaSynthesizer
from sdv.metadata import SingleTableMetadata

# 메타데이터 자동 감지
metadata = SingleTableMetadata()
metadata.detect_from_dataframe(real_df)

# Gaussian Copula로 변수 간 상관관계 보존
synthesizer = GaussianCopulaSynthesizer(metadata)
synthesizer.fit(real_df)

# 원본과 같은 수의 합성 데이터 생성
synthetic_df = synthesizer.sample(num_rows=len(real_df))
```

**Gaussian Copula**는 각 변수를 독립적으로 모델링한 뒤, Copula 함수로 변수 간 의존 구조를 별도로 모델링한다. 이렇게 하면 분포 형태와 상관관계를 동시에 보존할 수 있다.

클래스 불균형 해소에는 **SMOTE(Synthetic Minority Over-sampling Technique)**가 효과적이다. 소수 클래스 샘플의 k-최근접 이웃 사이를 보간해 새 샘플을 만든다.

```python
from imblearn.over_sampling import SMOTE

X, y = df.drop('label', axis=1), df['label']
sm = SMOTE(random_state=42, k_neighbors=5)
X_res, y_res = sm.fit_resample(X, y)

print(f"Before: {dict(pd.Series(y).value_counts())}")
print(f"After:  {dict(pd.Series(y_res).value_counts())}")
```

### 딥러닝 기반 생성

가장 현실적인 합성 데이터를 만들 수 있지만, 학습 비용이 높다.

**CTGAN(Conditional Tabular GAN)**은 표 형식 데이터에 특화된 GAN이다. 생성자(Generator)와 판별자(Discriminator)가 경쟁하며 실제 데이터와 구분하기 어려운 합성 데이터를 학습한다.

```python
from sdv.single_table import CTGANSynthesizer

synthesizer = CTGANSynthesizer(
    metadata,
    epochs=300,
    batch_size=500,
    verbose=True
)
synthesizer.fit(real_df)
synthetic_df = synthesizer.sample(num_rows=10000)
```

텍스트 데이터에는 **LLM 기반 생성**이 강력하다. GPT-4나 Claude에게 시스템 프롬프트로 도메인 규칙을 명시하고, 다양한 예시 데이터를 생성하도록 요청할 수 있다. 특히 Instruction Tuning용 질문-답변 쌍 생성에 많이 활용된다.

## 합성 데이터 품질 검증

합성 데이터는 만든 후 반드시 품질을 검증해야 한다.

### sdmetrics로 자동 검증

```python
from sdmetrics.reports.single_table import QualityReport

report = QualityReport()
report.generate(
    real_data=real_df,
    synthetic_data=synthetic_df,
    metadata=metadata.to_dict()
)

# Column Shapes: 각 컬럼의 분포 유사도
# Column Pair Trends: 컬럼 쌍 간 상관관계 보존도
report.get_details(property_name='Column Shapes')
```

| 검증 항목 | 설명 | 도구 |
|---|---|---|
| 통계적 유사성 | 분포·평균·분산·상관계수 비교 | sdmetrics, scipy |
| 프라이버시 위험 | 재식별 위험도, 멤버십 추론 공격 | sdmetrics, AIPrivacy |
| 다운스트림 성능 | 합성 데이터로 학습한 모델의 실제 데이터 성능 | scikit-learn |
| 현실성 점수 | GAN 판별자 또는 외부 분류기로 실제/합성 구분 가능 여부 | 직접 구현 |

### Train on Synthetic, Test on Real (TSTR)

가장 신뢰할 수 있는 품질 측정 방법이다.

```python
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.metrics import f1_score

# 합성 데이터로 학습
clf = GradientBoostingClassifier()
clf.fit(synthetic_df[features], synthetic_df[target])

# 실제 데이터로 평가
y_pred = clf.predict(real_test_df[features])
f1 = f1_score(real_test_df[target], y_pred, average='weighted')
print(f"TSTR F1: {f1:.4f}")
```

TSTR F1 점수가 실제 데이터(TRTR)와 크게 다르지 않으면 합성 데이터의 품질이 충분하다고 판단할 수 있다.

## 프라이버시 리스크 관리

합성 데이터가 프라이버시를 보장한다고 착각하기 쉽지만, 학습 데이터에 과적합된 합성 데이터는 원본 레코드를 노출할 수 있다.

주요 공격 유형과 방어 방법:

| 공격 유형 | 위협 | 대응 |
|---|---|---|
| 멤버십 추론 | 특정 레코드가 학습 데이터에 있었는지 | Differential Privacy 적용 |
| 속성 추론 | 알려진 속성으로 나머지 속성 추론 | SDV anonymization 옵션 |
| 재구성 공격 | 합성 데이터로 원본 재현 | 에포크 수 제한, 과적합 모니터링 |

SDV는 `anonymize` 파라미터로 기본적인 프라이버시 보호를 제공하며, Differential Privacy를 통합한 **PATE-GAN** 같은 프레임워크도 있다.

## 실무 적용 가이드

**언제 합성 데이터를 써야 하나?**

- 원본 데이터 수집·레이블링 비용이 매우 높을 때
- 소수 클래스나 엣지 케이스 데이터가 부족할 때
- 개인정보 규제로 외부 공유가 어려울 때
- 개발·테스트 환경에 프로덕션 데이터를 쓰기 어려울 때

**쓰면 안 되는 경우**

- 합성 데이터만으로 최종 모델을 평가할 때 (항상 실제 데이터로 최종 검증)
- 실제 분포를 아직 모르는 단계 (학습 데이터 자체가 없을 때)

---

**지난 글:** [데이터 증강: 적은 데이터로 더 강한 모델 만들기](/posts/data-augmentation/)

**다음 글:** [데이터 품질 관리: 쓰레기 in, 쓰레기 out을 막는 법](/posts/data-quality/)

<br>
읽어주셔서 감사합니다. 😊
