---
title: "쿠버네티스 Service 타입 완전 정복"
description: "ClusterIP, NodePort, LoadBalancer, ExternalName — 쿠버네티스 4가지 Service 타입의 동작 원리, 사용 사례, YAML 예시를 깊이 있게 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 5
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "service", "clusterip", "nodeport", "loadbalancer", "networking"]
featured: false
draft: false
---

[지난 글](/posts/k8s-service-basics/)에서 Service가 안정적인 IP와 DNS를 통해 Pod에 트래픽을 전달하는 원리를 살펴봤다. K8s Service에는 4가지 타입이 있으며, 어떤 타입을 선택하느냐에 따라 트래픽 접근 범위와 방식이 완전히 달라진다.

## Service 타입 한눈에 보기

![쿠버네티스 Service 타입 개요](/assets/posts/k8s-service-types-overview.svg)

K8s Service의 기본 타입은 `ClusterIP`이며, 각 타입은 이전 타입을 확장하는 구조다.

| 타입 | 접근 범위 | 주요 사용 목적 |
|---|---|---|
| ClusterIP | 클러스터 내부 전용 | 마이크로서비스 간 통신 |
| NodePort | 노드 IP + 고정 포트 | 개발·테스트 외부 접근 |
| LoadBalancer | 클라우드 LB IP | 프로덕션 외부 노출 |
| ExternalName | 외부 DNS 별칭 | 외부 서비스 추상화 |

## ClusterIP

가장 기본적인 타입. 클러스터 내부에서만 접근 가능한 가상 IP(VIP)를 생성한다. `spec.type`을 명시하지 않으면 기본값이 ClusterIP다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-svc
spec:
  selector:
    app: my-app
  ports:
  - port: 80        # Service가 노출하는 포트
    targetPort: 8080  # Pod의 실제 컨테이너 포트
  # type: ClusterIP  # 기본값이므로 생략 가능
```

kube-proxy는 이 ClusterIP로 들어오는 패킷을 iptables/IPVS 규칙으로 실제 Pod IP로 DNAT(목적지 NAT)한다. Pod가 재시작돼 IP가 바뀌어도 ClusterIP는 변하지 않는다.

## NodePort

모든 노드에 고정 포트(기본 30000-32767)를 열어 외부 트래픽을 받는다. `<노드IP>:<NodePort>`로 접근하면 kube-proxy가 해당 Service의 Pod들로 분산한다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-nodeport-svc
spec:
  type: NodePort
  selector:
    app: my-app
  ports:
  - port: 80          # ClusterIP 포트 (내부용)
    targetPort: 8080  # Pod 컨테이너 포트
    nodePort: 30080   # 노드에서 열리는 외부 포트 (30000-32767)
```

**주의점**: 모든 노드 IP가 노출되며, 사용자는 어느 노드 IP로든 접근할 수 있다. 노드 장애 시 해당 노드 IP로의 접근은 실패한다. 프로덕션보다는 개발·테스트 환경에 적합하다.

## LoadBalancer

클라우드 프로바이더(AWS, GCP, Azure)의 L4 로드밸런서를 자동으로 프로비저닝하고, 고정된 외부 IP를 발급받는다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-lb-svc
spec:
  type: LoadBalancer
  selector:
    app: my-app
  ports:
  - port: 443
    targetPort: 8443
    protocol: TCP
```

![NodePort vs LoadBalancer 트래픽 흐름](/assets/posts/k8s-service-types-nodeport.svg)

`kubectl get svc` 실행 시 `EXTERNAL-IP` 컬럼에 클라우드 LB IP가 표시된다. 내부적으로는 NodePort도 함께 생성된다(`LoadBalancer → NodePort → ClusterIP` 계층 구조).

**비용 고려**: 클라우드 LB는 Service 1개당 별도 비용이 발생한다. HTTP/HTTPS 라우팅이 필요하다면 Ingress(하나의 LB로 여러 서비스 라우팅)를 사용하는 것이 더 경제적이다.

## ExternalName

클러스터 외부의 DNS 이름에 대한 CNAME 별칭을 생성한다. 실제 프록시나 포워딩 없이 순수 DNS CNAME 레코드다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-db
  namespace: production
spec:
  type: ExternalName
  externalName: prod-db.company.internal  # 외부 DNS 이름
```

`external-db.production.svc.cluster.local`을 조회하면 CoreDNS가 `prod-db.company.internal`로 CNAME을 반환한다. 외부 데이터베이스나 레거시 서비스를 K8s 내부 이름으로 추상화할 때 유용하다.

## 타입 선택 가이드

```text
마이크로서비스 간 내부 통신  →  ClusterIP (기본)
개발 환경 임시 외부 접근      →  NodePort
클라우드 L4 로드밸런싱       →  LoadBalancer
HTTP/S 기반 멀티 서비스 노출  →  Ingress (내부는 ClusterIP)
외부 DNS 서비스 추상화        →  ExternalName
```

---

**지난 글:** [쿠버네티스 Service 기초](/posts/k8s-service-basics/)

**다음 글:** [Endpoints와 EndpointSlice](/posts/k8s-endpoints-endpointslices/)

<br>
읽어주셔서 감사합니다. 😊
