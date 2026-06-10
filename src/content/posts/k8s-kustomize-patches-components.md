---
title: "Kustomize Patches &amp; Components — 세밀한 설정 제어"
description: "Kustomize의 targetSelector를 활용한 멀티 리소스 패치, Components로 재사용 가능한 기능 단위 정의, replacements 변환기로 값 복사, varReference 대체 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 5
type: "knowledge"
category: "Kubernetes"
tags: ["Kustomize", "KustomizeComponents", "patches", "replacements", "Kubernetes", "설정관리"]
featured: false
draft: false
---

[지난 글](/posts/k8s-kustomize-overlays/)에서 base/overlays 패턴으로 환경별 설정을 관리하는 방법을 배웠다. 이번 글에서는 Kustomize의 더 심화된 기능인 **Components**와 **Replacements**, 그리고 멀티 타겟 패치를 살펴본다. 이 기능들을 활용하면 복잡한 멀티 환경 구성도 중복 없이 DRY하게 관리할 수 있다.

## Components — 선택적 기능 단위

Component는 overlay나 base에서 선택적으로 포함할 수 있는 재사용 가능한 설정 묶음이다. Kustomize v3.7+부터 지원한다.

![Kustomize Components 아키텍처](/assets/posts/k8s-kustomize-patches-components-arch.svg)

```bash
# 디렉토리 구조
k8s/
├── base/
│   ├── deployment.yaml
│   └── kustomization.yaml
├── components/
│   ├── logging/
│   │   ├── kustomization.yaml   # kind: Component
│   │   └── fluent-bit-patch.yaml
│   ├── monitoring/
│   │   ├── kustomization.yaml   # kind: Component
│   │   └── annotations-patch.yaml
│   └── hpa/
│       ├── kustomization.yaml   # kind: Component
│       └── hpa.yaml
└── overlays/
    ├── dev/
    │   └── kustomization.yaml   # logging만 포함
    └── prod/
        └── kustomization.yaml   # logging + monitoring + hpa 포함
```

```yaml
# components/logging/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1alpha1
kind: Component           # Kustomization이 아닌 Component!

patches:
  - path: fluent-bit-patch.yaml
    target:
      kind: Deployment
      name: myapp

resources:
  - fluent-bit-configmap.yaml
```

```yaml
# overlays/prod/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

components:
  - ../../components/logging
  - ../../components/monitoring
  - ../../components/hpa

images:
  - name: my-registry/myapp
    newTag: "2.0.0"
```

Component는 overlay와 달리 독립적으로 `kustomize build`할 수 없다. 반드시 다른 overlay나 kustomization에 포함해서 사용한다. 이 특성 덕분에 "기능 플래그"처럼 특정 기능을 선택적으로 활성화하는 패턴에 완벽하게 맞는다.

## targetSelector로 여러 리소스에 패치 적용

`patches`의 `target`에 `labelSelector`를 사용하면 여러 리소스에 한 번에 패치를 적용할 수 있다.

```yaml
# kustomization.yaml
patches:
  - patch: |-
      apiVersion: apps/v1
      kind: Deployment
      metadata:
        name: not-important
      spec:
        template:
          spec:
            containers:
              - name: ".*"
                securityContext:
                  runAsNonRoot: true
                  readOnlyRootFilesystem: true
    target:
      kind: Deployment
      labelSelector: "app.kubernetes.io/part-of=myapp"
```

`labelSelector`를 사용하면 레이블이 일치하는 모든 Deployment에 동일한 패치가 적용된다. 보안 컨텍스트, 공통 환경 변수, 리소스 제한 같은 정책성 패치에 유용하다.

## Replacements — 값 복사 변환기

`replacements`는 한 리소스의 값을 다른 리소스의 필드로 복사하는 변환기다. `vars`(deprecated)의 현대적 대체재다.

![Replacements 값 복사 변환기](/assets/posts/k8s-kustomize-patches-components-replacements.svg)

```yaml
# kustomization.yaml
configMapGenerator:
  - name: app-version
    literals:
      - VERSION=2.0.0
      - IMAGE_REPO=my-registry/myapp

replacements:
  - source:
      kind: ConfigMap
      name: app-version
      fieldPath: data.VERSION
    targets:
      - select:
          kind: Deployment
          name: myapp
        fieldPaths:
          - spec.template.spec.containers.[name=myapp].image
        options:
          delimiter: ":"
          index: 1              # "myapp:latest" 중 "latest" 부분만 교체
```

`delimiter`와 `index` 옵션으로 이미지 태그 일부만 교체하는 세밀한 제어도 가능하다.

```yaml
# Service 이름을 Ingress rules에 자동 반영하는 예시
replacements:
  - source:
      kind: Service
      name: myapp
      fieldPath: metadata.name
    targets:
      - select:
          kind: Ingress
          name: myapp
        fieldPaths:
          - spec.rules.[host=myapp.example.com].http.paths.[path=/].backend.service.name
```

`namePrefix`가 적용되어 Service 이름이 `prod-myapp`으로 변경되어도, Ingress의 backend.service.name도 자동으로 `prod-myapp`으로 갱신된다.

## 실전 패턴 — 전체 파이프라인 통합

```bash
# 빌드 결과를 파이프로 검증 후 적용
kustomize build overlays/prod | kubectl diff -f - | head -100

# ArgoCD에서 Kustomize 사용 (Application 리소스)
# spec.source.kustomize 섹션으로 자동 kustomize build
```

```yaml
# ArgoCD Application 리소스
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp-prod
spec:
  source:
    repoURL: https://github.com/org/repo
    path: k8s/overlays/prod
    targetRevision: main
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
```

ArgoCD는 `path`에 `kustomization.yaml`이 있으면 자동으로 `kustomize build`를 실행하고 결과를 클러스터에 적용한다. `--kustomize-version` 플래그로 특정 Kustomize 버전을 지정할 수 있다.

---

**지난 글:** [Kustomize 오버레이 — base/overlays 구조 완전 이해](/posts/k8s-kustomize-overlays/)

**다음 글:** [컨테이너 이미지 스캔 — Trivy와 취약점 관리](/posts/k8s-image-scanning/)

<br>
읽어주셔서 감사합니다. 😊
