---
title: "git diff: 워킹트리·인덱스·커밋 간 변경 내용 비교하기"
description: "git diff의 기본 사용법과 출력 형식을 이해하고, 워킹트리·인덱스·커밋 세 영역 사이를 어떻게 비교하는지 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 3
type: "knowledge"
category: "Git"
tags: ["Git", "git diff", "변경 비교", "unified diff", "스테이징"]
featured: false
draft: false
---

[지난 글](/posts/git-clean/)에서 untracked 파일을 정리하는 법을 다뤘다. 이번에는 Git에서 변경 내용을 확인하는 핵심 명령 `git diff`를 살펴본다. 어느 영역 간의 차이를 보여주는지 이해하면 다양한 옵션이 자연스럽게 읽힌다.

## 세 가지 영역, 세 가지 비교

Git에는 변경이 흐르는 세 개의 공간이 있다: 워킹트리 → 인덱스(스테이징) → 커밋. `git diff`는 이 공간들 사이의 차이를 보여준다.

![git diff 비교 영역](/assets/posts/git-diff-overview-areas.svg)

```bash
# 워킹트리 vs 인덱스 (아직 git add 안 한 변경)
git diff

# 인덱스 vs HEAD (git add했지만 아직 커밋 안 한 변경)
git diff --staged
git diff --cached   # --staged와 동일

# 워킹트리 vs HEAD (add/commit 여부 상관없이 이번 작업 전체)
git diff HEAD
```

커밋을 만들기 전에 `git diff --staged`로 인덱스를 한 번 검토하는 습관을 들이면 실수를 크게 줄일 수 있다.

## diff 출력 읽기

`git diff` 출력은 unified diff 형식을 따른다.

![git diff 출력 읽기](/assets/posts/git-diff-overview-output.svg)

- `---`/`+++`: 변경 전/후 파일
- `@@` 헝크(hunk) 헤더: `-10,7 +10,8`는 이전 파일의 10번째 줄부터 7줄, 새 파일의 10번째 줄부터 8줄을 의미한다
- `-` 접두사 줄: 삭제된 줄 (빨간색)
- `+` 접두사 줄: 추가된 줄 (초록색)
- 공백 접두사 줄: 문맥(변경 없음)

## 두 커밋·브랜치 비교

```bash
# 두 커밋 비교
git diff abc1234 def5678

# 브랜치 비교
git diff main feature/login

# 특정 파일만
git diff main feature/login -- src/auth.js
```

## 유용한 옵션

```bash
# 파일별 변경 통계 (라인 수)
git diff --stat

# 변경된 파일 목록만
git diff --name-only
git diff --name-status   # 상태(M/A/D)도 표시

# 단어 단위 diff (문장 내 변경이 많을 때 유용)
git diff --word-diff

# 공백 변경 무시
git diff -w
git diff --ignore-space-at-eol
```

`--stat`은 PR 리뷰 전 전체적인 변경 규모를 파악하는 데, `--word-diff`는 문서나 긴 문자열을 수정할 때 유용하다.

## 외부 diff 도구 연동

`git difftool`을 쓰면 VS Code, vimdiff 같은 외부 도구로 결과를 볼 수 있다.

```bash
# VS Code로 diff 보기
git difftool --tool=vscode

# 기본 도구 설정
git config --global diff.tool vscode
git config --global difftool.vscode.cmd 'code --wait --diff $LOCAL $REMOTE'
```

## 정리

| 명령 | 비교 대상 | 주요 용도 |
|------|----------|-----------|
| `git diff` | 워킹트리 vs 인덱스 | 스테이징 전 확인 |
| `git diff --staged` | 인덱스 vs HEAD | 커밋 전 검토 |
| `git diff HEAD` | 워킹트리 vs HEAD | 작업 전체 확인 |
| `git diff A B` | 커밋·브랜치 A vs B | 히스토리 비교 |

다음 글에서는 `git diff --staged`를 더 깊이 살펴보고, 실제 커밋 워크플로에서 어떻게 활용하는지 다룬다.

---

**지난 글:** [git clean: 추적되지 않는 파일을 한 번에 정리하기](/posts/git-clean/)

**다음 글:** [git diff --staged: 커밋 전 인덱스 변경 내용 검토하기](/posts/git-diff-staged/)

<br>
읽어주셔서 감사합니다. 😊
