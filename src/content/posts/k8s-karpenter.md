---
title: "쿠버네티스 Karpenter — 차세대 노드 자동 프로비저닝"
description: "Karpenter의 NodePool·EC2NodeClass 설정, Consolidation 기능, Cluster Autoscaler와의 차이점, Spot 인스턴스 활용 전략을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 9
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "Karpenter", "노드 자동 프로비저닝", "NodePool", "Spot 인스턴스", "Consolidation", "비용 최적화"]
featured: false
draft: false
---

[지난 글](/posts/k8s-cluster-autoscaler/)에서 사전 정의된 노드 그룹을 조정하는 Cluster Autoscaler를 다뤘습니다. Karpenter는 노드 그룹 없이 Pod 요구사항에 맞춰 **최적 인스턴스 타입을 직접 프로비저닝**하는 차세대 접근 방식입니다.

## Karpenter의 차별점

전통적인 Cluster Autoscaler는 AWS Auto Scaling Group 같은 노드 그룹을 미리 만들어야 합니다. 인스턴스 타입도 그룹 안에서만 선택 가능합니다. Karpenter는 이 제약을 없앴습니다.

Pending Pod의 `nodeSelector`, `affinity`, `resource requests`를 분석해 수백 가지 인스턴스 타입 중 가장 적합한 것을 실시간으로 선택하고 60초 내에 Ready 상태 노드를 만들어냅니다.

![Karpenter 프로비저닝 아키텍처](/assets/posts/k8s-karpenter-architecture.svg)

## 핵심 CRD — NodePool과 EC2NodeClass

Karpenter는 두 개의 CRD로 프로비저닝 정책을 정의합니다.

**NodePool**: 어떤 종류의 노드를 허용할지 선언합니다.

```yaml
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: default
spec:
  template:
    spec:
      nodeClassRef:
        group: karpenter.k8s.aws
        kind: EC2NodeClass
        name: default
      requirements:
      - key: karpenter.sh/capacity-type
        operator: In
        values: ["spot", "on-demand"]
      - key: kubernetes.io/arch
        operator: In
        values: ["amd64"]
      - key: karpenter.k8s.aws/instance-category
        operator: In
        values: ["m", "c", "r"]       # m/c/r 계열만
  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized
    consolidateAfter: 30s
  limits:
    cpu: "100"                         # 이 NodePool의 총 CPU 상한
    memory: "200Gi"
```

**EC2NodeClass**: AWS 전용 설정(AMI, subnet, security group 등)을 정의합니다.

```yaml
apiVersion: karpenter.k8s.aws/v1
kind: EC2NodeClass
metadata:
  name: default
spec:
  amiFamily: AL2023
  role: KarpenterNodeRole-my-cluster
  subnetSelectorTerms:
  - tags:
      karpenter.sh/discovery: my-cluster
  securityGroupSelectorTerms:
  - tags:
      karpenter.sh/discovery: my-cluster
```

## Spot 인스턴스 활용

Karpenter의 강점 중 하나는 Spot 인스턴스 처리입니다. `karpenter.sh/capacity-type: spot`을 허용하면 Karpenter가 Spot 가용성을 실시간으로 체크하고, Spot이 없으면 자동으로 On-Demand로 폴백합니다.

Spot 인터럽션(AWS가 인스턴스를 회수할 때)도 자동 처리합니다. AWS가 2분 전 인터럽션 알림을 보내면 Karpenter가 Pod를 다른 노드로 미리 이주시킵니다.

## Consolidation — 지속적 비용 최적화

![Karpenter vs Cluster Autoscaler](/assets/posts/k8s-karpenter-vs-ca.svg)

Consolidation은 Karpenter만의 기능입니다. 주기적으로 전체 노드 배치를 평가해 Pod를 더 적은 노드에 통합할 수 있는지 확인합니다. 가능하면 대상 노드의 Pod를 drain하고 노드를 삭제합니다.

또한 현재 노드보다 저렴한 인스턴스 타입이 동일한 Pod를 수용할 수 있다면 노드를 교체합니다. 예를 들어 m5.2xlarge 하나를 m5.xlarge 두 개로 대체할 수 있다면 자동으로 전환합니다.

```bash
# Karpenter 로그 확인
kubectl logs -n karpenter -l app.kubernetes.io/name=karpenter --tail=50

# 현재 NodePool이 프로비저닝한 노드 확인
kubectl get nodes -l karpenter.sh/nodepool=default

# NodeClaim 상태 (Karpenter가 관리하는 노드 단위)
kubectl get nodeclaims
```

## Cluster Autoscaler와 공존

기존 CA를 사용하는 클러스터에서 Karpenter로 점진적 전환이 가능합니다. `karpenter.sh/nodepool` 라벨이 있는 노드는 CA가 관리하지 않으므로, 새 노드 그룹은 Karpenter로, 기존 그룹은 CA로 운영하면서 단계적으로 마이그레이션할 수 있습니다.

---

**지난 글:** [쿠버네티스 Cluster Autoscaler — 노드 수 자동 조정](/posts/k8s-cluster-autoscaler/)

**다음 글:** [쿠버네티스 Volume — 컨테이너 스토리지의 기초](/posts/k8s-volumes/)

<br>
읽어주셔서 감사합니다. 😊
