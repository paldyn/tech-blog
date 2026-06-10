---
title: "SBOM: 소프트웨어 자재명세서로 공급망 가시성 확보"
description: "SPDX·CycloneDX SBOM 표준, Syft·cdxgen으로 자동 생성, Grype·Trivy로 CVE 스캔, GitHub Actions CI 통합, EO 14028·EU CRA 규정 준수를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 6
type: "knowledge"
category: "Security"
tags: ["SBOM", "CycloneDX", "SPDX", "공급망보안", "Syft", "Grype", "CVE"]
featured: false
draft: false
---

[지난 글](/posts/websec-dependency-confusion/)에서 Dependency Confusion 공격을 살펴봤다. 이번 글은 소프트웨어 구성 요소 전체를 투명하게 기록하는 SBOM(Software Bill of Materials)의 생성, 활용, CI 통합을 다룬다.

![SBOM 구성 요소와 활용](/assets/posts/websec-sbom-overview.svg)

## SBOM이란

SBOM은 소프트웨어에 포함된 모든 구성 요소(라이브러리, 프레임워크, OS 패키지)의 이름, 버전, 라이선스, 출처를 기계가 읽을 수 있는 형태로 기록한 문서다. 물리적 제품의 자재명세서(Bill of Materials)를 소프트웨어에 적용한 개념이다.

2021년 SolarWinds 공급망 공격 이후 미국 정부는 행정명령 EO 14028을 통해 연방 정부에 납품하는 소프트웨어에 SBOM을 의무화했다. EU Cyber Resilience Act(CRA)도 2025년부터 SBOM 제출을 요구한다.

SBOM으로 할 수 있는 것:

- **Log4Shell 같은 제로데이 발생 시** 영향받는 제품을 수 분 내 파악
- **라이선스 충돌 자동 탐지** (GPL 코드가 상용 제품에 포함되는 경우)
- **규정 준수 증명** (공급망 구성 요소 투명성)
- **취약점 지속 모니터링** (새 CVE 발표 시 SBOM과 자동 매핑)

## SBOM 표준 포맷

```json
// SPDX 2.3 JSON 예시 (일부)
{
  "spdxVersion": "SPDX-2.3",
  "dataLicense": "CC0-1.0",
  "SPDXID": "SPDXRef-DOCUMENT",
  "name": "my-application",
  "packages": [
    {
      "SPDXID": "SPDXRef-lodash",
      "name": "lodash",
      "versionInfo": "4.17.21",
      "supplier": "Organization: OpenJS Foundation",
      "downloadLocation": "https://registry.npmjs.org/lodash",
      "licenseConcluded": "MIT",
      "externalRefs": [
        {
          "referenceCategory": "SECURITY",
          "referenceType": "cpe23Type",
          "referenceLocator": "cpe:2.3:a:lodash:lodash:4.17.21:*:*:*:*:*:*:*"
        }
      ]
    }
  ]
}
```

CycloneDX는 OWASP가 관리하며 보안 중심 필드(취약점 정보, 컴포넌트 해시, 서명)가 더 풍부하다.

## Syft로 SBOM 생성

![SBOM 생성 및 취약점 스캔 워크플로우](/assets/posts/websec-sbom-workflow.svg)

```bash
# 설치
brew install syft  # macOS
curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh

# Docker 이미지에서 SBOM 생성
syft myapp:latest -o spdx-json > sbom.spdx.json
syft myapp:latest -o cyclonedx-json > sbom.cdx.json

# 로컬 디렉토리에서 생성
syft dir:/app -o spdx-json > sbom.spdx.json

# Grype로 SBOM 취약점 스캔
grype sbom:sbom.spdx.json

# 심각도 HIGH 이상이면 종료 코드 1 반환 (CI 차단)
grype sbom:sbom.spdx.json --fail-on high

# 결과 JSON 저장
grype sbom:sbom.spdx.json -o json > vulnerabilities.json
```

## GitHub Actions CI 통합

```yaml
# .github/workflows/sbom.yml
name: SBOM + Vulnerability Scan

on: [push, pull_request]

jobs:
  sbom:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4

    - name: Build Docker image
      run: docker build -t myapp:${{ github.sha }} .

    - name: Generate SBOM (CycloneDX)
      uses: anchore/sbom-action@v0
      with:
        image: myapp:${{ github.sha }}
        format: cyclonedx-json
        output-file: sbom.cdx.json

    - name: Scan SBOM with Grype
      uses: anchore/scan-action@v3
      id: scan
      with:
        sbom: sbom.cdx.json
        fail-build: true
        severity-cutoff: high

    - name: Upload SBOM as artifact
      uses: actions/upload-artifact@v4
      with:
        name: sbom
        path: sbom.cdx.json

    - name: Attest SBOM (Sigstore)
      uses: actions/attest-sbom@v1
      with:
        subject-name: myapp
        sbom-path: sbom.cdx.json
```

## Trivy로 컨테이너 이미지 + SBOM 통합 스캔

```bash
# 이미지 취약점 스캔과 SBOM 동시 생성
trivy image \
  --format cyclonedx \
  --output sbom.cdx.json \
  myapp:latest

# SBOM에서 추가 취약점 스캔
trivy sbom sbom.cdx.json \
  --severity HIGH,CRITICAL \
  --exit-code 1

# GitHub Security Tab에 SARIF 업로드
trivy image \
  --format sarif \
  --output trivy-results.sarif \
  myapp:latest
```

## Log4Shell 대응 시뮬레이션

```bash
# Log4Shell 발생 시 SBOM으로 영향 범위 즉시 파악
# 모든 SBOM에서 log4j 포함 여부 검색
find /sboms -name "*.json" -exec \
  python3 -c "
import sys, json
with open(sys.argv[1]) as f:
    sbom = json.load(f)
for comp in sbom.get('components', []):
    if 'log4j' in comp.get('name', '').lower():
        ver = comp.get('version', '?')
        print(f'{sys.argv[1]}: {comp[\"name\"]}@{ver}')
" {} \;

# Grype로 특정 CVE 영향 확인
grype sbom:sbom.json \
  --only-fixed \
  -q \
  | grep "CVE-2021-44228"
```

SBOM이 없으면 수백 개 서비스의 의존성을 수동으로 확인해야 한다. SBOM이 있으면 같은 작업이 수 분 내에 완료된다.

---

**지난 글:** [Dependency Confusion: 공급망 패키지 하이재킹 공격](/posts/websec-dependency-confusion/)

**다음 글:** [DDoS 완화: 분산 서비스 거부 공격 방어 전략](/posts/websec-ddos-mitigation/)

<br>
읽어주셔서 감사합니다. 😊
