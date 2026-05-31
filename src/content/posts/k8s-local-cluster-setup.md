---
title: "로컬 쿠버네티스 클러스터 구축: kind, minikube, k3d 비교"
description: "kind, minikube, k3d 세 가지 로컬 K8s 클러스터 도구의 특성을 비교하고, kind를 사용해 멀티노드 클러스터를 빠르게 구성하는 실전 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 2
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "kind", "minikube", "k3d", "local-cluster", "개발환경"]
featured: false
draft: false
---

[지난 글](/posts/k8s-container-runtime/)에서 컨테이너 런타임의 계층 구조를 살펴봤다. 이제 실제로 쿠버네티스를 다뤄볼 차례다. 클라우드 클러스터 없이도 로컬 머신에서 K8s를 실행할 수 있는 도구들이 여럿 있는데, 어떤 걸 선택할지 고민되는 분들을 위해 세 가지 주요 도구를 비교하고 실전 셋업 방법을 정리한다.

## 로컬 클러스터 도구 3종 비교

로컬 K8s 환경을 구성할 때 가장 많이 사용하는 도구는 kind, minikube, k3d다.

![로컬 K8s 클러스터 도구 비교](/assets/posts/k8s-local-cluster-setup-tools.svg)

**kind (Kubernetes IN Docker)** 는 Docker 컨테이너를 노드로 사용한다. 멀티노드 클러스터를 지원하고 시작 속도가 빠르며 CI 환경에서 가장 널리 사용된다. GitHub Actions 같은 CI 파이프라인에서 K8s 통합 테스트를 돌릴 때 사실상 표준이다.

**minikube** 는 가장 오래된 로컬 K8s 도구로, VM 또는 Docker 드라이버를 지원한다. 기본적으로 단일 노드지만 애드온(Ingress, Dashboard, Metrics Server 등) 생태계가 풍부해 학습 목적으로 좋다.

**k3d** 는 경량 K8s 배포판인 k3s를 Docker 컨테이너로 실행한다. kind보다도 시작이 빠르고 리소스 소비가 적어 엣지 환경이나 로컬 IoT 시뮬레이션에 적합하다.

## kind 설치

```bash
# macOS
brew install kind

# Linux (curl)
curl -Lo ./kind https://kind.sigs.k8s.io/dl/v0.24.0/kind-linux-amd64
chmod +x ./kind
sudo mv ./kind /usr/local/bin/kind

# 버전 확인
kind version
```

kubectl도 필요하다. 없다면 함께 설치한다.

```bash
# macOS
brew install kubectl

# Linux
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && sudo mv kubectl /usr/local/bin/
```

## 첫 클러스터 생성

```bash
# 기본 단일 노드 클러스터 생성
kind create cluster

# 이름 지정
kind create cluster --name dev

# 생성 확인
kind get clusters
# dev

# kubectl 자동 연결 확인
kubectl cluster-info --context kind-dev

# 노드 확인
kubectl get nodes
# NAME                STATUS   ROLES           AGE   VERSION
# dev-control-plane   Ready    control-plane   30s   v1.31.0
```

kind는 클러스터 생성 시 자동으로 `~/.kube/config`에 context를 추가한다.

## 멀티노드 클러스터 설정

실제 프로덕션과 유사한 환경을 만들려면 config 파일을 사용한다.

```yaml
# kind-config.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
  - role: worker
  - role: worker
```

```bash
# config 파일로 멀티노드 클러스터 생성
kind create cluster --name multi --config kind-config.yaml

# 노드 확인
kubectl get nodes
# NAME                  STATUS   ROLES           AGE
# multi-control-plane   Ready    control-plane   40s
# multi-worker          Ready    <none>          15s
# multi-worker2         Ready    <none>          15s
```

![kind 클러스터 생성 흐름](/assets/posts/k8s-local-cluster-setup-kind.svg)

## 이미지 로드

kind 클러스터는 로컬 Docker 이미지를 자동으로 알지 못한다. 직접 로드해야 한다.

```bash
# 로컬 이미지를 kind 클러스터에 로드
docker build -t my-app:latest .
kind load docker-image my-app:latest --name dev

# 로드된 이미지 확인
docker exec -it dev-control-plane crictl images | grep my-app
```

이 과정을 생략하면 `ErrImagePull`이 발생한다. 로컬 개발 시 흔한 실수다.

## minikube 설치와 사용

```bash
# macOS
brew install minikube

# 클러스터 시작
minikube start

# 애드온 활성화 (Ingress)
minikube addons enable ingress

# 대시보드 실행
minikube dashboard

# 서비스 URL 확인
minikube service <service-name> --url

# 클러스터 중지/삭제
minikube stop
minikube delete
```

## k3d 설치와 사용

```bash
# 설치
brew install k3d  # macOS
# 또는
curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh | bash

# 클러스터 생성
k3d cluster create dev

# 포트 매핑 포함 (Ingress용)
k3d cluster create dev \
  --port "8080:80@loadbalancer" \
  --port "8443:443@loadbalancer"

# 노드 확인
kubectl get nodes

# 클러스터 삭제
k3d cluster delete dev
```

## 클러스터 관리 팁

```bash
# 현재 context 확인
kubectl config current-context

# context 전환 (여러 클러스터 사용 시)
kubectl config use-context kind-dev
kubectl config use-context kind-multi

# kind 클러스터 삭제
kind delete cluster --name dev
kind delete cluster --name multi

# 모든 kind 클러스터 삭제
kind delete clusters --all
```

## 무엇을 선택할까

학습과 개인 개발에는 **minikube**가 애드온 풍부함 덕분에 편리하다. CI 파이프라인과 통합 테스트에는 **kind**가 정석이다. 리소스가 제한된 환경이나 k3s 생태계를 탐구하고 싶다면 **k3d**를 선택한다.

다음 글부터는 이렇게 구성한 클러스터에서 실제로 K8s 오브젝트를 다루는 방법을 살펴본다.

---

**지난 글:** [컨테이너 런타임: CRI, containerd, runc 완전 해부](/posts/k8s-container-runtime/)

**다음 글:** [kubectl 기본 명령어 완전 정리](/posts/k8s-kubectl-basics/)

<br>
읽어주셔서 감사합니다. 😊
