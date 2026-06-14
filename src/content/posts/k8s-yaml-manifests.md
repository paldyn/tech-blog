---
title: "쿠버네티스 YAML 매니페스트 구조 완전 해부"
description: "K8s YAML 매니페스트의 4가지 핵심 필드(apiVersion, kind, metadata, spec), 주요 apiVersion/kind 조합, 실전 작성 팁을 체계적으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 5
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "yaml", "manifest", "apiVersion", "kind", "spec"]
featured: false
draft: false
---

[지난 글](/posts/k8s-kubectl-contexts-kubeconfig/)에서 kubeconfig로 클러스터를 관리하는 방법을 배웠다. 이제 클러스터에 실제로 오브젝트를 배포할 때 사용하는 **YAML 매니페스트**의 구조를 파헤쳐보자. K8s에서 모든 오브젝트는 YAML(또는 JSON)로 표현되며, 이 파일 한 장이 "무엇을(kind), 어떻게(spec) 만들어 달라"는 선언이다.

## 매니페스트의 4가지 필수 필드

모든 K8s 리소스 YAML은 다음 4개 최상위 필드를 반드시 갖는다.

![K8s YAML 매니페스트 구조](/assets/posts/k8s-yaml-manifests-structure.svg)

### apiVersion

리소스를 다루는 API 그룹과 버전을 지정한다. `v1`은 쿠버네티스 핵심 API(Pod, Service 등), `apps/v1`은 워크로드 API(Deployment 등)를 의미한다.

```bash
# 현재 클러스터에서 사용 가능한 apiVersion 목록
kubectl api-versions

# 리소스 타입과 apiVersion 동시 확인
kubectl api-resources --output=wide
```

### kind

생성할 오브젝트의 타입. 항상 대문자로 시작하는 CamelCase다.

### metadata

오브젝트를 식별하는 메타 정보다. `name`은 네임스페이스 내에서 유일해야 하며, `labels`는 selector로 다른 리소스와 연결할 때 사용한다.

```yaml
metadata:
  name: my-app          # 필수: 오브젝트 이름
  namespace: production # 생략 시 default
  labels:
    app: my-app
    env: prod
    version: "1.2.0"
  annotations:
    description: "Production API server"
```

### spec

오브젝트의 원하는 상태(desired state)를 기술한다. kind마다 spec 구조가 완전히 다르며, 가장 복잡한 필드다.

## apiVersion / kind 주요 조합

![apiVersion / kind 주요 조합](/assets/posts/k8s-yaml-manifests-api-resources.svg)

```bash
# kind에 맞는 apiVersion 빠르게 확인
kubectl api-resources | grep -i deployment
# deployments   deploy  apps/v1  true  Deployment
```

## 실전 매니페스트 예시

### Pod

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
  labels:
    app: nginx
spec:
  containers:
    - name: nginx
      image: nginx:1.27
      ports:
        - containerPort: 80
      resources:
        requests:
          cpu: "100m"
          memory: "128Mi"
        limits:
          cpu: "200m"
          memory: "256Mi"
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx-svc
spec:
  selector:
    app: nginx        # 이 레이블을 가진 파드에 트래픽 전달
  ports:
    - port: 80
      targetPort: 80
  type: ClusterIP     # ClusterIP | NodePort | LoadBalancer
```

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deploy
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx      # spec.template.metadata.labels와 일치해야 함
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
        - name: nginx
          image: nginx:1.27
          ports:
            - containerPort: 80
```

## 여러 리소스를 한 파일에

`---`(문서 구분자)로 여러 리소스를 하나의 파일에 담을 수 있다.

```yaml
# deployment-and-service.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: app
          image: my-app:1.0
---
apiVersion: v1
kind: Service
metadata:
  name: my-app-svc
spec:
  selector:
    app: my-app
  ports:
    - port: 80
      targetPort: 8080
```

```bash
kubectl apply -f deployment-and-service.yaml
# deployment.apps/my-app created
# service/my-app-svc created
```

## 기존 리소스에서 YAML 추출

```bash
# 실행 중인 리소스의 YAML 추출
kubectl get deployment my-app -o yaml

# 불필요한 status/managedFields 제거
kubectl get deployment my-app -o yaml \
  | kubectl neat > my-app-clean.yaml

# create --dry-run으로 YAML 생성 (파일 없이 빠르게)
kubectl create deployment my-app \
  --image=nginx:1.27 \
  --replicas=3 \
  --dry-run=client -o yaml > my-app.yaml
```

## YAML 작성 팁

```bash
# 들여쓰기는 반드시 2칸 스페이스 (탭 금지)
# 문자열에 특수문자 포함 시 따옴표 사용
# true/false는 bool, "true"/"false"는 문자열 (다름!)

# 유효성 검사 도구
# kubeval: kubectl apply 전 오프라인 검증
kubeval my-manifest.yaml

# kubectl --dry-run으로 서버 유효성 검사
kubectl apply -f my-manifest.yaml --dry-run=server
```

다음 글에서는 이 YAML을 적용하는 방식의 철학적 차이, 선언형(declarative)과 명령형(imperative) 접근법을 비교한다.

---

**지난 글:** [kubectl context와 kubeconfig 완전 정복](/posts/k8s-kubectl-contexts-kubeconfig/)

**다음 글:** [선언형 vs 명령형: kubectl apply와 create의 철학적 차이](/posts/k8s-declarative-vs-imperative/)

<br>
읽어주셔서 감사합니다. 😊
