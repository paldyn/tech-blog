---
title: "쿠버네티스 NetworkPolicy — 파드 간 트래픽 제어"
description: "NetworkPolicy로 파드 간 Ingress/Egress를 제어하는 방법, 기본 차단 패턴, 네임스페이스 격리, OR/AND 조건 규칙을 실제 YAML 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 3
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "network-policy", "security", "ingress", "egress", "cni", "zero-trust"]
featured: false
draft: false
---

[지난 글](/posts/k8s-dual-stack-networking/)에서 IPv4와 IPv6를 동시에 운영하는 듀얼스택 네트워킹을 살펴봤다. 이번에는 쿠버네티스 클러스터 내에서 파드 간 통신을 제어하는 **NetworkPolicy**를 다룬다. 기본적으로 모든 파드는 클러스터 내 어느 파드와도 자유롭게 통신할 수 있다. 이 "기본 허용" 정책은 편리하지만 보안 측면에서는 위험하다. NetworkPolicy는 방화벽 규칙처럼 작동해 필요한 트래픽만 허용하는 **최소 권한 네트워크** 환경을 만든다.

## NetworkPolicy의 기본 개념

NetworkPolicy는 선택된 파드에 대한 인바운드(Ingress)와 아웃바운드(Egress) 트래픽 규칙을 정의한다. 중요한 특성이 있다.

- **화이트리스트 방식**: NetworkPolicy를 생성하면 명시적으로 허용한 트래픽 외에는 모두 차단된다
- **파드 선택**: `podSelector`로 어떤 파드에 정책을 적용할지 지정 (빈 `{}`이면 네임스페이스 전체)
- **CNI 의존**: 실제 트래픽 필터링은 CNI 플러그인이 처리 — Flannel은 NetworkPolicy 미지원, Calico/Cilium/Weave 지원

![NetworkPolicy — Ingress/Egress 제어](/assets/posts/k8s-network-policies-model.svg)

## 기본 차단(Default Deny) 패턴

가장 중요한 패턴은 **기본 차단**이다. 네임스페이스에 아래 두 정책을 함께 적용하면 모든 인바운드·아웃바운드 트래픽이 차단된다.

```yaml
# 1. 모든 Ingress 차단
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  # ingress 키 자체가 없음 → 차단

---
# 2. 모든 Egress 차단 (DNS 허용 포함)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-egress
  namespace: production
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - ports:
        - port: 53    # DNS는 항상 허용해야 이름 해석 가능
          protocol: UDP
        - port: 53
          protocol: TCP
```

## 특정 파드 허용

기본 차단 후 필요한 통신만 허용한다.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-backend
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - protocol: TCP
          port: 8080
```

`from` 배열에 여러 항목을 나열하면 **OR 조건**이다. 반면 같은 배열 항목 내에서 `podSelector`와 `namespaceSelector`를 함께 쓰면 **AND 조건**이다.

```yaml
ingress:
  - from:
      - podSelector:          # ← 이 두 셀렉터가 같은 "-" 항목 안에 있으면
          matchLabels:
            app: prometheus
        namespaceSelector:    # ← AND 조건 (monitoring 네임스페이스의 prometheus)
          matchLabels:
            ns: monitoring
      - podSelector:          # ← 새로운 "-" 항목 → OR 조건 (별도 허용)
          matchLabels:
            app: admin
```

![자주 쓰는 NetworkPolicy 패턴](/assets/posts/k8s-network-policies-patterns.svg)

## 네임스페이스 간 트래픽 제어

네임스페이스 셀렉터로 다른 네임스페이스의 파드를 허용할 수 있다.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-monitoring
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: monitoring
      ports:
        - port: 9090
          protocol: TCP
```

```bash
# 네임스페이스에 레이블 추가 (셀렉터 매칭용)
kubectl label namespace monitoring kubernetes.io/metadata.name=monitoring

# 1.21+: 쿠버네티스가 자동으로 metadata.name 레이블을 네임스페이스에 추가
kubectl get namespace monitoring --show-labels
```

## Egress 제어

데이터베이스 접근이나 외부 API 호출을 제한할 때 Egress 규칙을 사용한다.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-egress
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Egress
  egress:
    - to:
        - podSelector:
            matchLabels:
              app: database
      ports:
        - port: 5432
          protocol: TCP
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - port: 53
          protocol: UDP
```

## ipBlock으로 외부 CIDR 제어

쿠버네티스 클러스터 외부 IP 범위를 허용하거나 차단할 때 `ipBlock`을 사용한다.

```yaml
egress:
  - to:
      - ipBlock:
          cidr: 0.0.0.0/0
          except:
            - 10.0.0.0/8        # 내부 사설 대역 제외
            - 172.16.0.0/12
            - 192.168.0.0/16
    ports:
      - port: 443
        protocol: TCP
```

## 정책 디버깅

```bash
# 적용된 NetworkPolicy 확인
kubectl get networkpolicy -n production

# 특정 파드에 적용된 정책 확인 (Cilium)
cilium policy get

# Calico 규칙 확인
calicoctl get globalnetworkpolicy -o yaml

# 파드 간 통신 테스트
kubectl exec -it frontend-pod -- curl -v http://backend-svc:8080
kubectl exec -it other-pod -- curl -v http://backend-svc:8080  # 차단 확인
```

## 주의사항과 한계

NetworkPolicy는 강력하지만 몇 가지 한계가 있다.

- **노드 간 트래픽**: 노드 프로세스(kubelet, kube-proxy)에서 파드로의 트래픽은 NetworkPolicy로 제어되지 않는다
- **호스트 네트워크 파드**: `hostNetwork: true` 파드는 노드 IP를 사용해 NetworkPolicy 우회 가능
- **서비스 IP**: ClusterIP를 통한 트래픽은 파드 IP로 변환 후 NetworkPolicy 적용
- **로깅**: 기본적으로 차단된 트래픽 로그가 없다 (Cilium, Calico에서 별도 설정 필요)

고급 기능(L7 정책, DNS 이름 기반 규칙, 로깅)이 필요하면 Cilium의 `CiliumNetworkPolicy` 또는 Calico의 `GlobalNetworkPolicy`를 활용하자.

---

**지난 글:** [쿠버네티스 듀얼스택 네트워킹 — IPv4와 IPv6 동시 운영](/posts/k8s-dual-stack-networking/)

**다음 글:** [쿠버네티스 시크릿 관리 심화 — Vault, ESO, 암호화](/posts/k8s-secrets-management/)

<br>
읽어주셔서 감사합니다. 😊
