---
title: "Node Selectors — 파드를 원하는 노드로 유도하는 첫 번째 방법"
description: "nodeSelector로 Pod를 특정 레이블을 가진 Node에만 스케줄하는 방법, 쿠버네티스 내장 Well-known Label 목록, nodeSelector의 한계와 Node Affinity와의 관계를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 3
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "node-selector", "scheduling", "labels", "node-affinity", "gpu"]
featured: false
draft: false
---

[지난 글](/posts/k8s-pod-security-admission/)에서 Pod Security Admission으로 클러스터 보안 정책을 집행하는 방법을 살펴봤다. 이번에는 스케줄링 쪽으로 방향을 바꿔 **Pod를 어느 Node에 배치할지 제어하는 방법**을 다룬다. 그 시작은 가장 단순한 메커니즘인 `nodeSelector`다. GPU 노드에만 ML 워크로드를 올리거나, 특정 가용 영역(AZ)에만 특정 앱을 배치하거나, Windows 노드에만 윈도우 컨테이너를 스케줄하고 싶을 때 nodeSelector를 사용한다.

## nodeSelector 동작 방식

Scheduler는 Pod를 배치할 후보 Node 목록을 필터링할 때 `nodeSelector` 조건을 사용한다. Pod 스펙에 지정한 모든 레이블 키-값 쌍이 Node 레이블에 존재해야 스케줄 가능하다. AND 조건이다.

![nodeSelector — Pod와 Node 레이블 매칭](/assets/posts/k8s-node-selectors-flow.svg)

조건을 만족하는 Node가 없으면 Pod는 `Pending` 상태로 대기한다. 이 상태는 `kubectl describe pod <name>`으로 확인할 수 있다. 이벤트 섹션에 `0/3 nodes are available: 3 node(s) didn't match nodeSelector`처럼 이유가 나타난다.

## 기본 사용법

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: gpu-workload
spec:
  nodeSelector:
    gpu: "true"
    zone: us-east
  containers:
    - name: ml-trainer
      image: pytorch/pytorch:latest
      resources:
        limits:
          nvidia.com/gpu: 1
```

여기서 `gpu: "true"`와 `zone: us-east` 두 레이블이 모두 있는 Node에만 스케줄된다. 레이블 값은 문자열이므로 `"true"`처럼 따옴표로 감싸는 것이 명확하다.

## Node 레이블 관리

![Node 레이블 관리와 nodeSelector 예시](/assets/posts/k8s-node-selectors-labels.svg)

```bash
# 노드에 레이블 추가
kubectl label node worker-1 gpu=true zone=us-east

# 레이블 확인
kubectl get nodes --show-labels
kubectl get nodes -l gpu=true

# 레이블 제거 (키 뒤에 - 붙임)
kubectl label node worker-1 gpu-
```

## 쿠버네티스 Well-known Labels

쿠버네티스와 클라우드 프로바이더가 Node에 자동으로 붙이는 표준 레이블이 있다. 직접 레이블을 추가하지 않아도 바로 `nodeSelector`에서 활용할 수 있다.

| 레이블 | 예시 값 | 의미 |
|---|---|---|
| `kubernetes.io/hostname` | `worker-1` | 노드 호스트명 |
| `kubernetes.io/os` | `linux`, `windows` | OS 종류 |
| `kubernetes.io/arch` | `amd64`, `arm64` | CPU 아키텍처 |
| `topology.kubernetes.io/zone` | `us-east-1a` | 가용 영역 |
| `topology.kubernetes.io/region` | `us-east-1` | 리전 |
| `node.kubernetes.io/instance-type` | `m5.large` | 인스턴스 타입 |

arm64 아키텍처 노드에만 배포되는 Pod 예시:

```yaml
spec:
  nodeSelector:
    kubernetes.io/arch: arm64
  containers:
    - name: app
      image: myapp:arm64-latest
```

## nodeSelector의 한계

`nodeSelector`는 간단하지만 표현력이 제한적이다.

- **IN 연산자 불가**: `zone=us-east OR zone=us-west`처럼 여러 값 중 하나를 선택할 수 없다. AND 조건만 가능하다.
- **soft 조건 불가**: 매칭 Node가 없으면 무조건 `Pending`이 된다. "가능하면 GPU 노드에, 없으면 다른 노드에"같은 선호(preference) 표현이 안 된다.
- **NotIn, Exists 연산자 불가**: "gpu 레이블이 없는 노드"를 선택하는 것이 불가능하다.

이런 한계를 극복하려면 `nodeAffinity`를 사용해야 한다. 다음 글에서 자세히 다룬다.

## DaemonSet에서의 활용

DaemonSet에서 특정 노드 그룹에만 에이전트를 배포할 때 `nodeSelector`가 자주 쓰인다.

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: gpu-monitor
spec:
  selector:
    matchLabels:
      app: gpu-monitor
  template:
    metadata:
      labels:
        app: gpu-monitor
    spec:
      nodeSelector:
        gpu: "true"
      containers:
        - name: monitor
          image: dcgm-exporter:latest
```

이 DaemonSet은 `gpu=true` 레이블이 있는 Node에만 모니터링 에이전트를 배포한다. 노드에 레이블이 추가되면 자동으로 Pod가 생성되고, 레이블이 제거되면 기존 Pod가 삭제된다.

## 주의사항

`nodeSelector`는 Pod 생성 시점에 평가된다. 이미 실행 중인 Pod의 `nodeSelector`를 변경해도 Pod가 이동하지 않는다. 이미 배치된 Pod가 실행 중인 Node에서 레이블이 제거되더라도 Pod는 계속 실행된다. 재시작되거나 새로 생성될 때 새 조건으로 평가된다.

```bash
# 현재 pending 중인 Pod의 스케줄링 실패 원인 확인
kubectl describe pod <pending-pod-name>
# Events 섹션에서 원인 확인:
# 0/3 nodes are available: node(s) didn't match nodeSelector
```

---

**지난 글:** [Pod Security Admission — PSA 동작 원리와 설정](/posts/k8s-pod-security-admission/)

**다음 글:** [Node Affinity와 Pod Affinity — 유연한 스케줄링 제어](/posts/k8s-affinity-anti-affinity/)

<br>
읽어주셔서 감사합니다. 😊
