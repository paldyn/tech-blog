---
title: "쿠버네티스 Service 기초"
description: "K8s Service의 역할(Pod IP 추상화, 로드밸런싱), ClusterIP·NodePort·LoadBalancer·ExternalName 타입 비교, selector 기반 라우팅, 내부 DNS 이름 체계를 실전 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 7
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "service", "clusterip", "nodeport", "loadbalancer", "네트워크"]
featured: false
draft: false
---

[지난 글](/posts/k8s-deployment-basics/)에서 Deployment로 Pod를 선언적으로 관리하는 방법을 다뤘다. Pod IP는 재시작할 때마다 바뀐다. 클라이언트가 변하는 IP를 직접 추적하는 것은 불가능하므로, K8s는 **Service**라는 안정적인 네트워크 진입점을 제공한다.

## Service = Pod IP 추상화

![서비스 트래픽 라우팅](/assets/posts/k8s-service-basics-routing.svg)

Service는 `selector`로 특정 레이블을 가진 Pod를 선택하고, 그 Pod들에게 트래픽을 분산한다. Pod가 교체되거나 스케일링되어도 Service IP(ClusterIP)는 변하지 않는다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: myapp-service
spec:
  selector:
    app: myapp       # 이 레이블을 가진 Pod를 선택
  ports:
  - protocol: TCP
    port: 80          # Service가 노출하는 포트
    targetPort: 8080  # Pod의 실제 포트
```

```bash
# Service 생성
kubectl apply -f service.yaml

# Service 확인
kubectl get service myapp-service
# NAME           TYPE        CLUSTER-IP     PORT(S)
# myapp-service  ClusterIP   10.96.100.50   80/TCP

# Endpoint(선택된 Pod IP 목록) 확인
kubectl get endpoints myapp-service
```

## Service 타입 4가지

![서비스 타입 비교](/assets/posts/k8s-service-basics-types.svg)

### ClusterIP (기본값)

클러스터 내부에서만 접근 가능한 가상 IP를 할당한다. 마이크로서비스 간 내부 통신에 사용한다.

```yaml
spec:
  type: ClusterIP     # 생략해도 기본값
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080
```

### NodePort

노드의 특정 포트(30000~32767)를 열어 외부에서 접근 가능하게 한다. 개발·테스트 환경에서 간편하게 사용하지만, 프로덕션에는 적합하지 않다.

```yaml
spec:
  type: NodePort
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080
    nodePort: 30080   # 생략하면 자동 할당
```

```bash
# 노드 IP 확인 후 접근
kubectl get nodes -o wide
curl http://NODE_IP:30080
```

### LoadBalancer

클라우드 프로바이더의 로드밸런서(AWS ALB/ELB, GCP LB)를 자동으로 프로비저닝한다. `EXTERNAL-IP`가 할당되어 인터넷에서 직접 접근 가능하다.

```yaml
spec:
  type: LoadBalancer
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080
```

```bash
kubectl get service myapp-service
# NAME           TYPE           CLUSTER-IP     EXTERNAL-IP      PORT(S)
# myapp-service  LoadBalancer   10.96.100.50   34.100.200.50   80:31234/TCP
```

### ExternalName

클러스터 내부에서 외부 서비스를 DNS 이름으로 추상화한다. CNAME 레코드를 반환하며, 외부 DB나 API를 내부 이름으로 접근할 때 유용하다.

```yaml
spec:
  type: ExternalName
  externalName: mydb.example.com
```

## 내부 DNS 이름 체계

K8s는 Service마다 내부 DNS 이름을 자동 생성한다.

```
{서비스명}.{네임스페이스}.svc.cluster.local
```

```bash
# 같은 네임스페이스: 서비스 이름만으로 접근
curl http://myapp-service

# 다른 네임스페이스: FQDN 사용
curl http://myapp-service.production.svc.cluster.local

# 내부에서 DNS 확인
kubectl exec -it debug-pod -- nslookup myapp-service
```

## Headless Service

ClusterIP를 할당하지 않고 DNS가 Pod IP 목록을 직접 반환하게 하는 패턴이다. StatefulSet과 함께 사용하여 특정 Pod에 직접 접근할 때 사용한다.

```yaml
spec:
  clusterIP: None    # Headless
  selector:
    app: mydb
```

```bash
# mydb-0.mydb-service.default.svc.cluster.local → Pod-0 IP
# mydb-1.mydb-service.default.svc.cluster.local → Pod-1 IP
```

## 실전 패턴: 앱 내부 서비스 구성

```yaml
# 내부용 API 서버
---
apiVersion: v1
kind: Service
metadata:
  name: api-service
spec:
  selector:
    app: api
  ports:
  - port: 8080
    targetPort: 8080

# 프론트엔드 (외부 노출)
---
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
spec:
  type: LoadBalancer
  selector:
    app: frontend
  ports:
  - port: 80
    targetPort: 3000
```

앱 내부 서비스는 ClusterIP로 두고, 외부 접근이 필요한 서비스에만 LoadBalancer 또는 (다음 편에서 다룰) Ingress를 사용하는 것이 표준 패턴이다.

---

**지난 글:** [쿠버네티스 Deployment 기초](/posts/k8s-deployment-basics/)

**다음 글:** [쿠버네티스 Ingress 기초](/posts/k8s-ingress-basics/)

<br>
읽어주셔서 감사합니다. 😊
