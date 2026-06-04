---
title: "쿠버네티스 Volume Snapshots — 볼륨 스냅샷과 복원"
description: "VolumeSnapshot·VolumeSnapshotContent·VolumeSnapshotClass 오브젝트, 스냅샷 생성/복원 흐름, deletionPolicy, 크로스 네임스페이스 복원을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 5
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "VolumeSnapshot", "스냅샷", "PVC", "CSI", "백업", "복원", "스토리지"]
featured: false
draft: false
---

[지난 글](/posts/k8s-csi-drivers/)에서 CSI 드라이버의 아키텍처와 볼륨 생애주기를 살펴봤습니다. 이번에는 CSI 드라이버가 제공하는 강력한 기능인 **Volume Snapshots** — 볼륨의 특정 시점 상태를 캡처하고 복원하는 메커니즘을 다룹니다. 데이터베이스 백업, 블루/그린 배포, 재해 복구의 기반이 됩니다.

## Volume Snapshots란?

쿠버네티스의 Volume Snapshots는 PVC의 특정 시점(point-in-time) 복사본을 만드는 기능입니다. 클라우드 제공자의 스냅샷 API(AWS EBS Snapshot, GCE Persistent Disk Snapshot 등)를 쿠버네티스 네이티브 오브젝트로 추상화합니다.

핵심은 세 가지 API 오브젝트입니다:

- **VolumeSnapshotClass**: 어떤 드라이버로, 어떤 정책으로 스냅샷을 만들지 정의 (StorageClass와 유사)
- **VolumeSnapshot**: 사용자가 생성하는 스냅샷 요청 (PVC와 유사)
- **VolumeSnapshotContent**: 실제 스냅샷 메타데이터 (PV와 유사)

![Volume Snapshot API 오브젝트 관계](/assets/posts/k8s-volume-snapshots-objects.svg)

## VolumeSnapshotClass

```yaml
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshotClass
metadata:
  name: csi-aws-vsc
  annotations:
    snapshot.storage.kubernetes.io/is-default-class: "true"
driver: ebs.csi.aws.com
deletionPolicy: Delete    # 또는 Retain
parameters:
  csi.storage.k8s.io/snapshotter-secret-name: aws-secret
  csi.storage.k8s.io/snapshotter-secret-namespace: kube-system
```

`deletionPolicy: Retain`으로 설정하면 VolumeSnapshot 오브젝트를 삭제해도 실제 클라우드 스냅샷이 삭제되지 않습니다. 중요한 데이터의 스냅샷은 `Retain`을 권장합니다.

## 스냅샷 생성

```yaml
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: db-snapshot-20260605
  namespace: production
spec:
  volumeSnapshotClassName: csi-aws-vsc
  source:
    persistentVolumeClaimName: db-data   # 스냅샷할 PVC
```

생성 후 `ReadyToUse: true`가 될 때까지 기다립니다.

```bash
# 스냅샷 상태 확인
kubectl get volumesnapshot db-snapshot-20260605 -n production
# NAME                     READYTOUSE   SOURCEPVC   RESTORESIZE   ...
# db-snapshot-20260605     true         db-data     20Gi

# 상세 정보
kubectl describe volumesnapshot db-snapshot-20260605 -n production
```

![Volume Snapshot 생성과 복원 흐름](/assets/posts/k8s-volume-snapshots-flow.svg)

## 스냅샷에서 PVC 복원

스냅샷에서 새 PVC를 생성할 때 `dataSource`에 VolumeSnapshot을 참조합니다.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: db-data-restored
  namespace: production
spec:
  dataSource:
    name: db-snapshot-20260605
    kind: VolumeSnapshot
    apiGroup: snapshot.storage.k8s.io
  accessModes:
  - ReadWriteOnce
  storageClassName: gp3
  resources:
    requests:
      storage: 20Gi   # 원본 크기 이상이어야 함
```

복원된 PVC를 기존 Pod에 마운트하거나, 새 Pod를 만들어 데이터를 검증할 수 있습니다.

## 기존 클라우드 스냅샷 임포트

쿠버네티스 외부에서 만든 스냅샷(예: 콘솔에서 직접 생성한 EBS 스냅샷)을 임포트하려면 VolumeSnapshotContent를 먼저 수동 생성합니다.

```yaml
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshotContent
metadata:
  name: imported-snap
spec:
  deletionPolicy: Retain
  driver: ebs.csi.aws.com
  source:
    snapshotHandle: snap-0abc123456789def0   # 기존 AWS 스냅샷 ID
  volumeSnapshotRef:
    name: imported-snap-claim
    namespace: production
---
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: imported-snap-claim
  namespace: production
spec:
  source:
    volumeSnapshotContentName: imported-snap  # VSC 직접 참조
```

## VolumeSnapshotContent의 boundVolumeSnapshotContentName

VolumeSnapshot을 생성하면 컨트롤러가 자동으로 VolumeSnapshotContent를 생성하고 두 오브젝트를 서로 바인딩합니다. PV-PVC 관계와 동일한 패턴입니다.

```bash
# VolumeSnapshotContent 확인
kubectl get volumesnapshotcontent
# NAME                                   READYTOUSE  RESTORESIZE  DRIVER
# snapcontent-abc123...                  true        20Gi         ebs.csi.aws.com
```

## 스냅샷 스케줄링

쿠버네티스는 스냅샷 스케줄링을 네이티브로 지원하지 않습니다. 외부 도구를 사용합니다.

```yaml
# CronJob으로 스냅샷 주기 생성
apiVersion: batch/v1
kind: CronJob
metadata:
  name: db-snapshot-cron
spec:
  schedule: "0 2 * * *"   # 매일 새벽 2시
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: snapshot-sa
          containers:
          - name: snapshot
            image: bitnami/kubectl:latest
            command:
            - /bin/sh
            - -c
            - |
              kubectl create -f - <<EOF
              apiVersion: snapshot.storage.k8s.io/v1
              kind: VolumeSnapshot
              metadata:
                name: db-snap-$(date +%Y%m%d)
                namespace: production
              spec:
                volumeSnapshotClassName: csi-aws-vsc
                source:
                  persistentVolumeClaimName: db-data
              EOF
```

프로덕션에서는 Velero, Kasten K10 같은 전문 백업 도구를 사용하는 것을 권장합니다.

## Volume Cloning

스냅샷 없이 기존 PVC를 복사할 수도 있습니다(`dataSource`에 PVC를 참조).

```yaml
spec:
  dataSource:
    name: source-pvc
    kind: PersistentVolumeClaim
  # 동일 네임스페이스, 동일 StorageClass, 동일 크기 이상
```

PVC Cloning은 스냅샷보다 빠르지만 동일 클러스터·네임스페이스·StorageClass 제약이 있습니다.

---

**지난 글:** [쿠버네티스 CSI 드라이버 — Container Storage Interface 완전 이해](/posts/k8s-csi-drivers/)

**다음 글:** [쿠버네티스 Local Persistent Volume — 노드 로컬 스토리지 활용](/posts/k8s-local-persistent-volume/)

<br>
읽어주셔서 감사합니다. 😊
