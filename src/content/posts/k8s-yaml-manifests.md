---
title: "Kubernetes YAML 매니페스트 작성법 완전 가이드"
description: "K8s 오브젝트의 4가지 최상위 필드(apiVersion, kind, metadata, spec)를 이해하고, 실전에서 바로 사용 가능한 매니페스트 작성 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-07"
archiveOrder: 5
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "YAML", "매니페스트", "kubectl", "선언형", "apiVersion"]
featured: false
draft: false
---

[지난 글](/posts/k8s-scheduler/)에서 스케줄러가 Pod를 노드에 배치하는 과정을 살펴봤다. Kubernetes를 사용하려면 YAML 매니페스트 작성이 필수다. 처음엔 낯설지만, 구조만 파악하면 어떤 오브젝트든 읽고 쓸 수 있다.

## YAML 매니페스트란

Kubernetes에서 모든 리소스는 **YAML(또는 JSON) 파일로 선언**한다. 이 파일을 매니페스트(Manifest)라고 부른다. `kubectl apply -f manifest.yaml` 명령으로 클러스터에 적용하면, API Server가 파일을 파싱해서 etcd에 저장하고, 해당 컨트롤러가 원하는 상태를 실현한다.

## 4가지 최상위 필드

![Kubernetes YAML 매니페스트 구조](/assets/posts/k8s-yaml-manifests-structure.svg)

모든 K8s 오브젝트는 4개의 최상위 필드를 갖는다.

**apiVersion**: 오브젝트가 속한 API 그룹과 버전이다. `v1`은 core API, `apps/v1`은 apps 그룹이다.

**kind**: 오브젝트 종류다. `Pod`, `Deployment`, `Service` 등 첫 글자를 대문자로 쓴다.

**metadata**: 이름, 네임스페이스, 레이블, 어노테이션 등 식별 정보다.

**spec**: 원하는 상태를 정의한다. 오브젝트 종류마다 필드가 다르다.

```yaml
# 가장 단순한 Pod 매니페스트
apiVersion: v1          # core API, v1
kind: Pod               # 오브젝트 종류
metadata:
  name: hello-pod       # 이름 (같은 namespace에서 유일)
  namespace: default    # 네임스페이스 (생략 시 default)
  labels:
    app: hello          # 키-값 레이블
    env: dev
spec:                   # 원하는 상태
  containers:
  - name: hello
    image: nginx:1.25
    ports:
    - containerPort: 80
```

## apiVersion 별 주요 오브젝트

![apiVersion 별 주요 오브젝트](/assets/posts/k8s-yaml-manifests-apigroups.svg)

올바른 `apiVersion`을 모를 때는 다음 명령으로 확인한다.

```bash
# 전체 리소스 목록과 apiVersion 확인
kubectl api-resources

# 특정 리소스 상세 조회
kubectl explain deployment
kubectl explain deployment.spec.strategy
kubectl explain pod.spec.containers
```

## 실전 매니페스트 패턴

### Deployment + Service (웹 앱 기본 패턴)

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  labels:
    app: my-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app        # template.metadata.labels와 일치해야 함
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: my-app
        image: myrepo/my-app:v1.2.3
        ports:
        - containerPort: 8080
        resources:
          requests:
            cpu: "250m"
            memory: "128Mi"
          limits:
            cpu: "500m"
            memory: "256Mi"
---
# service.yaml (같은 파일에 --- 로 구분)
apiVersion: v1
kind: Service
metadata:
  name: my-app-svc
spec:
  selector:
    app: my-app          # Deployment Pod 선택
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
```

하나의 파일에 `---`로 여러 오브젝트를 정의할 수 있다. `kubectl apply -f deployment.yaml` 하나로 Deployment와 Service 모두 생성된다.

## 매니페스트 적용과 관리

```bash
# 생성/업데이트 (幂等 — 있으면 업데이트, 없으면 생성)
kubectl apply -f manifest.yaml
kubectl apply -f ./manifests/   # 디렉터리 내 모든 파일

# 현재 적용된 매니페스트 확인
kubectl get deployment my-app -o yaml

# 삭제
kubectl delete -f manifest.yaml

# dry-run: 실제 적용 전 검증
kubectl apply -f manifest.yaml --dry-run=client
kubectl apply -f manifest.yaml --dry-run=server

# diff: 현재 클러스터 상태와 파일 차이 확인
kubectl diff -f manifest.yaml
```

## metadata.labels 활용

레이블은 단순한 태깅을 넘어 Service, Deployment의 Pod 선택에 핵심적이다.

```yaml
metadata:
  labels:
    app: payment-service
    version: v2
    environment: production
    team: backend
```

```bash
# 레이블로 오브젝트 필터링
kubectl get pods -l app=payment-service,environment=production

# 레이블 추가/수정
kubectl label pod my-pod version=v3 --overwrite

# 레이블 제거 (키- 형식)
kubectl label pod my-pod version-
```

## 자주 하는 실수

```yaml
# ❌ 잘못된 예: selector와 template labels 불일치
spec:
  selector:
    matchLabels:
      app: frontend    # 이 레이블이
  template:
    metadata:
      labels:
        app: web       # 이것과 달라서 오류 발생

# ✅ 올바른 예
spec:
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend  # selector와 반드시 일치
```

Deployment의 `spec.selector.matchLabels`와 `spec.template.metadata.labels`가 일치하지 않으면 `The selector does not match the pod template` 오류가 발생한다.

---

**지난 글:** [kube-scheduler 완전 해설](/posts/k8s-scheduler/)

**다음 글:** [Kubernetes Pod 기초 — 컨테이너의 실행 단위](/posts/k8s-pod-basics/)

<br>
읽어주셔서 감사합니다. 😊
