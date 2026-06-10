---
title: "컨테이너 이미지 스캔 — Trivy와 취약점 관리"
description: "Trivy를 이용한 컨테이너 이미지 취약점 스캔, CI/CD 파이프라인 통합, SARIF 형식으로 GitHub Security에 업로드, .trivyignore로 예외 처리, 런타임 스캔 도구 비교를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 6
type: "knowledge"
category: "Kubernetes"
tags: ["컨테이너보안", "Trivy", "이미지스캔", "CVE", "공급망보안", "Kubernetes", "DevSecOps"]
featured: false
draft: false
---

[지난 글](/posts/k8s-kustomize-patches-components/)에서 Kustomize의 고급 기능을 살펴봤다. 이번 글에서는 Kubernetes 보안의 핵심 중 하나인 **컨테이너 이미지 취약점 스캔**을 다룬다. 이미지에 알려진 취약점(CVE)이 포함된 채 배포되면 공격 대상이 될 수 있다. Trivy로 CI/CD 파이프라인에 스캔을 통합해 취약점을 조기에 차단하는 방법을 알아본다.

## 왜 이미지 스캔이 필요한가

컨테이너 이미지는 베이스 OS 이미지, 런타임, 애플리케이션 의존성을 모두 포함한다. `python:3.11-slim` 같은 공식 이미지도 취약한 패키지를 포함할 수 있고, npm/pip/maven 의존성도 CVE 데이터베이스에 등록된 취약점을 갖고 있는 경우가 많다. 이미지 스캔은 배포 전에 이러한 위험을 식별하는 첫 번째 방어선이다.

![컨테이너 이미지 스캔 파이프라인](/assets/posts/k8s-image-scanning-workflow.svg)

## Trivy 설치 및 기본 사용법

[Trivy](https://trivy.dev)는 Aqua Security에서 개발한 오픈소스 취약점 스캐너로, 이미지 외에도 파일시스템, Git 리포지토리, IaC 파일까지 스캔할 수 있다.

```bash
# 설치 (Linux)
curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh -s -- -b /usr/local/bin

# 기본 이미지 스캔
trivy image nginx:1.25

# 특정 심각도만 표시
trivy image --severity CRITICAL,HIGH nginx:1.25

# 취약점이 발견되면 비정상 종료 (CI에서 사용)
trivy image --exit-code 1 --severity CRITICAL nginx:1.25

# 수정된 취약점만 표시 (패치 가능한 것만 리포트)
trivy image --ignore-unfixed --severity CRITICAL,HIGH myapp:v2.0.0
```

## CI/CD 파이프라인 통합

![Trivy 스캔 대상 및 .trivyignore](/assets/posts/k8s-image-scanning-trivy.svg)

```yaml
# .github/workflows/scan.yaml
name: Image Security Scan

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  trivy-scan:
    runs-on: ubuntu-latest
    permissions:
      security-events: write   # SARIF 업로드 권한
    steps:
      - uses: actions/checkout@v4

      - name: Build image
        run: docker build -t myapp:${{ github.sha }} .

      - name: Run Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: myapp:${{ github.sha }}
          format: sarif
          output: trivy-results.sarif
          severity: CRITICAL,HIGH
          ignore-unfixed: true
          exit-code: 1

      - name: Upload SARIF to GitHub Security
        uses: github/codeql-action/upload-sarif@v3
        if: always()           # 실패해도 결과 업로드
        with:
          sarif_file: trivy-results.sarif
```

SARIF(Static Analysis Results Interchange Format) 형식으로 결과를 저장하면 GitHub의 Security 탭에서 취약점을 직접 확인하고 관리할 수 있다. `if: always()`를 사용해 스캔이 실패하더라도 결과를 업로드해야 무엇이 문제인지 파악할 수 있다.

## .trivyignore로 예외 처리

모든 CVE를 즉시 수정할 수는 없다. 업스트림 패치가 없거나, 실제 공격 경로가 없는 경우 예외 처리가 필요하다.

```bash
# .trivyignore (프로젝트 루트에 위치)
# 형식: CVE-ID [# 주석]

# OpenSSL 취약점 — 패치 없음, 업스트림 대기 중 (2026-09-01 재검토)
CVE-2024-12345

# 컨테이너 내에서 해당 기능 미사용으로 실질 위험 없음
CVE-2023-67890
```

`.trivyignore`는 코드와 함께 VCS에 관리해야 하며, 각 예외에 대한 이유와 재검토 일정을 주석으로 남기는 것이 필수다. 무분별한 예외 추가는 취약점을 눈가림할 뿐이므로, 코드 리뷰 프로세스에 포함해야 한다.

## 다양한 스캔 모드

```bash
# 파일시스템 스캔 (로컬 디렉토리)
trivy fs --severity CRITICAL,HIGH ./

# IaC 설정 파일 스캔 (Kubernetes YAML, Terraform)
trivy config --severity HIGH,CRITICAL ./k8s/

# Git 리포지토리 스캔 (히스토리 포함)
trivy repo --depth 1 https://github.com/myorg/myapp

# Kubernetes 클러스터 실시간 스캔 (실행 중인 Pod)
trivy k8s --report summary cluster
```

## 런타임 스캔 — Trivy Operator

CI에서의 빌드 타임 스캔 외에, 클러스터에서 실행 중인 이미지를 지속적으로 스캔하려면 **Trivy Operator**를 사용한다.

```bash
# Helm으로 Trivy Operator 설치
helm repo add aquasecurity https://aquasecurity.github.io/helm-charts/
helm install trivy-operator aquasecurity/trivy-operator \
  --namespace trivy-system \
  --create-namespace \
  --set trivy.ignoreUnfixed=true

# 스캔 결과 확인 (VulnerabilityReport CRD)
kubectl get vulnerabilityreports -n default
kubectl describe vulnerabilityreport replicaset-myapp-xxx-myapp
```

Trivy Operator는 새 Pod가 생성될 때마다 자동으로 스캔을 실행하고, `VulnerabilityReport` CRD로 결과를 저장한다. kube-state-metrics와 연동하면 Grafana 대시보드에서 클러스터 전체 취약점 현황을 모니터링할 수 있다.

## 다른 이미지 스캔 도구 비교

| 도구 | 장점 | 단점 |
|---|---|---|
| **Trivy** | 빠름, 다양한 스캔 대상, 오픈소스 | - |
| **Grype** | Anchore 생태계 연동, SBOM 생성 | - |
| **Snyk** | 개발자 친화적 UI, 자동 PR 생성 | 유료 플랜 필요 |
| **Clair** | 중앙 집중식 DB | 설정 복잡 |

대부분의 새 프로젝트에서는 Trivy가 첫 선택이 된다. 설치와 설정이 간단하고 다양한 형식(table, JSON, SARIF, CycloneDX)을 지원하며, Kubernetes 클러스터 스캔까지 하나의 도구로 처리할 수 있기 때문이다.

---

**지난 글:** [Kustomize Patches &amp; Components — 세밀한 설정 제어](/posts/k8s-kustomize-patches-components/)

**다음 글:** [이미지 서명 — Cosign과 공급망 보안](/posts/k8s-image-signing-cosign/)

<br>
읽어주셔서 감사합니다. 😊
