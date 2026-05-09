---
title: "git log --format: 커밋 로그 출력 형식 커스터마이징"
description: "git log의 --format(--pretty=format:) 옵션과 플레이스홀더를 활용해 원하는 형태로 커밋 히스토리를 출력하는 방법을 정리한다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 7
type: "knowledge"
category: "Git"
tags: ["Git", "git log", "format", "pretty", "플레이스홀더", "커밋 히스토리"]
featured: false
draft: false
---

[지난 글](/posts/git-log-basics/)에서 `git log`의 기본 사용법을 살펴봤다. 이번에는 출력 형식을 자유롭게 제어하는 `--format` 옵션을 다룬다. 기본 출력이 너무 장황하거나 특정 정보만 뽑아 스크립트에 쓰고 싶을 때 필수적이다.

## --format vs --pretty

두 옵션은 동일하게 동작한다.

```bash
git log --format="%h %s"
git log --pretty=format:"%h %s"   # 완전히 동일
```

`--format`이 더 짧아서 대화형 사용에 편하다.

## 내장 형식

커스텀 형식 외에도 Git이 제공하는 내장 형식이 있다.

```bash
git log --pretty=oneline     # 해시 + 제목
git log --pretty=short       # 해시 + 저자 + 제목
git log --pretty=medium      # 기본값
git log --pretty=full        # Committer 정보까지
git log --pretty=fuller      # 날짜 정보 풍부
```

## 플레이스홀더

`%` 시작 플레이스홀더로 원하는 필드를 조합한다.

![git log --format 플레이스홀더](/assets/posts/git-log-formatting-placeholders.svg)

```bash
# 해시 + 저자 + 상대 날짜 + 제목
git log --format="%h %an %ar %s"
```

`%ar`(상대 날짜)는 "2 hours ago" 형태로 사람이 읽기 쉬운 반면, `%ad`는 실제 날짜를 출력한다. `--date=short` 등과 조합할 수도 있다.

```bash
git log --format="%h %ad %s" --date=short
# 9a3f1b2 2026-05-10 feat: add user authentication
```

## 색상 적용

터미널 출력에 색상을 입히려면 `%C(color)` / `%Creset`을 쓴다.

```bash
git log --format="%C(yellow)%h%Creset %C(cyan)%ar%Creset %s" --color
```

지원 색상: `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`, `bold`, `dim`

## 실용 예시

![실용적인 format 예시](/assets/posts/git-log-formatting-examples.svg)

### 변경 로그 생성

```bash
# 마지막 태그 이후 변경 — 릴리스 노트 초안
git log v1.2.0..HEAD --format="- %s (%h)" --no-merges
```

### 스크립트용 파싱

```bash
# 탭 구분자로 해시·날짜·제목 추출
git log --format="%H%x09%ai%x09%s" > commits.tsv
```

`%x09`는 탭 문자(ASCII 0x09)다.

### alias로 등록

자주 쓰는 형식은 alias로 저장하면 편하다.

```bash
git config --global alias.lg \
  "log --oneline --decorate --graph --all"

git config --global alias.ll \
  "log --format='%C(yellow)%h%Creset %C(cyan)%ar%Creset %an %s'"
```

## %B vs %s + %b

커밋 메시지 전체를 출력하려면 `%B`를 쓴다.

```bash
git log --format="%h%n%B" -1  # 최근 커밋의 전체 메시지
```

`%s`는 첫 줄(제목), `%b`는 본문(두 번째 줄 이후), `%B`는 둘 다다.

---

**지난 글:** [git log 기초: 커밋 히스토리 탐색하기](/posts/git-log-basics/)

**다음 글:** [git log --graph: 브랜치 분기를 ASCII 그래프로 시각화하기](/posts/git-log-graph/)

<br>
읽어주셔서 감사합니다. 😊
