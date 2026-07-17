---
title: "CRI — 쿠버네티스 컨테이너 런타임 인터페이스"
description: "CRI가 kubelet과 컨테이너 런타임을 어떻게 분리하는지, containerd·CRI-O 구현체 비교, dockershim 제거 배경, crictl 디버깅 도구까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 9
type: "knowledge"
category: "Docker"
tags: ["docker", "cri", "kubernetes", "containerd", "cri-o", "crictl", "kubelet", "dockershim"]
featured: false
draft: false
---

[지난 글](/posts/docker-oci-spec/)에서 OCI 스펙이 컨테이너 생태계를 표준화하는 방식을 살펴봤다. 이번에는 **CRI(Container Runtime Interface)**를 다룬다. CRI는 쿠버네티스 kubelet이 컨테이너 런타임과 통신하기 위한 gRPC 인터페이스다. 이 시리즈의 마지막 주제로, Docker 생태계와 쿠버네티스가 어떻게 연결되는지를 정리한다.

## CRI가 등장한 배경

쿠버네티스 초기(1.0)에는 kubelet이 Docker 런타임과 직접 통신했다. 이는 런타임 교체가 불가능함을 의미했고, 컨테이너 생태계가 다양해지면서 문제가 됐다. 2016년 K8s 1.5에 CRI가 도입되면서 kubelet은 런타임에 무관해졌다.

![CRI 아키텍처](/assets/posts/docker-cri-arch.svg)

## CRI gRPC API

CRI는 두 개의 gRPC 서비스로 구성된다.

```protobuf
// RuntimeService — 컨테이너·Pod 생명주기
service RuntimeService {
  rpc RunPodSandbox(RunPodSandboxRequest) returns (RunPodSandboxResponse);
  rpc StopPodSandbox(StopPodSandboxRequest) returns (StopPodSandboxResponse);
  rpc RemovePodSandbox(RemovePodSandboxRequest) returns (RemovePodSandboxResponse);
  rpc CreateContainer(CreateContainerRequest) returns (CreateContainerResponse);
  rpc StartContainer(StartContainerRequest) returns (StartContainerResponse);
  rpc StopContainer(StopContainerRequest) returns (StopContainerResponse);
  // ExecSync, Attach, PortForward, Stats...
}

// ImageService — 이미지 관리
service ImageService {
  rpc PullImage(PullImageRequest) returns (PullImageResponse);
  rpc ListImages(ListImagesRequest) returns (ListImagesResponse);
  rpc RemoveImage(RemoveImageRequest) returns (RemoveImageResponse);
}
```

## CRI 구현체 비교

### containerd — 현재 표준

K8s 1.24+부터 가장 널리 사용되는 CRI 구현체다. `cri` 플러그인이 내장되어 있어 별도 데몬 없이 CRI 소켓을 제공한다.

```bash
# containerd CRI 소켓 위치
ls /run/containerd/containerd.sock

# containerd 설정에서 CRI 플러그인 확인
cat /etc/containerd/config.toml | grep -A5 cri

# containerd namespace 목록 (k8s.io가 K8s용)
ctr namespaces list
# NAME    LABELS
# default
# k8s.io  (kubelet이 사용하는 namespace)
# moby    (Docker가 사용하는 namespace)
```

### CRI-O — K8s 전용 경량 런타임

Red Hat이 만든 CRI 전용 구현체다. K8s 라이프사이클과 1:1 대응하도록 설계됐으며 OpenShift의 기본 런타임이다. 컨테이너 실행 외 기능을 포함하지 않아 매우 가볍다.

```bash
# CRI-O 소켓
ls /var/run/crio/crio.sock

# CRI-O 상태 확인
systemctl status crio
crictl --runtime-endpoint unix:///var/run/crio/crio.sock pods
```

### dockershim 제거 (K8s 1.24)

K8s 1.24(2022년 5월)에 `dockershim`이 kubelet 코드에서 제거됐다. 이는 Docker를 CRI 없이 직접 K8s에서 사용하는 방식의 종료를 의미한다.

```text
K8s 1.24 이전:
  kubelet → dockershim(내장) → dockerd → containerd → runc

K8s 1.24 이후:
  kubelet → CRI → containerd → runc
  kubelet → CRI → CRI-O → runc
```

Docker를 계속 사용하고 싶다면 `cri-dockerd`(미란티스 제공)를 설치하면 Docker의 CRI 어댑터로 동작한다.

```bash
# cri-dockerd 사용 시 kubelet 설정
# /var/lib/kubelet/kubeadm-flags.env
# KUBELET_EXTRA_ARGS=--container-runtime-endpoint unix:///var/run/cri-dockerd.sock
```

## crictl — CRI 디버깅 도구

crictl은 CRI 소켓에 직접 연결해 K8s 노드에서 컨테이너를 디버깅하는 공식 CLI다.

![crictl 명령어](/assets/posts/docker-cri-crictl.svg)

```bash
# crictl 설정 파일
cat /etc/crictl.yaml
# runtime-endpoint: unix:///run/containerd/containerd.sock
# image-endpoint: unix:///run/containerd/containerd.sock

# docker CLI와 crictl 대응
# docker ps    → crictl ps
# docker images → crictl images
# docker logs   → crictl logs
# docker exec   → crictl exec

# Pod Sandbox 상세 정보
crictl inspectp <pod-id>

# 특정 Pod의 컨테이너 목록
crictl ps --pod <pod-id>

# 이미지 pull (kubelet처럼)
crictl pull nginx:latest

# 사용하지 않는 이미지 정리
crictl rmi --prune
```

## kubelet ↔ CRI 통신 흐름

Pod를 생성할 때의 내부 흐름을 따라가면 다음과 같다.

```text
1. kubectl apply -f pod.yaml
2. API Server → etcd 저장
3. Scheduler → 노드 선정
4. kubelet (노드) → CRI.RunPodSandbox()
5. containerd → pause 컨테이너 생성 (네트워크 Namespace 공유용)
6. CNI 플러그인 → Pod IP 할당
7. kubelet → CRI.PullImage() (이미지 없으면)
8. kubelet → CRI.CreateContainer()
9. kubelet → CRI.StartContainer()
10. 컨테이너 실행 완료
```

```bash
# 이 흐름을 kubelet 로그로 확인
journalctl -u kubelet -f | grep -E "RunPodSandbox|CreateContainer|StartContainer"
```

## 런타임 교체 실습 (kubeadm 기준)

```bash
# 현재 런타임 확인
kubectl get node -o wide
# CONTAINER-RUNTIME 열 → containerd://1.7.x

# 다른 노드에서 CRI-O 사용 시 kubelet 설정
# /var/lib/kubelet/config.yaml
# containerRuntimeEndpoint: unix:///var/run/crio/crio.sock
```

## Docker 완전 정복 시리즈를 마치며

CRI를 끝으로 Docker 완전 정복 시리즈가 마무리된다. 이 시리즈에서 다룬 핵심 주제를 정리하면 다음과 같다.

- **컨테이너 기초**: 컨테이너 개념, Docker 아키텍처, 설치와 기본 명령
- **이미지 관리**: Dockerfile 작성, 멀티 스테이지 빌드, 레지스트리 활용
- **네트워크와 볼륨**: 브리지·오버레이 네트워크, 볼륨 타입과 백업
- **Compose**: 다중 컨테이너 오케스트레이션, 헬스체크, 환경 관리
- **운영과 보안**: 자원 제한, 로깅, rootless 모드, 이미지 서명
- **최적화**: 이미지 크기 최소화, 캐시 전략, distroless·scratch
- **CI/CD**: GitHub Actions, BuildKit, DevContainer
- **심화**: BuildKit 내부, Namespaces·cgroups, OverlayFS, runc·containerd
- **생태계**: Podman, nerdctl, Buildah, Skopeo, OCI 스펙, CRI

---

**지난 글:** [OCI 스펙 — 컨테이너 표준화의 기반](/posts/docker-oci-spec/)

<br>
읽어주셔서 감사합니다. 😊
