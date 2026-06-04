---
title: "쿠버네티스 StorageClass — 동적 프로비저닝의 설계 도구"
description: "StorageClass의 provisioner·parameters·volumeBindingMode·allowVolumeExpansion 필드, 티어링 전략, 기본 StorageClass 설정을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 3
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "StorageClass", "동적 프로비저닝", "PVC", "CSI", "volumeBindingMode", "스토리지"]
featured: false
draft: false
---

[지난 글](/posts/k8s-persistent-volume-pvc/)에서 PV와 PVC의 바인딩 메커니즘을 알아봤습니다. 이번 글에서는 동적 프로비저닝을 가능하게 하는 핵심 오브젝트 **StorageClass**를 자세히 살펴봅니다. StorageClass는 스토리지의 "등급(class)"을 정의하고, PVC 생성 시 어떤 프로비저너가 어떤 설정으로 볼륨을 만들지 결정합니다.

## StorageClass란?

`StorageClass`는 스토리지의 유형을 추상화하는 오브젝트입니다. 운영자가 "이 클래스는 고성능 SSD, 저 클래스는 저비용 HDD" 식으로 여러 등급을 정의해두면, 개발자는 PVC에서 `storageClassName`으로 원하는 등급을 선택하기만 합니다. 실제로 어떤 클라우드 API를 호출해 볼륨을 만드는지는 신경 쓸 필요가 없습니다.

![StorageClass 구조와 프로비저닝 흐름](/assets/posts/k8s-storage-class-anatomy.svg)

## 핵심 필드

### provisioner

볼륨을 실제로 만드는 플러그인을 지정합니다. CSI 드라이버 이름을 사용합니다.

```yaml
provisioner: ebs.csi.aws.com       # AWS EBS
# provisioner: pd.csi.storage.gke.io  # GCE PD
# provisioner: disk.csi.azure.com     # Azure Disk
# provisioner: efs.csi.aws.com        # AWS EFS
# provisioner: nfs.csi.k8s.io         # NFS
```

### parameters

프로비저너에게 전달하는 드라이버별 설정입니다. 드라이버마다 지원하는 키가 다르므로 각 CSI 드라이버의 공식 문서를 확인해야 합니다.

```yaml
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
  encrypted: "true"
  kmsKeyId: "arn:aws:kms:..."   # 암호화 키
```

### volumeBindingMode

PVC가 생성된 후 언제 PV를 바인딩할지 결정합니다.

- `Immediate`: PVC 생성 즉시 바인딩. NFS처럼 AZ에 종속되지 않는 스토리지에 적합.
- `WaitForFirstConsumer`: Pod가 특정 노드에 스케줄링된 후 해당 노드의 AZ에 볼륨을 생성. EBS 등 AZ 종속 블록 스토리지에 **필수**.

멀티 AZ 환경에서 `WaitForFirstConsumer`를 사용하지 않으면 볼륨이 eu-west-1a에 생성됐는데 Pod가 eu-west-1b에 스케줄링되어 마운트 실패가 발생합니다.

### allowVolumeExpansion

`true`로 설정하면 기존 PVC의 `spec.resources.requests.storage`를 늘려서 볼륨을 확장할 수 있습니다.

```bash
# PVC 용량 확장
kubectl patch pvc my-pvc -p '{"spec":{"resources":{"requests":{"storage":"50Gi"}}}}'
```

확장은 가능하지만 **축소는 지원하지 않습니다.** 드라이버에 따라 Pod를 재시작해야 확장이 반영되는 경우도 있습니다. AWS EBS gp3의 경우 온라인 확장(재시작 없이)을 지원합니다.

## 기본 StorageClass

`storageclass.kubernetes.io/is-default-class: "true"` 어노테이션이 붙은 StorageClass가 기본값입니다. PVC에서 `storageClassName`을 생략하면 기본 StorageClass가 사용됩니다.

```bash
# 기본 StorageClass 확인
kubectl get storageclass
# 기본으로 지정: (default) 표시

# 기본값 변경
kubectl patch storageclass old-default -p \
  '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"false"}}}'
kubectl patch storageclass new-default -p \
  '{"metadata":{"annotations":{"storageclass.kubernetes.io/is-default-class":"true"}}}'
```

기본 StorageClass를 두 개 이상 설정하면 PVC 생성 시 오류가 발생합니다. 또한 `storageClassName: ""`(빈 문자열)로 설정하면 기본 StorageClass를 사용하지 않고 정적 PV와 바인딩됩니다.

## StorageClass 티어링 전략

![StorageClass 티어링 전략](/assets/posts/k8s-storage-class-tiering.svg)

성능과 비용에 따라 StorageClass를 여러 티어로 나누는 것이 일반적입니다.

```yaml
# 고성능 DB용
---
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast
provisioner: ebs.csi.aws.com
parameters:
  type: io2
  iops: "16000"
volumeBindingMode: WaitForFirstConsumer
reclaimPolicy: Retain     # 데이터 보존 우선
allowVolumeExpansion: true
---
# 범용
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: standard
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "3000"
volumeBindingMode: WaitForFirstConsumer
reclaimPolicy: Delete
allowVolumeExpansion: true
```

## mountOptions

볼륨 마운트 시 전달할 옵션을 지정합니다. NFS에서 자주 사용합니다.

```yaml
mountOptions:
- hard
- nfsvers=4.1
- rsize=1048576
- wsize=1048576
```

`mountOptions`는 StorageClass와 PV 모두에 설정할 수 있습니다. 드라이버가 지원하지 않는 옵션을 넣으면 마운트 자체가 실패합니다.

## 볼륨 확장 과정

`allowVolumeExpansion: true`인 StorageClass를 사용할 때 PVC 확장 절차:

1. `kubectl patch pvc`로 요청 크기 늘리기
2. 컨트롤러가 실제 블록 스토리지 크기 확장
3. Pod가 재시작되거나 파일시스템 확장 트리거(드라이버 의존)
4. `kubectl get pvc`에서 `CAPACITY`가 업데이트 됨

```bash
# 확장 진행 상황 확인
kubectl describe pvc my-pvc | grep -A5 Conditions
# Normal  Resizing  → FileSystemResizePending → 완료
```

---

**지난 글:** [쿠버네티스 PersistentVolume과 PVC — 지속형 스토리지의 핵심](/posts/k8s-persistent-volume-pvc/)

**다음 글:** [쿠버네티스 CSI 드라이버 — Container Storage Interface 완전 이해](/posts/k8s-csi-drivers/)

<br>
읽어주셔서 감사합니다. 😊
