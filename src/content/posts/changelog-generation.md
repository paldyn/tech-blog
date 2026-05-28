---
title: "Changelog 자동 생성: 릴리즈 노트를 코드로"
description: "CHANGELOG.md의 Keep a Changelog 표준 포맷, git-cliff와 conventional-changelog로 Conventional Commits에서 자동 생성하는 방법, GitHub Actions 연동, 수동 유지보수 패턴을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["Git", "Changelog", "git-cliff", "ConventionalCommits", "릴리즈", "자동화"]
featured: false
draft: false
---

[지난 글](/posts/semantic-release/)에서 semantic-release로 전체 릴리즈 파이프라인을 자동화하는 방법을 다뤘다. 이번에는 그 핵심 산출물 중 하나인 **CHANGELOG.md**에 집중한다. 릴리즈 노트를 수동으로 작성하면 빠뜨리거나 다음 릴리즈 때 밀리게 된다. Conventional Commits를 사용하면 변경 이력에서 changelog를 자동 생성할 수 있다.

## Keep a Changelog 포맷

가장 널리 쓰이는 표준은 [keepachangelog.com](https://keepachangelog.com)이 정의한 포맷이다.

![CHANGELOG.md 표준 형식](/assets/posts/changelog-generation-format.svg)

```markdown
# Changelog

## [Unreleased]
### Added
- 아직 릴리즈되지 않은 변경

## [1.3.0] - 2026-05-29
### Added
- GraphQL API 엔드포인트 추가
- 다크모드 지원

### Fixed
- 인증 토큰 갱신 오류 수정
- 검색 결과 정렬 오류 수정

## [1.2.1] - 2026-05-15
### Fixed
- CSS 빌드 경로 오류 수정
```

`[Unreleased]` 섹션은 다음 릴리즈를 준비하는 공간이다. 릴리즈 시 이 섹션이 새 버전 번호 섹션으로 전환된다.

## 자동 생성 도구

![Changelog 생성 흐름](/assets/posts/changelog-generation-flow.svg)

### git-cliff

Rust로 작성된 빠른 changelog 생성기다. `cliff.toml`로 세밀한 커스터마이징이 가능하다.

```bash
# 설치
cargo install git-cliff
# 또는
npm install -g git-cliff

# 마지막 태그부터 현재까지
git cliff --tag v1.3.0 -o CHANGELOG.md

# unreleased 변경만 출력
git cliff --unreleased

# 전체 히스토리
git cliff --output CHANGELOG.md
```

`cliff.toml` 설정 예시:

```toml
[changelog]
header = "# Changelog\n\n"
body = """
{% if version %}## [{{ version | trim_start_matches("v") }}] - {{ timestamp | date(format="%Y-%m-%d") }}{% endif %}
{% for group, commits in commits | group_by(attribute="group") %}
### {{ group | upper_first }}
{% for commit in commits %}
- {{ commit.message | upper_first }}
{% endfor %}
{% endfor %}
"""
trim = true

[git]
conventional_commits = true
filter_unconventional = true
commit_parsers = [
  { message = "^feat", group = "Added" },
  { message = "^fix", group = "Fixed" },
  { message = "^perf", group = "Performance" },
  { message = "^chore", skip = true },
  { message = "^docs", skip = true },
]
```

### conventional-changelog

npm 에코시스템의 표준. `semantic-release`와 자연스럽게 통합된다.

```bash
npm install -g conventional-changelog-cli

# Angular 프리셋으로 CHANGELOG.md 생성
conventional-changelog -p angular -i CHANGELOG.md -s

# 전체 히스토리 재생성
conventional-changelog -p angular -i CHANGELOG.md -s -r 0
```

## GitHub Actions 자동화

```yaml
# .github/workflows/changelog.yml
name: Update Changelog
on:
  push:
    tags:
      - 'v*'

jobs:
  changelog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # 전체 히스토리 필요

      - name: Install git-cliff
        run: cargo install git-cliff

      - name: Generate Changelog
        run: git cliff --tag ${{ github.ref_name }} -o CHANGELOG.md

      - name: Commit and push
        run: |
          git config user.email "actions@github.com"
          git config user.name "GitHub Actions"
          git add CHANGELOG.md
          git commit -m "chore: CHANGELOG 업데이트 ${{ github.ref_name }}"
          git push
```

## 수동 유지보수 패턴

자동화 없이도 `[Unreleased]` 패턴을 활용하면 changelog를 체계적으로 유지할 수 있다.

```markdown
## [Unreleased]
### Added
- 검색 필터 기능 (PR #234)

### Fixed
- 로그인 후 리다이렉트 오류 (PR #235, #238)
```

PR마다 `[Unreleased]` 섹션에 한 줄을 추가하는 것을 PR 체크리스트에 넣으면, 릴리즈 시 버전 번호만 채우면 된다.

## 무엇을 써야 하나

| 상황 | 권장 |
|---|---|
| semantic-release 사용 중 | `@semantic-release/changelog` 플러그인 |
| Rust 프로젝트 또는 커스터마이징 필요 | git-cliff |
| Node.js 프로젝트, 단독 사용 | conventional-changelog |
| 소규모 팀, 자동화 부담 | 수동 Keep a Changelog |

어떤 방법을 쓰든 **Conventional Commits 메시지 품질이 changelog 품질을 결정**한다. 커밋 메시지가 뭉뚱그려지면 생성된 changelog도 뭉뚱그려진다.

---

**지난 글:** [Semantic Release: 자동 버전 관리와 릴리즈](/posts/semantic-release/)

<br>
읽어주셔서 감사합니다. 😊
