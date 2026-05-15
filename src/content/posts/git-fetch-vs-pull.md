---
title: "fetch와 pull의 차이 — 안전하게 동기화하기"
description: "git fetch와 git pull의 동작 방식 차이를 이해하고, 각각의 적절한 사용 상황을 파악한다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 3
type: "knowledge"
category: "Git"
tags: ["Git", "fetch", "pull", "merge", "rebase", "원격 동기화"]
featured: false
draft: false
---

[지난 글](/posts/git-remote-rename-remove/)에서 원격 저장소 이름과 URL을 관리하는 방법을 살펴봤다. 원격 저장소를 등록했다면, 이제 그 저장소의 변경 사항을 로컬로 가져올 차례다. 이때 가장 혼란스러운 두 명령이 `git fetch`와 `git pull`이다. 둘 다 "원격에서 가져온다"는 말로 설명되지만, 동작 방식이 근본적으로 다르다.

## 핵심 차이: 통합 여부

한 문장으로 정리하면 이렇다.

- **`git fetch`**: 원격 변경 사항을 로컬에 **다운로드**만 한다. 워킹 트리와 현재 브랜치는 건드리지 않는다.
- **`git pull`**: `git fetch`를 먼저 실행하고, 이어서 `git merge`(또는 `git rebase`)를 자동으로 실행한다.

![fetch vs pull 동작 비교](/assets/posts/git-fetch-vs-pull-comparison.svg)

`git fetch` 후 `origin/main` 추적 브랜치는 갱신되지만, 로컬 `main` 브랜치는 여전히 이전 커밋을 가리킨다. 이후 **어떻게 통합할지 개발자가 직접 결정**한다는 점이 핵심이다.

## git fetch: 신중한 동기화

```bash
# 특정 원격의 변경 사항 가져오기
git fetch origin

# 모든 원격에서 한꺼번에 가져오기
git fetch --all

# 가져온 후 변경 내용 확인
git log main..origin/main   # 원격에만 있는 커밋
git diff main origin/main   # 코드 차이
```

`fetch` 후에는 무엇이 바뀌었는지 확인하고, 직접 통합 방식을 선택할 수 있다.

```bash
# 옵션 A: merge로 통합
git merge origin/main

# 옵션 B: rebase로 통합 (히스토리 일직선)
git rebase origin/main

# 옵션 C: fast-forward만 허용
git merge --ff-only origin/main
```

이 유연성이 `git fetch`의 가장 큰 장점이다. 원격에 예상치 못한 커밋이 있을 때 바로 `merge`하지 않고 내용을 먼저 검토할 수 있다.

## git pull: 편리한 자동 통합

```bash
# 기본 pull (fetch + merge)
git pull origin main

# 현재 브랜치의 업스트림이 설정된 경우 단축형
git pull
```

`git pull`은 내부적으로 `git fetch`를 실행한 뒤 자동으로 `merge`(또는 설정에 따라 `rebase`)를 수행한다. 빠르게 최신 상태로 맞추는 데 편리하지만, 원격에 무엇이 있는지 확인하지 않고 통합이 진행된다는 점에서 주의가 필요하다.

**pull 옵션 비교:**

```bash
# 기본: merge (머지 커밋 생성 가능)
git pull origin main

# rebase (히스토리 일직선, 머지 커밋 없음)
git pull --rebase origin main

# fast-forward만 허용 (불가 시 오류)
git pull --ff-only origin main
```

`--ff-only`는 원격이 로컬보다 앞서 있을 때만(fast-forward 가능) 통합을 허용한다. 로컬에 독자적 커밋이 있으면 오류로 중단되므로, "예상치 못한 머지 커밋 방지" 용도로 유용하다.

![fetch · pull 주요 명령 모음](/assets/posts/git-fetch-vs-pull-commands.svg)

## 어느 것을 언제 써야 할까

| 상황 | 추천 |
|------|------|
| 원격 변경 내용을 먼저 검토하고 싶을 때 | `git fetch` |
| 공유 브랜치(main, develop)를 업데이트할 때 | `git pull --ff-only` |
| 개인 브랜치에서 히스토리를 깔끔하게 유지하고 싶을 때 | `git pull --rebase` |
| 빠른 동기화가 목적이고 머지 커밋이 무방할 때 | `git pull` |

많은 팀이 `main` 브랜치에는 `git fetch` + 내용 확인 + `git merge --ff-only` 조합을 채택한다. 자동화된 `pull`이 예상치 못한 머지 커밋을 만들어 히스토리를 오염시키는 것을 막기 위해서다.

## pull의 기본 동작 변경

Git 2.27부터 `pull.rebase` 설정이 없으면 경고가 출력된다. 팀 정책에 따라 전역으로 설정해 두는 것이 좋다.

```bash
# 항상 merge (기본 동작 명시)
git config --global pull.rebase false

# 항상 rebase
git config --global pull.rebase true

# fast-forward만
git config --global pull.ff only
```

## fetch와 pull이 공유하는 동작

- 원격 브랜치 목록(`refs/remotes/origin/*`) 갱신
- 원격 태그 다운로드(기본적으로 fetch 시 자동)
- 네트워크 오류 시 기존 로컬 상태 유지

## 정리

`git fetch`는 "다운로드만, 통합은 내가 결정", `git pull`은 "다운로드 + 자동 통합"이다. 협업 브랜치를 다룰 때는 `git fetch`로 먼저 내용을 확인하는 습관이 예상치 못한 충돌과 히스토리 오염을 줄이는 가장 안전한 방법이다.

---

**지난 글:** [원격 저장소 이름 변경과 삭제](/posts/git-remote-rename-remove/)

**다음 글:** [fetch --prune으로 삭제된 원격 브랜치 정리하기](/posts/git-fetch-prune/)

<br>
읽어주셔서 감사합니다. 😊
