---
title: "Draft Pull Request: 준비 중인 작업을 안전하게 공유하기"
description: "아직 완성되지 않은 작업을 머지 위험 없이 공유하는 Draft PR의 개념, Draft와 Ready 상태의 차이, 생성·전환 방법(웹·gh CLI), 그리고 Draft PR을 잘 활용하는 협업 패턴을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 2
type: "knowledge"
category: "Git"
tags: ["Git", "GitHub", "Draft PR", "Pull Request", "협업", "코드리뷰"]
featured: false
draft: false
---

[지난 글](/posts/github-pull-request-basics/)에서 PR을 만들고 머지하는 기본 흐름을 살펴봤다. 그런데 실무에서는 "아직 다 끝나지 않았지만 방향만 먼저 보여주고 싶다"거나 "CI를 돌려 보고 싶지만 리뷰어를 부르기엔 이르다"는 상황이 자주 생긴다. 일반 PR로 열면 리뷰 요청이 곧장 날아가고 실수로 머지될 위험도 있다. 이럴 때 쓰는 것이 **Draft Pull Request**다.

## Draft PR이란

Draft PR은 "아직 검토 준비가 안 됐다"는 표시를 단 PR이다. 일반 PR과 거의 똑같이 동작하지만, **머지가 차단되고 리뷰어에게 정식 요청이 가지 않는다**는 점이 다르다. 즉, 완성 전에도 변경을 공개하고 토론할 수 있는 "작업 중" 상태다.

![Draft PR vs Ready PR](/assets/posts/github-draft-pr-compare.svg)

핵심은 Draft 상태에서도 **CI/CD 워크플로우는 정상 실행된다**는 점이다. 덕분에 머지 위험 없이 테스트·린트·빌드 결과를 미리 확인할 수 있다. 반면 머지 버튼은 비활성화되고, CODEOWNERS 기반 자동 리뷰 요청도 Ready 전환 시점까지 보류된다.

## Draft PR 만들기

웹에서는 PR 생성 화면의 "Create pull request" 버튼 옆 드롭다운에서 **"Create draft pull request"** 를 고르면 된다. CLI라면 `--draft` 플래그를 붙인다.

```bash
# Draft 상태로 PR 생성
gh pr create \
  --draft \
  --base main \
  --head feature/payment \
  --title "WIP: 결제 모듈" \
  --body "구조만 먼저 공유합니다. 아직 테스트 미작성."
```

작업이 끝나 리뷰를 받을 준비가 되면 Draft를 해제한다.

```bash
# Draft → Ready for review 전환
gh pr ready 123
```

웹에서는 PR 페이지의 **"Ready for review"** 버튼을 누르면 된다. 이 순간 리뷰어에게 알림이 가고, CODEOWNERS 규칙이 트리거되며, 머지 조건이 충족되면 머지 버튼이 열린다.

## Draft PR의 생애주기

![Draft PR의 생애주기](/assets/posts/github-draft-pr-lifecycle.svg)

작업이 더 필요하다고 판단되면 반대로 Ready 상태의 PR을 다시 Draft로 되돌릴 수도 있다(웹의 "Convert to draft"). 리뷰 도중 큰 구조 변경이 필요해졌을 때, 추가 알림 없이 조용히 다시 작업 모드로 들어가는 용도로 유용하다.

## 언제 Draft PR을 쓰면 좋은가

```text
- 초기 설계 방향에 대한 피드백을 빨리 받고 싶을 때
- CI 결과(테스트·빌드)를 머지 위험 없이 확인하고 싶을 때
- 긴 작업의 진행 상황을 팀에 투명하게 공유할 때
- 의존하는 다른 PR이 먼저 머지되기를 기다리는 동안
```

다만 Draft를 너무 오래 방치하면 리뷰 큐에서 잊히기 쉽다. "지금은 보지 말아 달라"는 신호인 만큼, 준비가 끝나면 잊지 말고 Ready로 전환해야 한다. Draft 상태로 며칠씩 멈춰 있는 PR이 쌓이면 오히려 팀의 작업 가시성을 해친다.

다음 글에서는 PR이 Ready 상태가 된 뒤 리뷰어가 남길 수 있는 세 가지 리뷰 타입 — Comment·Approve·Request changes — 을 자세히 살펴본다.

---

**지난 글:** [GitHub Pull Request 기초: 변경을 제안하는 방법](/posts/github-pull-request-basics/)

**다음 글:** [GitHub 리뷰 타입: Comment·Approve·Request changes](/posts/github-review-types/)

<br>
읽어주셔서 감사합니다. 😊
