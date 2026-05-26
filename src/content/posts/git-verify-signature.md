---
title: "git verify-commit / verify-tag: 서명 검증하기"
description: "git verify-commit과 git verify-tag로 GPG·SSH 서명을 검증하는 방법, 서명 상태 코드(G/B/U/N/E)의 의미, log.showSignature 설정, GitHub Verified 뱃지와 브랜치 보호 정책까지 실무 흐름을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 1
type: "knowledge"
category: "Git"
tags: ["Git", "verify-commit", "verify-tag", "서명", "GPG", "SSH-signing", "보안"]
featured: false
draft: false
---

[지난 글](/posts/git-sign-tags/)에서 태그에 GPG·SSH 서명을 추가하는 방법을 살펴봤다. 이번에는 그 서명이 실제로 올바른지 **검증**하는 방법과, 검증 결과를 CI·브랜치 정책에 통합하는 패턴을 다룬다.

## 서명 검증 기본 명령

커밋 서명은 `git verify-commit`, 태그 서명은 `git verify-tag`로 검증한다.

```bash
# 최신 커밋 검증
git verify-commit HEAD

# 특정 커밋 SHA 검증
git verify-commit abc1234

# 상세 출력 (서명자 정보·키 지문)
git verify-commit --verbose HEAD

# 태그 검증
git verify-tag v1.0.0
git verify-tag --verbose v2.3.0
```

`--verbose` 없이 실행하면 결과만 stdout에 출력한다. GPG 서명이라면 `gpg: Good signature from "Alice <alice@example.com>"` 형태, SSH 서명이라면 `Good "git" signature for ...` 형태로 나온다.

![서명 검증 흐름](/assets/posts/git-verify-signature-flow.svg)

## 서명 검증 흐름

Git은 커밋 오브젝트의 `gpgsig` 필드에서 서명 블록을 추출하고, 서명 대상인 원본 payload(커밋 헤더·메시지)를 재구성한 뒤 로컬 keyring(GPG) 또는 `allowed_signers`(SSH)에서 공개 키를 조회해 대조한다.

검증 성공이면 `exit 0`, 실패(변조·키 없음)이면 `exit 1`을 반환한다. 스크립트에서 `if git verify-commit HEAD; then ...` 형태로 활용할 수 있다.

## 서명 상태 코드

`git log --format="%G?"` 로 각 커밋의 서명 상태를 한 글자 코드로 확인할 수 있다.

| 코드 | 의미 |
|------|------|
| `G` | Good — 유효한 서명, 신뢰하는 키 |
| `B` | Bad — 서명이 있으나 검증 실패 (데이터 변조 의심) |
| `U` | Unknown — 서명은 있지만 키를 알 수 없음 |
| `N` | None — 서명 없음 |
| `X` | 서명은 유효하나 키가 만료됨 |
| `Y` | 서명은 유효하나 키가 취소됨 |
| `E` | 에러 (키링 접근 실패 등) |

```bash
# 최근 10개 커밋의 서명 상태 일괄 확인
git log --format="%G? %GS %H %s" -10

# 서명 없는 커밋 필터링
git log --format="%G? %H" | grep '^N'

# 불량·미확인 커밋 찾기
git log --format="%G? %H %s" | grep -E '^[BUE]'
```

`%GS`는 서명자 이름·이메일, `%GK`는 서명 키 ID를 출력한다.

## log.showSignature 설정

매번 `--show-signature`를 붙이지 않고, `log` 기본 출력에 항상 서명 정보를 포함하고 싶다면 설정한다.

```bash
git config --global log.showSignature true

# 이후 git log에 자동으로 서명 정보 포함됨
git log -5
```

팀 전체 적용이 필요하다면 프로젝트 `.gitconfig`나 CI 환경에서 동일하게 설정한다.

## SSH 서명 검증 설정

SSH 서명은 GPG keyring 대신 `allowed_signers` 파일을 사용한다.

```bash
# allowed_signers 파일 경로 설정
git config --global gpg.ssh.allowedSignersFile ~/.config/git/allowed_signers

# allowed_signers 형식: "email ssh-ed25519 AAAA..."
echo "alice@example.com ssh-ed25519 AAAA..." >> ~/.config/git/allowed_signers

# 이후 verify-commit이 allowed_signers에서 키 조회
git verify-commit HEAD
```

파일을 팀 레포에 커밋해 두면 모든 구성원이 동일한 신뢰 목록을 공유할 수 있다.

## GitHub Verified 뱃지

GitHub은 커밋·태그 서명을 자체적으로 검증해 **Verified** / **Unverified** 뱃지를 표시한다. Verified 뱃지는 "GitHub 계정에 등록된 공개 키로 서명됐음"을 뜻한다.

![서명 정책 설정](/assets/posts/git-verify-signature-policy.svg)

GitHub 계정 설정에서 GPG 공개 키나 SSH 공개 키를 등록하면 이후 서명된 커밋에 자동으로 Verified 뱃지가 붙는다.

```bash
# GPG 공개 키 내보내기 (GitHub에 붙여넣기용)
gpg --armor --export alice@example.com

# SSH 서명용 키 확인
cat ~/.ssh/id_ed25519.pub
```

## 브랜치 보호: Require Signed Commits

GitHub의 Branch protection rules에서 **Require signed commits**를 활성화하면, 서명되지 않은 커밋은 push가 거부된다.

```bash
# 서명 없이 push 시도
git push origin main
# ! [remote rejected] main -> main (protected branch hook declined)
# error: unsigned commit detected
```

이 정책은 공급망 보안(supply chain security)의 핵심으로, 커밋 작성자가 실제 해당 계정임을 보장한다.

## CI에서 서명 검증 자동화

```bash
# pre-merge check: 모든 커밋에 유효 서명 요구
for sha in $(git log origin/main..HEAD --format="%H"); do
  if ! git verify-commit "$sha"; then
    echo "Unsigned or invalid commit: $sha"
    exit 1
  fi
done
```

GitHub Actions라면 `actions/checkout`에 `fetch-depth: 0`을 설정해 전체 히스토리를 가져온 뒤 위 스크립트를 실행한다.

## 핵심 정리

서명 검증은 단순히 "서명이 있다"를 확인하는 것이 아니다. `%G?` 코드로 G(유효)·B(변조)·U(키 없음)·N(미서명)을 구분하고, CI와 브랜치 보호 정책을 결합해야 실질적인 보안 효과를 낼 수 있다.

---

**지난 글:** [git tag -s: 태그에 서명 추가하기](/posts/git-sign-tags/)

**다음 글:** [SSH 키 설정과 Git 인증](/posts/git-ssh-keys-setup/)

<br>
읽어주셔서 감사합니다. 😊
