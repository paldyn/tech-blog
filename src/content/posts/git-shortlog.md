---
title: "git shortlog: 기여자별 커밋 통계 요약하기"
description: "git shortlog로 저자별 커밋을 그룹화하고, 릴리스 노트·CONTRIBUTORS 파일 생성 등 실전 활용 패턴을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 3
type: "knowledge"
category: "Git"
tags: ["Git", "git shortlog", "기여자", "릴리스 노트", "통계"]
featured: false
draft: false
---

[지난 글](/posts/git-grep/)에서 코드베이스 전체를 패턴으로 검색하는 `git grep`을 다뤘다. 이번에는 누가 얼마나 기여했는지 한눈에 파악하는 `git shortlog`를 살펴본다. `git log`를 저자별로 그룹화·요약해주는 명령으로, CONTRIBUTORS 파일 생성이나 릴리스 노트 작성에 즉시 활용할 수 있다.

## 기본 사용법

```bash
# 저자별 커밋 목록 (알파벳 정렬)
git shortlog

# 숫자(커밋 수) + 내림차순 정렬
git shortlog -sn

# 이메일 포함
git shortlog -sne
```

기본 출력은 저자 이름 아래에 커밋 제목을 들여쓰기로 나열한다. `-s`는 커밋 제목 없이 숫자만, `-n`은 많은 순으로 정렬한다.

![git shortlog 기본 출력](/assets/posts/git-shortlog-output.svg)

## 범위 지정으로 기간·릴리스 단위 집계

```bash
# v1.0.0 이후 v1.1.0까지 기여자
git shortlog v1.0.0..v1.1.0 -sn

# 최근 30일
git shortlog --since="30 days ago" -sn

# 머지 커밋 제외
git shortlog --no-merges -sn
```

릴리스 주기마다 기여자를 집계하면 변경 이력을 체계적으로 관리할 수 있다.

![git shortlog 활용 패턴](/assets/posts/git-shortlog-options.svg)

## CONTRIBUTORS 파일 생성

오픈소스 프로젝트에서 흔히 보는 CONTRIBUTORS 파일을 자동으로 생성한다.

```bash
# 전체 기여자, 머지 커밋 제외, 많은 순
git shortlog -sn --no-merges > CONTRIBUTORS

# 릴리스 v1.1.0 기여자만
git shortlog -sn --no-merges v1.0.0..v1.1.0 >> CONTRIBUTORS
```

## git log와 파이프 연계

`git shortlog`는 stdin에서 로그를 읽을 수 있어 `git log`와 조합이 자유롭다.

```bash
# 특정 디렉터리 변경에 한정
git log --no-merges -- src/ | git shortlog -sn

# 특정 파일 변경 기여자
git log --no-merges -- package.json | git shortlog -sn
```

## 릴리스 노트 초안 생성

```bash
# 이전 태그 이후 변경 사항
git shortlog v1.0.0..HEAD --no-merges
```

출력 결과를 그대로 CHANGELOG에 붙여넣는 팀도 많다. `conventional-commits`를 도입했다면 `feat:`·`fix:` 접두사로 필터링해 더 정교한 노트를 만들 수 있다.

```bash
# feat 커밋만 추출 후 집계
git log --no-merges --grep="^feat" v1.0.0..HEAD \
  | git shortlog -sn
```

## git log vs git shortlog

| 명령 | 용도 |
|------|------|
| `git log` | 시간 순 커밋 목록, 상세 메시지 |
| `git shortlog` | 저자별 그룹화, 기여 통계 |

커밋 히스토리를 탐색할 때는 `git log`, 팀 기여 현황을 보고할 때는 `git shortlog`를 선택한다.

---

**지난 글:** [git grep: 워킹 트리와 히스토리에서 패턴 검색하기](/posts/git-grep/)

**다음 글:** [브랜치의 본질: Git 브랜치가 가볍고 빠른 이유](/posts/git-branch-essence/)

<br>
읽어주셔서 감사합니다. 😊
