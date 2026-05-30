---
title: "git log --grep: 커밋 메시지로 검색하기"
description: "git log --grep으로 커밋 메시지를 검색하는 법. --author·--since 같은 필터와의 결합, --all-match로 AND 조건 만들기, 정규식·대소문자 무시·-i 옵션과 피카악스(-S)와의 차이까지 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-31"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["Git", "log", "grep", "히스토리", "검색", "필터"]
featured: false
draft: false
---

[지난 글](/posts/git-log-pickaxe/)에서 피카악스(`-S`/`-G`)로 코드 내용이 바뀐 커밋을 추적했다. 피카악스가 "무엇이 바뀌었나"를 diff에서 찾는다면, **`git log --grep`**은 "왜 바꿨나"를 **커밋 메시지**에서 찾는다. "지난달 인증 관련 수정이 어디 있었지?", "이슈 #123을 닫은 커밋이 뭐였지?" 같은 질문에 답할 때 쓰는 도구다.

커밋 메시지는 개발자가 변경의 의도를 남긴 기록이다. 메시지를 일관된 규칙으로 작성해두면(예: `fix:`, `feat:`, 이슈 번호 표기) `--grep`으로 원하는 변경을 빠르게 골라낼 수 있다. 검색 대상이 코드가 아니라 메타데이터라는 점이 피카악스와의 결정적 차이다.

![--grep은 커밋 메시지를 검색한다](/assets/posts/git-log-grep-targets.svg)

## 기본 사용법

`--grep` 뒤에 검색어를 주면 메시지(제목과 본문 전체)에 그 패턴이 포함된 커밋만 보여준다. 패턴은 기본적으로 정규식(basic regex)으로 해석된다.

```bash
# 메시지에 "fix" 가 들어간 커밋
git log --grep "fix"

# 대소문자 무시
git log --grep "login" -i

# 정규식: 이슈 번호 참조 커밋
git log --grep "#[0-9]\+"

# 결과를 한 줄로 요약
git log --grep "refactor" --oneline
```

확장 정규식이 필요하면 `-E`(또는 `--extended-regexp`)를, 고정 문자열로 그대로 찾으려면 `-F`(`--fixed-strings`)를 붙인다.

```bash
git log --grep "feat|fix" -E --oneline
```

## 다른 필터와 결합하기

`--grep`은 작성자·날짜 필터와 자유롭게 조합된다. 이들은 메시지가 아니라 커밋의 다른 메타데이터를 본다.

```bash
# 특정 작성자가, 최근 2주 동안, "fix" 를 언급한 커밋
git log --grep "fix" --author "kim" --since "2 weeks ago"

# 날짜 구간 지정
git log --grep "release" --since "2026-01-01" --until "2026-03-31"
```

`--author`와 `--committer`는 검색 대상이 다르다. rebase나 cherry-pick으로 옮겨진 커밋은 작성자(author)와 적용자(committer)가 달라질 수 있으니, "누가 처음 썼나"는 `--author`, "누가 마지막으로 적용했나"는 `--committer`로 구분해 찾는다.

## 여러 --grep의 논리: OR과 AND

`--grep`을 여러 번 주면 기본적으로 **OR**로 결합된다. 하나라도 매칭되면 결과에 포함된다. 모든 조건을 동시에 만족하는 커밋만 찾으려면 `--all-match`를 붙여 **AND**로 바꾼다.

![여러 --grep을 결합하는 논리](/assets/posts/git-log-grep-combine.svg)

```bash
# OR: "bug" 또는 "fix" 중 하나라도 포함
git log --grep "bug" --grep "fix"

# AND: "auth" 와 "fix" 를 모두 포함
git log --all-match --grep "auth" --grep "fix"
```

주의할 점은 `--author`와 `--grep`이 함께 있을 때다. `--all-match`는 **여러 --grep 사이**에만 AND를 적용하며, `--author`는 별개의 조건으로 항상 함께 만족되어야 한다. 즉 "kim이 쓴 커밋 중 메시지에 auth 또는 fix가 있는 것"을 찾으려면 `--all-match` 없이 두 `--grep`을 주면 된다.

## --grep을 거꾸로: --invert-grep

특정 패턴을 **제외**하고 싶을 때는 `--invert-grep`을 쓴다. 예를 들어 자동 생성된 머지 커밋이나 봇 커밋을 걸러낼 때 유용하다.

```bash
# 메시지에 "Merge" 가 없는 커밋만
git log --invert-grep --grep "^Merge"
```

## 피카악스와 함께 쓰기

메시지 검색(`--grep`)과 내용 검색(`-S`/`-G`)은 목적이 다르므로 상황에 맞게 고른다. "왜 바꿨는지"의 단서가 메시지에 있으면 `--grep`, 메시지가 부실하거나 "코드가 실제로 어디서 바뀌었는지"가 궁금하면 피카악스가 정확하다. 둘을 한 명령에 섞을 수도 있다.

```bash
# 메시지에 cache 가 있으면서, diff에 ENABLE_CACHE 가 드나든 커밋
git log --grep "cache" -S "ENABLE_CACHE" --oneline
```

이렇게 메시지와 내용을 동시에 좁히면 방대한 히스토리에서도 원하는 커밋을 정확히 집어낼 수 있다. 다음 글에서는 검색으로 찾은 변경의 **세부 차이**를 더 읽기 좋게 보는 방법으로, 단어 단위로 diff를 표시하는 `git diff --word-diff`를 다룬다.

---

**지난 글:** [git log -S/-G: 피카악스로 코드 변경 추적](/posts/git-log-pickaxe/)

**다음 글:** [git diff --word-diff: 단어 단위 차이 보기](/posts/git-diff-word-level/)

<br>
읽어주셔서 감사합니다. 😊
