---
title: "쿠버네티스 Pod 퇴출(Eviction) — kubelet의 리소스 보호 메커니즘"
description: "Kubernetes kubelet이 노드 리소스 압박 시 Pod를 퇴출하는 메커니즘, Soft/Hard 퇴출 차이, 퇴출 임계값 설정, 퇴출 방지 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-03"
archiveOrder: 10
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "Pod 퇴출", "Eviction", "kubelet", "MemoryPressure", "리소스 관리", "QoS"]
featured: false
draft: false
---

[지난 글](/posts/k8s-quality-of-service/)에서 QoS 클래스가 퇴출 우선순위를 결정하는 방법을 살펴봤습니다. 이번에는 퇴출(Eviction)의 전체 메커니즘을 자세히 다룹니다. **퇴출**이란 kubelet이 노드의 메모리, 디스크 같은 자원이 부족해질 때 Pod를 강제로 종료시켜 노드를 보호하는 메커니즘입니다. 퇴출을 이해하면 서비스 중단 없이 클러스터를 안정적으로 운영할 수 있습니다.

## 퇴출이 발생하는 두 가지 원인

**노드 수준 퇴출 (kubelet eviction)**: kubelet이 노드의 가용 메모리, 디스크, inode가 임계값 아래로 떨어지면 Pod를 퇴출합니다. 본문에서 다루는 주제입니다.

**API 수준 퇴출 (Eviction API)**: `kubectl drain`, PodDisruptionBudget, 클러스터 오토스케일러가 트리거합니다. 노드 유지보수나 스케일 다운 시 발생합니다.

![Pod 퇴출 흐름](/assets/posts/k8s-pod-eviction-flow.svg)

## kubelet의 퇴출 임계값

kubelet은 지속적으로 노드 자원을 모니터링합니다. 다음 자원들이 임계값 이하로 떨어지면 퇴출을 시작합니다.

- `memory.available`: 가용 메모리
- `nodefs.available`: 노드 루트 파티션 가용 디스크
- `nodefs.inodesFree`: 루트 파티션 가용 inode
- `imagefs.available`: 컨테이너 이미지 파티션 가용 디스크

기본 Hard 퇴출 임계값:
- `memory.available < 100Mi`
- `nodefs.available < 10%`
- `imagefs.available < 15%`

## Soft Eviction vs Hard Eviction

**Soft Eviction (소프트 퇴출)**: 임계값을 초과해도 `evictionSoftGracePeriod`에 설정된 시간 동안 대기합니다. 그 시간이 지나도 해소되지 않으면 Pod에 SIGTERM을 보내고 `terminationGracePeriodSeconds`를 허용합니다.

**Hard Eviction (하드 퇴출)**: 임계값 위반 즉시 Pod를 강제 종료합니다. Grace period 없이 SIGKILL이 즉시 전송됩니다.

```yaml
# KubeletConfiguration 예시
apiVersion: kubelet.config.k8s.io/v1beta1
kind: KubeletConfiguration
evictionHard:
  memory.available: "100Mi"    # 즉시 퇴출
  nodefs.available: "10%"
evictionSoft:
  memory.available: "500Mi"    # grace period 후 퇴출
evictionSoftGracePeriod:
  memory.available: "1m30s"    # 1분 30초 대기
evictionMinimumReclaim:
  memory.available: "200Mi"    # 퇴출 후 최소 200Mi 회복
```

`evictionMinimumReclaim`은 퇴출 후 자원이 임계값 바로 위로만 올라가면 곧바로 또 퇴출이 발생하는 "퇴출 진동" 현상을 방지합니다.

## 퇴출 대상 Pod 선정

같은 QoS 클래스 내에서 퇴출 대상을 선정하는 세부 기준입니다.

1. **Priority**: `PriorityClass`가 낮은 Pod 먼저
2. **사용 비율**: requests 대비 실제 사용량 비율이 높은 순
3. **시작 시각**: 나중에 시작한 Pod 먼저

```bash
# Pod Priority 설정 예시
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: high-priority
value: 1000
globalDefault: false

# Pod에 적용
spec:
  priorityClassName: high-priority
```

`priorityClassName: system-cluster-critical`은 kube-system 컴포넌트에 사용되는 최고 우선순위입니다. 이 클래스를 가진 Pod는 퇴출되지 않습니다(Guaranteed이면).

![퇴출 임계값 설정과 명령어](/assets/posts/k8s-pod-eviction-config.svg)

## 퇴출된 Pod 처리

퇴출된 Pod는 `Failed` 상태로 남습니다. Deployment나 StatefulSet이 관리하는 Pod는 컨트롤러가 즉시 새 Pod를 생성합니다. 노드가 여전히 압박 상태라면 다른 노드에 배치됩니다.

```bash
# 퇴출된 Pod 목록
kubectl get pods -A \
  --field-selector=status.phase=Failed

# 퇴출 이유 확인
kubectl describe pod evicted-pod | grep -A5 "Reason"
# Reason: Evicted
# Message: The node was low on resource: memory.

# 퇴출된 Pod 일괄 삭제
kubectl delete pods -A \
  --field-selector=status.phase=Failed
```

## 퇴출 방지 전략

**PodDisruptionBudget(PDB)**: 동시에 퇴출되는 Pod 수를 제한합니다. 단, API 수준 퇴출(drain)만 제어하고 kubelet 퇴출에는 적용되지 않습니다.

**올바른 requests/limits 설정**: Guaranteed QoS를 사용하면 퇴출 우선순위가 가장 낮습니다.

**노드 자원 확보**: `--system-reserved`, `--kube-reserved` 설정으로 시스템과 쿠버네티스 컴포넌트를 위한 자원을 미리 예약합니다.

```yaml
# KubeletConfiguration
systemReserved:
  memory: "1Gi"
  cpu: "500m"
kubeReserved:
  memory: "500Mi"
  cpu: "200m"
```

**LimitRange**: 네임스페이스에 기본 requests/limits를 설정해 BestEffort Pod가 생성되는 것을 방지합니다.

```bash
# 노드 할당 가능 자원 확인
kubectl describe node node1 | grep -A5 "Allocatable"

# 현재 requests 합산 확인
kubectl describe node node1 | grep -A20 "Allocated resources"
```

퇴출은 클러스터 안정성을 위한 마지막 방어선입니다. 퇴출이 자주 발생한다면 requests/limits 설정, LimitRange, ResourceQuota, 노드 용량 등을 종합적으로 검토해야 합니다.

---

**지난 글:** [쿠버네티스 QoS 클래스 — Guaranteed, Burstable, BestEffort](/posts/k8s-quality-of-service/)

<br>
읽어주셔서 감사합니다. 😊
