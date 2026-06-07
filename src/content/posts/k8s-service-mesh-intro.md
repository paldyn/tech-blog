---
title: "서비스 메시 입문 — Istio와 Linkerd로 마이크로서비스 네트워크 제어하기"
description: "서비스 메시가 해결하는 문제, Envoy 사이드카 패턴, Istio와 Linkerd의 구조와 핵심 기능을 예제 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 1
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "service-mesh", "istio", "linkerd", "envoy", "mtls", "sidecar"]
featured: false
draft: false
---

[지난 글](/posts/k8s-gateway-api/)에서 Gateway API로 클러스터 외부 트래픽을 라우팅하는 방법을 살펴봤다. 이번에는 클러스터 **내부** 서비스 간 통신을 제어하는 서비스 메시(Service Mesh)로 눈을 돌린다. 마이크로서비스 아키텍처가 복잡해질수록 트래픽 제어, 보안, 관찰 가능성을 각 서비스 코드에 직접 구현하는 방법은 한계에 부딪힌다. 서비스 메시는 이 문제를 **인프라 레이어**에서 해결한다.

## 서비스 메시가 필요한 이유

수십 개의 마이크로서비스가 서로 호출하는 환경에서는 공통적으로 반복되는 관심사(cross-cutting concerns)가 생긴다.

- **재시도 · 타임아웃**: 모든 서비스가 각자 구현하면 정책이 제각각이다
- **서킷 브레이커**: 연쇄 장애(cascade failure)를 막으려면 upstream 장애를 감지해야 한다
- **mTLS**: 서비스 간 통신을 암호화하려면 인증서 관리와 핸드셰이크 로직이 필요하다
- **분산 추적**: 요청이 여러 서비스를 거칠 때 전체 경로를 추적하려면 헤더 전파 코드가 필요하다

이 코드들을 Go, Java, Python 각 서비스에 중복 구현하는 대신, **서비스 옆에 붙는 프록시(사이드카)**에 위임하는 것이 서비스 메시의 핵심 아이디어다.

![서비스 메시 아키텍처](/assets/posts/k8s-service-mesh-intro-architecture.svg)

## 구조: Control Plane과 Data Plane

서비스 메시는 두 레이어로 나뉜다.

**Data Plane**: 각 Pod에 자동 주입된 Envoy Proxy가 모든 인바운드·아웃바운드 트래픽을 인터셉트한다. 애플리케이션은 localhost로 통신하는 것처럼 동작하지만 실제로는 프록시가 대신 처리한다.

**Control Plane**: 모든 Envoy 인스턴스에 라우팅 설정, 엔드포인트 목록, TLS 인증서를 배포한다. Istio에서는 `istiod`가 이 역할을 담당한다.

```yaml
# 네임스페이스에 사이드카 자동 주입 활성화 (Istio)
kubectl label namespace default istio-injection=enabled

# 주입 확인 - 파드당 컨테이너 2개 (app + istio-proxy)
kubectl get pod -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{range .spec.containers[*]}{.name}{","}{end}{"\n"}{end}'
```

## Envoy Proxy의 역할

Envoy는 Lyft에서 시작해 현재 CNCF 프로젝트로, 서비스 메시의 사실상 표준 데이터 플레인 구현체다.

- **xDS API**: Control Plane이 Envoy에게 설정을 동적으로 푸시하는 표준 API (LDS, RDS, CDS, EDS)
- **필터 체인**: L4/L7 필터로 mTLS 핸드셰이크, HTTP 헤더 조작, Rate Limiting 등을 처리
- **통계 수집**: 요청 수, 지연, 에러율을 Prometheus 형식으로 노출

```yaml
# Istio PeerAuthentication - 네임스페이스 내 mTLS 강제
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: default
spec:
  mtls:
    mode: STRICT   # PERMISSIVE(선택), STRICT(강제), DISABLE
```

## 트래픽 관리: VirtualService와 DestinationRule

Istio의 트래픽 관리는 두 CRD로 이루어진다.

```yaml
# VirtualService: 라우팅 규칙 (어디로 보낼지)
apiVersion: networking.istio.io/v1beta1
kind: VirtualService
metadata:
  name: reviews
spec:
  hosts:
    - reviews
  http:
    - match:
        - headers:
            end-user:
              exact: jason
      route:
        - destination:
            host: reviews
            subset: v2
    - route:
        - destination:
            host: reviews
            subset: v1
          weight: 90
        - destination:
            host: reviews
            subset: v2
          weight: 10
```

```yaml
# DestinationRule: 트래픽 정책 (어떻게 보낼지)
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: reviews
spec:
  host: reviews
  trafficPolicy:
    connectionPool:
      http:
        http1MaxPendingRequests: 100
        http2MaxRequests: 1000
    outlierDetection:          # Circuit Breaker
      consecutive5xxErrors: 5
      interval: 30s
      baseEjectionTime: 30s
  subsets:
    - name: v1
      labels:
        version: v1
    - name: v2
      labels:
        version: v2
```

![서비스 메시 핵심 기능](/assets/posts/k8s-service-mesh-intro-features.svg)

## Istio vs Linkerd

**Istio**는 기능이 풍부하지만 복잡도가 높다. 엔터프라이즈 환경에서 세밀한 트래픽 제어가 필요할 때 적합하다. `istiod`가 Control Plane을 담당하며, Envoy를 Data Plane으로 사용한다.

**Linkerd**는 가볍고 설치가 간단하다. Rust 기반의 자체 마이크로프록시를 사용해 리소스 사용량이 적다. 기본 기능(mTLS, 관찰 가능성, 로드 밸런싱)에 집중하고, 고급 트래픽 라우팅은 SMI(Service Mesh Interface)를 통해 지원한다.

```bash
# Linkerd 설치 예시
curl --proto '=https' --tlsv1.2 -sSfL https://run.linkerd.io/install | sh
linkerd check --pre
linkerd install --crds | kubectl apply -f -
linkerd install | kubectl apply -f -
linkerd check

# 네임스페이스에 메시 주입
kubectl annotate namespace default linkerd.io/inject=enabled
```

**Cilium Service Mesh**는 eBPF 기반으로 Envoy 사이드카 없이도 메시 기능을 제공하는 새로운 접근법이다. Sidecarless 아키텍처로 오버헤드가 적다.

## 서비스 메시 도입 시 고려사항

서비스 메시는 강력하지만 운영 복잡도를 높인다.

| 항목 | 고려사항 |
|---|---|
| 리소스 | 파드당 사이드카 컨테이너가 추가되어 메모리 ~50MB 증가 |
| 지연 | 프록시 홉이 추가되어 P99 지연이 약간 증가 (수ms 수준) |
| 학습 곡선 | CRD, xDS, RBAC 정책 등 새로운 개념 습득 필요 |
| 디버깅 | 트래픽 흐름 추적이 복잡해짐 (istioctl, linkerd CLI 활용) |

```bash
# Istio 트래픽 흐름 디버깅
istioctl analyze                              # 설정 문제 분석
istioctl proxy-status                         # 프록시 동기화 상태
istioctl proxy-config route <pod> --name 80  # 라우팅 설정 확인
```

서비스 수가 10개 이하인 소규모 시스템이라면 서비스 메시 대신 SDK 레벨 라이브러리(Resilience4j, go-micro 등)로도 충분하다. 50개 이상의 서비스가 상호 호출하는 환경이라면 서비스 메시의 중앙 집중식 정책 관리가 진가를 발휘한다.

---

**지난 글:** [Gateway API — 쿠버네티스 차세대 Ingress 표준](/posts/k8s-gateway-api/)

**다음 글:** [쿠버네티스 듀얼스택 네트워킹](/posts/k8s-dual-stack-networking/)

<br>
읽어주셔서 감사합니다. 😊
