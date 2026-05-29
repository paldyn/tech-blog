---
title: "GitHub 리뷰 타입: Comment·Approve·Request changes"
description: "GitHub PR 리뷰의 세 가지 타입(Comment, Approve, Request changes)이 각각 무엇을 의미하고 머지에 어떤 영향을 주는지, 리뷰 코멘트가 일괄 제출되는 구조, 그리고 효과적인 리뷰 작성 원칙을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 3
type: "knowledge"
category: "Git"
tags: ["Git", "GitHub", "코드리뷰", "Pull Request", "협업", "리뷰"]
featured: false
draft: false
---

[지난 글](/posts/github-draft-pr/)에서 Draft PR로 작업 중인 변경을 공유하는 법을 다뤘다. PR이 Ready 상태가 되면 이제 리뷰어가 코드를 검토할 차례다. GitHub에서 리뷰를 제출할 때는 세 가지 중 하나를 골라야 하는데, 이 선택이 단순한 의사 표현을 넘어 **머지 가능 여부에 직접 영향을 준다**. 셋의 차이를 정확히 알아야 리뷰가 협업의 신호로 제대로 작동한다.

## 세 가지 리뷰 타입

리뷰를 마치고 "Submit review"를 누르면 GitHub은 세 가지 결정을 묻는다.

![세 가지 리뷰 타입](/assets/posts/github-review-types-three.svg)

- **Comment**: 의견·질문·제안을 남기되 승인도 반려도 하지 않는다. 머지 조건에 영향이 없다. "참고해 보세요" 수준의 가벼운 피드백에 적합하다.
- **Approve**: "이대로 머지해도 좋다"는 명시적 승인이다. 브랜치 보호 규칙에서 "필수 승인 N개"를 걸어 뒀다면 이 승인이 그 카운트에 기여한다.
- **Request changes**: "반드시 고쳐야 할 문제가 있다"는 반려다. 같은 리뷰어가 다시 승인하기 전까지 보호된 브랜치에서 머지가 차단된다.

`Request changes`는 강한 신호다. 머지를 막기 때문에, 단순 취향 차이나 "이렇게 하면 더 좋을 것 같다" 정도의 제안에 남발하면 작업 흐름이 불필요하게 멈춘다. 꼭 고쳐야 하는 버그·보안·설계 결함일 때 쓰는 것이 원칙이다.

## 리뷰 코멘트는 모았다가 한 번에 제출된다

GitHub 리뷰에서 자주 놓치는 부분이 있다. 코드 라인에 코멘트를 달 때 **"Start a review"** 로 시작하면, 작성한 코멘트들이 곧바로 전송되지 않고 **Pending(보류)** 상태로 쌓인다. 마지막에 "Submit review"를 누를 때 한꺼번에 전송된다.

![리뷰 코멘트는 한 번에 제출된다](/assets/posts/github-review-types-flow.svg)

반면 "Add single comment"를 누르면 그 코멘트만 즉시 전송된다. 코멘트 10개를 이렇게 하나씩 보내면 작성자에게 알림이 10번 쏟아진다. 여러 코멘트를 남길 때는 반드시 리뷰로 묶어 한 번에 제출하는 것이 예의이자 효율이다.

CLI로도 리뷰를 제출할 수 있다.

```bash
# 승인
gh pr review 123 --approve

# 코멘트만
gh pr review 123 --comment --body "전반적으로 좋습니다. 네이밍만 확인 부탁드려요."

# 변경 요청
gh pr review 123 --request-changes --body "SQL 인젝션 위험이 있습니다. 파라미터 바인딩으로 수정해 주세요."
```

## 효과적인 리뷰를 위한 원칙

리뷰 타입을 정확히 쓰는 것만큼 중요한 것이 코멘트의 톤과 내용이다.

```text
- 명령이 아닌 제안으로: "이렇게 해" 대신 "이렇게 하면 어떨까요?"
- 칭찬도 코멘트로: 좋은 코드엔 명시적으로 긍정 피드백
- '머스트'와 '나이스 투 해브'를 구분: nit: 접두사로 사소함 표시
- Approve에 사소한 코멘트를 함께: 작은 제안은 Approve + Comment로
- 코드의 '왜'를 물어라: 단순 스타일보다 의도·엣지케이스에 집중
```

`nit:`(nitpick) 같은 접두사는 "이건 사소한 취향이니 반영 여부는 작성자 재량"이라는 뜻으로 널리 쓰인다. 이런 관용 표현은 Request changes를 남발하지 않으면서도 의견을 전할 수 있게 해 준다.

다음 글에서는 리뷰 코멘트를 넘어, 리뷰어가 **수정안을 코드로 직접 제안하고 작성자가 클릭 한 번으로 적용**할 수 있는 Suggested Changes 기능을 살펴본다.

---

**지난 글:** [Draft Pull Request: 준비 중인 작업을 안전하게 공유하기](/posts/github-draft-pr/)

**다음 글:** [Suggested Changes: 리뷰에서 바로 코드 고쳐주기](/posts/github-suggested-changes/)

<br>
읽어주셔서 감사합니다. 😊
