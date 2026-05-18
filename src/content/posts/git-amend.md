---
title: "git commit --amend — 마지막 커밋 수정"
description: "git commit --amend의 내부 동작 원리, 메시지 수정·파일 추가·작성자 변경 패턴, push된 커밋에 대한 주의사항을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "amend", "커밋 수정", "히스토리", "rewrite"]
featured: false
draft: false
---

[지난 글](/posts/git-semver-tagging/)에서 SemVer와 Git 태그를 연동하는 방법을 살펴봤다. 이번에는 방금 만든 커밋을 수정하는 가장 간단한 도구, **`git commit --amend`**를 다룬다. 메시지 오타, 빠뜨린 파일, 잘못된 작성자 정보를 로컬에서 빠르게 수정할 수 있다.

## amend의 내부 동작

`--amend`는 기존 커밋을 "수정"하는 것처럼 보이지만, 실제로는 **새 커밋 객체를 생성**하고 HEAD를 그 커밋으로 이동시킨다. 기존 커밋 객체는 참조가 끊어진 고아 상태가 되어 나중에 garbage collect된다.

```bash
# 현재 HEAD 확인
git log --oneline -1
# def5678 feat: add loginn  ← 오타

# amend
git commit --amend -m "feat: add login"

# 새 SHA 확인
git log --oneline -1
# ghi9012 feat: add login   ← SHA가 바뀜!
```

SHA가 바뀐다는 점이 핵심이다. 이미 원격에 push된 커밋을 amend하면 원격과 SHA가 달라져 일반 push가 거부된다.

![git commit --amend 동작 원리](/assets/posts/git-amend-concept.svg)

## 기본 사용 패턴

```bash
# 커밋 메시지만 수정 (에디터 열림)
git commit --amend

# 메시지 직접 지정
git commit --amend -m "fix: correct login endpoint"

# 메시지 유지, 내용(파일)만 변경
git add forgotten-file.js
git commit --amend --no-edit

# 작성자 정보 수정
git commit --amend --author="Correct Name <correct@email.com>" --no-edit
```

`--no-edit`은 커밋 메시지를 그대로 유지하면서 파일 변경만 적용할 때 쓴다.

![git commit --amend 활용 패턴](/assets/posts/git-amend-usecases.svg)

## 빠뜨린 파일 추가하기

커밋 직후 빠뜨린 파일을 발견했을 때 가장 흔하게 사용하는 패턴이다.

```bash
# 커밋 이후 파일이 빠졌다는 걸 발견
git status
# Changes not staged: src/config.js

# 스테이징 후 amend
git add src/config.js
git commit --amend --no-edit

# 결과: 이전 커밋에 config.js가 포함됨
git show --stat HEAD
```

새 커밋을 추가하는 대신 기존 커밋에 포함시키므로 히스토리가 깔끔하게 유지된다.

## 타임스탬프 처리

amend하면 **committer date는 현재 시간으로 갱신**되지만, author date는 유지된다. 둘 다 현재 시간으로 바꾸려면 `--reset-author` 옵션을 쓴다.

```bash
# author date도 현재 시간으로 갱신
git commit --amend --reset-author --no-edit
```

## push된 커밋을 amend할 때

이미 원격에 push된 커밋을 amend하면 SHA가 달라져서 일반 push가 거부된다.

```bash
# amend 후 push 시도
git push origin main
# ! [rejected] main -> main (non-fast-forward)

# 강제 push가 필요 (위험!)
git push origin main --force-with-lease
```

`--force`보다 `--force-with-lease`가 안전하다. 다른 사람이 그 사이에 push한 것이 있으면 자동으로 거부한다.

**원칙**: 혼자만 사용하는 feature 브랜치라면 amend + force push가 허용되는 경우도 있다. 하지만 main, develop 등 공유 브랜치에서는 절대 사용하지 않는다.

## amend vs 새 커밋

amend가 적합한 상황과 새 커밋이 적합한 상황을 구분하는 것이 중요하다.

| 상황 | amend | 새 커밋 |
|------|-------|---------|
| 아직 push 안 함 | ✓ 권장 | 가능 |
| 로컬 feature 브랜치 (혼자) | ✓ 가능 | 가능 |
| 공유 브랜치에 이미 push | ✗ 금지 | ✓ 권장 |
| 팀원이 해당 커밋 기반으로 작업 중 | ✗ 금지 | ✓ 권장 |

---

**지난 글:** [Semantic Versioning과 Git 태깅](/posts/git-semver-tagging/)

**다음 글:** [git commit --amend 주의사항과 실수 복구](/posts/git-amend-pitfalls/)

<br>
읽어주셔서 감사합니다. 😊
