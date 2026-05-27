---
title: "Gitflow: 브랜치 전략 개요"
description: "Gitflow 워크플로우의 다섯 가지 브랜치(main, develop, feature, release, hotfix)의 역할과 분기/머지 규칙, git-flow CLI 초기화, Gitflow가 적합한 프로젝트 유형을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["Git", "Gitflow", "브랜치전략", "워크플로우", "release", "hotfix"]
featured: false
draft: false
---

[지난 글](/posts/git-commitlint/)에서 커밋 메시지 형식을 자동 검증하는 commitlint를 다뤘다. 코드 품질과 커밋 형식을 자동화했다면 이제 **브랜치 전략**을 정할 차례다. **Gitflow**는 Vincent Driessen이 2010년에 제안한 브랜치 모델로, 명확한 릴리즈 주기가 있는 프로젝트에 널리 사용된다.

## 다섯 가지 브랜치

Gitflow는 **두 개의 영구 브랜치**와 **세 가지 임시 브랜치**로 구성된다.

### 영구 브랜치

**main**: 프로덕션에 배포된 코드만 보관한다. 릴리즈마다 버전 태그(`v1.0`, `v1.1`)가 부착된다. 직접 커밋하지 않는다.

**develop**: 다음 릴리즈를 위한 통합 브랜치. feature 브랜치들이 여기로 머지되고, 릴리즈가 준비되면 release 브랜치로 분기된다.

### 임시 브랜치

**feature/**: 새 기능 개발. develop에서 분기하고, 완료 후 develop에 머지된다.

**release/**: 릴리즈 준비. develop에서 분기해 QA·버그픽스 후 main과 develop 양쪽에 머지된다.

**hotfix/**: 프로덕션 긴급 수정. main에서 분기해 수정 후 main과 develop 양쪽에 머지된다.

![Gitflow 브랜치 구조](/assets/posts/gitflow-overview-branches.svg)

## 브랜치 명명 규칙

```
feature/user-authentication
feature/JIRA-123-payment-integration
release/1.2.0
hotfix/1.1.1-null-pointer-fix
```

## git-flow CLI

git-flow는 Gitflow 명령어를 자동화하는 CLI 도구다.

```bash
# 설치 (macOS)
brew install git-flow-avh

# 프로젝트 초기화
git flow init

# 초기화 시 브랜치 이름 확인 (기본값 그대로 엔터)
Branch name for production releases: [main]
Branch name for "next release" development: [develop]
Feature branches? [feature/]
Bugfix branches? [bugfix/]
Release branches? [release/]
Hotfix branches? [hotfix/]
Support branches? [support/]
Version tag prefix? []
```

`git flow init`은 기존 레포에 develop 브랜치를 생성하고 Git 설정(`.git/config`)에 Gitflow 정보를 기록한다.

## 워크플로우 요약

```
1. develop에서 feature 시작
   → git flow feature start user-auth

2. 기능 완료 후 develop에 머지
   → git flow feature finish user-auth

3. 릴리즈 준비
   → git flow release start 1.2.0

4. QA 완료 후 main + develop에 머지, 태그 부착
   → git flow release finish 1.2.0

5. 프로덕션 버그 → main에서 hotfix
   → git flow hotfix start 1.1.1
   → git flow hotfix finish 1.1.1
```

![Gitflow 브랜치별 역할](/assets/posts/gitflow-overview-roles.svg)

## develop와 main의 항상 분기 상태

Gitflow의 핵심 원칙은 **main은 항상 프로덕션 상태**를 반영한다는 것이다. 개발 중인 코드는 develop에만 있고, main에는 릴리즈·hotfix를 통해 검증된 코드만 들어간다.

```
main  ─────●─────────────●──────●
           v1.0          v1.1   v1.1.1
develop ───────────●─────●─────────────
                   ↑    ↑
             feature   release merge
```

## Gitflow의 한계

- 브랜치 수가 많아 복잡하다
- 장기 feature 브랜치가 develop과 diverge하면 머지 충돌이 커진다
- 지속적 배포(CD)를 구현하기 어렵다

하루에도 여러 번 배포하는 웹 서비스라면 GitHub Flow나 Trunk-Based Development가 더 적합하다. Gitflow는 **버전 번호가 있고 릴리즈 주기가 정해진 제품**(모바일 앱, 오픈소스 패키지)에 가장 잘 맞는다.

---

**지난 글:** [commitlint: 커밋 메시지 형식 자동 검증](/posts/git-commitlint/)

**다음 글:** [Gitflow feature 브랜치 워크플로우](/posts/gitflow-feature-branch/)

<br>
읽어주셔서 감사합니다. 😊
