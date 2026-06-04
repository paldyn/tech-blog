---
title: "쿠버네티스 CNI — 컨테이너 네트워크 인터페이스 완전 이해"
description: "CNI 스펙과 ADD/DEL 호출 흐름, IPAM 플러그인(host-local·calico-ipam·Cilium), conflist 설정 파일, 체인 플러그인을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 9
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "CNI", "네트워킹", "IPAM", "Calico", "Flannel", "Cilium", "veth pair"]
featured: false
draft: false
---

[지난 글](/posts/k8s-networking-model/)에서 쿠버네티스 네트워킹의 4가지 요건과 veth pair 동작 원리를 살펴봤습니다. 이번에는 그 요건을 실제로 구현하는 **CNI(Container Network Interface)** — 표준 인터페이스 스펙과 동작 원리를 자세히 다룹니다.

## CNI란?

CNI는 컨테이너 런타임과 네트워크 플러그인 사이의 표준 인터페이스를 정의하는 **CNCF 스펙**입니다. 쿠버네티스는 CNI를 통해 어떤 네트워크 플러그인이든 교체 가능한 아키텍처를 갖습니다.

CNI는 두 가지 작업만 수행합니다:
- **ADD**: 컨테이너를 네트워크에 추가 (Pod 생성 시)
- **DEL**: 컨테이너를 네트워크에서 제거 (Pod 삭제 시)

이 단순한 인터페이스 덕분에 Flannel, Calico, Cilium, Weave Net 등 다양한 구현이 공존합니다.

## CNI 호출 흐름

![CNI 동작 원리와 호출 흐름](/assets/posts/k8s-cni-how-it-works.svg)

Pod 생성 시 흐름:
1. **kubelet** → Pod 생성 요청
2. **컨테이너 런타임**(containerd/CRI-O) → pause 컨테이너 생성, 네트워크 네임스페이스 생성
3. **CNI 플러그인** 호출 (`CNI_COMMAND=ADD`)
4. 플러그인이 veth pair 생성, IP 할당(IPAM), 라우팅 규칙 설정
5. 결과를 JSON으로 런타임에 반환

CNI 플러그인은 실행 파일(`/opt/cni/bin/`)로 존재합니다. 런타임이 환경 변수(`CNI_NETNS`, `CNI_CONTAINERID` 등)를 설정하고 플러그인을 실행하면, 플러그인이 stdin으로 설정 JSON을 받아 처리합니다.

## CNI 설정 파일

kubelet은 `/etc/cni/net.d/` 디렉토리에서 설정 파일을 읽습니다. 파일 이름을 사전순으로 정렬하여 첫 번째 파일을 사용합니다.

```json
{
  "cniVersion": "0.4.0",
  "name": "k8s-pod-network",
  "plugins": [
    {
      "type": "calico",
      "log_level": "info",
      "datastore_type": "kubernetes",
      "ipam": {
        "type": "calico-ipam"
      },
      "policy": {
        "type": "k8s"
      }
    },
    {
      "type": "portmap",
      "capabilities": {"portMappings": true}
    },
    {
      "type": "bandwidth",
      "capabilities": {"bandwidth": true}
    }
  ]
}
```

`plugins` 배열의 첫 번째가 **메인 플러그인**, 나머지는 **체인 플러그인**입니다. 체인 플러그인은 메인 플러그인이 처리한 결과 위에 추가 기능(포트 포워딩, 대역폭 제한)을 얹습니다.

## IPAM 플러그인

IPAM(IP Address Management)은 어떤 Pod에 어떤 IP를 줄지 결정하는 서브 플러그인입니다.

![IPAM 플러그인 종류](/assets/posts/k8s-cni-ipam.svg)

### host-local

가장 단순한 IPAM입니다. 각 노드에서 독립적으로 `/var/lib/cni/networks/` 아래에 할당된 IP 목록을 파일로 관리합니다.

```bash
# 노드에서 host-local 할당 파일 확인
ls /var/lib/cni/networks/k8s-pod-network/
# 10.244.1.10   10.244.1.11   10.244.1.12   lock
cat /var/lib/cni/networks/k8s-pod-network/10.244.1.10
# 해당 Pod의 컨테이너 ID
```

Flannel과 함께 많이 사용하며, 추가 의존성 없이 동작합니다.

### calico-ipam

Calico 전용 IPAM으로 쿠버네티스 API(CRD)에 IP 할당 상태를 저장합니다. IP Pool을 선언하고 노드별로 블록을 자동 분배합니다.

```bash
# Calico IP Pool 확인
calicoctl get ippool -o wide

# 노드별 IP 블록 확인
calicoctl get ipamblock
```

### Cilium IPAM

AWS ENI(Elastic Network Interface), Azure VNET, GKE 등 클라우드 네이티브 IP 관리를 지원합니다. Pod가 오버레이 IP가 아닌 VPC IP를 직접 사용하므로 네이티브 라우팅이 가능합니다.

## 체인 플러그인

### portmap

`hostNetwork: false`인 Pod에서 `hostPort`를 사용할 때 iptables DNAT 규칙을 자동으로 생성합니다.

```yaml
# Pod spec
ports:
- containerPort: 8080
  hostPort: 30080    # portmap 플러그인이 처리
```

### bandwidth

Pod의 ingress/egress 대역폭을 제한합니다. `tc(traffic control)` 도구를 사용합니다.

```yaml
metadata:
  annotations:
    kubernetes.io/ingress-bandwidth: "10M"
    kubernetes.io/egress-bandwidth: "10M"
```

## CNI 플러그인 설치 및 확인

```bash
# 노드에 설치된 CNI 바이너리 확인
ls /opt/cni/bin/
# bridge calico calico-ipam flannel host-local loopback portmap tuning

# 현재 활성 CNI 설정 확인
cat /etc/cni/net.d/$(ls /etc/cni/net.d/ | head -1)

# CNI 플러그인 Pod 상태 (보통 kube-system 네임스페이스)
kubectl get pods -n kube-system | grep -E "calico|flannel|cilium|weave"

# 네트워크 플러그인 로그
kubectl logs -n kube-system -l k8s-app=calico-node -c calico-node
```

## CNI 버전 호환성

CNI 스펙 버전과 플러그인 버전은 별개입니다. `cniVersion`은 플러그인이 준수하는 CNI 스펙 버전이며, 0.3.1, 0.4.0, 1.0.0 등이 있습니다. 런타임이 지원하는 스펙 버전과 플러그인 버전이 맞아야 합니다.

```bash
# 런타임이 지원하는 CNI 버전 확인 (containerd)
containerd config dump | grep cni
```

---

**지난 글:** [쿠버네티스 네트워킹 모델 — Pod 간 통신의 기본 원칙](/posts/k8s-networking-model/)

**다음 글:** [쿠버네티스 CNI 플러그인 비교 — Calico·Flannel·Cilium·Weave](/posts/k8s-cni-comparison/)

<br>
읽어주셔서 감사합니다. 😊
