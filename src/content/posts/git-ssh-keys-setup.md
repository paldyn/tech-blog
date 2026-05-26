---
title: "SSH 키 생성과 GitHub 등록: 비밀번호 없이 인증하기"
description: "ssh-keygen으로 ed25519 키 쌍을 생성하고 ssh-agent에 등록한 뒤 GitHub에 공개 키를 추가하는 전체 과정, ~/.ssh/config로 개인/회사 계정을 분리하는 멀티 계정 설정까지 단계별로 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 2
type: "knowledge"
category: "Git"
tags: ["Git", "SSH", "ssh-keygen", "ed25519", "GitHub", "인증", "멀티계정"]
featured: false
draft: false
---

[지난 글](/posts/git-verify-signature/)에서 서명 검증을 다뤘다. 이번에는 Git 원격 인증의 핵심인 **SSH 키 설정**을 처음부터 끝까지 살펴본다. HTTPS 방식보다 훨씬 편리하고 보안도 강하다.

## 왜 SSH인가

HTTPS는 매번 username·password(또는 토큰)를 입력해야 한다. SSH는 **공개 키 암호화**를 이용해 한 번 설정해 두면 비밀번호 없이 자동으로 인증된다. ed25519 알고리즘은 RSA-4096보다 키가 작고 서명 속도도 빠르다.

## 1단계: SSH 키 생성

```bash
# ed25519 키 생성 (권장 — RSA보다 짧고 강력)
ssh-keygen -t ed25519 -C "alice@example.com"

# RSA 대안 (레거시 시스템 호환용)
ssh-keygen -t rsa -b 4096 -C "alice@example.com"
```

프롬프트에서 저장 경로(`~/.ssh/id_ed25519`)와 passphrase를 입력한다. Passphrase는 비워도 동작하지만, 키 파일이 유출될 경우를 대비해 설정하는 것이 좋다. 생성 후 `~/.ssh/id_ed25519`(비밀 키)와 `~/.ssh/id_ed25519.pub`(공개 키) 두 파일이 만들어진다.

![SSH 키 설정 흐름](/assets/posts/git-ssh-keys-setup-flow.svg)

## 2단계: ssh-agent에 키 등록

ssh-agent는 passphrase를 메모리에 캐시해 주는 데몬이다. 한 번 인증하면 세션 동안 재입력이 필요 없다.

```bash
# ssh-agent 시작 (셸 세션마다 필요)
eval "$(ssh-agent -s)"

# 키 추가
ssh-add ~/.ssh/id_ed25519

# macOS는 Keychain에 저장 가능
ssh-add --apple-use-keychain ~/.ssh/id_ed25519
```

macOS에서 재부팅 후에도 자동 로드하려면 `~/.ssh/config`에 `UseKeychain yes`와 `AddKeysToAgent yes`를 추가한다.

## 3단계: GitHub에 공개 키 등록

공개 키를 클립보드에 복사한다.

```bash
# 공개 키 출력
cat ~/.ssh/id_ed25519.pub

# macOS
pbcopy < ~/.ssh/id_ed25519.pub

# Linux (xclip 설치 필요)
xclip -selection clipboard < ~/.ssh/id_ed25519.pub
```

GitHub 웹사이트에서 **Settings → SSH and GPG keys → New SSH key**를 클릭하고, 위에서 복사한 공개 키를 붙여넣은 뒤 저장한다. Title은 구분하기 쉬운 이름(예: "MacBook Pro 2024")으로 입력한다.

## 4단계: 연결 테스트

```bash
ssh -T git@github.com
# Hi alice! You've successfully authenticated, but GitHub does not provide shell access.
```

이 메시지가 나오면 성공이다. `Permission denied (publickey)` 오류가 나면 아래를 확인한다.

```bash
# 디버그 모드로 연결
ssh -vT git@github.com

# ssh-agent에 키가 로드되어 있는지 확인
ssh-add -l
```

## SSH URL로 clone

```bash
# HTTPS URL 대신 SSH URL 사용
git clone git@github.com:alice/myrepo.git

# 기존 레포의 remote URL 변경
git remote set-url origin git@github.com:alice/myrepo.git
git remote -v
```

## 멀티 계정: ~/.ssh/config 설정

개인 계정과 회사 계정을 함께 사용할 때는 `~/.ssh/config`로 각 Host마다 다른 키를 지정한다.

![멀티 계정 SSH 설정](/assets/posts/git-ssh-keys-setup-config.svg)

```text
Host github-personal
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_personal
    AddKeysToAgent yes

Host github-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_work
    AddKeysToAgent yes
```

이후 clone 시 `github.com` 대신 Host alias를 사용한다.

```bash
# 개인 레포
git clone git@github-personal:alice/my-project.git

# 회사 레포
git clone git@github-work:company/internal-tool.git
```

## 키 파일 권한 설정

SSH는 키 파일의 권한이 너무 넓으면 거부한다.

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_ed25519
chmod 644 ~/.ssh/id_ed25519.pub
chmod 644 ~/.ssh/config
```

`Permissions 0644 for '~/.ssh/id_ed25519' are too open` 오류가 나오면 `chmod 600`으로 수정한다.

## 보안 체크리스트

- 비밀 키(`id_ed25519`)는 절대 공유하지 않는다
- 공개 키(`id_ed25519.pub`)만 GitHub·서버에 등록한다
- 키 파일 백업은 암호화 저장소(1Password, Bitwarden)를 사용한다
- 퇴직·기기 교체 시 GitHub에서 해당 키를 즉시 삭제한다

---

**지난 글:** [git verify-commit / verify-tag: 서명 검증하기](/posts/git-verify-signature/)

**다음 글:** [SSH vs HTTPS: 어떤 프로토콜을 선택할까](/posts/git-ssh-vs-https/)

<br>
읽어주셔서 감사합니다. 😊
