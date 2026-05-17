---
title: "Pull Request 기본 흐름"
description: "Pull Request의 생명 주기, 리뷰 옵션, 머지 방법 3가지를 정리하고 로컬에서 PR을 준비하는 명령어를 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["Git", "Pull Request", "PR", "코드 리뷰", "머지", "GitHub"]
featured: false
draft: false
---

[지난 글](/posts/git-fork-clone-flow/)에서 Fork & Clone 워크플로우를 살펴봤다. 마지막 단계로 PR(Pull Request)을 생성한다고 언급했는데, 이번에는 **PR의 개념과 전체 생명 주기**를 구체적으로 다룬다. PR은 단순히 "코드를 보내는 것" 이상이다. 변경의 이유를 공유하고, 팀이 함께 검토하고, 자동 검사까지 수행하는 협업의 중심이다.

## Pull Request란

PR은 "내 브랜치의 변경 사항을 다른 브랜치(보통 `main`)에 병합해 달라는 요청"이다. GitHub 등의 플랫폼이 제공하는 기능으로, 머지 전에 리뷰·토론·자동 테스트가 이루어진다.

이름이 "Pull Request"인 이유는 원래 **상대방이 내 변경 사항을 pull해가길 요청**하는 개념에서 왔다. GitLab은 같은 기능을 "Merge Request(MR)"라고 부른다.

## PR 생명 주기

![Pull Request 생명 주기](/assets/posts/git-pr-flow-basics-lifecycle.svg)

1. **Draft PR**: 작업 중임을 알리기 위해 먼저 열어두는 상태. 리뷰는 요청하지 않는다.
2. **Open PR**: 리뷰 준비 완료 상태. 리뷰어가 코드를 검토한다.
3. **Merged**: 승인 후 대상 브랜치에 병합된 상태.
4. **Closed**: 머지 없이 닫힌 상태. 방향이 바뀌거나 불필요해진 경우.

## 로컬에서 PR 준비

```bash
# 피처 브랜치 생성
git switch -c feature/add-dark-mode

# 작업 후 커밋
git add -p
git commit -m "feat: implement dark mode toggle"

# 원격에 push (업스트림 설정 동시)
git push -u origin feature/add-dark-mode
```

push 직후 GitHub는 PR 생성을 유도하는 링크를 터미널에 출력한다. 해당 URL을 클릭하면 PR 작성 페이지로 이동한다.

![PR 준비 로컬 명령어](/assets/posts/git-pr-flow-basics-commands.svg)

## 리뷰어의 세 가지 행동

리뷰어는 PR에 다음 세 가지 방식으로 응답할 수 있다.

| 행동 | 의미 |
|---|---|
| **Comment** | 의견 제시, 승인은 아님 |
| **Approve** | 변경에 동의, 머지 가능 |
| **Request Changes** | 수정 요청, 재작업 필요 |

`Request Changes`를 받으면 같은 브랜치에 추가 커밋을 push한다. PR은 자동으로 업데이트되며, 수정 완료 후 다시 리뷰를 요청한다.

```bash
# 리뷰 피드백 반영 후 추가 커밋
git commit -m "fix: change toggle position per review"
git push   # 업스트림이 이미 설정되어 있으므로 인자 불필요
```

## 머지 방법 3가지

GitHub에서 PR을 머지할 때 세 가지 전략을 선택할 수 있다.

### Merge commit (기본)

```
main:    A - B - M      (M = merge commit)
                /
feature: C - D
```

피처 브랜치 커밋을 그대로 유지하고 머지 커밋(`M`)을 추가한다. 히스토리에 브랜치가 있었음이 명확히 남는다.

### Squash and merge

```
main:    A - B - S      (S = 모든 피처 커밋을 하나로 합침)
```

피처 브랜치의 모든 커밋을 하나로 합쳐 main에 추가한다. main 히스토리가 깔끔해지지만 개별 커밋 이력은 사라진다.

### Rebase and merge

```
main:    A - B - C' - D'    (C', D' = 재작성된 커밋)
```

피처 브랜치 커밋을 main 위에 재배치해 선형 히스토리를 만든다. 머지 커밋 없이 이력이 이어진다.

팀 전체가 일관된 전략을 사용하는 것이 중요하다. 프로젝트별로 하나의 방식을 정하고 GitHub 저장소 설정에서 허용 방식을 제한할 수 있다.

## PR 작성 시 좋은 습관

```
PR 제목: feat: add dark mode support
PR 본문:
## 변경 이유
UX 요청에 따라 다크 모드 토글 추가

## 테스트 방법
1. 설정 > 테마에서 "Dark" 선택
2. 전체 페이지 배경이 어두워지는지 확인

## 스크린샷
(before/after 이미지)
```

변경의 **이유와 테스트 방법**을 본문에 담으면 리뷰어가 맥락을 이해하는 시간을 크게 줄일 수 있다.

## 정리

PR은 변경 사항을 병합하기 전에 팀이 함께 검토하는 창구다. Draft → Open → Approved → Merged의 흐름을 이해하고, 리뷰 피드백은 같은 브랜치에 추가 커밋으로 대응한다. 머지 방법(Merge commit / Squash / Rebase)은 팀의 히스토리 정책에 맞게 일관되게 사용한다.

---

**지난 글:** [Fork & Clone 워크플로우](/posts/git-fork-clone-flow/)

**다음 글:** [자격 증명 헬퍼로 인증 자동화하기](/posts/git-credential-helper/)

<br>
읽어주셔서 감사합니다. 😊
