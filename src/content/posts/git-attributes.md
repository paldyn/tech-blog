---
title: ".gitattributes 완전 정복"
description: ".gitattributes 파일로 줄 끝 정규화, LFS 연동, diff 드라이버, merge 전략까지 파일별로 Git 동작을 세밀하게 제어하는 방법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "gitattributes", "EOL", "LFS", "diff", "merge", "텍스트-정규화"]
featured: false
draft: false
---

[지난 글](/posts/git-lfs-migrate/)에서 LFS 마이그레이션을 다루면서 `.gitattributes`가 자연스럽게 등장했다. 이번에는 `.gitattributes` 파일 자체를 깊이 파고들어 LFS 연동뿐만 아니라 EOL 정규화·diff·merge까지 파일별 Git 동작을 제어하는 방법을 살펴본다.

## .gitattributes란

`.gitattributes`는 저장소 내 파일 패턴과 Git 속성을 연결하는 설정 파일이다. `.gitignore`처럼 저장소 루트에 두고 커밋하면 팀 전체에 적용된다. 속성 우선순위는 파일 위치가 깊을수록 높으며, 각 사용자의 `~/.config/git/attributes`(전역 설정)보다 저장소 내 파일이 우선한다.

```
# 기본 구조
<패턴>  <속성1>  <속성2>  ...
```

![.gitattributes 문법 구조](/assets/posts/git-attributes-syntax.svg)

## 텍스트와 바이너리 구분

가장 기본적인 설정이다. Git은 텍스트 파일에 줄 끝 변환을 적용하고, 바이너리는 그대로 보존한다.

```
# 모든 파일에 자동 감지 적용 (권장 기본값)
*   text=auto

# 특정 파일은 항상 텍스트로 처리
*.c   text
*.py  text

# 바이너리 처리 (text -diff의 단축)
*.png  binary
*.zip  binary
```

`binary`는 `-text -diff`의 단축형이다. 줄 끝 변환도 없고 diff에서도 바이너리로 표시된다.

## EOL 제어

크로스 플랫폼 팀에서 가장 자주 쓰는 속성이다.

```
# 스크립트는 항상 LF (Windows에서도)
*.sh    text eol=lf
*.bash  text eol=lf
Makefile text eol=lf

# Windows 전용 파일은 CRLF
*.bat  text eol=crlf
*.cmd  text eol=crlf

# 웹 파일은 LF
*.html text eol=lf
*.css  text eol=lf
*.js   text eol=lf
```

`eol=lf`는 체크아웃할 때 줄 끝을 LF로 강제한다. Windows에서 작업해도 저장소에는 LF로 저장된다.

![.gitattributes 실전 활용](/assets/posts/git-attributes-usecases.svg)

## diff 드라이버

언어별로 최적화된 diff를 사용할 수 있다.

```
# Python: 함수 이름을 hunk 헤더에 표시
*.py  diff=python

# Java
*.java  diff=java

# 설정 파일 예시: .git/config 또는 ~/.gitconfig에 추가
# [diff "python"]
#   xfuncname = "^[ \t]*(def|class)[ \t].+"
```

Git에는 `python`, `java`, `ruby`, `bibtex` 등 내장 드라이버가 있어 별도 설정 없이 쓸 수 있다. 커스텀 드라이버는 `git config diff.<name>.xfuncname`으로 정의한다.

## merge 전략 드라이버

충돌이 잦은 파일에 특별한 병합 전략을 지정한다.

```
# lock 파일은 항상 "우리 버전" 사용 (충돌 무시)
package-lock.json  merge=ours
yarn.lock          merge=ours

# 생성된 파일은 병합하지 말고 충돌로 표시
*.generated  merge=binary
```

`merge=ours`를 쓰려면 Git 설정에 드라이버를 등록해야 한다.

```bash
git config --global merge.ours.driver true
```

## export-ignore: 아카이브 제외

`git archive`나 GitHub 릴리스 ZIP에 포함하지 않을 파일을 지정한다.

```
# 아카이브에서 제외할 파일
.gitattributes  export-ignore
.gitignore      export-ignore
tests/          export-ignore
docs/internal/  export-ignore
```

## linguist 속성 (GitHub)

GitHub 언어 통계와 코드 하이라이팅에 영향을 준다.

```
# 생성된 파일을 언어 통계에서 제외
dist/**    linguist-generated=true
vendor/**  linguist-vendored=true

# 특정 파일을 다른 언어로 감지
*.html.erb  linguist-language=HTML
```

## 실용적인 .gitattributes 템플릿

```
# 기본 텍스트 처리
*   text=auto eol=lf

# Windows 파일
*.bat  text eol=crlf
*.cmd  text eol=crlf

# 바이너리
*.png  binary
*.jpg  binary
*.gif  binary
*.ico  binary
*.pdf  binary
*.zip  binary
*.tar.gz binary

# LFS
*.psd  filter=lfs diff=lfs merge=lfs -text
*.mp4  filter=lfs diff=lfs merge=lfs -text

# diff
*.py    diff=python
*.java  diff=java

# 아카이브 제외
.gitattributes  export-ignore
.gitignore      export-ignore
```

---

**지난 글:** [Git LFS 마이그레이션](/posts/git-lfs-migrate/)

**다음 글:** [.gitignore 패턴 문법](/posts/git-gitignore-patterns/)

<br>
읽어주셔서 감사합니다. 😊
