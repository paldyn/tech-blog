---
title: "CODEOWNERS: 코드 영역별 자동 리뷰어 지정"
description: "CODEOWNERS 파일로 경로별 코드 소유자를 지정해 PR 리뷰어를 자동 배정하는 방법, 파일 위치와 패턴 문법, 마지막 일치 규칙, 브랜치 보호와의 연동, 그리고 운영 팁을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "GitHub", "CODEOWNERS", "코드리뷰", "협업", "브랜치보호"]
featured: false
draft: false
---

[지난 글](/posts/github-suggested-changes/)에서 리뷰 중 코드를 직접 제안하는 법을 다뤘다. 그런데 리뷰의 첫 단계, 즉 "이 PR은 **누가** 봐야 하는가"는 여전히 사람이 매번 지정해야 한다면 번거롭고 누락도 잦다. 결제 코드를 건드린 PR이 결제팀을 거치지 않고 머지된다면 곤란하다. **CODEOWNERS** 파일은 경로별로 코드 소유자를 미리 정해 두고, 해당 영역을 건드린 PR에 자동으로 리뷰어를 배정한다.

## CODEOWNERS 파일이란

CODEOWNERS는 저장소에 두는 일반 텍스트 파일이다. 다음 세 위치 중 하나에 두면 GitHub이 자동으로 인식한다.

```text
.github/CODEOWNERS   ← 가장 일반적
CODEOWNERS           ← 저장소 루트
docs/CODEOWNERS
```

내용은 `gitignore`와 비슷한 **경로 패턴 + 소유자** 한 줄씩이다. 소유자는 `@username` 또는 `@org/team` 형식이다.

![CODEOWNERS: 경로 → 소유자 매핑](/assets/posts/github-codeowners-mapping.svg)

```text
# 기본 소유자 — 모든 파일
*                @org/core

# 특정 디렉터리
/web/            @org/frontend
/api/            @org/backend

# 확장자 패턴
*.tf             @org/infra

# 개별 파일
/docs/api.md     @alice @bob
```

## 마지막 일치 규칙이 핵심

CODEOWNERS에서 가장 자주 혼동하는 부분이 우선순위다. 한 파일이 여러 줄에 매칭될 때, **파일에서 가장 마지막에 일치한 규칙 하나만** 적용된다. 위에서 누적되는 게 아니다.

예를 들어 위 설정에서 `/web/styles/main.tf`를 수정하면, `*`(core)와 `/web/`(frontend)과 `*.tf`(infra) 세 줄에 모두 걸리지만, 파일 맨 아래에 가까운 `*.tf` 규칙이 이긴다 — 즉 `@org/infra`가 소유자가 된다. 그래서 **더 구체적인 규칙을 파일 아래쪽에** 두는 것이 관례다.

## 자동 리뷰어 배정과 브랜치 보호

PR이 열리면 GitHub은 변경된 파일들을 CODEOWNERS 패턴과 대조해, 매칭된 소유자를 리뷰어로 자동 요청한다.

![자동 리뷰어 지정 흐름](/assets/posts/github-codeowners-flow.svg)

여기서 한 단계 더 나아가면 강제력을 줄 수 있다. 브랜치 보호 규칙에서 **"Require review from Code Owners"** 를 켜면, 해당 파일의 소유자가 승인하기 전까지 머지가 차단된다. 결제·인프라·보안처럼 반드시 담당자가 확인해야 하는 영역을 보호하는 데 효과적이다.

```bash
# gh CLI로 현재 PR의 리뷰 요청 상태 확인
gh pr view 123 --json reviewRequests,reviews
```

## 운영 팁

```text
- 소유자는 저장소에 write 권한이 있어야 자동 요청된다
- Draft PR은 Ready 전환 시점에 소유자 요청이 발생한다
- 팀(@org/team)을 쓰면 멤버 변동에도 설정을 안 고쳐도 된다
- 너무 잘게 쪼개면 PR마다 리뷰어가 폭증 — 디렉터리 단위로
- CODEOWNERS 자체도 보호 대상: 누구나 못 바꾸게 소유자 지정
```

마지막 줄이 특히 중요하다. CODEOWNERS 파일 자체를 누구든 수정할 수 있으면 보호 규칙을 우회할 수 있으므로, `.github/CODEOWNERS`의 소유자를 관리팀으로 지정해 두는 것이 안전하다.

CODEOWNERS는 "누가 리뷰하느냐"를 자동화한다. 다음 글에서는 리뷰가 끝난 PR을 자동으로 검증하고 배포까지 연결하는 **GitHub Actions**의 기초를 살펴본다.

---

**지난 글:** [Suggested Changes: 리뷰에서 바로 코드 고쳐주기](/posts/github-suggested-changes/)

**다음 글:** [GitHub Actions 기초: 워크플로우 자동화 첫걸음](/posts/github-actions-basics/)

<br>
읽어주셔서 감사합니다. 😊
