---
title: "Image Pull Secrets — 프라이빗 레지스트리 인증"
description: "Kubernetes에서 프라이빗 컨테이너 레지스트리에 접근하기 위한 imagePullSecrets 설정, ServiceAccount에 연결하는 방법, AWS ECR 단기 토큰 자동 갱신 패턴, IRSA/Workload Identity로 시크릿 없이 인증하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 8
type: "knowledge"
category: "Kubernetes"
tags: ["imagePullSecrets", "프라이빗레지스트리", "ECR", "GCR", "IRSA", "Kubernetes", "인증"]
featured: false
draft: false
---

[지난 글](/posts/k8s-image-signing-cosign/)에서 Cosign으로 이미지에 서명하고 검증하는 방법을 다뤘다. 이번 글에서는 프라이빗 컨테이너 레지스트리에서 이미지를 가져오기 위한 **Image Pull Secrets** 설정을 살펴본다. 사내 레지스트리, AWS ECR, GCP GCR, Azure ACR 등 프라이빗 레지스트리를 사용할 때 필수적인 인증 설정이다.

## Image Pull Secret의 동작 방식

kubelet은 컨테이너 런타임(containerd)을 통해 이미지를 다운로드한다. 프라이빗 레지스트리는 인증을 요구하므로, Kubernetes Secret에 저장된 자격증명을 참조해 레지스트리에 로그인하고 이미지를 가져온다.

![Image Pull Secret 인증 흐름](/assets/posts/k8s-image-pull-secrets-flow.svg)

## Secret 생성 방법

```bash
# 방법 1: kubectl create secret docker-registry (가장 간단)
kubectl create secret docker-registry regcred \
  --docker-server=my-registry.example.com \
  --docker-username=myuser \
  --docker-password=mypassword \
  --docker-email=myuser@example.com \
  -n production

# 방법 2: 기존 docker config.json에서 생성
kubectl create secret generic regcred \
  --from-file=.dockerconfigjson=$HOME/.docker/config.json \
  --type=kubernetes.io/dockerconfigjson \
  -n production

# 방법 3: base64 인코딩된 YAML 직접 작성
DOCKER_CONFIG=$(echo -n '{"auths":{"my-registry":{"auth":"<base64>"}}}' | base64 -w0)
kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: regcred
  namespace: production
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: ${DOCKER_CONFIG}
EOF
```

Secret 내용 확인:

```bash
kubectl get secret regcred -n production -o jsonpath='{.data.\.dockerconfigjson}' | base64 -d | jq .
```

## Pod에서 imagePullSecrets 참조

```yaml
# Deployment에서 직접 참조
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  template:
    spec:
      containers:
        - name: myapp
          image: my-registry.example.com/myapp:v2.0.0
      imagePullSecrets:
        - name: regcred     # 같은 네임스페이스의 Secret 이름
```

## ServiceAccount에 연결 — 네임스페이스 전체 적용

Pod마다 `imagePullSecrets`를 명시하는 대신, ServiceAccount에 연결하면 해당 SA를 사용하는 모든 Pod에 자동으로 적용된다.

```bash
# default ServiceAccount에 imagePullSecret 연결
kubectl patch serviceaccount default -n production \
  -p '{"imagePullSecrets": [{"name": "regcred"}]}'

# 확인
kubectl get serviceaccount default -n production -o yaml | grep -A5 imagePullSecrets
```

네임스페이스의 모든 Pod가 `default` SA를 사용하면(별도 SA 미지정 시), 이 방법으로 네임스페이스 전체에 이미지 풀 시크릿을 적용할 수 있다.

## AWS ECR — 단기 토큰 자동 갱신

![AWS ECR 단기 토큰 자동 갱신 패턴](/assets/posts/k8s-image-pull-secrets-ecr.svg)

ECR 토큰은 12시간마다 만료되므로 자동 갱신이 필요하다.

```yaml
# ECR 토큰 갱신 CronJob
apiVersion: batch/v1
kind: CronJob
metadata:
  name: ecr-token-refresher
  namespace: production
spec:
  schedule: "0 */6 * * *"    # 6시간마다 갱신
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: ecr-refresher-sa  # ECR 권한 있는 SA
          containers:
            - name: refresher
              image: amazon/aws-cli:latest
              command:
                - /bin/sh
                - -c
                - |
                  TOKEN=$(aws ecr get-login-password --region ap-northeast-2)
                  kubectl create secret docker-registry ecr-cred \
                    --docker-server=123456789.dkr.ecr.ap-northeast-2.amazonaws.com \
                    --docker-username=AWS \
                    --docker-password=$TOKEN \
                    --namespace production \
                    --dry-run=client -o yaml | kubectl apply -f -
          restartPolicy: OnFailure
```

`--dry-run=client -o yaml | kubectl apply -f -` 패턴은 Secret이 이미 존재하면 업데이트하고, 없으면 생성하는 idempotent한 방식이다.

## IRSA로 시크릿 없이 인증 (EKS 권장)

AWS EKS에서는 **IRSA(IAM Roles for Service Accounts)**를 사용하면 Secret 없이도 ECR에 접근할 수 있다. kubelet이 Node의 IAM 역할을 통해 자동으로 인증한다.

```bash
# 1. OIDC 프로바이더 생성 (클러스터당 1회)
eksctl utils associate-iam-oidc-provider \
  --cluster my-cluster --approve

# 2. ECR 읽기 권한을 가진 IAM SA 생성
eksctl create iamserviceaccount \
  --name ecr-reader \
  --namespace production \
  --cluster my-cluster \
  --attach-policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly \
  --approve

# 3. Deployment에서 SA 지정 (imagePullSecrets 불필요)
# spec.serviceAccountName: ecr-reader
```

GCP에서는 **Workload Identity**, Azure에서는 **AAD Pod Identity** / **Azure Workload Identity**가 동일한 역할을 한다. 클라우드 관리형 Kubernetes를 사용한다면 이 방법이 Secret 관리 오버헤드 없이 가장 안전하다.

---

**지난 글:** [이미지 서명 — Cosign과 공급망 보안](/posts/k8s-image-signing-cosign/)

**다음 글:** [Metrics Server — 클러스터 리소스 메트릭 수집](/posts/k8s-metrics-server/)

<br>
읽어주셔서 감사합니다. 😊
