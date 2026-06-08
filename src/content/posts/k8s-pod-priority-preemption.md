---
title: "Pod Priority와 Preemption — 중요한 Pod 먼저 배치하기"
description: "PriorityClass 정의와 적용, Preemption(선점) 스케줄링 동작 방식, preemptionPolicy: Never로 선점 없는 우선순위 설정, 시스템 예약 PriorityClass를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 7
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "pod-priority", "preemption", "scheduling", "priorityclass", "resource-management"]
featured: false
draft: false
---

[지난 글](/posts/k8s-topology-spread-constraints/)에서 Pod를 여러 토폴로지에 균등하게 분산하는 방법을 살펴봤다. 이번에는 클러스터 리소스가 부족할 때 어떤 Pod를 먼저 배치할지 결정하는 **Pod Priority와 Preemption**을 다룬다. 프로덕션 서비스 Pod와 배치 작업 Pod가 같은 클러스터에서 경쟁할 때, Priority를 설정하면 Scheduler가 낮은 우선순위 Pod를 축출하고 높은 우선순위 Pod를 위한 자리를 만든다.

## 선점 스케줄링 흐름

![Pod Priority & Preemption — 선점 스케줄링 흐름](/assets/posts/k8s-pod-priority-preemption-flow.svg)

Pending 상태의 높은 Priority Pod를 처리하지 못하면, Scheduler는 어떤 노드에서 낮은 Priority Pod를 축출하면 이 Pod를 배치할 수 있는지 계산한다. 축출 후 공간이 생기면 낮은 Priority Pod들은 `Terminating` 상태로 전환되고, 높은 Priority Pod가 해당 노드에 스케줄된다. 축출된 Pod들은 다른 노드에서 재시작을 시도한다.

## PriorityClass 정의

```yaml
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: production-critical
value: 1000000
globalDefault: false
preemptionPolicy: PreemptLowerPriority
description: "프로덕션 서비스 핵심 컴포넌트"
---
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: batch-low
value: 100
preemptionPolicy: Never
description: "배치 작업 — 선점 불가"
```

`value`는 정수이며, 높을수록 우선순위가 높다. 최대값은 10억(1,000,000,000)이지만 10억과 20억 사이는 시스템 용도로 예약되어 있다. `globalDefault: true`로 설정하면 `priorityClassName`을 지정하지 않은 모든 Pod에 이 클래스가 기본 적용된다.

## Pod에 PriorityClass 적용

![PriorityClass 정의와 적용](/assets/posts/k8s-pod-priority-classes.svg)

```yaml
spec:
  priorityClassName: production-critical
  containers:
    - name: app
      image: myapp:latest
```

`priorityClassName`을 지정하지 않으면 Priority는 0이다. 동일한 Priority를 가진 Pod들 사이에서는 먼저 들어온 Pod가 우선 스케줄된다(FIFO).

## preemptionPolicy: Never

배치 작업처럼 낮은 우선순위를 가지되, 실행 중에 중단되지 않아야 하는 Pod에 사용한다.

```yaml
kind: PriorityClass
metadata:
  name: long-running-batch
value: 500
preemptionPolicy: Never
```

`preemptionPolicy: Never`는 이 PriorityClass를 사용하는 Pod가 스케줄 대기 중일 때 다른 Pod를 선점하지 않는다는 것을 의미한다. 다만, 이 Pod 자신은 더 높은 Priority Pod에 의해 선점될 수 있다.

## 시스템 예약 PriorityClass

쿠버네티스는 두 가지 시스템 PriorityClass를 기본 제공한다.

| PriorityClass | Value | 용도 |
|---|---|---|
| `system-node-critical` | 2,000,001,000 | kubelet, kube-proxy 등 노드 핵심 컴포넌트 |
| `system-cluster-critical` | 2,000,000,000 | coredns, metrics-server 등 클러스터 컴포넌트 |

이 값들은 일반 사용자가 설정할 수 있는 최대값(1,000,000,000)보다 높아, 시스템 컴포넌트는 항상 사용자 워크로드보다 먼저 스케줄된다.

```bash
# 기존 PriorityClass 목록 확인
kubectl get priorityclass

# Priority가 높은 Pod 목록
kubectl get pods --all-namespaces \
  -o custom-columns='NS:.metadata.namespace,NAME:.metadata.name,PRIORITY:.spec.priority' \
  | sort -t' ' -k3 -rn | head -20
```

## Preemption 주의사항

**PodDisruptionBudget(PDB)는 Preemption에서 존중되지 않는다**. Preemption 시 PDB를 위반할 수 있으므로 주의가 필요하다. 쿠버네티스 1.22+에서는 PDB를 최대한 존중하는 방향으로 동작이 개선됐지만, 완전한 보장은 아니다.

축출된 Pod가 다시 Pending 상태가 되면 Priority에 따라 다시 스케줄 대기열에 들어간다. 즉, 축출된 낮은 Priority Pod들은 클러스터에 충분한 여유가 생기기 전까지 계속 Pending 상태일 수 있다.

## 실무 PriorityClass 계층 설계

```yaml
# 계층 1: 시스템 (k8s 내장)
# system-node-critical: 2,000,001,000
# system-cluster-critical: 2,000,000,000

# 계층 2: 프로덕션 핵심
# production-critical: 1,000,000

# 계층 3: 프로덕션 일반
# production-default: 100,000

# 계층 4: 스테이징/개발
# staging: 10,000

# 계층 5: 배치 작업
# batch: 100 (preemptionPolicy: Never)

# 계층 6: 미지정 (기본값)
# (없음): 0
```

계층 수는 최소화하는 것이 좋다. 너무 세분화하면 관리가 복잡해지고 예측 불가능한 선점 동작이 발생할 수 있다.

---

**지난 글:** [Topology Spread Constraints — Pod 분산 배치 최적화](/posts/k8s-topology-spread-constraints/)

**다음 글:** [Descheduler — 실행 중인 Pod 재배치하기](/posts/k8s-descheduler/)

<br>
읽어주셔서 감사합니다. 😊
