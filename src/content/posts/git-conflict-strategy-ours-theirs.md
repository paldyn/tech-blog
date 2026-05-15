---
title: "충돌 해결 전략: -X ours와 -X theirs"
description: "git merge와 rebase에서 -X ours/-X theirs 옵션으로 충돌을 자동 해결하는 방법, checkout --ours/theirs로 파일 단위 선택, rebase에서의 의미 반전을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 5
type: "knowledge"
category: "Git"
tags: ["Git", "충돌", "conflict", "ours", "theirs", "전략"]
featured: false
draft: false
---

[지난 글](/posts/git-mergetool/)에서 mergetool을 이용해 시각적으로 충돌을 해결하는 방법을 배웠다. 충돌이 단순하거나 한쪽 버전을 일괄 선택해도 될 때는 **`-X ours` / `-X theirs`** 전략 옵션으로 수작업 없이 자동 해결할 수 있다.

## -X 옵션의 역할

`-X`는 충돌 발생 시 어느 쪽을 선택할지 미리 지정하는 전략 옵션이다. 충돌이 없는 부분은 평소처럼 자동 병합되고, 충돌이 있는 부분만 지정한 쪽을 선택한다.

```bash
# 충돌 발생 시 HEAD(현재 브랜치) 버전으로 자동 해결
git merge -X ours feature

# 충돌 발생 시 병합 대상(feature) 버전으로 자동 해결
git merge -X theirs feature
```

![충돌 자동 해결 전략 개념](/assets/posts/git-conflict-strategy-concept.svg)

## merge에서 ours/theirs

merge 명령에서 `ours`와 `theirs`의 의미는 직관적이다.

- **`ours`**: 현재 브랜치(HEAD)의 변경 내용
- **`theirs`**: 병합 대상 브랜치의 변경 내용

```bash
# main 브랜치에서 feature를 병합할 때
git checkout main
git merge -X ours feature    # 충돌 → main 버전 채택
git merge -X theirs feature  # 충돌 → feature 버전 채택
```

## rebase에서 ours/theirs — 주의!

rebase에서는 `ours`와 `theirs`의 의미가 **반대로 느껴진다**. rebase 중 Git은 커밋을 하나씩 재적용하는데, 이때 "현재 작업 중인 기반(base)"을 `ours`로, "내가 가져온 커밋"을 `theirs`로 취급한다.

```bash
# feature 브랜치에서 main 기준으로 rebase
git checkout feature
git rebase -X theirs main
# → 충돌 시 feature 커밋의 내용을 유지
```

헷갈린다면 `checkout --ours/theirs`를 파일 단위로 사용하는 편이 더 명확하다.

## 파일 단위 선택: checkout --ours/theirs

충돌 파일 전체에 전략을 적용하는 대신, 특정 파일만 선택하고 싶을 때는 `git checkout --ours` 또는 `--theirs`를 사용한다.

```bash
# src/config.py는 내 버전으로, src/app.py는 상대 버전으로
git checkout --ours src/config.py
git checkout --theirs src/app.py

# 스테이지에 올리기
git add src/config.py src/app.py
```

`git restore`로도 동일하게 동작한다.

```bash
git restore --ours src/config.py
git restore --theirs src/app.py
```

![충돌 전략 명령어 모음](/assets/posts/git-conflict-strategy-commands.svg)

## 실전 사용 시나리오

### 번역 파일 업데이트

번역 파일(`.po`, `.json`)은 자동 생성 결과가 충돌해도 항상 최신 버전으로 덮어쓰는 편이 안전하다.

```bash
git merge -X theirs translation-update
```

### 버전 번호 보호

CI/CD 파이프라인이 자동으로 버전 파일을 수정할 때, 브랜치 병합에서 main의 버전을 항상 유지하려면 ours를 사용한다.

```bash
git merge -X ours release/2.x
```

### 포맷터 결과 적용

코드 포맷터(Prettier, Black 등)를 일괄 적용한 브랜치를 병합할 때 포맷 결과를 모두 채택한다.

```bash
git merge -X theirs format/apply-prettier
```

## 주의사항

`-X` 옵션은 충돌이 있는 **모든 위치**에 동일하게 적용된다. 위치마다 다른 판단이 필요하다면 이 옵션은 적합하지 않다. 중요한 파일이 섞여 있을 때는 `checkout --ours/theirs`로 파일별로 처리하거나 수동으로 해결하는 것이 더 안전하다.

---

**지난 글:** [git mergetool로 시각적으로 충돌 해결하기](/posts/git-mergetool/)

**다음 글:** [rerere: 충돌 해결책을 기억하고 재사용하기](/posts/git-rerere/)

<br>
읽어주셔서 감사합니다. 😊
