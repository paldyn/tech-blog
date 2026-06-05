---
title: "쿠버네티스 Ingress 컨트롤러 완전 정복"
description: "nginx-ingress, Traefik, Contour, HAProxy 등 K8s Ingress 컨트롤러의 동작 원리, 설치·설정 방법, TLS 처리, 다중 컨트롤러 운영까지 실전 기준으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 9
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "ingress", "nginx", "traefik", "tls", "load-balancer"]
featured: false
draft: false
---

[지난 글](/posts/k8s-ingress-basics/)에서 Ingress 리소스 자체의 구조와 기본 라우팅 규칙을 살펴봤다. 이번에는 그 Ingress 규칙을 실제로 처리하는 **Ingress 컨트롤러**에 집중한다. Ingress 리소스는 "이렇게 라우팅해 달라"는 선언일 뿐, 실행은 컨트롤러가 담당한다.

## Ingress 컨트롤러란

Ingress 컨트롤러는 Ingress 리소스를 watch하고, 설정을 자신의 프록시 엔진(Nginx, Envoy 등)에 반영해 실제 트래픽을 라우팅하는 Pod다. 클러스터에 기본 제공되지 않으므로 별도 설치가 필요하다.

![Ingress Controller 아키텍처](/assets/posts/k8s-ingress-controllers-arch.svg)

하나의 LoadBalancer Service로 외부 트래픽을 받아, Host/Path 기반으로 내부 Service들에 분산한다. Service마다 LoadBalancer를 만드는 것보다 비용이 훨씬 적다.

## nginx-ingress 설치 및 설정

가장 널리 사용되는 Kubernetes-managed nginx-ingress-controller를 Helm으로 설치한다.

```bash
# Helm으로 nginx-ingress 설치
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update

helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.replicaCount=2 \
  --set controller.service.type=LoadBalancer
```

설치 후 `kubectl get svc -n ingress-nginx`로 EXTERNAL-IP가 할당됐는지 확인한다. DNS 레코드를 이 IP로 설정하면 준비가 완료된다.

## Ingress 리소스 작성

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-ingress
  namespace: production
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.example.com
    secretName: tls-secret        # TLS 인증서 Secret
  rules:
  - host: api.example.com
    http:
      paths:
      - path: /v1
        pathType: Prefix
        backend:
          service:
            name: api-v1-svc
            port:
              number: 80
      - path: /v2
        pathType: Prefix
        backend:
          service:
            name: api-v2-svc
            port:
              number: 80
```

`ingressClassName: nginx`로 어느 컨트롤러가 이 Ingress를 처리할지 명시한다. 여러 컨트롤러를 운영할 때 필수다.

## TLS 인증서 설정

### cert-manager 자동 발급

프로덕션에서는 cert-manager + Let's Encrypt를 조합해 TLS 인증서를 자동으로 발급·갱신한다.

```yaml
# cert-manager ClusterIssuer
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
```

## 컨트롤러 비교

![Ingress Controller 비교](/assets/posts/k8s-ingress-controllers-compare.svg)

**nginx-ingress**는 가장 성숙하고 Annotation 수가 많아 복잡한 시나리오도 커버한다. **Traefik**은 자체 대시보드와 동적 재설정이 강점으로, 마이크로서비스 환경에 적합하다. **Contour**는 Envoy를 기반으로 고성능이 필요한 환경에 맞고, HTTPProxy CRD로 더 구조화된 설정을 제공한다.

## 다중 IngressClass 운영

네임스페이스별·팀별로 다른 컨트롤러를 사용하거나, 외부용/내부용을 분리할 수 있다.

```bash
# 두 번째 nginx-ingress 인스턴스 (내부용)
helm install ingress-nginx-internal ingress-nginx/ingress-nginx \
  --namespace ingress-nginx-internal \
  --set controller.ingressClassResource.name=nginx-internal \
  --set controller.service.type=ClusterIP  # 외부 노출 없음
```

---

**지난 글:** [쿠버네티스 Ingress 기초](/posts/k8s-ingress-basics/)

**다음 글:** [Gateway API — 차세대 Ingress](/posts/k8s-gateway-api/)

<br>
읽어주셔서 감사합니다. 😊
