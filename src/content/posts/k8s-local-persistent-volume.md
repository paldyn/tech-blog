---
title: "쿠버네티스 Local Persistent Volume — 노드 로컬 스토리지 활용"
description: "Local PV의 nodeAffinity 바인딩, hostPath와의 차이, 정적 프로비저닝, local-static-provisioner, StatefulSet 연동 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 6
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "Local PV", "PersistentVolume", "nodeAffinity", "StatefulSet", "고성능 스토리지", "Cassandra"]
featured: false
draft: false
---

[지난 글](/posts/k8s-volume-snapshots/)에서 볼륨 스냅샷을 다뤘습니다. 이번에는 쿠버네티스에서 노드 로컬 디스크를 영구 볼륨으로 활용하는 **Local Persistent Volume**을 살펴봅니다. Cassandra, Elasticsearch, ClickHouse 같이 자체적으로 데이터 복제를 처리하는 분산 데이터베이스에서 최고의 I/O 성능을 끌어내기 위해 사용합니다.

## Local PV란?

**Local PV**는 특정 노드에 물리적으로 연결된 디스크(NVMe SSD, 로컬 HDD 등)를 쿠버네티스 PersistentVolume으로 노출합니다. 네트워크를 거치는 EBS나 NFS와 달리 로컬 디스크는 네트워크 지연 없이 최대 디스크 성능을 제공합니다.

핵심 특징은 **PV에 `nodeAffinity`가 필수**라는 것입니다. 이 어피니티를 통해 스케줄러가 해당 PV를 사용하는 Pod를 반드시 그 노드에 배치합니다. 반대로 말하면 Pod가 특정 노드에 고정됩니다.

![Local Persistent Volume 아키텍처](/assets/posts/k8s-local-pv-architecture.svg)

## Local PV vs hostPath

두 타입 모두 노드 파일시스템을 사용하지만 중요한 차이가 있습니다.

![Local PV vs hostPath 비교](/assets/posts/k8s-local-pv-vs-hostpath.svg)

`hostPath`는 Pod spec에 직접 경로를 지정합니다. 스케줄러가 이를 인식하지 못하므로, Pod가 다른 노드에 스케줄링되면 마운트가 실패합니다. 또한 컨테이너가 노드 파일시스템 전체에 접근할 수 있어 보안 위험이 있습니다.

`Local PV`는 PV 오브젝트에 `nodeAffinity`를 선언하므로 스케줄러가 이를 고려합니다. PVC를 통한 추상화로 보안도 더 강합니다.

## PV 수동 생성

Local PV는 동적 프로비저닝을 지원하지 않습니다. 미리 노드에 디스크를 마운트하고 PV를 생성해야 합니다.

```bash
# 노드에서 디스크 마운트 (사전 작업)
mkfs.ext4 /dev/nvme1n1
mkdir -p /mnt/fast-disk
mount /dev/nvme1n1 /mnt/fast-disk
# /etc/fstab에도 등록
```

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: local-pv-worker-a
spec:
  capacity:
    storage: 500Gi
  accessModes:
  - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain  # 데이터 보존 필수
  storageClassName: local-storage
  local:
    path: /mnt/fast-disk
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions:
        - key: kubernetes.io/hostname
          operator: In
          values:
          - worker-a    # 이 노드에만 바인딩
```

`persistentVolumeReclaimPolicy: Retain`이 중요합니다. `Delete`로 설정하면 PVC 삭제 시 PV가 삭제되지만, 실제 디스크 데이터는 남아 있어 일관성이 깨집니다.

## StorageClass 설정

Local PV용 StorageClass는 `volumeBindingMode: WaitForFirstConsumer`가 필수입니다.

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: local-storage
provisioner: kubernetes.io/no-provisioner   # 동적 프로비저닝 없음
volumeBindingMode: WaitForFirstConsumer     # Pod 스케줄링 후 바인딩
reclaimPolicy: Retain
```

`WaitForFirstConsumer`가 없으면 PVC가 임의 Local PV에 바인딩될 수 있습니다. 그러면 실제로 Pod를 실행할 노드에 해당 디스크가 없어 Pending 상태가 됩니다.

## StatefulSet과 Local PV

분산 DB를 StatefulSet으로 배포할 때 각 복제본이 독립적인 Local PV를 가져야 합니다.

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: cassandra
spec:
  serviceName: cassandra
  replicas: 3
  selector:
    matchLabels:
      app: cassandra
  template:
    metadata:
      labels:
        app: cassandra
    spec:
      containers:
      - name: cassandra
        image: cassandra:4.1
        volumeMounts:
        - name: cassandra-data
          mountPath: /var/lib/cassandra
  volumeClaimTemplates:
  - metadata:
      name: cassandra-data
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: local-storage
      resources:
        requests:
          storage: 500Gi
```

각 Pod(`cassandra-0`, `cassandra-1`, `cassandra-2`)는 `cassandra-data-cassandra-0` 같은 PVC를 생성하고, 해당 노드의 Local PV에 바인딩됩니다.

## local-static-provisioner

노드가 많으면 PV를 일일이 수동으로 만드는 게 번거롭습니다. **local-static-provisioner**는 지정된 디스크 발견 디렉토리를 주기적으로 스캔하여 자동으로 PV를 생성·삭제합니다.

```yaml
# helm 설치
helm repo add sig-storage-local-static-provisioner \
  https://kubernetes-sigs.github.io/sig-storage-local-static-provisioner
helm install local-static-provisioner \
  sig-storage-local-static-provisioner/local-static-provisioner \
  --set daemonset.configMapName=local-provisioner-config
```

각 노드에 DaemonSet으로 실행되며, `/mnt/disks/` 같은 발견 디렉토리 하위에 심볼릭 링크나 실제 마운트 포인트를 만들면 자동으로 PV가 생성됩니다.

## 노드 장애 시 처리

Local PV의 가장 큰 위험은 **노드 장애 시 데이터 손실**입니다. 클라우드 EBS처럼 다른 노드에서 재연결하는 것이 불가능합니다.

이 때문에 Local PV를 사용하는 워크로드는 애플리케이션 레이어에서 복제를 처리해야 합니다. Cassandra는 replication factor 3으로, Elasticsearch는 replica shard로, ClickHouse는 ReplicatedMergeTree로 데이터를 여러 노드에 분산합니다.

```bash
# 특정 노드의 Local PV 확인
kubectl get pv -l local.pv.node=worker-a

# PV가 Bound인지 Available인지 상태 확인
kubectl get pv --sort-by=.spec.nodeAffinity.required.nodeSelectorTerms[0].matchExpressions[0].values[0]
```

---

**지난 글:** [쿠버네티스 Volume Snapshots — 볼륨 스냅샷과 복원](/posts/k8s-volume-snapshots/)

**다음 글:** [쿠버네티스 Stateful 스토리지 패턴 — StatefulSet 스토리지 설계](/posts/k8s-stateful-storage-patterns/)

<br>
읽어주셔서 감사합니다. 😊
