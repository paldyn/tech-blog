---
title: "Fork & Pull Request 워크플로우: 오픈소스 기여 흐름"
description: "저장소에 직접 push 권한이 없는 외부 기여자가 fork → clone → branch → push → PR로 변경을 제안하는 전체 흐름, upstream remote로 포크를 동기화하는 법, 그리고 오픈소스 기여 실무 팁을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["Git", "GitHub", "Fork", "Pull Request", "오픈소스", "협업"]
featured: false
draft: false
---

[지난 글](/posts/github-projects/)에서 Projects로 작업 흐름을 시각화하는 법을 다뤘다. 지금까지 살펴본 PR·리뷰·이슈는 모두 **저장소에 쓰기 권한이 있는** 팀 내부 협업을 전제로 했다. 그런데 오픈소스 프로젝트나 사내 다른 팀의 저장소에는 보통 직접 push할 권한이 없다. 이때 쓰는 것이 **Fork & Pull Request** 흐름이다. 원본을 복제한 "내 포크"에서 작업하고, 그 변경을 원본에 PR로 제안한다.

## 두 개의 원격 저장소

핵심은 원격 저장소가 두 개로 나뉜다는 점이다.

- **upstream**: 원본 저장소(`org/project`). 읽기만 가능, 직접 push 불가
- **origin**: 내 포크(`me/project`). 원본의 복사본이며 내가 마음대로 push 가능

내 포크는 GitHub 계정 안에 있는 독립된 저장소다. 여기에는 자유롭게 브랜치를 만들고 push할 수 있다. 작업이 끝나면 내 포크의 브랜치를 원본 저장소를 향해 PR로 보낸다.

![Fork & Pull Request 흐름](/assets/posts/github-fork-pr-flow-flow.svg)

## 전체 흐름을 명령어로

순서대로 따라가 보자.

```bash
# ① GitHub 웹에서 원본 저장소를 Fork (또는 gh CLI)
gh repo fork org/project --clone

# ↑ --clone을 쓰면 fork + clone + upstream 설정까지 한 번에

# 수동으로 한다면:
# ② 내 포크를 clone
git clone https://github.com/me/project.git
cd project

# ③ 작업 브랜치 생성 후 커밋
git switch -c fix/typo-readme
git commit -am "docs: README 오타 수정"

# ④ 내 포크(origin)에 push
git push -u origin fix/typo-readme
```

push가 끝나면 GitHub이 "Compare & pull request" 버튼을 띄운다. 또는 CLI로 바로 PR을 만든다.

```bash
# ⑤ 원본 저장소(upstream)를 향해 PR 생성
gh pr create \
  --repo org/project \
  --base main \
  --head me:fix/typo-readme \
  --title "docs: fix typo in README" \
  --body "오타를 수정했습니다."
```

`--head me:fix/typo-readme`처럼 `사용자:브랜치` 형식으로 적어 내 포크의 브랜치를 가리킨다. 이 PR은 원본 저장소의 메인테이너에게 가고, 그들이 리뷰 후 머지를 결정한다.

## 포크를 원본과 동기화하기

오래 작업하다 보면 원본 저장소가 앞서 나간다. 내 포크와 로컬이 뒤처지면 PR에 충돌이 생기기 쉽다. 그래서 원본을 가리키는 `upstream` 원격을 추가해 주기적으로 동기화한다.

![포크를 원본과 동기화하기](/assets/posts/github-fork-pr-flow-sync.svg)

```bash
# upstream 원격 추가 (한 번만)
git remote add upstream https://github.com/org/project.git

# 원본의 최신 변경을 받아 내 작업을 그 위로 재정렬
git fetch upstream
git switch main
git rebase upstream/main

# 동기화된 main을 내 포크에도 반영
git push origin main
```

`gh repo sync me/project`로 포크의 기본 브랜치를 한 줄에 동기화할 수도 있다. 작업 브랜치는 `git rebase upstream/main`으로 최신 base 위에 올려 두면 PR이 깔끔하게 머지된다.

## 오픈소스 기여 실무 팁

```text
- 먼저 CONTRIBUTING.md를 읽어라 — 프로젝트마다 규칙이 다르다
- 큰 변경 전엔 이슈로 합의 — 거절될 PR에 시간 낭비 방지
- 한 PR엔 한 가지 변경만 — 리뷰·머지가 쉬워진다
- 커밋 메시지·코드 스타일은 프로젝트 관례를 따른다
- "Allow edits from maintainers" 체크 — 메인테이너가 직접 손볼 수 있게
```

마지막 항목은 의외로 중요하다. PR 생성 시 이 옵션을 켜 두면 메인테이너가 작은 수정을 직접 커밋할 수 있어, 사소한 사항으로 왕복하는 일이 줄어든다.

Fork & PR 흐름은 전 세계 오픈소스 협업을 떠받치는 기본 구조다. 권한 없이도 누구나 변경을 제안할 수 있고, 원본의 메인테이너가 품질을 통제할 수 있다 — Git의 분산 모델과 GitHub의 PR이 만나 만들어내는 협업의 정수다. 지금까지 PR·리뷰·이슈·Actions·Projects·Fork까지, GitHub 협업의 큰 그림을 한 바퀴 둘러봤다.

---

**지난 글:** [GitHub Projects: 칸반으로 이슈와 PR 관리하기](/posts/github-projects/)

<br>
읽어주셔서 감사합니다. 😊
