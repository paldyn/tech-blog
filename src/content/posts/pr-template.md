---
title: "PR 템플릿으로 일관된 PR 작성하기"
description: "GitHub PR 템플릿 파일(.github/PULL_REQUEST_TEMPLATE.md)의 구조, 복수 템플릿 설정 방법, Closes # 키워드로 이슈 자동 연결, 팀 관행에 맞는 템플릿 구성 팁을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 6
type: "knowledge"
category: "Git"
tags: ["Git", "GitHub", "PR", "PR템플릿", "팀협업", "코드리뷰"]
featured: false
draft: false
---

[지난 글](/posts/code-review-flow/)에서 코드 리뷰 흐름을 다뤘다. PR 설명이 잘 작성된 팀일수록 리뷰 품질이 높다는 것을 알았다. 문제는 "잘 쓰자"는 구두 약속은 지켜지지 않는다는 점이다. **PR 템플릿**은 PR 생성 시 본문을 자동으로 채워주는 파일로, 팀 전체가 일관된 형식의 PR을 쓰도록 강제한다.

## 파일 위치

GitHub은 PR 생성 시 다음 경로에서 템플릿 파일을 자동으로 로드한다.

```
PULL_REQUEST_TEMPLATE.md          # 저장소 루트
.github/PULL_REQUEST_TEMPLATE.md  # .github 디렉토리
docs/PULL_REQUEST_TEMPLATE.md     # docs 디렉토리
```

세 위치 중 하나에 파일을 두면 된다. 보통 `.github/` 안에 두는 것이 관례다.

## 기본 템플릿 구조

![PR 템플릿 구조](/assets/posts/pr-template-structure.svg)

```markdown
## 변경 사항
<!-- 무엇을 왜 변경했는지 설명 -->

## 변경 유형
- [ ] 버그 수정
- [ ] 새 기능
- [ ] 리팩토링 (동작 변경 없음)
- [ ] Breaking change
- [ ] 문서 업데이트

## 테스트
- [ ] 단위 테스트 추가/수정
- [ ] 로컬에서 직접 확인
- [ ] E2E 테스트 통과

## 스크린샷 (UI 변경 시)
<!-- Before / After 이미지 -->

## 관련 이슈
Closes #

## 리뷰어에게
<!-- 특히 봐줬으면 하는 부분, 설계 결정 배경 -->
```

### Closes # — 이슈 자동 연결

`Closes #123` 형식을 본문에 넣으면 PR이 머지될 때 해당 이슈가 자동으로 닫힌다. 지원하는 키워드:

```
Closes #123
Fixes #123
Resolves #123
```

## 복수 템플릿 설정

버그픽스와 새 기능 PR의 체크리스트가 다른 경우, `.github/PULL_REQUEST_TEMPLATE/` 디렉토리에 여러 파일을 두고 URL 파라미터로 선택할 수 있다.

![복수 PR 템플릿 설정](/assets/posts/pr-template-multiple.svg)

```bash
# GitHub CLI로 특정 템플릿 지정
gh pr create \
  --title "fix: 결제 토큰 갱신 오류" \
  --body-file .github/PULL_REQUEST_TEMPLATE/bugfix.md
```

## 좋은 템플릿 설계 원칙

**너무 길지 않게**: 10개 이상의 체크박스는 오히려 형식적 체크만 유발한다. 5~7개로 핵심만 남긴다.

**팀에 맞게 시작**: 처음부터 완벽한 템플릿을 만들려 하지 말고, 3~4개 섹션으로 시작해 운영하면서 개선한다.

**HTML 주석 활용**: `<!-- 예시: 검색 기능 추가 시 ES 쿼리 최적화 여부 확인 -->` 형태로 가이드를 주석으로 넣으면 PR 본문에는 나오지 않는다.

**체크박스는 강제 사항이 아니다**: PR 생성 시 체크박스 체크 여부를 GitHub이 강제하지 않는다. 체크박스는 "이 항목을 확인했나요?" 상기 역할이다.

## Organization 수준 템플릿

GitHub Organizations에서는 `.github` 저장소에 기본 PR 템플릿을 두면 Organization 내 모든 저장소에서 해당 템플릿이 폴백으로 사용된다.

```
org-name/.github/
└── PULL_REQUEST_TEMPLATE.md  # 전사 기본 PR 템플릿
```

개별 저장소에 템플릿이 있으면 저장소 템플릿이 우선이다.

---

**지난 글:** [코드 리뷰 흐름: PR에서 머지까지](/posts/code-review-flow/)

**다음 글:** [이슈 템플릿으로 버그 리포트와 기능 요청 구조화하기](/posts/issue-template/)

<br>
읽어주셔서 감사합니다. 😊
