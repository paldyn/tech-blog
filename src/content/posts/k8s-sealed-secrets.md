---
title: "Sealed Secrets — GitOps 친화적 시크릿 관리"
description: "Sealed Secrets의 비대칭 암호화 워크플로, kubeseal 사용법, 암호화 스코프, 키 로테이션과 GitOps 파이프라인 통합 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 5
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "sealed-secrets", "gitops", "security", "kubeseal", "argocd"]
featured: false
draft: false
---

[지난 글](/posts/k8s-secrets-management/)에서 K8s Secret의 보안 한계와 외부 시크릿 관리자를 활용하는 방법을 살펴봤다. 이번에는 **GitOps 환경에서 가장 많이 쓰이는 시크릿 솔루션인 Sealed Secrets**를 다룬다. GitOps의 핵심 원칙은 "모든 것이 Git에"인데, 시크릿은 평문으로 Git에 올릴 수 없다는 딜레마가 있다. Sealed Secrets는 비대칭 암호화로 이 문제를 해결한다.

## Sealed Secrets란?

Bitnami(현 VMware)가 개발한 오픈소스 도구로, `SealedSecret`이라는 CRD와 클러스터 내 Controller로 구성된다. 핵심 아이디어는 간단하다.

- **Public Key**: kubeseal CLI로 로컬에서 다운로드해 시크릿을 암호화
- **Private Key**: 클러스터 내 Sealed Secrets Controller만 보유
- **암호화된 SealedSecret**: Git에 안전하게 커밋 가능

Private Key가 없으면 암호화된 값을 복호화할 수 없으므로, Git에 올려도 안전하다.

![Sealed Secrets 워크플로](/assets/posts/k8s-sealed-secrets-flow.svg)

## 설치

```bash
# Helm으로 설치
helm repo add sealed-secrets https://bitnami-labs.github.io/sealed-secrets
helm install sealed-secrets sealed-secrets/sealed-secrets \
  --namespace kube-system \
  --set fullnameOverride=sealed-secrets-controller

# kubeseal CLI 설치 (로컬)
brew install kubeseal
# 또는
curl -Lo kubeseal https://github.com/bitnami-labs/sealed-secrets/releases/latest/download/kubeseal-linux-amd64
chmod +x kubeseal && mv kubeseal /usr/local/bin/
```

## 기본 사용법

```bash
# 1. 일반 Secret 생성 (실제로 적용하지 않고 YAML만 출력)
kubectl create secret generic db-secret \
  --from-literal=password=mypassword123 \
  --dry-run=client -o yaml > /tmp/db-secret.yaml

# 2. kubeseal로 암호화
kubeseal --format yaml < /tmp/db-secret.yaml > sealed-db-secret.yaml

# 결과물 확인 (암호화된 값)
cat sealed-db-secret.yaml
```

생성된 `sealed-db-secret.yaml`을 Git에 커밋하고 `kubectl apply`하면, Sealed Secrets Controller가 자동으로 복호화해 일반 K8s Secret을 생성한다.

```yaml
# sealed-db-secret.yaml 예시 구조
apiVersion: bitnami.com/v1alpha1
kind: SealedSecret
metadata:
  name: db-secret
  namespace: production
spec:
  encryptedData:
    password: AgBy3i4OJSWK+PiTySYZZA9rO...  # 암호화된 값
  template:
    metadata:
      name: db-secret
      namespace: production
    type: Opaque
```

```bash
# 클러스터에 배포 (ArgoCD/Flux 또는 직접 apply)
kubectl apply -f sealed-db-secret.yaml

# 생성된 K8s Secret 확인
kubectl get secret db-secret -o yaml
```

## Public Key 가져오기

서로 다른 환경(로컬, CI)에서 kubeseal을 사용하려면 Public Key가 필요하다.

```bash
# 클러스터에서 Public Key 추출 (저장 후 공유 가능)
kubeseal --fetch-cert > pub-sealed-secrets.pem

# 오프라인 암호화 (클러스터 접근 불필요)
kubeseal --cert pub-sealed-secrets.pem --format yaml < secret.yaml > sealed-secret.yaml

# CI 파이프라인에서 사용 예시 (GitHub Actions)
# secrets에 pub-sealed-secrets.pem 내용을 저장하고 암호화
```

## 암호화 스코프

Sealed Secrets는 재배포 공격(decrypted secret moved to another namespace)을 방지하기 위해 세 가지 스코프를 제공한다.

![SealedSecret 암호화 스코프](/assets/posts/k8s-sealed-secrets-scopes.svg)

```bash
# strict 스코프 (기본 - 이름과 네임스페이스가 암호화 시드에 포함)
kubeseal --scope strict --format yaml < secret.yaml > sealed.yaml

# namespace-wide (네임스페이스만 고정, 이름 자유)
kubeseal --scope namespace-wide --format yaml < secret.yaml > sealed.yaml

# cluster-wide (어디서나 사용 가능)
kubeseal --scope cluster-wide --format yaml < secret.yaml > sealed.yaml
```

## 시크릿 업데이트

기존 SealedSecret의 특정 키만 업데이트할 때는 `--merge-into` 옵션을 사용한다.

```bash
# 새 값으로 암호화 후 기존 SealedSecret에 병합
echo -n "newpassword456" | \
  kubectl create secret generic db-secret \
  --dry-run=client --from-file=password=/dev/stdin -o yaml | \
  kubeseal --merge-into sealed-db-secret.yaml

# 병합 후 apply
kubectl apply -f sealed-db-secret.yaml
```

## 키 로테이션

Sealed Secrets Controller는 기본적으로 30일마다 새 키 페어를 생성한다. 기존 키는 복호화용으로 계속 보관된다.

```bash
# 현재 키 확인
kubectl get secret -n kube-system -l sealedsecrets.bitnami.com/sealed-secrets-key

# 수동 키 로테이션 트리거
kubectl delete pod -n kube-system -l app.kubernetes.io/name=sealed-secrets

# 키 백업 (필수! 키 분실 시 복구 불가)
kubectl get secret -n kube-system \
  -l sealedsecrets.bitnami.com/sealed-secrets-key \
  -o yaml > sealed-secrets-keys-backup.yaml
```

키 백업본을 분실하면 기존에 암호화된 SealedSecret을 모두 재암호화해야 한다. 백업을 안전한 곳(Vault, 오프라인 저장소)에 보관하는 것이 중요하다.

## ArgoCD와의 통합

```yaml
# ArgoCD Application에서 SealedSecret 관리
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: production-secrets
spec:
  source:
    repoURL: https://github.com/myorg/k8s-configs
    path: production/secrets
    targetRevision: HEAD
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

Git 저장소의 `production/secrets/` 디렉터리에 SealedSecret YAML만 저장해 두면 ArgoCD가 자동으로 동기화하고, Controller가 복호화해 K8s Secret을 생성한다.

---

**지난 글:** [쿠버네티스 시크릿 관리 심화 — Vault, ESO, 암호화](/posts/k8s-secrets-management/)

**다음 글:** [External Secrets Operator — 외부 시크릿 저장소를 K8s로](/posts/k8s-external-secrets-operator/)

<br>
읽어주셔서 감사합니다. 😊
