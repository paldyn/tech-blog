---
title: "Git Tag 오브젝트: annotated tag의 내부 구조"
description: "annotated tag가 별도 오브젝트로 존재하는 이유, tag 오브젝트의 필드(object·type·tag·tagger·message·GPG서명), lightweight tag와의 차이를 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 4
type: "knowledge"
category: "Git"
tags: ["Git", "tag", "annotated-tag", "object-model", "GPG", "내부구조"]
featured: false
draft: false
---

[지난 글](/posts/git-commit-object/)에서 commit 오브젝트 구조를 살펴봤다. 오브젝트 모델의 네 번째 타입인 **tag 오브젝트**는 annotated tag를 만들 때만 생성된다.

## annotated tag vs lightweight tag

`git tag v1.0.0`과 `git tag -a v1.0.0 -m "msg"`는 동작 방식이 다르다.

| 구분 | lightweight | annotated |
|------|------------|-----------|
| 오브젝트 생성 | 없음 | tag 오브젝트 생성 |
| 가리키는 것 | commit SHA 직접 | tag 오브젝트 SHA |
| 메시지 | 없음 | 있음 |
| 서명(GPG) | 불가 | 가능 |
| `git describe` | 기본 제외 | 기본 포함 |

```bash
# lightweight: ref가 commit SHA를 직접 가리킴
git tag v1.0.0-lw
cat .git/refs/tags/v1.0.0-lw
# abc123def...  ← commit SHA 그 자체

# annotated: ref가 tag 오브젝트 SHA를 가리킴
git tag -a v1.0.0 -m "Release v1.0.0"
cat .git/refs/tags/v1.0.0
# ttt999fff...  ← tag 오브젝트 SHA
```

![Tag 오브젝트 구조](/assets/posts/git-tag-object-structure.svg)

## tag 오브젝트 원문

`git cat-file -p v1.0.0`으로 tag 오브젝트를 읽으면 다음과 같이 나온다.

```
object abc123def456…
type   commit
tag    v1.0.0
tagger Alice <alice@example.com> 1716681600 +0900

Release v1.0.0

First stable release. Includes login and signup.
-----BEGIN PGP SIGNATURE-----
...
-----END PGP SIGNATURE-----
```

| 필드 | 설명 |
|------|------|
| `object` | 가리키는 오브젝트 SHA (보통 commit) |
| `type` | 가리키는 오브젝트 타입 (commit·blob·tree·tag) |
| `tag` | 태그 이름 |
| `tagger` | 태그를 만든 사람과 시각 |
| 빈 줄 이후 | 태그 메시지 (GPG 서명이 있으면 마지막에 추가) |

## ^{} 역참조

annotated tag는 `v1.0.0`이 tag 오브젝트를 가리키고, tag 오브젝트가 commit을 가리키는 2단계 구조다. commit SHA가 필요할 때는 `^{}`로 껍질을 벗긴다.

```bash
# tag 오브젝트 SHA
git rev-parse v1.0.0
# ttt999fff...

# tag가 가리키는 commit SHA
git rev-parse v1.0.0^{}
# abc123def...

# 직접 조회
git cat-file -t v1.0.0       # tag
git cat-file -t v1.0.0^{}    # commit

# tree SHA
git rev-parse v1.0.0^{tree}
```

![Tag 오브젝트 명령](/assets/posts/git-tag-object-commands.svg)

## GPG 서명 포함 태그

```bash
# GPG 키가 설정되어 있어야 함
git config user.signingkey <KEY_ID>

# 서명 포함 annotated tag
git tag -s v1.0.0 -m "Signed release"

# 서명 검증
git tag -v v1.0.0
# object abc123def...
# type commit
# gpg: Good signature from "Alice <alice@example.com>"
```

`-s`로 만든 태그는 메시지 뒤에 PGP 서명 블록이 포함된다. 저장소를 clone하는 누구나 `git tag -v`로 서명을 검증할 수 있어 릴리스 무결성을 보장한다.

## tag 오브젝트가 commit 외 다른 타입을 가리킬 때

드물지만 tag 오브젝트가 blob, tree, 다른 tag를 가리키도록 만들 수도 있다.

```bash
# 특정 blob에 태그
BLOB=$(git hash-object -w README.md)
git tag -a tagged-readme $BLOB -m "Tag a specific blob"

# 확인
git cat-file -p tagged-readme
# object ...
# type blob
```

실무에서 대부분의 annotated tag는 commit을 가리키지만, 내부 구조상 어떤 타입도 가리킬 수 있다는 점이 유연성을 제공한다.

다음 글에서는 Git이 오브젝트를 식별하는 데 사용하는 **SHA-1과 SHA-256 해시 알고리즘**의 차이와 마이그레이션 경로를 살펴본다.

---

**지난 글:** [Git Commit 오브젝트: 커밋 내부 구조](/posts/git-commit-object/)

**다음 글:** [Git SHA-1 vs SHA-256: 해시 알고리즘 전환](/posts/git-sha1-vs-sha256/)

<br>
읽어주셔서 감사합니다. 😊
