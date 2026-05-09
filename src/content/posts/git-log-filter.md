---
title: "git log 필터: 저자·날짜·키워드로 커밋 검색하기"
description: "git log의 --author, --since, --grep, -S 등 필터 옵션을 조합해 원하는 커밋을 정확하게 찾는 방법을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "git log", "필터", "grep", "pickaxe", "author", "since"]
featured: false
draft: false
---

[지난 글](/posts/git-log-graph/)에서 `--graph`로 브랜치 구조를 시각화하는 법을 살펴봤다. 이번에는 히스토리에서 특정 커밋을 빠르게 찾는 필터 옵션들을 정리한다. 프로젝트 규모가 커질수록 이 도구들의 가치가 크다.

## 저자·커미터 필터

```bash
# 저자 이름으로 필터 (부분 문자열, 정규식 지원)
git log --author="Alice" --oneline

# 이메일로 필터
git log --author="alice@example.com" --oneline

# 복수 저자 (OR 조건)
git log --author="Alice\|Bob" --oneline
```

`--author`는 저자(Author) 필드를 검색하고, `--committer`는 커미터(Committer) 필드를 검색한다. rebase나 cherry-pick을 하면 이 둘이 달라지므로 주의가 필요하다.

## 날짜 필터

```bash
# 특정 기간 내 커밋
git log --since="2026-05-01" --until="2026-05-10" --oneline

# 자연어 날짜도 가능
git log --since="1 week ago" --oneline
git log --since="yesterday" --oneline
git log --after="2026-04-01" --before="2026-05-01" --oneline
```

`--since`/`--after`와 `--until`/`--before`는 각각 같은 의미의 별칭이다.

![git log 필터 옵션](/assets/posts/git-log-filter-options.svg)

## 커밋 메시지 키워드 검색

```bash
# 제목·본문에서 "fix" 포함 커밋
git log --grep="fix" --oneline

# 대소문자 무시
git log --grep="fix" -i --oneline

# 복수 grep (OR 기본, --all-match로 AND)
git log --grep="auth" --grep="login" --all-match --oneline
```

`--grep`은 기본적으로 여러 값을 OR로 처리한다. AND로 좁히려면 `--all-match`를 추가한다.

## 코드 내용 변경 추적: pickaxe (-S, -G)

![실전 필터 예시](/assets/posts/git-log-filter-examples.svg)

`-S`는 특정 문자열이 추가되거나 삭제된 커밋을 찾는다. 함수나 변수가 언제 생겼고 언제 사라졌는지 추적할 때 유용하다.

```bash
# "validatePassword" 함수가 변경된 커밋
git log -S "validatePassword" --oneline

# diff도 함께 보기
git log -S "validatePassword" --oneline -p

# 정규식으로 검색
git log -G "validate.*Password" --oneline
```

`-S`는 해당 문자열이 추가/삭제된 경우만, `-G`는 패치(diff)에 해당 정규식이 등장하는 경우를 찾는다. 단순 이동이나 rename이 있는 경우 `-G`가 더 넓게 잡힌다.

## 파일 경로 필터

```bash
# 특정 파일을 수정한 커밋만
git log -- src/auth.js --oneline

# 디렉터리
git log -- src/auth/ --oneline

# 이름 변경 이전도 추적
git log --follow -- src/auth.js --oneline
```

## 필터 조합

```bash
# Alice가 이번 달 auth 관련 작성한 non-merge 커밋
git log \
  --author="Alice" \
  --since="2026-05-01" \
  --grep="auth" \
  --no-merges \
  --oneline
```

## 정리: 언제 어떤 필터를

| 목표 | 옵션 |
|------|------|
| 특정 사람의 커밋 | `--author` |
| 기간 범위 | `--since` + `--until` |
| 커밋 메시지 검색 | `--grep` |
| 코드 변경 추적 | `-S` 또는 `-G` |
| 특정 파일 히스토리 | `-- <path>` |
| 머지 커밋 제거 | `--no-merges` |

---

**지난 글:** [git log --graph: 브랜치 분기를 ASCII 그래프로 시각화하기](/posts/git-log-graph/)

**다음 글:** [git show: 커밋 상세 내용과 오브젝트 조회하기](/posts/git-show/)

<br>
읽어주셔서 감사합니다. 😊
