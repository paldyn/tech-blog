---
title: "쿠버네티스 StatefulSet — 순서와 영속성이 보장되는 Pod"
description: "Kubernetes StatefulSet의 순서 보장, 안정적인 네트워크 ID, PersistentVolume 자동 연결 동작을 설명하고 Deployment와의 차이를 명확히 비교합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 2
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "StatefulSet", "PersistentVolume", "헤드리스 서비스", "순서 보장", "데이터베이스"]
featured: false
draft: false
---

[지난 글](/posts/k8s-daemonset/)에서 모든 노드에 Pod를 배포하는 DaemonSet을 살펴봤습니다. 이번에는 **상태가 있는 애플리케이션**을 위한 **StatefulSet**을 다룹니다. StatefulSet은 각 Pod에 **고유하고 안정적인 이름, 네트워크 ID, 스토리지**를 부여합니다. Pod가 삭제되고 재생성되어도 이 세 가지는 유지됩니다.

## StatefulSet과 Deployment의 차이

Deployment의 Pod는 무상태(stateless)입니다. Pod가 재생성될 때마다 이름이 바뀌고(`web-abc123`→`web-xyz456`), 어느 노드에 배치될지도 달라집니다. 데이터베이스처럼 "이전 상태"를 유지해야 하는 애플리케이션에는 치명적입니다.

StatefulSet은 다음 세 가지를 보장합니다.

1. **안정적인 Pod 이름**: `web-0`, `web-1`, `web-2` (재생성해도 동일)
2. **안정적인 DNS 이름**: `web-0.web-svc.default.svc.cluster.local`
3. **안정적인 스토리지**: `data-web-0` PVC가 항상 `web-0`에 연결

![StatefulSet 아키텍처](/assets/posts/k8s-statefulset-architecture.svg)

## Headless Service와 DNS

StatefulSet은 `spec.serviceName`으로 **Headless Service**를 참조합니다. Headless Service는 `clusterIP: None`으로 설정된 서비스로, 단일 IP를 제공하는 대신 각 Pod의 IP를 DNS로 직접 노출합니다.

```yaml
# Headless Service (StatefulSet 전에 먼저 생성)
apiVersion: v1
kind: Service
metadata:
  name: web-svc
spec:
  clusterIP: None
  selector:
    app: web
  ports:
  - port: 80
    name: web
```

Headless Service가 있으면 각 Pod에 DNS 레코드가 생성됩니다:
- `web-0.web-svc.default.svc.cluster.local`
- `web-1.web-svc.default.svc.cluster.local`

MySQL 클러스터에서 leader pod(`db-0`)에 직접 쓰고 follower pod(`db-1`, `db-2`)에서 읽는 구성이 이 DNS를 사용합니다.

## StatefulSet YAML

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: web
spec:
  serviceName: "web-svc"
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: nginx:1.25
        ports:
        - containerPort: 80
          name: web
        volumeMounts:
        - name: data
          mountPath: /usr/share/nginx/html
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

`volumeClaimTemplates`가 StatefulSet의 핵심입니다. 이 템플릿을 기반으로 각 Pod마다 PVC가 자동 생성됩니다.
- `web-0` → `data-web-0`
- `web-1` → `data-web-1`
- `web-2` → `data-web-2`

![StatefulSet YAML 구조와 volumeClaimTemplates](/assets/posts/k8s-statefulset-yaml.svg)

## 생성과 삭제 순서

StatefulSet의 Pod는 **순서대로** 생성되고 **역순으로** 삭제됩니다.

**생성**: `web-0` Running 확인 → `web-1` 생성 → Running 확인 → `web-2` 생성

**삭제**: `web-2` → `web-1` → `web-0` (역순)

이 순서 보장은 데이터베이스 클러스터에서 특히 중요합니다. Primary가 먼저 준비된 후에 Secondary가 시작되어야 복제 설정이 정상 작동하기 때문입니다.

```bash
# StatefulSet 배포 후 Pod 순서 확인
kubectl get pods -l app=web -w

# 출력:
# web-0   0/1  Pending  0  0s
# web-0   1/1  Running  0  5s
# web-1   0/1  Pending  0  0s
# web-1   1/1  Running  0  4s
# web-2   0/1  Pending  0  0s
# web-2   1/1  Running  0  3s
```

`podManagementPolicy: Parallel`을 설정하면 모든 Pod를 동시에 생성할 수 있지만, 순서 보장은 사라집니다.

## kubectl로 StatefulSet 관리

```bash
# StatefulSet 목록
kubectl get statefulset
kubectl get sts

# 상세 정보
kubectl describe sts web

# 스케일 조정
kubectl scale sts web --replicas=5

# Pod 순서 확인
kubectl get pods -l app=web \
  --sort-by=.metadata.name

# PVC 확인
kubectl get pvc -l app=web
```

## StatefulSet vs Deployment 비교

| 특성 | StatefulSet | Deployment |
|------|-------------|------------|
| Pod 이름 | 고정 (web-0, web-1) | 랜덤 해시 |
| DNS | 각 Pod 개별 DNS | 서비스 DNS |
| 스토리지 | Pod마다 고유 PVC | 공유 또는 없음 |
| 생성 순서 | 순차 | 동시 |
| 주요 용도 | DB, 메시지 큐, Kafka | 웹 서버, API |

## 실제 사용 예시

StatefulSet은 다음 애플리케이션에 적합합니다.

- **데이터베이스**: MySQL Cluster, PostgreSQL HA, MongoDB ReplicaSet
- **분산 스토리지**: Cassandra, Elasticsearch
- **메시지 큐**: Kafka, RabbitMQ
- **분산 캐시**: Redis Sentinel, Redis Cluster
- **ZooKeeper** 기반 시스템

이 중 많은 시스템이 특정 노드에 특정 역할(Primary/Secondary, Leader/Follower)을 부여하는데, 안정적인 네트워크 ID와 순서 보장이 필수입니다.

---

**지난 글:** [쿠버네티스 DaemonSet 완전 이해](/posts/k8s-daemonset/)

**다음 글:** [StatefulSet 스토리지 운영 — PVC 보존과 마이그레이션](/posts/k8s-statefulset-storage-ops/)

<br>
읽어주셔서 감사합니다. 😊
