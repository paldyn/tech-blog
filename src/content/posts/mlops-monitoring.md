---
title: "모델 모니터링: 프로덕션 ML 감시"
description: "데이터 드리프트·컨셉 드리프트·모델 성능 저하를 감지하고 대응하는 모니터링 전략과 Evidently, PSI, KS 검정 실전을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 10
type: "knowledge"
category: "AI"
tags: ["모델모니터링", "데이터드리프트", "컨셉드리프트", "Evidently", "PSI", "KS검정", "MLOps"]
featured: false
draft: false
---

[지난 글](/posts/mlops-ci-cd/)에서 ML CI/CD 파이프라인으로 모델을 자동으로 배포하는 방법을 다뤘다. 배포가 끝이 아니다. 프로덕션에 나간 모델은 시간이 지남에 따라 성능이 저하된다. 이를 감지하고 대응하는 것이 **모델 모니터링**이다.

추천 시스템을 구축해 99% 정확도로 배포했다고 가정해보자. 6개월 후 정확도는 87%로 떨어져 있다. 무슨 일이 일어난 걸까? 코드는 변하지 않았다. 모델 파라미터도 그대로다. 변한 것은 **세상**이다. 사용자의 구매 패턴이 변했고, 새 상품 카테고리가 생겼으며, 계절적 트렌드가 바뀌었다. 모델이 학습한 세계와 실제 세계의 간극이 커진 것이다.

이를 **모델 스톨링(Model Staleness)** 이라 부르며, 모든 프로덕션 ML 시스템이 필연적으로 직면하는 문제다.

---

## 왜 모델 성능은 저하되는가

### 데이터 드리프트 (Data Drift)

모델이 학습한 입력 데이터의 분포와, 실제 서빙 시 들어오는 데이터의 분포가 달라지는 현상이다.

예시: 가격 예측 모델을 2024년 데이터로 학습했는데, 2025년에 인플레이션으로 인해 물가가 전반적으로 상승했다. 학습 데이터의 평균 구매 금액은 18만원이었는데, 현재 서빙 데이터의 평균은 24만원이다. 모델은 이 새로운 분포에 최적화되지 않았으므로 예측 정확도가 떨어진다.

### 컨셉 드리프트 (Concept Drift)

입력-출력 관계 자체가 변하는 현상이다. 데이터 드리프트보다 더 근본적인 문제다.

예시: 스팸 필터 모델. 스팸 발송자들은 시간이 지남에 따라 새로운 우회 기법을 개발한다. "무료 상품" 같은 키워드가 더 이상 스팸의 신호가 되지 않고, 전혀 다른 패턴으로 스팸이 온다. 동일한 입력 특성에 대해 "스팸인지 아닌지"의 정의 자체가 변한 것이다.

### 업스트림 변경 (Upstream Changes)

데이터 파이프라인 상류에서의 변경으로 인해 피처 값이 바뀌는 현상이다.

- 데이터베이스 스키마 변경: `user_age` 컬럼이 정수에서 `NULL` 허용으로 변경
- ETL 버그 수정: 결측치 처리 로직이 바뀌어 특정 피처의 분포가 달라짐
- 외부 API 변경: 날씨 API가 온도 단위를 섭씨에서 화씨로 변경

이런 변경은 코드 리뷰에서 포착하기 어렵고, 모델 성능이 떨어지기 시작하고 나서야 발견되는 경우가 많다.

---

## 드리프트의 종류

### Covariate Shift (공변량 이동)

입력 변수 X의 분포는 변하지만, X가 주어졌을 때 Y의 조건부 분포 P(Y|X)는 변하지 않는 경우다.

```
학습 시: P_train(X) ≠ P_serve(X)
하지만:  P_train(Y|X) = P_serve(Y|X)
```

이 경우 중요도 가중치 재조정(Importance Weighting)으로 재학습 없이 어느 정도 보정 가능하다.

### Label Shift (레이블 이동)

출력 분포 P(Y)가 변하는 경우다. 의료 진단 모델에서 질병 유병률이 계절에 따라 변하는 것이 전형적인 예다.

```
학습 시: P_train(Y) ≠ P_serve(Y)
```

### Concept Drift (컨셉 드리프트)

P(Y|X) 자체가 변하는 경우로, 가장 심각한 형태다. 재학습이 유일한 해결책이다.

```
학습 시: P_train(Y|X) ≠ P_serve(Y|X)
```

---

## 드리프트 감지 통계 방법

![데이터 드리프트 감지 원리](/assets/posts/mlops-monitoring-drift.svg)

### PSI (Population Stability Index)

보험업계에서 개발된 분포 비교 지표로, ML 모니터링에서 가장 널리 쓰인다.

```
PSI = Σ (actual% - expected%) × ln(actual% / expected%)
```

해석 기준:
- PSI < 0.1: 변화 없음, 정상
- 0.1 ≤ PSI < 0.2: 소폭 변화, 모니터링 강화
- PSI ≥ 0.2: 심각한 드리프트, 즉시 대응 필요

```python
import numpy as np

def psi(expected: np.ndarray, actual: np.ndarray,
        buckets: int = 10) -> float:
    """PSI > 0.2이면 심각한 드리프트"""
    expected_pct = np.histogram(expected, buckets)[0] / len(expected)
    actual_pct   = np.histogram(actual,   buckets)[0] / len(actual)
    # 0 방지
    expected_pct = np.where(expected_pct == 0, 1e-6, expected_pct)
    actual_pct   = np.where(actual_pct   == 0, 1e-6, actual_pct)
    return float(np.sum(
        (actual_pct - expected_pct) * np.log(actual_pct / expected_pct)
    ))
```

### KL Divergence (쿨백-라이블러 발산)

두 분포의 차이를 정보 이론적으로 측정한다. PSI와 달리 비대칭 지표라는 점에 주의해야 한다.

```
KL(P || Q) = Σ P(x) × log(P(x) / Q(x))
```

KL(P||Q)와 KL(Q||P)는 다른 값을 가진다. 이 때문에 실무에서는 KL을 대칭화한 **JS Divergence**를 사용하기도 한다.

```python
from scipy.stats import entropy

def kl_divergence(p: np.ndarray, q: np.ndarray, bins: int = 20) -> float:
    """학습 분포 p, 서빙 분포 q 간 KL Divergence"""
    p_hist, edges = np.histogram(p, bins=bins, density=True)
    q_hist, _     = np.histogram(q, bins=edges, density=True)

    # 0 방지
    p_hist = p_hist + 1e-8
    q_hist = q_hist + 1e-8

    return float(entropy(p_hist, q_hist))

def js_divergence(p: np.ndarray, q: np.ndarray, bins: int = 20) -> float:
    """대칭화된 JS Divergence (0~log2 범위)"""
    p_hist, edges = np.histogram(p, bins=bins, density=True)
    q_hist, _     = np.histogram(q, bins=edges, density=True)
    p_hist = p_hist + 1e-8
    q_hist = q_hist + 1e-8
    m = (p_hist + q_hist) / 2
    return float((entropy(p_hist, m) + entropy(q_hist, m)) / 2)
```

### KS 검정 (Kolmogorov-Smirnov Test)

비모수적 통계 검정으로, 두 분포가 동일한 분포에서 왔는지를 검정한다. p-value < 0.05이면 분포 변화가 통계적으로 유의미하다.

```python
from scipy.stats import ks_2samp

def ks_drift_test(reference: np.ndarray,
                  current: np.ndarray) -> dict:
    """KS 검정으로 드리프트 유의성 판단"""
    statistic, p_value = ks_2samp(reference, current)

    return {
        "ks_statistic": statistic,
        "p_value": p_value,
        "drift_detected": p_value < 0.05,
        "severity": (
            "심각" if statistic > 0.3 else
            "중간" if statistic > 0.15 else
            "경미"
        )
    }
```

### 범주형 변수: 카이제곱 검정

위 방법들은 수치형 변수에 적합하다. 범주형 변수에는 카이제곱 검정을 사용한다.

```python
from scipy.stats import chi2_contingency

def chi2_drift_test(reference_counts: dict,
                    current_counts: dict) -> dict:
    """범주형 피처의 분포 변화 검정"""
    all_categories = set(reference_counts) | set(current_counts)
    ref_arr = [reference_counts.get(c, 0) for c in all_categories]
    cur_arr = [current_counts.get(c, 0) for c in all_categories]

    # 2xN 관측도수 행렬
    observed = [ref_arr, cur_arr]
    chi2, p_value, dof, expected = chi2_contingency(observed)

    return {
        "chi2_statistic": chi2,
        "p_value": p_value,
        "drift_detected": p_value < 0.05
    }
```

---

## Evidently로 자동 모니터링 구축

Evidently는 Python 기반 오픈소스 ML 모니터링 라이브러리로, 드리프트 감지부터 HTML 리포트 생성까지 원스톱으로 처리한다.

```python
from evidently.report import Report
from evidently.metric_preset import DataDriftPreset, ModelPerformancePreset

# 드리프트 리포트 생성
report = Report(metrics=[
    DataDriftPreset(),
    ModelPerformancePreset(),
])

report.run(
    reference_data=train_df,   # 학습 데이터
    current_data=prod_df,      # 서빙 데이터 (최근 7일)
)
report.save_html("drift_report.html")

# 드리프트 감지 결과 추출
result = report.as_dict()
drift_score = result["metrics"][0]["result"]["dataset_drift"]
if drift_score:
    trigger_retraining()  # 재학습 트리거
```

### 세부 피처별 드리프트 모니터링

```python
from evidently.metrics import ColumnDriftMetric, DatasetDriftMetric

# 핵심 피처만 개별 모니터링
report = Report(metrics=[
    DatasetDriftMetric(),
    ColumnDriftMetric(column_name="purchase_amount", stattest="psi"),
    ColumnDriftMetric(column_name="user_age",        stattest="ks"),
    ColumnDriftMetric(column_name="category",        stattest="chi2"),
])

report.run(reference_data=train_df, current_data=prod_df)

# 각 피처별 결과 파싱
result = report.as_dict()
for metric in result["metrics"]:
    if metric["metric"] == "ColumnDriftMetric":
        col = metric["result"]["column_name"]
        drift = metric["result"]["drift_detected"]
        score = metric["result"]["stattest_threshold"]
        print(f"{col}: drift={drift}, score={score:.4f}")
```

### Evidently + MLflow 통합

```python
import mlflow
from evidently.report import Report
from evidently.metric_preset import DataDriftPreset

def log_drift_to_mlflow(train_df, prod_df, run_id: str):
    report = Report(metrics=[DataDriftPreset()])
    report.run(reference_data=train_df, current_data=prod_df)
    result = report.as_dict()

    with mlflow.start_run(run_id=run_id):
        drift_metrics = result["metrics"][0]["result"]
        mlflow.log_metric("dataset_drift", int(drift_metrics["dataset_drift"]))
        mlflow.log_metric("n_drifted_columns", drift_metrics["n_drifted_columns"])
        mlflow.log_metric("drift_share", drift_metrics["share_drifted_columns"])

        # HTML 리포트를 아티팩트로 저장
        report.save_html("/tmp/drift_report.html")
        mlflow.log_artifact("/tmp/drift_report.html", "monitoring")
```

---

## 재학습 트리거 전략

![프로덕션 ML 모니터링 대시보드](/assets/posts/mlops-monitoring-dashboard.svg)

### 1. 스케줄 기반 (Schedule-based)

가장 단순한 방법이다. 매주 또는 매월 정기적으로 재학습한다.

```yaml
# .github/workflows/scheduled-retrain.yml
on:
  schedule:
    - cron: '0 2 * * 1'  # 매주 월요일 새벽 2시

jobs:
  retrain:
    runs-on: ubuntu-latest
    steps:
      - name: 최신 데이터로 재학습
        run: python train.py --data-since "7 days ago"
      - name: 챔피언 비교 및 등록
        run: python register_if_better.py
```

장점: 예측 가능, 운영 단순
단점: 드리프트가 발생해도 다음 스케줄까지 대응 불가

### 2. 드리프트 기반 (Drift-based)

PSI, KL Divergence 등이 임계값을 초과하면 즉시 재학습을 트리거한다.

```python
# monitoring/drift_triggered_retrain.py
import schedule
import time

def check_and_retrain():
    """매 6시간마다 드리프트 체크"""
    prod_data = fetch_recent_predictions(hours=24)
    train_data = load_training_reference()

    psi_scores = {
        col: psi(train_data[col].values, prod_data[col].values)
        for col in MONITORED_FEATURES
    }

    max_psi = max(psi_scores.values())
    print(f"최대 PSI: {max_psi:.4f}")

    if max_psi > 0.2:  # 심각한 드리프트
        print(f"드리프트 감지! 재학습 트리거...")
        trigger_retraining_pipeline(
            reason="drift",
            metrics=psi_scores,
            severity="critical" if max_psi > 0.4 else "warning"
        )
        send_alert(f"데이터 드리프트 감지: PSI={max_psi:.4f}")

schedule.every(6).hours.do(check_and_retrain)

while True:
    schedule.run_pending()
    time.sleep(60)
```

### 3. 성능 기반 (Performance-based)

실제 레이블이 지연되어 들어오는 경우 적합하다. 예: 대출 승인 모델은 3개월 후에야 상환 결과를 알 수 있다.

```python
def check_delayed_labels_and_retrain():
    """지연 레이블 수집 후 성능 평가"""
    # 3개월 전 예측 + 이제 들어온 실제 레이블
    old_predictions = fetch_predictions(days_ago=90)
    actual_labels = fetch_actual_outcomes(period="recent")

    # 매칭
    joined = old_predictions.merge(actual_labels, on="user_id")

    # 성능 계산
    current_accuracy = (joined["prediction"] == joined["actual"]).mean()
    baseline_accuracy = get_production_baseline_accuracy()

    if current_accuracy < baseline_accuracy * 0.97:  # 3% 이상 성능 저하
        trigger_retraining_pipeline(reason="performance_degradation")
```

### 4. 하이브리드 전략 (권장)

실무에서는 세 가지를 조합하는 것이 가장 효과적이다.

```python
RETRAINING_TRIGGERS = [
    {
        "type": "schedule",
        "cron": "0 2 * * 1",      # 매주 월요일 정기 재학습
        "priority": "low"
    },
    {
        "type": "drift",
        "metric": "psi",
        "threshold": 0.2,
        "check_interval_hours": 6,
        "priority": "high"
    },
    {
        "type": "performance",
        "metric": "accuracy",
        "degradation_threshold": 0.03,
        "priority": "critical"
    }
]
```

---

## 알림과 대시보드 설계

### Slack 알림 통합

```python
import requests

ALERT_LEVELS = {
    "info":     {"color": "#7ec8e3", "emoji": "ℹ️"},
    "warning":  {"color": "#e09030", "emoji": "⚠️"},
    "critical": {"color": "#e05555", "emoji": "🚨"},
}

def send_slack_alert(
    message: str,
    level: str = "warning",
    metrics: dict = None,
    webhook_url: str = None
):
    level_config = ALERT_LEVELS.get(level, ALERT_LEVELS["warning"])
    blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"{level_config['emoji']} *ML 모니터링 알림*\n{message}"
            }
        }
    ]

    if metrics:
        fields = [
            {"type": "mrkdwn", "text": f"*{k}*\n{v:.4f}"}
            for k, v in metrics.items()
        ]
        blocks.append({"type": "section", "fields": fields})

    requests.post(webhook_url, json={"blocks": blocks})
```

### Prometheus + Grafana 연동

대규모 시스템에서는 Prometheus로 메트릭을 수집하고 Grafana로 시각화한다.

```python
from prometheus_client import Gauge, Counter, Histogram, start_http_server

# 메트릭 정의
model_accuracy    = Gauge("ml_model_accuracy",    "현재 모델 정확도", ["model_name"])
prediction_count  = Counter("ml_predictions_total","예측 요청 수",    ["model_name", "status"])
prediction_latency= Histogram("ml_prediction_latency_seconds",
                               "예측 지연시간", ["model_name"],
                               buckets=[.01, .025, .05, .075, .1, .25])
drift_score       = Gauge("ml_drift_psi",         "PSI 드리프트 점수", ["feature"])

def predict_with_monitoring(request: dict, model_name: str = "recommendation"):
    import time
    start = time.time()

    try:
        result = model.predict(request)
        prediction_count.labels(model_name=model_name, status="success").inc()
        return result

    except Exception as e:
        prediction_count.labels(model_name=model_name, status="error").inc()
        raise

    finally:
        latency = time.time() - start
        prediction_latency.labels(model_name=model_name).observe(latency)

# 메트릭 서버 시작 (Prometheus가 스크랩)
start_http_server(8000)
```

### 모니터링 대시보드 체크리스트

효과적인 ML 모니터링 대시보드에는 다음 패널이 포함되어야 한다.

**모델 성능 패널**
- 정확도/F1/AUC 시계열 트렌드
- 챔피언 모델 기준선 표시
- 성능 저하 알림 임계값 표시

**데이터 품질 패널**
- 입력 피처별 PSI/KL 점수
- 결측치 비율 시계열
- 이상값 감지 빈도

**시스템 성능 패널**
- 예측 지연시간 P50/P95/P99
- 초당 요청 수 (TPS)
- 에러율

**알림 히스토리 패널**
- 최근 알림 목록
- 자동 조치 이력 (재학습 트리거 등)

---

## 실전 모니터링 파이프라인 전체 코드

```python
# monitoring/pipeline.py
import logging
from dataclasses import dataclass
from typing import Optional
import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

@dataclass
class DriftReport:
    feature: str
    psi: float
    ks_statistic: float
    ks_p_value: float
    drift_detected: bool
    severity: str  # "none" | "warning" | "critical"

class MLMonitoringPipeline:
    def __init__(
        self,
        reference_data: pd.DataFrame,
        model_name: str,
        psi_threshold_warning: float = 0.1,
        psi_threshold_critical: float = 0.2,
    ):
        self.reference = reference_data
        self.model_name = model_name
        self.psi_warn = psi_threshold_warning
        self.psi_crit = psi_threshold_critical

    def run(self, current_data: pd.DataFrame) -> list[DriftReport]:
        """전체 모니터링 파이프라인 실행"""
        reports = []

        for col in self.reference.select_dtypes(include=[np.number]).columns:
            if col not in current_data.columns:
                continue

            psi_score = psi(
                self.reference[col].dropna().values,
                current_data[col].dropna().values,
            )
            ks_result = ks_drift_test(
                self.reference[col].dropna().values,
                current_data[col].dropna().values,
            )

            severity = (
                "critical" if psi_score >= self.psi_crit else
                "warning"  if psi_score >= self.psi_warn else
                "none"
            )

            report = DriftReport(
                feature=col,
                psi=psi_score,
                ks_statistic=ks_result["ks_statistic"],
                ks_p_value=ks_result["p_value"],
                drift_detected=ks_result["drift_detected"] or psi_score >= self.psi_warn,
                severity=severity,
            )
            reports.append(report)

            if severity != "none":
                logger.warning(
                    f"[{self.model_name}] 드리프트 감지 — {col}: "
                    f"PSI={psi_score:.4f}, KS={ks_result['ks_statistic']:.4f}, "
                    f"severity={severity}"
                )

        # 심각한 드리프트가 있으면 재학습 트리거
        critical_features = [r for r in reports if r.severity == "critical"]
        if critical_features:
            self._trigger_retraining(critical_features)

        return reports

    def _trigger_retraining(self, critical_reports: list[DriftReport]):
        """재학습 파이프라인 트리거"""
        logger.critical(
            f"[{self.model_name}] {len(critical_reports)}개 피처에서 "
            f"심각한 드리프트 감지. 재학습 트리거."
        )
        # 실제로는 Kubeflow, Airflow, GitHub Actions 등 호출
        # trigger_kubeflow_pipeline(model_name=self.model_name)
```

---

## 정리

모델 모니터링은 MLOps 사이클의 마지막이자 첫 번째 단계다. 모니터링에서 수집된 신호가 재학습 트리거가 되고, 재학습된 모델이 CI/CD 파이프라인을 통해 다시 배포되는 선순환 구조가 완성된다.

핵심 원칙을 정리하면 다음과 같다.

1. **모든 입력 피처를 모니터링하라.** 어떤 피처가 드리프트의 원인이 될지 사전에 알 수 없다.
2. **PSI와 KS 검정을 함께 사용하라.** 서로 보완하는 정보를 제공한다.
3. **재학습 트리거는 하이브리드로.** 스케줄 + 드리프트 + 성능을 조합하라.
4. **알림 피로(Alert Fatigue)를 방지하라.** 너무 민감한 임계값은 오히려 중요한 알림을 묻히게 한다.
5. **자동화할 수 있는 것은 자동화하라.** 드리프트 감지 → 재학습 → 배포의 전체 사이클이 자동화되어야 진정한 MLOps다.

데이터가 변하는 한 모델 모니터링은 끝이 없다. 하지만 탄탄한 모니터링 인프라가 있다면 변화에 빠르게 대응할 수 있다.

---

**지난 글:** [ML CI/CD: 자동화된 모델 배포 파이프라인](/posts/mlops-ci-cd/)

읽어주셔서 감사합니다. 😊
