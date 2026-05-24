---
title: "데이터 버전 관리: DVC로 ML 데이터를 코드처럼 추적하기"
description: "DVC(Data Version Control)로 대용량 데이터셋을 Git처럼 버전 관리하고, 데이터 리니지를 추적하며, 실험을 재현 가능하게 만드는 MLOps 필수 기술을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 1
type: "knowledge"
category: "AI"
tags: ["DVC", "데이터버전관리", "MLOps", "데이터리니지", "실험재현성", "Git"]
featured: false
draft: false
---

[지난 글](/posts/mlops-monitoring/)에서 프로덕션 모델을 감시하는 모니터링 전략을 살펴봤다. 모니터링이 "현재"를 지키는 기술이라면, **데이터 버전 관리**는 "과거"로 돌아갈 수 있는 능력이다. 모델 성능이 갑자기 하락했을 때 "3주 전 데이터셋으로 롤백할 수 있는가?"라는 질문에 답할 수 있어야 한다.

ML 프로젝트에서 재현성 문제의 60% 이상은 데이터에서 비롯된다. 코드는 Git으로 완벽하게 추적하면서 정작 학습 데이터는 `data_final_v3_진짜최종.csv` 같은 파일명으로 관리하는 현실이 비일비재하다. 이 글에서는 **DVC(Data Version Control)** 를 중심으로 데이터를 코드처럼 관리하는 방법을 정리한다.

## 왜 데이터 버전 관리가 필요한가

Git은 바이너리 파일과 대용량 파일 추적에 적합하지 않다. 1GB 짜리 CSV를 `git add`하면 레포지토리가 수십 GB로 불어난다. 협업자가 `git clone`할 때마다 전체 데이터 히스토리를 내려받는다. 실제로 필요한 건 **"이 모델은 어떤 데이터로 학습됐는가"** 라는 메타데이터이지, 바이너리 자체가 아니다.

DVC는 이 문제를 정확히 해결한다. 실제 데이터는 S3·GCS 같은 원격 저장소에 두고, Git에는 가벼운 `.dvc` 포인터 파일만 커밋한다. 마치 Git LFS와 비슷하지만, ML 파이프라인 전체를 아우르는 더 넓은 추상화를 제공한다.

## DVC 핵심 개념

![DVC 데이터 버전 관리 흐름](/assets/posts/mlops-data-versioning-dvc-flow.svg)

### .dvc 파일: 가벼운 포인터

`dvc add data/train.csv`를 실행하면 두 가지 일이 일어난다.

1. `data/train.csv`가 `.gitignore`에 추가된다 (Git 추적 제외)
2. `data/train.csv.dvc`가 생성된다 (Git으로 추적할 메타데이터)

```yaml
# data/train.csv.dvc 내용 예시
outs:
  - md5: a1b2c3d4e5f6789012345678901234ab
    size: 524288000
    path: train.csv
```

이 `.dvc` 파일만 Git에 커밋하면 된다. 파일 크기는 수십 바이트에 불과하다. 나중에 `dvc pull`을 실행하면 md5 해시를 기반으로 정확한 버전의 데이터를 원격에서 복원한다.

### 원격 저장소 설정

```bash
# S3를 원격 캐시로 설정
dvc remote add -d myremote s3://my-bucket/dvc-cache

# GCS 사용 시
dvc remote add -d myremote gs://my-bucket/dvc-cache

# 로컬 테스트용
dvc remote add -d localremote /tmp/dvc-remote
```

## 기본 워크플로우

```bash
# 1. DVC 초기화
git init && dvc init

# 2. 데이터 추가
dvc add data/train.csv data/test.csv

# 3. Git에 포인터 파일 커밋
git add data/.gitignore data/train.csv.dvc data/test.csv.dvc
git commit -m "feat: add training dataset v1"
git tag v1-data

# 4. 실제 데이터를 원격에 업로드
dvc push

# 5. 다른 환경에서 복원
git clone <repo-url>
dvc pull  # 원격에서 데이터 다운로드
```

## 데이터 리니지와 파이프라인

단순 파일 추적을 넘어, DVC는 **전처리 → 학습 → 평가** 전체 파이프라인을 `dvc.yaml`로 정의한다. 각 단계의 입력·출력·명령어를 선언하면 DVC가 변경된 단계만 재실행하는 스마트 캐싱을 제공한다.

![데이터 리니지(Lineage) 추적](/assets/posts/mlops-data-versioning-lineage.svg)

```yaml
# dvc.yaml
stages:
  preprocess:
    cmd: python src/preprocess.py
    deps:
      - data/raw.csv
      - src/preprocess.py
    outs:
      - data/processed.csv

  train:
    cmd: python src/train.py
    deps:
      - data/processed.csv
      - src/train.py
    outs:
      - models/model.pkl
    metrics:
      - metrics/scores.json
```

이제 `dvc repro`를 실행하면 변경된 파일을 자동 감지하고 필요한 단계만 재실행한다. 데이터가 바뀌면 전처리와 학습이 재실행되고, 전처리 코드만 바뀌면 전처리부터 재실행된다.

## 실험 비교와 롤백

```bash
# 현재 상태 확인
dvc status

# 실험 메트릭 비교
dvc metrics show
dvc metrics diff HEAD~3  # 3 커밋 전과 비교

# 특정 버전으로 롤백
git checkout v1-data
dvc checkout  # 해당 태그의 데이터로 자동 복원
```

`dvc params diff`를 활용하면 하이퍼파라미터 변경 이력도 함께 추적할 수 있다. Git 태그와 DVC를 결합하면 "코드 + 데이터 + 파라미터 + 메트릭" 네 가지를 모두 버전 단위로 묶어 재현할 수 있다.

## MLflow와 통합

```python
import mlflow
import dvc.api

# DVC로 관리되는 데이터의 URL 조회
data_url = dvc.api.get_url("data/train.csv", rev="v2-data")

with mlflow.start_run():
    mlflow.set_tag("data_version", "v2-data")
    mlflow.set_tag("data_url", data_url)
    # ... 학습 코드
    mlflow.log_metrics({"accuracy": 0.87})
```

MLflow 실험 로그에 DVC 데이터 버전을 함께 기록하면, 나중에 특정 실험을 정확히 재현할 수 있다.

## 주요 명령어 요약

| 명령어 | 역할 |
|--------|------|
| `dvc add <file>` | 파일을 DVC 추적 대상으로 등록 |
| `dvc push` | 데이터를 원격 저장소에 업로드 |
| `dvc pull` | 원격에서 데이터 복원 |
| `dvc repro` | 변경된 파이프라인 단계만 재실행 |
| `dvc status` | 로컬·원격 동기화 상태 확인 |
| `dvc metrics show` | 파이프라인 메트릭 출력 |

## 실무 적용 팁

**대용량 파일 분할**: 단일 10GB 파일보다 샤딩된 1GB × 10 파일이 부분 업데이트에 유리하다. 변경된 샤드만 push/pull하면 되기 때문이다.

**CI/CD 연동**: GitHub Actions에서 `dvc pull`을 실행해 학습 데이터를 받아오고, 학습 완료 후 `dvc push`로 모델 아티팩트를 저장한다. 워크플로우 파일에 DVC remote 인증 정보는 GitHub Secrets로 관리한다.

**팀 규약 정립**: `.dvc` 파일은 반드시 코드 PR에 포함한다. 데이터 없이 `.dvc` 파일만 없는 PR은 CI에서 `dvc status`로 검증하는 훅을 추가하면 실수를 방지할 수 있다.

---

**지난 글:** [모델 모니터링: 프로덕션 ML 감시](/posts/mlops-monitoring/)

**다음 글:** [ML 파이프라인 자동화: 끝까지 이어지는 워크플로우](/posts/mlops-pipeline/)

<br>
읽어주셔서 감사합니다. 😊
