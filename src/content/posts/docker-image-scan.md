---
title: "Docker 이미지 취약점 스캔: Trivy와 Docker Scout"
description: "Trivy, Docker Scout, Grype를 이용한 컨테이너 이미지 CVE 스캔, CI/CD 파이프라인 통합, SBOM 생성, 취약점 우선순위 결정 전략을 실전 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 4
type: "knowledge"
category: "Docker"
tags: ["docker", "security", "trivy", "docker-scout", "CVE", "취약점", "스캔", "SBOM"]
featured: false
draft: false
---

[지난 글](/posts/docker-content-trust/)에서 이미지 서명으로 변조를 방지하는 방법을 다뤘다. 이번에는 이미지 **내부의 취약점(CVE)**을 찾아내는 스캔 방법을 살펴본다. 서명이 "이 이미지가 내가 만든 것임"을 보장한다면, 취약점 스캔은 "이 이미지가 안전한가"를 검사한다.

## 왜 이미지를 스캔해야 하는가

컨테이너 이미지는 수십~수백 개의 패키지를 포함한다. 베이스 이미지(예: `node:20-alpine`)만 해도 이미 다수의 패키지가 들어있고, 그 중 일부는 알려진 CVE를 가진다.

```bash
# 이미지 안에 포함된 패키지 예시
docker run --rm node:20-alpine sh -c "apk info | wc -l"
# → 수십 개의 Alpine 패키지

# 그 중 취약한 패키지가 있을 수 있다
```

취약점 스캔을 CI에 통합해 새로운 CVE가 프로덕션에 배포되기 전에 차단하는 것이 목표다.

## Trivy

Aqua Security의 오픈소스 스캐너로 가장 널리 쓰인다.

```bash
# 설치 (Homebrew)
brew install aquasecurity/trivy/trivy

# Linux (스크립트)
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

# 기본 스캔
trivy image node:20-alpine

# 심각도 필터 (HIGH 이상만)
trivy image --severity HIGH,CRITICAL node:20-alpine

# JSON 출력
trivy image --format json --output result.json node:20-alpine

# 로컬 빌드된 이미지 스캔
trivy image myapp:latest
```

### Trivy 출력 해석

```
node:20-alpine (alpine 3.19.0)
Total: 3 (HIGH: 1, MEDIUM: 2)

┌──────────────┬───────────────┬──────────┬──────────────────┐
│   Library    │ Vulnerability │ Severity │ Fixed Version    │
├──────────────┼───────────────┼──────────┼──────────────────┤
│ openssl      │ CVE-2024-XXXX │ HIGH     │ 3.1.5-r0         │
│ libcrypto3   │ CVE-2024-YYYY │ MEDIUM   │ 3.1.5-r0         │
└──────────────┴───────────────┴──────────┴──────────────────┘
```

`Fixed Version`이 있으면 베이스 이미지를 최신 버전으로 업데이트하거나 해당 패키지만 업그레이드해 해결할 수 있다.

### Dockerfile에서 패키지 업그레이드

```dockerfile
FROM node:20-alpine
# 알려진 취약한 패키지만 선택 업그레이드
RUN apk upgrade --no-cache openssl libcrypto3
# 전체 업그레이드 (트레이드오프: 재현성 감소)
# RUN apk upgrade --no-cache
```

## Docker Scout

Docker 공식 취약점 스캐너로 Docker Desktop과 CLI에 통합되어 있다.

```bash
# Docker Scout 활성화 (로그인 필요)
docker login

# 빠른 요약
docker scout quickview myimage:latest

# CVE 전체 목록
docker scout cves myimage:latest

# 심각도 필터
docker scout cves --only-severity critical,high myimage:latest

# 베이스 이미지 비교 (어떤 이미지로 바꾸면 CVE가 줄어드는지)
docker scout recommendations myimage:latest
```

Scout의 `recommendations` 명령은 더 안전한 베이스 이미지를 자동으로 추천해준다.

```bash
# 출력 예시
# Base image recommendation:
#   node:20-alpine → node:20.11-alpine3.19
#   (reduces CVE count from 15 to 3)
```

![이미지 취약점 스캔 도구 비교](/assets/posts/docker-image-scan-tools.svg)

## SBOM(Software Bill of Materials)

SBOM은 이미지에 포함된 모든 소프트웨어 구성 요소 목록이다. 새 CVE가 발표됐을 때 어떤 이미지가 영향받는지 빠르게 파악할 수 있다.

```bash
# Trivy로 SBOM 생성 (CycloneDX 형식)
trivy image --format cyclonedx --output sbom.json myapp:latest

# Syft(Anchore)로 SBOM 생성
syft myapp:latest -o cyclonedx-json > sbom.json

# Grype로 SBOM 기반 스캔 (이미지 없이 SBOM만으로 스캔 가능)
grype sbom:sbom.json
```

## CI/CD 통합

취약점 스캔은 이미지 빌드 직후, 레지스트리 push 전에 실행하는 것이 이상적이다.

![CI 파이프라인에서 이미지 스캔](/assets/posts/docker-image-scan-ci.svg)

### GitHub Actions (Trivy)

```yaml
- name: Trivy vulnerability scan
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: myapp:${{ github.sha }}
    severity: 'CRITICAL,HIGH'
    exit-code: '1'        # 취약점 발견 시 빌드 실패
    format: 'sarif'
    output: 'trivy-results.sarif'

- name: Upload SARIF to GitHub Security
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: trivy-results.sarif
```

SARIF 형식으로 업로드하면 GitHub Security 탭에서 결과를 시각적으로 확인할 수 있다.

### GitLab CI

```yaml
trivy-scan:
  image: aquasec/trivy:latest
  script:
    - trivy image
        --exit-code 1
        --severity CRITICAL,HIGH
        --no-progress
        $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA
  allow_failure: false
```

### 로컬 pre-push 훅

```bash
#!/bin/sh
# .git/hooks/pre-push
IMAGE=$(grep 'image:' Dockerfile | head -1 | awk '{print $2}')
trivy image --exit-code 1 --severity CRITICAL $IMAGE
```

## 취약점 우선순위 결정

스캔 결과에 수백 개의 CVE가 나왔다고 해서 모두 즉시 고쳐야 하는 것은 아니다.

```bash
# 실제로 수정 가능한 취약점만 보기 (fix-availability 필터)
trivy image --ignore-unfixed myapp:latest

# CVSSv3 점수 8.0 이상만
trivy image --severity CRITICAL myapp:latest
```

**우선순위 기준**:
1. **Fix Available + CRITICAL/HIGH** — 즉시 패치
2. **No Fix + CRITICAL** — 베이스 이미지 교체 또는 distroless/scratch 고려
3. **MEDIUM with Fix** — 다음 릴리즈에 포함
4. **LOW/NEGLIGIBLE** — 무시 또는 `.trivyignore`에 등록

### .trivyignore로 오탐 제외

```bash
# .trivyignore
# 오탐 또는 영향 없는 CVE 제외 (재현 불가하거나 non-exploitable)
CVE-2023-XXXXX
CVE-2024-YYYYY
```

## 런타임 스캔

이미지 빌드 시점뿐만 아니라 이미 실행 중인 컨테이너도 스캔할 수 있다.

```bash
# 실행 중인 컨테이너 스캔
trivy image --input <(docker export mycontainer)

# 또는 컨테이너 ID로
trivy image $(docker inspect --format='{{.Image}}' mycontainer)
```

## 스캔 도구 선택 가이드

- **개인 프로젝트 / 오픈소스**: Trivy (무료, 기능 풍부)
- **Docker Hub 중심 워크플로우**: Docker Scout (CLI 통합 편리)
- **Anchore 엔터프라이즈 연동**: Grype + Syft
- **Kubernetes 환경**: Trivy Operator (클러스터 내 지속 스캔)

---

**지난 글:** [Docker Content Trust: 이미지 서명으로 공급망 공격 방지](/posts/docker-content-trust/)

**다음 글:** [Docker 읽기 전용 루트 파일 시스템: --read-only 완전 활용](/posts/docker-readonly-rootfs/)

<br>
읽어주셔서 감사합니다. 😊
