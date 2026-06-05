---
title: "Gateway API — 쿠버네티스 차세대 Ingress 표준"
description: "Gateway API의 도입 배경, GatewayClass·Gateway·HTTPRoute 리소스, 트래픽 분산과 헤더 기반 라우팅, Ingress에서 Gateway API로 마이그레이션 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 10
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "Gateway API", "HTTPRoute", "GatewayClass", "Ingress", "트래픽 분산", "네트워크"]
featured: false
draft: false
---

[지난 글](/posts/k8s-ingress-controllers/)에서 nginx-ingress, Traefik, Contour 등 다양한 Ingress 컨트롤러를 비교했습니다. Ingress는 수년간 쿠버네티스 L7 라우팅의 표준이었지만, Annotation에 의존하는 비표준 확장과 단일 리소스에 모든 설정이 집중되는 구조적 한계가 있었습니다. **Gateway API**는 이 문제를 해결하기 위해 CNCF SIG Network에서 설계한 차세대 표준입니다.

## Gateway API 등장 배경

Ingress의 핵심 한계는 다음 세 가지입니다.

1. **이식성 없는 Annotation**: `nginx.ingress.kubernetes.io/canary-weight` 같은 컨트롤러 고유 Annotation은 컨트롤러를 교체하면 전부 다시 작성해야 합니다.
2. **역할 분리 불가**: 인프라 관리자가 제어해야 할 LB 설정과 앱 개발자가 정의할 라우팅 규칙이 하나의 Ingress 리소스에 뒤섞입니다.
3. **표현력 부족**: L4 TCP 라우팅, 헤더 기반 라우팅, 트래픽 분산 등을 공식 스펙으로 표현할 수 없습니다.

Gateway API v1.0은 2023년 10월 GA(Generally Available)로 출시되어 이 문제들을 해결합니다.

---

## 리소스 계층 구조

![Gateway API 리소스 계층 구조](/assets/posts/k8s-gateway-api-resources.svg)

Gateway API는 세 계층의 리소스로 역할을 명확히 분리합니다.

### GatewayClass

클러스터 범위(Cluster-scoped) 리소스로, Ingress의 `IngressClass`에 해당합니다. 어떤 컨트롤러 구현체를 사용할지 선언합니다.

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: GatewayClass
metadata:
  name: nginx-gateway
spec:
  controllerName: gateway.nginx.org/nginx-gateway-controller
  description: "NGINX Gateway Fabric"
```

### Gateway

네임스페이스 범위 리소스로, 실제 로드밸런서 또는 프록시 인스턴스를 프로비저닝합니다. 클러스터 운영자가 관리합니다.

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: prod-gateway
  namespace: infra
spec:
  gatewayClassName: nginx-gateway
  listeners:
    - name: http
      port: 80
      protocol: HTTP
    - name: https
      port: 443
      protocol: HTTPS
      tls:
        mode: Terminate
        certificateRefs:
          - name: myapp-tls
      allowedRoutes:
        namespaces:
          from: All   # 모든 네임스페이스의 Route 허용
```

### HTTPRoute

앱 개발자가 직접 관리하는 라우팅 규칙입니다. 여러 네임스페이스의 Route가 하나의 Gateway에 연결될 수 있습니다.

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
    - "myapp.com"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /api
      backendRefs:
        - name: api-service
          port: 8080
```

---

## Gateway API vs Ingress 비교

![Gateway API vs Ingress 비교](/assets/posts/k8s-gateway-api-vs-ingress.svg)

---

## 트래픽 분산 (가중치 라우팅)

Gateway API는 HTTPRoute 스펙에 `weight`를 내장해, 카나리 배포를 컨트롤러 독립적으로 선언할 수 있습니다.

```yaml
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: canary-route
spec:
  parentRefs:
    - name: prod-gateway
      namespace: infra
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: production-svc
          port: 80
          weight: 90      # 90% 트래픽
        - name: canary-svc
          port: 80
          weight: 10      # 10% 트래픽
```

---

## 헤더 기반 라우팅

특정 헤더값에 따라 다른 백엔드로 라우팅합니다. A/B 테스트나 API 버전 분기에 유용합니다.

```yaml
rules:
  - matches:
      - headers:
          - name: X-API-Version
            value: v2
            type: Exact
    backendRefs:
      - name: api-v2-svc
        port: 8080
  - matches:
      - headers:
          - name: X-API-Version
            value: v1
    backendRefs:
      - name: api-v1-svc
        port: 8080
```

---

## 설치 및 구현체

Gateway API 자체는 CRD 스펙이며, 구현체(컨트롤러)를 별도로 설치해야 합니다.

```bash
# Gateway API CRD 설치 (표준 채널)
kubectl apply -f https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.2.0/standard-install.yaml

# 구현체 예시: NGINX Gateway Fabric
helm install ngf oci://ghcr.io/nginxinc/charts/nginx-gateway-fabric \
  --namespace nginx-gateway --create-namespace

# 또는 Envoy Gateway
helm install eg oci://docker.io/envoyproxy/gateway-helm \
  --namespace envoy-gateway-system --create-namespace
```

주요 구현체: NGINX Gateway Fabric, Envoy Gateway, Istio, Traefik, Contour, Kong, Cilium

---

## Ingress에서 Gateway API로 마이그레이션

기존 Ingress 설정을 Gateway API로 점진적으로 전환하는 방법입니다.

```bash
# 1단계: Gateway API CRD 및 컨트롤러 설치
kubectl apply -f standard-install.yaml

# 2단계: GatewayClass, Gateway 생성 (인프라 팀)
kubectl apply -f gateway-class.yaml
kubectl apply -f gateway.yaml

# 3단계: Ingress와 병행 운영하며 HTTPRoute 점진적 전환
# Ingress 리소스는 기존대로 유지하고
# 새 서비스부터 HTTPRoute로 신규 생성

# 4단계: 트래픽 전환 완료 후 Ingress 리소스 제거
kubectl delete ingress old-ingress
```

---

## 언제 Gateway API로 전환해야 하나?

| 상황 | 권장 |
|---|---|
| 단순 L7 HTTP 라우팅만 필요 | Ingress 계속 사용 |
| 가중치 라우팅/카나리 배포 필요 | Gateway API 도입 |
| 헤더/쿼리 기반 라우팅 | Gateway API 도입 |
| 멀티팀 클러스터, 역할 분리 필요 | Gateway API 도입 |
| TCP/gRPC 라우팅 필요 | Gateway API (TCPRoute/GRPCRoute) |
| 새 프로젝트 시작 | Gateway API 권장 |

---

**지난 글:** [쿠버네티스 Ingress 컨트롤러](/posts/k8s-ingress-controllers/)
<br>
읽어주셔서 감사합니다. 😊
