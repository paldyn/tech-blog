---
title: "쿠버네티스 클러스터 아키텍처"
description: "쿠버네티스 클러스터를 구성하는 Control Plane과 Worker Node의 역할과 구성 요소, 파드 배포 흐름을 단계별로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 3
type: "knowledge"
category: "Docker"
tags: ["kubernetes", "k8s", "cluster", "control-plane", "worker-node", "architecture"]
featured: false
draft: false
---

[지난 글](/posts/k8s-why-orchestration/)에서 오케스트레이션이 왜 필요한지 살펴봤다. 이번에는 K8s 클러스터가 실제로 어떤 구성 요소로 이루어져 있고, 각 요소가 어떤 역할을 하는지 파악한다. 전체 그림을 이해하면 이후 세부 컴포넌트를 공부할 때 훨씬 수월하다.

## 클러스터의 두 계층

K8s 클러스터는 크게 두 계층으로 나뉜다.

- **Control Plane (컨트롤 플레인)**: 클러스터 전체를 관리·제어하는 두뇌. 예전엔 "Master Node"라고 불렀다.
- **Worker Node (워커 노드)**: 실제 컨테이너(파드)가 실행되는 서버.

프로덕션 환경에서는 Control Plane을 별도 서버 3대 이상에 분산 배치(HA 구성)하고, Worker Node를 수 대~수천 대 운용하는 것이 일반적이다.

![쿠버네티스 클러스터 아키텍처](/assets/posts/k8s-cluster-architecture-overview.svg)

## Control Plane 구성 요소

### kube-apiserver

클러스터의 **유일한 진입점**이다. `kubectl`, CI/CD 도구, 다른 컴포넌트가 모두 API Server를 통해 통신한다. REST API를 제공하며, 모든 요청에 대해 인증(Authentication) → 인가(Authorization) → 어드미션 컨트롤(Admission Control) 순으로 처리한 뒤 etcd에 상태를 기록한다.

```bash
# API Server 주소 확인
kubectl cluster-info
# → https://192.168.1.100:6443 같은 형태로 출력됨

# API 리소스 목록 조회
kubectl api-resources

# API 버전 확인
kubectl api-versions
```

### etcd

클러스터의 **유일한 영속 저장소**다. 분산 키-값 저장소로, 파드 정의, 서비스 설정, RBAC 정책 등 클러스터의 모든 상태가 이 곳에 저장된다. Raft 합의 알고리즘으로 고가용성을 보장하며, etcd가 없어지면 클러스터 전체가 의미를 잃기 때문에 정기적인 백업이 필수다.

```bash
# etcd 상태 확인 (kubeadm 클러스터 기준)
kubectl -n kube-system get pod -l component=etcd

# etcd 백업 (etcdctl 사용)
ETCDCTL_API=3 etcdctl snapshot save /backup/etcd-snapshot.db \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key
```

### kube-scheduler

새로운 파드가 생성될 때 **어느 노드에 배치할지 결정**한다. 단순히 랜덤으로 선택하지 않고, 노드의 CPU/메모리 여유, affinity/anti-affinity 규칙, taint/toleration, 리소스 요청량 등을 종합적으로 고려해 최적의 노드를 선택한다. 배치 결정만 하고, 실제 실행은 kubelet이 담당한다.

### kube-controller-manager

여러 컨트롤러를 하나의 프로세스로 실행한다. 각 컨트롤러는 **Desired State와 Actual State의 차이를 지속적으로 감시하고 조정**한다.

| 컨트롤러 | 역할 |
|---|---|
| Deployment Controller | ReplicaSet 생성/수정 관리 |
| ReplicaSet Controller | 지정된 수의 파드 유지 |
| Node Controller | 노드 장애 감지 및 파드 재스케줄 |
| Service Account Controller | 네임스페이스별 기본 SA 생성 |
| Namespace Controller | 네임스페이스 삭제 시 리소스 정리 |

## Worker Node 구성 요소

### kubelet

각 워커 노드에서 실행되는 **노드 에이전트**다. API Server로부터 파드 스펙을 받아 컨테이너 런타임(containerd 등)을 통해 실제로 파드를 실행한다. 또한 파드의 상태를 주기적으로 API Server에 보고하고, livenessProbe/readinessProbe를 실행해 파드 건강을 감시한다.

### kube-proxy

각 노드에서 K8s Service의 네트워킹을 구현한다. iptables 또는 IPVS 규칙을 관리해, Service IP(ClusterIP)로 들어오는 트래픽을 적절한 파드로 라우팅한다.

### Container Runtime

실제 컨테이너를 실행하는 소프트웨어. K8s는 CRI(Container Runtime Interface)를 통해 런타임과 통신하며, **containerd**와 **CRI-O**가 주로 사용된다. Docker는 K8s 1.24부터 직접 지원을 중단했지만, Docker 이미지 자체는 containerd가 실행할 수 있다.

## 파드 배포 흐름

실제로 `kubectl apply`를 실행했을 때 내부에서 어떤 일이 벌어지는지 따라가 보자.

![파드 배포 흐름](/assets/posts/k8s-cluster-architecture-flow.svg)

```
① kubectl apply -f deployment.yaml
   → API Server에 HTTP POST 요청

② API Server: 인증 → 인가 → 어드미션 컨트롤
   → 검증 통과 시 etcd에 Deployment 오브젝트 저장

③ Deployment Controller (controller-manager):
   etcd 변경 감지 → ReplicaSet 생성
   → API Server를 통해 Pod 오브젝트 생성 (아직 노드 미지정)

④ Scheduler:
   nodeName 없는 Pod 감지 → 최적 노드 선택
   → Pod에 nodeName 업데이트 (etcd에 기록)

⑤ kubelet (해당 노드):
   자신의 nodeName을 가진 Pod 감지
   → containerd에 컨테이너 생성 요청
   → 컨테이너 시작 후 Running 상태를 API Server에 보고
```

```bash
# 파드 배포 후 이벤트 확인 (전체 흐름 추적)
kubectl describe pod <pod-name>
# Events 섹션에서 Scheduled → Pulling → Pulled → Created → Started 순서 확인
```

## 컴포넌트 상태 확인

```bash
# 컨트롤 플레인 컴포넌트 파드 확인 (kubeadm 방식)
kubectl -n kube-system get pods

# 노드별 역할 확인
kubectl get nodes
# NAME           STATUS   ROLES           AGE
# master-node    Ready    control-plane   5d
# worker-node1   Ready    <none>          5d
# worker-node2   Ready    <none>          5d

# 클러스터 전체 이벤트 확인
kubectl get events --sort-by='.lastTimestamp'
```

---

**지난 글:** [왜 컨테이너 오케스트레이션이 필요한가?](/posts/k8s-why-orchestration/)

**다음 글:** [컨트롤 플레인(Control Plane) 이해](/posts/k8s-control-plane/)

<br>
읽어주셔서 감사합니다. 😊
