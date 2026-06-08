---
title: "Pod Security Standards — 클러스터 보안 정책의 표준 프레임워크"
description: "Privileged·Baseline·Restricted 세 가지 보안 레벨의 차이, Namespace 레이블로 enforce/audit/warn 모드를 적용하는 방법, PSP 대체 전략을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 1
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "pod-security-standards", "pss", "security", "namespace", "policy"]
featured: false
draft: false
---

[지난 글](/posts/k8s-seccomp-apparmor/)에서 Seccomp와 AppArmor로 커널 레벨 보안을 구성하는 방법을 살펴봤다. 이번에는 클러스터 전체에 일관된 보안 기준선을 적용하는 **Pod Security Standards(PSS)**를 다룬다. 쿠버네티스 1.25부터 PodSecurityPolicy(PSP)가 제거됐고, 그 자리를 PSS가 채웠다. PSS는 "어떤 Pod가 허용되는가"를 세 가지 레벨로 표준화한 명세이며, 실제 강제는 Pod Security Admission(PSA) 컨트롤러가 담당한다.

## 세 가지 보안 레벨

PSS는 Privileged, Baseline, Restricted 세 단계를 정의한다.

![Pod Security Standards — 세 가지 보안 레벨](/assets/posts/k8s-pod-security-standards-levels.svg)

**Privileged**는 제한이 없다. 호스트 네트워크·PID·IPC 공유, `privileged: true` 컨테이너, 임의 capability 추가가 모두 허용된다. 신뢰된 시스템 컴포넌트(CNI 플러그인, 스토리지 드라이버)나 노드 에이전트처럼 호스트 접근이 필요한 워크로드를 위한 레벨이다.

**Baseline**은 일반 클러스터 워크로드를 위한 최소 제한 정책이다. `hostNetwork`, `hostPID`, `hostIPC`, `privileged: true`를 금지하되, root 실행과 일반 capability는 허용한다. 대부분의 프로덕션 앱이 이 레벨에서 문제없이 동작한다.

**Restricted**는 현재 보안 모범 사례를 최대한 반영한 강력한 정책이다. root 실행 금지(`runAsNonRoot: true`), 읽기 전용 루트 파일시스템 권장, `NET_RAW`를 포함한 모든 capability 드롭, `seccompProfile`을 `RuntimeDefault` 이상으로 요구한다. 멀티테넌트 환경이나 보안 요구사항이 높은 워크로드에 적합하다.

## Namespace 레이블로 정책 적용

PSS는 Namespace 레이블로 적용한다. 레이블 키 형식은 `pod-security.kubernetes.io/{mode}`이며, 값이 레벨이다.

![Pod Security Standards — Namespace 레이블 설정](/assets/posts/k8s-pod-security-standards-policy.svg)

세 가지 모드를 조합해서 점진적으로 강화할 수 있다.

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    # enforce: 위반 시 즉시 거부
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: v1.29
    # warn: 사용자에게 경고 표시 (거부 안 함)
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/warn-version: latest
    # audit: 감사 로그에 기록
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/audit-version: latest
```

`-version` 레이블은 특정 쿠버네티스 버전의 정책 정의를 고정한다. `latest`는 현재 클러스터 버전의 가장 엄격한 정책을 사용한다. 업그레이드 후 정책 변경으로 인한 예상치 못한 거부를 방지하려면 버전을 명시하는 것이 좋다.

## 기존 Namespace에 점진적으로 도입

이미 운영 중인 Namespace에 갑자기 `enforce: restricted`를 적용하면 기존 Pod가 재시작될 때 거부될 수 있다. 다음 순서로 점진적으로 마이그레이션한다.

```bash
# 1단계: warn+audit만 먼저 적용
kubectl label namespace my-app \
  pod-security.kubernetes.io/warn=restricted \
  pod-security.kubernetes.io/audit=restricted

# 2단계: 경고 로그를 확인하며 워크로드 수정
kubectl get events -n my-app | grep Warning

# 3단계: 준비 완료 후 enforce 추가
kubectl label namespace my-app \
  pod-security.kubernetes.io/enforce=restricted
```

## Restricted 레벨 요구사항 충족

앱이 Restricted를 통과하려면 파드 스펙에 다음 필드가 필요하다.

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  seccompProfile:
    type: RuntimeDefault
containers:
  - name: app
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop:
          - ALL
      readOnlyRootFilesystem: true
```

`capabilities.drop: [ALL]`에서 `NET_BIND_SERVICE`만 다시 추가하는 것은 Restricted에서 허용된다. 1024 미만 포트를 바인딩해야 하는 앱(예: nginx 80번 포트)에서 많이 쓰는 패턴이다.

## PSP 마이그레이션 체크리스트

PSP를 사용하던 클러스터를 PSS로 전환할 때 확인할 사항이다.

```bash
# 기존 PodSecurityPolicy 목록 확인
kubectl get psp

# Namespace별 PSP 바인딩 확인 (ClusterRoleBinding)
kubectl get clusterrolebinding -o json | \
  python3 -c "import sys,json; \
  [print(b['metadata']['name']) for b in json.load(sys.stdin)['items'] \
   if any(r.get('apiGroup')=='policy' for r in b.get('roleRef',{}).values() \
          if isinstance(r,str))]" 2>/dev/null || true

# PSP 없이 드라이런으로 Restricted 위반 확인
kubectl label namespace my-app \
  pod-security.kubernetes.io/warn=restricted --dry-run=server
```

## 클러스터 기본값 설정

`kube-apiserver`의 `--admission-plugins` 플래그에 `PodSecurity`가 포함되면 PSA가 활성화된다. 쿠버네티스 1.23부터 기본 활성화다. AdmissionConfiguration으로 클러스터 전체 기본값을 설정할 수도 있다.

```yaml
# /etc/kubernetes/admission-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: AdmissionConfiguration
plugins:
  - name: PodSecurity
    configuration:
      apiVersion: pod-security.admission.config.k8s.io/v1
      kind: PodSecurityConfiguration
      defaults:
        enforce: baseline
        enforce-version: latest
        warn: restricted
        warn-version: latest
      exemptions:
        usernames: []
        runtimeClasses: []
        namespaces:
          - kube-system
          - monitoring
```

`exemptions.namespaces`에 `kube-system`을 포함시키는 것은 필수다. kube-system의 컴포넌트들은 Privileged 수준이 필요하기 때문이다.

---

**지난 글:** [Seccomp와 AppArmor — 커널 레벨 보안 프로파일](/posts/k8s-seccomp-apparmor/)

**다음 글:** [Pod Security Admission — PSA 동작 원리와 설정](/posts/k8s-pod-security-admission/)

<br>
읽어주셔서 감사합니다. 😊
