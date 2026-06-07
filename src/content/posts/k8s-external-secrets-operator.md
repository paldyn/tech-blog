---
title: "External Secrets Operator — 외부 시크릿 저장소를 K8s로"
description: "External Secrets Operator(ESO)의 아키텍처, SecretStore/ClusterSecretStore/ExternalSecret CRD 사용법, AWS/Vault/GCP 백엔드 연동, 템플릿 변환을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 6
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "external-secrets", "eso", "vault", "aws-secrets-manager", "security"]
featured: false
draft: false
---

[지난 글](/posts/k8s-sealed-secrets/)에서 GitOps 친화적인 Sealed Secrets를 살펴봤다. 이번에는 **External Secrets Operator(ESO)**를 다룬다. Sealed Secrets가 "암호화된 시크릿을 Git에 저장"하는 접근이라면, ESO는 "외부 시크릿 저장소(AWS, GCP, Vault 등)에서 직접 가져와 K8s Secret으로 동기화"하는 접근이다. 엔터프라이즈 환경에서 이미 Vault나 클라우드 시크릿 서비스를 쓰고 있다면 ESO가 가장 자연스러운 연동 방법이다.

## ESO 아키텍처

ESO는 세 가지 CRD로 구성된다.

- **SecretStore**: 특정 네임스페이스에서 외부 시크릿 저장소에 연결하는 설정
- **ClusterSecretStore**: 클러스터 전체에서 사용 가능한 SecretStore (네임스페이스 초월)
- **ExternalSecret**: 어떤 시크릿을 가져와 어떤 K8s Secret으로 만들지 명세

![External Secrets Operator 아키텍처](/assets/posts/k8s-external-secrets-architecture.svg)

## 설치

```bash
helm repo add external-secrets https://charts.external-secrets.io
helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets \
  --create-namespace \
  --set installCRDs=true

# 설치 확인
kubectl get pods -n external-secrets
kubectl get crd | grep external-secrets
```

## AWS Secrets Manager 연동

IRSA(IAM Roles for Service Accounts)로 인증하는 방법이 권장된다.

```yaml
# ClusterSecretStore: AWS Secrets Manager 연결
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: aws-secretsmanager
spec:
  provider:
    aws:
      service: SecretsManager
      region: ap-northeast-2
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
            namespace: external-secrets
```

```yaml
# ExternalSecret: 시크릿 가져오기
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
  namespace: production
spec:
  refreshInterval: 1h           # 1시간마다 갱신
  secretStoreRef:
    name: aws-secretsmanager
    kind: ClusterSecretStore
  target:
    name: db-secret             # 생성할 K8s Secret 이름
    creationPolicy: Owner       # ESO가 소유 — ESO 삭제 시 Secret도 삭제
  data:
    - secretKey: password        # K8s Secret의 key 이름
      remoteRef:
        key: my-app/database     # AWS Secrets Manager 경로
        property: password       # JSON 내 필드 (없으면 전체 값)
```

## HashiCorp Vault 연동

```yaml
# SecretStore: Vault 연결 (Kubernetes Auth)
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: vault-backend
  namespace: production
spec:
  provider:
    vault:
      server: "https://vault.vault.svc:8200"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: "kubernetes"
          role: "production-reader"
          serviceAccountRef:
            name: default
```

```yaml
# ExternalSecret: Vault에서 시크릿 가져오기
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: vault-secret
  namespace: production
spec:
  refreshInterval: 15m
  secretStoreRef:
    name: vault-backend
    kind: SecretStore
  target:
    name: app-credentials
  dataFrom:
    - extract:                  # 경로 아래 모든 키를 K8s Secret에 매핑
        key: secret/data/my-app/prod
```

## 템플릿으로 값 변환

ESO의 강력한 기능 중 하나는 외부 시크릿 값을 앱이 원하는 형식으로 변환하는 템플릿이다.

![ExternalSecret 템플릿 변환](/assets/posts/k8s-external-secrets-template.svg)

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-config
  namespace: production
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secretsmanager
    kind: ClusterSecretStore
  target:
    name: app-config
    template:
      type: Opaque
      data:
        DATABASE_URL: "postgres://{{ .db_host }}:{{ .db_port }}/mydb?sslmode=require"
        DB_PASSWORD: "{{ .db_pass }}"
        OPENAI_API_KEY: "{{ .api_key }}"
  dataFrom:
    - extract:
        key: my-app/prod       # JSON 전체를 가져와 템플릿에서 사용
```

## 여러 외부 시크릿 병합

```yaml
# 두 경로의 시크릿을 하나의 K8s Secret으로 병합
spec:
  data:
    - secretKey: db_password
      remoteRef:
        key: my-app/database
        property: password
    - secretKey: api_key
      remoteRef:
        key: my-app/api-keys
        property: openai
```

## 상태 모니터링

```bash
# ExternalSecret 동기화 상태 확인
kubectl get externalsecret -n production
# NAME             STORE              REFRESH INTERVAL  STATUS    READY
# db-credentials   aws-secretsmanager  1h               SecretSynced  True

# 상세 이벤트 확인
kubectl describe externalsecret db-credentials -n production

# 강제 갱신 (어노테이션 업데이트로 트리거)
kubectl annotate externalsecret db-credentials \
  force-sync=$(date +%s) --overwrite -n production
```

## ESO vs Sealed Secrets 비교

| 기준 | ESO | Sealed Secrets |
|---|---|---|
| 시크릿 저장소 | 외부 (Vault, AWS, GCP) | K8s etcd (암호화 형태) |
| GitOps 친화성 | ExternalSecret YAML을 Git에 | SealedSecret YAML을 Git에 |
| 자동 로테이션 | refreshInterval로 자동 갱신 | 수동 재암호화 필요 |
| 외부 의존성 | 외부 저장소 필수 | 불필요 (클러스터 자체) |
| 기존 시스템 연동 | Vault/Cloud 이미 있으면 최적 | 새로 도입할 때 간단 |

---

**지난 글:** [Sealed Secrets — GitOps 친화적 시크릿 관리](/posts/k8s-sealed-secrets/)

**다음 글:** [쿠버네티스 ServiceAccount — 워크로드 ID와 권한](/posts/k8s-service-account/)

<br>
읽어주셔서 감사합니다. 😊
