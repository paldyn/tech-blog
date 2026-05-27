---
title: "Gitflow release와 hotfix 브랜치"
description: "Gitflow의 release 브랜치 생성과 QA 버그픽스, main과 develop 이중 머지, 버전 태그 생성 절차, hotfix 브랜치로 프로덕션 긴급 패치를 처리하는 방법과 두 브랜치의 차이를 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "Gitflow", "release", "hotfix", "버전관리", "태그"]
featured: false
draft: false
---

[지난 글](/posts/gitflow-feature-branch/)에서 feature 브랜치로 기능을 개발하고 develop에 머지하는 과정을 다뤘다. develop에 충분한 기능이 쌓이면 릴리즈를 준비할 차례다. **release 브랜치**와 **hotfix 브랜치**는 둘 다 main으로 들어가지만 출발지와 목적이 다르다.

## release 브랜치

release 브랜치는 프로덕션 배포를 준비하는 브랜치다.

- **출발지**: develop
- **목적지**: main AND develop
- **목적**: QA, 버전 번호 업데이트, 막판 버그픽스
- **규칙**: 새 기능(feat) 추가 금지 — 버그픽스만

### release 시작

```bash
# git-flow CLI (develop 최신 기준으로 분기)
git flow release start 1.1.0

# git 직접
git checkout develop
git checkout -b release/1.1.0
```

### release 브랜치에서 할 일

```bash
# 버전 번호 업데이트
npm version minor  # package.json, package-lock.json 자동 수정
git add package.json package-lock.json
git commit -m "chore: bump version to 1.1.0"

# QA에서 발견된 버그 수정
git commit -m "fix(auth): 세션 만료 메시지 오류 수정"
git commit -m "fix(ui): IE11 레이아웃 깨짐 수정"
```

release 브랜치에서 발견한 버그는 여기서 바로 수정한다. develop으로 돌아가지 않는다.

### release 완료

```bash
# git-flow CLI
# main에 머지 + 태그 생성 + develop에 머지 + 브랜치 삭제
git flow release finish 1.1.0

# 태그 메시지 편집기가 열림 → 릴리즈 노트 작성

# main, develop, 태그를 원격에 push
git push origin main develop
git push origin --tags
```

![release / hotfix 브랜치 흐름](/assets/posts/gitflow-release-hotfix-flow.svg)

`git flow release finish`는 다음 세 가지를 자동으로 처리한다.

1. release/1.1.0 → main으로 `--no-ff` 머지
2. main에 `v1.1.0` 태그 생성
3. release/1.1.0 → develop으로 `--no-ff` 머지
4. release/1.1.0 브랜치 삭제

develop에도 머지하는 이유는 release 브랜치의 버그픽스를 develop에도 반영하기 위해서다.

## hotfix 브랜치

hotfix 브랜치는 프로덕션에서 발생한 **긴급 버그**를 처리한다. develop의 상태와 무관하게 main에서 바로 분기한다.

- **출발지**: main
- **목적지**: main AND develop
- **목적**: 프로덕션 긴급 패치
- **규칙**: 최소한의 변경만

### hotfix 시작

```bash
# git-flow CLI (현재 main 기준으로 분기)
git flow hotfix start 1.1.1

# git 직접
git checkout main
git checkout -b hotfix/1.1.1
```

### hotfix 작업

```bash
# 긴급 수정
git commit -m "fix: NullPointerException on user logout"

# 패치 버전 업데이트
npm version patch
git add package.json
git commit -m "chore: bump version to 1.1.1"
```

### hotfix 완료

```bash
git flow hotfix finish 1.1.1
git push origin main develop
git push origin --tags
```

![release와 hotfix 주요 명령어](/assets/posts/gitflow-release-hotfix-commands.svg)

## release와 hotfix 비교

| 항목 | release | hotfix |
|------|---------|--------|
| 출발지 | develop | main |
| 머지 목적지 | main + develop | main + develop |
| 태그 생성 | 예 | 예 |
| 용도 | 계획된 릴리즈 | 긴급 프로덕션 패치 |
| 개발 중 feature | 추가 금지 | 추가 금지 |

## hotfix 중 release 브랜치가 있는 경우

release 브랜치가 존재하는 동안 hotfix를 완료하면 **develop 대신 release 브랜치**에 머지해야 할 수 있다. release가 곧 main에 들어갈 것이기 때문이다.

```bash
# hotfix를 release 브랜치에 머지
git checkout release/1.1.0
git merge hotfix/1.0.1

# release finish 시 develop으로 자동 전파됨
git flow release finish 1.1.0
```

---

**지난 글:** [Gitflow feature 브랜치 워크플로우](/posts/gitflow-feature-branch/)

**다음 글:** [GitHub Flow: 단순하고 빠른 브랜치 전략](/posts/github-flow-overview/)

<br>
읽어주셔서 감사합니다. 😊
