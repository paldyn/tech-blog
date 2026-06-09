---
title: "OPA Gatekeeper — 정책 기반 거버넌스"
description: "OPA(Open Policy Agent)와 Gatekeeper를 사용해 쿠버네티스 클러스터에 정책을 강제하는 방법, ConstraintTemplate과 Constraint 리소스, Rego 정책 언어 기초, 감사(Audit) 모드와 실무 정책 예시를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 7
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "OPA", "Gatekeeper", "정책", "Rego", "거버넌스", "보안"]
featured: false
draft: false
---

[지난 글](/posts/k8s-admission-webhooks/)에서 Admission Webhook의 동작 원리와 MutatingWebhookConfiguration, ValidatingWebhookConfiguration 구성 방법을 살펴봤다. 그 글에서 "Webhook은 직접 구현해야 한다"는 점이 큰 부담으로 남았을 것이다. 이번 글에서는 그 복잡성을 해결해 주는 도구인 **OPA Gatekeeper**를 소개한다. Gatekeeper는 Admission Webhook을 직접 구현할 필요 없이 **정책을 선언적 YAML과 Rego 언어**로 표현하고, 클러스터 전반의 거버넌스를 강제할 수 있게 해 준다.

## OPA와 Gatekeeper란?

**OPA(Open Policy Agent)**는 CNCF 졸업 프로젝트로, 범용 정책 엔진이다. 쿠버네티스에만 국한되지 않고 Terraform, Envoy, API 게이트웨이 등 다양한 시스템에서 정책 평가에 사용된다. OPA는 **Rego**라는 선언형 언어로 정책을 작성하며, JSON/YAML 형태의 입력을 받아 허용(allow) 또는 거부(deny)를 결정한다.

**Gatekeeper**는 OPA를 쿠버네티스 Admission Webhook과 통합하는 프로젝트다. CNCF 인큐베이팅 프로젝트이며, `gatekeeper-system` 네임스페이스에 컨트롤러 파드를 배포해 모든 API 요청을 가로채고 Rego 정책으로 평가한다. 핵심 장점은 다음과 같다.

- **PolicyAsCode**: 정책을 Git에 저장하고 GitOps 방식으로 관리
- **감사(Audit)**: 기존 리소스에도 정책 위반 여부를 주기적으로 검사
- **CRD 기반**: ConstraintTemplate과 Constraint라는 쿠버네티스 네이티브 리소스 사용
- **재사용성**: 하나의 ConstraintTemplate으로 여러 Constraint 인스턴스 생성 가능

## 아키텍처 개요

![OPA Gatekeeper — 아키텍처 및 요청 흐름](/assets/posts/k8s-opa-gatekeeper-architecture.svg)

Gatekeeper의 아키텍처는 크게 세 계층으로 나뉜다.

**정책 정의 계층**은 `ConstraintTemplate`과 `Constraint`로 구성된다. ConstraintTemplate은 정책의 스키마(파라미터 타입)와 Rego 로직을 함께 정의하며, 적용되면 쿠버네티스가 해당 이름으로 새 CRD를 자동 생성한다. Constraint는 그 CRD의 인스턴스로, 파라미터 값과 적용 범위(Namespace, 레이블 선택자 등)를 지정한다.

**실시간 집행 계층**은 `ValidatingWebhookConfiguration`을 통해 동작한다. `kubectl apply` 같은 API 요청이 들어오면 kube-apiserver는 Gatekeeper 파드에 AdmissionReview 요청을 보내고, Gatekeeper는 캐시된 Rego 정책을 즉시 평가해 허용/거부를 응답한다. 기본적으로 3개의 레플리카로 HA 구성된다.

**감사 계층**은 `Audit Controller`가 담당한다. 기본 1분 주기로 클러스터에 존재하는 모든 리소스를 재검사하고, 위반된 리소스는 `Constraint` 오브젝트의 `status.violations` 필드에 기록한다. 이를 통해 Webhook을 통과한 기존 리소스도 정책 위반 여부를 파악할 수 있다.

## ConstraintTemplate과 Rego 기초

Rego는 선언형 질의 언어로, 규칙 기반으로 동작한다. 핵심 개념은 `violation` 규칙이다. `violation` 블록이 하나 이상 평가되면 요청이 거부되고, 하나도 평가되지 않으면 허용된다.

```rego
package k8srequiredlimits

# 모든 컨테이너에 resources.limits 설정 강제
violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  not container.resources.limits
  msg := sprintf("컨테이너 '%v'에 resource limits가 없습니다", [container.name])
}

# CPU limits 별도 검사
violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  not container.resources.limits.cpu
  msg := sprintf("컨테이너 '%v'에 CPU limit이 없습니다", [container.name])
}
```

`input.review.object`는 평가 대상 쿠버네티스 리소스 전체를 의미한다. `[_]`는 배열의 임의 원소를 가리키는 Rego 문법이다. `not`은 논리 부정이다.

이 Rego를 ConstraintTemplate에 담으면 다음과 같다.

```yaml
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8srequiredlimits
spec:
  crd:
    spec:
      names:
        kind: K8sRequiredLimits
      validation:
        openAPIV3Schema:
          type: object
          properties:
            containers:
              type: array
              items:
                type: string
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8srequiredlimits

        violation[{"msg": msg}] {
          container := input.review.object.spec.containers[_]
          not container.resources.limits
          msg := sprintf("Container '%v' has no resource limits", [container.name])
        }
```

`spec.crd.spec.names.kind`에 지정한 이름(`K8sRequiredLimits`)으로 새 CRD가 생성된다. 이후 이 CRD를 사용해 Constraint를 배포할 수 있다.

## Rego 정책 구조 시각화

![Rego 정책 및 ConstraintTemplate 구조](/assets/posts/k8s-opa-gatekeeper-rego.svg)

위 다이어그램에서 왼쪽은 ConstraintTemplate의 YAML 뼈대이고, 오른쪽은 실제 Rego 정책 코드다. Rego는 `violation` 규칙 중심으로 작성되며 하나라도 매칭되면 거부가 발생한다.

## Constraint 배포

ConstraintTemplate이 배포된 뒤, 실제 정책을 활성화하려면 Constraint를 배포해야 한다.

```yaml
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLimits
metadata:
  name: require-resource-limits
spec:
  enforcementAction: deny       # deny | warn | dryrun
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
    namespaceSelector:
      matchLabels:
        policy: enforced
```

`enforcementAction`은 세 가지 값을 지원한다.

| 값 | 동작 |
|---|---|
| `deny` | 요청 즉시 거부, 오류 반환 |
| `warn` | 요청 허용하되 경고 메시지 반환 |
| `dryrun` | 감사 기록만, 실제 집행 없음 |

신규 정책 도입 시에는 먼저 `dryrun`으로 영향도를 파악하고, `warn`으로 팀에 알린 뒤, `deny`로 전환하는 단계적 접근이 권장된다.

## Audit 모드와 위반 확인

Audit Controller는 기존 리소스에 대한 정책 위반을 주기적으로 검사한다. 위반 결과는 Constraint 오브젝트의 `status.violations` 필드에 기록된다.

```bash
# 위반 목록 확인
kubectl get k8srequiredlimits require-resource-limits -o yaml

# 출력 예시 (status 부분)
# status:
#   violations:
#   - enforcementAction: deny
#     kind: Pod
#     message: "Container 'api' has no resource limits"
#     name: api-pod-xyz
#     namespace: production
```

감사 주기는 Gatekeeper 컨트롤러의 `--audit-interval` 플래그로 조정할 수 있다(기본값 60초). 위반 건수가 많을 경우 `--constraint-violations-limit` 플래그로 Constraint당 최대 기록 개수를 제한할 수 있다.

## 실무 정책 예시

### 1. 허용된 컨테이너 레지스트리만 사용

```rego
package k8sallowedrepos

violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  satisfied := [good | repo = input.parameters.repos[_]
                       good = startswith(container.image, repo)]
  not any(satisfied)
  msg := sprintf("이미지 '%v'는 허용된 레지스트리가 아닙니다", [container.image])
}
```

`input.parameters`를 통해 Constraint에서 전달한 파라미터(허용 레지스트리 목록)에 접근한다. 이것이 ConstraintTemplate과 Constraint를 분리하는 핵심 이유다. 하나의 템플릿으로 개발/스테이징/프로덕션 환경마다 다른 레지스트리 목록을 적용할 수 있다.

### 2. 루트 컨테이너 금지

```yaml
# ConstraintTemplate rego 부분
violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  container.securityContext.runAsUser == 0
  msg := sprintf("컨테이너 '%v'가 root(UID 0)로 실행됩니다", [container.name])
}

violation[{"msg": msg}] {
  container := input.review.object.spec.containers[_]
  not container.securityContext.runAsNonRoot
  msg := sprintf("컨테이너 '%v'에 runAsNonRoot가 설정되지 않았습니다", [container.name])
}
```

### 3. 특정 레이블 필수 적용

네임스페이스나 Deployment에 특정 레이블(예: `owner`, `team`, `cost-center`)을 강제하면 비용 추적과 책임 소재 파악이 쉬워진다.

```yaml
# Constraint 예시
apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sRequiredLabels
metadata:
  name: require-team-label
spec:
  enforcementAction: warn
  match:
    kinds:
      - apiGroups: ["apps"]
        kinds: ["Deployment"]
  parameters:
    labels:
      - key: team
      - key: cost-center
```

## Gatekeeper 설치와 운영

Helm을 사용한 설치가 일반적이다.

```bash
helm repo add gatekeeper https://open-policy-agent.github.io/gatekeeper/charts
helm install gatekeeper/gatekeeper \
  --name-template=gatekeeper \
  --namespace gatekeeper-system \
  --create-namespace \
  --set replicas=3 \
  --set auditInterval=60 \
  --set constraintViolationsLimit=100
```

운영 시 주의할 점은 다음과 같다.

**Webhook 실패 처리**: `ValidatingWebhookConfiguration`의 `failurePolicy` 기본값은 `Ignore`다. Gatekeeper 파드가 불응답 상태일 때 요청을 허용할지(`Ignore`) 거부할지(`Fail`) 결정한다. 프로덕션에서는 보안 요구사항에 따라 신중하게 선택해야 한다.

**네임스페이스 제외**: `gatekeeper-system` 네임스페이스는 기본적으로 정책 평가에서 제외된다. `kube-system` 등 시스템 네임스페이스도 제외하는 것이 안전하다.

**정책 라이브러리**: [Gatekeeper Library](https://github.com/open-policy-agent/gatekeeper-library)에는 실무에 바로 사용할 수 있는 수십 개의 ConstraintTemplate이 있다. `k8srequiredlabels`, `k8sallowedrepos`, `k8scontainerlimits` 등이 포함된다.

## OPA Gatekeeper vs PSA

쿠버네티스 내장 Pod Security Admission(PSA)과 비교하면 각자 역할이 다르다.

| 항목 | PSA | OPA Gatekeeper |
|---|---|---|
| 범위 | Pod 보안 설정 한정 | 모든 리소스, 모든 필드 |
| 커스터마이징 | 불가 (세 가지 레벨 고정) | 완전 자유 (Rego로 임의 정책) |
| 설치 | 빌트인, 설치 불필요 | 별도 설치 필요 |
| 감사 기능 | 없음 | 있음 (status.violations) |
| 학습 곡선 | 낮음 | 높음 (Rego 학습 필요) |

두 도구는 상호 보완적이다. PSA로 Pod 보안 기준선을 빠르게 잡고, 그 위에 Gatekeeper로 조직 맞춤형 세부 정책을 얹는 구성이 일반적이다.

---

**지난 글:** [Admission Webhook — 클러스터 진입 관문](/posts/k8s-admission-webhooks/)

**다음 글:** [Kyverno — Kubernetes 네이티브 정책 엔진](/posts/k8s-kyverno/)

<br>
읽어주셔서 감사합니다. 😊
