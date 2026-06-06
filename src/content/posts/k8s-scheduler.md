---
title: "kube-scheduler 완전 해설 — Pod는 어떻게 노드에 배치되는가"
description: "Kubernetes 스케줄러의 Filtering, Scoring, Binding 단계를 코드와 함께 설명하고, nodeSelector·어피니티·테인트·톨러레이션의 동작 원리를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 4
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "스케줄러", "kube-scheduler", "Pod배치", "노드어피니티", "테인트"]
featured: false
draft: false
---

[지난 글](/posts/k8s-vs-docker-compose/)에서 Kubernetes와 Docker Compose를 비교했다. Kubernetes가 프로덕션에서 강력한 이유 중 하나가 **지능형 스케줄링**이다. Pod를 어느 노드에 실행할지를 사람이 직접 지정하지 않아도, 스케줄러가 클러스터 상태를 분석해서 최적의 노드를 자동으로 선택한다.

## kube-scheduler란

`kube-scheduler`는 Kubernetes Control Plane 컴포넌트 중 하나다. 새로 생성된 Pod가 **Pending** 상태로 etcd에 기록되면, 스케줄러가 이를 감지하고 적합한 노드를 찾아 `spec.nodeName` 필드에 기록한다. 이후 해당 노드의 kubelet이 Pod를 실제로 실행한다.

스케줄러 자체는 어떤 컨테이너도 실행하지 않는다. 오직 **"어느 노드에 배치할지" 결정**만 담당한다.

## 스케줄링 3단계

![kube-scheduler 동작 흐름](/assets/posts/k8s-scheduler-flow.svg)

### 1단계: Filtering (필터링)

모든 노드 중 Pod를 실행할 수 **없는** 노드를 제거한다. 기준은 다음과 같다.

- 요청한 CPU/Memory를 제공할 리소스 여유가 없는 노드
- `nodeSelector` 레이블 조건을 만족하지 않는 노드
- Taint가 있고 Pod에 해당 Toleration이 없는 노드
- NodeAffinity 필수 조건(`requiredDuringSchedulingIgnoredDuringExecution`)을 충족하지 않는 노드

필터링 후 남은 노드들이 다음 단계로 넘어간다. 남은 노드가 없으면 Pod는 계속 Pending 상태로 남는다.

### 2단계: Scoring (점수화)

필터링을 통과한 노드들에 점수를 매긴다. 기본 점수 기준은 다음과 같다.

| 플러그인 | 설명 |
|---|---|
| LeastRequestedPriority | 리소스 사용률이 낮은 노드 선호 |
| BalancedResourceAllocation | CPU/메모리 균형이 좋은 노드 선호 |
| NodeAffinityPriority | Preferred 어피니티 조건 만족도 |
| TaintTolerationPriority | Toleration 일치 정도 |

최고 점수 노드가 선택된다. 동점이면 무작위로 하나 선택.

### 3단계: Binding (바인딩)

선택된 노드를 Pod의 `spec.nodeName`에 기록하고 API Server에 업데이트한다. 이후 kubelet이 이 정보를 보고 컨테이너를 실행한다.

## Pod 배치를 제어하는 방법

### nodeSelector (단순 레이블 매칭)

```yaml
# 특정 레이블이 있는 노드에만 배치
spec:
  nodeSelector:
    disk-type: ssd          # 이 레이블이 없는 노드는 필터링
    zone: ap-northeast-2a
```

```bash
# 노드에 레이블 추가
kubectl label node worker-1 disk-type=ssd
kubectl label node worker-1 zone=ap-northeast-2a
```

### NodeAffinity (유연한 조건)

```yaml
spec:
  affinity:
    nodeAffinity:
      # 반드시 충족해야 하는 조건
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: kubernetes.io/arch
            operator: In
            values: ["amd64"]
      # 가능하면 충족하면 좋은 조건 (점수에 반영)
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 80
        preference:
          matchExpressions:
          - key: disk-type
            operator: In
            values: ["ssd"]
```

### Taint와 Toleration

Taint는 노드에 "특별한 Pod만 허용"이라는 표시를 붙이는 것이다.

```bash
# 노드에 Taint 추가 — gpu=true 레이블 없는 Pod 거부
kubectl taint node gpu-node gpu=true:NoSchedule

# 특정 노드를 아예 사용 불가로 만들기
kubectl taint node broken-node maintenance=true:NoExecute
```

```yaml
# GPU가 필요한 Pod에 Toleration 추가
spec:
  tolerations:
  - key: "gpu"
    operator: "Equal"
    value: "true"
    effect: "NoSchedule"
  containers:
  - name: ml-training
    image: tensorflow/tensorflow:latest-gpu
    resources:
      limits:
        nvidia.com/gpu: 1
```

## 커스텀 스케줄러

기본 스케줄러(`kube-scheduler`)로 충족되지 않는 특수 배치 로직이 필요하면 커스텀 스케줄러를 구현할 수 있다.

![스케줄링 프레임워크 Extension Points](/assets/posts/k8s-scheduler-plugins.svg)

```yaml
# Pod에 커스텀 스케줄러 지정
spec:
  schedulerName: my-gpu-scheduler  # 기본값: default-scheduler
  containers:
  - name: ml-job
    image: myrepo/ml:v1
```

스케줄러 프레임워크의 Extension Point(PreFilter, Filter, Score, Reserve, Bind)에 플러그인을 끼워 넣어 스케줄링 로직을 커스터마이즈할 수 있다.

## 스케줄러 디버깅

Pod가 Pending 상태에서 벗어나지 못하면 먼저 `describe`로 이유를 확인한다.

```bash
kubectl describe pod <pending-pod>

# Events 섹션에 스케줄러 메시지가 나타남
# Events:
#   Warning  FailedScheduling  0/3 nodes are available:
#             3 Insufficient cpu.
```

흔한 원인: 리소스 부족, nodeSelector 미일치, Taint/Toleration 불일치.

---

**지난 글:** [Kubernetes vs Docker Compose](/posts/k8s-vs-docker-compose/)

**다음 글:** [Kubernetes YAML 매니페스트 작성법](/posts/k8s-yaml-manifests/)

<br>
읽어주셔서 감사합니다. 😊
