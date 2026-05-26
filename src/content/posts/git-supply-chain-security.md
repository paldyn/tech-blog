---
title: "Git 공급망 보안(Supply Chain Security): 코드 신뢰 체인 구축하기"
description: "커밋 위조·비밀 유출·의존성 혼란·악성 Action 등 Git 공급망 공격 유형과 대응책, GitHub Secret Scanning, GitHub Actions SHA 핀닝, SLSA/Sigstore 프로비넌스 서명, Dependabot 설정까지 실무 보안 레이어를 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 6
type: "knowledge"
category: "Git"
tags: ["Git", "공급망보안", "supply-chain", "secret-scanning", "SLSA", "Sigstore", "Dependabot"]
featured: false
draft: false
---

[지난 글](/posts/git-token-vs-password/)에서 PAT 관리를 다뤘다. 이번에는 더 넓은 시야로 **Git 기반 소프트웨어 공급망 전체**의 보안을 살펴본다. 의존성·CI·서드파티 Action이 모두 공격 경로가 될 수 있다.

## 소프트웨어 공급망이란

소프트웨어는 코드를 직접 작성하는 것 외에도 수많은 외부 요소를 사용한다. npm 패키지, GitHub Actions, Git 서브모듈, 빌드 도구, CI 환경이 모두 공급망(supply chain)이다. 공격자는 이 경로 중 하나를 장악해 최종 소프트웨어에 악성 코드를 심는다.

대표 사례: 2020년 SolarWinds 공격, 2021년 ua-parser-js npm 패키지 하이재킹, 2022년 PyTorch 의존성 혼란 공격.

## 주요 공격 유형과 대응

![공급망 공격 유형](/assets/posts/git-supply-chain-security-threats.svg)

### 1. 커밋 위조 (Author Spoofing)

`git config user.email`은 누구든 임의로 설정할 수 있다. 서명이 없으면 커밋 작성자가 실제 그 사람인지 확인할 방법이 없다.

**대응**: GPG 또는 SSH 서명 + 브랜치 보호 규칙 **Require signed commits** 활성화. 서명 없는 커밋은 main에 push할 수 없도록 강제한다.

### 2. 비밀 정보 유출 (Secret Leak)

API 키, PAT, 데이터베이스 비밀번호가 커밋에 포함되면 공개 레포에서 즉시 노출된다. 히스토리에 남은 비밀은 삭제하기도 어렵다.

**대응**: `git-secrets`, `gitleaks` 등 pre-commit hook으로 push 전 차단. GitHub Secret Scanning으로 push 후 자동 감지 및 revoke.

```bash
# gitleaks pre-commit 설치
brew install gitleaks
gitleaks protect --staged    # staged 파일 스캔
```

### 3. 의존성 혼란 (Dependency Confusion)

내부 레지스트리의 패키지와 같은 이름의 악성 패키지를 공개 npm/PyPI에 올리면, 패키지 매니저가 더 높은 버전으로 판단해 자동 설치할 수 있다.

**대응**: `package-lock.json`(npm), `poetry.lock`(Python), `go.sum`(Go) 등 lockfile을 반드시 커밋. 내부 패키지는 스코프(`@company/pkg`)를 사용하고 프라이빗 레지스트리를 `.npmrc`에 명시한다.

### 4. 악성 GitHub Actions

써드파티 Action이 태그로 참조될 경우, 태그가 다른 커밋으로 이동하면 악성 코드가 실행될 수 있다.

**대응**: SHA 핀닝. 태그 대신 불변인 커밋 SHA를 참조한다.

## GitHub Actions SHA 핀닝

![SHA 핀닝과 Secret Scanning](/assets/posts/git-supply-chain-security-actions.svg)

```yaml
# 위험한 방식 (태그는 변경 가능)
- uses: actions/checkout@v4

# 안전한 방식 (SHA는 불변)
- uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
```

SHA가 변경되면 Dependabot이 자동으로 PR을 열어 준다.

```yaml
# .github/dependabot.yml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
```

## GitHub Secret Scanning

공개·비공개 레포 모두에서 push 시 자동으로 알려진 비밀 패턴을 스캔한다. 감지되면 이메일 경고를 보내고 일부 파트너 서비스(GitHub, AWS 등)에는 자동 revoke도 가능하다.

Settings → Security → Secret scanning에서 활성화 여부를 확인한다. **Push protection**도 함께 활성화하면 비밀이 포함된 push를 서버에서 차단한다.

## SLSA와 Sigstore

SLSA(Supply chain Levels for Software Artifacts)는 빌드 출처(provenance)를 증명하는 프레임워크다. "이 바이너리는 이 소스에서 이 빌드 환경으로 만들어졌다"를 서명해 검증한다.

Sigstore의 `cosign`으로 컨테이너 이미지·바이너리에 키리스(keyless) 서명을 적용할 수 있다.

```bash
# cosign으로 컨테이너 서명
cosign sign --key cosign.key ghcr.io/alice/myapp:latest

# 서명 검증
cosign verify --key cosign.pub ghcr.io/alice/myapp:latest
```

## SBOM 생성

SBOM(Software Bill of Materials)은 소프트웨어에 포함된 모든 구성 요소 목록이다. GitHub는 레포 내 의존성을 자동으로 분석해 SBOM을 JSON으로 내려받는 기능을 제공한다.

```bash
# GitHub CLI로 SBOM 내려받기
gh api repos/alice/repo/dependency-graph/sbom | jq '.'
```

## 실무 체크리스트

- main 브랜치에 Require signed commits 활성화
- Secret Scanning + Push protection 활성화
- GitHub Actions를 SHA로 핀닝하고 Dependabot으로 자동 업데이트
- 모든 lockfile 커밋 (package-lock.json, poetry.lock, go.sum)
- `.env`·비밀 파일은 `.gitignore`에 추가, CI Secrets로 주입
- PAT는 Fine-grained + 최소 스코프 + 만료일 설정

---

**지난 글:** [Token vs Password: GitHub 인증 방식 변천사](/posts/git-token-vs-password/)

**다음 글:** [Git Hooks 개요: 자동화의 시작점](/posts/git-hooks-overview/)

<br>
읽어주셔서 감사합니다. 😊
