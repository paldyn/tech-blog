---
title: "git tag -s: 태그에 서명 추가하기"
description: "git tag -s로 GPG/SSH 서명된 annotated 태그를 생성하는 방법, 서명 태그 오브젝트의 내부 구조, git verify-tag로 서명을 검증하는 방법, 릴리스 워크플로에서 서명 태그를 활용하는 패턴을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 10
type: "knowledge"
category: "Git"
tags: ["Git", "tag-signing", "GPG", "verify-tag", "릴리스", "보안", "annotated-tag"]
featured: false
draft: false
---

[지난 글](/posts/git-sign-commits/)에서 커밋 서명을 다뤘다. 이번에는 릴리스 무결성 보장에 핵심적인 **태그 서명**을 살펴본다. 서명된 태그는 "이 릴리스는 실제 관리자가 만든 것"임을 암호학적으로 증명한다.

## 서명 태그 생성

태그에 서명하려면 `-s` 플래그를 사용한다. 반드시 annotated 태그여야 한다(-a 포함 또는 -s만으로 자동으로 annotated).

```bash
# 서명 태그 생성 (에디터에서 메시지 입력)
git tag -s v1.0.0

# 메시지 직접 지정
git tag -s v1.0.0 -m "Release 1.0.0 - stable"

# 특정 커밋에 서명 태그
git tag -s v1.0.0 -m "Release 1.0.0" abc123def456

# 기존 태그 덮어씌기 (이미 push됐으면 주의)
git tag -s v1.0.0 -m "Release 1.0.0" -f
```

서명 키는 `user.signingkey`에 설정된 GPG 키(또는 SSH 키)가 사용된다.

## tag.gpgsign으로 자동 서명

```bash
# 모든 태그에 자동 서명
git config --global tag.gpgsign true

# 이제 -s 없이도 서명됨
git tag -a v1.0.0 -m "Release 1.0.0"

# 특정 태그만 서명 건너뜀
git tag -a v1.0.0 -m "Release" --no-sign
```

## 서명된 태그의 내부 구조

서명은 annotated 태그 오브젝트에 포함된다. 커밋 서명의 `gpgsig` 필드와 달리, 태그 서명은 태그 내용 끝에 PGP 블록이 직접 붙는다.

![서명된 태그 구조](/assets/posts/git-sign-tags-flow.svg)

```bash
# 태그 오브젝트 원시 내용 확인
git cat-file -p v1.0.0

# 출력:
# object abc123def456...
# type commit
# tag v1.0.0
# tagger Alice <alice@example.com> 1716868800 +0900
#
# Release 1.0.0 - stable
# -----BEGIN PGP SIGNATURE-----
# iQIzBAABCAAdFiEE...
# -----END PGP SIGNATURE-----
```

PGP 서명 블록은 태그 내용(object, type, tag, tagger, 메시지)을 대상으로 생성된다. 태그 내용이 바뀌면 서명이 무효가 된다.

## 서명 검증

```bash
# 단일 태그 검증
git verify-tag v1.0.0
# object abc123def456...
# type commit
# tag v1.0.0
# tagger Alice <alice@example.com>
# gpg: Good signature from "Alice <alice@example.com>"

# 태그 상세 정보 + 서명 확인
git tag -v v1.0.0
```

검증이 실패하면 exit code 1을 반환하므로 스크립트에서 활용할 수 있다.

```bash
# 스크립트에서 서명 검증
if git verify-tag v1.0.0 > /dev/null 2>&1; then
  echo "Tag v1.0.0 is valid"
else
  echo "ERROR: invalid or unsigned tag"
  exit 1
fi
```

## 릴리스 워크플로에서 서명 태그 활용

![릴리스 워크플로](/assets/posts/git-sign-tags-verify.svg)

```bash
# 릴리스 체크리스트 스크립트 예시
VERSION="v1.0.0"
COMMIT=$(git rev-parse HEAD)

# 1) 서명 태그 생성
git tag -s $VERSION -m "Release $VERSION"

# 2) 태그 push
git push origin $VERSION

# 3) 원격에서 fetch 후 검증
git fetch origin $VERSION
git verify-tag $VERSION && echo "Release $VERSION verified"

# 4) 릴리스 아카이브 생성
git archive --format=tar.gz --prefix=${VERSION}/ \
  $VERSION > ${VERSION}.tar.gz
```

## lightweight 태그에는 서명 불가

lightweight 태그는 단순히 커밋 SHA를 가리키는 ref 파일이고 별도의 태그 오브젝트가 없다. 서명이 들어갈 공간 자체가 없으므로 서명이 불가능하다.

```bash
# lightweight: 서명 없음 (ref 파일만 생성)
git tag v1.0.0-lw

# annotated: 태그 오브젝트 생성 → 서명 가능
git tag -a v1.0.0 -m "Release"
git tag -s v1.0.0 -m "Release"  # annotated + 서명
```

서명이 필요한 릴리스에는 반드시 annotated 태그를 사용해야 한다.

## fetch 시 서명 검증

원격에서 태그를 받을 때 서명을 자동으로 검증하는 옵션이 있다.

```bash
# fetch 중 서명 검증 (서명 없거나 잘못된 태그면 경고)
git fetch --verify-signatures origin

# merge 시 서명 검증
git merge --verify-signatures feature-branch
```

`--verify-signatures`는 merge 대상 커밋이나 태그에 유효한 서명이 없으면 거부한다. 서명이 강제된 팀에서 보안 게이트로 활용할 수 있다.

## 과거 태그 재서명

이미 push된 unsigned 태그를 소급해서 서명하는 경우, 태그 SHA가 바뀌므로 remote 태그를 삭제하고 재push해야 한다.

```bash
# 로컬 태그 삭제 후 재서명
git tag -d v1.0.0-old
git tag -s v1.0.0-old -m "Re-signed release" $COMMIT_SHA

# 원격 태그 삭제 후 재push
git push origin :refs/tags/v1.0.0-old  # 원격 삭제
git push origin v1.0.0-old              # 새 서명 태그 push
```

이미 배포된 태그를 바꾸면 기존에 해시를 검증하던 사용자에게 혼란을 줄 수 있으므로 공개 릴리스에서는 신중해야 한다.

---

**지난 글:** [git commit -S: 커밋에 GPG/SSH 서명 추가하기](/posts/git-sign-commits/)

<br>
읽어주셔서 감사합니다. 😊
