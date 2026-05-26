---
title: "OCI 스펙 — 컨테이너 표준화의 기반"
description: "OCI Image Spec·Runtime Spec·Distribution Spec 세 가지 표준이 컨테이너 생태계를 어떻게 통일하는지, 매니페스트 구조와 Content Addressability를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 8
type: "knowledge"
category: "Docker"
tags: ["docker", "oci", "image-spec", "runtime-spec", "distribution-spec", "manifest", "container-standard"]
featured: false
draft: false
---

[지난 글](/posts/docker-skopeo/)에서 Skopeo로 레지스트리 간 이미지를 복사하는 방법을 살펴봤다. 이번에는 Docker·Podman·nerdctl·Buildah·Skopeo가 모두 상호 호환되는 이유인 **OCI(Open Container Initiative) 스펙**을 다룬다.

## OCI란

OCI는 2015년 Docker와 CoreOS 등 주요 기업들이 컨테이너 기술을 표준화하기 위해 Linux Foundation 산하에 설립한 단체다. 현재 세 가지 핵심 스펙을 유지한다.

![OCI 스펙 3종](/assets/posts/docker-oci-spec-overview.svg)

## 1. Image Spec — 이미지 형식 표준

OCI 이미지는 **Manifest + Config + Layers** 세 요소로 구성된다.

![OCI 이미지 매니페스트 구조](/assets/posts/docker-oci-spec-manifest.svg)

### Content Addressability (내용 주소화)

OCI의 가장 중요한 원칙이다. 모든 데이터는 **SHA-256 해시(다이제스트)**로 참조된다. 다이제스트가 같으면 내용이 동일함이 보장된다.

```bash
# 이미지 다이제스트 확인
docker inspect nginx:latest \
  --format '{{.RepoDigests}}'
# [nginx@sha256:abc123...]

# 다이제스트로 pull (태그 변경에 무관하게 고정)
docker pull nginx@sha256:abc123...

# 레이어 다이제스트 확인
docker inspect nginx:latest \
  --format '{{range .RootFS.Layers}}{{println .}}{{end}}'
```

### 멀티 아키텍처 이미지 (Image Index)

하나의 태그(`nginx:latest`)로 `linux/amd64`와 `linux/arm64`를 모두 지원하는 방식이다.

```bash
# 멀티 아키텍처 매니페스트 조회
docker manifest inspect nginx:latest | python3 -m json.tool

# 특정 플랫폼 이미지 지정 pull
docker pull --platform linux/arm64 nginx:latest

# Skopeo로 원시 Index 조회
skopeo inspect --raw docker://nginx:latest | \
  python3 -m json.tool | grep -A5 platform
```

### OCI vs Docker 이미지 형식

```bash
# Docker v2 매니페스트 (구버전)
# Content-Type: application/vnd.docker.distribution.manifest.v2+json

# OCI 매니페스트 (현행 표준)
# Content-Type: application/vnd.oci.image.manifest.v1+json

# 현재 이미지의 mediaType 확인
skopeo inspect --raw docker://nginx:latest | jq .mediaType

# OCI 형식으로 이미지 저장
skopeo copy docker://nginx:latest oci:./nginx-oci/
ls ./nginx-oci/
# blobs/  index.json  oci-layout
```

## 2. Runtime Spec — 컨테이너 실행 표준

컨테이너를 **어떻게 실행**하는지 정의한다. 핵심은 `config.json`이다.

```bash
# runc spec으로 기본 config.json 생성
runc spec
cat config.json | python3 -m json.tool | head -50

# config.json 주요 섹션:
# process.args  → CMD / ENTRYPOINT
# mounts        → 볼륨 마운트
# linux.namespaces → Namespace 종류
# linux.resources  → cgroup 설정
# linux.seccomp    → 시스템 콜 필터
```

### 라이프사이클

OCI Runtime Spec은 컨테이너의 생명주기를 다음 상태로 정의한다.

```
creating → created → running → stopped
```

```bash
# 상태 조회 (OCI 런타임 관점)
runc state <container-id>
# {
#   "id": "mycontainer",
#   "status": "running",
#   "pid": 12345,
#   "bundle": "/tmp/mycontainer"
# }

# 상태 전환
runc create mycontainer  # creating → created
runc start mycontainer   # created → running
runc kill mycontainer    # running → stopping
runc delete mycontainer  # stopped 정리
```

## 3. Distribution Spec — 레지스트리 API 표준

레지스트리와 클라이언트 간 통신 프로토콜을 정의한다. HTTP REST API 기반이다.

```bash
# Distribution Spec API 직접 호출
REGISTRY=registry-1.docker.io
IMAGE=library/nginx
TAG=latest

# API 버전 확인
curl -s https://$REGISTRY/v2/ -I

# 태그 목록
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://$REGISTRY/v2/$IMAGE/tags/list" | python3 -m json.tool

# 매니페스트 조회 (pull 없이)
curl -s -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.oci.image.manifest.v1+json" \
  "https://$REGISTRY/v2/$IMAGE/manifests/$TAG"

# 특정 레이어 블롭 다운로드
curl -s -H "Authorization: Bearer $TOKEN" \
  "https://$REGISTRY/v2/$IMAGE/blobs/sha256:abc123..." \
  -o layer.tar.gz
```

## OCI 표준의 실무적 의미

| 표준 준수 | 실무 효과 |
|---|---|
| Image Spec | Docker Hub·ECR·GCR·Harbor 이미지 상호 사용 |
| Runtime Spec | runc → crun → gVisor 교체 가능 |
| Distribution Spec | `docker pull` = `skopeo copy` = `podman pull` |

```bash
# 동일한 이미지를 다른 도구로 pull — 모두 OCI 준수
docker pull nginx:latest
podman pull nginx:latest
nerdctl pull nginx:latest
skopeo copy docker://nginx:latest oci-archive:/tmp/nginx.tar

# 결과 이미지는 모두 동일 (sha256 다이제스트 동일)
```

## Artifacts — OCI 이미지 스펙 확장

OCI 이미지 스펙은 컨테이너 이미지뿐 아니라 **Helm 차트, Cosign 서명, WASM 모듈** 같은 임의의 아티팩트를 레지스트리에 저장하는 용도로도 확장됐다.

```bash
# Helm 차트를 OCI 레지스트리에 push
helm push mychart-1.0.0.tgz oci://myregistry.io/charts

# Helm pull
helm pull oci://myregistry.io/charts/mychart --version 1.0.0

# Cosign 서명도 OCI 아티팩트로 저장됨
cosign sign myregistry.io/myapp:latest
```

---

**지난 글:** [Skopeo — pull 없이 이미지 복사·검사하는 도구](/posts/docker-skopeo/)

**다음 글:** [CRI — 쿠버네티스 컨테이너 런타임 인터페이스](/posts/docker-cri/)

<br>
읽어주셔서 감사합니다. 😊
