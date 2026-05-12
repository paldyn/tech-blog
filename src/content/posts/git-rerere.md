---
title: "rerere: 충돌 해결책을 기억하고 재사용하기"
description: "git rerere의 동작 원리, 활성화 방법, rr-cache 구조, autoupdate 설정, 캐시 관리 방법을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 6
type: "knowledge"
category: "Git"
tags: ["Git", "rerere", "충돌", "conflict", "자동화"]
featured: false
draft: false
---

[지난 글](/posts/git-conflict-strategy-ours-theirs/)에서 충돌 전략 옵션(-X ours/theirs)으로 자동 해결하는 방법을 배웠다. 이번에는 한 번 해결한 충돌을 **기억해두었다가 같은 충돌이 다시 나타나면 자동으로 재적용**하는 `rerere` 기능을 다룬다.

## rerere란

`rerere`는 **Reuse Recorded Resolution**(기록된 해결책 재사용)의 약자다. 충돌을 처음 해결하면 Git이 그 해결 방법을 `.git/rr-cache` 디렉토리에 저장해둔다. 이후 동일한 충돌 패턴이 다시 발생하면 저장된 해결책을 자동으로 적용한다.

이 기능이 빛나는 상황은 **장기 feature 브랜치를 main에 주기적으로 rebase하거나 여러 번 병합 테스트를 반복할 때**다. 같은 충돌을 반복해서 수동 해결하지 않아도 된다.

## 활성화

`rerere`는 기본적으로 비활성화되어 있다. 전역 설정으로 켠다.

```bash
git config --global rerere.enabled true
```

프로젝트 단위로만 활성화하려면 `--global` 없이 실행한다.

```bash
git config rerere.enabled true
```

## 동작 흐름

![rerere: 충돌 해결책 기록 → 재사용](/assets/posts/git-rerere-concept.svg)

1. 충돌이 발생하면 rerere가 자동으로 충돌 패턴을 기록한다.
2. 사람이 직접 해결하고 `git add`한다.
3. rerere가 해결책을 `.git/rr-cache/<hash>/postimage`에 저장한다.
4. 나중에 같은 충돌 패턴이 다시 나타나면 저장된 해결책을 자동으로 적용한다.
5. `autoupdate`가 켜져 있으면 `git add`도 자동으로 처리된다.

## autoupdate 설정

`rerere.autoupdate`를 켜면 재사용 시 `git add`까지 자동으로 처리한다.

```bash
git config --global rerere.autoupdate true
```

이 경우 같은 충돌이 재발하면 다음 두 단계만 실행하면 된다.

```bash
git merge feature   # 충돌 자동 해결 + 자동 add
git commit          # 커밋만 하면 완료
```

## 실전 사용 예시

feature 브랜치를 main에 주기적으로 rebase하는 팀에서 유용하다.

```bash
# 1회차: 처음 rebase
git rebase main
# CONFLICT in src/auth.py → 수동 해결
git add src/auth.py
git rebase --continue
# rerere가 해결책을 기록

# 2회차: 같은 rebase 반복
git rebase main
# Resolved 'src/auth.py' using previous resolution.
# 자동 해결 완료 — 수동 편집 불필요
git rebase --continue
```

## 캐시 확인 및 관리

```bash
# 현재 기록된 충돌 목록
git rerere status

# 기록된 해결책 미리 보기
git rerere diff

# 캐시 디렉토리 직접 보기
ls .git/rr-cache/
```

잘못된 해결책이 기록됐거나 파일이 크게 리팩토링됐을 때는 캐시를 초기화한다.

```bash
# 특정 파일의 해결책만 삭제
git rerere forget src/auth.py

# 전체 캐시 초기화
rm -rf .git/rr-cache/
```

![rerere 설정 및 관리 명령어](/assets/posts/git-rerere-workflow.svg)

## 주의사항

- rerere가 자동 해결한 내용이 항상 올바른 것은 아니다. `git diff --staged`로 결과를 검토한 뒤 커밋한다.
- 파일 구조가 크게 바뀌었다면 이전 해결책이 맞지 않을 수 있다. `git rerere forget`으로 무효화한다.
- 팀 전체가 rerere를 사용한다고 해서 `.git/rr-cache`가 공유되지는 않는다. 각자 로컬 캐시다.

## 언제 쓰면 좋은가

- **장기 feature 브랜치**를 정기적으로 main에 rebase해야 할 때
- **여러 브랜치를 순차적으로 병합 테스트**하는 통합 브랜치 유지 시
- **반복적인 cherry-pick** 작업으로 같은 충돌이 반복될 때

---

**지난 글:** [충돌 해결 전략: -X ours와 -X theirs](/posts/git-conflict-strategy-ours-theirs/)

**다음 글:** [Rebase 중 충돌 처리: 커밋별 해결 전략](/posts/git-conflict-during-rebase/)

<br>
읽어주셔서 감사합니다. 😊
