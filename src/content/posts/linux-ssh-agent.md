---
title: "ssh-agent — 키 패스프레이즈 캐싱"
description: "ssh-agent의 동작 원리를 이해하고, ssh-add로 키를 로드해 패스프레이즈 없이 SSH 인증을 자동화하며, bashrc·ssh config와 통합하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["SSH", "ssh-agent", "ssh-add", "Linux", "보안", "자동화"]
featured: false
draft: false
---

[지난 글](/posts/linux-ssh-config/)에서 `~/.ssh/config` 파일로 SSH 접속 설정을 관리하는 방법을 살펴봤습니다. 패스프레이즈로 보호된 키를 쓰면 접속할 때마다 입력해야 합니다. `ssh-agent`는 패스프레이즈를 한 번만 입력받은 뒤 그 세션 동안 자동으로 인증해줍니다.

![ssh-agent 동작 원리](/assets/posts/linux-ssh-agent-overview.svg)

## ssh-agent란

`ssh-agent`는 백그라운드에서 실행되며, 복호화된 개인키를 메모리에 보관합니다. SSH 클라이언트는 개인키에 직접 접근하지 않고 agent에 서명을 위임합니다. 개인키는 메모리에만 존재하고 디스크에 복호화 상태로 쓰이지 않으므로 안전합니다.

---

## agent 시작하기

```bash
# agent 시작 및 환경변수 설정
eval "$(ssh-agent -s)"
# → Agent pid 12345
```

`ssh-agent -s`는 환경변수를 출력하는 셸 명령어를 출력합니다. `eval`로 실행하면 `SSH_AUTH_SOCK`와 `SSH_AGENT_PID`가 현재 셸에 설정됩니다.

```bash
# 설정된 환경변수 확인
echo $SSH_AUTH_SOCK
# → /tmp/ssh-XxXxXx/agent.12345
```

`SSH_AUTH_SOCK`은 Unix 소켓 경로입니다. SSH 클라이언트는 이 경로를 통해 agent와 통신합니다.

---

## ssh-add — 키 로드

```bash
# 기본 키 추가 (패스프레이즈 입력 후 캐시)
ssh-add ~/.ssh/id_ed25519

# 여러 키 동시 추가
ssh-add ~/.ssh/id_ed25519 ~/.ssh/github ~/.ssh/work_key

# 유효기간 설정 (3600초 = 1시간 후 자동 제거)
ssh-add -t 3600 ~/.ssh/id_ed25519
```

### 키 목록 확인

```bash
# 현재 agent에 로드된 키 목록 (핑거프린트)
ssh-add -l

# 공개키 전체 내용 출력
ssh-add -L
```

### 키 제거

```bash
# 특정 키 제거
ssh-add -d ~/.ssh/id_ed25519

# 모든 키 제거
ssh-add -D
```

---

## ~/.bashrc / ~/.zshrc 통합

매번 `eval "$(ssh-agent -s)"`와 `ssh-add`를 실행하는 번거로움을 줄이려면 셸 설정 파일에 자동화 코드를 추가합니다.

```bash
# ~/.bashrc 또는 ~/.zshrc에 추가
if ! ssh-add -l > /dev/null 2>&1; then
    eval "$(ssh-agent -s)" > /dev/null
    ssh-add ~/.ssh/id_ed25519 2>/dev/null
fi
```

셸을 열 때 agent가 실행 중이지 않거나 키가 없으면 자동으로 시작하고 키를 추가합니다.

![ssh-agent 실전 코드 패턴](/assets/posts/linux-ssh-agent-code.svg)

---

## ~/.ssh/config와 통합

`AddKeysToAgent yes`를 설정하면 처음 키를 사용할 때 자동으로 agent에 추가됩니다. 별도로 `ssh-add`를 실행할 필요가 없습니다.

```
Host *
    AddKeysToAgent yes
```

---

## macOS Keychain 통합

macOS에서는 Keychain에 패스프레이즈를 저장해 재부팅 후에도 자동으로 키를 로드할 수 있습니다.

```bash
# Keychain에 패스프레이즈 저장
ssh-add --apple-use-keychain ~/.ssh/id_ed25519

# ~/.ssh/config에 추가
Host *
    AddKeysToAgent yes
    UseKeychain yes
```

---

## systemd로 agent 자동 시작 (Linux)

데스크탑 환경에서는 systemd user 서비스로 agent를 자동 시작할 수 있습니다.

```bash
# ~/.config/systemd/user/ssh-agent.service
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/ssh-agent.service <<'EOF'
[Unit]
Description=SSH key agent

[Service]
Type=simple
Environment=SSH_AUTH_SOCK=%t/ssh-agent.socket
ExecStart=/usr/bin/ssh-agent -D -a $SSH_AUTH_SOCK

[Install]
WantedBy=default.target
EOF

# 서비스 활성화
systemctl --user enable --now ssh-agent
echo 'export SSH_AUTH_SOCK="$XDG_RUNTIME_DIR/ssh-agent.socket"' >> ~/.bashrc
```

---

## agent 포워딩

`-A` 옵션 또는 `ForwardAgent yes` 설정으로 원격 서버에서 로컬 agent를 사용할 수 있습니다.

```bash
ssh -A user@bastion
# bastion에서 또 다른 서버로 접속 시 로컬 키 사용
```

**주의:** `ForwardAgent yes`는 서버가 침해된 경우 공격자가 agent 소켓을 통해 다른 서버에 접근할 수 있습니다. 신뢰하는 서버에만 사용하세요. 민감한 환경에서는 ProxyJump를 대신 사용합니다.

---

## 정리

| 명령어 | 역할 |
|--------|------|
| `eval "$(ssh-agent -s)"` | agent 시작 + 환경변수 설정 |
| `ssh-add ~/.ssh/id_ed25519` | 키 로드 (패스프레이즈 1회 입력) |
| `ssh-add -t 3600 key` | 1시간 유효기간으로 로드 |
| `ssh-add -l` | 로드된 키 목록 |
| `ssh-add -D` | 모든 키 제거 |
| `AddKeysToAgent yes` | config에서 자동 로드 |

---

**지난 글:** [SSH config 파일 — 접속 설정 관리](/posts/linux-ssh-config/)

<br>
읽어주셔서 감사합니다. 😊
