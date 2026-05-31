---
title: "선언형 vs 명령형: kubectl apply와 create의 철학적 차이"
description: "쿠버네티스의 선언형(declarative)과 명령형(imperative) 접근법의 차이, 컨트롤 루프 원리, 왜 실무에서 kubectl apply를 써야 하는지를 명확히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 6
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "declarative", "imperative", "kubectl-apply", "reconciliation", "gitops"]
featured: false
draft: false
---

[지난 글](/posts/k8s-yaml-manifests/)에서 YAML 매니페스트의 구조를 살펴봤다. 이 YAML을 클러스터에 적용하는 방식에는 두 가지 철학이 있다. **명령형(imperative)** 은 "지금 이것을 해라"고 명령하는 방식이고, **선언형(declarative)** 은 "이 상태가 되어야 한다"고 선언하는 방식이다. 이 차이는 단순한 kubectl 플래그 차이가 아니라 K8s 운영 철학의 핵심이다.

## 두 접근법 비교

![선언형 vs 명령형 비교](/assets/posts/k8s-declarative-vs-imperative-comparison.svg)

### 명령형: kubectl create, run, expose

```bash
# 명령형 예시
kubectl run nginx --image=nginx:1.27
kubectl create deployment my-app --image=my-app:1.0 --replicas=3
kubectl expose deployment my-app --port=80 --type=ClusterIP

# 문제: 이미 존재하면 에러
kubectl create deployment my-app --image=my-app:2.0
# Error: deployments.apps "my-app" already exists

# 업데이트하려면 별도 명령 필요
kubectl set image deployment/my-app app=my-app:2.0
```

명령형은 학습이나 일회성 디버깅에 빠르게 쓰기 좋다. 하지만 클러스터의 현재 상태를 코드로 추적할 수 없어 팀 협업이나 CI/CD에서 문제가 생긴다.

### 선언형: kubectl apply

```bash
# 선언형: YAML 작성 후 apply
kubectl apply -f my-app.yaml
# deployment.apps/my-app created

# 다시 apply → 변경 없으면 no-op
kubectl apply -f my-app.yaml
# deployment.apps/my-app unchanged

# 이미지 변경 후 apply → 자동 업데이트
# (yaml에서 image: my-app:2.0으로 수정)
kubectl apply -f my-app.yaml
# deployment.apps/my-app configured
```

`apply`는 **멱등(idempotent)** 하다. 몇 번을 실행해도 결과가 동일하다. 이 특성이 GitOps 자동화를 가능하게 한다.

## 컨트롤 루프: 선언형의 엔진

선언형이 동작하는 원리는 K8s의 **컨트롤 루프(Reconciliation Loop)** 다.

![컨트롤 루프 원리](/assets/posts/k8s-declarative-vs-imperative-loop.svg)

Controller는 끊임없이 두 가지를 비교한다.
- **Desired State**: etcd에 저장된 YAML 스펙
- **Current State**: 실제 클러스터의 실행 상태

차이가 있으면 조정(Act)하고, 없으면 아무것도 하지 않는다. 이 루프는 클러스터가 살아있는 한 계속 돌아간다. 파드가 죽어도 자동으로 다시 살아나는 게 바로 이 메커니즘 덕분이다.

```bash
# 컨트롤 루프를 체감하는 실험
kubectl apply -f deployment.yaml  # replicas: 3 선언

# 파드 하나를 강제로 삭제
kubectl delete pod <pod-name>

# 즉시 새 파드 생성됨 (Controller가 감지하고 조정)
kubectl get pods -w
# my-app-xxx   Terminating → my-app-yyy   ContainerCreating → Running
```

## apply의 동작 원리: 3-way merge

`kubectl apply`는 내부적으로 **3-way strategic merge**를 사용한다.

1. **Last-applied**: 이전 apply 때 적용한 YAML (`kubectl.kubernetes.io/last-applied-configuration` 어노테이션에 저장)
2. **Live**: 현재 클러스터 상태
3. **New**: 새로 apply하는 YAML

세 버전을 비교해 추가/변경/삭제를 계산한다.

```bash
# last-applied 어노테이션 확인
kubectl get deployment my-app -o json \
  | python3 -c "import sys,json; \
    d=json.load(sys.stdin); \
    print(d['metadata']['annotations']['kubectl.kubernetes.io/last-applied-configuration'])"

# apply vs replace 차이
kubectl apply -f dep.yaml   # 부분 업데이트 (safe)
kubectl replace -f dep.yaml # 전체 교체 (주의: apply 이력 날림)
```

## 언제 명령형을 써도 되나

모든 상황에서 선언형만 써야 한다는 건 아니다. 명령형이 적합한 상황은 있다.

```bash
# 학습/실험: 빠른 파드 실행
kubectl run test-pod --image=busybox --rm -it -- sh

# 디버깅: 임시 포트 포워딩
kubectl port-forward svc/my-app 8080:80

# 긴급 스케일: 빠른 레플리카 조정
kubectl scale deployment my-app --replicas=5

# 빠른 라벨 추가
kubectl label pod my-pod env=debug

# 네임스페이스 빠른 생성
kubectl create namespace test-env
```

이런 임시 작업은 명령형으로 빠르게 처리하고, 영구적인 변경은 YAML을 수정하고 `apply`한다.

## 실무 권장 패턴

```bash
# GitOps 기본 흐름
# 1. YAML 파일을 Git 저장소에서 관리
# 2. PR 머지 → CI/CD가 kubectl apply 실행
# 3. 클러스터 상태 = Git 저장소 상태

# dry-run으로 apply 전 미리 확인
kubectl apply -f deployment.yaml --dry-run=client
kubectl apply -f deployment.yaml --dry-run=server

# diff: 현재 상태와 적용 예정 변경사항 비교
kubectl diff -f deployment.yaml

# 디렉토리 전체 apply
kubectl apply -f ./k8s/
kubectl apply -R -f ./k8s/  # 재귀 적용
```

선언형과 컨트롤 루프를 이해하면 K8s의 자가 치유(self-healing) 능력이 왜 강력한지 체감할 수 있다. 다음 글에서는 kubectl을 더욱 강력하게 만드는 플러그인 매니저, krew를 소개한다.

---

**지난 글:** [쿠버네티스 YAML 매니페스트 구조 완전 해부](/posts/k8s-yaml-manifests/)

**다음 글:** [kubectl 플러그인 매니저 krew 완전 정리](/posts/k8s-krew-plugins/)

<br>
읽어주셔서 감사합니다. 😊
