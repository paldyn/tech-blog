---
title: "git add 기본: 스테이징을 정확하게 제어하기"
description: "git add의 다양한 옵션(-A, ., -u)의 차이, 내부 동작 원리, 안전하게 스테이징하는 방법을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 6
type: "knowledge"
category: "Git"
tags: ["Git", "git add", "스테이징", "인덱스", "blob"]
featured: false
draft: false
---

[지난 글](/posts/git-empty-commit/)에서 빈 커밋의 활용법을 살펴봤다. 이번에는 커밋을 만드는 두 단계 중 첫 번째, `git add`를 집중적으로 파고든다. 단순히 "파일을 스테이징에 올린다"는 것 이상의 내용이 있다.

## git add가 하는 일 (내부 동작)

`git add filename`을 실행하면 두 가지 일이 벌어진다.

1. **blob 객체 생성**: 파일 내용을 SHA-1 해시하고 `.git/objects/`에 저장한다. 내용이 같은 파일은 같은 해시를 공유한다.
2. **인덱스 갱신**: `.git/index` 파일에 파일 경로와 blob 해시를 매핑한다.

```bash
git add src/auth.js

# 이후 내부 상태 확인
git ls-files --stage src/auth.js
# 100644 e3b0c44... 0       src/auth.js
# [mode] [blob hash]        [경로]
```

커밋 전에 이미 파일 내용이 Git 데이터베이스에 들어간다는 점이 중요하다. 커밋은 그 인덱스 상태를 트리 객체로 만드는 작업이다.

![git add 내부 동작](/assets/posts/git-add-basics-flow.svg)

## 주요 옵션 비교

```bash
git add file.txt          # 특정 파일
git add src/              # 디렉터리 전체 (재귀)
git add *.js              # 글로브 패턴
git add -A                # 전체 변경 (수정+삭제+신규)
git add .                 # 현재 디렉터리 기준 전체
git add -u                # 추적 중인 파일의 수정/삭제만
```

![git add 옵션 비교](/assets/posts/git-add-basics-commands.svg)

### -A와 . 의 차이 (Git 2.x)

Git 2.0 이전에는 `git add .`이 현재 디렉터리 하위의 변경만 처리했다. 루트 디렉터리에서 실행하지 않으면 상위 경로의 삭제가 반영되지 않는 경우가 있었다.

Git 2.0 이후 `.`과 `-A`는 동작이 거의 동일해졌다. 다만 명확성을 위해 `-A`를 사용하는 것이 권장된다.

### -u 옵션의 용도

```bash
# 새 파일을 제외하고 기존 파일의 변경만 스테이징
git add -u
```

`.gitignore`에 추가해야 할 새 파일이 생겼는데, 일단 그 파일을 제외하고 기존 수정만 커밋하고 싶을 때 유용하다.

## 파일을 명시적으로 지정하는 이유

`git add -A`는 편리하지만 위험할 수 있다. `.env`, 빌드 산출물, 인증 키 파일이 `.gitignore`에서 빠져 있다면 한 번의 명령으로 커밋에 포함된다.

안전한 습관:

```bash
# 나쁜 습관 (주의 없이 전체 스테이징)
git add -A
git commit -m "update"

# 좋은 습관 (확인 후 스테이징)
git status
git add src/auth.js src/app.js
git diff --staged   # 스테이징된 내용 확인
git commit -m "feat(auth): add JWT validation"
```

## 스테이징 취소

실수로 스테이징한 파일은 `git restore --staged`로 되돌린다.

```bash
git add .env.local   # 실수로 스테이징
git restore --staged .env.local   # 언스테이징 (파일 내용은 그대로)
```

구버전 Git에서는 `git reset HEAD <file>`로 같은 효과를 낸다.

## 삭제된 파일 스테이징

파일을 OS 명령(`rm`)으로 삭제하면 Git은 그것을 추적한다. 이 삭제를 스테이징하려면:

```bash
rm src/old-module.js
git status
# Changes not staged for commit:
#       deleted:    src/old-module.js

git add src/old-module.js   # 삭제도 git add로 스테이징
# 또는
git rm src/old-module.js    # rm + add를 한 번에
```

`-A`를 쓰면 삭제도 자동으로 포함된다.

## 인터랙티브 스테이징

파일 단위가 아니라 **변경 헝크(hunk) 단위**로 스테이징할 수도 있다. 이 기능은 다음 글에서 `git add -p`로 자세히 다룬다.

```bash
git add -i   # 인터랙티브 모드
git add -p   # 패치 모드 (헝크 단위 선택)
```

---

**지난 글:** [빈 커밋: 히스토리에 메모를 남기는 기술](/posts/git-empty-commit/)

**다음 글:** [git add -p: 변경을 헝크 단위로 골라 스테이징하기](/posts/git-add-patch/)

<br>
읽어주셔서 감사합니다. 😊
