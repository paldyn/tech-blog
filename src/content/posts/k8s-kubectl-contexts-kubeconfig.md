---
title: "kubectl context와 kubeconfig 완전 정복"
description: "kubeconfig 파일 구조(clusters/users/contexts), kubectl config 명령어, 여러 클러스터를 효율적으로 전환하는 방법을 실무 관점에서 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 4
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "kubectl", "kubeconfig", "context", "클러스터관리"]
featured: false
draft: false
---

[지난 글](/posts/k8s-kubectl-basics/)에서 kubectl의 기본 명령어를 익혔다. kubectl이 "어느 클러스터에" 명령을 보낼지 결정하는 게 바로 **kubeconfig**다. 개발·스테이징·프로덕션 클러스터를 오가는 현장에서 kubeconfig를 제대로 이해하지 못하면 실수로 프로덕션에 명령을 날리는 사고가 생긴다.

## kubeconfig 파일 구조

kubeconfig는 기본적으로 `~/.kube/config`에 있는 YAML 파일이다. 세 가지 핵심 섹션으로 구성된다.

![kubeconfig 파일 구조](/assets/posts/k8s-kubectl-contexts-kubeconfig-structure.svg)

- **clusters**: API Server URL과 CA 인증서 정보
- **users**: 인증 정보 (토큰, 클라이언트 인증서, exec 플러그인 등)
- **contexts**: cluster + user + (선택) namespace의 조합에 이름을 붙인 것
- **current-context**: 현재 활성화된 context 이름

```bash
# kubeconfig 전체 내용 확인
kubectl config view

# 민감 정보 포함 (토큰/인증서 실제 값)
kubectl config view --raw

# 특정 context의 정보만 확인
kubectl config view --minify --context=prod-ctx
```

## 현재 context 확인과 전환

```bash
# 현재 활성 context
kubectl config current-context

# 모든 context 목록
kubectl config get-contexts

# CURRENT 열에 * 표시된 것이 현재 활성
# NAMESPACE 열이 비어 있으면 default 네임스페이스 사용

# context 전환
kubectl config use-context prod-ctx

# 단일 명령만 다른 context로 실행 (전환 없음)
kubectl get pods --context=staging-ctx
```

![컨텍스트 전환 흐름](/assets/posts/k8s-kubectl-contexts-kubeconfig-switching.svg)

## context에 기본 네임스페이스 설정

`-n` 플래그 없이도 특정 네임스페이스를 기본으로 사용하게 설정할 수 있다.

```bash
# 현재 context의 기본 네임스페이스를 kube-system으로 설정
kubectl config set-context --current --namespace=kube-system

# 확인
kubectl config view --minify | grep namespace

# 이제 -n 없이도 kube-system 대상
kubectl get pods
```

## context 추가, 수정, 삭제

```bash
# 클러스터 추가
kubectl config set-cluster my-cluster \
  --server=https://192.168.1.100:6443 \
  --certificate-authority=/path/to/ca.crt

# 사용자(인증정보) 추가
kubectl config set-credentials my-admin \
  --token=eyJhbGciOiJSUzI1NiJ9...

# context 생성
kubectl config set-context my-ctx \
  --cluster=my-cluster \
  --user=my-admin \
  --namespace=production

# context 삭제
kubectl config delete-context my-ctx

# 클러스터 삭제
kubectl config delete-cluster my-cluster

# 사용자 삭제
kubectl config unset users.my-admin
```

## 여러 kubeconfig 파일 병합

클러스터가 많아지면 하나의 파일에 모두 관리하거나 KUBECONFIG 환경변수로 병합한다.

```bash
# 두 kubeconfig 파일 병합해서 하나로 저장
KUBECONFIG=~/.kube/config:~/.kube/config-eks \
  kubectl config view --flatten > ~/.kube/merged-config

mv ~/.kube/config ~/.kube/config.bak
mv ~/.kube/merged-config ~/.kube/config

# 또는 세션 내에서 임시 병합
export KUBECONFIG=~/.kube/config:~/.kube/config-gke:~/.kube/config-eks

# 모든 context 확인
kubectl config get-contexts
```

## EKS, GKE 클러스터 kubeconfig 추가

관리형 K8s 서비스는 전용 CLI로 kubeconfig를 자동 업데이트한다.

```bash
# AWS EKS
aws eks update-kubeconfig --region ap-northeast-2 --name my-cluster

# Google GKE
gcloud container clusters get-credentials my-cluster \
  --region asia-northeast3 --project my-project

# Azure AKS
az aks get-credentials --resource-group myRG --name myCluster
```

## kubectx / kubens: 빠른 전환 도구

매번 `kubectl config use-context`를 입력하기 번거로울 때 kubectx/kubens를 사용한다.

```bash
# 설치 (krew 사용)
kubectl krew install ctx ns

# 또는 brew
brew install kubectx

# context 전환 (대화형 UI 포함)
kubectx
kubectx prod-ctx

# 이전 context로 돌아가기
kubectx -

# 네임스페이스 전환
kubens kube-system
kubens -         # 이전 네임스페이스
```

## 보안 주의사항

```bash
# kubeconfig 파일 권한 확인 (600이어야 함)
ls -la ~/.kube/config
# -rw------- 1 user user 6789 Jun  1 00:00 /home/user/.kube/config

# 권한 수정
chmod 600 ~/.kube/config

# kubeconfig에서 민감한 자격증명 외부화 (exec 방식 권장)
# EKS는 aws-iam-authenticator / aws eks get-token 방식 사용
```

kubeconfig를 잘 이해하면 클러스터를 실수 없이 전환할 수 있다. 다음 글에서는 클러스터에 오브젝트를 배포할 때 사용하는 YAML 매니페스트의 구조를 살펴본다.

---

**지난 글:** [kubectl 기본 명령어 완전 정리](/posts/k8s-kubectl-basics/)

**다음 글:** [쿠버네티스 YAML 매니페스트 구조 완전 해부](/posts/k8s-yaml-manifests/)

<br>
읽어주셔서 감사합니다. 😊
