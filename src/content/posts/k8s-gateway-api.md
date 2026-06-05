---
title: "Gateway API — 차세대 Ingress"
description: "쿠버네티스 Gateway API의 탄생 배경, GatewayClass/Gateway/HTTPRoute 리소스 구조, 트래픽 가중치 분산, Ingress에서의 마이그레이션 방법을 실전 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 10
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "gateway-api", "httproute", "traffic-splitting", "ingress"]
featured: false
draft: false
---

[지난 글](/posts/k8s-ingress-controllers/)에서 nginx-ingress, Traefik 등 다양한 Ingress 컨트롤러를 비교했다. 이번에는 기존 Ingress의 한계를 극복하기 위해 설계된 **Gateway API**를 살펴본다. 2023년 v1.0 GA를 달성한 Gateway API는 K8s SIG Network의 공식 표준이며, Ingress를 대체할 차세대 네트워크 API다.

## 왜 Gateway API인가

기존 Ingress에는 다음과 같은 한계가 있었다.

**표현력 부족**: Host/Path 매칭만 표준 스펙. 헤더 기반 라우팅, 트래픽 가중치 분산은 컨트롤러별 Annotation으로 구현해야 하고, 이는 이식성이 없다.

**역할 분리 없음**: 인프라 설정(LB 타입, TLS)과 애플리케이션 라우팅이 하나의 Ingress 오브젝트에 혼재한다. 팀 간 책임 경계가 불명확하다.

**멀티 프로토콜 미지원**: HTTP/S만 표준화됐고 TCP, TLS SNI, gRPC는 컨트롤러 확장에 의존한다.

Gateway API는 이 문제를 **역할 기반 리소스 분리**와 **표준화된 표현력**으로 해결한다.

## 리소스 계층

![Gateway API 리소스 계층](/assets/posts/k8s-gateway-api-resources.svg)

Gateway API는 3계층 리소스로 구성된다.

**GatewayClass** — 인프라 관리자가 관리. 어떤 컨트롤러 구현체를 사용할지 정의한다.

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: nginx-gateway
spec:
  controllerName: gateway.nginx.org/nginx-gateway-controller
```

**Gateway** — 클러스터 운영자가 관리. 실제 L4/L7 로드밸런서 인스턴스를 선언한다. 포트, 프로토콜, TLS 설정을 담당한다.

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: prod-gateway
  namespace: infra
spec:
  gatewayClassName: nginx-gateway
  listeners:
  - name: https
    port: 443
    protocol: HTTPS
    tls:
      mode: Terminate
      certificateRefs:
      - name: prod-tls-secret
    allowedRoutes:
      namespaces:
        from: All        # 모든 네임스페이스의 Route 허용
```

**HTTPRoute** — 애플리케이션 개발자가 관리. HTTP/S 라우팅 규칙을 정의한다.

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: api-route
  namespace: production
spec:
  parentRefs:
  - name: prod-gateway
    namespace: infra
  hostnames:
  - api.example.com
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /v2
      headers:
      - name: X-Version
        value: v2
    backendRefs:
    - name: api-v2-svc
      port: 80
      weight: 90
    - name: api-v2-canary-svc
      port: 80
      weight: 10
```

## 트래픽 분산 (카나리 배포)

기존 Ingress에서 카나리 배포를 하려면 컨트롤러별 Annotation이 필요했다. Gateway API에서는 `weight` 필드로 표준화됐다.

```yaml
# 트래픽 90/10 분산 — Annotation 없이 표준 YAML로
rules:
- backendRefs:
  - name: my-app-stable
    port: 80
    weight: 90    # 90% 트래픽
  - name: my-app-canary
    port: 80
    weight: 10    # 10% 트래픽
```

## Ingress vs Gateway API

![Gateway API vs Ingress 비교](/assets/posts/k8s-gateway-api-vs-ingress.svg)

## Ingress에서 마이그레이션

기존 Ingress 리소스를 즉시 제거할 필요는 없다. Gateway API를 점진적으로 도입할 수 있다.

```bash
# Gateway API CRD 설치
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.2.0/standard-install.yaml

# 지원 컨트롤러 확인 (nginx-gateway-fabric, envoy-gateway 등)
kubectl get gatewayclass
```

신규 서비스는 HTTPRoute로 시작하고, 기존 서비스는 Ingress를 유지하면서 점차 이전한다. 동일 클러스터에서 Ingress와 Gateway API를 동시 운영할 수 있다.

---

**지난 글:** [쿠버네티스 Ingress 컨트롤러](/posts/k8s-ingress-controllers/)

<br>
읽어주셔서 감사합니다. 😊
