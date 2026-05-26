---
title: "SSH vs HTTPS: Git 원격 인증 프로토콜 선택 가이드"
description: "Git 원격 접속에 사용하는 SSH와 HTTPS 프로토콜의 인증 방식·포트·보안·편의성 차이를 비교하고, 상황별 선택 기준과 URL 전환 방법, 기업 방화벽 환경에서 SSH over HTTPS로 우회하는 방법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 3
type: "knowledge"
category: "Git"
tags: ["Git", "SSH", "HTTPS", "인증", "PAT", "원격", "방화벽"]
featured: false
draft: false
---

[지난 글](/posts/git-ssh-keys-setup/)에서 SSH 키를 생성하고 GitHub에 등록하는 방법을 살펴봤다. 이번에는 SSH와 HTTPS 두 프로토콜 중 어떤 상황에서 무엇을 선택해야 하는지 비교한다.

## 두 프로토콜의 차이

Git 원격 레포에 접속할 때 두 가지 URL 형식을 사용할 수 있다.

```bash
# SSH URL
git@github.com:alice/repo.git

# HTTPS URL
https://github.com/alice/repo.git
```

URL 형식이 다른 만큼, 인증 방식과 동작 방식도 다르다.

![SSH vs HTTPS 비교](/assets/posts/git-ssh-vs-https-compare.svg)

## SSH의 작동 원리

SSH 방식은 비밀 키(로컬)와 공개 키(서버)의 **비대칭 암호화**로 인증한다. 로컬의 `~/.ssh/id_ed25519`(비밀 키)가 서버의 `authorized_keys`(공개 키)와 수학적으로 대응할 때만 연결이 허용된다. 패스워드가 전혀 오가지 않는다.

장점:

- 비밀번호·토큰 입력 불필요 → 자동화에 적합
- SSH 에이전트 활용으로 passphrase도 한 번만 입력
- 포트 22를 사용해 암호화 연결

단점:

- 초기 키 생성·등록 과정 필요
- 일부 기업 방화벽에서 포트 22 차단

## HTTPS의 작동 원리

HTTPS 방식은 `username`과 `password`(현재는 PAT — Personal Access Token)로 인증한다. GitHub은 2021년 8월부터 HTTPS 패스워드 인증을 중단했다. 이후에는 반드시 PAT를 사용해야 한다.

장점:

- 별도 설정 없이 즉시 사용 가능
- 포트 443(HTTPS)을 사용해 방화벽 차단 드묾
- git credential helper로 자동 저장 가능

단점:

- PAT 만료 시 재발급 필요
- 토큰 유출 시 해당 권한 모두 노출

## 상황별 선택 기준

| 상황 | 추천 프로토콜 |
|------|------|
| 개인 PC, 빈번한 push | SSH |
| CI/CD 자동화, GitHub Actions | SSH (deploy key 또는 PAT+HTTPS) |
| 기업 VPN·방화벽 환경 | HTTPS 또는 SSH over HTTPS |
| 일회성 public 레포 clone | HTTPS |
| 서명(sign) 병행 | SSH (GPG 없이도 서명 가능) |

## Remote URL 전환

기존 레포의 프로토콜을 바꾸려면 `remote set-url`을 사용한다.

![Remote URL 전환](/assets/posts/git-ssh-vs-https-switch.svg)

```bash
# 현재 URL 확인
git remote -v

# HTTPS → SSH
git remote set-url origin git@github.com:alice/repo.git

# SSH → HTTPS
git remote set-url origin https://github.com/alice/repo.git

# 변경 후 확인
git remote -v
```

## 방화벽 환경: SSH over HTTPS

기업 방화벽이 포트 22를 막고 있다면, GitHub은 포트 443으로 SSH 연결을 지원한다.

```text
# ~/.ssh/config
Host github.com
    HostName ssh.github.com
    User git
    Port 443
    IdentityFile ~/.ssh/id_ed25519
```

설정 후 테스트:

```bash
ssh -T git@github.com
# Hi alice! You've successfully authenticated...
```

기존 SSH URL을 그대로 유지하면서 포트만 443으로 우회하므로, 레포 URL이나 워크플로를 변경할 필요가 없다.

## PAT 관리 팁

HTTPS를 사용한다면 PAT를 올바르게 관리해야 한다.

```bash
# Git credential helper로 PAT 저장 (macOS Keychain)
git config --global credential.helper osxkeychain

# Linux
git config --global credential.helper store    # 평문 저장 (주의)
git config --global credential.helper cache    # 메모리 캐시 (15분 기본)
```

PAT는 최소 권한 원칙에 따라 `repo` 스코프만 부여하고, 만료일을 설정해 정기적으로 교체하는 것이 좋다. 다음 글에서 credential 저장 방식을 더 자세히 다룬다.

---

**지난 글:** [SSH 키 생성과 GitHub 등록](/posts/git-ssh-keys-setup/)

**다음 글:** [Git Credential Helper: 인증 정보 저장](/posts/git-credential-storage/)

<br>
읽어주셔서 감사합니다. 😊
