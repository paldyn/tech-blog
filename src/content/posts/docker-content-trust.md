---
title: "Docker Content Trust: 이미지 서명으로 공급망 공격 방지"
description: "Docker Content Trust(DCT)와 Notary를 이용한 이미지 서명 검증, DOCKER_CONTENT_TRUST 환경변수 설정, 키 관리 전략, 그리고 차세대 이미지 서명 도구 Cosign(Sigstore)까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 3
type: "knowledge"
category: "Docker"
tags: ["docker", "content-trust", "DCT", "notary", "cosign", "이미지서명", "공급망", "보안"]
featured: false
draft: false
---

[지난 글](/posts/docker-secrets/)에서 시크릿을 안전하게 관리하는 방법을 살펴봤다. 이번에는 **이미지 자체의 무결성**을 보장하는 방법을 다룬다. 누군가 레지스트리에서 이미지를 교체하거나 변조했다면 어떻게 알 수 있을까? Docker Content Trust(DCT)가 그 답이다.

## 공급망 공격이란

컨테이너 공급망 공격은 이미지가 빌드된 이후 배포되기 전에 변조되는 공격이다. 예를 들어 레지스트리가 해킹되어 이미지에 악성코드가 삽입되거나, 의존하는 베이스 이미지가 침해된 경우다.

```bash
# 공격자가 레지스트리에서 myapp:latest를 악성 이미지로 교체
# DOCKER_CONTENT_TRUST 없이 pull하면 변조 감지 불가
docker pull myregistry.io/myapp:latest
# → 악성 이미지를 받아도 모름
```

Docker Content Trust는 이미지에 **암호학적 서명**을 추가해 변조를 감지한다.

## DCT 동작 원리

DCT는 The Update Framework(TUF)를 기반으로 한 Notary 프로젝트를 사용한다. 이미지를 push할 때 서명을 생성하고, pull할 때 서명을 검증한다.

![Docker Content Trust 서명 흐름](/assets/posts/docker-content-trust-flow.svg)

## DCT 활성화

```bash
# 환경변수로 활성화
export DOCKER_CONTENT_TRUST=1

# 이제 서명된 이미지만 push/pull 가능
docker pull nginx:latest
# → 서명이 있으면 정상 pull, 없으면 오류
```

또는 개별 명령에만 적용할 수 있다.

```bash
# 특정 명령에만 DCT 적용
DOCKER_CONTENT_TRUST=1 docker pull myimage:1.0

# DCT를 끄고 강제 실행 (서명 없는 이미지 받을 때)
DOCKER_CONTENT_TRUST=0 docker pull thirdparty:latest
```

## 첫 번째 서명 push

DCT를 활성화한 상태에서 처음 push하면 키 생성 프롬프트가 나타난다.

```bash
export DOCKER_CONTENT_TRUST=1
docker push myusername/myimage:1.0

# 첫 push 시 키 생성 프롬프트
# Please create a passphrase for the new root key:
# Please repeat the passphrase for your new root key:
# Please create a passphrase for the new repository key (myusername/myimage):

# 성공 시
# Finished initializing "docker.io/myusername/myimage"
# Successfully signed docker.io/myusername/myimage:1.0
```

**루트 키(root key)**는 모든 신뢰의 기반이다. 루트 키 패스프레이즈를 잃거나 키 파일이 손상되면 그 레포지터리의 서명을 복구할 수 없다.

## 키 관리

DCT는 두 종류의 키를 사용한다.

```bash
# 키 저장 위치
~/.docker/trust/private/

# 루트 키 (root key) — 최상위 신뢰 앵커
# 반드시 오프라인으로 안전하게 백업해야 한다
ls ~/.docker/trust/private/

# 키 목록 조회
docker trust key list

# 서명자 목록 조회 (특정 이미지)
docker trust inspect --pretty myusername/myimage:1.0
```

### 루트 키 백업 (필수)

```bash
# 루트 키 백업
cp -r ~/.docker/trust/private/ /secure-backup/docker-trust-keys/

# 백업된 키를 다른 머신에 복원
cp /secure-backup/docker-trust-keys/*.key ~/.docker/trust/private/
```

루트 키 분실은 **복구 불가**다. 레포지터리를 새로 만들고 새 루트 키로 시작해야 한다.

## CI/CD에서 DCT 사용

CI에서 서명 push를 자동화하려면 타겟 키를 환경변수로 전달한다.

```bash
# CI 환경에서 타겟 키를 로드하는 방법
# 1. 타겟 키 내보내기 (로컬)
docker trust key export mykey > mykey.pem

# 2. CI 시크릿에 저장

# 3. CI에서 사용
docker trust key load "$DOCKER_TARGET_KEY" --name ci-signer
DOCKER_CONTENT_TRUST=1 docker push myregistry/myimage:$VERSION
```

## 서명 검증 확인

```bash
# 이미지 서명 상세 정보
docker trust inspect --pretty myusername/myimage:1.0

# Name:       docker.io/myusername/myimage:1.0
# Digest:     sha256:abc123...
# Signed by:  myusername (targets/releases)

# 서명이 없는 이미지 pull 시도 (DCT=1)
DOCKER_CONTENT_TRUST=1 docker pull unsigned-image:latest
# → Error: remote trust data does not exist for ...
```

## Notary CLI로 세밀한 관리

```bash
# Notary CLI 설치 후
notary -s https://notary.docker.io -d ~/.docker/trust \
  list docker.io/myusername/myimage

# 특정 태그 서명 제거
notary -s https://notary.docker.io -d ~/.docker/trust \
  remove docker.io/myusername/myimage 1.0

# 서명 publish (변경사항 업로드)
notary -s https://notary.docker.io -d ~/.docker/trust \
  publish docker.io/myusername/myimage
```

## Cosign(Sigstore) — 차세대 이미지 서명

DCT/Notary의 복잡한 키 관리를 해결한 Sigstore의 Cosign이 업계 표준으로 자리잡고 있다.

![DCT vs Cosign 비교](/assets/posts/docker-content-trust-cosign.svg)

### Cosign 설치 및 기본 사용

```bash
# Linux 설치
curl -O -L "https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64"
mv cosign-linux-amd64 /usr/local/bin/cosign
chmod +x /usr/local/bin/cosign

# 키 페어 생성
cosign generate-key-pair
# → cosign.key (개인키), cosign.pub (공개키)

# 이미지 서명 (빌드 후 push 완료 상태에서)
cosign sign --key cosign.key myregistry.io/myimage:1.0

# 서명 검증
cosign verify --key cosign.pub myregistry.io/myimage:1.0
```

### Keyless 서명 (CI 자동화에 최적)

GitHub Actions, GitLab CI 등에서 OIDC 토큰을 이용해 키 없이 서명한다.

```bash
# GitHub Actions 환경에서 Keyless 서명
# (SIGSTORE_NO_TLOG 없이 Rekor 투명 로그에 기록)
cosign sign \
  --oidc-issuer=https://token.actions.githubusercontent.com \
  myregistry.io/myimage:${{ github.sha }}

# Keyless 검증
cosign verify \
  --certificate-identity-regexp="^https://github.com/myorg/myrepo" \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  myregistry.io/myimage:${{ github.sha }}
```

Keyless 서명은 서명자의 이메일/GitHub Actions 워크플로우 URL이 Rekor 투명 로그에 기록된다.

## DCT vs Cosign 선택 가이드

새 프로젝트라면 **Cosign**을 권장한다. Kubernetes Policy Controller, Kyverno와 연동이 쉽고, SBOM Attestation, Keyless 서명 등 현대적인 공급망 보안 기능을 지원한다.

기존에 DCT를 쓰고 있다면 마이그레이션 비용을 고려해 유지해도 되지만, CI 자동화가 복잡하다면 Cosign으로 전환을 검토한다.

---

**지난 글:** [Docker Secrets: 시크릿 안전하게 관리하기](/posts/docker-secrets/)

**다음 글:** [Docker 이미지 취약점 스캔: Trivy와 Docker Scout](/posts/docker-image-scan/)

<br>
읽어주셔서 감사합니다. 😊
