---
title: "Kustomize 오버레이 — base/overlays 구조 완전 이해"
description: "Kustomize의 base/overlays 패턴, 전략적 병합 패치(Strategic Merge Patch)와 JSON 6902 패치 비교, 오버레이에서 리소스 추가/삭제, 멀티 클러스터 환경 관리 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 4
type: "knowledge"
category: "Kubernetes"
tags: ["Kustomize", "KustomizeOverlays", "base/overlays", "패치", "Kubernetes", "멀티환경"]
featured: false
draft: false
---

[지난 글](/posts/k8s-kustomize/)에서 Kustomize의 기초 개념과 `kustomization.yaml` 구조를 살펴봤다. 이번 글에서는 실무에서 가장 많이 쓰이는 **base/overlays 패턴**을 깊이 파고든다. 하나의 base에서 여러 환경용 오버레이를 만드는 방법과, 두 가지 패치 방식의 차이를 이해하면 Kustomize를 완전히 활용할 수 있다.

## base/overlays 디렉토리 구조

![Kustomize base/overlays 디렉토리 구조](/assets/posts/k8s-kustomize-overlays-structure.svg)

전형적인 구조는 다음과 같다.

```bash
k8s/
├── base/
│   ├── kustomization.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   └── hpa.yaml
└── overlays/
    ├── dev/
    │   ├── kustomization.yaml
    │   └── replica-patch.yaml
    ├── staging/
    │   ├── kustomization.yaml
    │   └── deployment-patch.yaml
    └── prod/
        ├── kustomization.yaml
        ├── deployment-patch.yaml
        ├── hpa-patch.yaml
        └── pdb.yaml            # prod 전용 추가 리소스
```

base는 환경에 무관한 공통 구조를 담고, 각 overlay는 base를 참조(`resources: - ../../base`)하면서 해당 환경에 필요한 차이점만 정의한다.

## base/kustomization.yaml 작성

```yaml
# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml
  - hpa.yaml

# base에는 환경별 값을 넣지 않는다 — dev에서도 작동하는 최소값
```

```yaml
# base/deployment.yaml — 유효한 Kubernetes YAML
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
  labels:
    app: myapp
spec:
  replicas: 1
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
        - name: myapp
          image: my-registry/myapp:latest
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
```

## overlay에서 base 참조

```yaml
# overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base          # base 디렉토리 참조
  - pdb.yaml            # prod 전용 추가 리소스

namespace: production

images:
  - name: my-registry/myapp
    newTag: "2.0.0"     # prod 이미지 태그 고정

patches:
  - path: deployment-patch.yaml   # 전략적 병합 패치
  - path: hpa-patch.yaml
```

## 두 가지 패치 방식

![전략적 병합 패치 vs JSON 6902 패치](/assets/posts/k8s-kustomize-overlays-patch.svg)

### 전략적 병합 패치 (Strategic Merge Patch)

리소스와 동일한 YAML 구조로 변경할 부분만 작성한다. 나머지 필드는 base 값이 유지된다.

```yaml
# overlays/prod/deployment-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp         # 대상 리소스 식별자
spec:
  replicas: 5         # 이 필드만 변경
  template:
    spec:
      containers:
        - name: myapp
          resources:
            limits:
              cpu: "2"
              memory: 2Gi
          env:
            - name: LOG_LEVEL
              value: "warn"
```

직관적이고 가독성이 높다. 대부분의 경우 전략적 병합 패치로 충분하다.

### JSON 6902 패치

RFC 6902 JSON Patch 명세를 사용해 `add`, `replace`, `remove`, `move`, `copy` 연산으로 변경한다.

```yaml
# overlays/prod/kustomization.yaml 내부에 인라인 패치
patches:
  - target:
      kind: Deployment
      name: myapp
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 5
      - op: add
        path: /metadata/annotations/app.kubernetes.io~1version
        value: "2.0.0"
      - op: remove
        path: /spec/template/spec/containers/0/livenessProbe
```

JSON 6902 패치는 배열 인덱스 조작, 중첩 경로 세밀 제어, 필드 제거 등 SMP로 어려운 작업에 유용하다. `~1`은 경로에서 `/`를 이스케이프하는 방식이다.

## overlay에서 리소스 제거

```yaml
# overlays/dev/kustomization.yaml
resources:
  - ../../base

# base의 특정 리소스를 dev에서 제외 (Kustomize v5+)
patches:
  - target:
      kind: HorizontalPodAutoscaler
      name: myapp
    patch: |-
      $patch: delete
      apiVersion: autoscaling/v2
      kind: HorizontalPodAutoscaler
      metadata:
        name: myapp
```

또는 `transformers`를 활용한 방법도 있지만, 가장 실용적인 방법은 HPA를 base에 두지 않고 prod overlay에서 추가 리소스로 정의하는 것이다.

## 멀티 클러스터 구조

```bash
# 멀티 클러스터 / 멀티 리전 구조
k8s/
├── base/
│   └── ...
└── clusters/
    ├── us-east-1-prod/
    │   ├── kustomization.yaml   # overlays/prod + 리전별 설정
    │   └── region-patch.yaml
    └── eu-west-1-prod/
        ├── kustomization.yaml
        └── region-patch.yaml
```

```yaml
# clusters/us-east-1-prod/kustomization.yaml
resources:
  - ../../overlays/prod    # prod overlay를 다시 base로

patches:
  - target:
      kind: Deployment
      name: myapp
    patch: |-
      - op: add
        path: /spec/template/spec/nodeSelector
        value:
          topology.kubernetes.io/region: us-east-1
```

이처럼 Kustomize는 오버레이 위에 다시 오버레이를 쌓는 계층 구조를 지원한다. GitOps(ArgoCD, Flux)와 결합하면 각 overlay 디렉토리를 클러스터별 Application으로 매핑해 선언적 멀티 클러스터 관리가 가능하다.

---

**지난 글:** [Kustomize 기초 — 순수 YAML로 Kubernetes 설정 관리](/posts/k8s-kustomize/)

**다음 글:** [Kustomize Patches &amp; Components — 세밀한 설정 제어](/posts/k8s-kustomize-patches-components/)

<br>
읽어주셔서 감사합니다. 😊
