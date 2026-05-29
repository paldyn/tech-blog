---
title: "Suggested Changes: 리뷰에서 바로 코드 고쳐주기"
description: "리뷰 코멘트에 적용 가능한 코드 수정안을 다는 GitHub Suggested Changes 기능의 문법(suggestion 블록), 여러 줄·배치 적용, 작성자가 커밋하는 흐름, 그리고 언제 제안을 쓰고 언제 피해야 하는지를 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 4
type: "knowledge"
category: "Git"
tags: ["Git", "GitHub", "코드리뷰", "Suggested Changes", "Pull Request", "협업"]
featured: false
draft: false
---

[지난 글](/posts/github-review-types/)에서 리뷰 타입과 코멘트 작성 원칙을 다뤘다. 그런데 리뷰를 하다 보면 "이건 이렇게 고치면 된다"는 걸 말로 설명하는 것보다 직접 보여주는 편이 빠른 경우가 많다. 오타, 변수명, 한 줄짜리 수정이라면 더더욱 그렇다. GitHub의 **Suggested Changes**는 리뷰 코멘트 안에 실제 코드 수정안을 담아, 작성자가 **버튼 한 번으로 커밋**할 수 있게 해 준다.

## suggestion 블록 문법

코드 라인에 코멘트를 달 때, 일반 코드 펜스 대신 `suggestion` 언어를 쓰면 GitHub이 이를 "적용 가능한 제안"으로 렌더링한다.

````markdown
변수명을 더 명확하게 바꾸면 좋겠습니다.

```suggestion
const userCount = list.length;
```
````

코멘트 입력창에서 수정할 라인을 선택한 뒤 **Ctrl/Cmd + G** 를 누르면, 원래 코드가 채워진 suggestion 블록이 자동으로 삽입된다. 그 안의 내용을 원하는 모습으로 고치기만 하면 된다.

![Suggestion 문법과 렌더링 결과](/assets/posts/github-suggested-changes-syntax.svg)

작성자에게는 이 제안이 빨강(삭제)·초록(추가) diff로 보이고, 그 아래 **"Commit suggestion"** 버튼이 붙는다. 누르면 제안 내용이 그대로 PR 브랜치에 커밋된다. 직접 로컬에서 고치고 push할 필요가 없다.

## 여러 줄 제안과 배치 적용

suggestion 블록은 여러 줄도 지원한다. 코멘트를 달 때 여러 라인을 드래그해 선택하면, 그 범위 전체를 교체하는 제안을 만들 수 있다.

```suggestion
function greet(name) {
  return `Hello, ${name}!`;
}
```

또한 여러 제안을 한 번에 적용할 수도 있다. 각 제안에서 "Commit suggestion" 대신 **"Add suggestion to batch"** 를 누르면 제안들이 모이고, 마지막에 **"Commit suggestions"** 로 한꺼번에 커밋된다. 사소한 수정 여러 개로 커밋 히스토리가 지저분해지는 걸 막아 준다.

![제안을 모아서 한 커밋으로](/assets/posts/github-suggested-changes-batch.svg)

## 언제 쓰고, 언제 피할까

Suggested Changes는 **작고 명확한 수정**에 가장 잘 맞는다.

```text
잘 맞는 경우
  - 오타, 변수·함수 이름
  - 한두 줄짜리 로직 수정
  - 누락된 import, 세미콜론
  - 문서·주석 표현 다듬기

피해야 하는 경우
  - 여러 파일에 걸친 구조 변경
  - 테스트가 필요한 로직 변경 (CI 미검증 상태로 커밋됨)
  - 들여쓰기 범위를 벗어나는 큰 블록 교체
```

한 가지 주의할 점이 있다. 제안을 커밋하면 그 변경은 **작성자가 로컬에서 다시 pull** 해야 동기화된다. 작성자가 이를 잊고 로컬에서 계속 작업해 push하면 충돌이 날 수 있다. 그래서 제안 적용 후에는 작성자에게 "pull 후 작업하세요"라고 알려 주거나, 작성자가 직접 적용 시점을 통제하게 하는 편이 안전하다.

제안 기능은 리뷰의 마찰을 크게 줄여 준다. 하지만 핵심 로직이나 보안과 관련된 수정은 여전히 작성자가 직접 고치고 테스트하도록 두는 것이 옳다. 다음 글에서는 애초에 **누가 어떤 파일을 리뷰해야 하는지**를 자동으로 지정하는 CODEOWNERS를 살펴본다.

---

**지난 글:** [GitHub 리뷰 타입: Comment·Approve·Request changes](/posts/github-review-types/)

**다음 글:** [CODEOWNERS: 코드 영역별 자동 리뷰어 지정](/posts/github-codeowners/)

<br>
읽어주셔서 감사합니다. 😊
