---
title: "자격 증명 헬퍼로 인증 자동화하기"
description: "git credential helper의 종류(cache, store, osxkeychain, wincred)와 GitHub Personal Access Token 설정 방법을 다룬다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "credential", "credential helper", "인증", "PAT", "토큰", "GitHub"]
featured: false
draft: false
---

[지난 글](/posts/git-pr-flow-basics/)에서 Pull Request 흐름을 다뤘다. HTTPS로 GitHub에 push하거나 fetch할 때마다 사용자 이름과 비밀번호(또는 토큰)를 입력해야 한다면 매우 불편하다. **Credential Helper**는 자격 증명을 안전하게 저장해두고 Git이 필요할 때 자동으로 제공하도록 도와주는 도구다.

## Credential Helper가 없으면 생기는 일

HTTPS를 사용하는데 credential helper가 설정되어 있지 않으면, `git push`나 `git fetch`를 실행할 때마다 사용자 이름과 패스워드(PAT)를 직접 입력해야 한다. CI 환경이라면 환경 변수로 해결할 수 있지만, 로컬 개발 환경에서는 credential helper 설정이 필수적이다.

## Credential Helper 종류

![Credential Helper 동작 흐름](/assets/posts/git-credential-helper-flow.svg)

**cache**: 자격 증명을 메모리에 일정 시간 보관한다. 재부팅하면 사라진다.

```bash
# 15분(900초) 동안 캐시
git config --global credential.helper 'cache --timeout=900'
```

**store**: `~/.git-credentials` 평문 파일에 저장한다. 편리하지만 파일을 읽을 수 있는 누구나 토큰을 볼 수 있어 보안상 권장하지 않는다.

**osxkeychain** (macOS): macOS 키체인 앱에 암호화하여 저장한다. macOS에서 가장 권장하는 방법이다.

**wincred** / **manager** (Windows): Windows 자격 증명 관리자에 저장한다. Git for Windows를 설치하면 `manager`가 기본값이다.

## GitHub Personal Access Token (PAT) 설정

2021년부터 GitHub는 HTTPS 인증 시 비밀번호 대신 **Personal Access Token(PAT)**을 사용하도록 요구한다.

```
GitHub → Settings → Developer settings
→ Personal access tokens → Tokens (classic)
→ Generate new token
```

필요한 권한: `repo`(비공개 저장소 접근), `workflow`(Actions 관련) 정도면 일반적인 개발에 충분하다. 토큰을 발급받으면 비밀번호 입력란에 토큰을 붙여넣으면 된다.

## 플랫폼별 헬퍼 설정

![플랫폼별 자격 증명 설정](/assets/posts/git-credential-helper-types.svg)

macOS에서는 `osxkeychain`이 Git에 포함되어 있어 별도 설치 없이 바로 사용 가능하다.

```bash
# macOS
git config --global credential.helper osxkeychain

# Windows
git config --global credential.helper wincred
```

Linux에서는 `gnome-libsecret`이나 `git-credential-libsecret`을 사용할 수 있다. 설치 전이라면 `cache`로 임시 운영하고, 설정 후 교체하는 것이 실용적이다.

## GitHub CLI를 이용한 편리한 인증

GitHub CLI(`gh`)를 사용하면 credential helper 설정까지 자동화된다.

```bash
# gh 설치 후 로그인
gh auth login

# 선택: GitHub.com, HTTPS, 토큰 또는 브라우저 인증
# → credential helper가 자동으로 설정됨
```

`gh auth login`을 사용하면 브라우저 인증 흐름을 통해 토큰 발급과 저장을 한 번에 처리할 수 있다. GitHub를 주로 사용한다면 이 방법이 가장 간편하다.

## 저장된 자격 증명 삭제

토큰이 만료되거나 계정을 바꿔야 할 때는 저장된 자격 증명을 지워야 한다.

```bash
# 특정 URL의 자격 증명 삭제
echo "protocol=https
host=github.com" | git credential reject

# macOS: 키체인 앱에서 "github.com" 항목 검색 후 직접 삭제 가능
```

삭제 후 다음 push/fetch 시 자격 증명을 다시 입력하면 헬퍼가 새로 저장한다.

## SSH로 전환하는 대안

credential helper 대신 SSH 키 인증으로 전환하면 토큰 관리 부담이 없다.

```bash
# SSH 키 생성
ssh-keygen -t ed25519 -C "your@email.com"

# 공개 키를 GitHub에 등록
cat ~/.ssh/id_ed25519.pub
# → GitHub Settings → SSH and GPG keys → New SSH key

# 원격 URL을 SSH로 변경
git remote set-url origin git@github.com:myname/repo.git
```

SSH를 쓰면 `git push`마다 인증이 필요 없고, `ssh-agent`로 키 비밀번호도 한 번만 입력하면 된다. SSH vs HTTPS에 대해서는 이후 글에서 더 자세히 다룬다.

## 정리

HTTPS 인증에는 credential helper가 필수다. macOS라면 `osxkeychain`, Windows라면 `wincred` 또는 `manager`를 사용하고, GitHub CLI를 쓴다면 `gh auth login` 하나로 설정이 끝난다. 보안 측면에서 평문 `store`는 피하고, OS 키체인이나 SSH 키 인증을 선택한다.

---

**지난 글:** [Pull Request 기본 흐름](/posts/git-pr-flow-basics/)

**다음 글:** [Git 태그의 두 종류: Lightweight vs Annotated](/posts/git-tag-types/)

<br>
읽어주셔서 감사합니다. 😊
