---
title: "Kubernetes API Server 완전 이해"
description: "쿠버네티스의 핵심 관문인 kube-apiserver의 요청 처리 흐름(인증·인가·Admission Control), Watch API 메커니즘, 실전 디버깅 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 6
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "api-server", "authentication", "authorization", "admission-control", "rbac"]
featured: false
draft: false
---

[지난 글](/posts/k8s-etcd/)에서 etcd의 역할과 Raft 알고리즘을 살펴봤다. 이번에는 K8s 클러스터의 유일한 진입점인 **kube-apiserver**를 깊이 파헤친다. API Server를 이해하면 K8s의 보안 모델, 컴포넌트 간 통신 방식, 커스텀 리소스 추가 방법까지 모두 맥락이 잡힌다.

## API Server의 역할

kube-apiserver는 세 가지 핵심 역할을 한다.

1. **RESTful API 제공**: `GET /api/v1/pods`, `POST /apis/apps/v1/deployments` 같은 HTTP 엔드포인트를 통해 모든 K8s 오브젝트를 CRUD
2. **인증·인가·검증의 단일 관문**: 클러스터 안으로 들어오는 모든 요청이 반드시 이 곳을 통과
3. **Watch API**: 컴포넌트들이 변경 이벤트를 실시간으로 구독할 수 있는 pub-sub 메커니즘

```bash
# API Server 주소 확인
kubectl cluster-info
# Kubernetes control plane is running at https://192.168.1.100:6443

# 사용 가능한 API 그룹과 버전 목록
kubectl api-versions

# 사용 가능한 모든 리소스 타입 목록
kubectl api-resources --namespaced=true
```

## 요청 처리 흐름

![API Server 요청 처리 흐름](/assets/posts/k8s-api-server-flow.svg)

### 인증 (Authentication)

"이 요청이 누구로부터 왔는가?"를 검증한다. K8s는 여러 인증 방식을 지원하며, 동시에 여러 방식을 활성화할 수 있다.

| 방식 | 사용 케이스 |
|---|---|
| X.509 클라이언트 인증서 | kubeconfig의 기본 방식 |
| Bearer Token (ServiceAccount) | 파드 안에서 K8s API 호출 |
| OIDC | SSO 연동 (Dex, Keycloak 등) |
| Webhook Token | 커스텀 인증 시스템 연동 |

```bash
# 현재 kubectl이 사용하는 인증 정보 확인
kubectl config view --minify

# ServiceAccount 토큰으로 API 직접 호출 (파드 내부에서)
TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
curl -s -H "Authorization: Bearer $TOKEN" \
  https://kubernetes.default.svc/api/v1/pods \
  --cacert /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
```

### 인가 (Authorization)

"이 주체가 요청한 작업을 수행할 권한이 있는가?"를 확인한다. K8s의 기본 인가 방식은 **RBAC(Role-Based Access Control)**다.

```yaml
# Role: default 네임스페이스에서 파드 조회 허용
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: default
  name: pod-reader
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list", "watch"]
---
# RoleBinding: myuser에 pod-reader Role 연결
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  namespace: default
  name: read-pods
subjects:
- kind: User
  name: myuser
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

```bash
# 특정 사용자/SA의 권한 확인
kubectl auth can-i create pods
kubectl auth can-i delete pods --as=system:serviceaccount:default:mysa -n default

# 전체 권한 목록 확인
kubectl auth can-i --list
```

### Admission Control

인증·인가를 통과한 요청이 etcd에 저장되기 전 마지막으로 거치는 단계다. **Mutating**과 **Validating** 두 단계로 나뉜다.

Mutating Webhook은 요청을 수정할 수 있다. 예를 들어 Istio 사이드카 자동 주입, 기본 리소스 limit 추가, 레이블 자동 삽입 등에 사용된다.

Validating Webhook은 검증만 한다. OPA Gatekeeper나 Kyverno 같은 정책 엔진이 이 단계에서 동작한다.

```bash
# 현재 활성화된 Admission Webhook 목록
kubectl get mutatingwebhookconfiguration
kubectl get validatingwebhookconfiguration

# Webhook 상세 정보 확인
kubectl describe validatingwebhookconfiguration <name>
```

## Watch API 메커니즘

![Watch API 메커니즘](/assets/posts/k8s-api-server-watch.svg)

K8s의 모든 컴포넌트(Scheduler, Controller Manager, kubelet)는 **폴링(polling)이 아닌 Watch**를 통해 변경을 감지한다. Watch는 HTTP 롱 폴링 연결을 유지하면서 etcd 변경 이벤트가 발생할 때마다 즉시 클라이언트에 Push한다.

```bash
# 파드 변경을 실시간으로 감시
kubectl get pods --watch

# 특정 파드의 이벤트 스트림 확인
kubectl get events --watch

# API 직접 Watch
kubectl get --raw "/api/v1/pods?watch=true" | head -1
```

Watch 연결이 끊기면(네트워크 오류, API Server 재시작 등) 클라이언트는 **resourceVersion**을 사용해 끊긴 시점부터 재동기화한다. 이 덕분에 이벤트 유실 없이 일관성을 유지한다.

## API 버전 이해

K8s API는 버전으로 관리되며, 안정성에 따라 구분된다.

| 버전 | 의미 | 예시 |
|---|---|---|
| `v1` | 안정 (GA) | Pod, Service, ConfigMap |
| `v1beta1` | 베타 (기본 활성화) | HPA v2beta2 |
| `v1alpha1` | 알파 (실험적) | 기능 게이트 필요 |

```bash
# 특정 리소스의 API 버전 확인
kubectl explain pod --api-version=v1

# Deployment의 API 그룹/버전 확인
kubectl explain deployment | head -5
# apps/v1
```

## API Server 디버깅

```bash
# API Server 로그 실시간 확인
kubectl -n kube-system logs -l component=kube-apiserver -f

# 특정 오브젝트 접근 감사 로그 (audit log 활성화 필요)
# /var/log/kubernetes/audit.log 에서 확인

# API 요청 상세 출력 (디버깅용)
kubectl get pods -v=8 2>&1 | head -50
# -v=6이면 URL만, -v=8이면 요청/응답 헤더, -v=9면 바디까지 출력

# kubeconfig에 여러 클러스터가 있을 때 컨텍스트 전환
kubectl config use-context production-cluster
kubectl config get-contexts
```

---

**지난 글:** [etcd: 클러스터의 두뇌 저장소](/posts/k8s-etcd/)

**다음 글:** [쿠버네티스 스케줄러(Scheduler) 동작 원리](/posts/k8s-scheduler/)

<br>
읽어주셔서 감사합니다. 😊
