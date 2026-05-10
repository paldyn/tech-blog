---
title: "git blame: 코드 한 줄의 저자와 커밋 추적하기"
description: "git blame으로 파일 각 줄의 마지막 수정자와 커밋을 확인하고, 줄 범위 지정·공백 무시·코드 이동 추적 등 실전 옵션을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 1
type: "knowledge"
category: "Git"
tags: ["Git", "git blame", "코드 추적", "디버깅", "저자 조회"]
featured: false
draft: false
---

[지난 글](/posts/git-show/)에서 커밋의 상세 내용을 조회하는 `git show`를 다뤘다. 이번에는 코드 한 줄이 누구에 의해 언제 작성됐는지 추적하는 `git blame`을 살펴본다. 버그를 발견했을 때 담당자를 찾거나, 코드의 도입 배경을 파악할 때 가장 먼저 꺼내는 도구다.

## 기본 사용법

```bash
# 파일 전체 blame
git blame src/app.js

# 특정 커밋 시점의 상태
git blame HEAD~3 -- src/app.js

# 특정 브랜치 기준
git blame main -- src/app.js
```

각 줄 앞에 **커밋 해시 · 저자 · 날짜 · 줄 번호 · 코드 내용** 이 순서로 출력된다.

![git blame 출력 구조](/assets/posts/git-blame-output.svg)

## 줄 범위 지정 (-L)

파일 전체를 볼 필요 없을 때 `-L`으로 범위를 좁힌다.

```bash
# 10번째 줄부터 20번째 줄까지
git blame -L 10,20 src/app.js

# 10번째 줄부터 10줄
git blame -L 10,+10 src/app.js

# 정규식 매칭 줄부터 다음 함수 끝까지
git blame -L '/function login/,/^}/' src/auth.js
```

## 공백 무시와 이동 추적

```bash
# 공백·들여쓰기 변경 무시 (리포맷 커밋 건너뜀)
git blame -w src/app.js

# 같은 파일 내 코드 이동 추적
git blame -M src/app.js

# 다른 파일에서 복사·이동된 코드도 추적
git blame -C src/app.js
```

`-w`는 자동 포맷터가 전체 파일을 건드린 커밋을 무시해, 실제 로직 변경자를 정확하게 찾아준다. `-M`과 `-C`는 함수를 다른 파일로 분리했을 때도 원래 작성자를 유지한다.

## 스크립트 파싱용: --porcelain

```bash
git blame --porcelain src/app.js
```

`--porcelain`은 사람이 읽기 불편하지만 스크립트 파싱에 최적화된 구조화 출력을 제공한다. CI 파이프라인에서 특정 저자의 변경 비율을 계산하거나, 커밋별 줄 수를 집계할 때 사용한다.

![git blame 주요 옵션](/assets/posts/git-blame-options.svg)

## 이메일 표시: --show-email

```bash
# 저자 이름 대신 이메일 표시
git blame --show-email src/app.js
git blame -e src/app.js  # 단축형
```

팀원이 많거나 동명이인이 있을 때 유용하다.

## blame → log → show 연계 워크플로

```bash
# 1. blame으로 문제 줄의 커밋 해시 확인
git blame -L 42,42 src/api.js
# → e4f5a6b (Jane 2024-02-10 ...)

# 2. log로 해당 커밋 주변 맥락 확인
git log --oneline e4f5a6b~3..e4f5a6b

# 3. show로 커밋 전체 diff 확인
git show e4f5a6b
```

세 명령을 연계하면 버그의 도입 시점과 의도를 빠르게 파악할 수 있다.

## GUI 통합

VS Code의 **GitLens**, GitHub의 **Blame** 뷰, JetBrains IDE의 **Annotate** 기능은 모두 `git blame` 위에 구축된 도구다. 내부적으로 같은 데이터를 쓰므로, CLI에서 익힌 옵션은 GUI에서도 동일하게 적용된다.

---

**지난 글:** [git show: 커밋 상세 내용과 오브젝트 조회하기](/posts/git-show/)

**다음 글:** [git grep: 워킹 트리와 히스토리에서 패턴 검색하기](/posts/git-grep/)

<br>
읽어주셔서 감사합니다. 😊
