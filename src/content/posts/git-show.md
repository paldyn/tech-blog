---
title: "git show: 커밋 상세 내용과 오브젝트 조회하기"
description: "git show로 커밋의 메타 정보와 diff를 함께 확인하고, 특정 시점의 파일 내용을 추출하는 등 다양한 활용법을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["Git", "git show", "커밋 조회", "오브젝트", "diff"]
featured: false
draft: false
---

[지난 글](/posts/git-log-filter/)에서 필터 옵션으로 원하는 커밋을 찾는 법을 다뤘다. 이번에는 찾은 커밋의 상세 내용을 보는 `git show`를 살펴본다. `git log`가 목록 탐색 도구라면, `git show`는 개별 커밋을 깊게 들여다보는 도구다.

## 기본 사용법

```bash
# 최신 커밋 상세 보기
git show
git show HEAD

# 특정 커밋
git show 9a3f1b2

# 브랜치 최신 커밋
git show feature/login

# 태그
git show v1.0.0
```

기본 출력은 **커밋 메타 정보(저자, 날짜, 메시지) + 전체 diff**다.

![git show 출력 구조](/assets/posts/git-show-output.svg)

## 출력 제어 옵션

```bash
# diff 없이 메타만
git show --no-patch 9a3f1b2
git show -s 9a3f1b2          # -s는 --no-patch 단축

# 통계만 (파일별 변경 라인 수)
git show --stat 9a3f1b2

# 변경된 파일 이름만
git show --name-only 9a3f1b2
git show --name-status 9a3f1b2  # M/A/D 상태 포함

# 특정 파일 변경만
git show 9a3f1b2 -- src/auth.js
```

## 특정 시점의 파일 내용 추출

`커밋:경로` 형식으로 그 커밋 시점의 파일 전체 내용을 볼 수 있다.

```bash
# HEAD 3단계 전의 config.js 내용
git show HEAD~3:src/config.js

# 태그 v1.0.0 시점의 package.json
git show v1.0.0:package.json

# 다른 브랜치의 파일
git show main:src/app.js
```

파일을 지우거나 수정하기 전에 예전 버전을 확인할 때, 또는 `git restore`의 `--source`를 쓰기 전에 내용을 미리 볼 때 유용하다.

## 활용 패턴

![git show 활용 패턴](/assets/posts/git-show-tips.svg)

### 되돌리고 싶은 커밋 검토

```bash
# 되돌릴 커밋의 변경 내용 확인
git show HEAD~2 --stat
git show HEAD~2
```

`git revert` 전에 반드시 `git show`로 대상 커밋을 확인하는 습관을 들이면 실수를 줄일 수 있다.

### 머지 커밋 부모 확인

머지 커밋은 부모가 두 개라 `git show`가 결합된 diff를 보여준다.

```bash
# 머지 커밋 양쪽 부모 diff
git show --cc merge_commit_hash

# 첫 번째 부모와의 diff만
git show merge_commit_hash^1
git show merge_commit_hash^2   # 두 번째 부모
```

## git show vs git diff vs git log -p

| 명령 | 용도 |
|------|------|
| `git show` | 특정 커밋 1개 상세 조회 |
| `git diff A B` | 두 커밋 사이 변경 비교 |
| `git log -p` | 여러 커밋의 diff를 순서대로 |

커밋 목록을 훑다가 특정 커밋이 눈에 띄면 `git show <hash>`로 바로 확인하는 것이 가장 빠른 패턴이다.

```bash
# 워크플로: log로 발견 → show로 확인
git log --oneline -20
git show abc1234
```

---

**지난 글:** [git log 필터: 저자·날짜·키워드로 커밋 검색하기](/posts/git-log-filter/)

<br>
읽어주셔서 감사합니다. 😊
