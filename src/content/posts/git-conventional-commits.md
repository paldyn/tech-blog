---
title: "Conventional Commits: 커밋 메시지 표준 형식"
description: "Conventional Commits 스펙의 메시지 구조(type, scope, description, body, footer), 타입별 의미와 semver 범프 규칙, BREAKING CHANGE 표기 방법, 자동 CHANGELOG 생성 연계를 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "Conventional Commits", "커밋메시지", "semver", "CHANGELOG", "자동화"]
featured: false
draft: false
---

[지난 글](/posts/git-lint-staged/)에서 스테이징된 파일에만 lint를 실행하는 lint-staged를 다뤘다. 코드 품질을 자동화한 다음은 **커밋 메시지의 표준화**다. **Conventional Commits**는 커밋 메시지에 구조적 형식을 부여해 변경 이력을 기계가 파싱할 수 있도록 만드는 스펙이다.

## 메시지 형식

```
<type>(<scope>)!: <description>

[body]

[footer(s)]
```

세 부분으로 구성된다.

| 부분 | 필수 | 설명 |
|------|------|------|
| `type` | 필수 | 변경 유형 |
| `(scope)` | 선택 | 변경 범위 (컴포넌트, 모듈명 등) |
| `!` | 선택 | BREAKING CHANGE 표시 |
| `description` | 필수 | 한 줄 요약 (소문자 시작, 마침표 없음) |
| `body` | 선택 | 상세 설명 (빈 줄로 구분) |
| `footer` | 선택 | 이슈 참조, BREAKING CHANGE 상세 |

![Conventional Commits 메시지 구조](/assets/posts/git-conventional-commits-format.svg)

## 타입 종류

```
feat:     새 기능 추가
fix:      버그 수정
docs:     문서만 변경
style:    코드 의미 변화 없는 포맷 변경 (공백, 세미콜론 등)
refactor: 버그 수정도 기능 추가도 아닌 코드 변경
test:     누락된 테스트 추가 또는 기존 테스트 수정
chore:    빌드 프로세스, 보조 도구 변경
perf:     성능 개선
ci:       CI 설정 파일/스크립트 변경
build:    빌드 시스템 또는 외부 의존성 변경
revert:   이전 커밋 되돌리기
```

## BREAKING CHANGE

하위 호환성을 파괴하는 변경은 두 가지 방법으로 표시한다.

### 방법 1: type 뒤에 `!`

```
feat(api)!: 응답 구조를 v2로 변경

v1 클라이언트는 업데이트 필요
```

### 방법 2: footer에 `BREAKING CHANGE:`

```
feat(api): 응답 구조를 v2로 변경

데이터 필드명을 camelCase로 통일함.

BREAKING CHANGE: v1 API 응답의 user_id 필드가 userId로 변경됨.
Fixes #234
```

두 방법을 동시에 사용할 수도 있다.

## semver와의 관계

Conventional Commits의 가장 큰 장점은 **자동 버전 범프**다.

![커밋 타입과 버전 범프 관계](/assets/posts/git-conventional-commits-types.svg)

```
feat  → MINOR 범프  (1.2.0 → 1.3.0)
fix   → PATCH 범프  (1.2.0 → 1.2.1)
BREAKING CHANGE → MAJOR 범프  (1.2.0 → 2.0.0)
```

`docs`, `style`, `refactor`, `test`, `chore` 등은 기본적으로 버전 범프를 유발하지 않는다. `semantic-release`나 `standard-version` 같은 도구가 이 규칙을 따라 자동으로 버전을 결정한다.

## body와 footer 활용

```
fix(auth): 토큰 만료 후 로그인 루프 문제 수정

expires_at 타임스탬프가 UTC 기준이 아닌 로컬 시간으로
비교되던 문제를 수정함. 서버 응답의 expires_at을
Date.UTC()로 변환 후 비교하도록 변경.

Fixes #456
Reviewed-by: Alice <alice@example.com>
```

`body`는 무엇을(what)이 아닌 **왜(why)**를 설명한다. `footer`는 GitHub 이슈 연결(`Fixes #`, `Closes #`, `Refs #`)이나 리뷰어 정보를 기록한다.

## 실제 사용 예시

```
feat(user): 이메일 인증 플로우 추가
fix(cart): 수량 0 이하 입력 시 에러 처리
docs(readme): 로컬 개발 환경 설정 가이드 추가
refactor(api): HTTP 클라이언트를 axios에서 fetch로 교체
chore: 사용하지 않는 의존성 제거
test(user): 회원가입 유효성 검사 단위 테스트 추가
ci: GitHub Actions Node.js 버전 18에서 20으로 업데이트
```

## CHANGELOG 자동 생성

```bash
# standard-version 사용 시
npx standard-version

# semantic-release 사용 시 (CI에서 실행)
npx semantic-release
```

커밋 이력에서 `feat`, `fix`, `BREAKING CHANGE`를 자동으로 추출해 `CHANGELOG.md`를 생성한다.

---

**지난 글:** [lint-staged: 변경 파일만 골라서 lint하기](/posts/git-lint-staged/)

**다음 글:** [commitlint: 커밋 메시지 형식 자동 검증](/posts/git-commitlint/)

<br>
읽어주셔서 감사합니다. 😊
