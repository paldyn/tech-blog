---
title: "헤드리스 서비스(Headless Service) 완전 정복"
description: "clusterIP: None 설정으로 만드는 Headless Service의 DNS 동작 원리, StatefulSet과의 연동 패턴, 클라이언트 사이드 로드밸런싱 활용법을 실전 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-06"
archiveOrder: 7
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "headless-service", "statefulset", "dns", "coredns", "네트워크"]
featured: false
draft: false
---

[지난 글](/posts/k8s-endpoints-endpointslices/)에서 Endpoints와 EndpointSlice의 내부 동작을 살펴봤다. 일반 Service는 ClusterIP(가상 IP)를 할당하고 kube-proxy가 부하 분산을 처리한다. 하지만 StatefulSet처럼 **각 Pod에 직접 연결**해야 하는 상황에서는 Headless Service가 필요하다.

## Headless Service란?

`spec.clusterIP: None`으로 설정하면 ClusterIP가 할당되지 않는 Headless Service가 된다. kube-proxy가 이 Service에 대한 iptables 규칙을 생성하지 않으므로, 트래픽이 가상 IP를 거치지 않고 Pod에 직접 전달된다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp-headless
  namespace: default
spec:
  clusterIP: None   # 핵심! 이것이 Headless를 만든다
  selector:
    app: myapp
  ports:
  - port: 8080
    targetPort: 8080
```

```bash
# 생성 후 확인
kubectl get svc myapp-headless
# NAME              TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)
# myapp-headless    ClusterIP   None         <none>        8080/TCP

# DNS 조회 — Pod IP 목록 반환
kubectl run dns-test --image=busybox --rm -it --restart=Never -- \
  nslookup myapp-headless.default.svc.cluster.local
# Name:  myapp-headless.default.svc.cluster.local
# Address 1: 10.0.0.1 myapp-0.myapp-headless.default.svc.cluster.local
# Address 2: 10.0.0.2 myapp-1.myapp-headless.default.svc.cluster.local
# Address 3: 10.0.0.3 myapp-2.myapp-headless.default.svc.cluster.local
```

## DNS 동작 차이

![Headless Service DNS 동작 비교](/assets/posts/k8s-headless-service-dns.svg)

일반 Service는 DNS 쿼리에 대해 단일 ClusterIP(VIP)를 반환한다. kube-proxy가 이 VIP로 들어오는 트래픽을 각 Pod로 분산한다. 반면 Headless Service는 DNS 쿼리에 대해 **Pod IP 목록(A 레코드 다수)**을 직접 반환한다. 클라이언트가 여러 IP 중 하나를 선택해 직접 연결하므로 **클라이언트 사이드 로드밸런싱**이 된다.

| 항목 | 일반 Service | Headless Service |
|---|---|---|
| DNS 응답 | ClusterIP 1개 (A 레코드) | Pod IP 목록 (A 레코드 다수) |
| kube-proxy | 관여 (iptables 규칙) | 관여 안 함 |
| 부하 분산 주체 | kube-proxy | 클라이언트 |
| 특정 Pod 직접 접근 | 불가 | 가능 |

## StatefulSet + Headless Service 패턴

![StatefulSet + Headless Service 패턴](/assets/posts/k8s-headless-service-statefulset.svg)

StatefulSet의 각 Pod는 **예측 가능한 이름**(pod-0, pod-1, pod-2)을 갖는다. Headless Service와 결합하면 각 Pod에 안정적인 DNS 이름이 부여된다. Pod가 재시작되어 IP가 바뀌어도 DNS 이름은 유지된다.

```yaml
# StatefulSet + Headless Service 완전 예제
apiVersion: v1
kind: Service
metadata:
  name: mysql-headless
spec:
  clusterIP: None
  selector:
    app: mysql
  ports:
  - port: 3306
    targetPort: 3306
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mysql
spec:
  serviceName: "mysql-headless"   # Headless Service 이름
  replicas: 3
  selector:
    matchLabels:
      app: mysql
  template:
    metadata:
      labels:
        app: mysql
    spec:
      containers:
      - name: mysql
        image: mysql:8.0
        env:
        - name: MYSQL_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: mysql-secret
              key: password
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi
```

```bash
# 생성된 Pod의 DNS 이름 확인
# mysql-0.mysql-headless.default.svc.cluster.local
# mysql-1.mysql-headless.default.svc.cluster.local
# mysql-2.mysql-headless.default.svc.cluster.local

# Primary에만 쓰기 (mysql-0)
mysql -h mysql-0.mysql-headless.default.svc.cluster.local -u root -p

# 모든 Replica 읽기 (DNS 라운드로빈)
mysql -h mysql-headless.default.svc.cluster.local -u reader -p
```

## 클라이언트 사이드 로드밸런싱 활용

gRPC처럼 HTTP/2 기반 프로토콜은 연결을 재사용하므로 kube-proxy의 일반 로드밸런싱이 잘 동작하지 않는다. Headless Service를 사용해 클라이언트가 모든 Pod에 각각 연결을 맺으면 진정한 부하 분산이 가능하다.

```yaml
# gRPC 서비스를 위한 Headless Service
apiVersion: v1
kind: Service
metadata:
  name: grpc-backend-headless
spec:
  clusterIP: None
  selector:
    app: grpc-backend
  ports:
  - port: 50051
    targetPort: 50051
    protocol: TCP
```

```bash
# grpc_health_probe로 각 Pod 개별 확인
for i in 0 1 2; do
  grpc_health_probe -addr=grpc-backend-$i.grpc-backend-headless:50051
done
```

## selector 없는 Headless Service

`selector`를 생략하면 CoreDNS가 Endpoints에서 IP를 조회한다. 수동으로 Endpoints를 관리할 때 사용한다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: external-cache-headless
spec:
  clusterIP: None
  # selector 없음
  ports:
  - port: 6379
```

```bash
# CoreDNS가 반환하는 IP 확인
dig myapp-headless.default.svc.cluster.local

# A 레코드 TTL 확인 (기본 5초)
# ;; ANSWER SECTION:
# myapp-headless.default.svc.cluster.local. 5 IN A 10.0.0.1
# myapp-headless.default.svc.cluster.local. 5 IN A 10.0.0.2
```

DNS TTL이 5초이므로 Pod 변경 후 최대 5초 내에 클라이언트가 새 IP를 인식한다. 클라이언트 DNS 캐시 설정에 주의해야 한다.

---

[지난 글](/posts/k8s-endpoints-endpointslices/) — Endpoints와 EndpointSlice  
다음 글: [CoreDNS와 쿠버네티스 DNS](/posts/k8s-dns-coredns/)
