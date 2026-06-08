---
title: "Pod Security Admission — PSA 동작 원리와 설정"
description: "PodSecurity Admission Controller가 요청을 처리하는 흐름, enforce/warn/audit 모드 동작 방식, AdmissionConfiguration으로 클러스터 기본값과 exemptions를 설정하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 2
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "pod-security-admission", "psa", "admission-controller", "security", "namespace"]
featured: false
draft: false
---

[지난 글](/posts/k8s-pod-security-standards/)에서 Pod Security Standards(PSS)의 세 가지 레벨을 살펴봤다. PSS는 "무엇을 허용하는가"를 정의하는 명세이고, **Pod Security Admission(PSA)**은 그 명세를 실제로 집행하는 구현체다. PSA는 쿠버네티스 1.23부터 기본 활성화된 빌트인 Admission Controller로, 별도의 설치 없이 사용할 수 있다는 점에서 OPA Gatekeeper나 Kyverno와 차별화된다.

## PSA 요청 처리 흐름

`kubectl apply`로 Pod를 생성하면 API Server는 인증·인가를 거친 뒤 Admission 단계로 진입한다. PodSecurity Admission Controller는 이 단계에서 Namespace 레이블을 읽어 정책을 평가한다.

![Pod Security Admission — 요청 처리 흐름](/assets/posts/k8s-pod-security-admission-flow.svg)

세 모드는 독립적으로 동작한다. 같은 위반에 대해 `enforce`는 거부, `warn`은 경고 출력, `audit`는 로그 기록을 동시에 수행할 수 있다. 일반적으로 마이그레이션 초기에는 `warn`+`audit`만 켜놓고 문제를 파악한 뒤 `enforce`를 추가하는 전략을 사용한다.

## Namespace 레이블 상세

PSA 레이블의 전체 형식은 다음과 같다.

```
pod-security.kubernetes.io/{mode}: {level}
pod-security.kubernetes.io/{mode}-version: {version}
```

`{mode}`는 `enforce`, `warn`, `audit` 중 하나다. `{level}`은 `privileged`, `baseline`, `restricted` 중 하나다. `-version` 레이블은 정책 버전을 고정한다. 지정하지 않으면 `latest`가 기본값이다.

```bash
# 단계적 적용 — 먼저 warn으로 영향도 파악
kubectl label namespace staging \
  pod-security.kubernetes.io/warn=restricted \
  pod-security.kubernetes.io/warn-version=v1.29

# warn 메시지 확인 (kubectl 출력에 Warning: 헤더로 표시됨)
kubectl apply -f pod.yaml -n staging

# 준비되면 enforce 추가
kubectl label namespace staging \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/enforce-version=v1.29
```

## 기존 Pod와 신규 Pod의 차이

PSA는 **새로 생성·업데이트되는 Pod에만 적용**된다. 레이블을 추가해도 이미 실행 중인 Pod는 즉시 종료되지 않는다. 단, Deployment가 롤링 업데이트를 수행하거나 Pod가 재시작될 때 새 Pod가 정책을 통과하지 못하면 `Pending` 상태가 된다.

```bash
# 기존 Pod 중 위반 여부 사전 확인 (dry-run)
kubectl label namespace my-ns \
  pod-security.kubernetes.io/enforce=restricted \
  --dry-run=server

# dry-run 결과로 Warning 메시지가 출력되면 기존 Pod 중 위반이 있다는 뜻
```

## AdmissionConfiguration으로 클러스터 기본값 설정

Namespace 레이블 없이도 클러스터 전체에 기본 PSS를 적용하려면 `AdmissionConfiguration` 파일을 사용한다.

![PSA Exemptions — 제외 대상 설정](/assets/posts/k8s-pod-security-admission-exemptions.svg)

`kube-apiserver` 시작 옵션에 `--admission-control-config-file=/etc/kubernetes/admission-config.yaml`을 추가하면 된다. 매니지드 클러스터(EKS, GKE, AKS)에서는 이 파일에 직접 접근하기 어렵고, 대신 Namespace 레이블로 세밀하게 조정한다.

## exemptions 설정

`exemptions`는 세 가지 기준으로 PSA를 건너뛸 수 있다.

- `usernames`: `system:serviceaccount:kube-system:replicaset-controller`처럼 컨트롤러 ServiceAccount를 제외하면 kube-system의 내부 동작에 영향을 주지 않는다.
- `namespaces`: `kube-system`, `kube-public`, `monitoring` 등 시스템 Namespace를 통째로 제외한다.
- `runtimeClasses`: Kata Containers처럼 격리된 런타임을 쓰는 Pod는 별도 정책이 필요할 수 있어 제외한다.

```yaml
exemptions:
  usernames:
    - system:serviceaccount:kube-system:replicaset-controller
    - system:serviceaccount:kube-system:daemonset-controller
  namespaces:
    - kube-system
    - kube-node-lease
  runtimeClasses:
    - kata-containers
```

## 위반 디버깅

`enforce` 모드에서 Pod 생성이 거부되면 에러 메시지에 위반 항목이 명시된다.

```bash
$ kubectl apply -f privileged-pod.yaml -n restricted-ns
Error from server (Forbidden): error when creating "privileged-pod.yaml":
pods "test" is forbidden: violates PodSecurity "restricted:latest":
  privileged (container "app" must not set
    securityContext.privileged=true),
  runAsNonRoot != true
    (pod or container "app" must set
    securityContext.runAsNonRoot=true)
```

에러 메시지가 위반 필드를 직접 알려주므로 수정이 직관적이다. `warn` 모드에서는 kubectl 출력 상단에 `Warning:` 헤더로 동일한 정보가 나타난다.

## OPA Gatekeeper / Kyverno와의 관계

PSA는 PSS의 세 가지 레벨만 집행할 수 있어 커스텀 정책이 불가능하다. "특정 이미지 레지스트리만 허용", "특정 레이블 필수" 같은 요구사항은 PSA로 표현할 수 없다. 이런 경우 OPA Gatekeeper나 Kyverno를 추가로 사용한다. PSA는 기본 보안 기준선을 보장하고, 커스텀 정책 엔진은 조직별 정책을 추가하는 형태로 함께 운영하는 것이 일반적이다.

---

**지난 글:** [Pod Security Standards — 클러스터 보안 정책의 표준 프레임워크](/posts/k8s-pod-security-standards/)

**다음 글:** [Node Selectors — 파드 스케줄링의 첫 번째 단계](/posts/k8s-node-selectors/)

<br>
읽어주셔서 감사합니다. 😊
