---
title: "멀티 아키텍처 이미지와 docker buildx"
description: "하나의 이미지 태그로 AMD64·ARM64 등 여러 CPU 아키텍처를 지원하는 멀티 아키텍처 이미지 구조, Manifest List 개념, docker buildx로 멀티 아키텍처 빌드하고 푸시하는 방법, QEMU 에뮬레이션을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 8
type: "knowledge"
category: "Docker"
tags: ["docker", "buildx", "multi-arch", "manifest", "arm64", "amd64", "멀티아키텍처"]
featured: false
draft: false
---

[지난 글](/posts/docker-image-digest/)에서 이미지를 정확히 식별하는 Digest를 살펴봤다. 이번에는 하나의 태그 아래에 여러 CPU 아키텍처용 이미지를 묶는 멀티 아키텍처 이미지를 다룬다. Apple M 시리즈 Mac, AWS Graviton, Raspberry Pi 등 ARM 기반 환경의 확산으로 멀티 아키텍처 지원은 이제 선택이 아닌 필수가 되고 있다.

## 왜 멀티 아키텍처가 필요한가

CPU 아키텍처(x86_64, ARM64, ARM v7 등)마다 실행 파일 형식이 다르다. 같은 컨테이너 이미지도 아키텍처에 맞는 바이너리를 포함해야 한다.

과거에는 아키텍처별로 다른 이미지를 관리했다.

```
myapp:latest-amd64
myapp:latest-arm64
myapp:latest-armv7
```

멀티 아키텍처 이미지(Manifest List / Image Index)를 사용하면 하나의 태그로 모든 플랫폼을 지원할 수 있다.

```bash
docker pull myapp:latest
# → 현재 호스트 아키텍처에 맞는 이미지 자동 선택
```

## Manifest List 구조

Manifest List는 OCI 이미지 인덱스(Image Index) 스펙에 정의된 메타데이터 문서다. 각 플랫폼에 해당하는 이미지 Digest를 나열한다.

```json
{
  "manifests": [
    {
      "digest": "sha256:aaa111...",
      "platform": {"os": "linux", "architecture": "amd64"}
    },
    {
      "digest": "sha256:bbb222...",
      "platform": {"os": "linux", "architecture": "arm64"}
    }
  ]
}
```

`docker pull nginx:latest`를 실행하면 Docker 데몬이 호스트 아키텍처를 감지해 해당 플랫폼의 이미지를 자동으로 선택한다.

![Manifest List 구조](/assets/posts/docker-image-platform-manifest.svg)

## docker manifest 조회

```bash
# 멀티 아키텍처 지원 여부 확인
docker manifest inspect nginx:latest

# 특정 플랫폼 Digest 확인
docker manifest inspect nginx:latest \
  | jq '.manifests[] | {arch: .platform.architecture, digest}'
```

## docker buildx — 멀티 아키텍처 빌드

`docker build`는 기본적으로 현재 호스트 아키텍처의 이미지만 만든다. `docker buildx`는 QEMU 에뮬레이션을 통해 다른 아키텍처용 이미지도 빌드할 수 있다.

```bash
# QEMU 지원 설정 (최초 1회)
docker run --privileged \
  --rm tonistiigi/binfmt --install all

# buildx builder 생성
docker buildx create \
  --name multiarch --use

# 멀티 아키텍처 빌드 + 레지스트리 푸시
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t myrepo/myapp:latest \
  --push .
```

`--push` 없이 로컬에 저장하려면 단일 플랫폼만 가능하다 (`--load` 사용). Manifest List는 레지스트리에 푸시해야 완전히 동작한다.

![buildx 빌드 명령](/assets/posts/docker-image-platform-buildx.svg)

## 플랫폼 명시적 지정

특정 플랫폼용 이미지를 명시적으로 pull하거나 실행할 수 있다.

```bash
# 특정 아키텍처 이미지 강제 pull
docker pull --platform linux/arm64 nginx:latest

# 다른 아키텍처 컨테이너 실행 (QEMU 필요)
docker run --platform linux/arm64 nginx:latest
```

## Dockerfile에서 플랫폼 변수 활용

멀티 아키텍처 빌드에서는 플랫폼에 따라 다른 바이너리나 패키지를 사용해야 할 수 있다.

```dockerfile
# ARG로 플랫폼 정보 접근
FROM --platform=$BUILDPLATFORM golang:1.22 AS builder
ARG TARGETOS TARGETARCH
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -o /app ./...

FROM --platform=$TARGETPLATFORM debian:slim
COPY --from=builder /app /app
CMD ["/app"]
```

`BUILDPLATFORM`은 빌드가 실행되는 호스트 플랫폼, `TARGETPLATFORM`은 최종 이미지 대상 플랫폼이다. Go나 Rust처럼 크로스 컴파일을 지원하는 언어는 QEMU 에뮬레이션 없이 네이티브 속도로 빌드할 수 있다.

## AWS ECR, GHCR에서의 멀티 아키텍처

주요 레지스트리는 모두 멀티 아키텍처 이미지를 지원한다.

```bash
# Amazon ECR에 멀티 아키텍처 푸시
aws ecr get-login-password | docker login ...
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t 123456789.dkr.ecr.ap-northeast-2.amazonaws.com/myapp:v1 \
  --push .
```

AWS Graviton 인스턴스(arm64)에 배포하면 동일한 비용으로 더 높은 성능을 얻을 수 있다. Graviton3 기반 인스턴스는 같은 사양 x86 대비 약 40% 비용 절감이 보고된다.

---

**지난 글:** [Docker 이미지 Digest — 불변 참조의 핵심](/posts/docker-image-digest/)

**다음 글:** [Docker 이미지 네이밍과 태깅 전략](/posts/docker-image-naming-tagging/)

<br>
읽어주셔서 감사합니다. 😊
