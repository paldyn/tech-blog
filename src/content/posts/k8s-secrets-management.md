---
title: "쿠버네티스 시크릿 관리 심화 — Vault, ESO, 암호화"
description: "K8s Native Secret의 보안 한계, Encryption at Rest 설정, HashiCorp Vault 연동, External Secrets Operator 패턴을 실제 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 4
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "secrets", "vault", "encryption", "security", "gitops", "eso"]
featured: false
draft: false
---

[지난 글](/posts/k8s-configmap-secret/)에서 ConfigMap과 Secret으로 설정을 분리하는 기본 패턴을 살펴봤다. 이번에는 한 단계 더 나아가 **시크릿 관리를 프로덕션 수준으로 강화**하는 방법을 다룬다. 기본 Secret 오브젝트는 편리하지만 base64 인코딩이 암호화가 아니라는 점, etcd에 평문으로 저장될 수 있다는 점 때문에 보안이 중요한 환경에서는 추가 조치가 필요하다.

## K8s Secret의 보안 한계

```bash
# Secret 값은 base64 "인코딩" — 누구나 디코딩 가능
kubectl get secret my-secret -o jsonpath='{.data.password}' | base64 -d
# → mypassword123

# etcd에서 직접 읽으면 평문이 노출됨 (Encryption at Rest 미적용 시)
ETCDCTL_API=3 etcdctl get /registry/secrets/default/my-secret \
  --endpoints=https://127.0.0.1:2379 \
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \
  --cert=/etc/kubernetes/pki/etcd/server.crt \
  --key=/etc/kubernetes/pki/etcd/server.key | strings
```

세 가지 근본적 문제가 있다: ① etcd 평문 저장, ② Git 커밋 시 노출 위험, ③ 시크릿 로테이션 자동화 부재.

![시크릿 관리 방식 비교](/assets/posts/k8s-secrets-management-overview.svg)

## Encryption at Rest 설정

etcd에 저장되는 Secret을 암호화하는 것이 첫 번째 조치다. kube-apiserver의 `--encryption-provider-config` 플래그로 설정한다.

![K8s Secret Encryption at Rest 흐름](/assets/posts/k8s-secrets-management-encryption.svg)

```bash
# 암호화 키 생성 (32바이트 = 256비트)
head -c 32 /dev/urandom | base64
# → <base64 문자열>

# kube-apiserver 재기동 후 기존 시크릿 재암호화 필수
kubectl get secret --all-namespaces -o json | kubectl replace -f -

# 암호화 적용 확인 (etcd에서 직접 읽으면 k8s:enc:aescbc:v1: 프리픽스 확인)
```

프로덕션에서는 외부 KMS(AWS KMS, GCP Cloud KMS, Azure Key Vault)를 사용하는 **KMS provider**가 권장된다. KMS provider는 마스터 키를 k8s 내부에 두지 않고 외부 HSM/KMS에 보관한다.

## HashiCorp Vault 연동

Vault Agent Injector를 사용하면 파드 시작 시 Vault에서 시크릿을 가져와 파일로 마운트한다.

```yaml
# Vault Agent Injector 어노테이션으로 시크릿 주입
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  template:
    metadata:
      annotations:
        vault.hashicorp.com/agent-inject: "true"
        vault.hashicorp.com/role: "my-app"
        vault.hashicorp.com/agent-inject-secret-config: "secret/data/my-app/config"
        vault.hashicorp.com/agent-inject-template-config: |
          {{- with secret "secret/data/my-app/config" -}}
          export DB_PASSWORD="{{ .Data.data.password }}"
          {{- end }}
    spec:
      serviceAccountName: my-app
      containers:
        - name: my-app
          image: my-app:latest
          command: ["/bin/sh", "-c"]
          args:
            - source /vault/secrets/config && ./my-app
```

```bash
# Vault Kubernetes Auth 설정
vault auth enable kubernetes
vault write auth/kubernetes/config \
  kubernetes_host="https://$(kubectl get svc kubernetes -o jsonpath='{.spec.clusterIP}'):443"

# Role 생성
vault write auth/kubernetes/role/my-app \
  bound_service_account_names=my-app \
  bound_service_account_namespaces=production \
  policies=my-app-policy \
  ttl=1h
```

## Secrets Store CSI Driver

CSI Driver 방식은 Vault, AWS Secrets Manager 등의 외부 시크릿을 볼륨으로 마운트한다.

```yaml
# SecretProviderClass 정의
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: aws-secrets
spec:
  provider: aws
  parameters:
    objects: |
      - objectName: "my-app/database"
        objectType: "secretsmanager"
  secretObjects:              # K8s Secret으로도 동기화 가능
    - secretName: db-secret
      type: Opaque
      data:
        - objectName: password
          key: password
---
# Pod에서 CSI 볼륨으로 마운트
spec:
  volumes:
    - name: secrets
      csi:
        driver: secrets-store.csi.k8s.io
        readOnly: true
        volumeAttributes:
          secretProviderClass: aws-secrets
  containers:
    - name: app
      volumeMounts:
        - name: secrets
          mountPath: /mnt/secrets
          readOnly: true
```

## 시크릿 로테이션

```bash
# AWS Secrets Manager 자동 로테이션 활성화
aws secretsmanager rotate-secret \
  --secret-id my-app/database \
  --rotation-rules AutomaticallyAfterDays=30

# K8s Secret 갱신 알림 (파드 재시작 필요 시)
kubectl rollout restart deployment my-app

# Reloader 사용 (Secret/ConfigMap 변경 시 자동 재시작)
# https://github.com/stakater/Reloader
kubectl annotate deployment my-app \
  reloader.stakater.com/auto="true"
```

## 보안 베스트 프랙티스

| 항목 | 권장 방법 |
|---|---|
| etcd 암호화 | EncryptionConfiguration + KMS provider |
| Git 저장 | Sealed Secrets 또는 ESO + Git에는 암호화된 값만 |
| 접근 제어 | RBAC으로 Secret read 권한 최소화 |
| 로테이션 | 외부 시크릿 관리자 + 자동 갱신 |
| 감사 | K8s Audit Log + Vault Audit Log |
| 환경 분리 | 환경(dev/stg/prod)별 별도 Vault namespace 또는 Secret Store |

```bash
# Secret에 대한 RBAC — get은 값 노출, list는 이름만 노출
# 최소 권한: list는 허용, get/watch는 특정 서비스어카운트만
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: secret-reader
rules:
  - apiGroups: [""]
    resources: ["secrets"]
    verbs: ["get"]   # list/watch 없이 get만 - 최소 권한
    resourceNames: ["specific-secret"]  # 특정 이름만
```

---

**지난 글:** [ConfigMap과 Secret으로 설정 분리하기](/posts/k8s-configmap-secret/)

**다음 글:** [Sealed Secrets — GitOps 친화적 시크릿 관리](/posts/k8s-sealed-secrets/)

<br>
읽어주셔서 감사합니다. 😊
