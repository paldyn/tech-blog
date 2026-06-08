---
title: "Node Affinity와 Pod Affinity — 유연한 스케줄링 제어"
description: "nodeAffinity의 required/preferred 모드, matchExpressions 연산자(In/NotIn/Exists), podAffinity와 podAntiAffinity로 Pod 간 co-location 및 분산 배치를 구현하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 4
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "node-affinity", "pod-affinity", "anti-affinity", "scheduling", "topology"]
featured: false
draft: false
---

[지난 글](/posts/k8s-node-selectors/)에서 `nodeSelector`의 AND-only 한계를 살펴봤다. 이번에는 그 한계를 극복하는 **Affinity와 Anti-Affinity** 메커니즘을 다룬다. `nodeAffinity`는 nodeSelector를 확장해 IN/NotIn 같은 집합 연산자와 가중치 기반의 "선호" 개념을 제공한다. `podAffinity`와 `podAntiAffinity`는 노드가 아닌 다른 Pod와의 관계를 기준으로 스케줄링을 제어한다. HA 구성, 네트워크 지연 최적화, 리소스 격리를 정교하게 구현할 때 핵심이 되는 기능이다.

## 세 가지 Affinity 유형

![Affinity / Anti-Affinity 유형 비교](/assets/posts/k8s-affinity-types.svg)

`nodeAffinity`는 Pod와 Node의 레이블 관계를 정의한다. `podAffinity`는 특정 Pod가 있는 곳에 같이 배치(co-location)하는 규칙이고, `podAntiAffinity`는 특정 Pod가 있는 곳을 피하는 규칙이다. 세 가지 모두 `required`(Hard, 반드시 충족)와 `preferred`(Soft, 가능하면 충족) 두 모드를 지원한다.

## nodeAffinity

```yaml
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: zone
              operator: In
              values:
                - us-east
                - us-west
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        preference:
          matchExpressions:
            - key: gpu
              operator: Exists
```

`requiredDuringSchedulingIgnoredDuringExecution`은 스케줄 시점에 반드시 충족해야 한다. `IgnoredDuringExecution`은 이미 배치된 Pod가 실행 중에 노드 레이블이 변경되더라도 Pod를 축출하지 않는다는 뜻이다.

지원하는 연산자:
- `In`: 값 목록 중 하나와 일치
- `NotIn`: 값 목록에 없음
- `Exists`: 키가 존재하면 됨 (값 무관)
- `DoesNotExist`: 키가 없음
- `Gt`, `Lt`: 숫자 비교 (리소스 크기 등)

`nodeSelectorTerms` 안의 여러 `matchExpressions` 항목은 AND 조건이다. `nodeSelectorTerms` 배열의 여러 항목끼리는 OR 조건이다. nodeSelector보다 훨씬 유연한 표현이 가능하다.

## podAffinity와 topologyKey

![nodeAffinity 코드 예시](/assets/posts/k8s-affinity-code.svg)

`podAffinity`의 핵심은 `topologyKey`다. "어떤 범위(토폴로지)에서 공동 배치할지"를 정의한다.

```yaml
affinity:
  podAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels:
            app: cache
        topologyKey: kubernetes.io/hostname
```

`topologyKey: kubernetes.io/hostname`이면 "cache 레이블 Pod와 같은 노드"를 의미한다. `topologyKey: topology.kubernetes.io/zone`이면 "같은 AZ의 어떤 노드든"을 의미한다. Redis 캐시와 앱 서버를 같은 노드에 배치해 네트워크 레이턴시를 줄이는 패턴에 유용하다.

## podAntiAffinity로 HA 구성

레플리카를 다른 노드에 분산 배치하는 것은 고가용성의 기본이다.

```yaml
affinity:
  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels:
            app: my-service
        topologyKey: kubernetes.io/hostname
```

이 설정으로 `app=my-service` Pod는 같은 노드에 두 개 이상 배치되지 않는다. 노드 수보다 레플리카 수가 많으면 초과분은 `Pending`이 된다. 유연하게 처리하려면 `preferred`를 사용한다.

AZ 수준으로 분산하려면:

```yaml
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app: my-service
          topologyKey: topology.kubernetes.io/zone
```

`preferred`이므로 AZ 수보다 레플리카가 많아도 배포가 막히지 않는다.

## 성능 주의사항

`podAffinity`와 `podAntiAffinity`는 Scheduler가 모든 기존 Pod의 레이블을 확인해야 하므로 클러스터가 커질수록 연산 비용이 높다. 수천 개 Pod가 있는 클러스터에서 `required` podAntiAffinity를 광범위하게 사용하면 스케줄링 지연이 발생할 수 있다. 가능하면 `preferred`를 우선 사용하고, `required`는 꼭 필요한 경우에만 쓴다.

Pod 수가 많은 환경에서는 다음 편에서 소개할 **Topology Spread Constraints**가 더 효율적인 대안이 된다.

## nodeAffinity vs nodeSelector 선택 기준

| 상황 | 권장 방법 |
|---|---|
| 단순 레이블 매칭 (AND만 필요) | `nodeSelector` |
| OR 조건 또는 여러 값 중 선택 | `nodeAffinity (required)` |
| "가능하면 이 노드로" 선호 표현 | `nodeAffinity (preferred)` |
| 레이블 없음/있음 조건 | `nodeAffinity (Exists/DoesNotExist)` |

---

**지난 글:** [Node Selectors — 파드를 원하는 노드로 유도하는 첫 번째 방법](/posts/k8s-node-selectors/)

**다음 글:** [Taints와 Tolerations — 노드 오염과 내성](/posts/k8s-taints-tolerations/)

<br>
읽어주셔서 감사합니다. 😊
