---
title: "Admission Webhook — 클러스터 진입 관문"
description: "MutatingAdmissionWebhook과 ValidatingAdmissionWebhook의 차이, Webhook 서버 구현 방법(TLS·인증서), AdmissionReview 요청/응답 구조, 그리고 실무에서 자주 쓰는 패턴(기본값 주입·레이블 강제·보안 검사)을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 6
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "Admission Webhook", "MutatingWebhook", "ValidatingWebhook", "보안", "정책"]
featured: false
draft: false
---

[지난 글](/posts/k8s-controller-runtime-operator-sdk/)에서 controller-runtime과 Operator SDK로 Operator를 개발하는 방법을 살펴봤다. 이번 글에서는 쿠버네티스 API의 또 다른 확장 메커니즘인 **Admission Webhook**을 다룬다. Operator가 "만들어진 리소스를 감시하고 조정"한다면, Admission Webhook은 "리소스가 API Server에 들어오는 순간 가로채서 검사·수정"한다. 클러스터 보안과 정책 적용에 없어서는 안 될 도구다.

## Admission Webhook이란?

쿠버네티스 API Server는 `kubectl apply`나 Pod 생성 요청이 들어오면 일련의 검증 체인을 실행한다. 이 체인 안에 사용자 정의 HTTP 서버(Webhook)를 끼워 넣을 수 있다. API Server가 AdmissionReview 요청을 Webhook 서버로 보내면, Webhook은 JSON으로 응답을 돌려준다.

![Admission Control 흐름](/assets/posts/k8s-admission-webhooks-flow.svg)

체인의 순서는 고정이다:

1. **Authentication** — 요청자가 누구인지 확인 (인증서, 토큰, OIDC)
2. **Authorization** — RBAC으로 이 작업을 수행할 권한이 있는지 확인
3. **Mutating Admission** — 오브젝트를 수정할 기회
4. **Object Schema Validation** — CRD의 openAPIV3Schema 등 타입 검사
5. **Validating Admission** — 최종 허용/거부 결정
6. **etcd 저장**

Mutating이 먼저 실행되고 Validating이 나중에 실행되는 이유가 있다. Mutating으로 기본값이 주입된 최종 오브젝트를 Validating이 검사해야 하기 때문이다. 순서가 반대라면 주입 전의 불완전한 오브젝트를 검사하게 되어 오탐(false positive)이 발생한다.

## MutatingWebhook vs ValidatingWebhook

![Mutating vs Validating Webhook 비교](/assets/posts/k8s-admission-webhooks-types.svg)

두 Webhook 타입의 가장 큰 차이는 **오브젝트 수정 가능 여부**다.

**MutatingAdmissionWebhook**은 요청된 오브젝트를 변경할 수 있다. 응답에 JSON Patch 배열을 포함하면 API Server가 해당 패치를 오브젝트에 적용한다. 대표적인 사용 사례:

- 리소스 요청/제한 기본값 주입 (requests/limits가 없는 Pod에 자동 설정)
- 특정 레이블/어노테이션 자동 추가
- Istio처럼 사이드카 컨테이너 자동 삽입
- `imagePullPolicy: Always` 강제

**ValidatingAdmissionWebhook**은 오브젝트를 수정할 수 없다. 오직 `allowed: true` 또는 `allowed: false`만 반환한다. 여러 Validating Webhook이 등록된 경우 모두 `allowed: true`를 반환해야 요청이 통과된다. 하나라도 거부하면 전체가 거부된다. 대표적인 사용 사례:

- 이미지 레지스트리 정책 강제 (허가된 레지스트리에서만 Pull 허용)
- 네이밍 규칙 강제
- 특정 레이블 필수 여부 검사
- 보안 컨텍스트 필드 검사 (privileged: true 차단)

## AdmissionReview 구조

Webhook은 HTTP POST 요청으로 `AdmissionReview` JSON을 받고 `AdmissionReview` JSON을 응답한다.

```json
{
  "apiVersion": "admission.k8s.io/v1",
  "kind": "AdmissionReview",
  "request": {
    "uid": "705ab4f5-6393-11e8-b7cc-42010a800002",
    "kind": {"group": "apps", "version": "v1", "kind": "Deployment"},
    "resource": {"group": "apps", "version": "v1", "resource": "deployments"},
    "namespace": "production",
    "operation": "CREATE",
    "userInfo": {
      "username": "developer@example.com",
      "groups": ["system:authenticated"]
    },
    "object": { ... }
  }
}
```

Mutating Webhook의 허용 + 패치 응답:

```json
{
  "apiVersion": "admission.k8s.io/v1",
  "kind": "AdmissionReview",
  "response": {
    "uid": "705ab4f5-6393-11e8-b7cc-42010a800002",
    "allowed": true,
    "patchType": "JSONPatch",
    "patch": "W3sib3AiOiJhZGQiLCJwYXRoIjoiL3NwZWMvcmVwbGljYXMiLCJ2YWx1ZSI6MX1d"
  }
}
```

`patch` 필드는 JSON Patch 배열을 Base64 인코딩한 값이다. 디코딩하면 `[{"op":"add","path":"/spec/replicas","value":1}]`와 같은 형태가 된다.

## Webhook 서버 구현

### TLS 인증서

Webhook 서버는 반드시 HTTPS로 서비스해야 한다. API Server가 Webhook 서버에 mTLS로 연결하기 때문이다. 인증서 관리에는 두 가지 방법이 있다.

**cert-manager 사용 (권장)**:

```yaml
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: webhook-tls
  namespace: webhook-system
spec:
  secretName: webhook-tls-secret
  dnsNames:
    - webhook-service.webhook-system.svc
    - webhook-service.webhook-system.svc.cluster.local
  issuerRef:
    name: selfsigned-issuer
    kind: ClusterIssuer
```

**kubebuilder / controller-runtime 사용 시**: `//+kubebuilder:webhook` 마커와 `make manifests`로 인증서 설정이 자동 생성된다. `caBundle` 자동 주입은 `cert-manager`의 CA Injector가 처리한다.

### Go로 Webhook 서버 구현

controller-runtime의 `webhook` 패키지를 활용하면 HTTP 핸들러를 직접 작성할 필요가 없다.

```go
// api/v1alpha1/myapp_webhook.go

//+kubebuilder:webhook:path=/mutate-apps-v1alpha1-myapp,mutating=true,
//  failurePolicy=fail,sideEffects=None,groups=apps.example.com,
//  resources=myapps,verbs=create;update,versions=v1alpha1,
//  name=mmyapp.kb.io,admissionReviewVersions=v1

type MyAppDefaulter struct{}

func (d *MyAppDefaulter) Default(ctx context.Context, obj runtime.Object) error {
    myapp := obj.(*MyApp)
    if myapp.Spec.Replicas == nil {
        replicas := int32(1)
        myapp.Spec.Replicas = &replicas
    }
    if myapp.Spec.Image == "" {
        myapp.Spec.Image = "nginx:latest"
    }
    return nil
}

//+kubebuilder:webhook:path=/validate-apps-v1alpha1-myapp,mutating=false,
//  failurePolicy=fail,sideEffects=None,groups=apps.example.com,
//  resources=myapps,verbs=create;update,versions=v1alpha1,
//  name=vmyapp.kb.io,admissionReviewVersions=v1

type MyAppValidator struct{}

func (v *MyAppValidator) ValidateCreate(ctx context.Context, obj runtime.Object) error {
    myapp := obj.(*MyApp)
    if *myapp.Spec.Replicas > 10 {
        return fmt.Errorf("replicas must be <= 10, got %d", *myapp.Spec.Replicas)
    }
    return nil
}
```

`main.go`에서 Webhook을 Manager에 등록한다:

```go
if err = (&myappv1.MyApp{}).SetupWebhookWithManager(mgr); err != nil {
    setupLog.Error(err, "unable to create webhook", "webhook", "MyApp")
    os.Exit(1)
}
```

## 실무 패턴

### 패턴 1: 기본값 주입 (Defaulting)

가장 일반적인 Mutating Webhook 용도다. Operator가 관리하는 CRD에서 선택적 필드에 기본값을 채워 사용자 편의를 높인다.

```go
func (d *MyAppDefaulter) Default(ctx context.Context, obj runtime.Object) error {
    myapp := obj.(*MyApp)

    // 환경별 기본 이미지 태그
    if !strings.Contains(myapp.Spec.Image, ":") {
        myapp.Spec.Image = myapp.Spec.Image + ":latest"
    }

    // 리소스 기본값
    if myapp.Spec.Resources.Requests == nil {
        myapp.Spec.Resources.Requests = corev1.ResourceList{
            corev1.ResourceCPU:    resource.MustParse("100m"),
            corev1.ResourceMemory: resource.MustParse("128Mi"),
        }
    }
    return nil
}
```

### 패턴 2: 레이블 강제 (Label Enforcement)

팀, 환경, 비용 센터 레이블을 모든 리소스에 강제하는 경우에 Validating Webhook을 사용한다.

```go
var requiredLabels = []string{"app", "team", "environment"}

func (v *LabelValidator) ValidateCreate(
    ctx context.Context, obj runtime.Object,
) error {
    accessor, err := meta.Accessor(obj)
    if err != nil {
        return err
    }
    labels := accessor.GetLabels()
    var missing []string
    for _, key := range requiredLabels {
        if _, ok := labels[key]; !ok {
            missing = append(missing, key)
        }
    }
    if len(missing) > 0 {
        return fmt.Errorf("required labels missing: %v", missing)
    }
    return nil
}
```

### 패턴 3: 보안 정책 검사

프로덕션 네임스페이스에서 `privileged: true` 또는 `hostNetwork: true`를 차단한다.

```go
func validateSecurityContext(pod *corev1.PodSpec, ns string) error {
    if ns != "production" {
        return nil
    }
    if pod.HostNetwork {
        return fmt.Errorf("hostNetwork is not allowed in production namespace")
    }
    for _, c := range pod.Containers {
        if c.SecurityContext != nil &&
            c.SecurityContext.Privileged != nil &&
            *c.SecurityContext.Privileged {
            return fmt.Errorf(
                "privileged container %q is not allowed in production", c.Name,
            )
        }
    }
    return nil
}
```

## failurePolicy와 운영 고려사항

`failurePolicy`는 Webhook 서버가 응답하지 않을 때의 동작을 결정한다.

```yaml
webhooks:
  - name: validate.example.com
    failurePolicy: Fail    # 기본값: Webhook 다운 시 요청 거부
    # failurePolicy: Ignore  # Webhook 다운 시 요청 허용 (더 위험할 수 있음)
    timeoutSeconds: 10      # 기본 10초, 최대 30초
    namespaceSelector:
      matchExpressions:
        - key: kubernetes.io/metadata.name
          operator: NotIn
          values:
            - kube-system   # 시스템 네임스페이스는 제외
            - webhook-system # Webhook 자체 네임스페이스도 제외
```

`failurePolicy: Fail`과 `namespaceSelector`는 함께 고려해야 한다. Webhook 서버가 `webhook-system` 네임스페이스에 있는데, Pod 생성 요청이 이 Webhook을 통과해야 하는 상황이 되면 **데드락**이 발생한다. Webhook 서버 Pod를 만들려면 Webhook을 통과해야 하고, Webhook을 통과하려면 서버가 살아있어야 하는 순환이 생긴다. `namespaceSelector`로 Webhook 서버가 있는 네임스페이스를 명시적으로 제외해야 한다.

또한 Webhook 서버는 가용성이 매우 중요하다. `failurePolicy: Fail` 설정 시 Webhook 서버 다운은 클러스터 전체 리소스 생성 불가로 이어질 수 있다. 최소 2개 이상의 레플리카와 `PodDisruptionBudget`으로 보호하고, `topologySpreadConstraints`로 노드를 분산시켜야 한다.

## Webhook 디버깅

```bash
# Webhook 서버 로그 확인
kubectl logs -n webhook-system deploy/webhook-server -f

# AdmissionWebhook 설정 확인
kubectl get mutatingwebhookconfigurations
kubectl get validatingwebhookconfigurations
kubectl describe validatingwebhookconfiguration myapp-validating-webhook-configuration

# Webhook이 거부한 이유 확인 (kubectl 출력에 포함됨)
kubectl apply -f myapp.yaml
# Error from server: error when creating "myapp.yaml":
#   admission webhook "vmyapp.kb.io" denied the request:
#   replicas must be <= 10, got 15
```

`kubebuilder`로 생성한 Webhook은 `make deploy`시 자동으로 `caBundle`을 채워넣는 어노테이션을 추가한다. `cert-manager`의 CA Injector가 이를 감지해 올바른 CA 인증서를 주입한다.

## 정리

Admission Webhook은 쿠버네티스 정책 관리의 핵심 도구다. **Mutating Webhook은 기본값 주입과 오브젝트 보정, Validating Webhook은 정책 강제와 보안 검사**라는 역할 분담을 이해하면 각 도구를 올바르게 활용할 수 있다.

`failurePolicy`, `namespaceSelector`, TLS 인증서 관리는 운영 환경에서 반드시 신경 써야 할 부분이다. 다음 글에서는 Webhook을 직접 구현하지 않고도 정책을 적용할 수 있는 OPA Gatekeeper를 살펴본다.

---

**지난 글:** [controller-runtime과 Operator SDK로 Operator 개발하기](/posts/k8s-controller-runtime-operator-sdk/)

**다음 글:** [OPA Gatekeeper — 정책 기반 거버넌스](/posts/k8s-opa-gatekeeper/)

<br>
읽어주셔서 감사합니다. 😊
