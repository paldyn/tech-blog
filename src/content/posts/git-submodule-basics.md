---
title: "Git 서브모듈 기초: 저장소 안의 저장소"
description: "git submodule add로 외부 라이브러리를 메인 저장소에 포함하는 방법, .gitmodules 파일 구조, 서브모듈이 커밋을 추적하는 원리를 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 1
type: "knowledge"
category: "Git"
tags: ["Git", "submodule", "서브모듈", "의존성 관리"]
featured: false
draft: false
---

[지난 글](/posts/git-lost-found/)에서 분리된 커밋을 되살리는 방법을 살펴봤다. 이번에는 시야를 넓혀, 하나의 저장소가 다른 저장소를 내부에 포함하는 **서브모듈(submodule)** 을 다룬다.

프로젝트가 외부 라이브러리나 공유 컴포넌트를 의존할 때, 단순히 파일을 복사해 넣으면 업스트림 변경을 반영하기 어렵다. Git 서브모듈은 이 문제를 "외부 저장소의 특정 커밋을 포인터로 기록하는" 방식으로 해결한다.

## 서브모듈이란 무엇인가

서브모듈은 메인 저장소(슈퍼프로젝트) 안에 별도의 Git 저장소를 포함시키는 메커니즘이다. 핵심은 **브랜치가 아닌 특정 커밋 SHA를 추적한다**는 점이다. 메인 저장소는 서브모듈 저장소의 파일을 직접 관리하지 않고, "이 경로에 저 저장소의 저 커밋을 사용해라"는 포인터만 저장한다.

![서브모듈 구조: 저장소 안의 저장소](/assets/posts/git-submodule-basics-structure.svg)

이 구조 덕분에 서브모듈은 독립적인 히스토리를 유지하면서 메인 프로젝트에 포함될 수 있다. 서브모듈에서 버그를 수정하면 메인 프로젝트가 명시적으로 포인터를 업데이트해야 변경이 반영된다 — 자동으로 최신 커밋을 따라가지 않는다.

## 서브모듈 추가하기

```bash
# 기본 형태
git submodule add <url> <path>

# 예시: libs/util 디렉터리에 추가
git submodule add https://github.com/org/util.git libs/util
```

명령이 성공하면 두 가지가 스테이징 영역에 올라간다.

- `.gitmodules` — 서브모듈 설정을 저장하는 텍스트 파일
- `libs/util/` — 서브모듈 저장소 자체(내부적으로 `.git` 디렉터리 보유)

![git submodule add 기본 흐름](/assets/posts/git-submodule-basics-commands.svg)

## .gitmodules 파일 구조

```ini
[submodule "libs/util"]
    path = libs/util
    url  = https://github.com/org/util.git
    branch = main          # 선택 사항
```

`path`는 로컬 경로, `url`은 원격 주소다. `branch`를 지정하면 `git submodule update --remote` 실행 시 해당 브랜치 최신 커밋으로 업데이트된다. 지정하지 않으면 원격의 `HEAD`를 따른다.

## 처음 커밋하기

서브모듈을 추가한 직후 `git status`를 보면 `.gitmodules`와 서브모듈 경로가 스테이징된 것이 보인다. 이 상태를 커밋으로 확정해야 팀원과 공유된다.

```bash
git add .gitmodules libs/util
git commit -m "feat: Add libs/util submodule"
```

커밋 후 `git log --oneline`으로 확인하면 `libs/util` 엔트리가 일반 파일이 아닌 **160000 모드**로 기록된 것을 볼 수 있다. 이것이 서브모듈 포인터다.

```bash
# 서브모듈 포인터 확인
git ls-tree HEAD libs/util
# 160000 commit a3f9c82... libs/util
```

## 서브모듈 정보 확인

```bash
# 등록된 서브모듈 목록과 현재 커밋 SHA
git submodule status

# 상세 설정 확인
git submodule foreach 'echo $name: $displaypath'

# .gitmodules 내용 직접 읽기
cat .gitmodules
```

`git submodule status` 출력에서 SHA 앞에 `-`가 붙으면 아직 초기화되지 않은 서브모듈, `+`가 붙으면 `.gitmodules`에 기록된 커밋과 현재 체크아웃된 커밋이 다른 상태다.

## 서브모듈 URL 변경

팀 내 저장소 주소가 바뀌면 `.gitmodules`를 수정하고 동기화해야 한다.

```bash
# .gitmodules 편집 후
git submodule sync --recursive
git submodule update --init --recursive
```

`git submodule sync`는 `.gitmodules`의 URL을 `.git/config`에도 반영한다. 이 단계를 빠뜨리면 로컬 `.git/config`의 구버전 URL을 계속 사용하게 된다.

## 서브모듈 제거

서브모듈을 완전히 제거하려면 여러 단계가 필요하다. 단순히 디렉터리를 삭제하는 것으로는 부족하다.

```bash
# 1. 스테이징 영역과 .gitmodules에서 제거
git submodule deinit -f libs/util
git rm -f libs/util

# 2. .git/modules 캐시 삭제
rm -rf .git/modules/libs/util

# 3. 변경 사항 커밋
git commit -m "chore: Remove libs/util submodule"
```

---

**다음 글:** [서브모듈 init과 update](/posts/git-submodule-init-update/)

<br>
읽어주셔서 감사합니다. 😊
