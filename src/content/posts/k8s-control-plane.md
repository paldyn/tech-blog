---
title: "컨트롤 플레인(Control Plane) 이해"
description: "쿠버네티스 컨트롤 플레인의 구성 요소인 API Server, etcd, Scheduler, Controller Manager의 역할과 상호 통신 방식, 고가용성(HA) 구성을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 4
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "control-plane", "api-server", "etcd", "scheduler", "controller-manager"]
featured: false
draft: false
---

[지난 글](/posts/k8s-cluster-architecture/)에서 클러스터 전체 구조를 살펴봤다. 이번에는 컨트롤 플레인(Control Plane)을 더 깊이 들여다본다. 컨트롤 플레인은 클러스터의 두뇌로, 워커 노드에서 실행되는 파드들을 관리·제어하는 모든 결정이 이 곳에서 이루어진다.

## 컨트롤 플레인의 핵심 원칙

컨트롤 플레인의 작동 방식은 하나의 패턴으로 설명된다: **Watch-Reconcile 루프**다.

1. etcd에 저장된 **원하는 상태(Desired State)**를 감시(Watch)
2. 실제 상태(Actual State)와 비교
3. 차이가 있으면 조정(Reconcile)해서 원하는 상태로 만들기

이 루프가 모든 컨트롤 플레인 컴포넌트의 기본 동작이다.

## 컴포넌트 간 통신 구조

![컨트롤 플레인 내부 통신](/assets/posts/k8s-control-plane-components.svg)

중요한 설계 원칙이 있다: **모든 컴포넌트는 반드시 API Server를 통해서만 통신한다.** Scheduler가 etcd에 직접 쓰거나, Controller Manager가 kubelet에 직접 명령하지 않는다. 모든 것이 API Server를 경유한다.

이 덕분에 단일 진입점에서 인증·인가·감사 로그를 일관되게 처리할 수 있다.

## API Server 심층 이해

API Server는 K8s의 RESTful API를 제공하는 프론트엔드다. 들어오는 요청을 처리하는 순서는 다음과 같다.

```
요청 수신
→ 인증(Authentication): TLS 인증서, ServiceAccount 토큰, OIDC 등
→ 인가(Authorization): RBAC, ABAC 정책 확인
→ Admission Control: Validating/Mutating Webhook 처리
→ etcd 읽기/쓰기
→ 응답 반환
```

```bash
# API Server 로그에서 요청 흐름 확인
kubectl -n kube-system logs -l component=kube-apiserver | tail -30

# 특정 리소스에 대한 접근 권한 확인
kubectl auth can-i create pods
kubectl auth can-i create pods --as=system:serviceaccount:default:mysa
```

Admission Controller는 API Server의 관문 역할을 하는 플러그인이다. `LimitRanger`(리소스 기본값 설정), `ResourceQuota`(네임스페이스 자원 제한), `PodSecurity`(보안 정책) 같은 내장 컨트롤러 외에 커스텀 Webhook도 연결할 수 있다.

## Controller Manager의 컨트롤러들

Controller Manager는 20개 이상의 컨트롤러를 하나의 프로세스로 실행한다. 대표적인 컨트롤러의 동작을 살펴보면 컨트롤 플레인의 핵심 메커니즘이 명확해진다.

**ReplicaSet Controller**: `desired replicas = 3`이고 현재 실행 중인 파드가 2개면, 파드 1개 생성 요청을 API Server에 보낸다.

**Node Controller**: 노드로부터 상태 보고가 40초 이상 오지 않으면 `NotReady` 상태로 전환하고, 5분이 지나면 해당 노드의 파드를 다른 노드로 재스케줄한다.

**Deployment Controller**: Deployment 오브젝트가 변경되면 새 ReplicaSet을 만들고 롤링 업데이트를 조율한다.

```bash
# 컨트롤러 매니저 파드 확인
kubectl -n kube-system describe pod -l component=kube-controller-manager

# 컨트롤러 매니저 리더 정보 (HA 환경)
kubectl -n kube-system get lease kube-controller-manager
```

## Scheduler의 선택 알고리즘

Scheduler는 `nodeName`이 없는 파드를 감지하면 다음 두 단계로 노드를 선택한다.

**Filtering (필터링)**: 파드를 실행할 수 없는 노드를 제거한다.
- 요청한 CPU/메모리를 수용할 여유가 없는 노드
- taint가 있는데 toleration이 없는 노드
- nodeSelector 조건을 만족하지 않는 노드
- 파드가 요구하는 볼륨을 마운트할 수 없는 노드

**Scoring (스코어링)**: 남은 노드에 점수를 매겨 최고점 노드를 선택한다.
- 이미지가 미리 다운로드되어 있는 노드에 가중치
- 자원이 균등하게 분산될수록 높은 점수
- anti-affinity에 맞게 분산 배치

```bash
# Scheduler 로그 확인
kubectl -n kube-system logs -l component=kube-scheduler | grep -i "successfully assigned"

# 특정 파드가 어느 노드에 스케줄되었는지 확인
kubectl get pod <pod-name> -o wide
```

## 고가용성(HA) Control Plane

![컨트롤 플레인 HA 구성](/assets/posts/k8s-control-plane-ha.svg)

프로덕션 클러스터에서는 Control Plane을 3대 이상 구성한다. 단일 장애점(Single Point of Failure)을 제거하기 위해서다.

**API Server**: 무상태(stateless)이므로 여러 대를 그대로 병렬 실행하고, 앞에 Load Balancer를 두면 된다.

**etcd**: Raft 합의 알고리즘으로 클러스터링된다. 과반수 이상의 노드가 쓰기에 동의해야 커밋된다. 3대면 1대 장애, 5대면 2대 장애를 견딜 수 있다.

**Scheduler / Controller Manager**: 동시에 여러 인스턴스가 실행되더라도 하나만 리더(Active)로 동작하고 나머지는 Standby 상태를 유지하는 **리더 선출(Leader Election)** 방식을 사용한다.

```bash
# HA 환경에서 현재 리더 확인
kubectl -n kube-system get lease kube-scheduler -o yaml
# spec.holderIdentity 필드가 현재 리더 파드 이름

# kubeadm으로 HA 클러스터 초기화 예시
kubeadm init --control-plane-endpoint="lb.example.com:6443" \
  --upload-certs
```

## 컨트롤 플레인 컴포넌트 모니터링

```bash
# kubeadm 클러스터에서 컨트롤 플레인 파드 상태
kubectl -n kube-system get pods | grep -E "apiserver|etcd|scheduler|controller"

# 컴포넌트 헬스 체크 (deprecated이지만 여전히 유용)
kubectl get componentstatuses

# API Server 헬스 직접 확인
curl -k https://localhost:6443/healthz
curl -k https://localhost:6443/livez
curl -k https://localhost:6443/readyz
```

---

**지난 글:** [쿠버네티스 클러스터 아키텍처](/posts/k8s-cluster-architecture/)

**다음 글:** [etcd: 클러스터의 두뇌 저장소](/posts/k8s-etcd/)

<br>
읽어주셔서 감사합니다. 😊
