---
title: "MLOps 실험 트래킹: 재현 가능한 ML 개발"
description: "MLflow, W&B, Neptune으로 실험을 체계적으로 관리하고, 하이퍼파라미터·메트릭·아티팩트를 추적하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 6
type: "knowledge"
category: "AI"
tags: ["실험트래킹", "MLflow", "WandB", "Neptune", "실험재현성", "하이퍼파라미터", "아티팩트관리"]
featured: false
draft: false
---

[지난 글](/posts/mlops-overview/)에서 MLOps의 큰 그림을 살펴보았다. 이번에는 그 첫 번째 핵심 컴포넌트인 **실험 트래킹**을 깊이 파고든다.

다음 상황을 상상해보자. 지난달 어떤 모델 조합이 가장 높은 정확도를 냈는지 팀원이 물어본다. 당신은 Jupyter 노트북을 뒤지고, 깃 로그를 뒤지고, 슬랙 메시지를 검색한다. 그리고 결국 "아마 이 파라미터였을 거야"라고 답한다. 이것이 실험 트래킹이 없는 ML 개발의 현실이다.

실험 트래킹은 **누가, 언제, 어떤 데이터로, 어떤 파라미터로, 어떤 결과를 냈는지** 체계적으로 기록하는 행위다. MLOps 성숙도의 첫 번째 관문이며, 도입 비용 대비 ROI가 가장 높은 실천이다.

---

## 실험 트래킹이 필요한 이유

### 재현 가능성

ML 개발에서 "재현 가능한 결과"는 과학적 엄밀성이기도 하지만 실용적 필수 조건이기도 하다. 프로덕션에서 이슈가 생겼을 때 "그때 그 모델"을 다시 만들 수 있어야 한다. 이를 위해서는 다음이 기록되어야 한다.

- 어떤 데이터셋 버전을 사용했는가
- 어떤 코드 버전(Git 커밋)을 사용했는가
- 어떤 하이퍼파라미터를 사용했는가
- 어떤 환경(라이브러리 버전, 하드웨어)에서 실행했는가

이 네 가지가 기록되어야 동일한 실험을 재현할 수 있다.

### 팀 협업

혼자 하는 ML 프로젝트는 드물다. 데이터 사이언티스트 여러 명이 병렬로 실험을 진행할 때, 각자의 결과를 한 곳에서 비교할 수 있어야 한다. 실험 트래킹 대시보드는 팀의 집단 지식을 축적하는 공간이다.

### 빠른 이터레이션

좋은 모델은 수백 번의 실험 끝에 나온다. 실험 결과가 체계적으로 정리되어 있으면 "어떤 방향이 효과적이었는가"를 빠르게 파악하고 다음 실험 방향을 결정할 수 있다. 기록 없이는 같은 실수를 반복하게 된다.

---

## 추적해야 할 3가지

![실험 트래킹 흐름](/assets/posts/mlops-experiment-tracking-flow.svg)

실험 트래킹은 크게 세 가지 요소를 기록한다.

### 1. 파라미터 (Parameters)

모델을 만들기 전에 결정하는 값들이다. 학습 중에 변경되지 않는다.

- **모델 하이퍼파라미터**: learning_rate, batch_size, epochs, dropout_rate, n_estimators, max_depth
- **데이터 파라미터**: train/val/test 분할 비율, 데이터 증강 설정
- **아키텍처 파라미터**: 레이어 수, 히든 차원, attention_heads
- **학습 설정**: optimizer 종류, 스케줄러 종류

파라미터는 실험의 "입력"이다. 동일한 파라미터로 동일한 데이터를 학습하면 (결정론적 환경에서) 동일한 결과가 나와야 한다.

### 2. 메트릭 (Metrics)

학습 중과 학습 후에 측정되는 수치들이다.

- **학습 메트릭**: 에폭별 train_loss, val_loss, accuracy
- **평가 메트릭**: 테스트셋 기준 F1, AUC-ROC, precision, recall
- **시스템 메트릭**: GPU 사용률, 학습 시간, 메모리 사용량
- **비즈니스 메트릭**: 도메인 특화 KPI (예: 사기 탐지의 경우 false negative rate)

메트릭은 에폭 단위로 스텝(step)과 함께 기록해야 학습 곡선을 시각화할 수 있다.

### 3. 아티팩트 (Artifacts)

실험에서 생성된 파일들이다.

- **모델 파일**: `model.pkl`, `model.pt`, SavedModel
- **시각화**: 혼동 행렬, ROC 커브, 학습 곡선 그래프
- **데이터**: 전처리된 피처 파일, 검증 샘플
- **설정 파일**: config.yaml, requirements.txt

아티팩트는 실험 재현과 디버깅에 필수적이다.

---

## MLflow 실전 가이드

MLflow는 Databricks가 오픈소스로 공개한 ML 실험 관리 플랫폼이다. 파이썬 패키지 하나로 시작할 수 있고, 자체 호스팅이 가능해 온프레미스 환경에 적합하다.

### MLflow 핵심 개념

- **Experiment**: 연관된 실험들의 묶음. 예: "fraud-detection-v2"
- **Run**: 실험 내의 개별 실행. 각 Run은 고유한 Run ID를 가짐
- **Artifact Store**: 모델·파일을 저장하는 스토리지 (로컬, S3, GCS)
- **Model Registry**: 모델 버전을 관리하고 프로덕션 승격을 관리

### 설치 및 기본 사용

```bash
pip install mlflow scikit-learn
mlflow ui  # 로컬 대시보드 실행 (http://localhost:5000)
```

### 감성 분류 모델 예제

```python
import mlflow

# 실험 생성
mlflow.set_experiment("sentiment-clf")

with mlflow.start_run(run_name="bert-base-v3"):
    # 파라미터 로깅
    mlflow.log_params({
        "model": "bert-base-multilingual",
        "lr": 2e-5,
        "epochs": 3,
        "batch_size": 32,
    })
    
    for epoch in range(3):
        loss = train_epoch(model, train_loader)
        acc  = evaluate(model, val_loader)
        # 메트릭 로깅
        mlflow.log_metrics(
            {"loss": loss, "val_acc": acc}, step=epoch
        )
    
    # 아티팩트 저장
    mlflow.pytorch.log_model(model, "bert-model")
    mlflow.log_artifact("confusion_matrix.png")
```

`with mlflow.start_run()` 블록이 핵심이다. 블록이 끝나면 Run이 완료 상태로 기록된다. 예외가 발생하면 자동으로 FAILED 상태로 기록된다.

### 자동 로깅

대부분의 주요 ML 프레임워크는 `mlflow.autolog()`를 지원한다. 단 한 줄로 파라미터·메트릭·아티팩트를 자동 기록한다.

```python
import mlflow
import mlflow.sklearn

mlflow.autolog()  # 이 한 줄이면 충분

from sklearn.ensemble import GradientBoostingClassifier
model = GradientBoostingClassifier(n_estimators=200, learning_rate=0.1)
model.fit(X_train, y_train)  # 자동으로 모든 것이 기록됨
```

PyTorch, TensorFlow, XGBoost, LightGBM, scikit-learn 모두 autolog를 지원한다.

### 모델 레지스트리

좋은 모델을 찾으면 레지스트리에 등록해 버전을 관리한다.

```python
# 모델 등록
model_uri = f"runs:/{run_id}/bert-model"
mlflow.register_model(model_uri, "sentiment-bert")

# 프로덕션으로 승격
client = mlflow.tracking.MlflowClient()
client.transition_model_version_stage(
    name="sentiment-bert",
    version=3,
    stage="Production"
)

# 프로덕션 모델 로드
model = mlflow.pytorch.load_model("models:/sentiment-bert/Production")
```

스테이지는 None → Staging → Production → Archived로 관리된다. 팀 내 리뷰 프로세스와 연동해 승격 권한을 제어할 수 있다.

---

## W&B로 딥러닝 실험 관리

Weights & Biases(W&B)는 딥러닝 연구자와 팀에서 가장 인기 있는 실험 트래킹 도구다. 실시간 시각화와 팀 협업 기능이 강점이다.

```python
import wandb

wandb.init(project="sentiment-clf", name="bert-base-v3",
           config={"lr": 2e-5, "epochs": 3})

for epoch in range(config.epochs):
    loss = train_epoch(model, train_loader)
    wandb.log({"loss": loss, "epoch": epoch})

wandb.finish()
```

`wandb.init()`으로 실험을 시작하고, `wandb.log()`로 딕셔너리 형태의 메트릭을 기록한다. 코드 실행과 동시에 W&B 대시보드에서 학습 곡선이 실시간으로 그려진다.

### W&B Sweeps: 하이퍼파라미터 자동 최적화

W&B의 독보적인 기능 중 하나는 Sweeps다. 베이지안 최적화, 그리드 서치, 랜덤 서치를 YAML 설정 하나로 실행한다.

```yaml
# sweep.yaml
method: bayes
metric:
  name: val_acc
  goal: maximize
parameters:
  lr:
    distribution: log_uniform_values
    min: 1e-5
    max: 1e-2
  batch_size:
    values: [16, 32, 64]
  dropout:
    distribution: uniform
    min: 0.1
    max: 0.5
```

```bash
wandb sweep sweep.yaml        # Sweep ID 생성
wandb agent <sweep-id>        # 에이전트 실행 (여러 머신에서 병렬 실행 가능)
```

베이지안 최적화는 이전 실험 결과를 보고 다음으로 시도할 파라미터를 선택한다. 수백 번의 그리드 서치 대신 수십 번의 시도로 좋은 파라미터를 찾을 수 있다.

### W&B Artifacts

W&B는 모델과 데이터셋도 버전 관리한다.

```python
# 데이터셋 아티팩트 기록
artifact = wandb.Artifact("train-dataset", type="dataset")
artifact.add_file("data/train.csv")
run.log_artifact(artifact)

# 모델 아티팩트 기록
model_artifact = wandb.Artifact("bert-model", type="model")
model_artifact.add_file("model.pt")
run.log_artifact(model_artifact)

# 이전 아티팩트 사용
artifact = run.use_artifact("train-dataset:latest")
artifact.download()
```

W&B Artifacts는 데이터-실험-모델 간의 계보(lineage)를 추적한다. 어떤 데이터로 어떤 모델을 만들었는지 그래프로 시각화된다.

---

## 실험 비교와 최적 모델 선정

![주요 실험 트래킹 도구 비교](/assets/posts/mlops-experiment-tracking-tools.svg)

실험 트래킹의 목적은 결국 **여러 실험 중 최선의 모델을 찾는 것**이다.

### MLflow로 실험 비교하기

```python
client = mlflow.tracking.MlflowClient()

# 실험 내 모든 Run 조회 (val_acc 기준 내림차순)
runs = client.search_runs(
    experiment_ids=["1"],
    order_by=["metrics.val_acc DESC"],
    max_results=10
)

for run in runs:
    print(f"Run ID: {run.info.run_id}")
    print(f"  val_acc: {run.data.metrics['val_acc']:.4f}")
    print(f"  lr: {run.data.params['lr']}")
    print(f"  batch_size: {run.data.params['batch_size']}")
```

### 챔피언-챌린저 패턴

프로덕션에는 항상 현재 최선의 모델(챔피언)이 배포되어 있다. 새로운 실험 결과(챌린저)가 챔피언을 유의미하게 능가할 때만 교체한다.

```python
# 현재 챔피언 성능 조회
champion_version = client.get_model_version_by_alias("sentiment-bert", "champion")
champion_run = client.get_run(champion_version.run_id)
champion_acc = champion_run.data.metrics["val_acc"]

# 챌린저가 2% 이상 더 좋으면 승격
if challenger_acc > champion_acc * 1.02:
    client.set_registered_model_alias("sentiment-bert", "champion", challenger_version)
    print(f"챔피언 교체: {champion_acc:.4f} → {challenger_acc:.4f}")
```

### 도구 선택 가이드

세 도구는 서로 다른 상황에 최적화되어 있다.

**MLflow를 선택해야 할 때:**
- 자체 호스팅이 필요한 경우 (보안, 규정 준수)
- 온프레미스 환경
- 비용 최소화가 중요한 경우
- 이미 Databricks 생태계를 사용하는 경우

**W&B를 선택해야 할 때:**
- 딥러닝·LLM 연구 중심 팀
- 실시간 협업과 시각화가 중요한 경우
- 하이퍼파라미터 자동 최적화(Sweeps)가 필요한 경우
- 팀이 분산되어 있고 클라우드 기반 협업이 필요한 경우

**Neptune을 선택해야 할 때:**
- 대규모 기업 환경에서 실험 거버넌스가 중요한 경우
- 복잡한 메타데이터 구조와 쿼리가 필요한 경우
- 프로그래매틱 실험 비교와 분석이 중심인 경우

---

## 실전 팁: 좋은 실험 기록의 조건

### 1. 모든 실험에 이름을 붙여라

```python
with mlflow.start_run(run_name="bert-base-v3-aug-dropout0.3"):
```

`run_name`은 나중에 대시보드에서 실험을 찾을 때 핵심이다. `{모델}-{버전}-{주요변경사항}` 형식을 권장한다.

### 2. 태그를 활용하라

```python
mlflow.set_tags({
    "author": "minsu",
    "task": "sentiment-classification",
    "dataset_version": "v2.3",
    "git_commit": "a3f8b2c",
    "environment": "gpu-a100"
})
```

태그로 실험을 필터링하면 수백 개의 Run 중에서 원하는 실험을 빠르게 찾을 수 있다.

### 3. Git 커밋 해시를 항상 기록하라

```python
import subprocess
git_commit = subprocess.check_output(
    ["git", "rev-parse", "HEAD"]
).decode().strip()
mlflow.log_param("git_commit", git_commit)
```

6개월 후 어떤 코드 버전으로 실험했는지 정확히 재현하려면 Git 커밋 해시가 필수다.

### 4. 실패한 실험도 기록하라

실패한 실험을 삭제하고 싶은 충동이 들지만, 어떤 방향이 효과가 없었는지 아는 것도 귀중한 정보다. 실패한 이유를 태그나 노트로 남겨두면 같은 실수를 반복하지 않을 수 있다.

---

## 마치며

실험 트래킹은 MLOps의 가장 작은 단위이면서 가장 즉각적인 가치를 제공한다. MLflow 5줄, W&B 3줄이면 오늘부터 시작할 수 있다.

기억해야 할 핵심은 단순하다. **지금 하고 있는 실험을 미래의 당신이 재현할 수 있는가?** 그 질문에 "예스"라고 답할 수 있게 되는 것이 실험 트래킹의 목표다.

다음 글에서는 MLOps의 또 다른 핵심인 피처 스토어를 다룬다. 학습-서빙 스큐 문제와 피처 재사용 전략을 실전 코드와 함께 살펴본다.

---

**지난 글:** [MLOps 완전 정복: 머신러닝을 프로덕션으로](/posts/mlops-overview/)
**다음 글:** [피처 스토어: 피처 재사용과 일관성 확보](/posts/mlops-feature-store/)

읽어주셔서 감사합니다. 😊
