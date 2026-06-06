---
title: "ReplicaSet — Pod 복제본을 유지하는 메커니즘"
description: "Kubernetes ReplicaSet의 조정 루프(Reconcile Loop), selector.matchLabels 동작 방식, Deployment와의 관계, 그리고 직접 사용해야 할 상황을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 10
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "ReplicaSet", "Pod", "Deployment", "조정루프", "고가용성"]
featured: false
draft: false
---

[지난 글](/posts/k8s-owner-references/)에서 ownerReferences로 오브젝트 소유 관계를 표현하는 방법을 배웠다. ReplicaSet은 그 대표적인 예로, Pod들의 오너가 되어 지정된 수를 항상 유지한다.

## ReplicaSet이란

ReplicaSet(RS)은 **지정된 수의 Pod 복제본을 항상 실행 상태로 유지**하는 오브젝트다. Pod가 죽으면 새로 만들고, 너무 많으면 지운다. 이 작업을 수행하는 것이 **조정 루프(Reconcile Loop)**다.

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: my-app-rs
spec:
  replicas: 3                    # 유지할 Pod 수
  selector:
    matchLabels:
      app: my-app
      version: v1
  template:                      # 생성할 Pod 템플릿
    metadata:
      labels:
        app: my-app
        version: v1
    spec:
      containers:
      - name: app
        image: myapp:v1
        ports:
        - containerPort: 8080
```

`selector.matchLabels`와 `template.metadata.labels`는 **반드시 일치**해야 한다. 이 레이블로 RS가 "자기 Pod"를 식별하기 때문이다.

## 조정 루프 동작

![ReplicaSet 조정 루프](/assets/posts/k8s-replicaset-reconcile.svg)

RS 컨트롤러는 etcd에서 이벤트를 감지하면 즉시 조정을 시작한다.

```bash
# 실시간 확인: RS 상태
kubectl get rs my-app-rs -w

# 출력:
# NAME        DESIRED   CURRENT   READY   AGE
# my-app-rs   3         3         3       5m
#
# Pod 하나 강제 삭제 시
# my-app-rs   3         2         2       5m
# my-app-rs   3         3         2       5m   (즉시 새 Pod 생성)
# my-app-rs   3         3         3       5m   (새 Pod Ready)
```

현재 수가 목표보다 적으면 부족한 만큼 Pod를 **병렬**로 생성한다. 많으면 임의로 선택해서 삭제한다.

## selector — Pod 수 계산의 핵심

RS는 ownerReferences가 자신을 가리키는 Pod만 세지 않는다. **matchLabels 조건을 만족하는 모든 Pod를 자기 Pod로 간주**한다.

```bash
# 이 레이블을 가진 Pod가 10개 있으면
# RS는 3개만 원하므로 7개 삭제!
kubectl run rogue-pod --image=nginx \
  --labels="app=my-app,version=v1"
```

외부에서 RS selector와 동일한 레이블을 가진 Pod를 만들면, RS가 목표를 초과했다고 판단해 **임의 Pod를 삭제**한다. 이 경우 방금 만든 rogue-pod가 삭제될 수도 있고, 기존 Pod가 삭제될 수도 있다.

## ReplicaSet vs Deployment

![ReplicaSet vs Deployment](/assets/posts/k8s-replicaset-vs-deployment.svg)

Deployment는 내부적으로 ReplicaSet을 생성한다. 이미지를 업데이트하면 새 RS를 만들고 이전 RS를 축소하는 방식으로 롤링 업데이트를 구현한다.

```bash
# Deployment가 만든 RS 확인
kubectl get rs
# NAME                     DESIRED   CURRENT   READY   AGE
# my-deploy-7d4b9c6f9      3         3         3       10m   (현재 버전)
# my-deploy-5c8b7d4a3      0         0         0       1h    (이전 버전, 롤백용 보존)

# 이전 버전으로 롤백 (RS를 이전 것으로 교체)
kubectl rollout undo deployment my-deploy
```

## ReplicaSet 직접 사용 시나리오

RS를 직접 사용하는 경우는 드물지만, 다음 상황에서 고려한다.

1. **커스텀 업데이트 전략이 필요할 때**: Deployment의 Rolling/Recreate 외 다른 전략
2. **Deployment 없이 단순 복제만 필요할 때**: 실험적 환경
3. **RS를 다른 컨트롤러가 관리할 때**: 커스텀 오퍼레이터

```bash
# RS 직접 scale (Deployment를 통하지 않는 경우)
kubectl scale rs my-app-rs --replicas=5

# RS 상세 상태
kubectl describe rs my-app-rs

# RS가 생성한 Pod 목록
kubectl get pods -l app=my-app,version=v1
```

## Pod 삭제 시 RS 동작 확인

```bash
# 테스트: Pod 하나 강제 삭제
kubectl delete pod $(kubectl get pod -l app=my-app -o jsonpath='{.items[0].metadata.name}')

# RS가 즉시 새 Pod 생성하는지 확인
kubectl get pods -l app=my-app -w
```

이 테스트로 RS의 자가 치유가 실제로 동작하는 것을 확인할 수 있다. 보통 수초 내에 새 Pod가 Pending → Running으로 전환된다.

---

**지난 글:** [Owner Reference — Kubernetes 오브젝트 소유권 관계](/posts/k8s-owner-references/)

<br>
읽어주셔서 감사합니다. 😊
