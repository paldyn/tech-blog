---
title: "쿠버네티스 ServiceAccount — 워크로드 ID와 권한"
description: "ServiceAccount의 역할과 구조, 토큰 자동 마운트 메커니즘, IRSA/Workload Identity를 통한 클라우드 서비스 연동, 보안 베스트 프랙티스를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 7
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "service-account", "rbac", "irsa", "workload-identity", "security", "iam"]
featured: false
draft: false
---

[지난 글](/posts/k8s-external-secrets-operator/)에서 External Secrets Operator로 외부 시크릿을 쿠버네티스로 가져오는 방법을 살펴봤다. 이번에는 쿠버네티스 워크로드가 API Server와 통신하거나 외부 클라우드 서비스에 접근할 때 사용하는 **ServiceAccount(서비스 어카운트)**를 다룬다. 사람이 사용하는 User Account와 달리 ServiceAccount는 파드가 사용하는 계정이다.

## ServiceAccount란?

쿠버네티스에는 두 종류의 계정이 있다.

- **User Account**: 사람(운영자, 개발자)이 kubectl로 클러스터에 접근할 때 사용
- **Service Account**: 파드 내 프로세스가 API Server에 접근하거나 외부 서비스와 통신할 때 사용

모든 네임스페이스에는 `default` ServiceAccount가 자동으로 생성된다. 별도 지정 없으면 파드는 이 `default` SA를 사용한다.

```bash
# 네임스페이스의 ServiceAccount 확인
kubectl get serviceaccount -n default
# NAME      SECRETS   AGE
# default   0         5d

# ServiceAccount 생성
kubectl create serviceaccount my-app -n production

# YAML 방식
kubectl apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app
  namespace: production
EOF
```

## 파드에서 ServiceAccount 사용

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
  namespace: production
spec:
  serviceAccountName: my-app     # 사용할 ServiceAccount 지정
  automountServiceAccountToken: true  # 기본 true — false로 비활성화 가능
  containers:
    - name: app
      image: my-app:latest
```

SA를 지정하면 kubelet이 토큰을 자동으로 파드에 마운트한다.

```bash
# 파드 내에서 토큰 확인
kubectl exec my-pod -- cat /var/run/secrets/kubernetes.io/serviceaccount/token

# API Server 호출 테스트
kubectl exec my-pod -- sh -c '
  TOKEN=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
  CACERT=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt
  curl -s --cacert $CACERT \
    -H "Authorization: Bearer $TOKEN" \
    https://kubernetes.default.svc/api/v1/namespaces/production/pods
'
```

![ServiceAccount 토큰 인증 흐름](/assets/posts/k8s-service-account-overview.svg)

## Projected Service Account Token (K8s 1.20+)

K8s 1.20부터 토큰 프로젝션 방식이 기본이 됐다. 이전의 Secret 기반 토큰과 달리 유효기간이 있고 자동 갱신된다.

```yaml
# 토큰 프로젝션 명시적 설정
spec:
  volumes:
    - name: token-vol
      projected:
        sources:
          - serviceAccountToken:
              audience: https://kubernetes.default.svc
              expirationSeconds: 3600   # 1시간
              path: token
  containers:
    - name: app
      volumeMounts:
        - name: token-vol
          mountPath: /var/run/secrets/tokens
```

```bash
# 토큰 검사 (내용 디코딩)
kubectl exec my-pod -- cat /var/run/secrets/kubernetes.io/serviceaccount/token | \
  python3 -c "import sys,base64,json; t=sys.stdin.read().strip(); \
  p=t.split('.')[1]; p+='='*(4-len(p)%4); print(json.dumps(json.loads(base64.b64decode(p)), indent=2))"
```

## IRSA — IAM Roles for Service Accounts (AWS EKS)

AWS EKS에서 파드가 AWS 서비스(S3, DynamoDB 등)에 접근하려면 IRSA를 사용하는 것이 표준이다.

![IRSA — IAM Roles for Service Accounts](/assets/posts/k8s-service-account-workload-identity.svg)

```bash
# OIDC 프로바이더 확인 (EKS)
aws eks describe-cluster --name my-cluster \
  --query "cluster.identity.oidc.issuer"

# OIDC 프로바이더 IAM에 등록
eksctl utils associate-iam-oidc-provider \
  --cluster my-cluster \
  --approve

# IAM Role 생성 (신뢰 정책에 SA 연결)
aws iam create-role \
  --role-name my-app-role \
  --assume-role-policy-document '{
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Federated": "arn:aws:iam::ACCT:oidc-provider/..."},
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {"StringEquals": {
        "oidc.eks.region.amazonaws.com/id/xxx:sub":
          "system:serviceaccount:production:my-app"
      }}
    }]
  }'
```

```yaml
# ServiceAccount에 IAM Role 어노테이션
apiVersion: v1
kind: ServiceAccount
metadata:
  name: my-app
  namespace: production
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/my-app-role
```

## Workload Identity (GKE)

GKE도 비슷한 방식으로 GCP IAM과 K8s SA를 연결한다.

```bash
# K8s SA와 GCP SA 연결
kubectl annotate serviceaccount my-app \
  --namespace production \
  iam.gke.io/gcp-service-account=my-sa@my-project.iam.gserviceaccount.com

gcloud iam service-accounts add-iam-policy-binding \
  --role=roles/iam.workloadIdentityUser \
  --member="serviceAccount:my-project.svc.id.goog[production/my-app]" \
  my-sa@my-project.iam.gserviceaccount.com
```

## 보안 베스트 프랙티스

```yaml
# 1. 최소 권한 ServiceAccount 생성
apiVersion: v1
kind: ServiceAccount
metadata:
  name: read-only-sa
  namespace: production
automountServiceAccountToken: false   # API 접근 불필요한 파드는 비활성화

# 2. API Server 접근이 필요 없는 파드는 항상 false
spec:
  serviceAccountName: read-only-sa
  automountServiceAccountToken: false
```

```bash
# SA별 권한 확인
kubectl auth can-i --list --as=system:serviceaccount:production:my-app -n production

# 불필요한 default SA 권한 없는지 확인
kubectl get rolebinding -n production | grep default
```

---

**지난 글:** [External Secrets Operator — 외부 시크릿 저장소를 K8s로](/posts/k8s-external-secrets-operator/)

**다음 글:** [쿠버네티스 RBAC — 역할 기반 접근 제어](/posts/k8s-rbac/)

<br>
읽어주셔서 감사합니다. 😊
