---
title: "쿠버네티스 Namespace로 클러스터 격리하기"
description: "K8s Namespace의 역할(논리적 격리, 리소스 쿼터, RBAC 범위), 기본 Namespace, ResourceQuota와 LimitRange 설정, 네임스페이스 간 통신, 실전 멀티 환경 구성 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 10
type: "knowledge"
category: "Docker"
tags: ["kubernetes", "k8s", "namespace", "rbac", "resourcequota", "격리"]
featured: false
draft: false
---

[지난 글](/posts/k8s-configmap-secret/)에서 ConfigMap과 Secret으로 설정을 분리하는 방법을 다뤘다. 하나의 K8s 클러스터에 개발·스테이징·프로덕션 환경을 함께 운영하거나 여러 팀이 클러스터를 공유할 때 논리적 격리가 필요하다. **Namespace**가 바로 그 경계다.

## Namespace = 가상 클러스터

![네임스페이스 격리](/assets/posts/k8s-namespace-isolation.svg)

Namespace는 하나의 물리 클러스터 안에서 리소스를 논리적으로 분리하는 가상 경계다. 같은 이름의 Deployment, Service, Secret이 서로 다른 Namespace에 공존할 수 있다.

```bash
# 기본 Namespace 목록
kubectl get namespaces
# NAME              STATUS   AGE
# default           Active   30d   ← kubectl 명령의 기본 대상
# kube-system       Active   30d   ← K8s 시스템 컴포넌트
# kube-public       Active   30d   ← 공개 클러스터 정보
# kube-node-lease   Active   30d   ← 노드 하트비트

# Namespace 생성
kubectl create namespace production
kubectl create namespace staging
kubectl create namespace development
```

## 리소스 쿼터 (ResourceQuota)

Namespace마다 사용 가능한 리소스 총량을 제한한다. 특정 팀이나 환경이 클러스터 전체 자원을 독점하는 것을 막는다.

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: production-quota
  namespace: production
spec:
  hard:
    pods: "50"                     # 최대 Pod 수
    requests.cpu: "10"             # CPU 요청 합계
    requests.memory: 20Gi          # 메모리 요청 합계
    limits.cpu: "20"
    limits.memory: 40Gi
    persistentvolumeclaims: "10"   # PVC 수
    services.loadbalancers: "2"    # LB 타입 Service 수
    secrets: "20"
    configmaps: "20"
```

```bash
# 쿼터 사용량 확인
kubectl describe resourcequota production-quota -n production
```

## LimitRange — 컨테이너 기본값 및 최대값

ResourceQuota가 Namespace 전체 합계를 제한한다면, LimitRange는 개별 컨테이너의 최소/최대/기본값을 설정한다.

```yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: development
spec:
  limits:
  - type: Container
    default:            # requests/limits 미지정 시 기본값
      cpu: "100m"
      memory: "128Mi"
    defaultRequest:
      cpu: "50m"
      memory: "64Mi"
    max:               # 최대 허용
      cpu: "2"
      memory: "1Gi"
    min:               # 최소 요구
      cpu: "10m"
      memory: "16Mi"
```

LimitRange를 설정하면 `resources:` 없이 배포된 컨테이너에 기본값이 자동 적용된다.

## kubectl context — 기본 Namespace 전환

`-n` 플래그 없이 kubectl을 실행하면 `default` Namespace가 대상이 된다. 특정 Namespace를 기본으로 설정하면 매번 `-n`을 붙이지 않아도 된다.

```bash
# 현재 context 확인
kubectl config current-context

# 기본 Namespace 변경
kubectl config set-context --current --namespace=production

# 확인
kubectl config view --minify | grep namespace

# 특정 Namespace 대상으로 실행 (-n 플래그)
kubectl get pods -n staging
kubectl apply -f deployment.yaml -n staging

# 모든 Namespace 대상
kubectl get pods -A
kubectl get pods --all-namespaces
```

## 네임스페이스 간 통신

Namespace는 네트워크 격리를 기본으로 제공하지 않는다. 기본적으로 모든 Namespace 간 통신이 가능하며, 완전한 격리는 `NetworkPolicy`로 별도 구현한다.

```bash
# 다른 Namespace의 Service에 접근할 때 FQDN 사용
# 형식: {service-name}.{namespace}.svc.cluster.local

# production Namespace의 db에 접근
curl http://db.production.svc.cluster.local:5432
```

## RBAC과 Namespace

![네임스페이스 RBAC](/assets/posts/k8s-namespace-rbac.svg)

`Role`과 `RoleBinding`은 특정 Namespace 범위에서 권한을 부여한다. `ClusterRole`은 모든 Namespace에 걸친 권한이다.

```yaml
# development Namespace에서 Pod 조회만 허용
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: development
rules:
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: dev-team-pod-reader
  namespace: development
subjects:
- kind: Group
  name: dev-team
  apiGroup: rbac.authorization.k8s.io
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io
```

```bash
# 권한 확인
kubectl auth can-i get pods -n development --as=user:dev-member
```

## 멀티 환경 구성 실전 패턴

```bash
# 환경별 Namespace 생성
kubectl create namespace production
kubectl create namespace staging
kubectl create namespace development

# 각 환경에 별도 ResourceQuota 적용
kubectl apply -f quota-production.yaml -n production
kubectl apply -f quota-staging.yaml -n staging

# Helm으로 환경별 배포
helm install myapp ./chart \
  --namespace production \
  --values values-production.yaml

helm install myapp ./chart \
  --namespace staging \
  --values values-staging.yaml
```

이로써 Docker 시리즈의 쿠버네티스 기초 파트가 마무리된다. Pod → Deployment → Service → Ingress → ConfigMap/Secret → Namespace 순서로 이해했다면 K8s의 핵심 개념을 다 파악한 것이다. 다음 단계로는 Helm, ArgoCD를 활용한 GitOps, 모니터링(Prometheus/Grafana) 연동을 살펴보면 된다.

---

**지난 글:** [ConfigMap과 Secret으로 설정 분리하기](/posts/k8s-configmap-secret/)

<br>
읽어주셔서 감사합니다. 😊
