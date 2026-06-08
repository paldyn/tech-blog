---
title: "Descheduler — 실행 중인 Pod를 더 나은 노드로 재배치"
description: "Descheduler의 동작 원리, LowNodeUtilization/RemoveDuplicates/RemovePodsViolatingTopologySpread 등 핵심 정책 플러그인, CronJob/Deployment 배포 방식을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 8
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "descheduler", "scheduling", "rebalancing", "node-utilization", "pod-eviction"]
featured: false
draft: false
---

[지난 글](/posts/k8s-pod-priority-preemption/)에서 Pod Priority로 스케줄 우선순위를 제어하는 방법을 알아봤다. 쿠버네티스 Scheduler는 Pod가 생성되는 시점에 최적의 노드를 선택하지만, 클러스터 상태는 이후에도 계속 변한다. 노드가 추가되거나, 장애 후 복구되거나, 노드 레이블이 변경될 때 이미 실행 중인 Pod의 배치가 최적이 아닌 상태가 된다. **Descheduler**는 이런 "stale" 배치를 감지해 Pod를 축출하고, 일반 Scheduler가 더 나은 노드에 다시 배치하도록 유도한다.

## 동작 방식

Descheduler는 쿠버네티스 SIG-Scheduling이 관리하는 독립 프로젝트다. 클러스터에서 실행되며, 설정한 정책에 따라 주기적으로 실행되어 재배치가 필요한 Pod를 Evict(축출)한다. Descheduler 자체는 새 Pod를 스케줄하지 않는다. Evict 이후의 배치는 일반 Scheduler의 몫이다.

![Descheduler — 실행 중 Pod 재배치](/assets/posts/k8s-descheduler-concept.svg)

중요한 점은 Descheduler가 **PodDisruptionBudget(PDB)을 존중**한다는 것이다. PDB 때문에 축출이 불가능한 Pod는 Descheduler가 건너뛴다.

## 설치

Descheduler는 Helm으로 설치하는 것이 가장 편하다.

```bash
helm repo add descheduler \
  https://kubernetes-sigs.github.io/descheduler/
helm install descheduler descheduler/descheduler \
  --namespace kube-system \
  --set schedule="*/5 * * * *"
```

## 정책 플러그인

![Descheduler 정책 플러그인](/assets/posts/k8s-descheduler-policies.svg)

각 플러그인을 활성화/비활성화하고 파라미터를 조정하는 것이 Descheduler 설정의 핵심이다.

## LowNodeUtilization 설정

가장 많이 사용하는 플러그인이다. 노드별 리소스 사용률을 확인해 과부하 노드에서 여유 노드로 Pod를 재분배한다.

```yaml
apiVersion: descheduler/v1alpha2
kind: DeschedulerPolicy
profiles:
  - name: default
    pluginConfig:
      - name: LowNodeUtilization
        args:
          thresholds:
            # 이 수준 이하면 저부하 노드 (수신 대상)
            cpu: 20
            memory: 20
            pods: 20
          targetThresholds:
            # 이 수준 이상이면 과부하 노드 (축출 대상)
            cpu: 50
            memory: 50
            pods: 50
    plugins:
      balance:
        enabled:
          - LowNodeUtilization
```

CPU/메모리 사용률이 50% 이상인 노드에서 Pod를 Evict하고, 20% 이하인 노드로 Scheduler가 재배치하도록 유도한다.

## RemoveDuplicates와 TopologySpread 위반 정리

```yaml
profiles:
  - name: default
    plugins:
      deschedule:
        enabled:
          - RemoveDuplicates
          - RemovePodsViolatingNodeAffinity
          - RemovePodsViolatingTopologySpreadConstraints
      balance:
        enabled:
          - LowNodeUtilization
    pluginConfig:
      - name: RemovePodsViolatingNodeAffinity
        args:
          nodeAffinityType:
            - requiredDuringSchedulingIgnoredDuringExecution
      - name: RemovePodsViolatingTopologySpreadConstraints
        args:
          constraints:
            - DoNotSchedule
```

새 노드가 추가된 후 기존 Pod들이 균등하게 분산되지 않은 상황에서 `RemovePodsViolatingTopologySpreadConstraints`가 자동으로 재배치를 트리거한다.

## CronJob vs Deployment 실행 모式

Descheduler는 두 가지 방식으로 실행할 수 있다.

**CronJob 방식** (기본): 일정 주기로 한 번씩 실행하고 종료한다. 실행 간격이 길면 그 사이 발생한 불균형이 누적된다.

```bash
# 5분마다 실행
schedule: "*/5 * * * *"
```

**Deployment 방식**: 지속적으로 실행되며 `deschedulingInterval`에 따라 반복 평가한다. 빠른 반응이 필요한 경우 유용하다.

```yaml
kind: Deployment
# ...
args:
  - --descheduling-interval=2m
  - --v=3
```

## 주의사항

Descheduler를 과도하게 공격적으로 설정하면 Pod가 계속 축출과 재배치를 반복하는 **흔들림(thrashing)** 현상이 발생한다. `LowNodeUtilization`의 threshold와 targetThreshold 사이에 충분한 간격(최소 20% 이상)을 두고, Descheduler 실행 주기를 너무 짧게 설정하지 않는 것이 좋다.

또한 Stateful 워크로드(StatefulSet, 로컬 PV 사용 Pod 등)는 Descheduler의 축출을 피하도록 Namespace를 제외하거나 `priorityClassName`을 높게 설정하는 것이 안전하다.

---

**지난 글:** [Pod Priority와 Preemption — 중요한 Pod 먼저 배치하기](/posts/k8s-pod-priority-preemption/)

**다음 글:** [Node Cordon과 Drain — 안전한 노드 작업 절차](/posts/k8s-node-cordon-drain/)

<br>
읽어주셔서 감사합니다. 😊
