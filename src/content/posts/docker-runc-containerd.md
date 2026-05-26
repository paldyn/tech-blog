---
title: "runc & containerd — Docker 런타임 스택 해부"
description: "docker CLI → dockerd → containerd → shim → runc → Linux 커널로 이어지는 Docker 런타임 계층을 각 컴포넌트의 역할과 OCI 스펙 기준으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 3
type: "knowledge"
category: "Docker"
tags: ["docker", "runc", "containerd", "oci", "runtime", "container-internals", "shim"]
featured: false
draft: false
---

[지난 글](/posts/docker-overlayfs/)에서 OverlayFS가 레이어를 겹쳐 컨테이너 파일시스템을 제공하는 방식을 살펴봤다. 이번에는 `docker run` 명령이 실행될 때 실제로 컨테이너를 만드는 주체가 무엇인지, **런타임 스택**을 분해해 이해한다.

## Docker 런타임 스택 개요

`docker run nginx` 한 줄이 처리되기까지 총 5개 계층을 거친다.

![Docker 런타임 스택](/assets/posts/docker-runc-containerd-stack.svg)

각 컴포넌트는 역할이 명확히 분리되어 있고, 인터페이스(REST·gRPC·OCI)로 연결된다. 이 구조 덕분에 쿠버네티스가 dockerd 없이 containerd만 직접 사용하거나, runc를 gVisor 같은 다른 런타임으로 교체할 수 있다.

## docker CLI

사용자가 입력하는 `docker` 명령이다. **Unix 소켓**(`/var/run/docker.sock`)을 통해 dockerd에 REST API 요청을 보낸다. CLI 자체는 컨테이너를 만들지 않는다.

```bash
# dockerd와 통신하는 소켓 확인
ls -la /var/run/docker.sock

# 소켓에 직접 REST API 호출 (curl)
curl --unix-socket /var/run/docker.sock \
  http://localhost/v1.45/containers/json | python3 -m json.tool
```

## dockerd (Docker Daemon)

이미지 빌드, 레지스트리 인증, 볼륨·네트워크 생성, BuildKit 조율 등 **고수준 기능**을 담당한다. 컨테이너 생명주기 자체는 containerd에 위임한다.

```bash
# dockerd 상태 확인
systemctl status docker

# dockerd 로그 (런타임 오류 추적)
journalctl -u docker -f

# containerd와의 gRPC 통신 설정
cat /etc/docker/daemon.json
# { "containerd": "/run/containerd/containerd.sock" }
```

## containerd

**CNCF 졸업 프로젝트**로, 쿠버네티스 기본 컨테이너 런타임이기도 하다. 컨테이너 생명주기(생성·시작·정지·삭제), 이미지 스냅샷, 스토리지를 관리한다. Docker 없이 단독으로도 사용 가능하다.

```bash
# containerd 상태
systemctl status containerd

# ctr (containerd CLI) — 컨테이너 목록
sudo ctr containers list

# ctr로 이미지 pull
sudo ctr images pull docker.io/library/nginx:latest

# namespace 목록 (Docker는 'moby' 네임스페이스 사용)
sudo ctr namespaces list
sudo ctr -n moby containers list
```

## containerd-shim

containerd와 runc 사이의 **중간 프로세스**다. runc가 컨테이너를 생성하고 종료한 뒤에도 shim이 살아남아 컨테이너 프로세스의 부모 역할을 맡는다. 이 덕분에 containerd를 재시작해도 실행 중인 컨테이너는 영향을 받지 않는다.

```bash
# 실행 중인 shim 프로세스 확인
ps aux | grep containerd-shim
# containerd-shim-runc-v2 -namespace moby -id <CID> ...

# shim이 컨테이너 PID의 부모임을 확인
pstree -p $(docker inspect --format '{{.State.Pid}}' mycontainer)
```

## runc — OCI 저수준 런타임

OCI 런타임 스펙을 구현하는 **참조 구현체**다. Go로 작성됐으며 실제로 Linux 시스템 콜(`clone`, `pivot_root`, `execve`)을 호출해 컨테이너를 만든다. runc는 컨테이너를 생성하고 나면 **스스로 종료**한다. 이후 컨테이너 프로세스는 shim이 감시한다.

![OCI 번들과 runc 동작](/assets/posts/docker-runc-containerd-oci.svg)

```bash
# runc 버전 확인
runc --version

# OCI 번들 직접 생성 및 실행 (저수준 실험)
mkdir -p /tmp/mycontainer/rootfs
docker export $(docker create alpine) | tar -C /tmp/mycontainer/rootfs -xf -
cd /tmp/mycontainer
runc spec  # config.json 생성
runc run mycontainer

# 실행 중인 컨테이너 목록 (runc 관점)
runc list
```

## 런타임 교체 — 다른 OCI 런타임 사용

runc는 교체 가능하다. OCI 런타임 스펙을 준수하는 다른 런타임으로 바꿀 수 있다.

| 런타임 | 특징 | 사용 사례 |
|---|---|---|
| **runc** | 기본, 표준 Linux 컨테이너 | 일반 워크로드 |
| **crun** | C 구현, runc보다 빠른 시작 | 경량 환경 |
| **gVisor (runsc)** | 사용자 공간 커널, 강한 격리 | 멀티테넌트 |
| **Kata Containers** | 경량 VM 기반 | 강한 격리 필요 시 |

```bash
# containerd에 crun 런타임 추가 (/etc/containerd/config.toml)
# [plugins."io.containerd.grpc.v1.cri".containerd.runtimes.crun]
#   runtime_type = "io.containerd.runc.v2"
#   [plugins...runtimes.crun.options]
#     BinaryName = "/usr/bin/crun"

# Docker에서 특정 런타임 지정
docker run --runtime=crun nginx
```

## 컴포넌트 없이 컨테이너 확인하기

```bash
# 각 컴포넌트 소켓/바이너리 위치
which runc containerd dockerd docker

# containerd의 스냅샷 목록 (이미지 레이어)
sudo ctr -n moby snapshots list

# 컨테이너 런타임 정보 (docker inspect)
docker inspect mycontainer \
  --format '{{.HostConfig.Runtime}}'
# runc (기본값)
```

---

**지난 글:** [OverlayFS — 컨테이너 파일시스템의 비밀](/posts/docker-overlayfs/)

**다음 글:** [Podman vs Docker — 데몬리스 컨테이너 런타임 비교](/posts/docker-podman-vs-docker/)

<br>
읽어주셔서 감사합니다. 😊
