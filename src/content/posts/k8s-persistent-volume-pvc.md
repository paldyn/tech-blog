---
title: "쿠버네티스 PersistentVolume과 PVC — 지속형 스토리지의 핵심"
description: "PV·PVC 바인딩 메커니즘, 정적·동적 프로비저닝, Access Modes, Reclaim Policy, StorageClass 연동을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 2
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "PersistentVolume", "PVC", "StorageClass", "동적 프로비저닝", "스토리지", "Access Modes"]
featured: false
draft: false
---

[지난 글](/posts/k8s-ephemeral-volumes/)에서 Pod 수명과 함께하는 임시 볼륨들을 살펴봤습니다. 이번에는 Pod가 사라져도 데이터가 남아야 하는 **지속형 스토리지** — PersistentVolume(PV)과 PersistentVolumeClaim(PVC)을 깊이 파헤칩니다. 데이터베이스, 파일 업로드, 세션 스토리지 등 상태를 보존해야 하는 모든 워크로드의 기반입니다.

## PV와 PVC의 관계

**PersistentVolume(PV)** 은 클러스터 수준의 스토리지 자원입니다. 관리자가 미리 생성하거나(정적), StorageClass를 통해 자동으로 생성됩니다(동적). **PersistentVolumeClaim(PVC)** 은 사용자가 스토리지를 요청하는 오브젝트입니다. "10Gi, ReadWriteOnce 모드 스토리지를 주세요"라는 요청서와 같습니다.

두 오브젝트는 1:1로 **바인딩(Bound)** 됩니다. Pod는 PV를 직접 참조하지 않고 PVC를 통해 간접적으로 사용합니다. 이 추상화 덕분에 Pod 스펙이 특정 스토리지 구현에 종속되지 않습니다.

![PV PVC 바인딩 흐름](/assets/posts/k8s-pvc-binding-flow.svg)

## 정적 프로비저닝

관리자가 PV를 직접 정의하는 방식입니다.

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: pv-nfs-01
spec:
  capacity:
    storage: 50Gi
  accessModes:
  - ReadWriteMany
  persistentVolumeReclaimPolicy: Retain
  nfs:
    server: 10.0.0.5
    path: /exports/data
```

정적 프로비저닝은 NFS, iSCSI처럼 쿠버네티스가 직접 프로비저닝할 수 없는 스토리지에 쓰입니다. PV를 먼저 만들고, PVC에서 `storageClassName: ""` (빈 문자열)로 동적 프로비저닝을 명시적으로 비활성화하면 정적 PV와 바인딩됩니다.

## 동적 프로비저닝

`StorageClass`를 참조하면 PVC 생성 시 PV가 자동으로 만들어집니다. 대부분의 운영 환경에서 권장하는 방식입니다.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mysql-data
spec:
  accessModes:
  - ReadWriteOnce
  storageClassName: gp3        # StorageClass 이름
  resources:
    requests:
      storage: 20Gi
```

StorageClass의 프로비저너(예: `ebs.csi.aws.com`)가 실제 AWS EBS 볼륨을 생성하고, 해당 볼륨을 가리키는 PV를 자동 생성합니다. PVC에는 즉시 `Bound` 상태가 됩니다.

## Access Modes

PV와 PVC 모두 `accessModes`를 선언합니다. 바인딩 시 **PVC가 요청한 Access Mode를 PV가 지원**해야 합니다.

| 모드 | 약어 | 설명 |
|------|------|------|
| ReadWriteOnce | RWO | 단일 노드에서 읽기/쓰기 |
| ReadOnlyMany | ROX | 다수 노드에서 읽기 전용 |
| ReadWriteMany | RWX | 다수 노드에서 읽기/쓰기 |
| ReadWriteOncePod | RWOP | 단일 Pod에서만 읽기/쓰기 (k8s 1.22+) |

EBS나 Azure Disk는 RWO만 지원합니다. 여러 Pod에서 동시에 쓰기가 필요하다면 NFS, CephFS, AWS EFS(RWX)를 사용해야 합니다. `ReadWriteOncePod`는 멀티 컨테이너 파드에서도 한 번에 하나의 파드만 접근하도록 더 강하게 제한합니다.

## Reclaim Policy

PVC가 삭제된 후 PV(와 실제 스토리지)를 어떻게 처리할지 결정합니다.

![PV Reclaim Policy](/assets/posts/k8s-pvc-reclaim-policy.svg)

- **Delete**: PVC 삭제 시 PV와 실제 스토리지(EBS 볼륨 등)도 자동으로 삭제됩니다. StorageClass의 기본값이며, 동적 프로비저닝에서 주로 사용합니다.
- **Retain**: PVC 삭제 후 PV가 `Released` 상태로 남습니다. 데이터가 보존되지만, **다른 PVC가 이 PV를 재사용하려면 수동으로 PV를 삭제하고 재생성**해야 합니다. 데이터 유실이 치명적인 환경에서 안전망으로 사용합니다.
- **Recycle** (deprecated): 볼륨을 초기화(`rm -rf`)하고 `Available`로 되돌립니다. 더 이상 권장하지 않으며, 대신 동적 프로비저닝을 사용하세요.

## PVC를 Pod에서 사용하기

```yaml
spec:
  volumes:
  - name: db-storage
    persistentVolumeClaim:
      claimName: mysql-data    # PVC 이름
  containers:
  - name: mysql
    image: mysql:8.0
    volumeMounts:
    - name: db-storage
      mountPath: /var/lib/mysql
```

StatefulSet에서는 `volumeClaimTemplates`를 사용하면 각 Pod 복제본마다 독립된 PVC를 자동으로 생성합니다.

```yaml
volumeClaimTemplates:
- metadata:
    name: data
  spec:
    accessModes: ["ReadWriteOnce"]
    storageClassName: gp3
    resources:
      requests:
        storage: 10Gi
```

## PVC 바인딩 지연 (WaitForFirstConsumer)

`volumeBindingMode: WaitForFirstConsumer`로 설정된 StorageClass는 PVC가 생성되어도 즉시 PV를 바인딩하지 않습니다. **Pod가 스케줄링될 노드가 결정된 후** 해당 노드가 속한 가용 영역(AZ)에 볼륨을 생성합니다.

멀티 AZ 클러스터에서 EBS처럼 AZ에 종속된 블록 스토리지를 사용할 때 필수입니다. Pod가 어느 노드에 배치될지 모르는 상태에서 미리 볼륨을 생성하면 Pod와 볼륨이 다른 AZ에 있어 마운트 실패가 발생합니다.

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
provisioner: ebs.csi.aws.com
volumeBindingMode: WaitForFirstConsumer  # AZ 바인딩 지연
```

## PV 상태 전이

PV는 다음 상태를 거칩니다: `Available` → (PVC 바인딩) → `Bound` → (PVC 삭제) → `Released` → (수동 정리) → `Available` (Retain 정책) 또는 삭제(Delete 정책).

`Failed` 상태는 동적 프로비저닝이 실패했거나 볼륨 반환 과정에서 오류가 생겼을 때 발생합니다. `kubectl describe pv <name>`으로 이벤트를 확인하세요.

---

**지난 글:** [쿠버네티스 Ephemeral Volumes — Pod 수명과 함께하는 임시 볼륨](/posts/k8s-ephemeral-volumes/)

**다음 글:** [쿠버네티스 StorageClass — 동적 프로비저닝의 설계 도구](/posts/k8s-storage-class/)

<br>
읽어주셔서 감사합니다. 😊
