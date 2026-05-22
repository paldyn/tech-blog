---
title: "GitHub Container Registry: ghcr.io 완전 활용법"
description: "GitHub Container Registry(ghcr.io)의 인증 방법, GitHub Actions 통합, 패키지 가시성 설정, Kubernetes imagePullSecret, 멀티아키텍처 이미지 게시 방법을 실전 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 4
type: "knowledge"
category: "Docker"
tags: ["docker", "ghcr", "github", "github-actions", "패키지", "레지스트리", "CI/CD"]
featured: false
draft: false
---

[지난 글](/posts/docker-gcp-artifact-registry/)에서 GCP Artifact Registry를 살펴봤다. GitHub을 주요 코드 호스팅 플랫폼으로 사용한다면 GitHub Container Registry(GHCR, `ghcr.io`)가 가장 통합이 간단하다. 리포지토리와 같은 계정/조직 네임스페이스를 공유하고, `GITHUB_TOKEN`으로 별도 설정 없이 push/pull이 가능하다.

## GHCR 개요

GHCR 이미지 URI 형식: `ghcr.io/{owner}/{image}:{tag}`

- `{owner}`: GitHub 사용자명 또는 조직명
- Docker Hub처럼 퍼블릭 이미지는 인증 없이 pull 가능
- GitHub Packages에 통합되어 리포지토리 페이지에서 이미지 관리

![ghcr.io 인증 및 배포 흐름](/assets/posts/docker-github-container-registry-flow.svg)

## GitHub Actions에서 push

가장 일반적인 패턴이다. `GITHUB_TOKEN`을 사용하므로 별도 시크릿 설정이 필요 없다.

```yaml
# .github/workflows/docker-publish.yml
name: Docker Build & Push

on:
  push:
    branches: [main]
    tags: ['v*']

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write  # GHCR push에 필요

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=sha,prefix=sha-

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

`docker/metadata-action`은 브랜치명, 시맨틱 버전, 커밋 SHA를 태그로 자동 생성한다. `v1.2.3` 태그를 push하면 `1.2.3`, `1.2`, `1`, `latest` 태그가 함께 생성된다.

## 패키지 가시성 설정

![GHCR 인증 방법 비교](/assets/posts/docker-github-container-registry-perms.svg)

기본적으로 GHCR 패키지는 연결된 리포지토리의 가시성을 상속한다. 별도로 변경하려면 GitHub UI에서 해당 패키지 → Settings → Change Visibility로 조정한다.

```bash
# GitHub CLI로 패키지 가시성 변경
gh api \
  --method PATCH \
  -H "Accept: application/vnd.github+json" \
  /user/packages/container/myapp \
  -f visibility=public
```

## 로컬 환경에서 인증

```bash
# Personal Access Token(PAT) 생성 필요: Settings → Developer settings → Tokens
# 필요 권한: read:packages, write:packages, delete:packages

# 로그인
echo $CR_PAT | docker login ghcr.io -u USERNAME --password-stdin

# push
docker tag myapp:latest ghcr.io/myusername/myapp:latest
docker push ghcr.io/myusername/myapp:latest

# pull (public 이미지는 인증 불필요)
docker pull ghcr.io/myusername/myapp:latest
```

## Kubernetes imagePullSecret 설정

프라이빗 GHCR 이미지를 Kubernetes에서 pull하려면 imagePullSecret을 설정해야 한다.

```bash
# kubectl secret 생성 (PAT 사용)
kubectl create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username=myusername \
  --docker-password=$CR_PAT \
  --namespace=default

# 시크릿을 ServiceAccount에 연결 (파드별 설정 불필요)
kubectl patch serviceaccount default \
  -p '{"imagePullSecrets": [{"name": "ghcr-pull-secret"}]}'
```

```yaml
# 또는 파드 spec에 직접 지정
spec:
  imagePullSecrets:
    - name: ghcr-pull-secret
  containers:
    - name: app
      image: ghcr.io/myorg/myapp:1.0
```

## 멀티아키텍처 이미지 게시

GitHub Actions에서 BuildKit과 QEMU를 활용해 `linux/amd64`와 `linux/arm64`를 동시에 게시한다.

```yaml
- name: Set up QEMU
  uses: docker/setup-qemu-action@v3

- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3

- name: Build and push (multi-arch)
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    platforms: linux/amd64,linux/arm64
    tags: ghcr.io/myorg/myapp:latest
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

`cache-from: type=gha`는 GitHub Actions 캐시를 BuildKit 캐시 백엔드로 사용하므로 반복 빌드 속도가 크게 향상된다.

## 패키지와 리포지토리 연결

패키지를 리포지토리에 연결하면 리포지토리 페이지에서 패키지 목록을 볼 수 있고, GITHUB_TOKEN으로 push 권한이 자동 부여된다.

```dockerfile
# Dockerfile에 OCI 레이블 추가 (자동 연결)
LABEL org.opencontainers.image.source=https://github.com/myorg/myapp
LABEL org.opencontainers.image.description="My application"
LABEL org.opencontainers.image.licenses=MIT
```

`org.opencontainers.image.source` 레이블이 있으면 GHCR이 자동으로 해당 리포지토리에 패키지를 연결한다.

## 오래된 버전 정리

```bash
# GitHub CLI로 특정 버전 삭제
gh api \
  --method DELETE \
  -H "Accept: application/vnd.github+json" \
  /user/packages/container/myapp/versions/{version_id}

# 스크립트로 7일 이상 된 untagged 버전 일괄 삭제
gh api /user/packages/container/myapp/versions \
  | jq '.[] | select(.metadata.container.tags | length == 0) | .id' \
  | xargs -I{} gh api --method DELETE /user/packages/container/myapp/versions/{}
```

---

**지난 글:** [GCP Artifact Registry: Docker 이미지 저장과 CI/CD 통합](/posts/docker-gcp-artifact-registry/)

**다음 글:** [Cosign으로 Docker 이미지 서명하기](/posts/docker-image-signing-cosign/)

<br>
읽어주셔서 감사합니다. 😊
