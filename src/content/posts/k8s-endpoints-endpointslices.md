---
title: "Endpoints와 EndpointSlice 완전 정복"
description: "K8s Endpoints 오브젝트의 역할, EndpointSlice가 등장한 이유(fanout 문제), 수동 Endpoints로 외부 서비스 연결하는 방법, kubectl 실전 명령어를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 6
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "endpoints", "endpointslice", "kube-proxy", "네트워크", "스케일링"]
featured: false
draft: false
---

[지난 글](/posts/k8s-service-types/)에서 Service 타입 4가지를 살펴봤다. Service는 Pod를 선택하지만, 실제로 어떤 Pod IP 목록이 관리되는지는 **Endpoints** 오브젝트가 담당한다. 이번 글에서는 Endpoints의 내부 동작과, 대규모 환경에서 등장한 **EndpointSlice**의 차이점을 깊게 파고든다.

## Endpoints란?

![Endpoints vs EndpointSlice 아키텍처](/assets/posts/k8s-endpoints-endpointslices-arch.svg)

Service가 생성되면 K8s 컨트롤러가 동일한 이름의 Endpoints 오브젝트를 자동으로 생성한다. Endpoints는 Service의 `selector`와 일치하는 Ready 상태 Pod의 IP:포트 목록을 저장한다. kube-proxy는 이 Endpoints를 watch하여 노드별 iptables/ipvs 규칙을 업데이트한다.

```bash
# Endpoints 확인
kubectl get endpoints myapp-svc
# NAME        ENDPOINTS                                          AGE
# myapp-svc   10.0.0.1:8080,10.0.0.2:8080,10.0.0.3:8080       5m

# 상세 정보
kubectl describe endpoints myapp-svc
# Subsets:
#   Addresses: 10.0.0.1, 10.0.0.2, 10.0.0.3
#   NotReadyAddresses: (none)
#   Ports: 8080/TCP
```

### 수동 Endpoints — 외부 서비스 연결

selector가 없는 Service와 수동 Endpoints를 조합하면 클러스터 외부 서비스(온프레미스 DB, 레거시 서버)를 K8s 내부 이름으로 참조할 수 있다.

```yaml
# 1. selector 없는 Service
apiVersion: v1
kind: Service
metadata:
  name: legacy-db
spec:
  ports:
  - port: 5432
    targetPort: 5432
  # selector 없음!
---
# 2. 수동 Endpoints
apiVersion: v1
kind: Endpoints
metadata:
  name: legacy-db   # Service 이름과 동일
subsets:
- addresses:
  - ip: 192.168.10.50   # 외부 서버 IP
  ports:
  - port: 5432
```

```bash
# 클러스터 내부에서 외부 DB 접근
# legacy-db.default.svc.cluster.local:5432 → 192.168.10.50:5432
psql -h legacy-db.default.svc.cluster.local -p 5432
```

## Endpoints의 한계 — fanout 문제

Pod가 수백 개로 늘어나면 문제가 발생한다. Endpoints는 **단일 오브젝트**에 모든 Pod IP를 저장하므로, Pod 1개가 변경될 때마다 전체 오브젝트를 모든 노드에 재전송해야 한다. 500개 Pod면 오브젝트 크기가 ~50KB에 달하고, 이를 모든 노드에 fanout하면 etcd와 네트워크 부하가 폭발적으로 증가한다.

## EndpointSlice — 샤딩으로 해결

![Endpoints vs EndpointSlice 스케일 비교](/assets/posts/k8s-endpoints-endpointslices-scale.svg)

K8s 1.21부터 GA가 된 EndpointSlice는 하나의 Service에 대해 **여러 개의 슬라이스 오브젝트**를 생성한다. 기본값으로 슬라이스당 최대 100개의 endpoint를 저장한다. Pod 1개가 변경되면 해당 슬라이스 오브젝트만 업데이트되므로 전파 비용이 대폭 줄어든다.

```bash
# EndpointSlice 조회
kubectl get endpointslices
# NAME                  ADDRESSTYPE   PORTS   ENDPOINTS   AGE
# myapp-svc-abcde       IPv4          8080    100         10m
# myapp-svc-fghij       IPv4          8080    100         10m
# myapp-svc-klmno       IPv4          8080    56          10m

# 상세 정보
kubectl describe endpointslice myapp-svc-abcde
# Endpoints:
#   - Addresses:  10.0.0.1
#     Conditions: ready=true
#     Topology:   kubernetes.io/hostname=node-1
```

### EndpointSlice 추가 기능

EndpointSlice는 Endpoints에 없던 메타데이터를 제공한다.

```yaml
# EndpointSlice 구조 예시
apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: myapp-svc-abcde
  labels:
    kubernetes.io/service-name: myapp-svc
addressType: IPv4
ports:
- name: http
  port: 8080
endpoints:
- addresses: ["10.0.0.1"]
  conditions:
    ready: true
    serving: true
    terminating: false
  topology:
    kubernetes.io/hostname: node-1
    topology.kubernetes.io/zone: us-east-1a
```

**`conditions`**: `ready`, `serving`, `terminating` 세 가지 상태 구분 — graceful termination 중인 Pod를 더 정교하게 처리 가능  
**`topology`**: 노드, 가용 영역 정보 포함 — 토폴로지 인식 라우팅(Topology Aware Routing)의 기반

## Endpoints vs EndpointSlice 비교 요약

| 항목 | Endpoints | EndpointSlice |
|---|---|---|
| 오브젝트당 endpoint 수 | 무제한 (문제) | 기본 100개 (조정 가능) |
| Pod 변경 전파 비용 | 전체 재전송 | 해당 슬라이스만 |
| IPv6/듀얼스택 지원 | 미지원 | 지원 |
| 추가 메타데이터 | 없음 | topology, conditions |
| GA 버전 | K8s 1.0+ | K8s 1.21+ |

K8s 1.21 이후 버전을 사용한다면 kube-proxy와 CoreDNS가 자동으로 EndpointSlice를 사용한다. 대부분의 경우 별도 설정 없이 혜택을 받을 수 있다.

---

[지난 글](/posts/k8s-service-types/) — 쿠버네티스 Service 타입 완전 정복  
다음 글: [헤드리스 서비스(Headless Service)](/posts/k8s-headless-service/)
