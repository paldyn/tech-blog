---
title: "쿠버네티스 ReplicaSet 완전 이해"
description: "Kubernetes에서 Pod 복제본 수를 유지하는 ReplicaSet의 컨트롤 루프 동작 원리, YAML 구조, 스케일링 방법, Deployment와의 관계를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-02"
archiveOrder: 5
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "ReplicaSet", "Pod", "스케일링", "컨트롤 루프", "자가 치유"]
featured: false
draft: false
---

[지난 글](/posts/k8s-owner-references/)에서 소유권 체인과 가비지 컬렉션을 살펴봤습니다. 이번에는 그 소유권 체인의 핵심 구성 요소인 **ReplicaSet**을 깊이 다룹니다. ReplicaSet은 지정한 수의 Pod 복제본을 항상 유지하는 오브젝트입니다. Pod가 삭제되거나 노드 장애로 사라지면 즉시 새 Pod를 생성해 desired state를 회복합니다.

## ReplicaSet의 역할

ReplicaSet이 보장하는 것은 단 하나입니다. **selector와 일치하는 Pod가 항상 `replicas`에 지정된 수만큼 Running 상태여야 한다.**

Pod를 직접 만들어 사용하면 노드 장애 시 해당 Pod는 영구적으로 사라집니다. ReplicaSet은 이를 방지합니다. 컨트롤 루프가 지속적으로 desired 상태와 actual 상태를 비교해 부족하면 Pod를 추가하고, 초과하면 Pod를 제거합니다.

![ReplicaSet 컨트롤 루프](/assets/posts/k8s-replicaset-controller-loop.svg)

## ReplicaSet YAML 구조

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: web-rs
  namespace: default
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
      - name: web
        image: nginx:1.25
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
```

`spec.selector`와 `spec.template.metadata.labels`는 반드시 일치해야 합니다. 불일치 시 ReplicaSet 생성이 거부됩니다. selector가 이미 다른 Pod를 선택하고 있다면 ReplicaSet이 그 Pod들을 인수(adopt)합니다.

## kubectl로 ReplicaSet 관리

```bash
# 목록 확인 (DESIRED / CURRENT / READY)
kubectl get replicaset
kubectl get rs

# 상세 확인 (이벤트, 조건 포함)
kubectl describe rs web-rs

# 스케일 조정
kubectl scale rs web-rs --replicas=5

# 적용된 매니페스트로 스케일 조정
kubectl apply -f web-rs.yaml  # replicas 값을 변경한 후
```

![ReplicaSet YAML 구조와 kubectl 명령](/assets/posts/k8s-replicaset-yaml.svg)

## ReplicaSet vs Deployment

실무에서 ReplicaSet을 직접 생성하는 경우는 드뭅니다. Deployment를 사용하면 Deployment가 ReplicaSet을 자동으로 생성하고 관리합니다. ReplicaSet을 직접 다룰 때는 주로 다음 상황입니다.

- Deployment 롤아웃 중 이전 ReplicaSet이 남아 있는지 확인
- 롤백 대상 ReplicaSet의 상태 확인
- 직접 ReplicaSet을 만들어야 하는 특수한 경우

```bash
# Deployment가 관리하는 ReplicaSet 확인
kubectl get rs -l app=web

# RS별 revision 확인
kubectl get rs -o wide

# 특정 RS가 소유한 Pod 확인
kubectl get pods -l app=web
```

## 자가 치유 동작 확인

ReplicaSet의 자가 치유 동작을 직접 확인해보겠습니다.

```bash
# ReplicaSet 배포
kubectl apply -f web-rs.yaml

# Pod 목록 확인 (3개 Running)
kubectl get pods -l app=web

# Pod 하나 강제 삭제
kubectl delete pod web-rs-abc

# 즉시 새 Pod 생성됨 확인 (여전히 3개)
kubectl get pods -l app=web

# 이벤트로 생성 기록 확인
kubectl get events --field-selector reason=SuccessfulCreate
```

Pod를 삭제해도 ReplicaSet이 즉시 새 Pod를 생성합니다. 특정 Pod를 영구적으로 제거하려면 `kubectl scale rs web-rs --replicas=2`로 먼저 replicas를 줄여야 합니다.

## Adoption과 Quarantine

ReplicaSet의 selector와 일치하는 Pod가 이미 존재하면 ReplicaSet이 해당 Pod를 소유(adopt)합니다. 반대로 기존 Pod에서 labels를 제거하면 ReplicaSet은 그 Pod를 관리 대상에서 제외(quarantine)하고 새 Pod를 생성합니다.

```bash
# Pod labels 제거 → ReplicaSet이 새 Pod 생성 (디버깅 목적으로 유용)
kubectl label pod web-rs-abc app-

# 이제 web-rs-abc는 ReplicaSet 관리 밖
# 새 Pod web-rs-xyz가 생성됨
kubectl get pods -l app=web  # 3개 (abc 제외)
kubectl get pod web-rs-abc   # 여전히 존재, labels만 없음
```

이 패턴은 장애 Pod를 종료시키지 않고 격리해 디버깅하는 데 활용할 수 있습니다.

---

**지난 글:** [쿠버네티스 Owner References와 가비지 컬렉션](/posts/k8s-owner-references/)

**다음 글:** [ReplicationController vs Deployment — 진화의 역사](/posts/k8s-replicationcontroller-vs-deployment/)

<br>
읽어주셔서 감사합니다. 😊
