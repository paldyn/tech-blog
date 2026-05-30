---
title: "git diff --stat: 변경 요약 한눈에 보기"
description: "git diff --stat으로 파일별 변경 규모를 막대로 요약해 보는 법. --shortstat·--numstat·--dirstat의 차이, 커밋·브랜치 비교, --stat-width 조정과 변경 핫스팟 파악 같은 실무 활용을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "diff", "stat", "요약", "비교", "리뷰"]
featured: false
draft: false
---

[지난 글](/posts/git-diff-word-level/)에서 `--word-diff`로 변경을 단어 단위까지 세밀하게 들여다봤다. 이번엔 정반대 방향이다. 수십 개 파일이 바뀐 큰 변경 앞에서 diff를 전부 읽기 전에, "어떤 파일이 얼마나 바뀌었나"를 먼저 파악하고 싶을 때가 있다. **`git diff --stat`**은 변경 내용 대신 **변경 규모**를 파일별 막대로 요약해, 전체 그림을 한눈에 보여준다.

큰 PR을 리뷰할 때, 머지 전 변경 범위를 가늠할 때, 또는 스크립트에서 변경량을 집계할 때 유용하다. 본문(diff body)을 출력하지 않으므로 빠르고, 어디에 집중해서 봐야 할지 길잡이가 되어준다.

![--stat 출력 읽는 법](/assets/posts/git-diff-stat-anatomy.svg)

## 출력 읽는 법

`--stat` 출력의 각 줄은 세 부분으로 이루어진다. 파일명, 변경된 줄 수, 그리고 추가(`+`)와 삭제(`−`)의 비율을 나타내는 막대다. 마지막 줄에 전체 합계가 요약된다.

```bash
git diff --stat
```

```text
 src/auth.js | 24 +++++++++++++-------
 src/api.js  |  6 ++++--
 README.md   |  2 ++
 3 files changed, 21 insertions(+), 11 deletions(-)
```

여기서 주의할 점은 막대 길이가 **실제 줄 수가 아니라 비율**이라는 것이다. 변경이 많아 터미널 폭을 넘으면 Git이 막대를 비율에 맞춰 축소한다. 정확한 줄 수는 막대 앞의 숫자(`24`, `6`, `2`)를 보면 된다.

## 비교 대상 지정하기

`--stat`은 `git diff`의 모든 비교 형태와 함께 쓸 수 있다. 무엇과 무엇을 비교하느냐에 따라 대상을 지정한다.

```bash
# 작업 트리 vs 스테이징
git diff --stat

# 스테이징된 변경의 요약
git diff --stat --staged

# 두 커밋 사이
git diff --stat HEAD~3 HEAD

# 브랜치 간 비교 (main 대비 현재 브랜치)
git diff --stat main...HEAD

# 특정 커밋의 변경 요약
git show --stat <커밋>

# 로그에 각 커밋의 요약 첨부
git log --stat
```

브랜치 비교에서 세 점(`main...HEAD`)은 공통 조상 이후 현재 브랜치에서만 일어난 변경을 요약한다. PR이 가져올 변경 규모를 가늠할 때 특히 유용하다.

## 요약 옵션의 종류

`--stat` 외에도 목적에 따라 고를 수 있는 요약 옵션이 있다. 사람이 읽기 좋은 것과 기계가 파싱하기 좋은 것, 그리고 파일별과 디렉터리별로 나뉜다.

![요약 옵션 네 가지](/assets/posts/git-diff-stat-variants.svg)

- **`--shortstat`**: 막대 없이 합계 한 줄만 출력한다. "총 몇 줄 바뀌었나"만 빠르게 확인할 때 쓴다.
- **`--numstat`**: 추가·삭제 줄 수와 파일 경로를 탭으로 구분해 출력한다. 막대도 막대화 없이 정확한 숫자라, 스크립트로 집계하기 좋다.
- **`--dirstat`**: 디렉터리별 변경 비율(%)을 보여준다. 변경이 어느 영역에 몰렸는지 파악할 때 유용하다.

```bash
git diff --shortstat HEAD~10
# 12 files changed, 340 insertions(+), 88 deletions(-)

git diff --numstat HEAD~10
# 320  80  src/big-module.js
# 20   8   README.md

git diff --dirstat HEAD~10
#   78.4% src/
#   21.6% docs/
```

`--numstat`은 이진 파일을 `-` `-`로 표시하므로, 텍스트 변경만 합산하는 스크립트를 짤 때 이 점을 처리해야 한다.

## 실무 활용: 변경 핫스팟 파악

`--stat`과 `--dirstat`을 조합하면 큰 변경에서 핵심 영역을 빠르게 찾을 수 있다. 예를 들어 릴리즈 사이에 어떤 모듈이 가장 많이 손봐졌는지 보고 싶다면 이렇게 한다.

```bash
# 직전 릴리즈 태그 이후 변경을 디렉터리별로 요약
git diff --dirstat=files v1.4.0..HEAD
```

`--stat-width`로 출력 폭을 조정해 좁은 터미널에서도 막대가 잘 보이게 할 수 있고, `--stat-name-width`로 파일명 칸 너비를 맞출 수 있다. 이렇게 요약으로 큰 그림을 잡은 뒤, 관심 가는 파일만 일반 diff로 깊이 파고드는 흐름이 효율적이다.

지금까지 diff 계열 도구를 살펴봤다. 다음 글에서는 저장소의 특정 시점을 통째로 묶어 배포·백업용 파일로 내보내는 `git archive`를 다룬다.

---

**지난 글:** [git diff --word-diff: 단어 단위 차이 보기](/posts/git-diff-word-level/)

**다음 글:** [git archive: 저장소를 아카이브로 내보내기](/posts/git-archive/)

<br>
읽어주셔서 감사합니다. 😊
