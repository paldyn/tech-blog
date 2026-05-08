---
title: "git add -p: 변경을 헝크 단위로 골라 스테이징하기"
description: "git add --patch로 파일 내 헝크(hunk)를 선택적으로 스테이징하는 방법, 각 프롬프트 옵션의 의미, 실무 워크플로를 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["Git", "git add", "패치 모드", "헝크", "스테이징"]
featured: false
draft: false
---

[지난 글](/posts/git-add-basics/)에서 `git add`의 기본 동작을 살펴봤다. 실무에서는 하나의 파일 안에 서로 다른 목적의 변경이 섞이는 경우가 자주 생긴다. 이때 `git add -p`(patch 모드)를 사용하면 파일 단위가 아니라 **변경 덩어리(hunk) 단위**로 스테이징을 제어할 수 있다.

## 헝크(hunk)란

diff 출력에서 `@@`로 시작하는 각 블록이 헝크다. 하나의 파일에 50줄이 바뀌었더라도, 그 변경이 서로 떨어진 위치에 있다면 Git은 여러 헝크로 나눈다.

```diff
@@ -1,6 +1,7 @@
 function login(user) {
+  validateInput(user);
   return auth.login(user);

@@ -20,6 +21,7 @@
 function logout(user) {
-  console.log(user);  // debug
   clearSession();
```

위 예시처럼 "입력 검증 추가"와 "디버그 로그 제거"는 같은 파일에 있지만 다른 커밋으로 분리하는 것이 이상적이다.

## git add -p 실행

```bash
git add -p src/auth.js
# 또는
git add --patch src/auth.js
```

실행하면 Git이 첫 번째 헝크를 보여주고 프롬프트를 출력한다.

```
Stage this hunk [y,n,q,a,d,/,s,e,?]?
```

![git add -p 헝크 선택](/assets/posts/git-add-patch-hunk.svg)

## 프롬프트 옵션 상세

| 키 | 동작 |
|----|------|
| `y` | 이 헝크를 스테이징 |
| `n` | 이 헝크를 건너뜀 |
| `s` | 헝크를 더 작은 단위로 분할 (가능한 경우) |
| `e` | 편집기에서 헝크를 수동 편집 |
| `a` | 이 파일의 나머지 헝크 모두 스테이징 |
| `d` | 이 파일의 나머지 헝크 모두 건너뜀 |
| `q` | 패치 모드 종료 |
| `?` | 도움말 출력 |

## 실전 워크플로

![git add -p 워크플로](/assets/posts/git-add-patch-workflow.svg)

```bash
# 1. 패치 모드로 첫 번째 헝크(feat) 스테이징
git add -p src/auth.js
# 헝크1: y (스테이징)
# 헝크2: n (건너뜀)

# 2. 첫 번째 커밋
git commit -m "feat(auth): add input validation"

# 3. 남은 변경 스테이징
git add src/auth.js

# 4. 두 번째 커밋
git commit -m "chore: remove debug log"
```

하나의 파일에서 의미 있는 두 커밋이 완성된다.

## s 옵션: 헝크 분할

두 변경이 맞닿아 있거나 3줄 이내에 붙어 있으면 Git이 하나의 헝크로 묶는다. 이때 `s`를 누르면 더 작은 단위로 나눈다.

```
Stage this hunk [y,n,q,a,d,/,s,e,?]? s
Split into 2 hunks.
@@ -1,4 +1,5 @@
...
```

분할이 불가능하면 "Sorry, cannot split hunk"라고 표시된다. 그 경우에는 `e`로 편집기를 열어 직접 수정한다.

## e 옵션: 수동 편집

`e`를 누르면 헝크 텍스트가 편집기에서 열린다. 스테이징하지 않을 줄(+로 시작)은 삭제하면 된다. 저장하고 닫으면 편집된 내용만 스테이징된다.

```bash
# 주석 규칙:
# '-' 줄은 삭제하지 말 것 (그대로 두어야 원본 컨텍스트 유지)
# '+' 줄 삭제 = 해당 추가를 스테이징하지 않음
# ' ' 줄은 컨텍스트 줄, 건드리지 말 것
```

## 모든 파일에 적용

특정 파일을 지정하지 않으면 모든 변경된 파일에 순서대로 적용된다.

```bash
git add -p   # 변경된 모든 파일의 헝크를 순회
```

## VSCode와 GUI 도구

터미널이 불편하다면 VSCode의 Source Control 패널에서 줄 단위로 스테이징할 수 있다. 헝크 단위도 지원한다. GUI 환경에서는 이쪽이 더 직관적이다.

`git add -p`는 커밋 하나에 하나의 목적만 담는 습관을 가장 강력하게 지원하는 도구다. 처음에는 번거롭지만, `git log`가 읽기 쉬워지고 코드 리뷰가 편해지는 효과가 즉시 나타난다.

---

**지난 글:** [git add 기본: 스테이징을 정확하게 제어하기](/posts/git-add-basics/)

**다음 글:** [git add -u: 추적 중인 파일만 골라 스테이징하기](/posts/git-add-update/)

<br>
읽어주셔서 감사합니다. 😊
