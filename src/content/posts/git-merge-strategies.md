---
title: "Merge 전략: ort, recursive, octopus, ours 비교"
description: "Git의 다양한 merge 전략(strategy)과 옵션(-X ours/-X theirs)의 차이를 이해하고, 상황에 맞는 전략을 선택하는 방법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "merge", "전략", "ort", "recursive", "octopus"]
featured: false
draft: false
---

[지난 글](/posts/git-merge-squash/)에서 squash merge를 살펴봤다. 이번에는 `git merge -s`로 지정하는 **병합 전략(strategy)**을 다룬다. 일상적으로는 기본값을 사용하지만, 복잡한 병합 시나리오나 자동화 스크립트에서 전략 선택이 중요해진다.

## 전략이란

Git은 두 브랜치를 합칠 때 내부적으로 알고리즘을 사용한다. 이 알고리즘을 **merge strategy**라고 부른다. `-s` 옵션으로 명시적으로 선택하지 않으면 Git이 상황에 따라 자동 선택한다.

```bash
git merge -s <전략> <브랜치>
```

![Git Merge 전략 비교](/assets/posts/git-merge-strategies-overview.svg)

## ort: 현재 기본 전략

Git 2.34부터 기본 전략이 `recursive`에서 `ort`(Orthogonal Recursive Text)로 바뀌었다.

```bash
git merge feature
# Merge made by the 'ort' strategy.
```

`ort`는 `recursive`보다 rename 추적이 정확하고, 크로스-브랜치 병합(criss-cross merge) 상황에서 더 안정적이다. 성능도 개선됐다. 새 프로젝트라면 ort가 기본이므로 특별히 지정할 필요가 없다.

## recursive: 이전 기본 전략

Git 2.33 이하에서는 `recursive`가 기본이었다. 지금도 사용 가능하다.

```bash
git merge -s recursive feature
```

두 브랜치가 공통 조상을 여러 개 가지는 복잡한 히스토리(criss-cross)에서 공통 조상들을 재귀적으로 합쳐 가상의 Base를 만든다. ort로 대체됐지만 동작 방식은 거의 동일하다.

## octopus: 3개 이상 브랜치 동시 병합

2개 초과 브랜치를 한 번에 병합할 때 사용한다. 여러 개의 부모를 가진 단일 머지 커밋이 생성된다.

```bash
git merge -s octopus feat-a feat-b feat-c
# Merge made by the 'octopus' strategy.
```

단, **충돌이 발생하면 즉시 중단**된다. 충돌 없는 단순 통합 작업, 예를 들어 모놀리포에서 여러 독립 서비스 브랜치를 통합 브랜치로 합칠 때 유용하다.

## ours 전략: 상대 변경 완전 무시

`-s ours`는 병합 대상 브랜치의 변경사항을 **완전히 무시**하고 HEAD 내용을 유지한다. 그러나 머지 커밋은 생성된다. 히스토리 기록을 남기되 실제 코드를 바꾸고 싶지 않을 때 쓴다.

```bash
# 구버전 브랜치가 main에 "병합됐다"는 기록만 남기기
git merge -s ours legacy-v1
```

⚠️ `-s ours`(전략)와 `-X ours`(옵션)는 다르다. `-s ours`는 모든 변경을 무시하고, `-X ours`는 충돌이 발생한 부분만 현재 브랜치 버전을 선택한다.

## 전략 옵션 (-X): 충돌 자동 해결 방향

전략 자체가 아니라 **충돌 발생 시 처리 방향**을 지정하는 것이 `-X` 옵션이다.

```bash
# 충돌 발생 시 항상 현재 브랜치(HEAD) 선택
git merge -X ours feature

# 충돌 발생 시 항상 상대 브랜치 선택
git merge -X theirs feature
```

![전략 옵션 사용법](/assets/posts/git-merge-strategies-options.svg)

자동화 파이프라인에서 특정 브랜치가 항상 우선시되어야 할 때 유용하다. `git rebase`에도 동일하게 적용된다.

## rename-threshold 옵션

파일 이름이 바뀌었을 때 Git이 "삭제 + 새파일"로 볼지 "이름 변경"으로 볼지 임계값을 조정할 수 있다.

```bash
# 50%(기본)보다 낮게 설정해 더 많이 rename 감지
git merge -X rename-threshold=30 feature
```

파일을 대규모로 리팩터링한 브랜치를 병합할 때 충돌을 줄이는 데 도움된다.

## 요약

| 전략 | 선택 시기 |
|------|-----------|
| `ort` (기본) | 2브랜치 병합, Git 2.34+ |
| `recursive` | 레거시 환경, ort 이전 |
| `octopus` | 3개+ 브랜치 동시 병합, 충돌 없을 때 |
| `ours` | 변경 무시하고 히스토리만 기록 |

---

**지난 글:** [Squash Merge: 커밋을 하나로 압축해 병합하기](/posts/git-merge-squash/)

**다음 글:** [Rebase 기초: 커밋을 다른 베이스로 이동시키기](/posts/git-rebase-basics/)

<br>
읽어주셔서 감사합니다. 😊
