---
title: "Helm Hook — 배포 라이프사이클 확장"
description: "Helm Hook의 종류(pre-install, post-install, pre-upgrade, post-upgrade, pre-delete, post-delete, test), hook-weight로 순서 제어, hook-delete-policy로 정리 방법, DB 마이그레이션 Job 예시를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 10
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "Helm", "Hook", "Job", "라이프사이클", "배포 자동화"]
featured: false
draft: false
---

[지난 글](/posts/k8s-helm-charts-templating/)에서 Helm Go 템플릿의 함수·파이프라인·제어 흐름을 깊이 살펴봤다. 이번 글에서는 Helm **Hook**을 다룬다. Hook은 Chart 배포의 특정 시점(설치 전후, 업그레이드 전후, 삭제 전후)에 추가 작업을 실행할 수 있게 해주는 메커니즘이다. DB 스키마 마이그레이션, 인증서 생성, 외부 리소스 정리 등 배포 자동화에서 빠질 수 없는 기능이다.

## Hook이란 무엇인가

일반적인 `helm install`은 `templates/` 아래 모든 Kubernetes 리소스를 한꺼번에 API 서버로 보낸다. 하지만 실제 배포 시나리오에서는 순서가 중요하다.

- 애플리케이션 Pod가 뜨기 전에 DB 스키마를 먼저 마이그레이션해야 한다.
- 설치 완료 후 smoke test를 자동으로 실행하고 싶다.
- Release 삭제 전에 외부 클라우드 리소스(DNS, S3 버킷)를 정리해야 한다.

Hook은 Kubernetes Job, Pod 등 일반 manifest에 특수한 annotation을 추가하는 방식으로 동작한다. Helm은 이 annotation을 보고 해당 리소스를 일반 배포 흐름과 분리하여 지정된 시점에 실행한다.

![Helm Hook 라이프사이클 타임라인](/assets/posts/k8s-helm-hooks-lifecycle.svg)

## Hook의 종류

| Hook 이름 | 실행 시점 |
|---|---|
| `pre-install` | 리소스 생성 전 (install) |
| `post-install` | 모든 리소스 생성 후 (install) |
| `pre-upgrade` | 리소스 업데이트 전 (upgrade) |
| `post-upgrade` | 모든 리소스 업데이트 후 (upgrade) |
| `pre-delete` | 리소스 삭제 전 (uninstall) |
| `post-delete` | 모든 리소스 삭제 후 (uninstall) |
| `test` | `helm test` 명령 실행 시 |

하나의 리소스에 여러 hook을 콤마로 지정할 수 있다. 예를 들어 `pre-install,pre-upgrade`로 설정하면 설치와 업그레이드 모두 실행 전에 해당 Job이 동작한다.

## Hook 기본 사용법

Hook을 선언하는 방법은 간단하다. 일반 Kubernetes 리소스에 `helm.sh/hook` annotation을 추가한다.

```yaml
# templates/pre-install-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: "{{ .Release.Name }}-pre-install"
  annotations:
    "helm.sh/hook": pre-install
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": hook-succeeded
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: pre-install
        image: busybox
        command: ["sh", "-c", "echo 'Pre-install tasks complete'"]
```

Hook으로 지정된 리소스는 일반 배포 흐름에서 제외된다. `helm install`을 실행했을 때 `pre-install` hook Job은 나머지 Deployment, Service보다 먼저 실행되고, Job이 완료되어야 이후 단계로 진행된다.

## hook-weight로 실행 순서 제어

같은 hook 타입(예: `pre-install`)에 리소스가 여러 개 있을 때 실행 순서를 `hook-weight`로 지정한다. 값은 문자열 형식의 정수이며, **낮은 숫자가 먼저** 실행된다. 같은 weight면 이름 알파벳 순으로 실행된다.

```yaml
# 1단계: 시크릿 생성 (weight -10, 먼저)
metadata:
  annotations:
    "helm.sh/hook": pre-install
    "helm.sh/hook-weight": "-10"

# 2단계: DB 마이그레이션 (weight -5, 다음)
metadata:
  annotations:
    "helm.sh/hook": pre-install
    "helm.sh/hook-weight": "-5"

# 3단계: 데이터 시딩 (weight 0, 마지막)
metadata:
  annotations:
    "helm.sh/hook": pre-install
    "helm.sh/hook-weight": "0"
```

weight는 음수도 가능하다. 실무에서는 `-10`, `-5`, `0`, `5`, `10` 처럼 간격을 두고 설정해 나중에 중간에 새 hook을 끼워넣기 쉽게 한다.

## hook-delete-policy

Hook 리소스는 실행 후 기본적으로 클러스터에 남는다. 이는 디버깅을 위한 로그 확인에 유용하지만, 배포를 반복할수록 리소스가 누적된다. `hook-delete-policy`로 정리 방법을 지정한다.

| 정책 | 동작 |
|---|---|
| `before-hook-creation` | 새 hook 실행 전 이전 리소스 삭제 (기본값) |
| `hook-succeeded` | hook 성공 시 삭제 |
| `hook-failed` | hook 실패 시 삭제 |

여러 정책을 콤마로 조합할 수 있다.

```yaml
# 성공하면 즉시 정리, 실패하면 로그 보존
"helm.sh/hook-delete-policy": hook-succeeded

# 성공·실패 무관하게 항상 정리
"helm.sh/hook-delete-policy": hook-succeeded,hook-failed

# 다음 실행 전에만 정리 (로그 보존)
"helm.sh/hook-delete-policy": before-hook-creation
```

## 실전: DB 마이그레이션 Job

가장 흔한 Hook 사용 사례인 DB 마이그레이션을 살펴본다.

![DB 마이그레이션 Hook Job 예시](/assets/posts/k8s-helm-hooks-example.svg)

```yaml
# templates/db-migrate-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: "{{ .Release.Name }}-db-migrate"
  labels:
    {{- include "myapp.labels" . | nindent 4 }}
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": hook-succeeded
spec:
  backoffLimit: 2
  activeDeadlineSeconds: 300
  template:
    spec:
      restartPolicy: Never
      serviceAccountName: {{ include "myapp.serviceAccountName" . }}
      initContainers:
      - name: wait-for-db
        image: busybox
        command:
        - sh
        - -c
        - |
          until nc -z {{ .Values.db.host }} {{ .Values.db.port }}; do
            echo "Waiting for DB..."
            sleep 2
          done
      containers:
      - name: db-migrate
        image: {{ .Values.migration.image | quote }}
        imagePullPolicy: {{ .Values.migration.pullPolicy | default "IfNotPresent" }}
        command: ["python", "manage.py", "migrate", "--noinput"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: {{ .Release.Name }}-db-secret
              key: DATABASE_URL
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 256Mi
```

이 Job은 `pre-install`과 `pre-upgrade` 양쪽에서 실행되며, 성공하면 자동으로 삭제된다. `activeDeadlineSeconds: 300`을 지정해 마이그레이션이 5분을 초과하면 자동으로 실패 처리되도록 했다. `initContainers`로 DB 연결이 가능한지 먼저 확인해 Race Condition을 방지한다.

## test Hook

`helm test`는 Release가 올바르게 동작하는지 검증하는 명령이다. `test` hook을 달아 smoke test Pod를 선언한다.

```yaml
# templates/tests/connection-test.yaml
apiVersion: v1
kind: Pod
metadata:
  name: "{{ .Release.Name }}-connection-test"
  annotations:
    "helm.sh/hook": test
    "helm.sh/hook-delete-policy": hook-succeeded
spec:
  restartPolicy: Never
  containers:
  - name: test-connection
    image: curlimages/curl:8.1.0
    command:
    - sh
    - -c
    - |
      curl -f http://{{ include "myapp.fullname" . }}:{{ .Values.service.port }}/healthz
```

```bash
# Release 설치 후 테스트 실행
helm install my-app ./mychart
helm test my-app -n production

# 상세 로그 확인
helm test my-app -n production --logs
```

`helm test`는 CI/CD 파이프라인의 배포 후 검증 단계에서 활용하면 좋다. 테스트 Pod의 exit code 0이 성공, 0이 아닌 값이 실패다.

## Hook 리소스의 주의사항

### Hook은 Helm이 관리하지 않는다

일반 리소스는 `helm uninstall` 시 자동으로 삭제된다. 그러나 Hook 리소스는 `hook-delete-policy`가 없으면 클러스터에 그대로 남는다. 의도치 않게 namespace에 Job 잔재가 쌓이지 않도록 delete policy를 반드시 설정한다.

### Hook 실패 시 Release가 실패한다

`pre-install` hook Job이 실패하면 `helm install` 전체가 실패로 처리된다. 실패한 Release는 `helm rollback` 혹은 `helm uninstall`로 정리해야 한다.

```bash
# 실패한 Release 확인
helm list -n production --all

# 상태 확인
helm status my-app -n production

# 정리 후 재시도
helm uninstall my-app -n production
helm install my-app ./mychart -n production
```

### RBAC 고려

Hook Job이 다른 Kubernetes 리소스를 조회하거나 수정해야 한다면 별도 ServiceAccount와 RBAC Role을 함께 선언한다. 이때 ServiceAccount도 Hook으로 만들어 Job보다 먼저 생성되게 weight를 낮게 설정한다.

```yaml
# ServiceAccount (weight -10, Job보다 먼저)
metadata:
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "-10"
    "helm.sh/hook-delete-policy": before-hook-creation

# ClusterRoleBinding (weight -9)
metadata:
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "-9"
    "helm.sh/hook-delete-policy": before-hook-creation

# Migration Job (weight -5, 위 리소스 생성 후 실행)
metadata:
  annotations:
    "helm.sh/hook": pre-install,pre-upgrade
    "helm.sh/hook-weight": "-5"
    "helm.sh/hook-delete-policy": hook-succeeded
```

## post-delete Hook으로 외부 리소스 정리

클라우드 환경에서 `helm uninstall` 시 Kubernetes 리소스 외에도 DNS 레코드, S3 버킷, IAM Role 등 외부 리소스를 정리해야 하는 경우가 있다. `post-delete` hook을 활용한다.

```yaml
# templates/cleanup-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: "{{ .Release.Name }}-cleanup"
  annotations:
    "helm.sh/hook": post-delete
    "helm.sh/hook-weight": "0"
    "helm.sh/hook-delete-policy": hook-succeeded,hook-failed
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: cleanup
        image: amazon/aws-cli:2.x.x
        command:
        - sh
        - -c
        - |
          aws s3 rb s3://{{ .Values.s3.bucketName }}-{{ .Release.Namespace }} --force
          aws route53 change-resource-record-sets \
            --hosted-zone-id {{ .Values.dns.hostedZoneId }} \
            --change-batch file:///tmp/delete-record.json
```

`post-delete`는 `helm uninstall`로 모든 리소스가 삭제된 뒤에 실행되므로, 데이터 손실 위험이 있다. 프로덕션에서는 별도의 승인 과정을 거치거나 dry-run 모드를 먼저 실행하는 가드를 추가하는 것이 좋다.

## 실무 정리

Hook을 도입할 때 체크해야 할 사항을 정리한다.

1. **hook-delete-policy 필수** — 기본 `before-hook-creation`은 이전 Job 로그를 볼 수 없으므로, 개발 중엔 삭제 정책을 제거하고 성공/실패 확인 후 설정한다.
2. **activeDeadlineSeconds** — Hook Job에 항상 타임아웃을 설정해 영원히 실행 중 상태로 남는 것을 방지한다.
3. **idempotent 작업** — `pre-upgrade`는 여러 번 실행될 수 있다. DB 마이그레이션은 이미 적용된 마이그레이션을 건너뛰는 idempotent한 도구(Flyway, Alembic, Liquibase 등)를 사용한다.
4. **weight 간격** — `10`, `20`, `30` 등 간격을 두어 나중에 중간에 hook을 추가하기 쉽게 한다.
5. **helm test 통합** — 배포 파이프라인에서 `helm install` 뒤에 반드시 `helm test`를 실행해 애플리케이션이 정상 동작하는지 자동으로 검증한다.

```bash
# CI/CD 파이프라인 예시
helm upgrade --install my-app ./mychart \
  -n production \
  -f values-production.yaml \
  --wait \
  --timeout 10m

# 배포 성공 후 smoke test
helm test my-app -n production --logs
```

`--wait` 플래그는 모든 Pod가 Ready 상태가 될 때까지 기다린 뒤 명령을 반환한다. `--timeout`과 함께 사용해 무한 대기를 방지한다.

---

**지난 글:** [Helm Chart 템플릿 심화 — 함수·파이프라인·제어 흐름](/posts/k8s-helm-charts-templating/)

<br>
읽어주셔서 감사합니다. 😊
