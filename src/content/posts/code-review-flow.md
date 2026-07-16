---
title: "코드 리뷰 흐름: PR에서 머지까지"
description: "PR 생성부터 머지까지 작성자와 리뷰어의 역할, 코멘트 유형(Blocker·Suggestion·Nit) 구분, Draft PR 활용법, Suggested Changes, 좋은 리뷰 문화를 위한 원칙을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "코드리뷰", "PR", "GitHub", "팀협업", "개발문화"]
featured: false
draft: false
---

[지난 글](/posts/branch-protection-rules/)에서 브랜치 보호 규칙으로 리뷰를 강제하는 방법을 다뤘다. 규칙이 있어도 리뷰 프로세스가 명확하지 않으면 형식적인 "LGTM"만 오가게 된다. 이 글에서는 **실제 코드 리뷰가 어떻게 흘러가야 하는지** 작성자와 리뷰어 각각의 역할을 중심으로 살펴본다.

## 전체 흐름

![코드 리뷰 흐름](/assets/posts/code-review-flow-process.svg)

## 작성자(Author)의 역할

### PR을 잘 만드는 것이 절반이다

리뷰어가 맥락을 파악하는 데 걸리는 시간을 줄여줄수록 리뷰 품질이 높아진다.

**좋은 PR 설명 구성:**
```markdown
## 무엇을 바꿨나
- 결제 API의 토큰 만료 처리 로직을 수정했습니다

## 왜 바꿨나
- 기존 코드는 토큰 만료 시 500 에러를 반환해 클라이언트가 원인을 알 수 없었습니다
- 401 Unauthorized + WWW-Authenticate 헤더로 표준을 따릅니다

## 테스트 방법
- `npm test src/payment/auth.test.ts` 실행
- Postman collection: [링크]
```

### Draft PR로 이른 피드백 받기

구현 방향이 확실하지 않거나 큰 변경일 때 **Draft PR**을 먼저 열어 방향성을 검토받는다.

```bash
# GitHub CLI로 Draft PR 생성
gh pr create --draft --title "feat: 결제 토큰 갱신 로직 개선" \
  --body "작업 중 — 방향 피드백 환영"
```

Draft 상태에서는 CI가 돌아도 머지 버튼이 비활성화된다. 준비 완료 시 "Ready for review"로 전환한다.

### 수정 vs 반론

리뷰어의 제안에 동의하면 수정 후 커밋을 추가한다. 동의하지 않으면 **근거를 들어 토론**한다. "아니요"로 끝내지 말고 왜 현재 방식을 선택했는지 설명한다.

```bash
# 리뷰 반영 커밋 메시지 예
git commit -m "review: 에러 응답에 WWW-Authenticate 헤더 추가"
```

수정 완료 후 GitHub UI에서 **Re-request review** 버튼으로 리뷰어에게 재요청한다.

## 리뷰어(Reviewer)의 역할

### 무엇을 봐야 하는가

1. **정확성**: 코드가 의도대로 동작하는가? 엣지 케이스는?
2. **설계**: 기존 아키텍처와 일관성이 있는가?
3. **테스트**: 실패 케이스를 커버하는 테스트가 있는가?
4. **보안**: SQL 인젝션, XSS, 권한 검증 누락이 없는가?
5. **성능**: N+1 쿼리, 불필요한 반복 계산이 없는가?

### 코멘트 유형 구분

![리뷰 코멘트 유형과 원칙](/assets/posts/code-review-flow-types.svg)

코멘트에 우선순위를 명시하면 작성자가 무엇부터 처리할지 알 수 있다.

```text
# Blocker (필수 수정)
이 코드에서 SQL 인젝션이 발생할 수 있습니다.
prepared statement 사용이 필요합니다.

# Suggestion (제안)
suggestion: map() 대신 filter().map() 체이닝이 
가독성이 더 좋을 것 같습니다.

# Nit (사소한 것)
nit: 변수명 `d`보다 `date`가 명확할 것 같아요
```

### Suggested Changes

GitHub의 **Suggested Changes** 기능을 사용하면 코멘트에 구체적인 코드 수정안을 넣을 수 있다. 작성자는 1클릭으로 해당 코드를 커밋에 반영할 수 있다.

````diff
# GitHub 코멘트 박스에서
```suggestion
const expiryDate = new Date(token.exp * 1000);
```
````

## 머지 방식 선택

| 방식 | 언제 | 특징 |
|---|---|---|
| Merge commit | 기본값 | 전체 커밋 히스토리 보존 |
| Squash and merge | 커밋이 지저분할 때 | 하나의 커밋으로 압축 |
| Rebase and merge | 선형 히스토리 유지 시 | merge commit 없음 |

팀에서 하나의 방식으로 통일하면 `git log`가 일관되게 유지된다.

---

**지난 글:** [Branch Protection Rules: 실수 방지 안전망](/posts/branch-protection-rules/)

**다음 글:** [PR 템플릿으로 일관된 PR 작성하기](/posts/pr-template/)

<br>
읽어주셔서 감사합니다. 😊
