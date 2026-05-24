---
title: "ML 파이프라인 자동화: 끝까지 이어지는 워크플로우"
description: "Airflow, Kubeflow, Prefect를 비교하고 실무에서 ML 파이프라인을 설계·자동화하는 방법을 DAG 구조, 병렬 처리, CI/CD 연동까지 체계적으로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 2
type: "knowledge"
category: "AI"
tags: ["ML파이프라인", "Airflow", "Kubeflow", "Prefect", "MLOps", "DAG", "자동화"]
featured: false
draft: false
---

[지난 글](/posts/mlops-data-versioning/)에서 DVC로 데이터를 코드처럼 버전 관리하는 방법을 살펴봤다. 이번 글은 데이터 수집부터 모델 배포까지의 전 과정을 **자동화하는 ML 파이프라인**이다. 한 번 구축해두면 새 데이터가 쌓일 때마다 사람 손 없이 새 모델이 프로덕션에 올라가는 그림이다.

ML 파이프라인이 없으면 어떤 일이 벌어질까. 데이터 엔지니어가 매주 월요일 아침 8시에 S3에 새 파일을 업로드한다. ML 엔지니어가 알아채면 노트북을 열고, 전처리 스크립트를 손으로 실행하고, 학습을 돌리고, 메트릭을 보고, 괜찮으면 배포팀에 슬랙 메시지를 보낸다. 이 사람이 휴가 중이거나 다른 업무에 집중하면 새 모델은 2주 뒤에야 나온다. **파이프라인은 이 의존성을 사람에서 코드로 이전한다.**

## ML 파이프라인의 구조

![ML 파이프라인 전체 아키텍처](/assets/posts/mlops-pipeline-architecture.svg)

전형적인 ML 파이프라인은 다섯 단계로 구성된다.

1. **데이터 수집(Ingestion)**: DB 쿼리, API 호출, 이벤트 스트림에서 원시 데이터를 모은다
2. **전처리(Preprocessing)**: 결측값 처리, 정규화, 인코딩 등 정제 작업
3. **피처 엔지니어링**: 도메인 지식 기반 피처 생성, Feature Store에서 재사용 피처 조회
4. **학습(Training)**: GPU 클러스터에서 모델 학습, 하이퍼파라미터 튜닝
5. **평가·등록**: 성능 임계값 검증, 통과 시 모델 레지스트리 등록 → 배포

## 오케스트레이터 선택: Airflow vs Kubeflow vs Prefect

```python
# 세 프레임워크의 철학 차이

# Airflow: DAG 클래스 + Operator
from airflow import DAG
from airflow.operators.python import PythonOperator

with DAG("ml_pipeline", schedule_interval="@weekly") as dag:
    fetch = PythonOperator(task_id="fetch", python_callable=fetch_data)
    train = PythonOperator(task_id="train", python_callable=train_model)
    fetch >> train  # >> 연산자로 의존성 선언

# Prefect: 데코레이터로 일반 Python 함수를 파이프라인으로
from prefect import flow, task

@task(retries=3, retry_delay_seconds=60)
def fetch_data(): ...

@flow
def ml_pipeline():
    data = fetch_data()
    train_model(data)  # 반환값을 넘기면 의존성 자동 추론
```

**Airflow**는 가장 성숙한 선택지다. 대기업 데이터 팀 대부분이 사용한다. 단점은 UI 설정과 Operator 학습 곡선이 가파르고, 로컬 개발이 번거롭다는 점이다. **Prefect**는 일반 Python 코드를 거의 그대로 파이프라인으로 전환할 수 있어 ML 엔지니어 친화적이다. **Kubeflow Pipelines**는 Kubernetes 환경에서 GPU 자원 관리와 컨테이너 격리가 탁월하지만 인프라 세팅 비용이 크다.

## Airflow DAG 상세 설계

![Airflow DAG: 병렬 학습 파이프라인](/assets/posts/mlops-pipeline-dag.svg)

핵심은 **fan-out/fan-in 패턴**이다. 데이터 검증 후 두 전처리 단계를 병렬로 실행하고, 둘 다 완료되면 학습을 시작한다. 평가 결과에 따라 성공 경로(등록·배포)와 실패 경로(알림)로 분기한다.

```python
from airflow import DAG
from airflow.operators.python import PythonOperator, BranchPythonOperator
from airflow.providers.slack.operators.slack_webhook import SlackWebhookOperator
from datetime import datetime, timedelta

default_args = {
    "retries": 2,
    "retry_delay": timedelta(minutes=5),
    "email_on_failure": True,
}

with DAG(
    "ml_weekly_retrain",
    default_args=default_args,
    schedule_interval="0 2 * * 1",  # 매주 월요일 02:00
    start_date=datetime(2026, 1, 1),
    catchup=False,
) as dag:

    fetch = PythonOperator(task_id="fetch_data", python_callable=fetch_data)
    validate = PythonOperator(task_id="validate_data", python_callable=validate)
    preproc_a = PythonOperator(task_id="preprocess_a", python_callable=preprocess_a)
    preproc_b = PythonOperator(task_id="preprocess_b", python_callable=preprocess_b)
    train = PythonOperator(task_id="train_model", python_callable=train)

    def check_metrics(**ctx):
        score = ctx["ti"].xcom_pull(task_ids="train_model")
        return "register" if score > 0.85 else "alert_fail"

    branch = BranchPythonOperator(task_id="check_metrics", python_callable=check_metrics)
    register = PythonOperator(task_id="register", python_callable=register_model)
    alert = SlackWebhookOperator(task_id="alert_fail", message="⚠️ 모델 성능 임계값 미달")

    fetch >> validate >> [preproc_a, preproc_b] >> train >> branch
    branch >> [register, alert]
```

## 트리거 전략

파이프라인을 언제 실행할지는 세 가지 전략이 있다.

- **시간 기반(Cron)**: 매일 자정, 매주 월요일처럼 고정 주기. 구현이 간단하고 예측 가능하다
- **데이터 기반**: 새 파일이 S3 버킷에 업로드되면 즉시 실행. S3 Event + Lambda + Airflow 트리거를 연결한다
- **성능 기반**: 모니터링에서 드리프트 감지 시 자동 재학습. 프로덕션 ML의 이상적인 형태다

```python
# 데이터 기반 트리거: S3FileSensor
from airflow.sensors.s3_key_sensor import S3KeySensor

wait_for_data = S3KeySensor(
    task_id="wait_for_data",
    bucket_key="s3://my-bucket/raw/{{ds}}/data.parquet",
    aws_conn_id="aws_default",
    poke_interval=300,  # 5분마다 확인
    timeout=3600,
)
wait_for_data >> validate
```

## 실패 복원력 설계

파이프라인에서 실패는 언제나 발생한다. 세 가지 패턴으로 복원력을 높인다.

**멱등성(Idempotency)**: 같은 파이프라인을 여러 번 실행해도 결과가 동일해야 한다. 출력 파일 저장 시 날짜·버전을 파일명에 포함하고, 덮어쓰기가 아닌 교체 방식으로 저장한다.

**부분 재실행**: Airflow에서 실패한 태스크만 `Clear`하고 재실행할 수 있다. DVC 파이프라인도 변경된 스텝만 재실행한다. 처음부터 전체를 다시 돌리지 않아도 된다.

**타임아웃·알림**: 학습 태스크에 4시간 타임아웃을 걸고, 초과 시 Slack·PagerDuty 알림을 발송한다. 조용히 실패하는 파이프라인보다 시끄럽게 실패하는 파이프라인이 훨씬 낫다.

## CI/CD와 파이프라인 코드 관리

파이프라인 코드도 일반 코드와 동일한 리뷰·테스트 프로세스를 거쳐야 한다.

```bash
# GitHub Actions: DAG 코드 변경 시 자동 검증
- name: Test DAG integrity
  run: |
    python -m pytest tests/test_dags.py -v

- name: Deploy DAGs to Airflow
  if: github.ref == 'refs/heads/main'
  run: |
    aws s3 sync dags/ s3://airflow-dags-bucket/ --delete
```

파이프라인 유닛 테스트에서는 실제 데이터 없이 mock을 사용하고, 태스크 간 XCom 전달이 올바른지, 의존성 체인이 의도대로 연결됐는지를 검증한다.

---

**지난 글:** [데이터 버전 관리: DVC로 ML 데이터를 코드처럼 추적하기](/posts/mlops-data-versioning/)

**다음 글:** [LLMOps 개요: LLM 운영의 새로운 과제](/posts/llmops-overview/)

<br>
읽어주셔서 감사합니다. 😊
