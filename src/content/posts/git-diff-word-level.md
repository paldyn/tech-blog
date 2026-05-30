---
title: "git diff --word-diff: 단어 단위 차이 보기"
description: "git diff --word-diff로 줄 전체가 아니라 바뀐 단어만 강조해 차이를 보는 법. color·plain·porcelain 모드, --word-diff-regex로 경계 바꾸기, --color-words와 문서·번역 리뷰 활용까지 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "diff", "word-diff", "리뷰", "비교", "문서"]
featured: false
draft: false
---

[지난 글](/posts/git-log-grep/)에서 `git log --grep`으로 원하는 커밋을 찾아냈다. 그렇게 찾은 변경을 자세히 들여다볼 때, 기본 `git diff`는 줄 단위로 차이를 보여준다. 문제는 긴 문장에서 단어 하나만 고쳐도 줄 전체가 빨강(삭제)과 초록(추가)으로 통째로 표시된다는 점이다. 실제로 무엇이 바뀌었는지는 두 줄을 눈으로 대조해 찾아야 한다. 산문 문서나 긴 문자열, 번역 파일에서는 이게 꽤 답답하다. **`git diff --word-diff`**는 줄이 아니라 **단어 단위**로 차이를 짚어, 바뀐 부분만 정확히 강조한다.

![줄 단위와 단어 단위 diff 비교](/assets/posts/git-diff-word-level-compare.svg)

## 기본 사용법

`--word-diff`를 붙이면 같은 줄 안에서 삭제된 단어는 `[-...-]`로, 추가된 단어는 `{+...+}`로 표시된다. 바뀌지 않은 부분은 그대로 한 번만 나온다.

```bash
git diff --word-diff
```

출력은 대략 이런 모습이다. 한 단어만 바뀐 경우, 줄 전체를 두 번 보여주는 대신 바뀐 토큰만 인라인으로 드러낸다.

```text
결제 금액은 [-1000-]{+2000+} 원입니다.
```

## 세 가지 표시 모드

`--word-diff`는 출력 형식을 인자로 받는다. 세 가지가 있다.

![--word-diff의 표시 모드](/assets/posts/git-diff-word-level-modes.svg)

- **`plain`** (기본): `[-삭제-]`, `{+추가+}` 기호로 표시한다. 색이 없는 환경에서도 구분된다.
- **`color`**: 기호 없이 색으로만 구분한다. 터미널에서 가장 읽기 좋다.
- **`porcelain`**: 스크립트가 파싱하기 좋은 안정적 형식이다. 사람이 읽기보단 도구 입력용이다.

```bash
git diff --word-diff=color
git diff --word-diff=plain
git diff --word-diff=porcelain
```

색 모드는 워낙 자주 쓰여 별칭이 있다. `--color-words`는 `--word-diff=color`와 사실상 같다.

```bash
git diff --color-words
```

## 단어 경계 바꾸기: --word-diff-regex

기본적으로 Git은 공백을 기준으로 "단어"를 나눈다. 하지만 코드에서는 `foo.bar(baz)`처럼 공백 없이 붙은 토큰의 일부만 바뀌는 경우가 많다. 이때 `--word-diff-regex`로 무엇을 한 단어로 볼지 정규식으로 지정하면 더 잘게 비교할 수 있다.

```bash
# 알파벳·숫자 덩어리를 한 단어로 취급 (구두점 단위로도 분리)
git diff --word-diff-regex='[A-Za-z0-9_]+'

# 글자 하나하나를 단어로: 가장 잘게 비교
git diff --word-diff-regex=.
```

이 설정은 파일 종류별로 `.gitattributes`에 지정할 수도 있어, 예컨대 LaTeX나 마크다운 문서에 적합한 경계를 파일 단위로 적용할 수 있다.

## 어디에 쓰면 좋은가

`--word-diff`는 한 줄이 길고 변경은 작은 상황에서 빛난다.

- **문서·README**: 긴 문장에서 오타나 표현 수정만 콕 집어 본다.
- **번역 파일**: 메시지 문자열의 미세한 변경을 빠르게 확인한다.
- **설정·데이터 파일**: 긴 한 줄에서 값 하나만 바뀐 것을 즉시 식별한다.

반대로 코드 리뷰에서 줄이 통째로 추가·삭제되는 경우라면 기본 줄 단위 diff가 더 명확하다. 도구는 상황에 맞게 고르는 것이 원칙이다. `git show`나 `git log -p`에도 동일하게 붙일 수 있어, 특정 커밋의 변경을 단어 단위로 살펴볼 수 있다.

```bash
git show <커밋> --word-diff=color
git log -p --word-diff=color -- docs/
```

단어 단위로 세밀하게 보는 법을 익혔으니, 다음 글에서는 정반대 방향 — 변경을 한눈에 **요약**해서 보는 `git diff --stat`을 다룬다. 큰 변경을 파일별 규모로 압축해 전체 그림을 잡는 도구다.

---

**지난 글:** [git log --grep: 커밋 메시지로 검색하기](/posts/git-log-grep/)

**다음 글:** [git diff --stat: 변경 요약 한눈에 보기](/posts/git-diff-stat/)

<br>
읽어주셔서 감사합니다. 😊
