---
title: "kubectl 기본 명령어 완전 정리"
description: "kubectl의 명령어 구조부터 get, describe, apply, delete, exec, logs까지 실무에서 매일 사용하는 명령어를 체계적으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 3
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "kubectl", "cli", "명령어"]
featured: false
draft: false
---

[지난 글](/posts/k8s-local-cluster-setup/)에서 kind로 로컬 클러스터를 구성했다. 이제 그 클러스터와 대화하는 도구, **kubectl**을 체계적으로 익힐 차례다. kubectl은 쿠버네티스 API Server와 통신하는 공식 CLI로, 사실상 K8s의 모든 작업은 이 도구를 통해 이루어진다.

## 명령어 구조

kubectl 명령어는 일관된 구조를 갖는다.

![kubectl 명령어 구조 해부](/assets/posts/k8s-kubectl-basics-structure.svg)

```
kubectl <동사> <리소스타입> [<이름>] [플래그...]
```

동사(verb)는 수행할 동작, 리소스 타입은 대상 오브젝트 종류, 이름은 특정 인스턴스를 지정한다. 이름을 생략하면 해당 타입의 전체 목록을 반환한다.

```bash
# 전체 파드 목록
kubectl get pods

# 특정 파드
kubectl get pod my-pod

# 리소스 타입은 단수/복수/약어 모두 허용
kubectl get pod     # 단수
kubectl get pods    # 복수
kubectl get po      # 약어
```

## 자주 쓰는 동사 총정리

![자주 쓰는 kubectl 동사](/assets/posts/k8s-kubectl-basics-verbs.svg)

## get: 리소스 조회

```bash
# 기본 조회
kubectl get pods
kubectl get services
kubectl get deployments

# 네임스페이스 지정
kubectl get pods -n kube-system

# 모든 네임스페이스
kubectl get pods -A
kubectl get pods --all-namespaces

# 출력 형식 변경
kubectl get pod my-pod -o yaml      # YAML 전체 스펙
kubectl get pod my-pod -o json      # JSON
kubectl get pods -o wide            # IP, 노드 포함
kubectl get pod my-pod -o jsonpath='{.status.podIP}'

# 레이블 필터
kubectl get pods -l app=nginx
kubectl get pods -l env=prod,tier=frontend

# 실시간 감시
kubectl get pods -w
```

## describe: 상세 정보와 이벤트

`describe`는 리소스의 전체 상태와 최근 이벤트를 함께 보여준다. 파드가 왜 시작 안 되는지 파악할 때 가장 먼저 실행하는 명령이다.

```bash
# 파드 상세 정보
kubectl describe pod my-pod

# 노드 상세 (할당된 파드, 리소스 현황)
kubectl describe node worker-1

# Deployment 상세
kubectl describe deployment my-app

# 이름 패턴 매칭
kubectl describe pods -l app=nginx
```

`describe` 출력의 하단 `Events:` 섹션이 트러블슈팅의 핵심이다. `Pulling image`, `Failed to pull`, `OOMKilled` 등의 이벤트가 시간순으로 표시된다.

## apply: 선언형 배포

```bash
# YAML 파일 적용
kubectl apply -f pod.yaml

# 디렉토리 내 모든 YAML 적용
kubectl apply -f ./manifests/

# URL에서 직접 적용
kubectl apply -f https://raw.githubusercontent.com/.../deploy.yaml

# dry-run: 실제 적용 없이 결과 미리 확인
kubectl apply -f pod.yaml --dry-run=client
kubectl apply -f pod.yaml --dry-run=server

# 적용될 변경사항 비교
kubectl diff -f pod.yaml
```

## create vs apply 차이

```bash
# create: 새 리소스만 생성. 이미 존재하면 에러
kubectl create -f pod.yaml

# apply: 없으면 생성, 있으면 업데이트. 반복 실행 안전
kubectl apply -f pod.yaml

# 실무에서는 apply 사용 권장 (GitOps 친화적)
```

## delete: 리소스 삭제

```bash
# 이름으로 삭제
kubectl delete pod my-pod

# YAML 파일 기준 삭제
kubectl delete -f pod.yaml

# 레이블 기준 삭제
kubectl delete pods -l app=old-version

# 강제 삭제 (Terminating 상태에서 stuck)
kubectl delete pod my-pod --grace-period=0 --force

# 네임스페이스 삭제 (내부 모든 리소스 포함)
kubectl delete namespace test-env
```

## logs: 컨테이너 로그

```bash
# 기본 로그
kubectl logs my-pod

# 실시간 스트리밍
kubectl logs -f my-pod

# 이전 컨테이너 로그 (재시작 후)
kubectl logs my-pod --previous

# 멀티 컨테이너 파드에서 특정 컨테이너
kubectl logs my-pod -c nginx

# 최근 N줄
kubectl logs my-pod --tail=100

# 특정 시간 이후
kubectl logs my-pod --since=1h
```

## exec: 컨테이너 내 명령 실행

```bash
# 인터랙티브 쉘
kubectl exec -it my-pod -- bash
kubectl exec -it my-pod -- sh

# 단일 명령 실행
kubectl exec my-pod -- ls /app

# 멀티 컨테이너 파드에서 특정 컨테이너
kubectl exec -it my-pod -c sidecar -- sh

# 환경변수 확인
kubectl exec my-pod -- env
```

## port-forward: 로컬 접근

```bash
# 로컬 8080 → 파드 80
kubectl port-forward pod/my-pod 8080:80

# 로컬 8080 → Service 80
kubectl port-forward svc/my-service 8080:80

# 로컬 8080 → Deployment (임의 파드)
kubectl port-forward deployment/my-app 8080:80

# 백그라운드 실행
kubectl port-forward svc/my-service 8080:80 &
```

## 유용한 공통 플래그

```bash
# 네임스페이스
-n <namespace>            # 특정 네임스페이스
-A / --all-namespaces     # 모든 네임스페이스

# 출력 형식
-o yaml                   # YAML
-o json                   # JSON
-o wide                   # 추가 컬럼
-o name                   # 리소스 이름만

# 기타
--show-labels             # 레이블 컬럼 추가
--sort-by=.metadata.name  # 정렬
--field-selector status.phase=Running
```

kubectl에 익숙해지면 자연스럽게 context와 kubeconfig 관리도 필요해진다. 다음 글에서는 여러 클러스터를 오가는 방법을 다룬다.

---

**지난 글:** [로컬 쿠버네티스 클러스터 구축: kind, minikube, k3d 비교](/posts/k8s-local-cluster-setup/)

**다음 글:** [kubectl context와 kubeconfig 완전 정복](/posts/k8s-kubectl-contexts-kubeconfig/)

<br>
읽어주셔서 감사합니다. 😊
