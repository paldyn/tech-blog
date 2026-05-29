---
title: "GitHub Issues: 작업과 버그를 추적하는 법"
description: "GitHub Issues로 버그·기능·작업을 추적하는 방법, 이슈의 구성 요소(라벨·담당자·마일스톤), 이슈와 PR을 연결해 자동으로 닫는 키워드, 그리고 gh CLI로 이슈를 다루는 실무 흐름을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-30"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "GitHub", "Issues", "이슈관리", "협업", "프로젝트관리"]
featured: false
draft: false
---

[지난 글](/posts/github-actions-pr-checks/)에서 PR 검사를 자동화해 코드 품질을 지키는 법을 다뤘다. 그런데 코드 변경은 보통 그냥 시작되지 않는다. "이런 버그가 있다", "이 기능이 필요하다"는 **할 일**이 먼저 있고, PR은 그것을 해결하는 결과물이다. GitHub Issues는 이 할 일들을 등록하고, 분류하고, 누가 언제까지 처리할지 추적하는 도구다.

## 이슈란 무엇인가

이슈는 저장소에 속한 하나의 "추적 가능한 항목"이다. 버그 신고, 기능 요청, 리팩터링 작업, 질문 — 무엇이든 될 수 있다. PR과 마찬가지로 저장소 전역에서 유일한 번호(`#38`)를 갖고, 그 번호로 커밋·PR·다른 이슈에서 참조할 수 있다.

![Issue의 구성](/assets/posts/github-issues-anatomy.svg)

이슈는 제목과 마크다운 본문만으로도 충분하지만, 오른쪽의 메타데이터가 추적을 강력하게 만든다.

- **Labels(라벨)**: `bug`, `enhancement`, `priority:high` 등으로 분류·필터링
- **Assignees(담당자)**: 누가 처리하는지
- **Milestone(마일스톤)**: 어느 릴리즈·스프린트에 속하는지
- **Projects**: 칸반 보드의 어느 컬럼에 있는지 (다음 글에서 자세히)

## 이슈를 PR과 연결하기

Issues의 진짜 힘은 PR과 연결될 때 나온다. PR 본문이나 커밋 메시지에 특정 키워드와 이슈 번호를 적으면, **그 PR이 머지되는 순간 이슈가 자동으로 닫힌다**.

![이슈에서 머지까지, 자동으로 닫히는 흐름](/assets/posts/github-issues-lifecycle.svg)

```text
# PR 본문에 적으면 머지 시 #38이 자동으로 닫힌다
Closes #38

# 지원되는 키워드 (대소문자 무관)
close / closes / closed
fix / fixes / fixed
resolve / resolves / resolved
```

여러 이슈를 한 번에 닫으려면 `Closes #38, closes #39`처럼 각각 키워드를 반복한다. `Closes #38, #39`처럼 쓰면 첫 번째만 닫히니 주의한다. 단순 참조만 하고 닫지 않으려면 키워드 없이 `#38`만 적으면 된다 — 이 경우 이슈와 PR이 양방향으로 링크되지만 상태는 바뀌지 않는다.

## gh CLI로 이슈 다루기

터미널에서 이슈를 만들고 관리하면 컨텍스트 전환 없이 작업할 수 있다.

```bash
# 이슈 생성
gh issue create \
  --title "로그인 시 500 에러" \
  --body "빈 비밀번호 제출 시 500 발생, 400이어야 함" \
  --label "bug,priority:high" \
  --assignee "@me"

# 열린 이슈 목록 (라벨 필터)
gh issue list --label bug --state open

# 이슈 상세 보기
gh issue view 38

# 이슈에 코멘트
gh issue comment 38 --body "원인은 입력 검증 누락으로 보입니다."

# 직접 닫기
gh issue close 38 --reason completed
```

## 좋은 이슈 작성과 운영 팁

```text
- 제목은 증상/요청을 한 줄로: "로그인 시 500 에러"
- 버그는 재현 절차·기대·실제를 분리해서 적기
- 라벨 체계를 단순하게: type(bug/feat) + priority 정도면 충분
- 중복 이슈는 닫고 원본을 링크 (Duplicate of #x)
- 이슈 템플릿으로 보고 품질을 표준화 (.github/ISSUE_TEMPLATE)
```

특히 재현 절차가 빠진 버그 이슈는 결국 다시 물어보느라 시간이 든다. "무엇을 했더니(절차) / 무엇을 기대했고(기대) / 실제로 무엇이 일어났는지(실제)" 세 가지를 적는 습관이 처리 속도를 크게 높인다.

이슈가 개별 작업의 추적이라면, 그 작업들을 한눈에 보며 흐름을 관리하는 도구가 필요해진다. 다음 글에서는 이슈와 PR을 칸반 보드로 시각화하는 **GitHub Projects**를 살펴본다.

---

**지난 글:** [GitHub Actions로 PR 검사 자동화하기](/posts/github-actions-pr-checks/)

**다음 글:** [GitHub Projects: 칸반으로 이슈와 PR 관리하기](/posts/github-projects/)

<br>
읽어주셔서 감사합니다. 😊
