---
title: "Cosign으로 Docker 이미지 서명하기"
description: "Sigstore Cosign을 이용한 Docker 이미지 서명과 검증 방법, 키리스 서명(OIDC), Rekor 투명성 로그, Kubernetes Policy Controller를 통한 서명 강제화를 실전 예시로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 5
type: "knowledge"
category: "Docker"
tags: ["docker", "cosign", "sigstore", "이미지서명", "공급망보안", "OIDC", "kubernetes", "보안"]
featured: false
draft: false
---

[지난 글](/posts/docker-github-container-registry/)에서 ghcr.io를 활용하는 방법을 다뤘다. 이미지를 레지스트리에 올린 것으로 보안이 완성되는 것은 아니다. 이미지가 신뢰할 수 있는 소스에서 빌드됐는지, 전송 중에 변조되지 않았는지 검증하려면 **이미지 서명**이 필요하다.

## Cosign이란

Cosign은 Sigstore 프로젝트의 핵심 도구로, OCI 이미지에 대한 서명·검증을 간단하게 만든다. 서명은 별도 서버 없이 레지스트리에 OCI artifact로 저장된다.

핵심 특징:
- **키 기반**: cosign.key/cosign.pub으로 서명
- **키리스(Keyless)**: OIDC 토큰(GitHub Actions, Google, etc.)으로 서명 — 키 관리 불필요
- **Rekor**: 공개 투명성 로그에 서명 기록이 남아 감사 가능
- **SBOM 첨부**: 소프트웨어 Bill of Materials를 이미지에 연결 가능

![Cosign 이미지 서명 및 검증 흐름](/assets/posts/docker-image-signing-cosign-flow.svg)

## 설치

```bash
# Linux (binary)
curl -O -L "https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64"
sudo mv cosign-linux-amd64 /usr/local/bin/cosign
chmod +x /usr/local/bin/cosign

# macOS
brew install cosign

# Go
go install github.com/sigstore/cosign/v2/cmd/cosign@latest

# 버전 확인
cosign version
```

## 키 기반 서명

```bash
# 키 쌍 생성
cosign generate-key-pair
# COSIGN_PASSWORD 입력 (비밀키 암호화)
# cosign.key (비밀키), cosign.pub (공개키) 생성

# 이미지 빌드 & push (digest 필요)
docker build -t ghcr.io/myorg/myapp:1.0 .
docker push ghcr.io/myorg/myapp:1.0

# digest 조회
DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' ghcr.io/myorg/myapp:1.0)
# ghcr.io/myorg/myapp@sha256:abc123...

# 서명 (digest로 서명해야 불변성 보장)
cosign sign --key cosign.key "$DIGEST"

# 검증
cosign verify --key cosign.pub "$DIGEST" | jq .
```

서명은 레지스트리에 `sha256-abc123.sig`라는 태그로 자동 저장된다. 서명 자체도 OCI artifact이므로 레지스트리 외 별도 저장소가 필요 없다.

## 키리스 서명 (Keyless, 권장)

키리스 서명은 OIDC 공급자(GitHub Actions, Google Cloud, etc.)에서 발급한 JWT를 사용해 Fulcio CA에서 단기 인증서를 받아 서명한다. 비밀키를 관리할 필요가 없고 서명이 Rekor 투명성 로그에 자동으로 기록된다.

```bash
# GitHub Actions에서 키리스 서명 (OIDC 자동 사용)
# permissions: id-token: write 설정 필요

COSIGN_EXPERIMENTAL=1 cosign sign ghcr.io/myorg/myapp@sha256:abc123

# 검증 (이슈어와 아이덴티티 지정)
COSIGN_EXPERIMENTAL=1 cosign verify \
  --certificate-identity-regexp "https://github.com/myorg/myapp/.github/workflows/" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com" \
  ghcr.io/myorg/myapp@sha256:abc123
```

## GitHub Actions 통합

```yaml
# .github/workflows/sign.yml
name: Build, Push, Sign

on:
  push:
    branches: [main]

jobs:
  build-sign:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      id-token: write  # 키리스 서명에 필요

    steps:
      - uses: actions/checkout@v4

      - name: Install Cosign
        uses: sigstore/cosign-installer@v3

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and Push
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}

      - name: Sign image (keyless)
        run: |
          cosign sign --yes \
            ghcr.io/${{ github.repository }}@${{ steps.build.outputs.digest }}
        env:
          COSIGN_EXPERIMENTAL: "1"
```

## SBOM 첨부

Cosign으로 SBOM(Software Bill of Materials)을 이미지에 연결하면 의존성 추적과 취약점 분석이 쉬워진다.

```bash
# syft로 SBOM 생성
syft ghcr.io/myorg/myapp:1.0 -o spdx-json > sbom.spdx.json

# SBOM을 이미지에 첨부
cosign attach sbom --sbom sbom.spdx.json ghcr.io/myorg/myapp@sha256:abc123

# SBOM 서명
cosign sign --key cosign.key \
  --attachment sbom ghcr.io/myorg/myapp@sha256:abc123

# SBOM 조회
cosign download sbom ghcr.io/myorg/myapp@sha256:abc123
```

## Kubernetes Policy Controller로 서명 강제화

Sigstore Policy Controller는 Kubernetes Admission Webhook으로 동작하며, 서명되지 않은 이미지의 배포를 차단한다.

![서명 없는 이미지 차단 정책](/assets/posts/docker-image-signing-cosign-policy.svg)

```bash
# Policy Controller 설치 (Helm)
helm repo add sigstore https://sigstore.github.io/helm-charts
helm install policy-controller sigstore/policy-controller \
  --namespace cosign-system --create-namespace
```

Policy Controller를 네임스페이스에 적용하려면 레이블을 붙인다.

```bash
kubectl label namespace production policy.sigstore.dev/include=true
```

이후 `production` 네임스페이스에서는 `ClusterImagePolicy`에 정의된 서명 검증을 통과한 이미지만 실행된다.

## Rekor로 서명 감사

Rekor는 공개 투명성 로그 서버로, 모든 서명 이벤트가 append-only로 기록된다.

```bash
# 서명 로그 조회 (rekor-cli 사용)
rekor-cli search --email signer@example.com
rekor-cli get --uuid <uuid> --format json | jq .

# cosign으로 직접 조회
cosign triangulate ghcr.io/myorg/myapp@sha256:abc123
# → 레지스트리 내 서명 OCI artifact 위치 반환
```

---

**지난 글:** [GitHub Container Registry: ghcr.io 완전 활용법](/posts/docker-github-container-registry/)

**다음 글:** [실행 중인 컨테이너 디버깅 전략](/posts/docker-debug-running-container/)

<br>
읽어주셔서 감사합니다. 😊
