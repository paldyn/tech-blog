---
title: "쿠버네티스 Stateful 스토리지 패턴 — StatefulSet 스토리지 설계"
description: "단일 PVC·StatefulSet volumeClaimTemplates·RWX 공유 파일시스템·DB Operator 패턴, PVC 보존 정책, 스토리지 선택 기준을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 7
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "StatefulSet", "스토리지 패턴", "PVC", "DB Operator", "volumeClaimTemplates", "CloudNativePG"]
featured: false
draft: false
---

[지난 글](/posts/k8s-local-persistent-volume/)에서 노드 로컬 스토리지를 다뤘습니다. 이번 글에서는 쿠버네티스에서 상태 있는(stateful) 워크로드를 운영할 때 스토리지를 어떻게 설계하는지, 실전에서 검증된 **패턴**들을 정리합니다. 간단한 단독 DB부터 고가용성 분산 데이터베이스까지 시나리오별 최적 접근법을 살펴봅니다.

## 패턴 1: 단일 Pod + 단일 PVC

가장 단순한 패턴입니다. Deployment 한 개의 복제본이 PVC를 마운트합니다.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
spec:
  replicas: 1    # RWO이므로 반드시 1
  template:
    spec:
      containers:
      - name: postgres
        image: postgres:16
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: postgres-data
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-data
spec:
  accessModes: [ReadWriteOnce]
  storageClassName: gp3
  resources:
    requests:
      storage: 20Gi
```

**주의**: Deployment와 RWO PVC 조합에서 `replicas: 1`을 넘기면 롤링 업데이트 중에 두 번째 Pod가 PVC를 마운트하려다 실패합니다. 고가용성이 필요하면 StatefulSet이나 DB Operator를 사용하세요.

![Stateful 스토리지 패턴 비교](/assets/posts/k8s-stateful-patterns-overview.svg)

## 패턴 2: StatefulSet + volumeClaimTemplates

분산 DB의 표준 패턴입니다. `volumeClaimTemplates`는 각 Pod 복제본에 독립적인 PVC를 자동 생성합니다.

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: kafka
spec:
  serviceName: kafka-headless
  replicas: 3
  podManagementPolicy: Parallel   # 동시 시작 (기본은 OrderedReady)
  template:
    spec:
      containers:
      - name: kafka
        image: confluentinc/cp-kafka:7.5.0
        volumeMounts:
        - name: data
          mountPath: /var/lib/kafka/data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ReadWriteOnce]
      storageClassName: gp3
      resources:
        requests:
          storage: 100Gi
```

`kafka-0` → `data-kafka-0`, `kafka-1` → `data-kafka-1`으로 PVC가 자동 생성됩니다. Pod가 재스케줄링되어도 같은 PVC에 다시 바인딩됩니다.

### PVC 보존 정책 (k8s 1.27+)

StatefulSet 삭제 시 PVC를 어떻게 처리할지 설정합니다.

```yaml
spec:
  persistentVolumeClaimRetentionPolicy:
    whenDeleted: Retain    # StatefulSet 삭제 시 PVC 유지
    whenScaled: Delete     # 복제본 수 감소 시 PVC 삭제
```

`whenDeleted: Retain`이 기본값으로 권장됩니다. 실수로 StatefulSet을 삭제해도 데이터를 잃지 않습니다.

## 패턴 3: 공유 파일시스템 (RWX)

여러 Pod가 동일한 파일 경로에 읽기/쓰기하는 패턴입니다.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: shared-uploads
spec:
  accessModes: [ReadWriteMany]    # RWX
  storageClassName: efs-sc        # AWS EFS StorageClass
  resources:
    requests:
      storage: 100Gi
---
# Deployment (여러 복제본이 같은 PVC 마운트)
spec:
  replicas: 5
  template:
    spec:
      volumes:
      - name: uploads
        persistentVolumeClaim:
          claimName: shared-uploads
```

파일 업로드 서버, 공유 ML 학습 데이터셋, 레거시 NFS 의존 앱에 적합합니다. 쓰기 충돌을 방지하기 위해 애플리케이션에서 파일 경로 분리나 락 메커니즘을 구현해야 합니다.

## 패턴 4: DB Operator

프로덕션 DB를 쿠버네티스에서 운영할 때 가장 강력한 접근법입니다. Operator는 상태 변이(primaryDB, standbyDB, 페일오버, 백업)를 CRD로 선언하면 자동으로 처리합니다.

![DB Operator 패턴](/assets/posts/k8s-stateful-patterns-operator.svg)

### CloudNativePG 예시

```yaml
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: pg-cluster
spec:
  instances: 3
  storage:
    size: 50Gi
    storageClass: gp3
  backup:
    retentionPolicy: "30d"
    barmanObjectStore:
      destinationPath: s3://my-bucket/pg-backup
      s3Credentials:
        accessKeyId:
          name: s3-creds
          key: ACCESS_KEY_ID
  postgresql:
    parameters:
      max_connections: "200"
      shared_buffers: 512MB
```

이 하나의 CRD 선언으로 CloudNativePG Operator가 Primary 1개 + Standby 2개, 자동 페일오버, S3 연속 아카이브(WAL), PITR을 모두 관리합니다.

## 스토리지 선택 가이드

| 워크로드 | 스토리지 패턴 | Access Mode | 예시 |
|---------|-------------|-------------|------|
| 단독 DB (개발) | Deployment + PVC | RWO | PostgreSQL dev |
| 분산 DB | StatefulSet + VCT | RWO | Kafka, Cassandra |
| 고가용성 DB | DB Operator | RWO | CloudNativePG |
| 파일 공유 | Deployment + RWX PVC | RWX | 업로드 서버 |
| 고성능 요구 | Local PV | RWO | Elasticsearch |

## StatefulSet 스케일 다운 주의

```bash
# 복제본 축소 시 PVC는 삭제되지 않음 (whenScaled: Retain 기본)
kubectl scale statefulset kafka --replicas=2
# data-kafka-2 PVC는 남아 있음 → 수동 확인 후 삭제 필요

# PVC 확인
kubectl get pvc -l app=kafka
```

복제본을 줄인 후 다시 늘리면 기존 PVC에 다시 바인딩됩니다. 의도치 않은 PVC 누적에 주의하세요.

---

**지난 글:** [쿠버네티스 Local Persistent Volume — 노드 로컬 스토리지 활용](/posts/k8s-local-persistent-volume/)

**다음 글:** [쿠버네티스 네트워킹 모델 — Pod 간 통신의 기본 원칙](/posts/k8s-networking-model/)

<br>
읽어주셔서 감사합니다. 😊
