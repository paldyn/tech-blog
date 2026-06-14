---
title: "쿠버네티스 스케줄러(Scheduler) 동작 원리"
description: "kube-scheduler가 파드를 어떤 노드에 배치할지 결정하는 Filtering·Scoring 알고리즘, nodeAffinity, podAntiAffinity, Taint/Toleration을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 7
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "scheduler", "affinity", "taint", "toleration", "node-selector"]
featured: false
draft: false
---

[지난 글](/posts/k8s-api-server/)에서 API Server의 요청 처리 흐름을 살펴봤다. 이번에는 파드가 API Server에 저장된 후 어떤 노드에서 실행될지를 결정하는 **kube-scheduler**를 집중적으로 살펴본다.

## 스케줄러의 기본 역할

스케줄러의 역할은 단순하다: **`nodeName`이 없는 파드를 감지하고, 실행할 노드를 선택해 파드의 `nodeName`을 업데이트한다.** 실제 컨테이너를 실행하지는 않는다. 배치 결정만 내리고, 실행은 kubelet이 담당한다.

```bash
# nodeName 없는 파드 확인 (스케줄 대기 중)
kubectl get pods -o wide | grep Pending

# 스케줄러가 어떤 결정을 내렸는지 확인
kubectl describe pod <pod-name>
# Events 섹션에서 "Successfully assigned default/myapp to node-1" 확인
```

## Filtering → Scoring → Binding 알고리즘

![스케줄러 노드 선택 알고리즘](/assets/posts/k8s-scheduler-algorithm.svg)

### 1단계: Filtering

파드를 실행할 수 없는 노드를 제거한다. 다음 조건 중 하나라도 해당하면 탈락이다.

- **자원 부족**: 파드의 `resources.requests`를 수용할 CPU/메모리 여유가 없는 노드
- **Taint**: 노드에 taint가 있는데 파드에 대응하는 toleration이 없는 경우
- **nodeSelector/nodeAffinity**: 파드가 요구하는 레이블이 없거나 조건 불일치
- **볼륨**: 파드가 요청한 PVC 볼륨을 해당 노드에 마운트할 수 없는 경우
- **노드 상태**: `NotReady`, `OutOfDisk` 상태인 노드

### 2단계: Scoring

남은 노드에 0~100 사이의 점수를 매겨 순위를 매긴다.

| 플러그인 | 점수 로직 |
|---|---|
| `LeastRequestedPriority` | 자원 요청이 적게 된 노드 우대 (균형 분산) |
| `ImageLocalityPriority` | 파드 이미지가 이미 노드에 있으면 높은 점수 |
| `NodeAffinityPriority` | preferred affinity 규칙에 맞는 노드 우대 |
| `InterPodAffinityPriority` | podAffinity 규칙에 따라 점수 조정 |

최고점 노드가 선택된다. 동점이면 임의로 하나 선택.

### 3단계: Binding

선택된 노드를 파드의 `spec.nodeName`에 기록해 API Server에 업데이트 요청을 보낸다. 이 업데이트를 kubelet이 Watch로 감지하고 컨테이너를 실행한다.

## 스케줄링 제약 조건

![스케줄링 제약 조건 비교](/assets/posts/k8s-scheduler-affinity.svg)

### nodeSelector

가장 단순한 방식으로, 노드 레이블을 정확히 매칭한다.

```yaml
spec:
  nodeSelector:
    disk: ssd
    zone: us-east-1a
```

### nodeAffinity

`nodeSelector`의 상위 호환. 표현식(In, NotIn, Exists, DoesNotExist, Gt, Lt)과 소프트/하드 조건을 지원한다.

```yaml
spec:
  affinity:
    nodeAffinity:
      # 반드시 만족해야 하는 조건 (hard)
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: kubernetes.io/arch
            operator: In
            values: [amd64, arm64]
      # 가능하면 만족 (soft) - weight로 우선순위 조절
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 80
        preference:
          matchExpressions:
          - key: disk
            operator: In
            values: [ssd]
```

### podAntiAffinity (고가용성 필수)

같은 앱의 파드가 여러 노드에 분산되도록 강제한다. HA 구성에서 가장 자주 쓰이는 패턴이다.

```yaml
spec:
  affinity:
    podAntiAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels:
            app: myapp
        topologyKey: kubernetes.io/hostname
        # topologyKey를 zone으로 바꾸면 다른 AZ에 분산
```

### Taint와 Toleration

Taint는 노드에 설정하고, Toleration은 파드에 설정한다. Taint가 있는 노드에는 해당 Toleration이 없는 파드가 배치되지 않는다. GPU 노드, 고메모리 노드, 시스템 전용 노드를 격리할 때 사용한다.

```bash
# 노드에 Taint 추가 (GPU 전용 노드)
kubectl taint nodes gpu-node-1 gpu=true:NoSchedule

# Taint 제거
kubectl taint nodes gpu-node-1 gpu=true:NoSchedule-
```

```yaml
# GPU가 필요한 파드에 Toleration 추가
spec:
  tolerations:
  - key: "gpu"
    operator: "Equal"
    value: "true"
    effect: "NoSchedule"
  nodeSelector:
    gpu: "true"
```

Taint effect 종류:
- `NoSchedule`: Toleration 없으면 새 파드 스케줄 금지
- `PreferNoSchedule`: 가능하면 피하지만 강제는 아님
- `NoExecute`: 기존 실행 중인 파드까지 강제 퇴거

## 스케줄러 디버깅

```bash
# 파드가 Pending 상태인 이유 확인
kubectl describe pod <pod-name>
# "Events" 섹션에서 "FailedScheduling" 이벤트 확인
# 예: 0/3 nodes are available: insufficient cpu

# 특정 노드에 강제 배치 (테스트용 - nodeName 직접 지정)
kubectl run test --image=nginx --overrides='{"spec":{"nodeName":"node-1"}}'

# 스케줄러 로그에서 결정 과정 확인
kubectl -n kube-system logs -l component=kube-scheduler | grep -i "pod"
```

## 커스텀 스케줄러

K8s는 기본 스케줄러 외에 **커스텀 스케줄러**를 추가로 실행할 수 있다. 파드의 `spec.schedulerName` 필드로 어떤 스케줄러를 사용할지 지정한다.

```yaml
spec:
  schedulerName: my-custom-scheduler  # 기본값: default-scheduler
  containers:
  - name: app
    image: myapp:1.0
```

Volcano, Yunikorn 같은 배치 처리 특화 스케줄러나, AI/ML 워크로드에 최적화된 스케줄러를 사용하는 사례가 늘고 있다.

---

**지난 글:** [Kubernetes API Server 완전 이해](/posts/k8s-api-server/)

**다음 글:** [컨트롤러 매니저(Controller Manager) 이해](/posts/k8s-controller-manager/)

<br>
읽어주셔서 감사합니다. 😊
