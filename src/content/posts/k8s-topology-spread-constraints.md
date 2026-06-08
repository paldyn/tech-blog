---
title: "Topology Spread Constraints — Pod 분산 배치 최적화"
description: "maxSkew, topologyKey, whenUnsatisfiable 파라미터로 AZ/노드 간 Pod를 균등 분산하는 방법, podAntiAffinity 대비 장점, 클러스터 전체 기본값 설정을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 6
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "topology-spread-constraints", "scheduling", "ha", "availability-zone", "load-balancing"]
featured: false
draft: false
---

[지난 글](/posts/k8s-taints-tolerations/)에서 Taint와 Toleration으로 노드 접근을 제어하는 방법을 살펴봤다. 이번에는 **Pod를 여러 토폴로지 도메인(AZ, 노드)에 균등하게 분산하는** Topology Spread Constraints(TSC)를 다룬다. `podAntiAffinity`로도 분산이 가능하지만, TSC는 "몇 대까지 편중을 허용하는가"를 `maxSkew`로 표현할 수 있어 훨씬 정교하다. 쿠버네티스 1.19에서 GA된 이후 HA 구성의 표준으로 자리잡았다.

## 문제: Pod 편중

Deployment로 5개 레플리카를 배포할 때 Scheduler가 알아서 분산해주지만, 보장은 없다. AZ가 2개인 클러스터에서 5개 Pod가 AZ-A에 4개, AZ-B에 1개로 배치될 수 있다. AZ-A에 장애가 나면 서비스의 80%가 중단된다.

![Topology Spread Constraints — Pod 분산 배치](/assets/posts/k8s-topology-spread-concept.svg)

## 핵심 파라미터

![Topology Spread Constraints 설정](/assets/posts/k8s-topology-spread-code.svg)

**maxSkew**: 토폴로지 도메인 간 Pod 수의 최대 허용 차이다. `maxSkew: 1`이면 어떤 두 도메인의 Pod 수 차이도 1 이하여야 한다. 2개 AZ에 5개 Pod라면 3/2로 배치되어 차이가 1 ≤ maxSkew를 만족한다.

**topologyKey**: 어떤 Node 레이블 기준으로 도메인을 나눌지 지정한다. `topology.kubernetes.io/zone`이면 AZ 단위, `kubernetes.io/hostname`이면 개별 노드 단위로 분산한다.

**whenUnsatisfiable**: 제약을 만족할 수 없을 때 동작을 결정한다.
- `DoNotSchedule`: Hard 제약. 조건 불만족 시 Pod는 Pending 상태가 된다.
- `ScheduleAnyway`: Soft 제약. 최대한 균형을 맞추지만 불가능해도 스케줄한다.

## AZ + Node 이중 분산

실무에서는 AZ 간 분산과 노드 간 분산을 동시에 적용한다.

```yaml
spec:
  topologySpreadConstraints:
    # AZ 간 균등 분산 (Hard)
    - maxSkew: 1
      topologyKey: topology.kubernetes.io/zone
      whenUnsatisfiable: DoNotSchedule
      labelSelector:
        matchLabels:
          app: my-service
    # 노드 간 분산 (Soft)
    - maxSkew: 1
      topologyKey: kubernetes.io/hostname
      whenUnsatisfiable: ScheduleAnyway
      labelSelector:
        matchLabels:
          app: my-service
```

AZ 분산은 Hard로 설정해 AZ 간 불균형을 막고, 노드 분산은 Soft로 설정해 노드 수가 레플리카보다 적어도 배포가 멈추지 않도록 한다.

## podAntiAffinity 대비 장점

```bash
# 방법 1: podAntiAffinity (기존 방식)
# 같은 노드에 두 개 이상 금지 — 레플리카 수 > 노드 수면 Pending
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - topologyKey: kubernetes.io/hostname

# 방법 2: TSC (새로운 방식)  
# maxSkew로 편중 허용 수준 지정 가능
topologySpreadConstraints:
  - maxSkew: 2   # 최대 2개 차이 허용
    topologyKey: kubernetes.io/hostname
    whenUnsatisfiable: DoNotSchedule
```

TSC의 주요 장점은 세 가지다. 첫째, `maxSkew`로 편중 허용 수준을 조절할 수 있다. 둘째, 여러 토폴로지를 동시에 제약할 수 있다. 셋째, `podAntiAffinity`보다 Scheduler 성능 비용이 낮다.

## 클러스터 전체 기본값 설정

쿠버네티스 1.24+에서 `kube-scheduler`의 `DefaultTopologySpread` 플러그인으로 TSC를 모든 Pod에 기본 적용할 수 있다.

```yaml
# scheduler-config.yaml
apiVersion: kubescheduler.config.k8s.io/v1
kind: KubeSchedulerConfiguration
profiles:
  - pluginConfig:
      - name: DefaultTopologySpread
        args:
          defaultConstraints:
            - maxSkew: 1
              topologyKey: topology.kubernetes.io/zone
              whenUnsatisfiable: ScheduleAnyway
```

## 레플리카 수와 AZ 수 관계

TSC는 레플리카 수가 AZ 수의 배수가 아닐 때 동작에 주의해야 한다.

| AZ 수 | 레플리카 | maxSkew=1 가능 여부 | 분배 |
|---|---|---|---|
| 3 | 6 | O | 2/2/2 |
| 3 | 7 | O | 3/2/2 |
| 3 | 5 | O | 2/2/1 |
| 2 | 3 | O | 2/1 |
| 3 | 1 | X (Pending) | — |

레플리카가 1개이고 AZ가 3개라면 DoNotSchedule 조건에서 스케줄이 불가능하다. 하나의 AZ에 1개, 나머지 AZ에 0개가 되는데 차이가 1을 초과하기 때문이다. 이 경우 `ScheduleAnyway`를 쓰거나 `minDomains` 파라미터(k8s 1.24+)를 활용한다.

## minDomains

```yaml
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule
    minDomains: 3
    labelSelector:
      matchLabels:
        app: my-service
```

`minDomains: 3`은 "최소 3개의 토폴로지 도메인이 있어야 한다"는 의미다. 도메인 수가 minDomains보다 적으면 global minimum은 0으로 처리된다. 클러스터가 3개 AZ로 확장되는 것을 기대하고 미리 설정해두는 용도로 쓴다.

---

**지난 글:** [Taints와 Tolerations — 노드가 Pod를 밀어내는 메커니즘](/posts/k8s-taints-tolerations/)

**다음 글:** [Pod Priority와 Preemption — 중요한 Pod 먼저 배치하기](/posts/k8s-pod-priority-preemption/)

<br>
읽어주셔서 감사합니다. 😊
