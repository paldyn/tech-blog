---
title: "컨트롤러 매니저(Controller Manager) 이해"
description: "kube-controller-manager의 Reconcile Loop(Watch-Analyze-Act) 동작 방식과 Deployment, ReplicaSet, Node, DaemonSet 등 핵심 컨트롤러의 역할을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 8
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "controller-manager", "reconcile", "replicaset", "deployment", "self-healing"]
featured: false
draft: false
---

[지난 글](/posts/k8s-scheduler/)에서 스케줄러의 노드 선택 알고리즘을 살펴봤다. 이번에는 K8s Self-healing의 핵심인 **kube-controller-manager**를 파헤친다. "Kubernetes가 자동으로 복구한다"는 말의 실체가 바로 이 컴포넌트다.

## 컨트롤러란?

K8s에서 컨트롤러는 **특정 리소스의 상태를 지속적으로 감시하며 원하는 상태와 실제 상태의 차이를 해소하는 루프**다. 이 패턴을 **Reconcile Loop** 또는 Control Loop라고 한다.

`kube-controller-manager`는 K8s에 내장된 20개 이상의 컨트롤러를 하나의 프로세스로 실행한다. 각 컨트롤러는 독립적으로 동작하며 각자 담당 리소스를 감시한다.

## Reconcile Loop: Watch → Analyze → Act

![컨트롤러 조정 루프](/assets/posts/k8s-controller-manager-loop.svg)

모든 컨트롤러는 동일한 패턴으로 동작한다.

**① Observe**: API Server의 Watch API를 통해 담당 리소스의 변경을 실시간으로 수신한다. 폴링이 아니라 이벤트 기반이라 효율적이다.

**② Analyze**: 현재 상태(Actual State)와 etcd에 저장된 원하는 상태(Desired State)를 비교해 차이를 계산한다.

**③ Act**: 차이를 해소하는 작업을 수행한다. API Server에 생성/수정/삭제 요청을 보내며, 직접 kubelet에 명령하지 않는다.

이 루프는 무한히 반복되어 클러스터가 항상 원하는 상태를 유지하게 된다.

## 주요 컨트롤러

![주요 컨트롤러 목록](/assets/posts/k8s-controller-manager-types.svg)

### Deployment Controller

가장 자주 사용되는 컨트롤러다. Deployment 오브젝트를 감시하고, 변경이 생기면 ReplicaSet을 생성·수정해 롤링 업데이트를 조율한다.

```bash
# Deployment 롤아웃 상태 확인
kubectl rollout status deployment/myapp

# 롤아웃 히스토리 (각 단계가 ReplicaSet으로 보존됨)
kubectl rollout history deployment/myapp

# Deployment Controller가 생성한 ReplicaSet 목록
kubectl get rs -l app=myapp
# 이전 버전 RS도 남아있어 롤백 가능
```

### ReplicaSet Controller

`spec.replicas`에 지정된 수의 파드를 항상 유지한다. 파드가 죽으면 새로 만들고, 초과하면 삭제한다. **K8s Self-healing의 실제 구현체**다.

```bash
# ReplicaSet 상태 확인
kubectl get rs
# DESIRED(원하는 수) vs CURRENT(현재 수) vs READY 확인

# 파드를 강제로 죽이면 RS 컨트롤러가 즉시 새 파드 생성
kubectl delete pod <pod-name>
kubectl get pods -w  # 새 파드가 즉시 생성되는 것 확인
```

### Node Controller

노드의 상태를 주기적으로 확인한다. kubelet이 heartbeat를 보내지 않으면 `NotReady` 상태로 표시하고, 일정 시간(기본 5분) 후 해당 노드의 파드에 `node.kubernetes.io/not-ready:NoExecute` taint를 추가해 파드를 다른 노드로 이동시킨다.

```bash
# 노드 상태 모니터링
kubectl get nodes -w

# 노드 상세 상태 (Conditions 확인)
kubectl describe node <node-name>
# Conditions:
#   Ready: True → 정상
#   Ready: False → NotReady (컨트롤러가 파드 퇴거 준비 시작)
```

### DaemonSet Controller

모든 노드(또는 선택된 노드)에 정확히 1개씩 파드를 유지한다. 새 노드가 클러스터에 추가되면 자동으로 DaemonSet 파드를 배포한다.

```yaml
# 모든 노드에 로그 수집기 배포
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluentd
spec:
  selector:
    matchLabels:
      name: fluentd
  template:
    metadata:
      labels:
        name: fluentd
    spec:
      tolerations:
      # 마스터 노드에도 배포하려면 taint toleration 추가
      - key: node-role.kubernetes.io/control-plane
        operator: Exists
        effect: NoSchedule
      containers:
      - name: fluentd
        image: fluent/fluentd:latest
        volumeMounts:
        - name: varlog
          mountPath: /var/log
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
```

### Endpoint Controller

Service의 selector와 일치하는 파드를 추적하고, `Endpoints` 오브젝트를 최신 상태로 유지한다. 파드가 Ready 상태가 되면 Endpoints에 추가하고, 종료되면 제거한다. kube-proxy가 이 Endpoints를 읽어 iptables 규칙을 업데이트한다.

```bash
# 서비스의 Endpoints 확인
kubectl get endpoints myapp-service
# NAME           ENDPOINTS                          AGE
# myapp-service  10.244.0.5:8080,10.244.1.3:8080   10m
```

## 리더 선출 (Leader Election)

HA 환경에서는 controller-manager도 여러 인스턴스가 실행된다. 하지만 동시에 여러 컨트롤러가 같은 리소스를 조작하면 충돌이 발생할 수 있다. K8s는 **Lease(리스) 오브젝트**를 이용한 리더 선출로 이 문제를 해결한다.

```bash
# 현재 리더 확인
kubectl -n kube-system get lease kube-controller-manager -o yaml
# spec.holderIdentity: kube-controller-manager-node1_abc123 ← 현재 리더

# 리더가 갱신하지 않으면 15초 후 다른 인스턴스가 리더 선출 시작
```

리더만 실제 조정 작업을 수행하고, 나머지는 대기 상태다. 리더가 죽으면 수 초 내에 새 리더가 선출된다.

## 커스텀 컨트롤러 (Operator 패턴)

K8s의 컨트롤러 패턴을 활용해 직접 커스텀 컨트롤러를 만들 수 있다. 이를 **Operator 패턴**이라고 하며, 복잡한 상태형 애플리케이션(데이터베이스, 메시지 큐 등)의 운영 지식을 코드로 캡슐화한다.

```bash
# 인기 있는 Operator 예시 확인
kubectl get crds | grep -E "postgres|kafka|redis"

# Operator가 생성한 CR (Custom Resource) 확인
kubectl get postgrescluster  # Postgres Operator 예시
```

---

**지난 글:** [쿠버네티스 스케줄러(Scheduler) 동작 원리](/posts/k8s-scheduler/)

**다음 글:** [kubelet: 노드의 핵심 에이전트](/posts/k8s-kubelet/)

<br>
읽어주셔서 감사합니다. 😊
