---
title: "컨테이너 런타임: CRI, containerd, runc 완전 해부"
description: "쿠버네티스가 컨테이너를 실제로 실행하는 방법, CRI 인터페이스, containerd와 CRI-O의 역할, OCI 표준과 runc의 동작 원리를 단계적으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 1
type: "knowledge"
category: "Kubernetes"
tags: ["kubernetes", "k8s", "container-runtime", "containerd", "cri", "runc", "oci"]
featured: false
draft: false
---

[지난 글](/posts/k8s-kube-proxy/)에서 kube-proxy가 Service IP를 파드로 연결하는 원리를 살펴봤다. 이번 글에서는 한 단계 더 안쪽, **파드 안의 컨테이너를 실제로 실행하는 주체인 컨테이너 런타임**을 해부한다. kubelet이 "이 컨테이너를 시작해"라고 명령할 때, 실제로 무슨 일이 벌어지는지 계층별로 추적해보자.

## 왜 런타임이 여러 층인가

초창기 쿠버네티스는 Docker에 직접 의존했다. 그러나 Docker 외에도 다양한 컨테이너 엔진이 등장하면서, 쿠버네티스는 특정 구현에 묶이지 않기 위해 **CRI(Container Runtime Interface)** 라는 표준 gRPC 인터페이스를 도입했다. 이후 런타임 생태계는 두 층으로 분리됐다.

![컨테이너 런타임 계층 구조](/assets/posts/k8s-container-runtime-layers.svg)

- **고수준 런타임**: kubelet과 CRI로 통신하며 이미지 pull, 스냅샷 관리 등 상위 작업을 담당. containerd와 CRI-O가 대표적.
- **저수준 런타임**: OCI Runtime Spec을 구현해 실제 Linux namespace/cgroup을 생성하는 실행기. runc가 사실상 표준이며, 더 빠른 crun, VM 기반 kata-containers도 여기에 속한다.

## CRI: kubelet과 런타임의 계약

CRI는 두 개의 gRPC 서비스로 구성된다.

| 서비스 | 역할 |
|--------|------|
| `RuntimeService` | 파드/컨테이너 생명주기 (생성, 시작, 중지, 삭제) |
| `ImageService` | 이미지 pull, 목록 조회, 삭제 |

kubelet은 이 두 인터페이스만 사용한다. 내부 구현이 containerd든 CRI-O든 kubelet 입장에서는 동일하다.

```bash
# 클러스터의 런타임 확인
kubectl get nodes -o wide

# 노드에서 직접 확인
cat /etc/containerd/config.toml | grep "runtime_type"
# plugins."io.containerd.grpc.v1.cri".containerd.runtimes.runc
```

## containerd: 현재 표준

containerd는 원래 Docker의 내부 컴포넌트였다가 2016년 독립 프로젝트로 분리됐다. 현재 대부분의 managed K8s 서비스(EKS, GKE, AKS)가 기본 런타임으로 사용한다.

```bash
# containerd 서비스 상태
systemctl status containerd

# containerd namespace 목록 (k8s.io가 쿠버네티스용)
ctr namespace list

# k8s.io 네임스페이스 내 컨테이너 목록
ctr -n k8s.io containers list

# 이미지 목록
ctr -n k8s.io images list
```

containerd는 내부적으로 **snapshotter**로 레이어 스택을 관리하고, OCI bundle을 생성한 뒤 `containerd-shim`을 통해 runc를 실행한다. shim 프로세스는 runc 종료 후에도 살아서 컨테이너의 stdin/stdout/stderr를 처리한다.

## CRI-O: OpenShift의 선택

CRI-O는 Red Hat이 주도하는 런타임으로, **Kubernetes 전용**으로 설계됐다. containerd보다 컴포넌트가 적어 공격 표면이 작다. OpenShift가 기본 런타임으로 채택하고 있다.

```bash
# CRI-O 상태 확인
systemctl status crio

# CRI-O 소켓을 통한 정보 조회
crictl --runtime-endpoint unix:///var/run/crio/crio.sock info
```

## OCI와 runc

**OCI(Open Container Initiative)** 는 컨테이너 이미지 포맷(Image Spec)과 런타임 동작(Runtime Spec)을 정의하는 표준이다.

runc는 OCI Runtime Spec의 레퍼런스 구현체다. runc는 `config.json`(OCI bundle)을 읽어 Linux 시스템 콜을 호출한다.

```bash
# runc 버전 확인
runc --version

# OCI bundle 구조 (containerd가 생성)
# /run/containerd/io.containerd.runtime.v2.task/k8s.io/<id>/
#   config.json   ← OCI Runtime Spec
#   rootfs/       ← 레이어 스냅샷 마운트

# runc로 직접 컨테이너 상태 조회
runc --root /run/containerd/runc/k8s.io state <container-id>
```

runc가 실제로 수행하는 일은:
1. `config.json`의 `namespaces` 항목을 보고 `unshare()` syscall 실행
2. `cgroups` 설정으로 CPU/메모리 제한 적용
3. `rootfs`를 마운트하고 `chroot`
4. `process.args`의 명령어를 `execve()`로 실행

## crictl: CRI 디버깅 도구

crictl은 CRI gRPC API를 직접 호출하는 CLI 도구다. Docker가 없는 환경에서 컨테이너를 직접 디버깅할 때 필수다.

![컨테이너 생성 흐름과 crictl 명령어](/assets/posts/k8s-container-runtime-flow.svg)

```bash
# crictl 소켓 설정 (보통 /etc/crictl.yaml에 설정)
cat > /etc/crictl.yaml <<EOF
runtime-endpoint: unix:///run/containerd/containerd.sock
image-endpoint: unix:///run/containerd/containerd.sock
timeout: 10
EOF

# 실행 중인 파드 목록
crictl pods

# 특정 파드의 컨테이너
crictl ps --pod <pod-id>

# 컨테이너 내부 exec
crictl exec -it <container-id> sh

# 컨테이너 상세 정보 (OCI spec 포함)
crictl inspect <container-id>
```

## Docker는 지금 어떻게 되나

K8s 1.24부터 dockershim(Docker를 CRI로 래핑하던 컴포넌트)이 완전히 제거됐다. 그렇다고 Docker로 빌드한 이미지를 쓸 수 없는 게 아니다. Docker는 OCI Image Spec을 따르므로, `docker build`로 만든 이미지는 containerd와 CRI-O 모두에서 정상적으로 실행된다.

```bash
# 노드에서 Docker가 없어도 이미지는 OCI 호환
# docker build로 만든 이미지 → containerd에서 pull 가능
ctr -n k8s.io images pull docker.io/library/nginx:latest

# 이미지 포맷 확인 (OCI vs Docker legacy)
ctr -n k8s.io images check
```

## 핵심 정리

컨테이너 런타임은 3개 층이다. **kubelet → (CRI) → containerd/CRI-O → (OCI) → runc → Linux kernel**. 이 계층 분리 덕분에 쿠버네티스는 런타임 구현에서 독립적이고, 조직은 보안 요구사항이나 성능 특성에 맞는 런타임을 선택할 수 있다. 노드에서 컨테이너 문제가 생겼을 때는 `crictl`로 CRI 레벨을, `ctr`로 containerd 레벨을 직접 디버깅하면 kubectl 이상의 세밀한 정보를 얻을 수 있다.

---

**지난 글:** [kube-proxy: 쿠버네티스 네트워크 프록시](/posts/k8s-kube-proxy/)

**다음 글:** [로컬 쿠버네티스 클러스터 구축: kind, minikube, k3d 비교](/posts/k8s-local-cluster-setup/)

<br>
읽어주셔서 감사합니다. 😊
