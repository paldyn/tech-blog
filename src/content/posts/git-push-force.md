---
title: "git push --force의 위험성과 주의사항"
description: "git push --force가 원격 히스토리를 덮어쓰는 위험한 작업임을 이해하고, 언제 사용 가능한지 판단 기준을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["Git", "push", "force", "force push", "히스토리 덮어쓰기"]
featured: false
draft: false
---

[지난 글](/posts/git-push-basics/)에서 `git push`의 기본 구조를 살펴봤다. 정상적인 push는 원격의 최신 커밋을 기반으로 새 커밋을 추가하는 "fast-forward" 방식으로 동작한다. 하지만 `git rebase`나 `git commit --amend`로 히스토리를 재작성하면 SHA가 변경되어 더 이상 fast-forward가 불가능해진다. 이때 `git push --force`가 필요하다. 그러나 이 명령은 **팀원의 커밋을 사라지게 만들 수 있는** 매우 위험한 작업이다.

## --force가 하는 일

`git push --force`는 원격 저장소에게 **현재 로컬의 히스토리가 맞다**고 강제로 통보한다. 원격의 상태와 관계없이 무조건 덮어쓴다.

```bash
# 일반 push: 원격이 더 앞서 있으면 거부
git push origin main
# ! [rejected] main -> main (non-fast-forward)

# force push: 거부 없이 강제 덮어씀
git push --force origin main
git push -f origin main  # 단축형
```

![force push 위험 시나리오](/assets/posts/git-push-force-danger.svg)

**시나리오**: 내가 로컬에서 rebase를 한 사이, 팀원이 원격 `main`에 커밋 C를 push했다. 이 상황에서 내가 `--force`로 push하면 원격의 C가 덮어씌워져 **사라진다**. 팀원이 이후 `git pull`을 실행하면 히스토리가 엉키거나 C를 잃게 된다.

## force push가 유발하는 구체적 피해

1. **팀원의 커밋 손실**: 원격에 있던 팀원 커밋이 dangling 상태가 되어 사실상 접근 불가능해진다.
2. **히스토리 불일치**: 팀원의 로컬 히스토리와 원격 히스토리가 달라져 pull/push가 모두 꼬인다.
3. **PR 내용 변경**: 진행 중인 PR에서 검토하던 커밋이 사라지거나 바뀐다.
4. **reflog 의존 복구 필요**: 복구하려면 원격 서버의 reflog가 아직 살아 있어야 하며 (GitHub 기준 30일), 빠른 대응이 필요하다.

## force push가 허용되는 경우

모든 force push가 나쁜 것은 아니다. 다음 조건을 모두 충족할 때는 허용 가능하다.

| 조건 | 설명 |
|------|------|
| **혼자 쓰는 브랜치** | 팀원이 해당 브랜치를 체크아웃하거나 작업하지 않는다 |
| **PR 전 정리** | 아직 머지되지 않은 피처 브랜치를 리뷰 전에 정돈한다 |
| **공지 후 진행** | 공유 브랜치라면 팀원 모두에게 force push를 예고하고 작업을 멈춘다 |
| **main/develop 제외** | 보호된 브랜치에는 절대 사용하지 않는다 |

```bash
# 허용 가능한 사례: 나만 쓰는 피처 브랜치 정리 후 push
git rebase -i HEAD~3     # 커밋 정리
git push --force origin feature/my-work
```

## force push 실수 후 복구

force push로 사라진 커밋을 복구하려면 **reflog**를 활용한다.

```bash
# 덮어씌워지기 전 SHA 찾기
git reflog

# 해당 SHA로 브랜치 복원
git branch recovery abc1234

# 원격에 복원 (이것도 force push가 필요)
git push --force origin recovery:main
```

GitHub에서는 관리자 권한으로 reflog에 접근하거나, 해당 커밋을 로컬에 가지고 있는 팀원에게서 복구할 수도 있다.

## --force 대신 --force-with-lease

`--force`의 근본 문제는 원격의 현재 상태를 전혀 고려하지 않는다는 점이다. 다음 글에서 다룰 `--force-with-lease`는 이 문제를 완화한 대안이다.

```bash
# 원격이 내가 마지막으로 fetch한 상태와 다르면 거부
git push --force-with-lease origin main
```

force push가 필요한 상황이라면 `--force` 대신 항상 `--force-with-lease`를 사용한다.

## 팀 정책: main 브랜치 보호

GitHub, GitLab, Bitbucket 모두 **branch protection rules**를 지원한다. `main` 브랜치에 force push 금지 규칙을 설정하면 실수로 인한 피해를 방지할 수 있다.

```
GitHub: Settings → Branches → Branch protection rules
→ "Require pull request reviews before merging"
→ "Do not allow bypassing the above settings"
→ "Restrict force pushes"
```

이 설정은 관리자라도 force push를 차단하므로, 공유 브랜치의 최후 안전망이 된다.

![force push 명령과 안전 대안](/assets/posts/git-push-force-commands.svg)

## 정리

`git push --force`는 원격 히스토리를 무조건 덮어쓴다. 혼자 쓰는 브랜치에서, 팀원에게 공지한 상황에서, 보호 브랜치가 아닌 경우에만 신중하게 사용한다. 일상적인 force push 필요 상황에서는 반드시 `--force-with-lease`를 선택한다.

---

**지난 글:** [git push 기본 사용법](/posts/git-push-basics/)

**다음 글:** [push --force-with-lease — 안전한 강제 푸시](/posts/git-push-force-with-lease/)

<br>
읽어주셔서 감사합니다. 😊
