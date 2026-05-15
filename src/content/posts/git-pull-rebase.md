---
title: "pull --rebase — 깔끔한 히스토리 유지하기"
description: "git pull --rebase 옵션으로 머지 커밋 없이 원격 변경사항을 통합하는 방법과 설정을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "pull", "rebase", "merge commit", "히스토리"]
featured: false
draft: false
---

[지난 글](/posts/git-fetch-prune/)에서 stale 추적 브랜치를 정리하는 방법을 다뤘다. 이번에는 `git pull`을 실행할 때 발생하는 **불필요한 머지 커밋 문제**와 그 해결책인 `--rebase` 옵션을 살펴본다.

## 기본 pull이 남기는 머지 커밋

팀원이 원격 `main`에 커밋을 올린 상태에서 나도 로컬 `main`에 새 커밋을 만들었다면, 두 히스토리가 분기된 상태가 된다. 이 상태에서 `git pull`을 실행하면 Git은 **머지 커밋**을 자동으로 생성한다.

```
# 기본 pull 후 히스토리
* Merge branch 'main' of github.com:user/repo  ← 원하지 않는 커밋
|\
| * 팀원 커밋
* | 나의 로컬 커밋
|/
* 공통 베이스
```

이 머지 커밋 자체는 문제가 없지만, 여러 개발자가 수시로 pull하는 활발한 프로젝트에서는 이런 머지 커밋이 수백 개씩 쌓여 `git log`가 복잡한 그래프로 가득 차게 된다.

## git pull --rebase가 해결하는 것

```bash
git pull --rebase origin main
```

내부 동작:
1. `git fetch origin`으로 원격 변경 사항을 가져온다
2. 나의 로컬 커밋들을 일시적으로 따로 저장한다
3. 원격의 최신 커밋을 기반으로 로컬 브랜치를 이동한다
4. 저장해 둔 나의 커밋들을 새 베이스 위에 **재적용**한다

결과적으로 히스토리는 일직선이 된다.

```
# pull --rebase 후 히스토리
* 나의 로컬 커밋 (재적용됨, SHA가 바뀜)
* 팀원 커밋
* 공통 베이스
```

머지 커밋이 없고, 히스토리가 마치 처음부터 순서대로 작업한 것처럼 보인다.

![pull --rebase vs pull 다이어그램](/assets/posts/git-pull-rebase-diagram.svg)

## 전역 설정으로 기본값 변경

매번 `--rebase`를 타이핑하지 않으려면 설정으로 기본 동작을 바꾼다.

```bash
# 이후 git pull은 자동으로 rebase 방식 사용
git config --global pull.rebase true
```

또는 특정 브랜치에만 적용하고 싶다면:

```bash
# 현재 브랜치에만 rebase pull 설정
git config branch.main.rebase true
```

Git 2.27부터 `pull.rebase`가 명시적으로 설정되지 않으면 경고 메시지가 출력된다. 팀 컨벤션을 정해 `.gitconfig`에 명시적으로 기록해 두는 것이 좋다.

![pull --rebase 설정 및 명령](/assets/posts/git-pull-rebase-commands.svg)

## 충돌이 발생했을 때

rebase 중 충돌이 발생하면 pull이 중단되고 충돌 해결을 요청한다.

```bash
git pull --rebase origin main
# CONFLICT (content): 파일 충돌...
# error: could not apply abc1234...

# 1. 충돌 파일 열어서 수정
# 2. 수정 완료 후 스테이징
git add 충돌_파일.py

# 3. rebase 계속 진행
git rebase --continue

# 커밋 메시지 확인 후 저장하면 완료
```

진행 도중 rebase를 취소하고 pull 이전 상태로 되돌리려면:

```bash
git rebase --abort
```

`--abort`를 실행하면 `refs/heads/<브랜치>`가 pull 시작 전 위치로 복원된다.

## --rebase vs --ff-only 비교

| 옵션 | 동작 | 적합한 상황 |
|------|------|-------------|
| `(없음)` | fetch + merge | 머지 커밋 허용 |
| `--ff-only` | fast-forward만 허용, 불가 시 오류 | 로컬 커밋이 없을 때만 pull 허용 |
| `--rebase` | fetch + rebase | 로컬 커밋 있어도 히스토리 일직선 유지 |

개인 작업 브랜치에서는 `--rebase`가 히스토리를 깔끔하게 유지해 준다. 공유 브랜치에서 이미 push된 커밋을 rebase하면 SHA가 바뀌어 팀원에게 혼란을 줄 수 있으므로, **공유 브랜치에서 pull --rebase를 사용할 때는 push된 커밋이 없는 상황**이어야 한다.

## preserve merges와 merges 옵션

기존 머지 커밋을 보존하면서 rebase하고 싶을 때:

```bash
# 머지 구조 보존 (Git 2.18+)
git pull --rebase=merges origin main
```

일반 `--rebase`는 머지 커밋을 편평하게 만들지만, `--rebase=merges`는 서브 브랜치의 머지 구조를 유지한다.

## 정리

`git pull --rebase`는 원격 변경 사항을 가져오면서 나의 커밋을 그 위에 재적용하여 **히스토리를 일직선**으로 유지한다. 특히 혼자 작업하는 피처 브랜치나 빠른 커밋 루프가 반복되는 개발 환경에서 머지 커밋 없이 깔끔한 히스토리를 유지하는 데 효과적이다. `pull.rebase true` 전역 설정을 한 번 적용해 두면 이후 `git pull` 만으로도 항상 rebase 방식을 사용하게 된다.

---

**지난 글:** [fetch --prune으로 삭제된 원격 브랜치 정리하기](/posts/git-fetch-prune/)

**다음 글:** [git push 기본 사용법](/posts/git-push-basics/)

<br>
읽어주셔서 감사합니다. 😊
