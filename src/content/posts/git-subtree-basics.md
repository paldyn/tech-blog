---
title: "Git 서브트리 기초: 외부 저장소를 디렉터리로 병합"
description: "git subtree add/pull/push로 외부 저장소를 메인 저장소에 통합하는 방법, --squash 옵션의 의미, 서브모듈과의 실용적 차이를 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "subtree", "서브트리", "의존성 관리"]
featured: false
draft: false
---

[지난 글](/posts/git-submodule-vs-subtree/)에서 서브모듈과 서브트리의 차이를 비교했다. 이번에는 git subtree의 실제 사용법을 단계별로 살펴본다.

## git subtree란

`git subtree`는 외부 저장소의 내용을 메인 저장소의 특정 디렉터리에 **직접 병합**하는 방법이다. 서브모듈처럼 포인터를 사용하지 않고, 외부 저장소의 파일들이 메인 저장소의 히스토리에 그대로 통합된다.

핵심 특징:
- `.gitmodules` 파일이 없다
- 팀원이 `git clone` 한 번으로 모든 파일을 받는다
- 서브트리 디렉터리의 파일은 일반 파일로 관리된다

![git subtree: 외부 저장소를 디렉터리로 병합](/assets/posts/git-subtree-basics-concept.svg)

## 원격 별칭 등록 (선택 사항이지만 권장)

매번 긴 URL을 입력하는 불편함을 줄이기 위해 원격 별칭을 등록해두면 좋다.

```bash
# 서브트리로 사용할 저장소의 원격 별칭 추가
git remote add util-remote https://github.com/org/util.git
git fetch util-remote
```

## 서브트리 추가: git subtree add

```bash
# 기본 형태
git subtree add --prefix=<로컬경로> <원격URL 또는 별칭> <브랜치> [옵션]

# 예시: libs/util 디렉터리에 외부 저장소 main 브랜치 통합
git subtree add --prefix=libs/util \
    https://github.com/org/util.git main --squash
```

`--prefix`는 외부 저장소 파일을 놓을 로컬 디렉터리 경로다. `--squash`는 외부 저장소의 전체 히스토리를 하나의 커밋으로 압축해 메인 저장소 히스토리를 깔끔하게 유지한다.

명령 실행 후 자동으로 커밋이 생성된다. `git log --oneline`을 보면 외부 저장소의 커밋들이 병합된 것을 확인할 수 있다.

## 업스트림 변경 가져오기: git subtree pull

외부 저장소에 새 커밋이 생겼을 때 메인 저장소에 반영한다.

```bash
# 업스트림 변경 가져오기
git subtree pull --prefix=libs/util util-remote main --squash
```

`--squash`를 처음 `add`에서 사용했다면 `pull`에서도 반드시 `--squash`를 사용해야 한다. 일관성을 지키지 않으면 충돌이 발생한다.

![git subtree 핵심 명령어](/assets/posts/git-subtree-basics-commands.svg)

## 업스트림에 기여하기: git subtree push

메인 저장소에서 서브트리 디렉터리를 수정한 뒤 외부 저장소에 기여하려면 `git subtree push`를 사용한다.

```bash
# 서브트리 변경사항을 외부 저장소로 push
git subtree push --prefix=libs/util util-remote main
```

이 명령은 메인 저장소 히스토리에서 `libs/util` 경로에 영향을 주는 커밋만 필터링해 외부 저장소로 푸시한다. 대규모 저장소에서는 필터링 시간이 오래 걸릴 수 있다.

## --squash 옵션 상세

`--squash` 없이 사용하면 외부 저장소의 모든 커밋 히스토리가 메인 저장소 히스토리에 그대로 들어온다. 외부 저장소가 수천 개의 커밋을 가진 오래된 프로젝트라면 메인 저장소 `git log`가 매우 지저분해진다.

```bash
# --squash 없을 때: 외부 저장소 히스토리 전체 포함
git subtree add --prefix=libs/util util-remote main

# --squash 있을 때: 하나의 커밋으로 압축
git subtree add --prefix=libs/util util-remote main --squash
```

**--squash 사용 시 주의**: `add`와 `pull`에서 `--squash` 사용 여부를 반드시 통일해야 한다. 섞어 쓰면 Git이 공통 조상을 찾지 못해 충돌이 발생한다.

## 실무 활용 패턴

서브트리는 Makefile이나 npm 스크립트와 함께 쓰면 편하다.

```bash
# Makefile 예시
update-util:
    git subtree pull --prefix=libs/util util-remote main --squash

push-util:
    git subtree push --prefix=libs/util util-remote main
```

서브트리의 가장 큰 장점은 팀원이 추가 명령 없이 `git clone`만으로 작업할 수 있다는 것이다. 온보딩 비용이 낮아 소규모 팀이나 서브모듈 경험이 없는 팀에 적합하다.

---

**지난 글:** [서브모듈 vs 서브트리](/posts/git-submodule-vs-subtree/)

**다음 글:** [Git Worktree 기초](/posts/git-worktree-basics/)

<br>
읽어주셔서 감사합니다. 😊
