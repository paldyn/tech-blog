---
title: "쿠버네티스 듀얼스택 네트워킹 — IPv4와 IPv6 동시 운영"
description: "쿠버네티스 듀얼스택(Dual-Stack) 네트워킹의 개념, 클러스터 설정 방법, Service ipFamilyPolicy, 마이그레이션 전략을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-08"
archiveOrder: 2
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "networking", "dual-stack", "ipv4", "ipv6", "service", "cni"]
featured: false
draft: false
---

[지난 글](/posts/k8s-service-mesh-intro/)에서 서비스 메시로 클러스터 내부 트래픽을 제어하는 방법을 알아봤다. 이번에는 네트워크 주소 체계 자체에 관한 주제인 **듀얼스택(Dual-Stack) 네트워킹**을 다룬다. IPv4 주소 고갈 문제가 현실화되면서, 많은 기업 환경과 클라우드 프로바이더가 IPv6를 도입하고 있다. 쿠버네티스는 1.21 버전부터 듀얼스택을 안정(Stable)으로 지원한다.

## 듀얼스택이 필요한 이유

IPv4 주소는 약 43억 개로 이미 전 세계적으로 고갈 상태다. NAT(Network Address Translation)으로 연명하고 있지만, 클라우드 네이티브 환경에서 파드 수만 개가 생성되면 내부 IPv4 풀도 금방 소진된다. IPv6는 128비트 주소 체계로 사실상 무한한 주소 공간을 제공하며, NAT 없이 엔드-투-엔드 통신이 가능하다.

듀얼스택 클러스터는 IPv4와 IPv6를 동시에 운영하며 기존 IPv4 시스템과의 호환성을 유지하면서 IPv6로 점진적으로 전환할 수 있게 해준다.

![쿠버네티스 듀얼스택 네트워킹](/assets/posts/k8s-dual-stack-overview.svg)

## 클러스터 듀얼스택 설정

듀얼스택은 세 레이어에서 모두 설정해야 한다: kube-apiserver, kube-controller-manager, kube-proxy(또는 CNI).

```bash
# kubeadm으로 듀얼스택 클러스터 초기화
cat > kubeadm-config.yaml <<EOF
apiVersion: kubeadm.k8s.io/v1beta3
kind: ClusterConfiguration
networking:
  podSubnet: "10.244.0.0/16,fd00:10:244::/48"
  serviceSubnet: "10.96.0.0/12,fd00:10:96::/108"
---
apiVersion: kubeadm.k8s.io/v1beta3
kind: InitConfiguration
localAPIEndpoint:
  advertiseAddress: "192.168.1.100"
EOF

kubeadm init --config=kubeadm-config.yaml
```

CNI도 듀얼스택을 지원해야 한다. Calico, Cilium, Weave Net이 듀얼스택을 지원하며, 각자 설정 방식이 다르다.

```yaml
# Calico 듀얼스택 설정 (일부)
apiVersion: operator.tigera.io/v1
kind: Installation
metadata:
  name: default
spec:
  calicoNetwork:
    ipPools:
      - cidr: 10.244.0.0/16
        encapsulation: VXLANCrossSubnet
      - cidr: fd00:10:244::/48
        encapsulation: None
```

## Pod의 듀얼스택 IP

듀얼스택이 활성화된 클러스터에서 파드는 두 IP 주소를 갖는다.

```bash
# 파드의 IP 주소 확인
kubectl get pod my-pod -o jsonpath='{.status.podIPs}'
# → [{"ip":"10.244.0.5"},{"ip":"fd00::5"}]

# 상세 확인
kubectl describe pod my-pod | grep -A3 "IP:"
# IP:           10.244.0.5
# IPs:
#   IP:  10.244.0.5
#   IP:  fd00::5
```

파드 내에서는 `ip addr show eth0`으로 두 주소 모두 확인할 수 있다. 컨테이너는 IPv4와 IPv6 모두로 수신 대기(listen)할 수 있다.

## Service의 ipFamilyPolicy

Service는 `ipFamilyPolicy` 필드로 주소 체계를 제어한다.

![Service ipFamilyPolicy 비교](/assets/posts/k8s-dual-stack-service.svg)

```yaml
# 듀얼스택 Service 예시
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    app: my-app
  ports:
    - port: 80
      targetPort: 8080
  ipFamilyPolicy: PreferDualStack
  ipFamilies:
    - IPv4
    - IPv6
  type: ClusterIP
```

```bash
# Service ClusterIP 확인
kubectl get svc my-service -o jsonpath='{.spec.clusterIPs}'
# → ["10.96.0.100","fd00:10:96::64"]

kubectl get svc my-service -o wide
# NAME         TYPE        CLUSTER-IP    ...
# my-service   ClusterIP   10.96.0.100   ...
# (두 번째 ClusterIP는 -o yaml로 확인)
```

## 노드 네트워크와 podCIDR

각 노드는 IPv4와 IPv6 CIDR 블록을 함께 할당받는다.

```bash
# 노드 CIDR 확인
kubectl get nodes -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.podCIDRs}{"\n"}{end}'
# node1  ["10.244.0.0/24","fd00:10:244::/64"]
# node2  ["10.244.1.0/24","fd00:10:244:1::/64"]

# kube-proxy 듀얼스택 설정 확인
kubectl get configmap kube-proxy -n kube-system -o jsonpath='{.data.config\.conf}' | grep -A5 "clusterCIDR"
```

## LoadBalancer 듀얼스택

클라우드 환경에서 LoadBalancer 타입 Service를 듀얼스택으로 설정하면, 클라우드 LB가 두 스택을 처리한다.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-lb
  annotations:
    # AWS NLB 듀얼스택 예시
    service.beta.kubernetes.io/aws-load-balancer-ip-address-type: dualstack
spec:
  type: LoadBalancer
  ipFamilyPolicy: RequireDualStack
  ipFamilies:
    - IPv4
    - IPv6
  ports:
    - port: 443
      targetPort: 8443
```

## 마이그레이션 전략

기존 Single-Stack 클러스터를 듀얼스택으로 전환하는 과정은 신중해야 한다. 특히 kube-proxy 모드(iptables/ipvs)와 CNI 설정을 함께 업데이트해야 한다.

1. **CNI 업그레이드**: 듀얼스택 지원 버전으로 업그레이드
2. **kube-apiserver/controller-manager 재기동**: 새 CIDR 설정 적용
3. **노드 롤링 재시작**: 기존 노드에 IPv6 CIDR 추가
4. **기존 서비스 마이그레이션**: `ipFamilyPolicy: PreferDualStack`으로 점진적 전환

```bash
# 기존 Service를 듀얼스택으로 업데이트
kubectl patch svc my-service -p \
  '{"spec":{"ipFamilyPolicy":"PreferDualStack","ipFamilies":["IPv4","IPv6"]}}'
```

## 주의사항

- **CoreDNS**: 듀얼스택 환경에서 AAAA 레코드도 자동 생성된다
- **NetworkPolicy**: IPv4와 IPv6 각각 별도 규칙이 필요한 경우가 있다
- **외부 LB**: 클라우드 프로바이더마다 듀얼스택 LB 지원 수준이 다르다
- **기존 앱**: `0.0.0.0`으로 바인딩하면 IPv4만 듣는 경우가 있어 `::` (IPv6 all-interfaces)로 변경 필요

---

**지난 글:** [서비스 메시 입문 — Istio와 Linkerd로 마이크로서비스 네트워크 제어하기](/posts/k8s-service-mesh-intro/)

**다음 글:** [쿠버네티스 NetworkPolicy — 파드 간 트래픽 제어](/posts/k8s-network-policies/)

<br>
읽어주셔서 감사합니다. 😊
