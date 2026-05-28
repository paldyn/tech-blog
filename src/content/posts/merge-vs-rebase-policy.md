---
title: "Merge vs Rebase: 팀에 맞는 병합 정책 고르기"
description: "Merge Commit·Squash and Merge·Rebase and Merge 세 가지 방식의 히스토리 차이, 각 방식의 장단점, GitHub Settings에서 허용 방식 제한하는 법, 팀 상황별 권장 정책을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "Merge", "Rebase", "Squash", "브랜치정책", "히스토리"]
featured: false
draft: false
---

[지난 글](/posts/issue-template/)에서 이슈 템플릿을 다뤘다. PR이 최종적으로 base 브랜치에 합쳐질 때 세 가지 방식이 있다: **Merge Commit**, **Squash and Merge**, **Rebase and Merge**. 어느 방식을 쓰느냐에 따라 `git log` 모양이 완전히 달라지고, 히스토리를 통한 디버깅 난이도도 달라진다.

## 세 가지 방식 비교

![Merge vs Squash vs Rebase 히스토리 비교](/assets/posts/merge-vs-rebase-policy-history.svg)

### Merge Commit (기본값)

```bash
git merge --no-ff feature/add-search
# 또는 GitHub UI에서 "Create a merge commit"
```

feature 브랜치의 모든 커밋과, 두 브랜치를 합치는 **머지 커밋(M)**이 생긴다. `git log --graph`에서 분기가 보인다.

**장점:** 완전한 히스토리 보존. 브랜치가 언제 분기했고 언제 합쳐졌는지 명확하다.

**단점:** `git log`가 비선형. 여러 팀이 동시에 작업하면 그래프가 복잡해진다.

### Squash and Merge

```bash
git merge --squash feature/add-search
git commit -m "feat(search): 엘라스틱서치 검색 API 추가"
# 또는 GitHub UI에서 "Squash and merge"
```

feature 브랜치의 모든 커밋(A, B, C...)을 하나로 압축해 main에 단일 커밋으로 추가한다.

**장점:** main 히스토리가 깔끔. `git log`가 선형. PR 단위로 한 커밋.

**단점:** feature 브랜치의 개별 커밋 메시지가 소실된다. 압축 커밋 메시지를 직접 잘 작성해야 한다.

### Rebase and Merge

```bash
git rebase main feature/add-search
# → feature 커밋이 main 위로 재배치됨 (SHA 변경)
# 또는 GitHub UI에서 "Rebase and merge"
```

feature 브랜치의 각 커밋을 main 끝에 **재배치(rebase)**한다. 머지 커밋이 생기지 않고 선형 히스토리를 유지하면서 개별 커밋도 보존된다.

**장점:** 선형 히스토리 + 개별 커밋 보존.

**단점:** 커밋 SHA가 바뀐다. 이미 공유된 브랜치에는 force push 문제가 생긴다. 커밋 메시지 품질이 낮으면 main이 지저분해진다.

## 정책 결정 가이드

![머지 정책 결정 가이드](/assets/posts/merge-vs-rebase-policy-decision.svg)

## GitHub에서 허용 방식 제한

Settings → General → Pull Requests 섹션에서 세 체크박스를 개별적으로 활성/비활성할 수 있다. 팀이 사용할 방식만 남기면 실수를 방지할 수 있다.

```bash
# GitHub CLI로 저장소 머지 설정
gh api repos/ORG/REPO \
  --method PATCH \
  --field allow_merge_commit=false \
  --field allow_squash_merge=true \
  --field allow_rebase_merge=false
```

## 어떤 방식을 선택할까

**소규모 스타트업 / 빠른 배포 팀**: Squash and Merge. PR 단위로 1커밋, `git bisect`로 버그 원인 찾기 쉽다.

**오픈소스 / 기여자 히스토리 중요 팀**: Merge Commit. 누가 어떤 커밋을 했는지 명확하게 남긴다.

**커밋 메시지를 Conventional Commits으로 엄격 관리**: Rebase and Merge. changelog 자동 생성과 궁합이 좋다.

팀 내 의견이 나뉜다면 **Squash and Merge 단일 정책**이 가장 관리하기 쉽다. PR이 작게 유지되는 문화와 함께라면 히스토리 소실의 단점이 거의 없다.

---

**지난 글:** [이슈 템플릿으로 버그 리포트와 기능 요청 구조화하기](/posts/issue-template/)

**다음 글:** [Semantic Release: 자동 버전 관리와 릴리즈](/posts/semantic-release/)

<br>
읽어주셔서 감사합니다. 😊
