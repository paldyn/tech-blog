---
title: "nerdctl — containerd용 Docker 호환 CLI"
description: "nerdctl이 Docker 데몬 없이 containerd에 직접 접근하는 방식, 설치·기본 명령어·Compose 지원, 그리고 Docker와의 차이점을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 5
type: "knowledge"
category: "Docker"
tags: ["docker", "nerdctl", "containerd", "cni", "buildkit", "lazy-pull", "stargz"]
featured: false
draft: false
---

[지난 글](/posts/docker-podman-vs-docker/)에서 Podman의 데몬리스 아키텍처를 살펴봤다. 이번에는 **nerdctl**을 소개한다. Podman이 독자적인 런타임 경로를 갖는다면, nerdctl은 containerd를 직접 사용하면서 Docker CLI와 거의 동일한 명령어 인터페이스를 제공한다. 특히 쿠버네티스 환경에서 containerd를 이미 사용 중이라면 자연스럽게 연결된다.

## nerdctl이란

nerdctl(Nerdy Container Tool)은 Rancher Labs(SUSE)가 만든 **containerd용 CLI**다. Docker CLI와 90% 이상 호환되는 명령어를 제공하면서, dockerd 없이 containerd 소켓에 직접 연결한다.

```bash
# nerdctl 설치 (바이너리)
NERDCTL_VERSION=2.0.0
wget https://github.com/containerd/nerdctl/releases/download/\
v${NERDCTL_VERSION}/nerdctl-${NERDCTL_VERSION}-linux-amd64.tar.gz
tar xzf nerdctl-*.tar.gz -C /usr/local/bin nerdctl

# containerd + CNI + BuildKit 포함 전체 패키지 설치
wget https://github.com/containerd/nerdctl/releases/download/\
v${NERDCTL_VERSION}/nerdctl-full-${NERDCTL_VERSION}-linux-amd64.tar.gz
sudo tar xzf nerdctl-full-*.tar.gz -C /usr/local/

# 설치 확인
nerdctl version
```

## 아키텍처

![nerdctl 아키텍처](/assets/posts/docker-nerdctl-arch.svg)

nerdctl은 dockerd를 거치지 않고 containerd 소켓에 직접 접근한다. 네트워킹은 CNI 플러그인, 빌드는 BuildKit을 통해 Docker와 동등한 기능을 제공한다.

## 기본 명령어

![nerdctl 명령어 비교](/assets/posts/docker-nerdctl-commands.svg)

Docker CLI를 이미 알고 있다면 학습 비용이 거의 없다.

```bash
# 컨테이너 실행
nerdctl run -d -p 8080:80 --name web nginx

# 컨테이너 목록
nerdctl ps

# 이미지 목록
nerdctl images

# 이미지 빌드 (BuildKit 필요)
nerdctl build -t myapp:latest .

# 이미지 push
nerdctl push myregistry.io/myapp:latest

# 컨테이너 로그
nerdctl logs -f web

# 컨테이너 내부 진입
nerdctl exec -it web sh
```

## containerd Namespace

nerdctl의 Docker와 다른 점 중 하나가 **containerd namespace**다. 쿠버네티스는 `k8s.io` 네임스페이스를, Docker는 `moby` 네임스페이스를 사용한다.

```bash
# 기본 namespace (nerdctl default)
nerdctl --namespace default ps

# 쿠버네티스 네임스페이스의 이미지 조회
nerdctl --namespace k8s.io images

# 단축 플래그
nerdctl -n k8s.io ps

# 모든 namespace 이미지 목록
for ns in $(ctr namespaces list -q); do
  echo "=== $ns ==="; nerdctl -n $ns images; done
```

## Compose 지원

`nerdctl-full` 패키지를 설치하면 Compose 플러그인이 포함된다.

```bash
# docker-compose.yml 그대로 사용
nerdctl compose up -d
nerdctl compose ps
nerdctl compose logs
nerdctl compose down

# 특정 서비스만 재시작
nerdctl compose restart web
```

## Docker에 없는 고유 기능

### Lazy Pulling (eStargz)

컨테이너 시작 전에 이미지 전체를 받지 않고, 실제 접근하는 레이어만 가져오는 방식이다. 대용량 이미지의 시작 시간을 크게 줄인다.

```bash
# eStargz 지원 snapshotter 사용
nerdctl --snapshotter=stargz run \
  ghcr.io/stargz-containers/nginx:1.25-esgz

# 이미지를 eStargz 형식으로 변환
nerdctl image convert --estargz nginx:latest \
  myregistry.io/nginx:stargz
```

### 암호화 이미지

이미지 레이어를 암호화하여 레지스트리에 저장할 수 있다.

```bash
# 키 생성
openssl genrsa -out mykey.pem 4096

# 이미지 암호화
nerdctl image encrypt \
  --recipient jwe:mykey.pem \
  myimage:latest myregistry.io/myimage:encrypted

# 복호화 후 실행
nerdctl run --unpack-key=mykey.pem \
  myregistry.io/myimage:encrypted
```

## rootless nerdctl

```bash
# rootless 모드 설정
containerd-rootless-setuptool.sh install
nerdctl-rootless-setuptool.sh install

# rootless로 컨테이너 실행
export XDG_RUNTIME_DIR=/run/user/$(id -u)
nerdctl run -d nginx

# rootless 소켓 경로
# /run/user/1000/containerd/containerd.sock
```

## Docker 대체 여부

nerdctl은 Docker CLI의 **드롭인(drop-in) 대체제**를 목표로 한다. 쿠버네티스 클러스터 노드에서 containerd만 실행 중인 환경, 또는 Docker 라이선스 없이 컨테이너 개발을 원하는 상황에서 유용하다. 단, Docker Desktop의 GUI나 Docker Scout 같은 부가 서비스는 제공하지 않는다.

```bash
# Docker 대신 nerdctl alias
alias docker=nerdctl
# 기존 스크립트 대부분 호환됨
```

---

**지난 글:** [Podman vs Docker — 데몬리스 컨테이너 런타임 비교](/posts/docker-podman-vs-docker/)

**다음 글:** [Buildah — 데몬 없이 컨테이너 이미지 빌드](/posts/docker-buildah/)

<br>
읽어주셔서 감사합니다. 😊
