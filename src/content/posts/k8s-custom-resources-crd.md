---
title: "Custom Resources와 CRD — 쿠버네티스 API 확장"
description: "CustomResourceDefinition(CRD)으로 새로운 API 리소스를 등록하고, Custom Resource를 내장 리소스처럼 kubectl로 관리하는 방법, OpenAPI 스키마 검증, Finalizer 활용을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 10
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "crd", "custom-resources", "api-extension", "operator", "controller"]
featured: false
draft: false
---

[지난 글](/posts/k8s-node-cordon-drain/)에서 노드 유지보수를 위한 Cordon과 Drain 절차를 살펴봤다. 이번에는 쿠버네티스 API를 확장하는 핵심 메커니즘인 **Custom Resource Definition(CRD)**을 다룬다. 쿠버네티스 생태계의 많은 도구(Prometheus Operator, ArgoCD, cert-manager, Istio 등)가 CRD를 기반으로 작동한다. CRD를 이해하면 이런 도구들의 작동 방식을 깊이 이해할 수 있고, 직접 확장도 구현할 수 있다.

## CRD가 필요한 이유

쿠버네티스의 핵심 설계 철학 중 하나는 **모든 것을 API 오브젝트로 표현**한다는 것이다. Deployment, Service, ConfigMap이 모두 API 리소스다. 이 패턴은 강력하다. `kubectl`, RBAC, GitOps 워크플로우가 모두 API를 통해 균일하게 적용되기 때문이다.

CRD는 이 패턴을 사용자 정의 도메인으로 확장한다. "데이터베이스 클러스터 생성"을 `Database` 리소스로 표현하면, `kubectl apply -f database.yaml` 하나로 복잡한 인프라를 선언적으로 관리할 수 있다.

![CRD — 쿠버네티스 API 확장 구조](/assets/posts/k8s-custom-resources-crd-architecture.svg)

## CRD 정의

CRD를 등록하면 API Server가 새로운 API 엔드포인트를 동적으로 추가한다. 재시작 없이 즉시 반영된다.

![CRD 정의와 Custom Resource 생성](/assets/posts/k8s-custom-resources-crd-code.svg)

CRD의 핵심 구성 요소:
- `spec.group`: API 그룹 (예: `myapp.example.com`)
- `spec.names.kind`: 단수형 리소스 종류 (예: `Database`)
- `spec.names.plural`: URL에서 사용하는 복수형 (예: `databases`)
- `spec.scope`: `Namespaced` 또는 `Cluster`

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: databases.myapp.example.com
spec:
  group: myapp.example.com
  scope: Namespaced
  names:
    kind: Database
    plural: databases
    singular: database
    shortNames:
      - db
  versions:
    - name: v1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              properties:
                engine:
                  type: string
                  enum: [postgresql, mysql]
                replicas:
                  type: integer
                  minimum: 1
                  maximum: 10
```

`schema.openAPIV3Schema`는 CR 필드를 검증한다. `engine: oracle`처럼 정의에 없는 값은 API Server에서 즉시 거부된다. 검증 스키마 없이 CRD를 사용하면 잘못된 값이 etcd에 저장되어 문제를 일으킬 수 있다.

## Custom Resource 생성과 관리

CRD가 등록되면 CR을 내장 리소스처럼 다룰 수 있다.

```bash
# CRD 등록 확인
kubectl get crd databases.myapp.example.com

# CR 생성
kubectl apply -f my-database.yaml

# CR 목록 조회
kubectl get databases
kubectl get db  # shortName 사용

# CR 상세 조회
kubectl describe database my-postgres

# CR 삭제
kubectl delete database my-postgres
```

CR을 생성해도 기본적으로 아무 일도 일어나지 않는다. CRD는 데이터 구조를 정의할 뿐이다. CR에 반응해서 실제로 무언가를 만드는 것은 **Custom Controller(Operator)**의 역할이다.

## Custom Controller 패턴

Custom Controller는 CRD의 CR을 Watch하고, desired state와 actual state를 비교해 차이를 조정(reconcile)한다.

```
CR 생성/수정/삭제
    │
    ▼
Informer Watch (list-watch 기반 캐시)
    │
    ▼
Reconciliation Loop
    │
    ├─ 현재 상태 조회 (StatefulSet, Service 등)
    ├─ 원하는 상태 계산 (spec 파싱)
    ├─ 차이 조정 (Create/Update/Delete)
    └─ status 업데이트
```

`status` 서브리소스를 활용하면 Controller가 CR의 현재 상태를 기록할 수 있다.

```yaml
status:
  phase: Running
  readyReplicas: 3
  conditions:
    - type: Ready
      status: "True"
      lastTransitionTime: "2026-06-09T09:00:00Z"
```

## Finalizer

CR 삭제 시 정리 작업이 필요할 때 Finalizer를 사용한다.

```yaml
metadata:
  finalizers:
    - myapp.example.com/cleanup
```

`kubectl delete database my-postgres`를 실행하면 즉시 삭제되지 않고 `deletionTimestamp`가 설정된다. Controller가 이를 감지해 정리 작업을 수행한 뒤 Finalizer를 제거하면 그때 실제로 삭제된다. 클라우드 스토리지 버킷, 외부 데이터베이스 인스턴스 같은 외부 리소스 정리에 필수적이다.

## 실제 CRD 사례

운영 환경에서 자주 마주치는 CRD들이다.

| 프로젝트 | CRD 예시 | 기능 |
|---|---|---|
| Prometheus Operator | `ServiceMonitor` | 모니터링 대상 자동 등록 |
| cert-manager | `Certificate`, `Issuer` | TLS 인증서 자동 발급 |
| ArgoCD | `Application` | GitOps 배포 선언 |
| Istio | `VirtualService`, `Gateway` | 서비스 메시 라우팅 |
| Tekton | `Pipeline`, `Task` | CI/CD 파이프라인 |

```bash
# 현재 클러스터에 설치된 CRD 목록
kubectl get crd

# 특정 도구의 CRD만 필터링
kubectl get crd | grep prometheus
kubectl get crd | grep cert-manager
```

---

**지난 글:** [Node Cordon과 Drain — 안전한 노드 유지보수 절차](/posts/k8s-node-cordon-drain/)

**다음 글:** [CRD 심화 — 버전 관리, Webhook, 고급 기능](/posts/k8s-crd-deep-dive/)

<br>
읽어주셔서 감사합니다. 😊
