---
title: "쿠버네티스 Deployment 기초"
description: "K8s Deployment의 구조(Deployment→ReplicaSet→Pod 계층), 롤링 업데이트 전략, 롤백, 스케일링을 실전 YAML과 kubectl 명령으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 6
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "deployment", "replicaset", "rolling-update", "rollback"]
featured: false
draft: false
---

[지난 글](/posts/k8s-pod-basics/)에서 Pod의 구조와 생명주기를 살펴봤다. Pod를 직접 만들면 장애 시 자동 복구가 없다. 실제 운영에서 Pod를 직접 쓰는 경우는 거의 없으며, 대신 **Deployment**를 통해 Pod를 관리한다.

## Deployment → ReplicaSet → Pod

![Deployment 구조](/assets/posts/k8s-deployment-basics-structure.svg)

Deployment는 "이 이미지로 이 사양의 Pod를 N개 항상 실행해라"는 선언이다. 실제 Pod 복제는 Deployment가 생성하는 **ReplicaSet**이 담당한다.

```
Deployment (선언적 업데이트 관리)
  └── ReplicaSet v1 (replicas: 3)
        ├── Pod-1 (Running)
        ├── Pod-2 (Running)
        └── Pod-3 (Running)
```

Pod 하나가 죽으면 ReplicaSet이 새 Pod를 즉시 생성한다. 이미지를 업데이트하면 Deployment가 새 ReplicaSet을 만들어 교체한다.

## 기본 Deployment YAML

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  labels:
    app: myapp
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp          # ReplicaSet이 관리할 Pod 선택
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1          # 동시에 최대 4개까지 (3+1)
      maxUnavailable: 0    # 항상 최소 3개 유지
  template:               # Pod 템플릿
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: app
        image: myapp:1.0
        ports:
        - containerPort: 8080
        resources:
          requests:
            cpu: "100m"
            memory: "128Mi"
          limits:
            cpu: "500m"
            memory: "256Mi"
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

```bash
# 배포
kubectl apply -f deployment.yaml

# 배포 상태 확인
kubectl rollout status deployment/myapp

# Pod 목록 (어느 노드에 있는지 포함)
kubectl get pods -l app=myapp -o wide
```

## 롤링 업데이트

![롤링 업데이트와 롤백](/assets/posts/k8s-deployment-basics-rollout.svg)

```bash
# 이미지 태그 변경으로 배포
kubectl set image deployment/myapp app=myapp:2.0

# 변경 사항을 주석(annotation)으로 기록하면 히스토리에 남음
kubectl annotate deployment/myapp \
  kubernetes.io/change-cause="v2.0: 결제 버그 수정"

# 배포 히스토리 확인
kubectl rollout history deployment/myapp

# 특정 버전 내용 확인
kubectl rollout history deployment/myapp --revision=2
```

## 롤백

```bash
# 직전 버전으로 즉시 롤백
kubectl rollout undo deployment/myapp

# 특정 리비전으로 롤백
kubectl rollout undo deployment/myapp --to-revision=1

# 롤백 상태 확인
kubectl rollout status deployment/myapp
```

`maxUnavailable: 0`으로 설정하면 롤링 업데이트 중 항상 요청 수를 받는 Pod가 유지된다. 새 Pod가 `readinessProbe`를 통과해야 트래픽이 전달되므로, readinessProbe를 잘 설정하면 무중단 배포가 자연스럽게 구현된다.

## 스케일링

```bash
# 수동 스케일링
kubectl scale deployment/myapp --replicas=5

# HPA(Horizontal Pod Autoscaler) — CPU 기반 자동 스케일링
kubectl autoscale deployment/myapp \
  --cpu-percent=70 \
  --min=2 \
  --max=10

# HPA 상태 확인
kubectl get hpa
```

## Deployment vs StatefulSet

데이터베이스처럼 각 Pod가 고유한 ID와 안정적인 스토리지를 가져야 할 때는 `StatefulSet`을 사용한다.

| 특성 | Deployment | StatefulSet |
|---|---|---|
| Pod 이름 | 랜덤 (myapp-7d8f9c-xxxx) | 순서 고정 (myapp-0, myapp-1) |
| 스토리지 | 공유 PVC | 각 Pod 전용 PVC |
| 적합한 용도 | Stateless 웹 앱 | DB, 메시지 큐, Zookeeper |
| 업데이트 순서 | 병렬 | 역순(N-1 → 0) |

```bash
# 현재 Deployment 상태 한눈에 보기
kubectl get deployment myapp -o yaml | grep -A 10 "status:"
```

---

**지난 글:** [쿠버네티스 파드(Pod) 기초](/posts/k8s-pod-basics/)

**다음 글:** [쿠버네티스 Service 기초](/posts/k8s-service-basics/)

<br>
읽어주셔서 감사합니다. 😊
