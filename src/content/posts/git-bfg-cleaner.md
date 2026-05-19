---
title: "BFG Repo-Cleaner — 대용량·비밀 파일 제거"
description: "BFG Repo-Cleaner로 Git 히스토리에서 대용량 파일과 비밀 정보를 빠르게 제거하는 방법, git filter-repo와 비교, 실전 워크플로를 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 4
type: "knowledge"
category: "Git"
tags: ["Git", "BFG", "히스토리 정리", "대용량 파일", "보안"]
featured: false
draft: false
---

[지난 글](/posts/git-filter-repo/)에서 `git filter-repo`로 히스토리를 재작성하는 방법을 다뤘다. 이번에는 비슷한 목적으로 자주 쓰이는 **BFG Repo-Cleaner**를 소개한다. 단순한 파일 삭제와 비밀 텍스트 교체에 특화된 도구로, 설정 없이 바로 쓸 수 있다는 게 장점이다.

## BFG란

BFG Repo-Cleaner는 Robert Tyley가 만든 오픈소스 도구다. 단일 JAR 파일로 배포되며 Java 런타임만 있으면 실행된다. 이름은 영화 "어둠의 총" (The BFG)에서 따왔다. 주로 두 가지 작업에 쓴다.

- **대용량 파일 제거**: 실수로 커밋된 바이너리, 빌드 산출물, 동영상 파일
- **비밀 텍스트 교체**: API 키, 비밀번호, 토큰이 커밋된 경우

![BFG vs filter-repo 비교](/assets/posts/git-bfg-cleaner-concept.svg)

## 설치

```bash
# BFG JAR 다운로드 (최신 버전은 GitHub에서 확인)
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar \
  -O bfg.jar

# macOS (Homebrew)
brew install bfg

# Java 버전 확인 (8 이상 필요)
java -version
```

## bare clone으로 시작

BFG는 bare clone에서 작동한다.

```bash
# bare clone (--mirror)
git clone --mirror git@github.com:org/repo.git

# 클론된 디렉터리 확인
ls repo.git/
# HEAD  branches  config  description  hooks  info  objects  packed-refs  refs
```

`--mirror`는 모든 브랜치와 태그를 포함한 완전한 복사본이다.

## 주요 명령어

![BFG 주요 명령어](/assets/posts/git-bfg-cleaner-usage.svg)

```bash
# 50MB 초과 파일 삭제
java -jar bfg.jar --strip-blobs-bigger-than 50M repo.git

# 특정 파일 삭제 (현재 커밋 HEAD는 제외됨)
java -jar bfg.jar --delete-files secrets.env repo.git

# 와일드카드로 여러 파일 삭제
java -jar bfg.jar --delete-files '*.pem' repo.git

# 비밀 텍스트 교체
# passwords.txt 파일 내용:
# ghp_SECRETTOKEN123==>REMOVED
java -jar bfg.jar --replace-text passwords.txt repo.git
```

## 현재 커밋은 건드리지 않는다

BFG의 중요한 특성: **HEAD의 파일은 기본적으로 보호**된다. 현재 커밋에 아직 파일이 있다면 먼저 수동으로 제거하고 커밋해야 BFG가 히스토리 전체에서 지운다.

```bash
# 먼저 현재 작업 복사본에서 파일 제거
cd working-copy
git rm secrets.env
echo "secrets.env" >> .gitignore
git add .gitignore
git commit -m "chore: 비밀 파일 제거"
git push

# 그 다음 BFG 실행
cd ..
git clone --mirror git@github.com:org/repo.git
java -jar bfg.jar --delete-files secrets.env repo.git
```

## 정리 완료 후 gc 필수

BFG가 히스토리를 수정했어도 객체가 아직 로컬에 남아 있다. `git gc`로 실제로 제거한다.

```bash
cd repo.git

# reflog 만료
git reflog expire --expire=now --all

# 가비지 컬렉션
git gc --prune=now --aggressive

# force push
git push --force --all
git push --force --tags
```

## 팀에 공지하고 re-clone 요청

BFG force push 후 팀원의 로컬 저장소는 히스토리가 달라진다. 동일 브랜치를 pull하면 충돌이 난다.

```bash
# 팀원이 해야 하는 작업
git fetch --all
git reset --hard origin/main

# 또는 re-clone이 가장 안전
git clone git@github.com:org/repo.git
```

팀 전체에 "X일 Y시 force push 예정" 공지 후 작업하는 것이 좋다.

## filter-repo와의 차이

두 도구 모두 히스토리를 재작성하지만 목적이 약간 다르다. BFG는 빠르고 간단하지만 기능이 한정적이다. 경로 기반 삭제와 텍스트 교체 이상의 복잡한 작업(커밋 메시지 수정, 서브디렉터리 추출, Python 콜백 필터 등)은 `git filter-repo`가 필요하다.

---

**지난 글:** [git filter-repo — 히스토리 완전 재작성](/posts/git-filter-repo/)

**다음 글:** [git revert — 안전하게 커밋 되돌리기](/posts/git-revert/)

<br>
읽어주셔서 감사합니다. 😊
