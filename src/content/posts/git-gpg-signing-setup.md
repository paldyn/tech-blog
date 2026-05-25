---
title: "Git GPG 서명 설정: 커밋 신원 보증하기"
description: "GPG 키 생성부터 git config user.signingkey 등록, GitHub 공개키 업로드, commit.gpgsign 자동 서명 설정, SSH 키로 대체하는 방법까지 Git 서명 환경을 처음부터 구성하는 방법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-26"
archiveOrder: 8
type: "knowledge"
category: "Git"
tags: ["Git", "GPG", "서명", "보안", "commit-signing", "SSH서명", "GitHub"]
featured: false
draft: false
---

[지난 글](/posts/git-plumbing-vs-porcelain/)에서 Git 명령어의 Plumbing/Porcelain 계층을 살펴봤다. 이번에는 커밋 서명을 위한 기반 설정을 다룬다. Git 커밋은 기본적으로 누구나 임의의 이름·이메일로 작성할 수 있어 신원 위조가 가능하다. 서명은 이를 방지하고 "이 커밋은 정말 내가 만든 것"임을 암호학적으로 증명한다.

## 서명이 필요한 이유

`git config user.email` 값은 Git이 검증하지 않는다. 누군가 여러분의 이메일로 `user.email`을 설정하고 커밋을 만들어도 Git은 구분하지 못한다. GPG(또는 SSH) 서명을 사용하면:

- 커밋 내용 + 서명자 공개키로 서명 검증이 가능해진다
- GitHub에서 "Verified" 배지를 표시한다
- CI/CD에서 서명된 커밋만 배포를 허용하는 정책을 구현할 수 있다

## GPG 키 생성

GPG가 설치되어 있지 않으면 먼저 설치한다.

```bash
# macOS
brew install gnupg

# Ubuntu/Debian
sudo apt install gnupg

# 버전 확인
gpg --version
```

키 생성은 대화형으로 진행된다.

```bash
gpg --full-generate-key
# 키 종류: RSA and RSA (기본값)
# 키 크기: 4096 (보안상 4096 권장)
# 만료일: 0 (만료 없음) 또는 2y (2년)
# 이름과 이메일: Git user.name, user.email과 일치시킬 것
# 암호문: 강력한 패스프레이즈 입력
```

## 키 ID 확인

```bash
gpg --list-secret-keys --keyid-format LONG
# /home/alice/.gnupg/secring.gpg
# sec   rsa4096/3AA5C34371567BD2 2024-01-01 [SC]
#       ABCDEF1234567890ABCDEF123AA5C34371567BD2
# uid   Alice <alice@example.com>
# ssb   rsa4096/42B317FD4BA89E7A 2024-01-01 [E]
```

`sec` 행의 `/` 뒤에 오는 16자리가 **키 ID**다. 위 예시에서는 `3AA5C34371567BD2`.

## Git에 서명 키 등록

![GPG 설정 흐름](/assets/posts/git-gpg-signing-setup-flow.svg)

```bash
# 서명 키 등록
git config --global user.signingkey 3AA5C34371567BD2

# 모든 커밋을 자동 서명 (권장)
git config --global commit.gpgsign true

# 태그도 자동 서명
git config --global tag.gpgsign true

# 설정 확인
git config --global --list | grep sign
```

이 설정 후 `git commit`을 실행하면 자동으로 GPG 서명이 추가된다. 서명 시 패스프레이즈를 입력해야 한다. gpg-agent를 사용하면 세션 중 한 번만 입력해도 된다.

## GitHub에 공개키 등록

서명 검증을 위해 공개키를 GitHub에 등록해야 한다.

```bash
# 공개키 내보내기
gpg --armor --export 3AA5C34371567BD2
# -----BEGIN PGP PUBLIC KEY BLOCK-----
# ...
# -----END PGP PUBLIC KEY BLOCK-----
```

이 출력을 복사해 GitHub > Settings > SSH and GPG keys > New GPG key에 붙여넣는다. 이후 해당 키로 서명된 커밋에 "Verified" 배지가 붙는다.

## gpg-agent 설정 (패스프레이즈 캐시)

매 커밋마다 패스프레이즈를 입력하면 불편하다. `gpg-agent`로 일정 시간 캐시할 수 있다.

```bash
# gpg-agent 설정 파일 (~/.gnupg/gpg-agent.conf)
echo "default-cache-ttl 3600" >> ~/.gnupg/gpg-agent.conf
echo "max-cache-ttl 86400" >> ~/.gnupg/gpg-agent.conf

# gpg-agent 재시작
gpgconf --kill gpg-agent
gpgconf --launch gpg-agent
```

macOS에서는 Pinentry Mac을 설치해 키체인과 연동하면 더 편리하다.

```bash
brew install pinentry-mac
echo "pinentry-program $(which pinentry-mac)" >> ~/.gnupg/gpg-agent.conf
```

## SSH 키로 서명하기 (Git 2.34+)

GPG 대신 이미 보유한 SSH 키로 커밋에 서명하는 방법도 있다. 설정이 훨씬 간단하다.

![SSH 서명 설정](/assets/posts/git-gpg-signing-setup-alt.svg)

```bash
# SSH 서명으로 전환
git config --global gpg.format ssh

# 서명에 사용할 SSH 공개키 경로
git config --global user.signingkey ~/.ssh/id_ed25519.pub

# 자동 서명 활성화
git config --global commit.gpgsign true

# 검증용 allowed_signers 파일 작성
echo "alice@example.com $(cat ~/.ssh/id_ed25519.pub)" \
  >> ~/.ssh/allowed_signers
git config --global gpg.ssh.allowedSignersFile ~/.ssh/allowed_signers
```

GitHub에서도 SSH 서명 키를 별도로 등록하면 "Verified" 배지가 붙는다 (Settings > SSH and GPG keys > New signing key).

## 문제 해결

```bash
# GPG 에이전트 상태 확인
gpg-agent --daemon

# 서명에 사용할 GPG 프로그램 명시 (일부 환경에서 필요)
git config --global gpg.program gpg2

# macOS에서 TTY 오류 시
export GPG_TTY=$(tty)
echo 'export GPG_TTY=$(tty)' >> ~/.zshrc

# 서명 테스트 (실제 커밋 없이)
echo "test" | gpg --clearsign
```

---

**지난 글:** [Git Plumbing vs Porcelain: 명령어 계층 이해하기](/posts/git-plumbing-vs-porcelain/)

**다음 글:** [git commit -S: 커밋에 GPG/SSH 서명 추가하기](/posts/git-sign-commits/)

<br>
읽어주셔서 감사합니다. 😊
