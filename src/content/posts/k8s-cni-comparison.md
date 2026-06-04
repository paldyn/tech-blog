---
title: "쿠버네티스 CNI 플러그인 비교 — Calico·Flannel·Cilium·Weave"
description: "Flannel·Calico·Cilium·Weave Net의 네트워크 방식, NetworkPolicy 지원, 성능, eBPF 활용, 적합한 환경을 비교합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 10
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "CNI", "Calico", "Flannel", "Cilium", "eBPF", "NetworkPolicy", "네트워킹 비교"]
featured: false
draft: false
---

[지난 글](/posts/k8s-cni/)에서 CNI의 동작 원리와 ADD/DEL 흐름을 살펴봤습니다. 이번에는 실제 프로젝트에서 CNI 플러그인을 선택할 때 필요한 **주요 플러그인 비교** — Flannel, Calico, Cilium, Weave Net의 차이를 깊이 다룹니다.

## 왜 CNI 선택이 중요한가?

CNI 플러그인은 설치 후 교체가 매우 어렵습니다. 전체 클러스터의 네트워킹을 다시 구성해야 하며, 모든 Pod가 재시작이 필요합니다. 초기 아키텍처 결정이 중요합니다. NetworkPolicy 지원 여부, 성능 요구사항, 운영 복잡도, 보안 요건을 고려해 선택해야 합니다.

![CNI 플러그인 비교 매트릭스](/assets/posts/k8s-cni-comparison-matrix.svg)

## Flannel — 단순함의 대명사

Flannel은 **가장 단순한 CNI**입니다. VXLAN 오버레이 네트워크로 노드 간 통신을 처리합니다. 각 노드에 `/24` 서브넷을 할당하고, VXLAN 터널로 패킷을 캡슐화합니다.

```yaml
# Flannel DaemonSet 설치
kubectl apply -f https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml

# flannel 설정 확인
kubectl get cm -n kube-flannel kube-flannel-cfg -o yaml
```

**장점**: 설치가 매우 간단합니다. ConfigMap 하나로 설정이 끝납니다.

**단점**: **NetworkPolicy를 지원하지 않습니다.** 쿠버네티스의 NetworkPolicy 오브젝트를 만들어도 Flannel은 이를 적용하지 않습니다. NetworkPolicy가 필요하면 Flannel 위에 Calico를 정책 엔진으로만 올리는 `Canal` 구성을 사용하거나 처음부터 Calico를 선택해야 합니다.

학습 환경, 개발 클러스터, NetworkPolicy가 불필요한 내부 서비스 전용 클러스터에 적합합니다.

## Calico — 프로덕션 표준

Calico는 **가장 널리 사용되는 프로덕션 CNI**입니다. BGP 라우팅과 NetworkPolicy를 모두 지원합니다.

### 네트워크 모드 선택

```yaml
# BIRD(BGP) 모드: 네이티브 라우팅
# 캡슐화 없음, 최고 성능, BGP 지원 네트워크 인프라 필요
spec:
  calicoNetwork:
    ipPools:
    - cidr: 10.244.0.0/16
      encapsulation: None   # 오버레이 없음

# VXLAN 모드: 오버레이 라우팅
# BGP 없이도 동작, 클라우드 환경(AWS VPC)에서 기본 사용
spec:
  calicoNetwork:
    ipPools:
    - cidr: 10.244.0.0/16
      encapsulation: VXLAN
```

### NetworkPolicy

Calico는 쿠버네티스 기본 NetworkPolicy에 더해 **Calico 전용 GlobalNetworkPolicy**(클러스터 전체 정책)와 **HostEndpointPolicy**(노드 보호)를 제공합니다.

```yaml
# GlobalNetworkPolicy: 모든 네임스페이스에 적용
apiVersion: projectcalico.org/v3
kind: GlobalNetworkPolicy
metadata:
  name: default-deny-all
spec:
  selector: all()
  types:
  - Ingress
  - Egress
  # 규칙 없음 = 모두 거부
```

### eBPF 모드 (Calico)

Calico 3.13+부터 eBPF 데이터플레인을 지원합니다. kube-proxy를 대체하고 DSR(Direct Server Return)으로 소스 IP를 보존합니다.

```bash
# eBPF 모드 활성화
calicoctl patch felixconfiguration default \
  --patch='{"spec": {"bpfEnabled": true}}'
```

## Cilium — 차세대 고성능 CNI

Cilium은 **Linux eBPF**를 핵심 기술로 사용하는 CNI입니다. 패킷을 커널의 XDP/TC 훅에서 iptables 없이 처리합니다.

![eBPF 기반 CNI — Cilium의 패킷 처리](/assets/posts/k8s-cni-ebpf.svg)

### kube-proxy 대체

Cilium은 kube-proxy 없이 Service 로드밸런싱을 처리합니다. eBPF BPF Map을 사용해 O(1) 룩업으로 목적지를 결정합니다. 수천 개의 서비스에서도 성능이 저하되지 않습니다.

```bash
# kube-proxy 없는 Cilium 설치 (Helm)
helm install cilium cilium/cilium \
  --namespace kube-system \
  --set kubeProxyReplacement=true \
  --set k8sServiceHost=API_SERVER_IP \
  --set k8sServicePort=6443
```

### L7 정책

Cilium은 HTTP 헤더, gRPC 메서드 수준의 세밀한 정책을 지원합니다.

```yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: l7-allow-get-only
spec:
  endpointSelector:
    matchLabels:
      app: backend
  ingress:
  - fromEndpoints:
    - matchLabels:
        app: frontend
    toPorts:
    - ports:
      - port: "8080"
        protocol: TCP
      rules:
        http:
        - method: "GET"    # GET만 허용
          path: "/api/.*"
```

### Hubble — 내장 관측성

Cilium에는 Hubble이라는 네트워크 관측 도구가 내장되어 있습니다.

```bash
# Hubble CLI로 흐름 관찰
hubble observe --follow
# → 실시간 Pod 간 네트워크 흐름, 드롭 이유 확인

# Hubble UI
kubectl port-forward -n kube-system svc/hubble-ui 12000:80
```

### ClusterMesh

Cilium의 ClusterMesh는 여러 쿠버네티스 클러스터를 하나의 네트워크 패브릭으로 연결합니다. 클러스터 간 서비스 디스커버리와 글로벌 로드밸런싱이 가능합니다.

## Weave Net — 암호화 내장

Weave Net은 **Pod 간 트래픽을 자동으로 암호화**하는 VXLAN 오버레이 CNI입니다. 규정 준수 요구사항이 있는 환경에서 별도 서비스 메시 없이 전송 암호화가 필요할 때 사용합니다.

```bash
# Weave Net 설치
kubectl apply -f "https://cloud.weave.works/k8s/net?k8s-version=$(kubectl version | base64 | tr -d '\n')"

# 암호화 확인
kubectl get pods -n kube-system -l name=weave-net -o jsonpath='{.items[0].spec.containers[0].env}'
```

**주의**: Weave 프로젝트는 2023년 이후 적극적인 유지보수가 이루어지지 않고 있습니다. 암호화가 필요한 신규 클러스터에서는 Cilium의 Wireguard 암호화를 고려하세요.

## EKS/GKE/AKS에서의 선택

관리형 쿠버네티스 서비스는 기본 CNI를 제공하지만 교체할 수 있습니다.

| 클라우드 | 기본 CNI | 권장 대안 |
|---------|---------|---------|
| EKS | amazon-vpc-cni | Calico(정책), Cilium |
| GKE | GKE CNI (Dataplane V2 = Cilium 기반) | — |
| AKS | azure-cni | Cilium (Azure CNI + Cilium) |
| 온프레미스 | 없음 | Calico 또는 Cilium |

EKS의 `amazon-vpc-cni`는 Pod가 VPC IP를 직접 사용하는 네이티브 통합이지만 NetworkPolicy를 지원하지 않습니다. 정책이 필요하면 Calico를 정책 엔진으로 추가하거나 Cilium으로 교체합니다.

---

**지난 글:** [쿠버네티스 CNI — 컨테이너 네트워크 인터페이스 완전 이해](/posts/k8s-cni/)

<br>
읽어주셔서 감사합니다. 😊
