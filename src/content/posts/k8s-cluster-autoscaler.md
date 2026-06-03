---
title: "쿠버네티스 Cluster Autoscaler — 노드 수 자동 조정"
description: "Kubernetes Cluster Autoscaler의 Scale-Up·Scale-Down 조건, Expander 전략, Scale-Down 차단 조건, 운영 시 주의사항을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 8
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "Cluster Autoscaler", "노드 자동 스케일링", "Expander", "Scale-Down", "비용 최적화"]
featured: false
draft: false
---

[지난 글](/posts/k8s-vertical-pod-autoscaler/)에서 컨테이너 리소스를 수직으로 자동 조정하는 VPA를 다뤘습니다. HPA와 VPA는 Pod 단위의 스케일링이었다면, 이번에 다루는 **Cluster Autoscaler(CA)**는 노드 수 자체를 늘리고 줄입니다.

## Cluster Autoscaler란?

CA는 두 가지 일을 합니다. **Scale-Up**: Pending 상태 Pod가 있고, 노드 그룹에 노드를 추가하면 스케줄 가능해질 때 노드를 추가합니다. **Scale-Down**: 특정 노드의 Pod들이 다른 노드로 이주 가능하고, 노드 리소스 사용률이 일정 임계값 이하일 때 노드를 제거합니다.

CA는 Cloud Provider API와 통합됩니다. AWS에서는 Auto Scaling Group, GCP에서는 Managed Instance Group, Azure에서는 VMSS를 조작합니다.

![Cluster Autoscaler 스케일 결정 흐름](/assets/posts/k8s-cluster-autoscaler-flow.svg)

## Scale-Up 동작

CA는 `--scan-interval`(기본 10초)마다 Pending Pod를 확인합니다. Pending Pod가 있으면 각 노드 그룹에 노드를 추가했을 때 해당 Pod를 스케줄할 수 있는지 **시뮬레이션**합니다. 가능한 노드 그룹 중 `expander` 전략에 따라 최선 그룹을 선택하고 Cloud API로 노드를 추가합니다.

```yaml
# EKS 예시 — CA Deployment 일부
containers:
- name: cluster-autoscaler
  command:
  - ./cluster-autoscaler
  - --cloud-provider=aws
  - --nodes=2:10:eks-ng-standard-xxxxx    # min:max:ASG 이름
  - --expander=least-waste
  - --scale-down-delay-after-add=10m
  - --scale-down-utilization-threshold=0.5
```

## Expander 전략

여러 노드 그룹이 있을 때 어느 그룹을 확장할지 `expander` 옵션으로 결정합니다.

![CA Expander 전략 비교](/assets/posts/k8s-cluster-autoscaler-expanders.svg)

`least-waste`는 노드 추가 후 남는 CPU/메모리가 가장 적은 그룹을 선택합니다. 비용 최적화에 적합합니다. `priority` expander는 ConfigMap으로 그룹별 우선순위를 설정해 Spot 인스턴스 그룹을 먼저 사용하도록 강제할 수 있습니다.

## Scale-Down 차단 조건

CA는 노드를 제거하기 전 다음 조건을 확인합니다. **하나라도 해당하면 Scale-Down을 차단합니다.**

```bash
# Scale-Down 차단 어노테이션
kubectl annotate node node-1 \
  cluster-autoscaler.kubernetes.io/safe-to-evict="false"

# Pod에 annotate (해당 Pod가 있는 노드는 축소 안 됨)
kubectl annotate pod mypod \
  cluster-autoscaler.kubernetes.io/safe-to-evict="false"
```

주요 차단 조건:
- Pod에 `safe-to-evict: "false"` 어노테이션
- `kube-system` 네임스페이스의 DaemonSet이 아닌 Pod
- Local PersistentVolume을 사용하는 Pod
- PodDisruptionBudget을 위반하게 되는 경우
- `emptyDir` 볼륨을 사용하는 Pod (`safe-to-evict: "true"` 어노테이션으로 허용 가능)

## Scale-Down 타이밍 파라미터

```bash
# 주요 파라미터 (기본값)
--scale-down-delay-after-add=10m         # 노드 추가 후 축소 대기
--scale-down-delay-after-delete=0s       # 노드 삭제 후 재평가 대기
--scale-down-unneeded-time=10m           # '필요 없음' 판정 유지 시간
--scale-down-utilization-threshold=0.5   # CPU/메모리 50% 미만이면 후보
```

기본적으로 노드가 10분 이상 '필요 없음' 상태를 유지해야 제거합니다. 갑자기 급격히 늘었다 줄어드는 플래핑(flapping)을 방지합니다.

## Karpenter와의 비교

CA는 성숙도와 광범위한 지원을 갖추고 있지만, 사전 정의된 노드 그룹에 묶여 있어 유연성이 제한됩니다. 다음 글에서 다룰 **Karpenter**는 노드 그룹 개념 없이 Pod 요구사항에 맞춰 최적 인스턴스 타입을 직접 프로비저닝합니다.

---

**지난 글:** [쿠버네티스 VPA — Pod 수직 자동 스케일링](/posts/k8s-vertical-pod-autoscaler/)

**다음 글:** [쿠버네티스 Karpenter — 차세대 노드 자동 프로비저닝](/posts/k8s-karpenter/)

<br>
읽어주셔서 감사합니다. 😊
