---
title: "모델 레지스트리: 모델 생애주기 관리"
description: "모델 레지스트리의 역할, Staging·Production·Archived 전환 워크플로, MLflow Model Registry 실전 사용법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 8
type: "knowledge"
category: "AI"
tags: ["모델레지스트리", "MLflow", "모델버전관리", "Staging", "Production", "모델승격", "MLOps"]
featured: false
draft: false
---

[지난 글](/posts/mlops-feature-store/)에서 피처 스토어로 학습과 서빙 사이의 데이터 일관성을 확보하는 방법을 살펴보았다. 이제 학습 완료된 모델을 어떻게 버전 관리하고 배포까지 이어지게 하는지, **모델 레지스트리**를 살펴보자.

---

## 모델 레지스트리란 무엇인가

코드에 Git이 있다면, 모델에는 **모델 레지스트리(Model Registry)**가 있다. 모델 레지스트리는 학습 완료된 ML 모델의 버전, 메타데이터, 배포 상태를 중앙에서 관리하는 시스템이다.

### 모델 레지스트리가 없을 때 생기는 문제

레지스트리 없이 모델을 관리하면 이런 일들이 벌어진다.

**버전 혼란**: `model_final.pkl`, `model_final_v2.pkl`, `model_final_v2_use_this.pkl` 같은 파일들이 S3에 쌓인다. 어떤 모델이 실제 서비스 중인지 아무도 확신하지 못한다.

**롤백 불가**: 새 모델 배포 후 성능이 떨어졌을 때 이전 모델로 돌아가려 해도, 어떤 파라미터로 학습했는지 추적이 되지 않는다.

**책임 추적 불가**: 모델이 편향된 예측을 내놓았을 때, 누가 어떤 버전을 언제 배포했는지 감사 기록이 없다.

**무단 배포**: 데이터 과학자가 직접 S3에 모델을 업로드하고 엔지니어에게 슬랙 메시지를 보내는 식의 수동 배포 프로세스는 실수를 낳는다.

모델 레지스트리는 이 모든 문제를 해결한다. 모델은 명확한 이름과 버전 번호를 갖고, 각 상태 전환에는 승인 프로세스가 있으며, 모든 이력이 감사 가능하게 기록된다.

### 모델 레지스트리의 핵심 기능

- **버전 관리**: 같은 모델 이름 아래 여러 버전을 관리한다 (v1, v2, v3 ...)
- **메타데이터 저장**: 학습에 사용된 실험 ID, 메트릭, 파라미터, 데이터셋 버전을 함께 저장한다
- **상태 관리**: None → Staging → Production → Archived 전환을 명시적으로 추적한다
- **아티팩트 저장**: 모델 파일, 전처리 파이프라인, 스키마 등을 패키지로 저장한다
- **감사 로그**: 누가, 언제, 무슨 이유로 상태를 변경했는지 기록한다

---

## 모델 생애주기 4단계

![모델 생애주기](/assets/posts/mlops-model-registry-lifecycle.svg)

모델은 네 가지 상태를 거친다.

### 1단계: None (등록 전)

학습이 완료되었지만 레지스트리에 아직 등록되지 않은 상태다. 실험 트래킹 시스템(MLflow Runs)에는 기록되어 있지만, 공식 이름이나 버전 번호가 없다.

데이터 과학자가 여러 실험을 돌려보고, 그중 배포할 가치가 있다고 판단되는 모델을 레지스트리에 **등록(Register)**하면 버전 1이 부여된다.

### 2단계: Staging

등록된 모델이 검증을 받는 단계다. Staging에서는 다음이 수행된다.

- **단위 테스트**: 모델이 예상한 입력/출력 형식을 갖는지 확인
- **통합 테스트**: 실제 서빙 파이프라인과 함께 동작하는지 확인
- **성능 비교**: 현재 Production 모델 대비 성능 지표(정확도, 지연시간, 메모리 사용량) 비교
- **A/B 트래픽**: 전체 트래픽의 5~10%를 Staging 모델에 라우팅해 실제 사용자 반응 측정

Staging은 "프로덕션에 배포할 준비가 됐는지"를 검증하는 안전망이다. 문제가 발견되면 데이터 과학자에게 알림을 보내고, 모델은 Staging 상태를 유지하거나 폐기된다.

### 3단계: Production

모든 검증을 통과한 모델이 실제 서비스 트래픽을 받는 상태다. Production 상태에서는 다음이 지속적으로 수행된다.

- **100% 트래픽 수신**: 모든 추론 요청이 이 모델로 라우팅된다
- **실시간 모니터링**: 예측 분포, 입력 데이터 분포, 지연시간, 오류율 추적
- **SLA 보장**: 응답 시간 p99 < 100ms 같은 서비스 수준 협약 유지

Production 상태의 모델에서 심각한 문제가 발견되면 이전 버전으로 **롤백(Demote)**할 수 있다.

### 4단계: Archived

더 좋은 모델이 Production에 올라가거나, 모델이 수명을 다하면 Archived 상태가 된다. 삭제되지 않고 보관되는 이유는 두 가지다.

첫째, 감사 및 규제 요건이다. "언제, 어떤 모델이 어떤 예측을 했는가"를 사후에 재현해야 할 수 있다.

둘째, 비상 롤백이다. 새 모델에서 치명적 문제가 발생했을 때 Archived 모델을 즉시 Production으로 복구할 수 있다.

---

## MLflow Model Registry 실전

MLflow는 가장 많이 사용되는 오픈소스 MLOps 플랫폼으로, 모델 레지스트리를 내장한다.

### 모델 등록

```python
import mlflow
from mlflow.tracking import MlflowClient

client = MlflowClient()

# 모델 등록
result = mlflow.register_model(
    model_uri=f"runs:/{run_id}/model",
    name="fraud-detector",
)
version = result.version

# Staging으로 전환
client.transition_model_version_stage(
    name="fraud-detector",
    version=version,
    stage="Staging",
)

# 테스트 통과 후 Production 승격
client.transition_model_version_stage(
    name="fraud-detector",
    version=version,
    stage="Production",
    archive_existing_versions=True,
)
```

`archive_existing_versions=True`는 이전 Production 버전을 자동으로 Archived 상태로 변경한다. 항상 하나의 버전만 Production 상태를 유지하게 한다.

### 등록 시 메타데이터 첨부

```python
# 모델 등록과 함께 설명 추가
client.update_model_version(
    name="fraud-detector",
    version=version,
    description=(
        "XGBoost 기반 사기 탐지 모델. "
        "학습 데이터: 2025-01 ~ 2025-12. "
        "AUC-ROC: 0.94, F1: 0.87"
    ),
)

# 태그 추가
client.set_model_version_tag(
    name="fraud-detector",
    version=version,
    key="validated_by",
    value="ml-engineer-team",
)
client.set_model_version_tag(
    name="fraud-detector",
    version=version,
    key="training_dataset_version",
    value="v2025-12",
)
```

태그와 설명은 이후 감사 시에 "이 모델이 왜 배포됐는가"를 추적하는 데 중요하다.

### 서빙 코드에서 Production 모델 로드

```python
import mlflow.pyfunc

# 항상 현재 Production 모델 로드
model = mlflow.pyfunc.load_model(
    model_uri="models:/fraud-detector/Production"
)

# 예측
predictions = model.predict(input_df)
```

서빙 코드에 버전 번호를 하드코딩하지 않는다. `"models:/fraud-detector/Production"`이라는 별칭으로 항상 현재 Production 모델을 자동으로 가져온다.

### 버전 목록 조회 및 비교

```python
# 모든 버전 조회
versions = client.search_model_versions("name='fraud-detector'")
for v in versions:
    print(f"Version {v.version}: {v.current_stage} | {v.last_updated_timestamp}")

# 특정 버전의 메트릭 확인
run = mlflow.get_run(versions[0].run_id)
print(run.data.metrics)  # {'auc': 0.94, 'f1': 0.87}
```

---

## 자동화된 프로모션 파이프라인

![팀 워크플로: 모델 등록 → 배포](/assets/posts/mlops-model-registry-workflow.svg)

수동으로 상태를 전환하는 방식은 실수가 많고 느리다. 자동화된 프로모션 파이프라인을 구축하면 검증이 통과하는 즉시 자동으로 Production에 승격된다.

### CI/CD 파이프라인 연동 예시 (GitHub Actions)

```yaml
# .github/workflows/model-promotion.yml
name: Model Promotion Pipeline

on:
  workflow_dispatch:
    inputs:
      model_name:
        description: "Registry에 등록된 모델 이름"
        required: true
      model_version:
        description: "승격할 버전 번호"
        required: true

jobs:
  validate-and-promote:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: 모델 검증 테스트 실행
        run: |
          python scripts/validate_model.py \
            --model-name ${{ inputs.model_name }} \
            --model-version ${{ inputs.model_version }}

      - name: 성능 임계값 확인
        run: |
          python scripts/check_performance_gate.py \
            --model-name ${{ inputs.model_name }} \
            --model-version ${{ inputs.model_version }} \
            --min-auc 0.90 \
            --max-latency-p99-ms 80

      - name: Production 승격
        if: success()
        run: |
          python scripts/promote_model.py \
            --model-name ${{ inputs.model_name }} \
            --model-version ${{ inputs.model_version }} \
            --target-stage Production
```

### 검증 스크립트 예시

```python
# scripts/validate_model.py
import mlflow
import mlflow.pyfunc
import pandas as pd
import argparse

def validate_model(model_name: str, version: str):
    client = mlflow.MlflowClient()

    # 1. 모델 로드 테스트
    model_uri = f"models:/{model_name}/{version}"
    model = mlflow.pyfunc.load_model(model_uri)
    print(f"[OK] 모델 로드 성공: {model_uri}")

    # 2. 입력 스키마 테스트
    test_input = pd.DataFrame({
        "purchase_count_30d": [5],
        "avg_order_value": [45000.0],
        "churn_probability": [0.3],
    })
    predictions = model.predict(test_input)
    assert len(predictions) == 1, "예측 결과 수 불일치"
    print(f"[OK] 입력 스키마 검증 통과: {predictions}")

    # 3. 레이턴시 테스트
    import time
    latencies = []
    for _ in range(100):
        start = time.perf_counter()
        model.predict(test_input)
        latencies.append((time.perf_counter() - start) * 1000)

    p99 = sorted(latencies)[98]
    print(f"[OK] 지연시간 p99: {p99:.1f}ms")
    assert p99 < 100, f"지연시간 초과: {p99:.1f}ms > 100ms"

    # 4. Staging으로 전환
    client.transition_model_version_stage(
        name=model_name,
        version=version,
        stage="Staging",
    )
    print(f"[OK] {model_name} v{version} → Staging 전환 완료")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model-name", required=True)
    parser.add_argument("--model-version", required=True)
    args = parser.parse_args()
    validate_model(args.model_name, args.model_version)
```

---

## 멀티모델·챔피언-챌린저 패턴

실제 서비스에서는 하나의 Production 모델만 있는 것이 아니라, 여러 모델이 동시에 경쟁하거나 협력한다.

### 챔피언-챌린저 (Champion-Challenger)

현재 Production 모델(챔피언)과 새 모델(챌린저)을 동시에 운영하며 성능을 비교한다.

```python
import mlflow.pyfunc
import random

# 두 모델 로드
champion = mlflow.pyfunc.load_model("models:/fraud-detector/Production")
challenger = mlflow.pyfunc.load_model("models:/fraud-detector/Staging")

def predict_with_shadow(user_features, challenger_ratio=0.1):
    """챔피언-챌린저 라우팅"""
    champion_pred = champion.predict(user_features)

    # 챌린저에게 10% 트래픽 라우팅 (Shadow Mode)
    if random.random() < challenger_ratio:
        challenger_pred = challenger.predict(user_features)
        # 챌린저 예측은 로깅만 하고 반환하지 않음
        log_shadow_prediction(
            champion=champion_pred,
            challenger=challenger_pred,
            features=user_features,
        )

    # 사용자에게는 챔피언 예측만 반환
    return champion_pred
```

Shadow Mode에서 챌린저는 실제 결과에 영향을 주지 않으면서 실제 트래픽에 대한 예측을 기록한다. 충분한 데이터가 쌓이면 챔피언과 챌린저의 성능을 통계적으로 비교한다.

### 멀티모델 앙상블

여러 모델의 예측을 조합해 최종 예측을 만드는 패턴이다.

```python
models = {
    "xgboost": mlflow.pyfunc.load_model("models:/fraud-xgb/Production"),
    "lightgbm": mlflow.pyfunc.load_model("models:/fraud-lgbm/Production"),
    "neural_net": mlflow.pyfunc.load_model("models:/fraud-nn/Production"),
}

weights = {"xgboost": 0.4, "lightgbm": 0.4, "neural_net": 0.2}

def ensemble_predict(features):
    weighted_sum = sum(
        weights[name] * model.predict(features)
        for name, model in models.items()
    )
    return weighted_sum
```

각 모델이 레지스트리에서 독립적으로 버전 관리되므로, `xgboost` 모델만 업데이트해도 나머지 모델에 영향을 주지 않는다.

---

## 모델 레지스트리 운영 베스트 프랙티스

**명명 규칙을 표준화하라**: `{팀}-{용도}-{알고리즘}` 형태로 이름을 정한다. 예: `fraud-realtime-xgb`, `churn-batch-lgbm`. 레지스트리가 커질수록 이름이 중요해진다.

**모든 Staging 전환에 승인을 요구하라**: 자동화된 파이프라인이더라도 Production 승격에는 사람의 최종 승인 단계를 두는 것이 안전하다.

**롤백 계획을 사전에 수립하라**: "Production에 문제가 생기면 어떻게 이전 버전으로 돌아가는가"를 배포 전에 문서화하고, 롤백 스크립트를 미리 준비한다.

**삭제하지 말고 Archive하라**: 오래된 모델을 삭제하면 감사 기록이 사라진다. 스토리지 비용이 걱정된다면 Archived 모델의 아티팩트를 콜드 스토리지로 이전하는 정책을 만든다.

**메트릭 임계값을 코드로 관리하라**: "AUC 0.90 이상이어야 한다"는 기준을 슬랙 메시지나 문서가 아닌 코드와 CI/CD 파이프라인으로 강제한다.

---

실험 트래킹이 "어떤 모델을 만들었는가"를 추적한다면, 모델 레지스트리는 "어떤 모델이 지금 서비스 중이며, 어떻게 거기까지 왔는가"를 추적한다. 두 시스템이 함께 작동할 때 ML 팀은 자신감을 갖고 모델을 배포하고, 문제 발생 시 빠르게 진단하고 복구할 수 있다.

다음 글에서는 모델 레지스트리와 연동해 실제 배포까지 자동화하는 **ML CI/CD 파이프라인**을 살펴본다.

---

**지난 글:** [피처 스토어: 피처 재사용과 일관성 확보](/posts/mlops-feature-store/)

**다음 글:** [ML CI/CD: 자동화된 모델 배포 파이프라인](/posts/mlops-ci-cd/)

읽어주셔서 감사합니다. 😊
