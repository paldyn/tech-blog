---
title: "git log --graph: 브랜치 분기를 ASCII 그래프로 시각화하기"
description: "git log --graph 옵션으로 브랜치 분기와 병합을 터미널에서 시각적으로 파악하는 방법과, 자주 쓰는 alias 설정을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "git log", "graph", "브랜치 시각화", "alias", "oneline"]
featured: false
draft: false
---

[지난 글](/posts/git-log-formatting/)에서 `--format`으로 출력 형식을 커스터마이징하는 법을 다뤘다. 이번에는 `--graph` 옵션을 써서 브랜치 분기와 병합 흐름을 터미널에서 ASCII 그래프로 보는 방법을 살펴본다.

## --graph 옵션

```bash
git log --graph --oneline --decorate --all
```

이 명령 하나로 전체 브랜치 구조를 한눈에 파악할 수 있다. 각 플래그의 역할:

- `--graph`: 브랜치 분기·병합을 ASCII로 그림
- `--oneline`: 커밋을 해시 7자 + 제목 한 줄로
- `--decorate`: 브랜치·태그 이름 표시
- `--all`: 현재 브랜치뿐 아니라 원격 포함 모든 ref

![git log --graph 출력 예시](/assets/posts/git-log-graph-ascii.svg)

## 그래프 기호 읽기

- `*`: 커밋 노드
- `|`: 수직 브랜치 선 (이 줄이 계속 이어짐)
- `\` / `/`: 브랜치가 분기하거나 합류하는 지점
- `(HEAD -> main)`: 현재 체크아웃된 브랜치
- `(feature/login)`: 다른 로컬/원격 브랜치 ref

머지 커밋은 부모가 두 개라 `|\` 혹은 `/|` 형태로 선이 갈라진다.

## alias 등록 권장

긴 명령을 매번 입력하기 어려우므로 alias로 저장해두면 편하다.

![그래프 로그 권장 alias](/assets/posts/git-log-graph-alias.svg)

```bash
# 기본 alias 등록
git config --global alias.lg "log --graph --oneline --decorate --all"

# 이후 사용
git lg
```

## 현재 브랜치만 보기

`--all`을 빼면 현재 브랜치와 그 조상 커밋만 나온다.

```bash
git log --graph --oneline --decorate
```

PR을 올리기 전에 내 feature 브랜치의 분기 흐름만 확인하고 싶을 때 유용하다.

## 두 브랜치 비교

```bash
# main과 feature/login의 그래프 비교
git log --graph --oneline main feature/login
```

## 범위 지정

```bash
# main에 없는 feature 커밋만 그래프로
git log --graph --oneline main..feature/login
```

## GUI 대안

터미널 그래프가 복잡하게 느껴진다면 `gitk`(번들), VS Code의 GitLens, GitHub Desktop 같은 GUI 도구도 동일한 정보를 더 직관적으로 보여준다. 하지만 서버 SSH 환경이나 CI 로그에서는 `--graph`가 유일한 선택이다.

```bash
# 터미널 TUI 대안 (설치 필요)
# tig, lazygit 등
tig --all
```

---

**지난 글:** [git log --format: 커밋 로그 출력 형식 커스터마이징](/posts/git-log-formatting/)

**다음 글:** [git log 필터: 저자·날짜·키워드로 커밋 검색하기](/posts/git-log-filter/)

<br>
읽어주셔서 감사합니다. 😊
