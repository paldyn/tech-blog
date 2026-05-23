---
title: "ML CI/CD: 자동화된 모델 배포 파이프라인"
description: "ML 시스템에서 CI/CD를 구현하는 방법, 테스트 피라미드 전략, GitHub Actions와 Kubeflow Pipelines 실전 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 9
type: "knowledge"
category: "AI"
tags: ["ML-CI-CD", "GitHub-Actions", "Kubeflow", "모델테스트", "자동배포", "GitOps", "MLOps파이프라인"]
featured: false
draft: false
---

[지난 글](/posts/mlops-model-registry/)에서 모델 레지스트리로 모델 생애주기를 관리하는 방법을 살펴보았다. 이번에는 모델을 자동으로 검증·배포하는 **ML CI/CD 파이프라인** 구축을 다룬다.

소프트웨어 엔지니어링에서 CI/CD는 이미 표준 관행이다. 코드를 푸시하면 테스트가 실행되고, 통과하면 자동으로 배포된다. ML 시스템에도 같은 원칙을 적용하고 싶지만, 실제로는 훨씬 복잡하다. 데이터가 바뀌어도 모델이 다시 학습되어야 하고, 모델 성능을 측정하는 "테스트"는 단순한 통과/실패가 아닌 연속적인 지표다.

---

## 왜 ML에 CI/CD가 어려운가

### 데이터 의존성

일반 소프트웨어에서 코드 변경은 결정론적이다. 같은 입력에 같은 출력이 나온다. 하지만 ML 모델은 코드뿐만 아니라 **학습 데이터**에도 의존한다. 다음과 같은 상황을 생각해보자.

- 코드는 변경되지 않았는데, 새로 수집된 데이터가 분포가 달라져 모델 성능이 하락한다
- 데이터 전처리 버그를 수정했더니, 오히려 이전에 학습한 모델과 성능 비교가 어렵다
- 피처 엔지니어링을 바꿨더니 재학습이 필요한데, 재학습 시간이 8시간이다

이 때문에 ML CI/CD는 단순히 "코드 변경에 반응"하는 것을 넘어서 "데이터 변경에도 반응"해야 한다.

### 비결정성 (Non-Determinism)

딥러닝 모델 학습은 GPU의 병렬 연산 순서, 랜덤 시드, 배치 순서 등에 의해 결과가 달라질 수 있다. 같은 코드와 데이터로 두 번 학습해도 정확도가 0.3% 정도 차이날 수 있다. 이는 전통적인 CI/CD의 "재현 가능성" 원칙과 충돌한다.

실무에서는 다음과 같이 대응한다.

- **랜덤 시드 고정**: `torch.manual_seed(42)`, `np.random.seed(42)` 등
- **성능 범위(band)로 평가**: 단일 임계값 대신 ±0.5% 범위 허용
- **여러 번 실행 후 평균**: 중요한 모델은 3회 학습 후 평균 성능으로 판단

### 학습 시간의 문제

단위 테스트는 수십 초 내에 끝나지만, 대형 모델 재학습은 수 시간이 걸린다. 모든 PR마다 전체 재학습을 트리거하면 비용이 폭발한다. ML CI/CD는 어떤 변경이 재학습을 필요로 하는지 **똑똑하게 감지**해야 한다.

---

## ML CI/CD의 3요소

구글의 MLOps 실천 가이드에서는 ML 자동화를 세 단계로 정의한다.

### CI — Continuous Integration

코드와 데이터가 변경될 때 자동으로 테스트를 실행한다.

- 피처 변환 함수 단위 테스트
- 데이터 스키마 유효성 검사
- 모델 코드 통합 테스트
- 파이프라인 컴포넌트 연결 검증

### CD — Continuous Delivery / Deployment

검증된 모델을 자동으로 배포한다.

- 모델 레지스트리 등록
- 스테이징 환경 배포
- 카나리 릴리스 (5% → 50% → 100% 트래픽)
- 프로덕션 전체 롤아웃

### CT — Continuous Training

데이터나 모델 성능 변화에 따라 자동으로 재학습한다. 이것이 ML CI/CD에만 존재하는 세 번째 요소다.

- 스케줄 기반: 매주 월요일 새벽 2시 재학습
- 드리프트 기반: 데이터 분포 변화가 감지되면 즉시 재학습
- 성능 기반: 모델 정확도가 기준치 이하로 떨어지면 재학습

![ML CI/CD 파이프라인](/assets/posts/mlops-ci-cd-pipeline.svg)

---

## 테스트 피라미드 전략

소프트웨어 공학의 테스트 피라미드를 ML 시스템에 맞게 재구성하면 4계층이 된다.

![ML 시스템 테스트 피라미드](/assets/posts/mlops-ci-cd-tests.svg)

### 1계층: 단위 테스트 (Unit Tests)

가장 빠르고 가장 많아야 한다. 수백 개의 테스트가 수십 초 안에 완료되어야 한다.

```python
# tests/unit/test_features.py
import pytest
import numpy as np
from src.features import normalize_price, encode_category

def test_normalize_price_범위_검증():
    """정규화 후 값이 0-1 사이에 있어야 한다"""
    prices = np.array([100, 500, 1000, 2000, 5000])
    normalized = normalize_price(prices)
    assert normalized.min() >= 0.0
    assert normalized.max() <= 1.0

def test_normalize_price_단일값():
    """단일 값은 0으로 정규화되어야 한다"""
    result = normalize_price(np.array([500]))
    assert result[0] == 0.0

def test_encode_category_알수없는_카테고리():
    """학습 시 없던 카테고리는 'unknown'으로 처리"""
    result = encode_category("존재하지않는카테고리")
    assert result == encode_category("unknown")

def test_encode_category_대소문자_무시():
    """카테고리 인코딩은 대소문자를 구분하지 않아야 한다"""
    assert encode_category("Electronics") == encode_category("electronics")
```

### 2계층: 통합 테스트 (Integration Tests)

파이프라인 전체를 소규모 데이터로 실행한다. 수십 개, 수분 내 완료.

```python
# tests/integration/test_pipeline.py
def test_training_pipeline_전체_실행():
    """소규모 데이터로 파이프라인 전체가 오류 없이 실행되어야 한다"""
    # 소규모 테스트 데이터 준비
    test_data = load_fixture("tests/fixtures/small_dataset.csv")

    # 파이프라인 실행
    pipeline = TrainingPipeline(config="tests/config/test.yaml")
    result = pipeline.run(data=test_data)

    # 결과 검증
    assert result.model is not None
    assert result.metrics["val_accuracy"] > 0.0
    assert "model_path" in result.artifacts

def test_api_서빙_예측_포맷():
    """API 응답이 정의된 스키마와 일치해야 한다"""
    client = TestClient(app)
    response = client.post("/predict", json={"user_id": 123, "item_id": 456})

    assert response.status_code == 200
    data = response.json()
    assert "prediction" in data
    assert "confidence" in data
    assert 0.0 <= data["confidence"] <= 1.0
```

### 3계층: 모델 테스트 (Model Tests)

실제 모델 성능을 검증한다. 몇 개의 핵심 테스트만, 수십 분 소요.

```python
# tests/model/test_performance.py
def test_성능_회귀_검사():
    """현재 모델이 베이스라인보다 성능이 낮아지면 실패"""
    baseline_accuracy = 0.913  # 프로덕션 챔피언 모델
    current_accuracy = evaluate_model(current_model, test_dataset)
    assert current_accuracy >= baseline_accuracy - 0.005  # 0.5% 허용 범위

def test_공정성_검사_성별():
    """남성/여성 그룹 간 정확도 차이가 5% 이내여야 한다"""
    male_acc = evaluate_on_slice(model, test_data, gender="male")
    female_acc = evaluate_on_slice(model, test_data, gender="female")
    assert abs(male_acc - female_acc) < 0.05

def test_슬라이스_분석_신규_사용자():
    """신규 사용자 세그먼트에서 최소 80% 정확도"""
    new_user_data = test_data[test_data["user_age_days"] < 7]
    accuracy = evaluate_model(model, new_user_data)
    assert accuracy >= 0.80
```

### 4계층: E2E / 섀도우 테스트

실제 프로덕션 트래픽으로 테스트. 1-2개의 테스트, 실시간 병렬 실행.

```python
# 섀도우 모드: 실제 요청을 새 모델에도 동시에 보내되 응답은 사용하지 않음
class ShadowProxy:
    def __init__(self, production_model, shadow_model):
        self.prod = production_model
        self.shadow = shadow_model

    def predict(self, request):
        # 프로덕션 결과 반환 (사용자에게)
        prod_result = self.prod.predict(request)

        # 섀도우 결과는 비동기로 로깅만 (사용자에게 영향 없음)
        asyncio.create_task(
            self._log_shadow(request, prod_result)
        )

        return prod_result

    async def _log_shadow(self, request, prod_result):
        shadow_result = self.shadow.predict(request)
        metrics.log_comparison(prod_result, shadow_result)
```

---

## GitHub Actions로 ML 파이프라인 구축

GitHub Actions는 가장 진입 장벽이 낮은 ML CI/CD 도구다. 다음은 실전에서 사용하는 전체 파이프라인이다.

```yaml
# .github/workflows/ml-pipeline.yml
name: ML Pipeline

on:
  push:
    paths:
      - 'src/**'
      - 'data/**'

jobs:
  test-and-train:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: 데이터 유효성 검사
        run: python scripts/validate_data.py

      - name: 단위 테스트
        run: pytest tests/unit/ -v

      - name: 모델 재학습
        run: python train.py --config config/prod.yaml

      - name: 성능 게이트
        run: |
          python evaluate.py --threshold 0.92
          # 기준 미달시 파이프라인 중단

      - name: 모델 레지스트리 등록
        run: python register_model.py
```

### 실전 팁: 트리거 조건 세분화

모든 변경에 전체 파이프라인을 돌리면 비용이 크다. 변경 유형에 따라 다른 파이프라인을 트리거하는 것이 좋다.

```yaml
on:
  push:
    paths:
      - 'src/features/**'  # 피처 변경 → 단위 테스트 + 재학습
      - 'src/model/**'     # 모델 아키텍처 변경 → 전체 파이프라인
      - 'data/schema.yaml' # 스키마 변경 → 데이터 검증 + 재학습
      - 'config/**'        # 설정 변경 → 통합 테스트만
```

### 실전 팁: 재학습을 클라우드 잡으로 오프로딩

GitHub Actions 러너는 GPU가 없다. 실제 모델 학습은 별도 클라우드 잡으로 위임한다.

```yaml
- name: Vertex AI 학습 잡 트리거
  run: |
    gcloud ai custom-jobs create \
      --region=us-central1 \
      --display-name="ci-train-${{ github.sha }}" \
      --config=vertex_config.yaml \
      --args="--config=config/prod.yaml,--run-id=${{ github.sha }}"

- name: 학습 완료 대기
  run: python scripts/wait_for_job.py --job-id $JOB_ID --timeout 7200
```

---

## 성능 게이트 (Performance Gate) 구현

성능 게이트는 ML CI/CD에서 가장 핵심적인 컴포넌트다. 새 모델이 기존 챔피언 모델보다 성능이 좋을 때만 배포를 진행한다.

```python
import mlflow
import sys

def performance_gate(run_id: str, threshold: float = 0.92):
    client = mlflow.tracking.MlflowClient()
    run = client.get_run(run_id)
    accuracy = float(run.data.metrics["val_accuracy"])

    if accuracy < threshold:
        print(f"FAIL: accuracy {accuracy:.4f} < {threshold}")
        sys.exit(1)  # CI 실패 처리

    print(f"PASS: accuracy {accuracy:.4f} >= {threshold}")
```

### 챔피언/챌린저 비교

단순 임계값보다 더 견고한 방법은 현재 프로덕션 모델(챔피언)과 직접 비교하는 것이다.

```python
def champion_challenger_gate(challenger_run_id: str,
                              champion_model_name: str = "prod-recommendation"):
    client = mlflow.tracking.MlflowClient()

    # 현재 프로덕션 챔피언의 성능 조회
    champion_version = client.get_latest_versions(
        champion_model_name, stages=["Production"]
    )[0]
    champion_run = client.get_run(champion_version.run_id)
    champion_acc = float(champion_run.data.metrics["val_accuracy"])

    # 챌린저 성능 조회
    challenger_run = client.get_run(challenger_run_id)
    challenger_acc = float(challenger_run.data.metrics["val_accuracy"])

    delta = challenger_acc - champion_acc
    print(f"챔피언: {champion_acc:.4f}")
    print(f"챌린저: {challenger_acc:.4f}")
    print(f"개선율: {delta:+.4f} ({delta/champion_acc*100:+.2f}%)")

    if delta < -0.002:  # 챔피언보다 0.2% 이상 성능 저하 시 실패
        print("FAIL: 챌린저가 챔피언보다 성능이 낮습니다")
        sys.exit(1)

    if delta >= 0.005:  # 0.5% 이상 개선 시 적극 배포 권고
        print("EXCELLENT: 유의미한 성능 개선 확인!")
    else:
        print("PASS: 성능 유지 확인, 배포 진행")
```

### 다중 메트릭 게이트

단일 정확도 지표만 보는 것은 위험하다. 실무에서는 여러 메트릭을 종합적으로 평가한다.

```python
GATES = {
    "val_accuracy":  {"min": 0.92,  "weight": 0.4},
    "val_f1":        {"min": 0.88,  "weight": 0.3},
    "val_auc":       {"min": 0.95,  "weight": 0.2},
    "inference_p99": {"max": 100.0, "weight": 0.1},  # ms
}

def multi_metric_gate(run_id: str) -> bool:
    client = mlflow.tracking.MlflowClient()
    metrics = client.get_run(run_id).data.metrics
    passed = True

    for metric_name, gate in GATES.items():
        value = metrics.get(metric_name, None)
        if value is None:
            print(f"ERROR: {metric_name} 메트릭이 기록되지 않았습니다")
            return False

        if "min" in gate and value < gate["min"]:
            print(f"FAIL [{metric_name}]: {value:.4f} < {gate['min']}")
            passed = False
        elif "max" in gate and value > gate["max"]:
            print(f"FAIL [{metric_name}]: {value:.4f} > {gate['max']}")
            passed = False
        else:
            print(f"PASS [{metric_name}]: {value:.4f}")

    return passed
```

---

## Kubeflow Pipelines와의 통합

대규모 ML 시스템에서는 GitHub Actions 대신 Kubeflow Pipelines나 Vertex AI Pipelines를 사용한다. GitHub Actions는 오케스트레이터 역할만 하고, 실제 ML 작업은 쿠버네티스 클러스터에서 실행된다.

```python
# pipeline.py — Kubeflow Pipeline 정의
from kfp import dsl
from kfp.components import func_to_container_op

@dsl.pipeline(
    name="ML Training Pipeline",
    description="데이터 검증 → 학습 → 평가 → 등록"
)
def ml_training_pipeline(
    data_path: str,
    model_name: str,
    accuracy_threshold: float = 0.92
):
    # 컴포넌트 1: 데이터 검증
    validate_op = validate_data_component(data_path=data_path)

    # 컴포넌트 2: 학습 (검증 통과 후)
    train_op = train_model_component(
        data_path=data_path,
        config="config/prod.yaml"
    ).after(validate_op)

    # GPU 리소스 요청
    train_op.set_gpu_limit(1)
    train_op.set_memory_limit("16Gi")

    # 컴포넌트 3: 평가 및 게이트
    evaluate_op = evaluate_model_component(
        model_path=train_op.outputs["model_path"],
        threshold=accuracy_threshold
    ).after(train_op)

    # 컴포넌트 4: 조건부 등록 (성능 게이트 통과 시에만)
    with dsl.Condition(evaluate_op.outputs["passed"] == "true"):
        register_op = register_model_component(
            model_path=train_op.outputs["model_path"],
            model_name=model_name,
            metrics=evaluate_op.outputs["metrics"]
        )
```

### GitOps 패턴: 코드로 인프라 관리

ML CI/CD에서 GitOps는 모델 배포 설정도 Git으로 관리한다는 원칙이다.

```yaml
# model-deployment.yaml (Git으로 버전 관리)
apiVersion: serving.kserve.io/v1beta1
kind: InferenceService
metadata:
  name: recommendation-model
  namespace: ml-serving
spec:
  predictor:
    model:
      modelFormat:
        name: mlflow
      storageUri: "gs://my-bucket/models/recommendation/v42"
      resources:
        requests:
          cpu: "2"
          memory: "4Gi"
        limits:
          nvidia.com/gpu: "1"
```

CI/CD 파이프라인은 이 파일을 자동으로 업데이트하고 `git commit`한다. ArgoCD 같은 도구가 Git 변경을 감지해 자동으로 클러스터에 적용한다.

---

## 실전 체크리스트

ML CI/CD 파이프라인을 구축할 때 반드시 확인해야 할 항목들이다.

**데이터 검증**
- [ ] 스키마 유효성 검사 (컬럼, 타입, 범위)
- [ ] 결측치/이상치 비율 임계값 설정
- [ ] 학습/서빙 피처 분포 일치 확인

**모델 학습**
- [ ] 랜덤 시드 고정
- [ ] 하이퍼파라미터 버전 관리 (config 파일)
- [ ] 학습 로그 및 메트릭 중앙 수집

**성능 게이트**
- [ ] 다중 메트릭 평가 (정확도, F1, AUC)
- [ ] 챔피언 대비 성능 회귀 방지
- [ ] 슬라이스별 공정성 검사

**배포**
- [ ] 카나리 릴리스 (트래픽 점진적 전환)
- [ ] 자동 롤백 조건 설정
- [ ] 배포 후 모니터링 알림 연결

---

## 정리

ML CI/CD는 전통적인 CI/CD에 **Continuous Training(CT)** 이라는 세 번째 요소가 추가된다. 핵심은 데이터 변경도 코드 변경처럼 자동화 파이프라인을 트리거해야 한다는 점이다.

테스트 피라미드의 원칙을 ML에 적용하면 빠른 단위 테스트가 기반을 이루고, 느리지만 중요한 모델 성능 테스트가 그 위에 올라간다. 성능 게이트는 단순 임계값보다 챔피언/챌린저 비교가 더 견고하다.

GitHub Actions는 소규모 팀의 시작점으로 적합하고, 스케일이 커지면 Kubeflow Pipelines나 Vertex AI Pipelines로 이전하는 것이 자연스러운 경로다.

다음 글에서는 배포 이후 프로덕션에서 모델을 감시하는 **모델 모니터링**을 다룬다.

---

**지난 글:** [모델 레지스트리: 모델 생애주기 관리](/posts/mlops-model-registry/)

**다음 글:** [모델 모니터링: 프로덕션 ML 감시](/posts/mlops-monitoring/)

읽어주셔서 감사합니다. 😊
