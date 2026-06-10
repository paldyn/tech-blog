---
title: "이미지 서명 — Cosign과 공급망 보안"
description: "Cosign으로 컨테이너 이미지에 서명하고 검증하는 방법, 키 기반 서명과 Keyless 서명(OIDC + Rekor) 비교, Kyverno ClusterPolicy로 서명되지 않은 이미지 배포 차단, SBOM 첨부 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 7
type: "knowledge"
category: "Kubernetes"
tags: ["Cosign", "이미지서명", "공급망보안", "Sigstore", "Kyverno", "Kubernetes", "DevSecOps"]
featured: false
draft: false
---

[지난 글](/posts/k8s-image-scanning/)에서 Trivy로 이미지 취약점을 스캔하는 방법을 다뤘다. 이번 글에서는 공급망 보안(Supply Chain Security)의 핵심인 **이미지 서명**을 살펴본다. 이미지를 서명하면 "이 이미지가 신뢰할 수 있는 파이프라인에서 만들어졌고 이후 변조되지 않았음"을 암호학적으로 증명할 수 있다.

## 왜 이미지 서명이 필요한가

취약점 스캔은 알려진 CVE를 찾아낸다. 하지만 이미지 레지스트리가 해킹되어 이미지가 악성 코드로 교체되는 경우는 스캔으로 막기 어렵다. 이미지 서명은 이런 **공급망 공격(Supply Chain Attack)**을 방어한다.

- **빌드 시** CI/CD 파이프라인이 이미지에 서명을 첨부
- **배포 시** Kubernetes Admission Control이 서명 유효성 검증
- **서명 없는 이미지**는 클러스터에 진입 불가

![Cosign 이미지 서명 및 검증 흐름](/assets/posts/k8s-image-signing-cosign-flow.svg)

## Cosign 설치 및 기본 사용법

[Cosign](https://github.com/sigstore/cosign)은 Sigstore 프로젝트의 이미지 서명 도구다.

```bash
# 설치
brew install cosign                        # macOS
curl -O https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64
chmod +x cosign-linux-amd64
sudo mv cosign-linux-amd64 /usr/local/bin/cosign

# 버전 확인
cosign version
```

## 키 기반 서명

키 쌍을 생성해 서명한다. 개인키는 안전하게 보관하거나 KMS에 저장한다.

```bash
# 키 쌍 생성 (cosign.key, cosign.pub 생성)
cosign generate-key-pair

# 이미지 서명 (이미지가 레지스트리에 먼저 푸시되어야 함)
cosign sign --key cosign.key \
  my-registry/myapp:v2.0.0

# 서명 검증
cosign verify --key cosign.pub \
  my-registry/myapp:v2.0.0

# KMS (AWS KMS) 사용
cosign sign --key awskms:///arn:aws:kms:us-east-1:123:key/xxx \
  my-registry/myapp:v2.0.0
```

서명은 이미지 다이제스트에 대해 생성되고, OCI 레지스트리에 이미지와 함께 저장된다. 서명은 별도의 태그(`sha256-xxx.sig`)로 푸시된다.

## Keyless 서명 — 키 관리 없이 OIDC로 서명

Keyless 방식은 개인키 없이 OIDC 토큰(GitHub Actions, GCP, AWS IAM)을 사용해 일시적 키를 생성하고 Rekor 투명성 로그에 기록한다.

```yaml
# .github/workflows/sign.yaml
- name: Sign image with Cosign
  env:
    COSIGN_EXPERIMENTAL: "1"    # Keyless 활성화
  run: |
    cosign sign \
      --oidc-issuer https://token.actions.githubusercontent.com \
      my-registry/myapp@${{ steps.build.outputs.digest }}
```

GitHub Actions는 자동으로 OIDC 토큰을 발급하므로, `ACTIONS_ID_TOKEN_REQUEST_URL` 환경 변수가 있으면 추가 설정 없이 Keyless 서명이 동작한다. 서명은 Rekor(https://rekor.sigstore.dev)에 투명하게 기록된다.

```bash
# Keyless 서명 검증
cosign verify \
  --certificate-identity-regexp ".*github.*" \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  my-registry/myapp:v2.0.0
```

## Kyverno로 서명되지 않은 이미지 차단

![Kyverno Policy로 서명되지 않은 이미지 차단](/assets/posts/k8s-image-signing-cosign-kyverno.svg)

```yaml
# ClusterPolicy — 서명 검증 (키 기반)
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: verify-image-signature
spec:
  validationFailureAction: Audit   # 처음엔 Audit으로 시작
  background: false
  rules:
    - name: check-image-signature
      match:
        any:
          - resources:
              kinds: [Pod]
              namespaces: [production]
      verifyImages:
        - imageReferences:
            - "my-registry/*"
          attestors:
            - count: 1
              entries:
                - keys:
                    publicKeys: |-
                      -----BEGIN PUBLIC KEY-----
                      MFkwEwYHKoZIzj0CAQYIK...
                      -----END PUBLIC KEY-----
```

`Audit` 모드에서 시작해 서명되지 않은 이미지 목록을 파악한 후, `Enforce`로 전환해 차단을 활성화하는 단계적 접근이 중요하다. 모든 이미지에 일괄 적용하면 시스템 이미지나 사이드카 이미지가 차단될 수 있다.

## SBOM 생성 및 첨부

Software Bill of Materials(SBOM)은 이미지에 포함된 모든 패키지 목록이다. Cosign으로 SBOM을 이미지에 첨부하면 감사(Audit) 추적이 가능하다.

```bash
# Syft로 SBOM 생성
syft my-registry/myapp:v2.0.0 -o cyclonedx-json > sbom.json

# Cosign으로 SBOM 첨부
cosign attest --key cosign.key \
  --type cyclonedx \
  --predicate sbom.json \
  my-registry/myapp:v2.0.0

# SBOM 검증 및 조회
cosign verify-attestation \
  --key cosign.pub \
  --type cyclonedx \
  my-registry/myapp:v2.0.0 | jq '.payload | @base64d | fromjson'
```

Cosign의 `attest` 명령으로 서명된 SBOM, 취약점 스캔 결과, 빌드 메타데이터 등을 이미지에 첨부할 수 있다. 이를 통해 "이 이미지는 X 환경에서 Y 시간에 Z가 스캔했고 취약점이 없었음"을 증명할 수 있다.

---

**지난 글:** [컨테이너 이미지 스캔 — Trivy와 취약점 관리](/posts/k8s-image-scanning/)

**다음 글:** [Image Pull Secrets — 프라이빗 레지스트리 인증](/posts/k8s-image-pull-secrets/)

<br>
읽어주셔서 감사합니다. 😊
