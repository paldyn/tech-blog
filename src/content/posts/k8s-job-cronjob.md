---
title: "쿠버네티스 Job과 CronJob — 일회성·반복 작업"
description: "Kubernetes Job의 라이프사이클, parallelism과 completions 설정, 실패 처리 방법, CronJob의 스케줄 설정과 concurrencyPolicy를 실습 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 4
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "Job", "CronJob", "배치 처리", "스케줄", "completions", "parallelism"]
featured: false
draft: false
---

[지난 글](/posts/k8s-statefulset-storage-ops/)에서 StatefulSet 스토리지 운영을 살펴봤습니다. 이번에는 성격이 다른 **Job**과 **CronJob**을 다룹니다. Deployment나 StatefulSet은 계속 실행되는 서비스를 위한 오브젝트입니다. 반면 Job은 **완료되면 끝나는 일회성 작업**을 위한 오브젝트이고, CronJob은 이를 **스케줄에 따라 반복** 실행합니다.

## Job의 핵심 개념

Job은 하나 이상의 Pod를 생성하고, 지정한 횟수만큼 성공적으로 완료될 때까지 Pod 실행을 재시도합니다. 완료 후 Pod는 삭제되지 않고 `Completed` 상태로 남아 로그를 확인할 수 있습니다.

- **completions**: 성공해야 하는 Pod 수 (기본값: 1)
- **parallelism**: 동시에 실행할 Pod 수 (기본값: 1)
- **backoffLimit**: 실패 시 재시도 횟수 (기본값: 6)
- **activeDeadlineSeconds**: Job 전체 최대 실행 시간(초)

![Job 라이프사이클과 CronJob 스케줄](/assets/posts/k8s-job-cronjob-lifecycle.svg)

## Job YAML 기본 예시

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-backup
spec:
  completions: 1
  parallelism: 1
  backoffLimit: 3
  activeDeadlineSeconds: 300
  template:
    spec:
      containers:
      - name: backup
        image: postgres:15
        command:
        - /bin/bash
        - -c
        - pg_dump -h $DB_HOST -U $DB_USER mydb > /backup/$(date +%Y%m%d).sql
        env:
        - name: DB_HOST
          value: "postgres-svc"
        - name: DB_USER
          value: "admin"
      restartPolicy: Never
```

`restartPolicy`는 `Never` 또는 `OnFailure`만 허용됩니다. `Never`는 실패 시 새 Pod를 생성하고, `OnFailure`는 같은 Pod를 재시작합니다.

## 병렬 Job

데이터 처리나 마이그레이션처럼 여러 작업을 동시에 처리하고 싶을 때 `parallelism`과 `completions`를 조합합니다.

```yaml
spec:
  completions: 10      # 총 10번 성공해야 완료
  parallelism: 3       # 동시에 3개 Pod 실행
  backoffLimit: 5
  completionMode: Indexed  # 각 Pod에 인덱스 부여
```

`completionMode: Indexed`를 설정하면 각 Pod에 `JOB_COMPLETION_INDEX` 환경변수로 0~9 인덱스가 주어집니다. 이를 사용해 각 Pod가 서로 다른 데이터 범위를 처리하게 할 수 있습니다.

## Job 관리 명령어

```bash
# Job 목록 (COMPLETIONS 확인)
kubectl get jobs

# Job 상세 (이벤트, 조건 포함)
kubectl describe job db-backup

# Job이 생성한 Pod 확인
kubectl get pods -l job-name=db-backup

# Pod 로그 확인
kubectl logs -l job-name=db-backup

# 완료된 Job 삭제
kubectl delete job db-backup

# 완료된 Pod 자동 삭제 설정
```

`ttlSecondsAfterFinished`로 완료된 Job을 자동 삭제할 수 있습니다.

```yaml
spec:
  ttlSecondsAfterFinished: 3600  # 완료 후 1시간 뒤 삭제
```

![Job과 CronJob YAML 구조](/assets/posts/k8s-job-cronjob-yaml.svg)

## CronJob

CronJob은 지정한 스케줄에 따라 Job을 자동 생성합니다. Unix cron 표현식을 사용합니다.

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: daily-backup
spec:
  schedule: "0 3 * * *"          # 매일 오전 3시
  concurrencyPolicy: Forbid       # 이전 실행 중이면 스킵
  successfulJobsHistoryLimit: 3   # 성공 Job 이력 3개 유지
  failedJobsHistoryLimit: 1       # 실패 Job 이력 1개 유지
  startingDeadlineSeconds: 300    # 5분 내 시작 못 하면 스킵
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: postgres:15
            command: ["/bin/bash", "-c", "pg_dump ..."]
          restartPolicy: OnFailure
```

Cron 표현식 `"0 3 * * *"`는 분/시/일/월/요일 순서입니다. 몇 가지 예시:

| 표현식 | 의미 |
|--------|------|
| `"*/5 * * * *"` | 5분마다 |
| `"0 * * * *"` | 매시 정각 |
| `"0 3 * * *"` | 매일 오전 3시 |
| `"0 3 * * 0"` | 매주 일요일 오전 3시 |
| `"0 3 1 * *"` | 매월 1일 오전 3시 |
| `"@daily"` | 매일 자정 |

## concurrencyPolicy

이전 Job이 아직 실행 중일 때 새 스케줄 시각이 되면 어떻게 할지 결정합니다.

- **Allow** (기본값): 이전 Job이 완료되지 않아도 새 Job 생성
- **Forbid**: 이전 Job이 실행 중이면 새 Job 스킵
- **Replace**: 이전 Job을 삭제하고 새 Job 생성

배치 작업 중복 실행이 문제가 되는 경우(DB 백업, 청구서 발행 등)에는 `Forbid`를 사용합니다.

## CronJob 관리 명령어

```bash
# CronJob 목록
kubectl get cronjob

# CronJob이 생성한 Job 목록
kubectl get jobs -l job-name=daily-backup

# 즉시 수동 실행 (테스트 시)
kubectl create job manual-backup \
  --from=cronjob/daily-backup

# CronJob 일시 정지
kubectl patch cronjob daily-backup \
  -p '{"spec":{"suspend":true}}'

# 재개
kubectl patch cronjob daily-backup \
  -p '{"spec":{"suspend":false}}'
```

`suspend: true`는 CronJob을 삭제하지 않고 스케줄 실행만 중단합니다. 유지보수 기간에 유용합니다.

---

**지난 글:** [StatefulSet 스토리지 운영 — PVC 보존과 마이그레이션](/posts/k8s-statefulset-storage-ops/)

**다음 글:** [쿠버네티스 Init Container — 메인 컨테이너 시작 전 준비 작업](/posts/k8s-init-containers/)

<br>
읽어주셔서 감사합니다. 😊
