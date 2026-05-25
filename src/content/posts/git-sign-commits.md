---
title: "git commit -S: 커밋에 GPG/SSH 서명 추가하기"
description: "git commit -S와 commit.gpgsign으로 커밋을 서명하는 방법, 서명된 커밋의 gpgsig 필드 구조, git verify-commit과 git log --show-signature로 서명을 검증하는 방법, rebase 후 서명 재적용을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 9
type: "knowledge"
category: "Git"
tags: ["Git", "commit-signing", "GPG", "verify-commit", "보안", "Verified"]
featured: false
draft: false
---

[지난 글](/posts/git-gpg-signing-setup/)에서 GPG/SSH 서명 환경을 설정했다. 이번에는 실제로 커밋에 서명하고 검증하는 방법을 다룬다.

## 커밋 서명하기

GPG 키 설정이 완료된 상태라면 서명 커밋은 간단하다.

```bash
# 단일 커밋 서명
git commit -S -m "feat: add authentication module"

# 이미 commit.gpgsign = true 면 -S 없이도 자동 서명
git commit -m "feat: add authentication module"

# 서명 없이 커밋 (자동 서명이 켜진 상태에서 강제로 서명 건너뜀)
git commit --no-gpg-sign -m "wip: quick fix"
```

서명 시 GPG 패스프레이즈를 묻는 대화상자나 프롬프트가 뜬다. gpg-agent가 실행 중이면 캐시된 패스프레이즈를 사용한다.

## 서명된 커밋의 내부 구조

서명은 커밋 오브젝트의 `gpgsig` 필드에 저장된다. PGP 서명 블록 전체가 커밋 내용에 포함된다.

![서명된 커밋 구조](/assets/posts/git-sign-commits-anatomy.svg)

```bash
# 원시 커밋 내용 확인 (gpgsig 필드 포함)
git cat-file -p HEAD

# 출력:
# tree   9d8a3e2f...
# parent 4f2b1ae7...
# author Alice <alice@example.com> 1716868800 +0900
# committer Alice <alice@example.com> 1716868800 +0900
# gpgsig -----BEGIN PGP SIGNATURE-----
#        iQIzBAABCAAdFiEE...
#        -----END PGP SIGNATURE-----
#
# feat: add authentication module
```

`gpgsig` 필드는 커밋 메타데이터(tree, parent, author, committer, 메시지)를 기준으로 생성된 서명이다. 커밋 내용이 변경되면 서명이 무효가 된다.

## 서명 검증

![서명 검증](/assets/posts/git-sign-commits-verify.svg)

```bash
# 특정 커밋 서명 검증
git verify-commit HEAD
git verify-commit abc123def456

# 정상 서명:
# gpg: Good signature from "Alice <alice@example.com>"
# gpg: Signature made 2024-01-01 using RSA key 3AA5C34371567BD2

# 서명 없는 커밋:
# error: no signature found
```

## git log에서 서명 상태 확인

```bash
# 서명 정보 포함 로그
git log --show-signature

# 형식 코드로 서명 상태 확인
# %G?: G(Good) / B(Bad) / U(Unknown) / N(None) / E(Expired)
git log --format="%H %G? %GS" --all

# 서명된 커밋만 필터링
git log --format="%H %G? %GS" | grep " G "
```

`--format`의 `%G?` 플레이스홀더는 서명 상태를 한 글자 코드로 반환한다. CI/CD 파이프라인에서 미서명 커밋을 탐지하는 데 활용할 수 있다.

## amend 후 서명 갱신

커밋 내용이 바뀌면 서명이 무효화된다. `git commit --amend`로 내용을 수정하면 서명도 다시 생성해야 한다.

```bash
# amend와 동시에 재서명
git commit --amend -S

# 메시지만 수정 + 재서명
git commit --amend -S --no-edit
```

## rebase 후 서명 재적용

`git rebase`는 커밋을 새로 만들기 때문에 기존 서명이 모두 무효가 된다.

```bash
# rebase 후 새 커밋들 자동 서명
git rebase main --gpg-sign

# 특정 범위 서명 (--exec 활용)
git rebase -i HEAD~5 --exec "git commit --amend --no-edit -S"
```

`commit.gpgsign = true` 설정이 있으면 일반 rebase에서도 새 커밋이 자동으로 서명된다.

## 서명 정책 강제 (서버 훅)

팀 전체에 서명 커밋을 강제하려면 서버 사이드 훅에서 검증한다.

```bash
#!/bin/bash
# .git/hooks/pre-receive 또는 서버 훅

while read old new ref; do
  commits=$(git rev-list "$old..$new")
  for commit in $commits; do
    if ! git verify-commit "$commit" > /dev/null 2>&1; then
      echo "ERROR: unsigned commit rejected: $commit"
      exit 1
    fi
  done
done
```

GitHub에서는 Repository Settings > Branches > Branch protection rules에서 "Require signed commits" 옵션으로 UI로 간단하게 강제할 수 있다.

## 서명 없는 과거 커밋 처리

이미 push된 서명 없는 커밋을 소급해서 서명하는 것은 불가능하다(SHA가 바뀌므로). 현실적인 접근법은:

1. 오늘부터 새로 생성되는 커밋만 서명 강제
2. 주요 릴리스 태그부터 서명 시작
3. 이전 커밋은 `git notes`에 서명 정보를 별도로 기록

---

**지난 글:** [Git GPG 서명 설정: 커밋 신원 보증하기](/posts/git-gpg-signing-setup/)

**다음 글:** [git tag -s: 태그에 서명 추가하기](/posts/git-sign-tags/)

<br>
읽어주셔서 감사합니다. 😊
