---
title: "GitHub Pull Request 기초: 변경을 제안하는 방법"
description: "Pull Request의 개념과 base·compare 브랜치 모델, PR을 만드는 전체 흐름(브랜치 → 푸시 → PR → 리뷰 → 머지), PR 화면의 구성 요소, 그리고 좋은 PR을 작성하는 실무 팁을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 1
type: "knowledge"
category: "Git"
tags: ["Git", "GitHub", "Pull Request", "코드리뷰", "협업", "워크플로우"]
featured: false
draft: false
---

[지난 글](/posts/changelog-generation/)에서 릴리즈 노트를 자동으로 만드는 방법을 다뤘다. 자동화된 릴리즈가 의미를 가지려면 그 앞단에 변경을 안전하게 모으는 절차가 있어야 한다. 그 절차의 중심에 **Pull Request(PR)** 가 있다. PR은 "내 브랜치의 변경을 다른 브랜치에 합쳐 달라"는 공식 요청이며, 동시에 그 변경을 토론하고 검토하는 공간이다.

## Pull Request란 무엇인가

Git 자체에는 Pull Request라는 개념이 없다. PR은 GitHub·GitLab 같은 호스팅 서비스가 Git 위에 얹은 협업 기능이다. 핵심은 두 브랜치를 비교하는 것이다.

- **base 브랜치**: 변경을 받아들일 대상 (보통 `main`)
- **compare 브랜치**: 변경이 담긴 작업 브랜치 (예: `feature/login`)

GitHub은 compare 브랜치가 base보다 앞서 있는 커밋들을 모아 하나의 "제안"으로 묶는다. 이 제안에 제목·설명·리뷰·CI 결과·토론이 붙으면서, 단순한 코드 합치기가 아니라 **변경에 대한 합의 과정**이 된다.

## PR이 만들어지는 전체 흐름

브랜치를 만드는 순간부터 머지까지 다섯 단계를 거친다.

![Pull Request가 만들어지는 흐름](/assets/posts/github-pull-request-basics-flow.svg)

각 단계를 명령어로 따라가 보자.

```bash
# ① main에서 작업 브랜치 분기
git switch main
git pull
git switch -c feature/login

# ② 작업 후 커밋하고 원격에 푸시
git add .
git commit -m "feat: 로그인 폼과 세션 처리 추가"
git push -u origin feature/login
```

푸시가 끝나면 GitHub은 "Compare & pull request" 버튼을 띄워 준다. 웹 UI에서 누르거나, `gh` CLI를 쓰면 터미널에서 바로 PR을 만들 수 있다.

```bash
# ③ PR 열기 (gh CLI)
gh pr create \
  --base main \
  --head feature/login \
  --title "Add login feature" \
  --body "로그인 폼과 세션 처리를 추가합니다. Closes #38"
```

이후 ④ 리뷰어가 변경을 검토하고 승인하면, ⑤ 머지 버튼이 활성화된다. 머지가 끝나면 작업 브랜치는 보통 삭제한다.

## PR 화면의 구성 요소

PR 페이지는 단순한 diff 뷰어가 아니다. 변경을 설명하고, 검토하고, 검증하는 정보가 한 화면에 모여 있다.

![Pull Request의 구성](/assets/posts/github-pull-request-basics-anatomy.svg)

- **제목과 번호**: `#42` 같은 번호는 저장소 전역에서 유일하며 이슈·커밋에서 참조할 수 있다
- **base ← compare**: 어느 브랜치로 무엇을 합치는지 한눈에 보여 준다
- **설명(Description)**: 무엇을·왜 바꿨는지 적는다. `Closes #38`처럼 키워드를 쓰면 머지 시 해당 이슈가 자동으로 닫힌다
- **탭**: Conversation(토론), Commits(커밋 목록), Files changed(변경 파일 diff)
- **상태와 검사**: Open/Merged/Closed 상태, CI 체크, 리뷰 승인 여부

## 좋은 PR을 위한 실무 팁

PR은 코드를 합치는 도구이기 이전에 **사람을 위한 커뮤니케이션**이다. 다음을 지키면 리뷰가 훨씬 수월해진다.

```text
1. 작게 쪼개라 — 300줄 이내의 변경이 리뷰하기 좋다
2. 제목은 명령형 한 줄 — "Add login feature"
3. 설명에 '왜'를 담아라 — 코드는 '무엇'을 이미 보여준다
4. 이슈를 연결하라 — Closes/Fixes 키워드로 맥락 제공
5. self-review 먼저 — Files changed를 직접 한 번 훑고 올린다
```

특히 PR 크기는 리뷰 품질을 좌우한다. 거대한 PR은 리뷰어가 대충 승인(rubber-stamp)하게 만들기 쉽다. 기능을 잘게 나눠 여러 PR로 올리는 습관이 결국 더 빠른 머지로 이어진다.

PR은 이후 다룰 리뷰·승인·자동 검사·코드 오너 지정 같은 협업 기능의 출발점이다. 다음 글에서는 아직 완성되지 않은 작업을 안전하게 공유하는 **Draft Pull Request**를 살펴본다.

---

**지난 글:** [Changelog 자동 생성: 릴리즈 노트를 코드로](/posts/changelog-generation/)

**다음 글:** [Draft Pull Request: 준비 중인 작업을 안전하게 공유하기](/posts/github-draft-pr/)

<br>
읽어주셔서 감사합니다. 😊
