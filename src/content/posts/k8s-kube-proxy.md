---
title: "kube-proxy: 쿠버네티스 네트워크 프록시"
description: "kube-proxy가 Service ClusterIP 트래픽을 파드로 라우팅하는 방법, iptables/IPVS/eBPF 모드의 차이, 실전 디버깅 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 10
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "kube-proxy", "iptables", "ipvs", "service", "networking"]
featured: false
draft: false
---

[지난 글](/posts/k8s-kubelet/)에서 kubelet이 파드를 실행하는 과정을 살펴봤다. 이번에는 K8s Service의 네트워크 라우팅을 담당하는 **kube-proxy**를 살펴본다. kube-proxy는 "왜 Service IP로 접속하면 파드에 도달하는가?"에 대한 답이다.

## kube-proxy의 역할

K8s Service를 생성하면 `ClusterIP`라는 가상 IP가 할당된다. 이 IP는 실제 어떤 네트워크 인터페이스에도 존재하지 않는다. **kube-proxy는 이 가상 IP로 들어오는 트래픽을 실제 파드 IP로 라우팅하는 규칙을 관리한다.**

kube-proxy는 **DaemonSet**으로 모든 노드에서 실행되며, API Server를 Watch해 Service와 Endpoints 변경을 감지하고 즉시 라우팅 규칙을 업데이트한다.

```bash
# kube-proxy DaemonSet 확인
kubectl -n kube-system get daemonset kube-proxy

# 각 노드의 kube-proxy 파드 상태
kubectl -n kube-system get pods -l k8s-app=kube-proxy -o wide

# kube-proxy 모드 확인
kubectl -n kube-system get configmap kube-proxy -o yaml | grep mode
```

## iptables 모드 동작 원리

![kube-proxy iptables 모드 동작](/assets/posts/k8s-kube-proxy-iptables.svg)

기본 모드인 iptables 모드의 동작을 따라가 보자.

```
① Client Pod → Service IP 10.96.0.100:8080 으로 패킷 전송

② 노드의 커널 netfilter가 패킷 가로챔
   iptables PREROUTING 체인 → KUBE-SERVICES 체인 → KUBE-SVC-xxxx 체인

③ KUBE-SVC 체인: 확률적으로 파드 중 하나 선택
   - Pod A (33%): DNAT → 10.244.0.5:8080
   - Pod B (33%): DNAT → 10.244.1.3:8080
   - Pod C (33%): DNAT → 10.244.2.7:8080

④ 선택된 파드 IP로 패킷 전달
```

```bash
# iptables 규칙 직접 확인 (노드에서 실행)
iptables -t nat -L KUBE-SERVICES -n | head -20
iptables -t nat -L | grep <service-name>

# 특정 서비스의 체인 확인
iptables -t nat -L KUBE-SVC-XXXXXXXX -n
```

## 세 가지 동작 모드

![kube-proxy 동작 모드 비교](/assets/posts/k8s-kube-proxy-modes.svg)

### iptables 모드 (기본값)

Linux 커널의 netfilter/iptables를 활용한다. 서비스 수가 많아질수록 iptables 규칙 수가 늘어나 O(n) 순차 매칭을 수행하므로 성능이 저하될 수 있다. 서비스 수백 개 이하의 소규모 클러스터에 적합하다.

### IPVS 모드

Linux 커널의 IPVS(IP Virtual Server)를 활용한다. 해시 테이블로 O(1) 룩업이 가능하고, Round Robin 외에 Least Connections, Destination Hashing 등 다양한 로드밸런싱 알고리즘을 지원한다. 서비스 수천 개 이상의 대규모 클러스터에 권장된다.

```bash
# IPVS 모드로 kube-proxy 설정 변경
kubectl -n kube-system edit configmap kube-proxy
# mode: "ipvs" 로 변경 후 kube-proxy 파드 재시작

# IPVS 규칙 확인 (노드에서 실행)
ipvsadm -ln | head -30
```

### eBPF 모드 (Cilium)

Cilium CNI를 설치하면 kube-proxy를 완전히 대체할 수 있다. iptables/IPVS를 우회해 커널에서 직접 eBPF 프로그램으로 패킷을 처리한다. 최고 성능과 풍부한 가시성(observability)을 제공하며, 클라우드 네이티브 클러스터의 차세대 표준으로 자리잡고 있다.

## Service 타입별 kube-proxy 동작

```yaml
# ClusterIP: 클러스터 내부 접근만 (기본)
apiVersion: v1
kind: Service
metadata:
  name: myapp-clusterip
spec:
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
---
# NodePort: 노드 IP + 고정 포트로 외부 접근 가능
apiVersion: v1
kind: Service
metadata:
  name: myapp-nodeport
spec:
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 8080
    nodePort: 30080  # 30000-32767 범위
  type: NodePort
```

NodePort 서비스를 만들면 kube-proxy는 모든 노드의 30080 포트로 들어오는 트래픽을 해당 서비스의 파드로 라우팅하는 iptables 규칙을 추가한다.

## kube-proxy 없이도 될까?

Cilium CNI를 kube-proxy replacement 모드로 설치하면 kube-proxy 없이도 Service 라우팅이 동작한다. 실제로 GKE Dataplane V2, EKS(Cilium 연동)에서 이 방식을 사용한다.

```bash
# Cilium으로 kube-proxy 대체 여부 확인
kubectl -n kube-system get pods -l k8s-app=cilium
cilium status | grep "KubeProxy replacement"
```

## 실전 디버깅

```bash
# 서비스 → Endpoints 매핑 확인
kubectl get endpoints myapp-service
# NAME           ENDPOINTS                        AGE
# myapp-service  10.244.0.5:8080,10.244.1.3:8080  5m

# 파드가 Endpoints에 없는 경우 (readinessProbe 실패 등)
kubectl describe endpoints myapp-service
kubectl describe pod <pod-name> | grep -A 10 Conditions

# 서비스 IP로 직접 curl 테스트 (다른 파드 내부에서)
kubectl exec -it debug-pod -- curl http://myapp-service:80/health

# iptables 규칙에서 서비스 확인 (노드에서 실행)
iptables -t nat -L -n | grep 10.96.0.100
```

K8s 네트워킹의 핵심을 이해했다. Service IP → 파드 IP 변환은 kube-proxy가 관리하는 iptables(또는 IPVS) 규칙이 처리한다. 파드 IP가 바뀌어도 kube-proxy가 Endpoints 변경을 즉시 감지해 규칙을 업데이트하므로, 서비스 이름으로 항상 안정적으로 접근할 수 있다.

---

**지난 글:** [kubelet: 노드의 핵심 에이전트](/posts/k8s-kubelet/)

<br>
읽어주셔서 감사합니다. 😊
