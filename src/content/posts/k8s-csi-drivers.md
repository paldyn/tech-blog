---
title: "쿠버네티스 CSI 드라이버 — Container Storage Interface 완전 이해"
description: "CSI 아키텍처(external-provisioner·attacher·CSI Node Plugin), gRPC 인터페이스, 볼륨 생애주기, 주요 드라이버(EBS·EFS·Secrets Store·Longhorn)를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 4
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "CSI", "Container Storage Interface", "EBS", "EFS", "Longhorn", "스토리지 드라이버"]
featured: false
draft: false
---

[지난 글](/posts/k8s-storage-class/)에서 StorageClass의 구조와 동적 프로비저닝을 살펴봤습니다. 이번에는 그 뒤에서 실제로 볼륨을 생성·연결하는 **CSI(Container Storage Interface) 드라이버**의 동작 원리를 파헤칩니다. CSI는 쿠버네티스가 특정 스토리지 벤더에 종속되지 않고 모든 스토리지 시스템을 표준 인터페이스로 연동할 수 있게 하는 핵심 표준입니다.

## CSI란?

CSI는 컨테이너 오케스트레이터(쿠버네티스)와 스토리지 시스템 사이의 **표준 gRPC 인터페이스**입니다. CSI 이전에는 스토리지 드라이버가 쿠버네티스 코어에 직접 포함되어 있었습니다. 새 스토리지 시스템을 지원하려면 쿠버네티스 본체에 코드를 추가해야 했고, 배포 주기가 느려졌습니다. CSI는 드라이버를 쿠버네티스 외부의 독립 컴포넌트로 분리합니다.

![CSI 드라이버 아키텍처](/assets/posts/k8s-csi-architecture.svg)

## CSI 드라이버 구성 요소

CSI 드라이버는 일반적으로 두 종류의 컴포넌트로 배포됩니다.

### Controller Plugin (Deployment/StatefulSet)

클러스터 전체에 1~N개만 실행됩니다. 쿠버네티스 사이드카 컨테이너들과 함께 동작합니다.

- **external-provisioner**: PVC를 감시하다가 `storageClassName`이 매칭되면 CSI의 `CreateVolume`을 호출합니다.
- **external-attacher**: VolumeAttachment 오브젝트를 감시하다가 `ControllerPublishVolume`(볼륨을 노드에 연결)을 호출합니다.
- **external-snapshotter**: VolumeSnapshotContent 생성 요청 시 `CreateSnapshot`을 호출합니다.
- **external-resizer**: PVC 크기 변경 요청 시 `ControllerExpandVolume`을 호출합니다.

```yaml
# external-provisioner + CSI driver 컨테이너 구성 예시
containers:
- name: csi-provisioner
  image: registry.k8s.io/sig-storage/csi-provisioner:v3.6.0
  args: ["--csi-address=$(ADDRESS)", "--v=4"]
- name: ebs-plugin   # 실제 CSI 드라이버
  image: public.ecr.aws/ebs-csi-driver/aws-ebs-csi-driver:v1.25.0
```

### Node Plugin (DaemonSet)

모든 노드에서 실행됩니다. kubelet과 Unix Domain Socket으로 통신합니다.

```yaml
# Node DaemonSet - 각 노드에서 실행
containers:
- name: node-driver-registrar  # kubelet에 CSI 드라이버 등록
  image: registry.k8s.io/sig-storage/csi-node-driver-registrar:v2.9.0
- name: ebs-plugin              # NodeStageVolume, NodePublishVolume 담당
  image: public.ecr.aws/ebs-csi-driver/aws-ebs-csi-driver:v1.25.0
  securityContext:
    privileged: true            # 마운트 작업에 필요
```

## CSI gRPC 인터페이스

CSI 드라이버는 세 가지 gRPC 서비스를 구현합니다.

**IdentityService**: 드라이버 이름, 버전, 지원 기능 목록을 반환합니다. `GetPluginInfo`, `GetPluginCapabilities`, `Probe`를 포함합니다.

**ControllerService**: 볼륨의 생성·삭제·연결·분리·스냅샷을 담당합니다. Controller Pod에서만 실행됩니다.

**NodeService**: 실제 마운트·언마운트를 담당합니다. 각 노드의 Node Plugin이 구현합니다.

## 볼륨 생애주기

![CSI 볼륨 생애주기](/assets/posts/k8s-csi-volume-lifecycle.svg)

Pod가 볼륨을 사용하기까지:

1. **CreateVolume**: external-provisioner가 클라우드 API를 호출해 디스크 생성
2. **ControllerPublishVolume(Attach)**: external-attacher가 해당 디스크를 Pod가 실행될 노드에 연결
3. **NodeStageVolume**: Node Plugin이 글로벌 스테이징 경로에 마운트하고 fsck/포맷
4. **NodePublishVolume**: 스테이징 경로를 Pod의 볼륨 경로에 bind mount

Pod 종료 시 역순으로 Unpublish → Unstage → Detach → DeleteVolume 순으로 정리됩니다.

## CSIDriver 오브젝트

각 CSI 드라이버는 `CSIDriver` 클러스터 리소스를 등록합니다.

```yaml
apiVersion: storage.k8s.io/v1
kind: CSIDriver
metadata:
  name: ebs.csi.aws.com
spec:
  attachRequired: true       # Attach 단계 필요 여부 (NFS 등은 false)
  podInfoOnMount: false      # Pod 정보를 마운트 요청에 포함
  volumeLifecycleModes:
  - Persistent               # PVC 기반 영구 볼륨
  - Ephemeral                # 인라인 임시 볼륨 지원 여부
  fsGroupPolicy: File        # fsGroup 적용 방식
```

## 주요 CSI 드라이버

### AWS EBS CSI Driver

```bash
# Helm으로 설치
helm repo add aws-ebs-csi-driver \
  https://kubernetes-sigs.github.io/aws-ebs-csi-driver
helm install aws-ebs-csi-driver \
  aws-ebs-csi-driver/aws-ebs-csi-driver \
  --namespace kube-system \
  --set controller.serviceAccount.annotations."eks\.amazonaws\.com/role-arn"=\
    arn:aws:iam::ACCOUNT:role/AmazonEKS_EBS_CSI_DriverRole
```

IRSA(IAM Roles for Service Accounts)로 IAM 권한을 부여합니다. EKS 1.23+ 부터는 EBS CSI 드라이버가 기본 포함되어 있지 않으므로 별도 설치가 필요합니다.

### AWS EFS CSI Driver

EFS는 RWX(다수 노드 동시 쓰기)를 지원하는 NFS 기반 스토리지입니다.

```yaml
# EFS StorageClass
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: efs-sc
provisioner: efs.csi.aws.com
parameters:
  provisioningMode: efs-ap       # Access Point 기반 프로비저닝
  fileSystemId: fs-0123456789
  directoryPerms: "700"
```

### Secrets Store CSI Driver

HashiCorp Vault, AWS Secrets Manager, Azure Key Vault의 비밀값을 Pod에 파일로 마운트합니다.

```yaml
# SecretProviderClass
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: aws-secrets
spec:
  provider: aws
  parameters:
    objects: |
      - objectName: "my-db-password"
        objectType: "secretsmanager"
```

## 드라이버 설치 확인

```bash
# 설치된 CSI 드라이버 확인
kubectl get csidrivers

# CSI Node 등록 확인
kubectl get csinodes

# 볼륨 연결 상태
kubectl get volumeattachments
```

---

**지난 글:** [쿠버네티스 StorageClass — 동적 프로비저닝의 설계 도구](/posts/k8s-storage-class/)

**다음 글:** [쿠버네티스 Volume Snapshots — 볼륨 스냅샷과 복원](/posts/k8s-volume-snapshots/)

<br>
읽어주셔서 감사합니다. 😊
