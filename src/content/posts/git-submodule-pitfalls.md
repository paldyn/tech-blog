---
title: "Git 서브모듈 주의사항과 함정"
description: "서브모듈 사용 시 자주 겪는 빈 디렉터리 문제, Detached HEAD 커밋 소실, 포인터 커밋 누락, URL 미동기화, 불완전한 제거 등 5가지 함정과 해결책을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 3
type: "knowledge"
category: "Git"
tags: ["Git", "submodule", "서브모듈", "pitfalls", "주의사항"]
featured: false
draft: false
---

[지난 글](/posts/git-submodule-init-update/)에서 서브모듈 초기화와 업데이트 방법을 살펴봤다. 서브모듈은 강력한 도구지만 여러 함정이 있어 초보자뿐 아니라 숙련 개발자도 자주 실수한다. 대표적인 5가지 함정과 해결책을 모아 정리한다.

## 함정 총정리

![서브모듈 5대 함정](/assets/posts/git-submodule-pitfalls-list.svg)

## 함정 1: 빈 디렉터리

가장 흔한 첫 번째 함정이다. 서브모듈이 포함된 저장소를 일반 `git clone`으로 받으면 서브모듈 디렉터리가 빈 상태다. 많은 개발자가 "왜 파일이 없지?"라며 당황한다.

```bash
# 일반 clone 후 상태 확인
git clone https://github.com/org/main.git
ls libs/util/
# (아무것도 없음)

# 해결: 서브모듈 초기화
git submodule update --init --recursive

# 또는 처음부터
git clone --recurse-submodules https://github.com/org/main.git
```

팀 온보딩 문서에 `--recurse-submodules`를 명시하거나, `postinstall` 스크립트에 `git submodule update --init --recursive`를 등록해두면 이 함정을 예방할 수 있다.

## 함정 2: Detached HEAD 커밋 소실

서브모듈은 `git submodule update` 후 항상 Detached HEAD 상태가 된다. 이 상태에서 커밋을 만들면 브랜치에 연결되지 않아 나중에 `update`를 실행할 때 해당 커밋이 덮어씌워진다.

![Detached HEAD 함정과 해결책](/assets/posts/git-submodule-pitfalls-detached.svg)

```bash
# 현재 상태 확인
cd libs/util
git status
# HEAD detached at a3f9c82

# 반드시 브랜치로 이동 후 작업
git switch main
git add .
git commit -m "fix: patch bug"
git push
```

커밋이 소실됐다면 `git reflog`로 복구를 시도할 수 있지만, 예방이 최선이다.

## 함정 3: 포인터 커밋 누락

서브모듈에서 작업을 완료하고 푸시했지만 메인 저장소에 포인터 커밋을 남기지 않으면 팀원의 `git submodule update`가 이전 커밋을 가리켜 변경사항이 공유되지 않는다.

```bash
# 서브모듈 작업 완료 후
cd ../../  # 메인 저장소로 이동

# 포인터가 변경됐는지 확인
git status
# modified: libs/util (new commits)

# 반드시 메인 저장소에도 커밋
git add libs/util
git commit -m "chore: update libs/util to v2.1.0"
git push
```

`git status`에서 `modified: libs/util (new commits)`가 보이면 포인터 업데이트 커밋이 필요하다는 신호다.

## 함정 4: URL 변경 미동기화

저장소를 마이그레이션하거나 내부 미러로 전환할 때 `.gitmodules`의 URL만 수정하고 끝냈다면 동료의 로컬 `.git/config`는 여전히 구 URL을 바라본다.

```bash
# .gitmodules 수정 후 반드시 실행
git submodule sync --recursive

# 이후 update
git submodule update --init --recursive
```

`git submodule sync`는 `.gitmodules`의 URL을 읽어 각 서브모듈의 `.git/config`에 반영한다. 팀원에게도 이 명령을 안내해야 한다.

## 함정 5: 불완전한 서브모듈 제거

단순히 `rm -rf libs/util`로 디렉터리를 삭제하면 `.gitmodules`와 `.git/config`, `.git/modules/libs/util` 디렉터리에 잔재가 남아 이후 `git submodule add`로 같은 경로를 다시 추가할 때 오류가 발생한다.

```bash
# 올바른 제거 순서
# 1단계: 서브모듈 등록 해제
git submodule deinit -f libs/util

# 2단계: 스테이징과 .gitmodules에서 제거
git rm -f libs/util

# 3단계: 내부 캐시 삭제
rm -rf .git/modules/libs/util

# 4단계: 커밋으로 확정
git commit -m "chore: remove libs/util submodule"
```

3단계를 빠뜨리면 나중에 같은 경로로 서브모듈을 재추가할 때 "already exists in the index" 오류가 발생한다.

## 서브모듈을 피해야 할 상황

모든 도구에는 적합한 사용 맥락이 있다. 다음 상황에서는 서브모듈 대신 다른 방법을 고려하라.

- **빠른 반복 개발**: 서브모듈은 포인터를 수동으로 관리해야 해 속도가 느리다. npm/pip 같은 패키지 매니저가 적합하다.
- **팀 전체가 서브모듈 워크플로에 익숙하지 않을 때**: 교육 비용이 높다. git-subtree가 더 단순할 수 있다.
- **모노레포 구조**: Turborepo, Nx 같은 모노레포 도구가 더 나은 DX를 제공한다.

---

**지난 글:** [서브모듈 init과 update](/posts/git-submodule-init-update/)

**다음 글:** [서브모듈 vs 서브트리](/posts/git-submodule-vs-subtree/)

<br>
읽어주셔서 감사합니다. 😊
