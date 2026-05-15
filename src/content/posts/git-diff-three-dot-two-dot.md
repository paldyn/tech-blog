---
title: "git diff 두 점(..)과 세 점(...): 브랜치 간 비교의 차이"
description: "git diff의 두 점(..)과 세 점(...)이 만들어내는 서로 다른 비교 범위를 이해하고, PR 리뷰 등 실전 상황에서 올바르게 선택하는 법을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "git diff", "두 점", "세 점", "브랜치 비교", "merge-base"]
featured: false
draft: false
---

[지난 글](/posts/git-diff-staged/)에서 `git diff --staged`로 커밋 전 변경을 검토하는 법을 다뤘다. 이번에는 브랜치 간 비교에서 자주 혼동되는 두 점(`..`)과 세 점(`...`)의 차이를 명확히 정리한다.

## 두 점(..)과 세 점(...)

브랜치를 비교할 때 두 표기법은 서로 다른 범위를 가리킨다.

```bash
git diff main..feature    # 두 점
git diff main...feature   # 세 점
```

결과가 다르고, 언제 어떤 것을 쓸지 모르면 의도치 않은 차이를 보게 된다.

![두 점(..) vs 세 점(...) 비교 범위](/assets/posts/git-diff-three-dot-two-dot-diagram.svg)

## 두 점(..): 끝 커밋을 직접 비교

```bash
git diff main..feature
# 위 명령은 아래와 완전히 동일
git diff main feature
```

`main`의 최신 커밋과 `feature`의 최신 커밋을 **직접** 비교한다. `main`이 `feature` 분기 이후 새로운 커밋을 받았다면, 그 변경도 diff에 포함된다.

즉, `feature`에서만 바꾼 것과 `main`에서 앞서간 것이 섞여 보인다.

## 세 점(...): 공통 조상 이후 변경만

```bash
git diff main...feature
```

`main`과 `feature`의 **공통 조상(merge base)** 커밋을 찾아, 그 시점 이후 `feature`에서 생긴 변경만 보여준다. `main`이 앞서간 커밋은 무시된다.

이것이 PR 리뷰에서 자연스러운 질문인 "이 브랜치에서 뭘 바꿨지?"에 정확히 대응한다.

## 실전: PR 리뷰에 세 점 사용

![실전 사용 패턴](/assets/posts/git-diff-three-dot-two-dot-examples.svg)

```bash
# feature/login이 main에서 분기한 이후 변경만 확인
git diff main...feature/login

# 파일 목록만 보고 싶을 때
git diff --name-only main...feature/login

# 통계
git diff --stat main...feature/login
```

`git log`에서는 반대로 세 점(`...`)이 "공통 조상 이후 양쪽 브랜치의 커밋"을 의미한다. `git diff`와 `git log`에서 점 표기법의 의미가 다르다는 점을 주의해야 한다.

## merge-base로 직접 확인

세 점이 내부적으로 하는 일을 직접 재현해볼 수 있다.

```bash
# 공통 조상 커밋 확인
git merge-base main feature/login
# 예: abc1234

# 세 점과 동일한 결과
git diff abc1234 feature/login
```

## 정리

| 표기법 | 비교 대상 | 주요 용도 |
|--------|----------|-----------|
| `main..feature` | main 팁 vs feature 팁 | 두 브랜치 현재 상태 비교 |
| `main...feature` | merge-base vs feature 팁 | PR에서 기여 범위 확인 |

브랜치 비교에는 대부분 세 점(`...`)이 의도에 맞다. `main`에 계속 커밋이 쌓여도 내 `feature`에서 바꾼 내용만 깔끔하게 볼 수 있기 때문이다.

---

**지난 글:** [git diff --staged: 커밋 전 인덱스 변경 내용 검토하기](/posts/git-diff-staged/)

**다음 글:** [git log 기초: 커밋 히스토리 탐색하기](/posts/git-log-basics/)

<br>
읽어주셔서 감사합니다. 😊
