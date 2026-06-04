---
title: "쿠버네티스 네트워킹 모델 — Pod 간 통신의 기본 원칙"
description: "쿠버네티스 네트워킹 4가지 요건, veth pair·브리지·pause 컨테이너, Pod IP 할당 원리, 노드 간 패킷 흐름을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 8
type: "knowledge"
category: "Kubernetes"
tags: ["Kubernetes", "네트워킹", "Pod IP", "veth", "CNI", "pause 컨테이너", "오버레이 네트워크"]
featured: false
draft: false
---

[지난 글](/posts/k8s-stateful-storage-patterns/)에서 스테이트풀 스토리지 패턴을 살펴봤습니다. 이번에는 쿠버네티스 네트워킹의 근간이 되는 **네트워킹 모델** — Pod가 어떻게 IP를 받고, 다른 Pod와 어떻게 통신하며, 노드를 넘나드는 패킷이 어떻게 라우팅되는지 깊이 파헤칩니다.

## 쿠버네티스 네트워킹의 4가지 요건

쿠버네티스 스펙은 네트워킹 구현체(CNI 플러그인)가 반드시 만족해야 할 네 가지 규칙을 정의합니다.

1. **Pod는 NAT 없이 모든 다른 Pod와 통신할 수 있어야 한다** — Pod A(10.244.1.10)가 Pod B(10.244.2.10)에 패킷을 보낼 때 소스 IP가 변환되지 않아야 합니다.
2. **노드는 NAT 없이 모든 Pod와 통신할 수 있어야 한다** — kubelet, 모니터링 에이전트가 Pod IP를 직접 사용합니다.
3. **Pod 안에서 자신이 보는 IP는 외부에서도 같아야 한다** — Pod는 자신의 IP를 `eth0`에서 읽어 그것이 곧 외부에서 접근 가능한 IP입니다.
4. **Pod 내 컨테이너는 localhost로 통신한다** — 같은 Pod의 컨테이너들은 네트워크 네임스페이스를 공유합니다.

이 규칙들 덕분에 어떤 Pod든 IP만 알면 클러스터 어디서나 직접 접근할 수 있습니다.

![쿠버네티스 네트워킹 모델](/assets/posts/k8s-networking-model-overview.svg)

## Pod IP 할당

각 노드는 **Pod CIDR**이라는 IP 대역을 할당받습니다. 예를 들어:

- 노드1: `10.244.1.0/24` (최대 254개 Pod)
- 노드2: `10.244.2.0/24`
- 노드3: `10.244.3.0/24`

kube-controller-manager의 `--cluster-cidr=10.244.0.0/16` 설정에서 각 노드에 `/24` 서브넷을 나눠줍니다. 새 Pod가 생성되면 kubelet이 CNI 플러그인을 호출하고, CNI가 해당 노드의 Pod CIDR에서 미사용 IP를 할당합니다.

```bash
# 노드의 Pod CIDR 확인
kubectl get nodes -o jsonpath='{.items[*].spec.podCIDR}'
# → 10.244.1.0/24 10.244.2.0/24 ...

# Pod IP 확인
kubectl get pods -o wide
# NAME    READY  STATUS   IP            NODE
# app-0   1/1    Running  10.244.1.10   worker-1
```

## veth pair와 브리지

![Pod 네트워크 스택 — veth pair와 브리지](/assets/posts/k8s-networking-model-veth.svg)

Pod가 생성되면 CNI 플러그인이 **veth pair(가상 이더넷 쌍)** 를 만듭니다. 한쪽 끝(`eth0`)은 Pod의 네트워크 네임스페이스 안에 배치되고, 다른 쪽 끝(`vethXXXX`)은 호스트 네트워크 네임스페이스에 남습니다. 그 호스트 측 끝을 브리지(`cbr0`, `cni0` 등)에 연결합니다.

같은 노드의 두 Pod 사이 패킷 흐름:
```
Pod-A eth0 → vethA → cbr0 → vethB → Pod-B eth0
```

노드를 넘어가는 패킷 흐름(Flannel VXLAN 기준):
```
Pod-A eth0 → vethA → cbr0 → flannel.1(VXLAN 캡슐화) → eth0(노드1)
→ 물리 네트워크 → eth0(노드2) → flannel.1(디캡슐화) → cbr0 → vethC → Pod-C eth0
```

## pause 컨테이너

쿠버네티스의 Pod는 실제로 **pause 컨테이너** 하나와 사용자 컨테이너 N개로 구성됩니다.

pause 컨테이너는 거의 아무것도 하지 않는 소형 컨테이너로, **네트워크 네임스페이스를 소유하고 유지**하는 역할만 합니다. 사용자 컨테이너들은 `--network=container:pause` 옵션으로 pause의 네트워크 네임스페이스를 공유합니다.

이 덕분에:
- 사용자 컨테이너가 재시작되어도 Pod의 IP는 유지됩니다
- 컨테이너 A와 B가 `localhost`로 통신할 수 있습니다
- Pod 내 모든 컨테이너가 같은 포트 공간을 공유합니다(포트 충돌 주의)

```bash
# 노드에서 pause 컨테이너 확인
crictl ps | grep pause
# 또는
docker ps | grep pause
```

## 노드 간 라우팅 방식

CNI 플러그인은 크게 두 가지 방식으로 노드 간 통신을 처리합니다.

**오버레이 네트워크(Overlay)**: 패킷을 UDP/VXLAN으로 캡슐화하여 터널링합니다. 기존 L2/L3 인프라 변경 없이 동작합니다. Flannel(VXLAN 모드), Calico(IPIP 모드)가 이 방식을 지원합니다. 캡슐화 오버헤드가 있습니다.

**BGP 라우팅(Native Routing)**: 각 노드가 Pod CIDR 경로를 BGP로 광고합니다. 캡슐화 없이 직접 라우팅하여 성능이 좋습니다. Calico(BGP 모드), Cilium(eBPF Native Routing)이 이 방식을 지원합니다. 네트워크 인프라(BGP 지원 라우터)가 필요합니다.

```bash
# 노드의 라우팅 테이블 확인
ip route show
# 10.244.1.0/24 via 192.168.1.10 dev eth0   ← 다른 노드 Pod CIDR 경로
# 10.244.2.0/24 via 192.168.1.11 dev eth0
```

## Pod 간 직접 통신

```python
# 애플리케이션에서 Pod IP를 직접 사용하는 예시 (권장하지 않음)
import requests
response = requests.get("http://10.244.1.10:8080/api")

# 권장: Service DNS를 통해 통신
response = requests.get("http://my-service.default.svc.cluster.local:8080/api")
```

Pod IP는 Pod 재생성 시 변경됩니다. 직접 사용하지 않고 Service를 통해 접근하는 것이 원칙입니다. 다음 글에서 CNI 플러그인들의 구체적인 구현 차이를 비교합니다.

---

**지난 글:** [쿠버네티스 Stateful 스토리지 패턴 — StatefulSet 스토리지 설계](/posts/k8s-stateful-storage-patterns/)

**다음 글:** [쿠버네티스 CNI — 컨테이너 네트워크 인터페이스 완전 이해](/posts/k8s-cni/)

<br>
읽어주셔서 감사합니다. 😊
