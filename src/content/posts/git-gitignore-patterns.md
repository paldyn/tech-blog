---
title: ".gitignore 패턴 문법 완전 정복"
description: "와일드카드 *, **, ? 의 차이, 경로 구분, 부정 패턴 !, 우선순위 규칙까지 .gitignore 패턴을 체계적으로 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 6
type: "knowledge"
category: "Git"
tags: ["Git", "gitignore", "패턴", "wildcard", "glob", "exclude"]
featured: false
draft: false
---

[지난 글](/posts/git-attributes/)에서 `.gitattributes`로 파일별 동작을 제어하는 법을 배웠다. 이번에는 Git이 추적하지 않을 파일을 지정하는 `.gitignore`의 패턴 문법을 꼼꼼히 살펴본다.

## .gitignore 기본 동작

`.gitignore`에 등록된 패턴에 매칭되는 파일은 Git이 추적하지 않는다. 이미 추적 중인(tracked) 파일은 `.gitignore`에 추가해도 무시되지 않는다. 이미 커밋된 파일을 untrack하려면 `git rm --cached`가 필요하다.

```bash
# 이미 추적 중인 파일 untrack
git rm --cached path/to/file
echo "path/to/file" >> .gitignore
git commit -m "stop tracking file"
```

## 패턴 문법

![.gitignore 패턴 규칙](/assets/posts/git-gitignore-patterns-rules.svg)

### 기본 규칙

- **빈 줄**과 `#`으로 시작하는 줄은 무시(주석)
- 패턴은 저장소 루트 기준 상대 경로로 해석
- 디렉터리는 `/`로 끝낸다: `build/`
- 루트에서만 매칭하려면 앞에 `/`를 붙인다: `/TODO`

```
# 빌드 결과물
build/
dist/
*.class
*.pyc

# 개발 도구
.idea/
.vscode/
*.swp
.DS_Store

# 환경 설정 (절대 커밋 금지)
.env
.env.local
*.pem
*.key
```

### 와일드카드

```
# * : 슬래시 제외 임의 문자열
*.log          # 모든 .log 파일
temp*          # temp로 시작하는 파일

# ** : 경로 구분자 포함 임의 문자열
**/logs/       # 어느 위치든 logs 디렉터리
doc/**/*.txt   # doc 아래 모든 .txt (재귀)
a/**/z         # a/z, a/b/z, a/b/c/z 등

# ? : 슬래시 제외 문자 하나
log?.txt       # log1.txt, logA.txt
```

### 경로 구분

```
# 앞에 / 없음: 모든 위치에서 매칭
*.log          # src/app.log, logs/error.log 모두 무시

# 앞에 / 있음: 루트 기준
/TODO          # 루트 TODO만 (src/TODO는 무시 안 됨)

# 끝에 / 있음: 디렉터리만
build/         # build 디렉터리 전체 (build 파일은 무시 안 됨)
```

### 부정 패턴 `!`

이전에 무시된 파일을 다시 추적 대상에 포함한다.

```
# logs/ 아래 전체 무시, 단 important.log 예외
logs/
!logs/important.log

# .env 무시하되 .env.example 예외
.env*
!.env.example
```

**주의**: 상위 디렉터리가 이미 무시된 경우 하위 파일에 `!`를 써도 효과 없다.

```
# 잘못된 예: build/가 무시됐으면 하위 파일도 무시됨
build/
!build/output.txt  # 효과 없음 — build/ 자체가 무시됨

# 올바른 예: 디렉터리는 안 무시하고 내용만 선택
build/*
!build/output.txt
```

## 우선순위

![.gitignore 적용 우선순위](/assets/posts/git-gitignore-patterns-priority.svg)

같은 파일에 여러 패턴이 매칭되면 **파일 내에서 나중에 나온 패턴**이 이긴다.

```
*.log          # 모든 .log 무시
!debug.log     # 단, debug.log 예외 (아래 줄이 우선)
```

`.gitignore` 파일 자체가 여러 곳에 있을 때는 경로가 깊은 파일이 더 높은 우선순위를 갖는다.

## 디버깅: check-ignore

패턴이 의도대로 작동하는지 확인할 때 유용하다.

```bash
# 특정 파일이 왜 무시되는지 확인
git check-ignore -v path/to/file

# 결과 예시:
# .gitignore:3:*.log    path/to/app.log

# 추적 안 되는 파일 전체 나열
git status --short | grep '^?'

# .gitignore에 등록됐지만 이미 추적 중인 파일 찾기
git ls-files --ignored --exclude-standard
```

## 언어/프레임워크별 템플릿

처음부터 작성하는 것보다 [gitignore.io](https://www.toptal.com/developers/gitignore) 또는 GitHub의 공식 템플릿을 기반으로 시작하는 것이 좋다.

```bash
# GitHub CLI로 템플릿 가져오기
gh api /gitignore/templates/Node -q .source > .gitignore
gh api /gitignore/templates/Python -q .source >> .gitignore
```

---

**지난 글:** [.gitattributes 완전 정복](/posts/git-attributes/)

**다음 글:** [전역 gitignore 설정](/posts/git-gitignore-global/)

<br>
읽어주셔서 감사합니다. 😊
