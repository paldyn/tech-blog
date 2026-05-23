---
title: "쿠버네티스 Ingress 기초"
description: "K8s Ingress의 역할(L7 HTTP 라우팅), Ingress Controller 선택(nginx/traefik), host·path 기반 규칙 작성, TLS 설정, 주요 어노테이션을 실전 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 8
type: "knowledge"
category: "Docker"
tags: ["kubernetes", "k8s", "ingress", "nginx", "tls", "routing", "네트워크"]
featured: false
draft: false
---

[지난 글](/posts/k8s-service-basics/)에서 K8s Service의 4가지 타입을 다뤘다. 여러 서비스를 외부에 노출할 때 각각 LoadBalancer를 만들면 클라우드 비용이 서비스 수만큼 늘어난다. **Ingress**는 하나의 진입점에서 도메인과 경로 기반으로 여러 Service로 라우팅하여 이 문제를 해결한다.

## Ingress = L7 라우팅 레이어

![인그레스 트래픽 흐름](/assets/posts/k8s-ingress-basics-flow.svg)

Ingress는 두 가지 구성 요소로 작동한다.

- **Ingress 리소스**: 라우팅 규칙을 정의한 YAML 선언
- **Ingress Controller**: 규칙을 실제로 처리하는 프록시 서버 (nginx, traefik, haproxy 등)

Controller를 먼저 설치해야 Ingress 리소스가 작동한다.

```bash
# nginx Ingress Controller 설치 (Helm)
helm upgrade --install ingress-nginx ingress-nginx \
  --repo https://kubernetes.github.io/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace

# Controller Pod 확인
kubectl get pods -n ingress-nginx
```

## 기본 Ingress 규칙

![인그레스 규칙 구조](/assets/posts/k8s-ingress-basics-rules.svg)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: myapp-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  ingressClassName: nginx
  rules:
  - host: example.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 8080

      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 3000
```

`pathType` 값:
- `Exact`: `/api`만 매칭, `/api/v1`은 매칭 안 됨
- `Prefix`: `/api`로 시작하는 모든 경로 매칭
- `ImplementationSpecific`: Controller 구현에 위임

```bash
# Ingress 상태 확인
kubectl get ingress myapp-ingress
# NAME            CLASS   HOSTS         ADDRESS         PORTS
# myapp-ingress   nginx   example.com   34.100.200.50   80, 443
```

## 호스트 기반 라우팅

같은 IP로 도메인에 따라 다른 서비스로 라우팅할 수 있다.

```yaml
spec:
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 8080

  - host: admin.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: admin-service
            port:
              number: 9000
```

## TLS 설정

```yaml
spec:
  tls:
  - hosts:
    - example.com
    secretName: example-tls    # TLS 인증서가 담긴 Secret

  rules:
  - host: example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend-service
            port:
              number: 3000
```

```bash
# TLS Secret 직접 생성
kubectl create secret tls example-tls \
  --cert=path/to/cert.pem \
  --key=path/to/key.pem

# cert-manager로 Let's Encrypt 인증서 자동 발급 (권장)
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/latest/download/cert-manager.yaml
```

## 주요 nginx 어노테이션

```yaml
metadata:
  annotations:
    # HTTP → HTTPS 강제 리다이렉트
    nginx.ingress.kubernetes.io/ssl-redirect: "true"

    # 요청 본문 크기 제한 (파일 업로드)
    nginx.ingress.kubernetes.io/proxy-body-size: "50m"

    # 연결 타임아웃 설정
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "60"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"

    # 속도 제한 (IP당 10r/s)
    nginx.ingress.kubernetes.io/limit-rps: "10"

    # 기본 인증
    nginx.ingress.kubernetes.io/auth-type: basic
    nginx.ingress.kubernetes.io/auth-secret: basic-auth

    # CORS 허용
    nginx.ingress.kubernetes.io/enable-cors: "true"
    nginx.ingress.kubernetes.io/cors-allow-origin: "https://app.example.com"
```

## Ingress vs LoadBalancer 언제 무엇을?

| 상황 | 권장 |
|---|---|
| 단일 서비스 외부 노출 | LoadBalancer |
| 여러 서비스, 경로 기반 라우팅 | Ingress |
| 도메인·서브도메인 기반 분기 | Ingress |
| gRPC, TCP/UDP 라우팅 | LoadBalancer 또는 별도 처리 |
| 쿠버네티스 없는 환경 | 일반 nginx/traefik 직접 운용 |

Ingress Controller 자체는 `LoadBalancer` 타입 Service로 외부 IP를 받아 단일 진입점 역할을 한다. 실제 클라우드 LB는 1개만 사용하면서 그 뒤에서 여러 Service로 분기한다.

---

**지난 글:** [쿠버네티스 Service 기초](/posts/k8s-service-basics/)

**다음 글:** [ConfigMap과 Secret으로 설정 분리하기](/posts/k8s-configmap-secret/)

<br>
읽어주셔서 감사합니다. 😊
