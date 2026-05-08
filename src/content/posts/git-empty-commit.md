---
title: "빈 커밋: 히스토리에 메모를 남기는 기술"
description: "git commit --allow-empty의 동작 원리, CI 재실행·배포 트리거·히스토리 마커 등 실무 활용법과 주의점을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "빈 커밋", "git commit", "--allow-empty", "CI"]
featured: false
draft: false
---

[지난 글](/posts/git-status-overview/)에서 `git status`로 저장소 상태를 읽는 법을 살펴봤다. 이번에는 특이한 상황, 즉 파일을 전혀 바꾸지 않고 커밋을 만드는 경우를 다룬다. 처음에는 의아하게 느껴지지만, 실무에서 의외로 유용한 기법이다.

## 빈 커밋이란

기본적으로 `git commit`은 스테이징된 변경이 없으면 아무것도 하지 않는다.

```bash
# 아무것도 수정하지 않은 상태
git commit -m "test"
# On branch main
# nothing to commit, working tree clean
```

여기에 `--allow-empty` 플래그를 추가하면 변경 없이도 커밋이 생성된다.

```bash
git commit --allow-empty -m "ci: retry pipeline"
# [main f3a9c12] ci: retry pipeline
```

## 내부에서 무슨 일이 벌어지는가

빈 커밋도 완전한 커밋 객체다. 다만 `tree` 해시가 부모 커밋의 `tree` 해시와 동일하다.

```bash
git cat-file -p HEAD
# tree b2c4e8f9...  ← 부모와 동일한 트리 해시
# parent a3f9d21...
# author ...
# committer ...
#
# ci: retry pipeline

git show HEAD
# commit f3a9c12...
# ...
# (diff 없음)
```

파일 스냅샷이 바뀌지 않았으니 새 blob나 tree 객체가 생기지 않는다. 커밋 객체만 하나 추가되는 매우 가벼운 작업이다.

![빈 커밋 vs 일반 커밋 내부](/assets/posts/git-empty-commit-internals.svg)

## 실무 활용 사례

### CI/CD 파이프라인 재실행

GitHub Actions, GitLab CI 등의 파이프라인은 보통 push 이벤트로 트리거된다. 플레이크(flaky) 테스트나 네트워크 오류로 CI가 실패했을 때, 코드를 건드리지 않고 재실행하려면 빈 커밋을 push하면 된다.

```bash
git commit --allow-empty -m "ci: retry after network failure"
git push origin main
```

### 배포 훅 트리거

브랜치 push를 감지해 자동 배포하는 시스템(Heroku, Render 등)에서 코드 변경 없이 재배포를 실행할 때 사용한다.

```bash
git commit --allow-empty -m "deploy: force redeploy to staging"
git push heroku main
```

### 히스토리 마커

스프린트 시작, 릴리스 준비, 마이그레이션 완료 등의 이정표를 커밋 히스토리에 남길 때 유용하다.

```bash
git commit --allow-empty -m "chore: sprint 42 start"
git commit --allow-empty -m "chore: v2.0 feature freeze"
```

`git log --oneline`으로 보면 이 마커들이 타임라인상의 이정표 역할을 한다.

### 저장소 초기화 관례

파일을 추가하기 전에 빈 루트 커밋을 먼저 만들면 브랜치를 초기화하는 데 편리하다.

```bash
git init
git commit --allow-empty -m "chore: initialize repository"
git checkout -b develop  # 이제 브랜치 분기 가능
```

![빈 커밋 사용 사례](/assets/posts/git-empty-commit-usecases.svg)

## `--allow-empty-message`는 다른 옵션이다

혼동하기 쉬운 옵션이 있다.

```bash
# 메시지가 비어 있어도 허용 (변경은 있어야 함)
git commit --allow-empty-message -m ""

# 파일 변경도, 메시지도 없어도 허용
git commit --allow-empty --allow-empty-message -m ""
```

두 옵션은 독립적으로 동작한다. 메시지 없는 커밋은 실제로는 권장되지 않으나 자동화 스크립트에서 간혹 사용된다.

## 주의사항

빈 커밋을 남용하면 `git log`가 노이즈로 가득 찬다. 실제 코드 변경과 관리용 커밋이 뒤섞이면 히스토리 가독성이 떨어진다. 팀 차원에서 허용 시나리오를 컨벤션으로 명확히 정해두는 것이 좋다.

또한 `git rebase`로 히스토리를 정리할 때 빈 커밋은 삭제 대상이 되기 쉽다. `git rebase -i`에서 `drop`으로 처리되는 경우가 많으니, 영구적으로 남겨야 하는 마커라면 주석을 충분히 달아두도록 한다.

---

**지난 글:** [git status 읽기: 저장소 상태를 한눈에 파악하기](/posts/git-status-overview/)

**다음 글:** [git add 기본: 스테이징을 정확하게 제어하기](/posts/git-add-basics/)

<br>
읽어주셔서 감사합니다. 😊
