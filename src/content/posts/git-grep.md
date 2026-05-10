---
title: "git grep: 워킹 트리와 히스토리에서 패턴 검색하기"
description: "git grep으로 tracked 파일만 빠르게 검색하고, 히스토리·브랜치·태그까지 범위를 확장하는 방법과 고급 옵션을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 2
type: "knowledge"
category: "Git"
tags: ["Git", "git grep", "코드 검색", "패턴 검색", "히스토리"]
featured: false
draft: false
---

[지난 글](/posts/git-blame/)에서 특정 줄의 저자를 추적하는 `git blame`을 다뤘다. 이번에는 코드베이스 전체에서 패턴을 검색하는 `git grep`을 살펴본다. 일반 `grep`과 달리 Git이 관리하는 파일만 대상으로 삼아 `node_modules`나 빌드 산출물을 자동으로 걸러준다.

## git grep vs 일반 grep

```bash
# 일반 grep — node_modules까지 뒤짐
grep -r "useState" .

# git grep — tracked 파일만, .gitignore 자동 적용
git grep "useState"
```

`git grep`은 `.gitignore`를 자동으로 존중하고, Git의 병렬 처리를 활용해 대규모 저장소에서도 빠르게 동작한다.

![git grep vs grep 비교](/assets/posts/git-grep-usage.svg)

## 히스토리·브랜치·태그에서 검색

`git grep`의 가장 강력한 기능은 **워킹 트리가 아닌 특정 커밋 시점**을 검색할 수 있다는 점이다.

```bash
# 5커밋 전 상태에서 검색
git grep "useState" HEAD~5

# 특정 브랜치에서 검색
git grep "deprecated" main

# 릴리스 태그에서 검색
git grep "oldFunction" v1.2.0

# 여러 커밋에서 한 번에 검색
git grep "TODO" HEAD HEAD~1 HEAD~2
```

코드가 삭제된 후에도 어느 커밋까지 존재했는지 확인할 수 있다.

## 자주 쓰는 옵션

```bash
# 파일명만 출력 (어떤 파일에 있는지)
git grep -l "console.log"

# 매칭 줄 수 출력
git grep -c "TODO"

# 대소문자 무시
git grep -i "error"

# 확장 정규식
git grep -E "console\.(log|warn|error)"

# 앞뒤 3줄 컨텍스트
git grep -C 3 "throw new Error"
```

![git grep 고급 옵션](/assets/posts/git-grep-options.svg)

## AND 조건 검색

두 패턴을 모두 포함하는 파일을 찾을 때는 `-e`와 `--all-match`를 조합한다.

```bash
# useState와 useEffect를 둘 다 import하는 파일
git grep -l --all-match \
  -e "useState" \
  -e "useEffect"
```

OR 조건은 `-e`만 여러 번 써도 된다.

```bash
# useState 또는 useReducer가 있는 파일
git grep -l -e "useState" -e "useReducer"
```

## 특정 파일 타입만 검색

`--` 뒤에 파일 글로브를 넣는다.

```bash
# TypeScript 파일만
git grep "interface" -- "*.ts"

# 테스트 파일 제외
git grep "TODO" -- "*.js" ":!*.test.js"
```

## 실전 워크플로

```bash
# 1. 삭제된 함수가 마지막으로 있던 커밋 찾기
git log --all -S "legacyAuth" --oneline

# 2. 그 커밋 시점에서 내용 확인
git grep "legacyAuth" abc1234

# 3. blame으로 도입 배경 파악
git blame -L '/legacyAuth/,+5' abc1234 -- src/auth.js
```

`git log -S`(픽액스)와 `git grep`을 함께 쓰면 히스토리 전반에서 코드 변천을 추적할 수 있다.

---

**지난 글:** [git blame: 코드 한 줄의 저자와 커밋 추적하기](/posts/git-blame/)

**다음 글:** [git shortlog: 기여자별 커밋 통계 요약하기](/posts/git-shortlog/)

<br>
읽어주셔서 감사합니다. 😊
