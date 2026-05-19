---
title: "히스토리 재작성 전 반드시 알아야 할 것들"
description: "git rebase, amend, filter-repo 등 히스토리 재작성 도구를 쓰기 전 알아야 할 SHA 변경의 의미, 팀에 미치는 영향, 안전하게 진행하는 방법을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "히스토리 재작성", "force push", "SHA", "팀 협업"]
featured: false
draft: false
---

[지난 글](/posts/git-rewrite-author/)에서 커밋 작성자를 수정하는 방법을 살펴봤다. 이번에는 rebase, amend, filter-repo 등 **히스토리를 다시 쓰는 모든 작업의 공통 위험**을 짚어보고, 팀 환경에서 안전하게 진행하는 방법을 정리한다.

## SHA가 바뀐다는 것의 의미

Git 커밋의 SHA는 내용(트리, 부모 SHA, 메시지, 작성자, 타임스탬프)을 해시한 결과다. 이 중 하나라도 바뀌면 SHA가 달라진다. rebase, amend, filter-repo, squash 모두 새로운 SHA를 가진 새 커밋을 만든다.

```bash
# 원래 커밋
abc1234 feat: 로그인 구현

# amend 후 (메시지나 내용이 같아도 SHA는 다름)
def5678 feat: 로그인 구현  ← 완전히 다른 객체
```

원격에는 `abc1234`가 있는데 내 로컬엔 `def5678`이 있는 상황이다. 일반 `git push`는 "fast-forward가 안 된다"고 거부한다.

![히스토리 재작성의 위험](/assets/posts/git-history-rewrite-warning-risks.svg)

## force push와 그 위험

SHA가 바뀐 커밋을 원격에 올리려면 force push가 필요하다.

```bash
# 절대 금지 (--force는 원격을 무조건 덮어씀)
git push --force origin main

# 더 안전한 옵션 (원격에 모르는 새 커밋이 있으면 거부)
git push --force-with-lease origin feature/my-branch
```

`--force-with-lease`는 내가 마지막으로 fetch했을 때와 원격 상태가 같을 때만 push를 허용한다. 팀원이 그 사이에 push했으면 거부해 덮어쓰기를 방지한다.

## 팀원이 같은 브랜치를 사용 중이라면

force push 후 팀원이 `git pull`을 하면 히스토리가 갈라져 충돌이 복잡해진다.

```bash
# 팀원이 해야 하는 복구 작업
# 방법 1: 원격 기준으로 reset (로컬 변경사항이 없을 때)
git fetch origin
git reset --hard origin/feature/my-branch

# 방법 2: 로컬 변경사항 보존 후 re-base
git fetch origin
git rebase origin/feature/my-branch
```

이 과정이 팀원에게 부담이 되므로 공지가 필수다.

## 체크리스트

![히스토리 재작성 전 체크리스트](/assets/posts/git-history-rewrite-warning-checklist.svg)

```bash
# 백업 브랜치 생성 (안전망)
git branch backup/before-rewrite-$(date +%Y%m%d)

# 나중에 실수했을 때 복구
git reset --hard backup/before-rewrite-20260520
```

## 브랜치 보호 규칙

GitHub, GitLab, Bitbucket은 특정 브랜치에 force push를 금지하는 **브랜치 보호 규칙**을 제공한다. main이나 develop 같은 공유 브랜치에는 보호 규칙을 설정해 실수를 방지한다.

```bash
# 보호된 브랜치에 force push 시도 시
git push --force origin main
# remote: error: GH006: Protected branch update failed
```

## reflog: 최후의 안전망

재작성 후 실수했더라도 90일 이내라면 `git reflog`로 이전 SHA를 찾아 복구할 수 있다.

```bash
# 재작성 전 SHA 확인
git reflog | head -20

# 복구
git reset --hard abc1234@{5}
```

하지만 `git gc`가 실행되거나 원격에서 강제 삭제된 객체는 reflog로도 복구 불가다. 중요한 재작성 전엔 항상 백업 브랜치를 만든다.

## 언제 재작성이 적합한가

| 상황 | 적합 여부 |
|---|---|
| 아직 push 안 한 로컬 커밋 | 항상 적합 |
| 본인만 사용하는 feature 브랜치 | 적합 |
| 팀원이 없는 개인 프로젝트 | 적합 |
| 팀원이 PR을 열고 리뷰 중 | 신중하게, 공지 후 |
| main/develop 공유 브랜치 | 원칙적으로 금지 |

---

**지난 글:** [git 커밋 작성자 일괄 수정](/posts/git-rewrite-author/)

**다음 글:** [git stash — 변경사항 임시 저장](/posts/git-stash-basics/)

<br>
읽어주셔서 감사합니다. 😊
