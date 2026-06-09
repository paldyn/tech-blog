---
title: "CRD 심화 — 검증·버전 관리·Conversion Webhook"
description: "OpenAPI v3 스키마로 CRD 필드를 검증하고, 여러 apiVersion을 동시에 지원하는 버전 전략, Conversion Webhook으로 버전 간 변환을 자동화하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 1
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "CRD", "CustomResourceDefinition", "API 확장", "Conversion Webhook"]
featured: false
draft: false
---

[지난 글](/posts/k8s-custom-resources-crd/)에서 CRD의 기본 개념과 Custom Resource 생성 방법을 살펴봤다. 이번 글에서는 한 단계 더 나아가, 운영 환경에서 CRD를 안정적으로 관리하는 데 필수적인 세 가지 주제인 **OpenAPI v3 스키마 검증**, **다중 버전 관리**, **Conversion Webhook**을 깊이 있게 다룬다.

CRD를 단순히 등록하는 것과, 수천 개의 Custom Resource가 존재하는 환경에서 하위 호환성을 유지하며 버전을 업그레이드하는 것은 완전히 다른 수준의 작업이다. 이 글을 읽고 나면 프로덕션 수준의 CRD 설계 패턴을 이해하게 될 것이다.

## OpenAPI v3 스키마 검증

### 구조적 스키마란

쿠버네티스 1.15부터 `apiextensions.k8s.io/v1`이 안정화되면서 **구조적 스키마(Structural Schema)**가 필수가 됐다. 구조적 스키마의 핵심 요건은 단순하다. 스키마의 모든 필드에 `type`을 명시해야 한다. `type` 없이 임의 필드를 허용하는 자유 형식 스키마는 v1에서 지원되지 않는다.

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
    shortNames: ["db"]
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
              required: ["engine"]
              properties:
                engine:
                  type: string
                  enum: ["postgresql", "mysql"]
                replicas:
                  type: integer
                  minimum: 1
                  maximum: 10
                storage:
                  type: string
                  pattern: '^[0-9]+(Mi|Gi)$'
            status:
              type: object
              properties:
                phase:
                  type: string
                readyReplicas:
                  type: integer
```

이 스키마가 적용되면 API Server는 CR 생성·수정 시 다음을 자동으로 검사한다.

- `spec.engine`이 `postgresql` 또는 `mysql`인지 (`enum` 검증)
- `spec.replicas`가 1 이상 10 이하인지 (`minimum`, `maximum` 검증)
- `spec.storage`가 정규식 패턴과 일치하는지 (`pattern` 검증)
- `spec.engine` 필드가 존재하는지 (`required` 검증)

### 검증 오류는 즉시 반환된다

검증 실패 시 API Server는 `400 Bad Request`와 함께 상세한 오류 메시지를 즉시 반환한다. 잘못된 값이 etcd에 저장되는 일이 없으므로 Operator 코드에서 방어 로직을 반복할 필요가 없다.

```bash
kubectl apply -f bad-database.yaml
# Error from server: ...
# spec.engine: Unsupported value: "oracle": supported values: "postgresql", "mysql"
```

### CEL 기반 크로스 필드 검증 (k8s 1.25+)

기존 OpenAPI 검증의 한계는 단일 필드 범위를 벗어난 검증이 불가능하다는 점이었다. 예를 들어 "minReplicas는 maxReplicas보다 작아야 한다"는 두 필드 간의 관계를 표현할 수 없었다. 이를 해결하기 위해 도입된 것이 `x-kubernetes-validations`다.

```yaml
spec:
  type: object
  properties:
    minReplicas:
      type: integer
    maxReplicas:
      type: integer
  x-kubernetes-validations:
    - rule: "self.minReplicas <= self.maxReplicas"
      message: "minReplicas must be less than or equal to maxReplicas"
```

CEL(Common Expression Language) 표현식은 서버 사이드에서 실행되므로 별도의 Admission Webhook 없이도 복잡한 검증 로직을 적용할 수 있다.

![CRD OpenAPI v3 스키마 검증 구조](/assets/posts/k8s-crd-deep-dive-schema.svg)

## 버전 관리 전략

### 버전은 왜 필요한가

CRD가 한 번 운영 환경에 배포되면 수많은 Custom Resource가 생성된다. 어느 순간 스키마를 변경해야 할 때, 기존 CR을 모두 마이그레이션하지 않으면서도 새로운 필드를 도입하고 싶다면 버전이 필요하다. 쿠버네티스는 하나의 CRD에서 여러 API 버전을 동시에 서비스하는 것을 지원한다.

### served와 storage 플래그

CRD에서 버전을 관리하는 핵심 플래그는 두 가지다.

| 플래그 | 의미 |
|---|---|
| `served: true` | API Server가 이 버전으로 들어오는 요청을 처리한다 |
| `served: false` | 이 버전은 더 이상 API 요청을 받지 않는다 (deprecated) |
| `storage: true` | etcd에 저장할 때 이 버전을 사용한다 (단 하나만 true) |

`storage: true`인 버전은 항상 하나뿐이어야 한다. 이 버전이 **허브(hub)**가 된다. 다른 버전으로 들어온 요청은 모두 이 허브 버전으로 변환된 후 저장된다.

### 버전 진화 시나리오

일반적인 버전 진화 패턴은 다음과 같다.

```yaml
# 초기 상태
versions:
  - name: v1alpha1
    served: true
    storage: true

# v1beta1 추가 후
versions:
  - name: v1alpha1
    served: true   # 하위 호환
    storage: false # 저장은 v1beta1으로
  - name: v1beta1
    served: true
    storage: true

# GA 버전 출시 후
versions:
  - name: v1alpha1
    served: false  # 비활성화
    storage: false
  - name: v1beta1
    served: true   # 기존 사용자 유예
    storage: false
  - name: v1
    served: true
    storage: true  # 최종 저장 버전
```

![CRD 버전 관리와 Conversion Webhook 흐름](/assets/posts/k8s-crd-deep-dive-versioning.svg)

## Conversion Webhook

### 버전이 달라지면 무슨 일이 생기나

`v1alpha1`으로 생성된 CR이 etcd에 저장돼 있는데, 클라이언트가 `v1`으로 읽기를 요청하면 어떻게 될까? 두 버전의 스키마가 다르다면 단순 패스스루로는 응답할 수 없다. 이 변환을 처리하는 것이 **Conversion Webhook**이다.

### Conversion Webhook 설정

CRD에서 Conversion Webhook을 활성화하려면 `spec.conversion` 섹션을 정의한다.

```yaml
spec:
  conversion:
    strategy: Webhook
    webhook:
      conversionReviewVersions: ["v1", "v1beta1"]
      clientConfig:
        service:
          namespace: default
          name: my-converter
          port: 443
        caBundle: <base64-encoded-CA>
```

`strategy: None`(기본값)이면 변환 없이 그대로 반환한다. 스키마가 같다면 `None`으로 충분하지만, 필드가 추가되거나 이름이 바뀌었다면 반드시 `Webhook`을 사용해야 한다.

### Webhook 서버 구현

Conversion Webhook 서버는 `/convert` 경로에서 `ConversionReview` 요청을 처리하는 HTTP 서버다. 핵심 구조는 다음과 같다.

```go
// ConversionReview 요청 처리 (Go 예시)
func handleConvert(w http.ResponseWriter, r *http.Request) {
    review := &apiextv1.ConversionReview{}
    json.NewDecoder(r.Body).Decode(review)

    for _, obj := range review.Request.Objects {
        cr := parseCR(obj.Raw)
        converted := convertToV1(cr)
        review.Response.ConvertedObjects = append(
            review.Response.ConvertedObjects, converted)
    }
    review.Response.Result = metav1.Status{Status: "Success"}
    json.NewEncoder(w).Encode(review)
}
```

Webhook 서버 구현 시 주의할 점이 있다.

1. **TLS 필수**: caBundle에 CA 인증서를 등록하고 서버 인증서를 검증해야 한다. `insecureSkipTLSVerify: true`는 절대 프로덕션에 사용하지 않는다.
2. **멱등성(Idempotency)**: 동일 입력에 항상 동일 출력을 반환해야 한다. 상태 있는 변환 로직은 피한다.
3. **에러 처리**: 변환 실패 시 `Result.Status: Failure`와 함께 메시지를 반환한다. 실패를 무시하거나 빈 응답을 반환하면 API Server가 패닉에 빠질 수 있다.
4. **필드 보존**: 변환하지 않는 필드(예: `metadata`, `status`)는 반드시 원본 그대로 복사해야 한다.

### 허브 앤 스포크 패턴

버전이 3개 이상으로 늘어나면 모든 버전 쌍에 대한 변환 로직을 작성하는 것은 비효율적이다. 일반적으로는 **허브 앤 스포크(Hub-and-Spoke)** 패턴을 사용한다. storage 버전(예: `v1`)을 허브로 정하고, 다른 모든 버전은 허브를 통해 변환한다.

```
v1alpha1 ──→ v1 (허브) ──→ v1beta1
v1alpha1 ←── v1 (허브) ←── v1beta1
```

이렇게 하면 N개의 버전이 있어도 변환 코드는 N-1 쌍만 작성하면 된다. controller-gen의 `+kubebuilder:storageversion` 마커가 허브 지정을 자동화해 준다.

## 프리저브 언노운 필드와 pruning

기본적으로 CRD v1은 **pruning**을 적용한다. 스키마에 정의되지 않은 필드는 저장 시 자동으로 제거된다. 이는 잘못된 필드가 조용히 저장되는 문제를 방지한다. 만약 임의 필드를 허용해야 한다면 `x-kubernetes-preserve-unknown-fields: true`를 사용한다.

```yaml
properties:
  config:
    type: object
    x-kubernetes-preserve-unknown-fields: true
    description: "자유 형식 설정 맵"
```

단, 이 옵션은 해당 필드 아래에서 타입 검증이 완전히 비활성화되므로 꼭 필요한 경우에만 사용한다.

## 실전 팁

### additionalPrinterColumns

`kubectl get db` 출력에 사용자 정의 컬럼을 추가할 수 있다.

```yaml
additionalPrinterColumns:
  - name: Engine
    type: string
    jsonPath: .spec.engine
  - name: Replicas
    type: integer
    jsonPath: .spec.replicas
  - name: Phase
    type: string
    jsonPath: .status.phase
  - name: Age
    type: date
    jsonPath: .metadata.creationTimestamp
```

이렇게 하면 `kubectl get db` 출력에 Engine, Replicas, Phase, Age 컬럼이 표시돼 운영 가시성이 크게 향상된다.

### status 서브리소스 활성화

`status` 서브리소스를 명시적으로 활성화하면 `spec`과 `status` 업데이트 경로가 분리된다. Controller는 `/status` 서브리소스만 패치하고, 사용자는 `spec`만 수정한다. 이는 낙관적 잠금(optimistic locking) 충돌을 크게 줄인다.

```yaml
subresources:
  status: {}
```

### scale 서브리소스

HPA와 연동하려면 `scale` 서브리소스도 추가한다.

```yaml
subresources:
  status: {}
  scale:
    specReplicasPath: .spec.replicas
    statusReplicasPath: .status.readyReplicas
```

이 설정이 있으면 `kubectl scale db my-postgres --replicas=5`처럼 표준 스케일 명령을 사용할 수 있고, HPA도 이 CRD를 자동으로 스케일링 대상으로 인식한다.

---

**지난 글:** [Custom Resources와 CRD — 쿠버네티스 API 확장](/posts/k8s-custom-resources-crd/)

**다음 글:** [API Aggregation Layer — 쿠버네티스 API 확장 제2부](/posts/k8s-api-aggregation/)

<br>
읽어주셔서 감사합니다. 😊
