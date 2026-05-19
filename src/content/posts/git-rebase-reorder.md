---
title: "git rebase -i — 커밋 순서 바꾸기"
description: "git rebase -i 에디터에서 줄 순서를 바꿔 커밋 배열을 재정렬하는 방법, 충돌 처리, 실전 활용 패턴을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 1
type: "knowledge"
category: "Git"
tags: ["Git", "rebase", "interactive", "커밋 순서", "히스토리 정리"]
featured: false
draft: false
---

[지난 글](/posts/git-rebase-squash-fixup/)에서 squash와 fixup으로 커밋을 합치는 방법을 배웠다. 이번에는 `git rebase -i`의 또 다른 기능인 **커밋 순서 재배열**을 다룬다. 에디터에서 줄을 이동하는 것만으로 커밋이 다시 쌓이는 순서를 바꿀 수 있다.

## 왜 커밋 순서를 바꾸는가

브랜치에서 작업하다 보면 논리적으로는 API 구현이 먼저여야 하는데 UI 커밋이 앞에 있거나, 문서 커밋이 기능 커밋보다 뒤에 쌓이는 상황이 생긴다. PR 리뷰어가 커밋을 순서대로 따라갈 때 흐름이 자연스러운 것이 이상적이다. `rebase -i` 순서 재배열로 "먼저 개념, 다음 구현, 마지막 테스트" 같은 논리적 흐름을 만들 수 있다.

![커밋 순서 재배열 개념](/assets/posts/git-rebase-reorder-concept.svg)

## 기본 사용법

```bash
# 마지막 4개 커밋을 편집 대상으로
git rebase -i HEAD~4

# origin/main 이후 커밋 전체를 편집
git rebase -i origin/main
```

에디터가 열리면 커밋이 **오래된 것부터 위에** 표시된다. `git log`와 반대 순서임에 주의한다.

```
pick abc111 docs: README 업데이트
pick def222 feat: login UI
pick ghi333 feat: login API
pick jkl444 test: login 테스트 추가
```

API → UI 순서가 더 자연스럽다면 `def222`와 `ghi333` 줄을 교환한다.

![rebase -i 에디터 줄 이동](/assets/posts/git-rebase-reorder-editor.svg)

## vim으로 줄 이동하기

```
# vim에서 줄 이동
dd   # 현재 줄 잘라내기
p    # 커서 아래 줄에 붙여넣기
P    # 커서 위 줄에 붙여넣기

# 여러 줄 이동
3dd  # 현재 줄부터 3줄 잘라내기
p    # 붙여넣기
```

저장하고 나오면(`ESC → :wq`) Git이 위에서부터 순서대로 커밋을 재적용한다.

## 충돌 처리

커밋 순서를 바꾸면 의존 관계에 따라 충돌이 날 수 있다. 예를 들어 `def222`(UI)가 `ghi333`(API)에서 만든 함수를 호출한다면, API가 없는 상태에서 UI를 먼저 적용할 때 충돌이 생긴다.

```bash
# 충돌 발생 시 메시지
# CONFLICT (content): Merge conflict in src/auth.js

# 충돌 해결 후
git add src/auth.js
git rebase --continue

# 전체 취소하고 원래 상태로
git rebase --abort
```

충돌이 자주 난다면 순서 변경이 의존 관계를 위반하는 것이다. 의존 없는 독립 커밋끼리만 순서를 바꾸거나, 충돌을 받아들이고 해결하면서 진행한다.

## 여러 커밋을 한 번에 재배열

```bash
git rebase -i HEAD~6
```

에디터에서:

```
pick a1 feat: 데이터 모델
pick b2 feat: API 엔드포인트
pick c3 test: 데이터 모델 테스트
pick d4 test: API 테스트
pick e5 docs: API 문서
pick f6 fix: 엣지케이스 수정
```

리뷰어 친화적 순서로 재배열:

```
pick a1 feat: 데이터 모델
pick c3 test: 데이터 모델 테스트
pick b2 feat: API 엔드포인트
pick d4 test: API 테스트
pick e5 docs: API 문서
pick f6 fix: 엣지케이스 수정
```

구현과 테스트를 짝지어 배치해 리뷰가 단계별로 진행되도록 만든 것이다.

## 순서 변경과 squash 동시에

reorder와 squash를 한 편집 세션에서 함께 적용할 수 있다.

```bash
git rebase -i HEAD~5
```

```
pick a1 feat: 데이터 모델
squash c3 test: 데이터 모델 테스트
pick b2 feat: API 엔드포인트
fixup d4 test: API 테스트
pick e5 docs: API 문서
```

한 번의 rebase로 순서 변경과 커밋 합치기를 동시에 처리한다.

## push 후 주의사항

rebase -i는 SHA를 새로 계산하므로 이미 push한 브랜치라면 force push가 필요하다.

```bash
git push --force-with-lease origin feature/auth
```

공유 브랜치(main, develop)에서는 절대 하지 않는다. 본인만 사용하는 feature 브랜치에서만 적용한다.

---

**지난 글:** [git rebase -i — squash와 fixup으로 히스토리 정리](/posts/git-rebase-squash-fixup/)

**다음 글:** [git rebase -i — drop으로 커밋 삭제](/posts/git-rebase-drop-commit/)

<br>
읽어주셔서 감사합니다. 😊
