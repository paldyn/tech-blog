---
title: "Semantic Versioning과 Git 태깅"
description: "SemVer MAJOR.MINOR.PATCH 규칙, Git 태그와의 연동, 버전 자동화 도구(npm version, git-cliff), prerelease 태그 관리를 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["Git", "SemVer", "tag", "버전 관리", "릴리스", "MAJOR", "MINOR", "PATCH"]
featured: false
draft: false
---

[지난 글](/posts/git-release-workflow/)에서 태그 기반 릴리스 파이프라인 전체를 구성했다. 이번에는 **어떤 버전 번호를 붙여야 하는가**의 기준인 Semantic Versioning과 Git 태그를 체계적으로 연결하는 방법을 다룬다.

## Semantic Versioning 규칙

SemVer는 `MAJOR.MINOR.PATCH` 세 숫자로 소프트웨어의 변경 성격을 표현한다.

- **MAJOR**: 하위 호환이 불가능한 변경 (API 파괴, 인터페이스 변경)
- **MINOR**: 하위 호환을 유지하면서 새 기능 추가
- **PATCH**: 하위 호환을 유지하면서 버그 수정

버전을 올릴 때는 더 높은 자리를 올리면 낮은 자리를 0으로 초기화한다. `v1.2.3` → 신기능 추가 → `v1.3.0` (PATCH가 0으로 리셋).

![SemVer 구조와 규칙](/assets/posts/git-semver-tagging-structure.svg)

## Git 태그와 SemVer 연동

```bash
# 버전별 Annotated 태그 생성
git tag -a v1.2.4 -m "Fix: authentication crash on logout"
git tag -a v1.3.0 -m "Feature: OAuth2 social login support"
git tag -a v2.0.0 -m "BREAKING: new REST API v2, v1 deprecated"

# 버전 순서 확인
git tag --sort=version:refname
```

태그 이름은 `v` 접두사를 붙이는 것이 관례다. `v1.2.3`은 SemVer `1.2.3`과 대응한다. GitHub Releases, npm, Go 모듈 등이 모두 `v` 접두사 태그를 표준으로 인식한다.

![SemVer 태그 생성 명령어](/assets/posts/git-semver-tagging-commands.svg)

## Prerelease 태그

정식 릴리스 전 테스트 단계 버전에는 `-`로 구분된 선행 릴리스 식별자를 붙인다.

```bash
# 알파 (내부 테스트)
git tag -a v2.0.0-alpha.1 -m "Alpha: incomplete features"

# 베타 (외부 테스트)
git tag -a v2.0.0-beta.1  -m "Beta: feature complete"

# RC (릴리스 후보)
git tag -a v2.0.0-rc.1    -m "Release Candidate 1"

# 정식 릴리스
git tag -a v2.0.0         -m "Release v2.0.0"
```

`version:refname` 정렬에서 prerelease는 정식 버전보다 낮게 정렬된다. `v2.0.0-rc.1 < v2.0.0`이므로 목록에서 올바른 순서가 보장된다.

## npm version으로 버전 자동 업데이트

Node.js 프로젝트는 `npm version`으로 `package.json` 수정과 Git 태그 생성을 동시에 처리할 수 있다.

```bash
# 버그 수정 (PATCH++)
npm version patch    # 1.2.3 → 1.2.4, 커밋 + 태그 자동 생성

# 신기능 (MINOR++)
npm version minor    # 1.2.3 → 1.3.0

# 파괴적 변경 (MAJOR++)
npm version major    # 1.2.3 → 2.0.0

# 명시적 버전
npm version 2.0.0-rc.1

# 태그 push
git push origin --follow-tags
```

`npm version`은 자동으로 Lightweight 태그를 생성한다. Annotated 태그가 필요하면 `.npmrc`에 `tag-version-prefix=v`를 설정하고 수동 태그를 추가하거나, 별도 스크립트로 처리한다.

## Conventional Commits와 자동 버전 결정

커밋 메시지를 Conventional Commits 형식으로 작성하면 자동 버전 결정 도구를 활용할 수 있다.

```bash
# fix: → PATCH 올림
git commit -m "fix: resolve null pointer in user service"

# feat: → MINOR 올림
git commit -m "feat: add GraphQL endpoint"

# feat!: 또는 BREAKING CHANGE: → MAJOR 올림
git commit -m "feat!: new authentication flow, breaking API"
```

`semantic-release`, `release-please`, `git-cliff` 같은 도구는 이 커밋 메시지를 분석해 자동으로 버전을 결정하고 태그를 생성한다.

## 버전 파일 동기화 전략

여러 언어·패키지 매니저가 혼합된 모노레포에서 버전을 일관되게 관리하는 패턴이다.

```bash
# VERSION 파일 중앙 관리
echo "1.3.0" > VERSION

# 각 패키지에서 VERSION 파일 참조
# package.json: "version": "$(cat ../../VERSION)"
# pyproject.toml: dynamic = ["version"]

# 태그 생성
VERSION=$(cat VERSION)
git tag -a "v${VERSION}" -m "Release v${VERSION}"
git push origin main --follow-tags
```

단일 진실 공급원(VERSION 파일)을 두고 모든 패키지가 이를 참조하면 버전 불일치 문제를 예방할 수 있다.

## 버전 범위와 의존성 관리

SemVer를 사용하면 소비자(라이브러리 사용자)가 안전하게 의존성 범위를 지정할 수 있다.

```json
{
  "dependencies": {
    "my-lib": "^1.2.0",
    "strict-lib": "~2.3.1",
    "exact-lib": "3.0.0"
  }
}
```

`^1.2.0`은 `1.x.x` 중 `1.2.0` 이상, `~2.3.1`은 `2.3.x` 중 `2.3.1` 이상만 허용한다. MAJOR가 바뀌지 않으면 호환이 보장된다는 SemVer 약속을 신뢰하는 표현이다. 이 약속을 지키지 않으면 사용자의 빌드를 깨뜨리는 라이브러리가 된다.

---

**지난 글:** [릴리스 워크플로 — 태그 기반 배포 자동화](/posts/git-release-workflow/)

**다음 글:** [git commit --amend — 마지막 커밋 수정](/posts/git-amend/)

<br>
읽어주셔서 감사합니다. 😊
