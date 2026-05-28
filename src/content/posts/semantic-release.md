---
title: "Semantic Release: 자동 버전 관리와 릴리즈"
description: "semantic-release가 커밋 메시지에서 버전 번호를 결정하는 원리, fix·feat·BREAKING CHANGE 유형별 SemVer 범프 규칙, 플러그인 구성, GitHub Actions 연동 방법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "SemanticRelease", "SemVer", "CI/CD", "자동배포", "버전관리"]
featured: false
draft: false
---

[지난 글](/posts/merge-vs-rebase-policy/)에서 머지 정책을 다뤘다. 코드가 main에 합쳐지면 다음 단계는 릴리즈다. 버전 번호를 수동으로 올리고 태그를 붙이고 GitHub Release를 작성하는 작업은 반복적이고 실수가 나기 쉽다. **semantic-release**는 커밋 메시지에서 버전 번호를 자동으로 결정하고, 태그 생성부터 CHANGELOG 업데이트, GitHub Release 생성까지 전체 릴리즈 파이프라인을 자동화한다.

## 동작 원리

semantic-release는 **Conventional Commits** 형식을 전제로 한다. main에 push가 발생하면 마지막 태그 이후의 커밋을 분석해 다음 버전을 결정한다.

![Semantic Release 자동 릴리즈 흐름](/assets/posts/semantic-release-flow.svg)

## 버전 범프 규칙

SemVer(Semantic Versioning)는 `MAJOR.MINOR.PATCH` 형식이다.

- `fix:` → **PATCH** 증가 (1.2.3 → 1.2.4)
- `feat:` → **MINOR** 증가 (1.2.3 → 1.3.0)
- `feat!:` 또는 커밋 footer에 `BREAKING CHANGE:` → **MAJOR** 증가 (1.2.3 → 2.0.0)
- `chore:`, `docs:`, `style:`, `test:` → 릴리즈 없음

한 번의 릴리즈에 여러 타입이 섞이면 **가장 높은 타입**이 적용된다. `fix:` 3개와 `feat:` 1개가 있으면 MINOR 릴리즈다.

```bash
# 이 커밋들이 main에 쌓인 경우
feat(api): GraphQL 엔드포인트 추가
fix(auth): 토큰 만료 시 자동 갱신 오류
docs: README 업데이트

# semantic-release 결과
# → v1.3.0 (feat: 가 있으므로 MINOR 릴리즈)
# → CHANGELOG.md 업데이트
# → GitHub Release v1.3.0 생성
```

## 설치 및 설정

```bash
npm install --save-dev semantic-release \
  @semantic-release/commit-analyzer \
  @semantic-release/release-notes-generator \
  @semantic-release/changelog \
  @semantic-release/npm \
  @semantic-release/github \
  @semantic-release/git
```

![semantic-release 설정 예시](/assets/posts/semantic-release-config.svg)

## 플러그인 역할

| 플러그인 | 역할 |
|---|---|
| `commit-analyzer` | 커밋 메시지 분석 → 버전 범프 결정 |
| `release-notes-generator` | 릴리즈 노트 작성 |
| `changelog` | `CHANGELOG.md` 파일 업데이트 |
| `npm` | `package.json` 버전 업 + `npm publish` |
| `github` | GitHub Release 생성 + 태그 push |
| `git` | 변경된 파일(CHANGELOG.md 등) 커밋 |

## 사전 조건

```bash
# 저장소에 최초 태그가 없으면 v1.0.0으로 시작
git tag v1.0.0
git push origin v1.0.0

# NPM 패키지라면 .npmrc에 토큰 설정
# GitHub Actions Secrets에 NPM_TOKEN 추가
```

## 브랜치별 사전 릴리즈

`release.config.js`에서 prerelease 채널을 설정할 수 있다.

```js
module.exports = {
  branches: [
    'main',
    { name: 'beta', prerelease: true },
    { name: 'alpha', prerelease: true }
  ]
}
```

`beta` 브랜치에 push하면 `v1.3.0-beta.1` 형태의 prerelease 버전이 생성된다. main 머지 시 정식 버전으로 승격된다.

## semantic-release를 사용하기 전에

- 팀 전체가 **Conventional Commits** 형식을 지켜야 한다. 하나라도 형식이 깨지면 버전 결정이 부정확해진다
- `commitlint` + `husky`로 로컬 커밋 단계에서 형식을 강제하는 것이 선행 조건이다
- `GITHUB_TOKEN`의 권한이 충분해야 한다 (태그·릴리즈 쓰기 권한)

---

**지난 글:** [Merge vs Rebase: 팀에 맞는 병합 정책 고르기](/posts/merge-vs-rebase-policy/)

**다음 글:** [Changelog 자동 생성: 릴리즈 노트를 코드로](/posts/changelog-generation/)

<br>
읽어주셔서 감사합니다. 😊
