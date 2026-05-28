---
title: "이슈 템플릿으로 버그 리포트와 기능 요청 구조화하기"
description: "GitHub Issue Forms(.yml)와 마크다운 방식 이슈 템플릿 구성법, textarea·dropdown·checkboxes 필드 유형, config.yml로 빈 이슈 비활성화, 레이블 체계와 이슈 생명 주기를 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["Git", "GitHub", "이슈템플릿", "IssueTemplate", "버그리포트", "프로젝트관리"]
featured: false
draft: false
---

[지난 글](/posts/pr-template/)에서 PR 템플릿을 다뤘다. PR이 "변경 사항"의 입구라면, 이슈는 "할 일"의 입구다. 구조 없이 받는 버그 신고는 재현 방법이 빠지거나, 기능 요청이 충분한 맥락 없이 쏟아지는 문제가 생긴다. **이슈 템플릿**으로 이 문제를 해결한다.

## 두 가지 방식

GitHub은 이슈 템플릿을 두 가지 방식으로 지원한다.

1. **마크다운(.md)**: 기존 방식. 빈 본문에 마크다운 텍스트를 채운다
2. **Issue Forms(.yml)**: 구조화된 폼. 텍스트 입력, 드롭다운, 체크박스 등 HTML 폼 형태로 제공

신규 저장소에는 **Issue Forms**(.yml)를 사용하는 것이 권장된다. 필수 필드를 강제할 수 있고, 이슈 데이터를 구조화해서 필터링·자동화에 활용하기 좋다.

## Issue Forms 구성

![이슈 템플릿 종류와 설정](/assets/posts/issue-template-types.svg)

### 버그 리포트 템플릿

```yaml
# .github/ISSUE_TEMPLATE/bug_report.yml
name: Bug Report
description: 버그를 신고합니다
title: "[Bug] "
labels: ["bug", "triage"]
body:
  - type: markdown
    attributes:
      value: |
        버그를 발견해주셔서 감사합니다! 아래 양식을 최대한 자세히 채워주세요.

  - type: textarea
    id: reproduce
    attributes:
      label: 재현 방법
      description: 버그를 재현하는 단계를 순서대로 설명해주세요
      placeholder: |
        1. '설정' 메뉴로 이동
        2. '계정' 클릭
        3. ...
    validations:
      required: true

  - type: textarea
    id: expected
    attributes:
      label: 기대 동작
    validations:
      required: true

  - type: textarea
    id: actual
    attributes:
      label: 실제 동작
    validations:
      required: true

  - type: dropdown
    id: os
    attributes:
      label: 운영체제
      options:
        - macOS
        - Windows
        - Linux
    validations:
      required: true

  - type: input
    id: version
    attributes:
      label: 앱 버전
      placeholder: "v2.3.1"
```

### 기능 요청 템플릿

```yaml
# .github/ISSUE_TEMPLATE/feature_request.yml
name: Feature Request
description: 새 기능을 제안합니다
title: "[Feature] "
labels: ["enhancement"]
body:
  - type: textarea
    id: problem
    attributes:
      label: 어떤 문제를 해결하고 싶으신가요?
    validations:
      required: true

  - type: textarea
    id: solution
    attributes:
      label: 제안하는 해결 방법
    validations:
      required: true

  - type: checkboxes
    id: checklist
    attributes:
      label: 확인 사항
      options:
        - label: 유사한 이슈가 없음을 확인했습니다
          required: true
        - label: 문서를 먼저 확인했습니다
```

### config.yml — 빈 이슈 비활성화

```yaml
# .github/ISSUE_TEMPLATE/config.yml
blank_issues_enabled: false
contact_links:
  - name: Q&A 게시판
    url: https://github.com/org/repo/discussions
    about: 일반적인 질문은 Discussion을 이용해주세요
```

`blank_issues_enabled: false`로 설정하면 이슈 생성 시 템플릿 선택이 강제된다.

## 이슈 생명 주기와 레이블

![이슈 생명 주기](/assets/posts/issue-template-lifecycle.svg)

### 표준 레이블 체계

GitHub 기본 레이블에 팀 맞춤 레이블을 추가해 이슈를 분류한다.

```bash
# GitHub CLI로 레이블 일괄 생성
gh label create "priority: high" --color "e05555" --description "긴급 처리 필요"
gh label create "priority: medium" --color "e0955e"
gh label create "area: backend" --color "7ec8e3"
gh label create "area: frontend" --color "9988dd"
```

### 이슈를 PR에 연결

PR 본문에 `Closes #이슈번호`를 넣으면 PR이 머지될 때 해당 이슈가 자동으로 닫힌다.

```markdown
## 관련 이슈
Closes #142
Fixes #143
```

한 PR이 여러 이슈를 닫을 수도 있고, 반대로 하나의 이슈를 여러 PR이 해결하는 경우도 있다.

## Organization 기본 이슈 템플릿

조직 수준 `.github` 저장소에 템플릿을 두면, 개별 저장소에 템플릿이 없는 경우 폴백으로 사용된다. PR 템플릿과 동일한 원리다.

---

**지난 글:** [PR 템플릿으로 일관된 PR 작성하기](/posts/pr-template/)

**다음 글:** [Merge vs Rebase: 팀에 맞는 병합 정책 고르기](/posts/merge-vs-rebase-policy/)

<br>
읽어주셔서 감사합니다. 😊
