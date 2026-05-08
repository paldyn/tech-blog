---
title: "커밋 메시지 컨벤션: 좋은 커밋 메시지의 조건"
description: "Conventional Commits 규격의 type·scope·subject·body·footer 구조와 팀 히스토리를 읽기 쉽게 만드는 원칙을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 3
type: "knowledge"
category: "Git"
tags: ["Git", "커밋 메시지", "Conventional Commits", "컨벤션"]
featured: false
draft: false
---

[지난 글](/posts/git-commit-anatomy/)에서 커밋 객체의 구조를 뜯어봤다. 이번에는 그 객체의 핵심 데이터, 커밋 메시지에 집중한다. 메시지를 어떻게 쓰느냐에 따라 6개월 후 `git log`가 읽을 수 있는 문장이 될 수도 있고, 해석 불가능한 암호가 될 수도 있다.

## 왜 커밋 메시지가 중요한가

버그를 추적하다 보면 문제 코드가 언제 왜 들어왔는지 `git log`로 확인하는 경우가 많다. 이때 커밋 메시지가 "fix bug"라면 아무 정보도 얻을 수 없다. 반면 "fix(auth): resolve token expiry causing infinite refresh loop"라면 원인을 즉시 파악할 수 있다.

코드는 **무엇을** 하는지 스스로 설명하지만, **왜** 그렇게 바꿨는지는 커밋 메시지만이 설명할 수 있다.

## Conventional Commits 규격

현재 업계에서 가장 널리 쓰이는 커밋 메시지 규격이다. [conventionalcommits.org](https://www.conventionalcommits.org)에서 공식 사양을 확인할 수 있다.

```
type(scope): subject

body

footer
```

이 세 영역이 각각 한 단락이며, 영역 사이에 **반드시 빈 줄**이 들어간다.

![커밋 메시지 구조](/assets/posts/git-commit-message-conventions-format.svg)

## subject: 50자, 명령형

subject(첫 번째 줄)는 50자 이하로 쓰는 것이 권장된다. GitHub 같은 플랫폼은 72자까지는 표시하지만, 50자를 넘으면 목록에서 잘려 보이는 경우가 많다.

동사는 **명령형**(imperative mood)을 사용한다.

```
# 올바른 형태
add user authentication
fix null pointer in parser
remove deprecated endpoint

# 잘못된 형태
added user authentication
fixing null pointer
I removed the deprecated endpoint
```

"이 커밋은 ___한다(This commit ___s)"는 문장에 자연스럽게 들어맞아야 한다.

## type: 변경의 성격을 분류

`feat`과 `fix`가 가장 빈번하게 사용된다. 그 외:

- `docs`: 코드 없이 문서만 수정
- `style`: 들여쓰기, 세미콜론 등 의미 없는 형식 변경
- `refactor`: 기능 변경 없이 내부 구조를 개선
- `perf`: 성능 개선 (동작은 그대로)
- `test`: 테스트 추가 또는 수정
- `chore`: 빌드 시스템, 패키지 설정 등
- `ci`: CI 파이프라인 변경
- `revert`: 이전 커밋을 되돌릴 때

## scope: 영향 범위 명시 (선택)

scope는 어떤 모듈이나 파일이 바뀌었는지를 괄호 안에 표시한다.

```
feat(auth): add OAuth2 login
fix(api): handle empty response body
chore(deps): bump eslint to 9.0
```

scope를 사용할지 여부와 어떤 단어를 쓸지는 팀에서 사전에 정한다. 일관성이 핵심이다.

## body: WHY를 설명

body는 의무가 아니다. 그러나 **왜 이 변경이 필요했는지** 설명이 필요한 경우에는 반드시 써야 한다. 뭘 했는지(코드를 보면 알 수 있다)가 아니라 왜를 설명한다.

```bash
git commit -m "refactor(db): extract connection pool to singleton

Previous implementation created a new connection per request,
leading to exhaustion under heavy load (> 500 rps).
Singleton pool reduces connection count from ~500 to ~20."
```

## footer: 이슈 연결과 BREAKING CHANGE

```
feat(api)!: remove v1 endpoints

BREAKING CHANGE: /api/v1/* endpoints removed.
Migrate to /api/v2/. See docs/migration-v2.md.

Closes #412
Co-authored-by: Alice <alice@example.com>
```

`type!:` 또는 footer의 `BREAKING CHANGE:` 중 하나라도 있으면 이 커밋은 semver의 **major 버전을 올려야 하는 변경**으로 간주된다. `semantic-release` 같은 도구가 이를 자동으로 감지해 릴리스를 생성한다.

## 좋은 메시지와 나쁜 메시지

![좋은 vs 나쁜 커밋 메시지](/assets/posts/git-commit-message-conventions-examples.svg)

## 실무 팁

멀티라인 메시지를 터미널에서 쓸 때:

```bash
git commit  # 편집기가 열림
```

또는 `-m`을 두 번:

```bash
git commit -m "feat(login): add remember-me option" \
           -m "Stores encrypted token in localStorage.
Expires after 30 days per security policy."
```

팀 전체에 컨벤션을 강제하려면 `commitlint`와 `husky`를 조합한다. 이 조합은 이후 글에서 별도로 다룬다.

---

**지난 글:** [커밋 객체 해부: 내부 구조를 손으로 뜯어보기](/posts/git-commit-anatomy/)

**다음 글:** [git status 읽기: 저장소 상태를 한눈에 파악하기](/posts/git-status-overview/)

<br>
읽어주셔서 감사합니다. 😊
