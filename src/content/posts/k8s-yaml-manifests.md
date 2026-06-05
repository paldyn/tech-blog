---
title: "쿠버네티스 YAML 매니페스트 구조 완전 해부"
description: "K8s YAML 매니페스트의 4가지 핵심 필드(apiVersion, kind, metadata, spec), 주요 오브젝트 타입 분류, kubectl apply vs create, dry-run, 유효성 검증까지 체계적으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 4
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "yaml", "manifest", "apiVersion", "kind", "spec"]
featured: false
draft: false
---

[지난 글](/posts/k8s-kubectl-contexts-kubeconfig/)에서 kubeconfig로 클러스터를 관리하는 방법을 배웠다. 이제 클러스터에 실제로 오브젝트를 배포할 때 사용하는 **YAML 매니페스트**의 구조를 파헤쳐보자. K8s에서 모든 오브젝트는 YAML(또는 JSON)로 표현되며, 이 파일 한 장이 "무엇을(kind), 어떻게(spec) 만들어 달라"는 선언이다.

## 매니페스트의 4가지 필수 필드

모든 K8s 리소스 YAML은 다음 4개 최상위 필드를 반드시 갖는다.

![K8s YAML 매니페스트 구조 해부](/assets/posts/k8s-yaml-manifests-structure.svg)

### apiVersion

리소스를 다루는 API 그룹과 버전을 지정한다. `v1`은 쿠버네티스 핵심 API(Pod, Service 등), `apps/v1`은 워크로드 API(Deployment, StatefulSet 등)를 의미한다.

```bash
# 현재 클러스터에서 사용 가능한 apiVersion 목록 확인
kubectl api-versions

# 리소스 타입과 apiVersion 동시 확인
kubectl api-resources --output=wide
```

### kind

생성할 오브젝트의 타입. 항상 대문자로 시작하는 CamelCase다. `Pod`, `Deployment`, `Service`, `ConfigMap` 등이 있다.

### metadata

오브젝트를 식별하는 메타 정보다. `name`은 네임스페이스 내에서 유일해야 하며, `labels`는 selector로 다른 리소스와 연결할 때 사용한다.

```yaml
metadata:
  name: my-app          # 필수: 오브젝트 이름
  namespace: production # 생략 시 default 네임스페이스
  labels:
    app: my-app
    env: prod
    version: "1.2.0"
  annotations:
    description: "Production API server"
```

### spec

오브젝트의 원하는 상태(desired state)를 기술한다. kind마다 spec 구조가 완전히 다르며, 가장 복잡한 필드다. K8s 컨트롤러는 이 spec을 읽어 실제 상태와 일치하도록 지속적으로 동기화한다.

## 쿠버네티스 오브젝트 타입 분류

![쿠버네티스 오브젝트 타입 분류](/assets/posts/k8s-yaml-manifests-objects.svg)

K8s 오브젝트는 역할에 따라 5가지 카테고리로 나뉜다.

**Workload**: 실제 컨테이너를 실행하는 리소스. `Pod` (가장 작은 단위), `Deployment` (레플리카 + 롤링 업데이트), `StatefulSet` (순서 있는 배포), `DaemonSet` (모든 노드에 1개씩 실행).

**Network**: 서비스 노출 및 트래픽 제어. `Service` (안정적 IP + DNS), `Ingress` (HTTP 라우팅 규칙), `NetworkPolicy` (파드 간 통신 허용/차단).

**Config**: 설정값 및 민감 정보 분리 저장. `ConfigMap` (비민감 설정), `Secret` (비밀번호·토큰), `HorizontalPodAutoscaler` (자동 스케일링 정책).

**Storage**: 파드 생명주기와 독립적인 스토리지. `PersistentVolume` (실제 스토리지 리소스), `PersistentVolumeClaim` (스토리지 요청), `StorageClass` (동적 프로비저닝 정책).

**RBAC**: 클러스터 리소스에 대한 접근 제어. `ServiceAccount`, `Role`/`ClusterRole`, `RoleBinding`/`ClusterRoleBinding`.

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
      app: nginx
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

## kubectl apply vs create

| 명령 | 동작 | 재실행 시 |
|---|---|---|
| `kubectl apply -f` | 선언적: 없으면 생성, 있으면 변경사항만 패치 | 멱등적 (항상 안전) |
| `kubectl create -f` | 명령형: 없으면 생성 | 이미 있으면 오류 발생 |

실무에서는 `kubectl apply`를 사용하는 것이 표준이다. GitOps 파이프라인에서 동일한 YAML을 반복 적용해도 안전하기 때문이다.

## dry-run과 유효성 검증

```bash
# 클라이언트 dry-run: 실제 API 호출 없이 YAML 검증
kubectl apply -f my-manifest.yaml --dry-run=client -o yaml

# 서버 dry-run: API 서버에서 실제 유효성 검사 (더 정확)
kubectl apply -f my-manifest.yaml --dry-run=server

# 실행 중인 리소스의 YAML 추출
kubectl get deployment my-app -o yaml

# create --dry-run으로 YAML 템플릿 빠르게 생성
kubectl create deployment my-app \
  --image=nginx:1.27 \
  --replicas=3 \
  --dry-run=client -o yaml > my-app.yaml
```

## YAML 작성 팁

```yaml
# 들여쓰기는 반드시 2칸 스페이스 (탭 금지)
# 문자열에 특수문자 포함 시 따옴표 필수
# true/false는 bool, "true"/"false"는 문자열 (다름!)
# 숫자도 마찬가지: 1은 int, "1"은 string

# 권장: 리소스 요청/제한은 항상 명시
resources:
  requests:
    cpu: "100m"
    memory: "128Mi"
  limits:
    cpu: "500m"
    memory: "512Mi"
```

YAML에서 가장 많이 실수하는 부분은 들여쓰기다. `apiVersion`과 같은 최상위 필드는 들여쓰기 없이 시작하고, 하위 필드는 정확히 2칸씩 들여쓴다. 탭 문자는 YAML에서 허용되지 않는다.

다음 글에서는 이 YAML을 적용하는 방식의 철학적 차이, 선언형(declarative)과 명령형(imperative) 접근법을 비교하며 실무에서 어떤 패턴이 더 적합한지 살펴본다.

---

**지난 글:** [kubectl context와 kubeconfig 완전 정복](/posts/k8s-kubectl-contexts-kubeconfig/)

**다음 글:** [쿠버네티스 Service 타입 완전 정복](/posts/k8s-service-types/)
