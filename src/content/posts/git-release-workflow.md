---
title: "릴리스 워크플로 — 태그 기반 배포 자동화"
description: "Git 태그를 기반으로 CI/CD 파이프라인을 트리거하는 릴리스 워크플로, GitHub Actions 연동, 릴리스 노트 자동화를 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 6
type: "knowledge"
category: "Git"
tags: ["Git", "릴리스", "tag", "CI/CD", "GitHub Actions", "배포"]
featured: false
draft: false
---

[지난 글](/posts/git-describe/)에서 `git describe`로 버전 식별자를 자동 생성하는 방법을 살펴봤다. 이번에는 **태그 push를 CI/CD 트리거로 활용하는 릴리스 워크플로** 전체를 정리한다. 수동 배포에서 벗어나 태그 하나로 빌드·테스트·배포·릴리스 노트 생성까지 자동화하는 흐름이다.

## 태그 기반 릴리스의 핵심 원리

릴리스는 "이 커밋이 특정 버전이다"라는 선언이다. Git 태그가 바로 그 선언의 역할을 한다. 태그를 원격에 push하는 순간 CI/CD가 이를 감지해 자동으로 릴리스 파이프라인을 시작한다.

```bash
# 릴리스 준비
git switch main
git pull origin main

# Annotated 태그 생성
git tag -a v1.2.0 -m "Release v1.2.0: 새 기능 추가 및 버그 수정"

# 코드와 태그 동시 push
git push origin main --follow-tags
```

이 세 단계가 태그 기반 릴리스의 전부다. 나머지는 CI/CD가 알아서 처리한다.

![릴리스 워크플로 단계](/assets/posts/git-release-workflow-steps.svg)

## GitHub Actions 태그 트리거 설정

```yaml
name: Release

on:
  push:
    tags:
      - 'v[0-9]*.*[0-9]'   # v1.0, v1.2.3 패턴만

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0   # 전체 히스토리 (git describe 사용 위해)

      - name: Get version
        run: echo "VERSION=${GITHUB_REF_NAME}" >> $GITHUB_ENV

      - name: Build
        run: make build VERSION=${{ env.VERSION }}

      - name: Test
        run: make test

      - name: Create GitHub Release
        run: |
          gh release create ${{ env.VERSION }} \
            --title "Release ${{ env.VERSION }}" \
            --generate-notes
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`GITHUB_REF_NAME`은 트리거된 태그 이름이 자동으로 들어온다. `--generate-notes`는 이전 릴리스 이후 커밋 메시지를 자동으로 수집해 릴리스 노트를 작성한다.

## CHANGELOG와 버전 파일 동기화

릴리스 전에 프로젝트 내 버전 파일을 업데이트하고 커밋한 후 태그를 붙이는 것이 일반적이다.

```bash
# 1. 버전 파일 업데이트
sed -i 's/version = .*/version = "1.2.0"/' pyproject.toml
# 또는
npm version 1.2.0 --no-git-tag-version

# 2. CHANGELOG 업데이트
# (수동 또는 git-cliff, conventional-changelog 활용)

# 3. 변경 커밋
git add pyproject.toml CHANGELOG.md
git commit -m "chore: bump version to v1.2.0"

# 4. 태그 붙이기
git tag -a v1.2.0 -m "Release v1.2.0"

# 5. push
git push origin main --follow-tags
```

이 순서를 지키면 태그가 붙은 커밋이 버전 파일과 CHANGELOG를 이미 포함하고 있다.

![릴리스 체크리스트](/assets/posts/git-release-workflow-checklist.svg)

## Prerelease 태그

정식 릴리스 전에 알파, 베타, RC 버전을 배포할 때는 SemVer 선행 릴리스 식별자를 활용한다.

```bash
git tag -a v1.2.0-alpha.1 -m "Alpha 1 for v1.2.0"
git tag -a v1.2.0-rc.1    -m "Release Candidate 1"
git tag -a v1.2.0         -m "Release v1.2.0"
```

GitHub Actions에서 prerelease를 분리하려면:

```yaml
- name: Create Prerelease
  if: contains(env.VERSION, '-')
  run: gh release create ${{ env.VERSION }} --prerelease --generate-notes

- name: Create Release
  if: "!contains(env.VERSION, '-')"
  run: gh release create ${{ env.VERSION }} --latest --generate-notes
```

버전 문자열에 `-`가 포함되면 prerelease, 아니면 stable 릴리스로 자동 분기한다.

## 핫픽스 릴리스

프로덕션 버그를 긴급 수정하는 핫픽스는 별도 브랜치에서 처리하고, 릴리스 태그는 main에 merge한 후 붙인다.

```bash
# 핫픽스 브랜치
git switch -c hotfix/v1.2.1 v1.2.0
# ... 수정 ...
git commit -m "fix: critical bug"

# main에 merge
git switch main
git merge hotfix/v1.2.1

# 핫픽스 태그
git tag -a v1.2.1 -m "Hotfix: critical bug fix"
git push origin main --follow-tags

# 브랜치 정리
git branch -d hotfix/v1.2.1
```

릴리스 태그는 반드시 main 브랜치의 커밋에 붙여야 한다. 핫픽스 브랜치 자체에 태그를 붙이는 것은 히스토리를 복잡하게 만든다.

---

**지난 글:** [git describe — 버전 자동 생성](/posts/git-describe/)

**다음 글:** [Semantic Versioning과 Git 태깅](/posts/git-semver-tagging/)

<br>
읽어주셔서 감사합니다. 😊
