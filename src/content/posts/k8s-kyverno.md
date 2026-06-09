---
title: "Kyverno — Kubernetes 네이티브 정책 엔진"
description: "Rego 없이 YAML로 정책을 작성하는 Kyverno의 특징, validate·mutate·generate·verifyImages 규칙 유형, ClusterPolicy와 Policy 리소스, PolicyException, 그리고 OPA Gatekeeper와의 비교를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-10"
archiveOrder: 8
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "Kyverno", "정책", "Policy as Code", "보안", "거버넌스"]
featured: false
draft: false
---

[지난 글](/posts/k8s-opa-gatekeeper/)에서 OPA Gatekeeper를 통해 Rego 언어로 정책을 작성하는 방법을 살펴봤다. Gatekeeper는 강력하지만 Rego 학습 곡선이 높다는 단점이 있다. 이번 글에서는 **Rego 없이 순수 YAML만으로 정책을 작성**할 수 있는 **Kyverno**를 소개한다. Kyverno는 "쿠버네티스 네이티브 정책 엔진"을 표방하며, 쿠버네티스에 친숙한 개발자라면 바로 정책 작성을 시작할 수 있다.

## Kyverno란?

Kyverno(그리스어로 "관리하다/다스리다")는 CNCF 졸업 프로젝트로, 쿠버네티스에 특화된 정책 엔진이다. OPA가 범용 정책 엔진인 반면, Kyverno는 처음부터 쿠버네티스 리소스를 대상으로 설계됐다. 주요 특징은 다음과 같다.

- **YAML 기반**: 별도의 DSL이나 스크립팅 언어 없이 쿠버네티스 YAML 문법으로 정책 작성
- **4가지 규칙 유형**: validate, mutate, generate, verifyImages로 다양한 정책 시나리오 커버
- **JMESPath / CEL 지원**: 복잡한 조건 표현을 위한 표준 쿼리 언어 사용
- **PolicyReport**: 감사 결과를 PolicyReport CRD에 기록, 표준화된 인터페이스 제공
- **CLI 도구**: `kyverno test` 명령으로 로컬에서 정책 테스트 가능

## 아키텍처 구성

![Kyverno — 아키텍처 개요](/assets/posts/k8s-kyverno-architecture.svg)

Kyverno는 세 가지 컨트롤러로 구성된다.

**Admission Controller**는 API 요청을 실시간으로 처리하는 핵심 컨트롤러다. MutatingWebhookConfiguration과 ValidatingWebhookConfiguration을 모두 등록해 mutate 규칙과 validate 규칙을 순차적으로 적용한다. Mutate가 먼저 실행되어 리소스를 수정한 뒤, Validate가 수정된 리소스를 검증한다. Generate 규칙의 일부(동기 생성)도 여기서 처리된다.

**Background Controller**는 기존 리소스를 주기적으로 감사하는 컨트롤러다. 새로운 정책이 배포되거나 기존 리소스가 변경될 때 감사를 수행하고, 결과를 `PolicyReport`(네임스페이스 범위)와 `ClusterPolicyReport`(클러스터 범위) CRD에 기록한다. OPA Gatekeeper의 Audit Controller와 유사한 역할이다.

**Cleanup Controller**는 Kyverno 고유 기능으로, `CleanupPolicy` 리소스를 사용해 TTL 기반으로 리소스를 자동 삭제한다. CronJob 형태로 주기적으로 실행되며 "30일 이상 된 완료된 Job 삭제" 같은 수명 주기 정책을 선언적으로 관리할 수 있다.

## 4가지 규칙 유형

![Kyverno — 4가지 정책 규칙 유형](/assets/posts/k8s-kyverno-policy-types.svg)

### 1. Validate — 허용/거부 검사

Validate 규칙은 리소스가 특정 조건을 만족하는지 검사하는 가장 기본적인 규칙이다. 조건을 위반하면 요청을 거부하거나(enforce 모드) 감사 기록만 남긴다(audit 모드).

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: require-resource-limits
spec:
  validationFailureAction: Enforce   # Enforce | Audit
  rules:
    - name: check-container-limits
      match:
        any:
          - resources:
              kinds: [Pod]
      validate:
        message: "모든 컨테이너에 resource limits를 설정해야 합니다."
        pattern:
          spec:
            containers:
              - name: "*"
                resources:
                  limits:
                    memory: "?*"
                    cpu: "?*"
```

`pattern` 필드는 JMESPath 기반 패턴 매칭을 사용한다. `?*`는 "하나 이상의 문자"를 의미하므로 해당 필드가 비어 있지 않아야 함을 표현한다.

Validate 규칙에는 패턴 매칭 외에도 `deny`(CEL 표현식 기반 명시적 거부), `assert`(복잡한 조건 검사)를 사용할 수 있다.

### 2. Mutate — 리소스 자동 수정

Mutate 규칙은 요청된 리소스를 자동으로 변경한다. 레이블 추가, 기본값 설정, 사이드카 컨테이너 주입 등에 사용된다.

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: add-default-labels
spec:
  rules:
    - name: add-labels
      match:
        any:
          - resources:
              kinds: [Deployment, StatefulSet]
      mutate:
        patchStrategicMerge:
          metadata:
            labels:
              managed-by: kyverno
              +(env): "production"    # 레이블이 없을 때만 추가
```

`+(env): "production"` 표기법은 Kyverno의 **조건부 앵커(Conditional Anchor)**다. `+(...)`는 해당 키가 존재하지 않을 경우에만 값을 추가한다. 반면 기존 값이 있으면 덮어쓰지 않는다.

JSON Patch 방식도 지원한다.

```yaml
mutate:
  patchesJson6902: |-
    - op: add
      path: /spec/template/spec/containers/0/securityContext
      value:
        runAsNonRoot: true
        allowPrivilegeEscalation: false
```

### 3. Generate — 리소스 자동 생성

Generate 규칙은 특정 이벤트(리소스 생성, 변경)가 발생했을 때 다른 리소스를 자동으로 생성한다. 새 네임스페이스 생성 시 NetworkPolicy나 ResourceQuota를 자동으로 생성하는 시나리오에 많이 쓰인다.

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: generate-default-netpol
spec:
  rules:
    - name: deny-all-traffic
      match:
        any:
          - resources:
              kinds: [Namespace]
      generate:
        apiVersion: networking.k8s.io/v1
        kind: NetworkPolicy
        name: deny-all
        namespace: "{{request.object.metadata.name}}"
        synchronize: true    # 원본 변경 시 생성된 리소스도 동기화
        data:
          spec:
            podSelector: {}
            policyTypes: [Ingress, Egress]
```

`synchronize: true`로 설정하면 원본 정책(ClusterPolicy)이 변경될 때 생성된 리소스도 자동으로 업데이트된다. `{{request.object.metadata.name}}`은 Kyverno의 JMESPath 변수 표현식으로 트리거 리소스의 이름을 참조한다.

### 4. VerifyImages — 컨테이너 이미지 서명 검증

VerifyImages 규칙은 컨테이너 이미지가 신뢰할 수 있는 서명자에 의해 서명됐는지 검증한다. Sigstore의 **Cosign**이나 Notary를 지원하며, 서플라이 체인 보안(Supply Chain Security)에 핵심적인 역할을 한다.

```yaml
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signature
spec:
  validationFailureAction: Enforce
  rules:
    - name: check-image-signature
      match:
        any:
          - resources:
              kinds: [Pod]
      verifyImages:
        - imageReferences:
            - "registry.example.com/*"
          attestors:
            - count: 1
              entries:
                - keyless:
                    subject: "https://github.com/myorg/*"
                    issuer: "https://token.actions.githubusercontent.com"
                    rekor:
                      url: https://rekor.sigstore.dev
```

`keyless` 방식은 OIDC 기반 Keyless 서명을 검증한다. GitHub Actions CI에서 서명된 이미지만 프로덕션 클러스터에 배포할 수 있도록 강제하는 데 활용할 수 있다.

## ClusterPolicy vs Policy

Kyverno는 두 가지 범위의 정책 리소스를 제공한다.

| 리소스 | 범위 | 용도 |
|---|---|---|
| `ClusterPolicy` | 클러스터 전체 | 모든 네임스페이스에 적용되는 전사 정책 |
| `Policy` | 특정 네임스페이스 | 해당 네임스페이스에만 적용되는 팀별 정책 |

`Policy`는 같은 네임스페이스의 리소스에만 매치할 수 있다. 따라서 네임스페이스를 넘나드는 정책은 반드시 `ClusterPolicy`로 작성해야 한다.

```yaml
# 네임스페이스 범위 정책
apiVersion: kyverno.io/v1
kind: Policy
metadata:
  name: team-policy
  namespace: my-team
spec:
  validationFailureAction: Audit
  rules:
    - name: check-image-tag
      match:
        any:
          - resources:
              kinds: [Pod]
              namespaces: [my-team]
      validate:
        message: "latest 태그는 사용할 수 없습니다."
        pattern:
          spec:
            containers:
              - image: "!*:latest"
```

## PolicyException — 정책 예외 처리

특정 리소스에 대해 정책을 예외 처리해야 할 때 `PolicyException` 리소스를 사용한다. 기존에는 정책 자체를 수정하거나 레이블을 이용해 제외해야 했지만, PolicyException을 사용하면 정책 수정 없이 선언적으로 예외를 등록할 수 있다.

```yaml
apiVersion: kyverno.io/v2beta1
kind: PolicyException
metadata:
  name: allow-debug-pod
  namespace: debugging
spec:
  exceptions:
    - policyName: require-resource-limits
      ruleNames:
        - check-container-limits
  match:
    any:
      - resources:
          kinds: [Pod]
          namespaces: [debugging]
          names: ["debug-*"]
```

이 예외는 `debugging` 네임스페이스의 `debug-`로 시작하는 Pod에 한해 `require-resource-limits` 정책을 면제한다. PolicyException 자체에도 정책을 적용해 예외 남용을 방지할 수 있다.

## Kyverno CLI로 정책 테스트

Kyverno는 강력한 CLI 도구를 제공해 클러스터 없이도 로컬에서 정책을 테스트할 수 있다.

```bash
# CLI 설치
brew install kyverno

# 특정 리소스에 정책 적용 테스트
kyverno apply policy.yaml --resource pod.yaml

# 테스트 케이스 실행
kyverno test tests/

# 테스트 디렉터리 구조
# tests/
#   kyverno-test.yaml  (테스트 정의)
#   policies/          (정책 파일)
#   resources/         (테스트 리소스)
```

`kyverno-test.yaml` 예시:

```yaml
name: require-limits-test
policies:
  - policies/require-resource-limits.yaml
resources:
  - resources/pod-with-limits.yaml
  - resources/pod-no-limits.yaml
results:
  - policy: require-resource-limits
    rule: check-container-limits
    resource: pod-with-limits
    result: pass
  - policy: require-resource-limits
    rule: check-container-limits
    resource: pod-no-limits
    result: fail
```

이렇게 테스트를 코드로 정의해 CI 파이프라인에 통합하면 정책 변경으로 인한 부작용을 사전에 검증할 수 있다.

## OPA Gatekeeper와의 비교

두 도구는 같은 문제를 다른 접근 방식으로 해결한다.

| 항목 | OPA Gatekeeper | Kyverno |
|---|---|---|
| 정책 언어 | Rego (별도 언어) | YAML + JMESPath/CEL |
| 학습 곡선 | 높음 | 낮음 |
| Mutate 지원 | 별도 MutatingWebhook 필요 | 기본 내장 |
| Generate 지원 | 없음 | 기본 내장 |
| 이미지 서명 검증 | 없음 | verifyImages 내장 |
| 리소스 정리 | 없음 | CleanupPolicy 내장 |
| 감사 리포트 | Constraint.status.violations | PolicyReport (표준 CRD) |
| 성숙도 | CNCF 졸업 (2021) | CNCF 졸업 (2023) |
| 커뮤니티 정책 라이브러리 | Gatekeeper Library | Kyverno Policies |

**Gatekeeper를 선택해야 할 때**: 정책이 매우 복잡하고 조직이 이미 Rego를 사용하고 있을 때, 또는 쿠버네티스 외 시스템(Envoy, Terraform)에도 동일한 OPA 정책 엔진을 사용하고자 할 때.

**Kyverno를 선택해야 할 때**: 쿠버네티스 팀이 Rego를 배울 여유가 없고 빠른 도입이 필요할 때, Mutate/Generate/VerifyImages 기능을 함께 활용하고 싶을 때, 정책 테스트를 CLI로 간편하게 처리하고 싶을 때.

두 도구 모두 프로덕션에서 검증된 CNCF 졸업 프로젝트이며, 상황에 따라 혼용하는 조직도 있다. 많은 팀이 **Kyverno로 시작해 필요 시 Gatekeeper를 추가**하는 전략을 취한다.

## 실무 도입 전략

1. **감사 우선**: 처음에는 `validationFailureAction: Audit`으로 설정해 현재 클러스터 상태와 정책 위반 건수를 파악한다.
2. **PolicyReport 모니터링**: Grafana + PolicyReport를 연동해 위반 트렌드를 시각화한다.
3. **팀별 협의**: Enforce로 전환하기 전에 개발팀과 정책 내용을 협의하고 충분한 유예 기간을 제공한다.
4. **점진적 Enforce**: 새로운 리소스에만 먼저 Enforce를 적용하고 기존 리소스는 단계적으로 마이그레이션한다.
5. **GitOps 통합**: 정책 파일을 Git 저장소에서 관리하고 ArgoCD/Flux로 배포해 정책 변경 이력을 추적한다.

---

**지난 글:** [OPA Gatekeeper — 정책 기반 거버넌스](/posts/k8s-opa-gatekeeper/)

**다음 글:** [Helm Chart 템플릿 심화 — 함수·파이프라인·제어 흐름](/posts/k8s-helm-charts-templating/)

<br>
읽어주셔서 감사합니다. 😊
