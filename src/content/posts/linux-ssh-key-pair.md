---
title: "SSH 키 쌍 생성과 관리"
description: "공개키 인증의 원리를 이해하고 ssh-keygen으로 ed25519/RSA 키를 생성하며, ssh-copy-id로 서버에 배포하고 권한을 올바르게 설정하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 8
type: "knowledge"
category: "Linux"
tags: ["SSH", "ssh-keygen", "공개키인증", "Linux", "보안"]
featured: false
draft: false
---

[지난 글](/posts/linux-jq-yq/)에서 jq와 yq로 JSON과 YAML을 처리하는 방법을 살펴봤습니다. 이번 글부터는 SSH 시리즈를 시작합니다. SSH(Secure Shell)는 원격 서버를 안전하게 관리하는 핵심 프로토콜입니다. 이번 글에서는 공개키 인증의 원리와 ssh-keygen으로 키를 생성·관리하는 방법을 다룹니다.

![SSH 키 쌍 구조와 인증 흐름](/assets/posts/linux-ssh-key-pair-overview.svg)

## 왜 공개키 인증인가

비밀번호 인증은 매번 입력이 필요하고, 브루트포스 공격에 노출됩니다. 공개키 인증은 수학적으로 연결된 키 쌍을 사용해 비밀번호 없이 안전하게 인증합니다.

인증 과정은 다음과 같습니다.

1. 클라이언트가 서버에 연결 시도
2. 서버가 난수(챌린지)를 생성해 클라이언트에 전송
3. 클라이언트가 **개인키**로 챌린지에 서명해 응답
4. 서버가 `~/.ssh/authorized_keys`의 **공개키**로 서명을 검증
5. 검증 성공 시 접속 허용

개인키는 클라이언트에서만 사용하고, 공개키만 서버에 등록합니다. 공개키가 유출되더라도 개인키 없이는 인증할 수 없습니다.

---

## ssh-keygen — 키 생성

### ed25519 키 생성 (권장)

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

실행하면 파일 경로(기본 `~/.ssh/id_ed25519`)와 패스프레이즈를 묻습니다. 패스프레이즈는 개인키를 암호화해 파일이 탈취되더라도 보호합니다.

생성되는 파일:
- `~/.ssh/id_ed25519` — 개인키 (절대 공개 금지)
- `~/.ssh/id_ed25519.pub` — 공개키 (서버에 등록)

### RSA 키 (구형 서버 호환)

```bash
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

ed25519를 지원하지 않는 구형 OpenSSH나 네트워크 장비와 연동할 때 사용합니다. 4096비트 미만은 권장하지 않습니다.

### 용도별 키 분리

```bash
# GitHub용 키
ssh-keygen -t ed25519 -f ~/.ssh/github -C "github"

# 배포 자동화용 키 (패스프레이즈 없음)
ssh-keygen -t ed25519 -f ~/.ssh/deploy -N "" -C "deploy"
```

`-N ""`는 패스프레이즈를 비워 자동화 스크립트에서 사용할 수 있게 합니다. 단, 키 파일 자체의 보안이 중요합니다.

---

## 공개키 서버에 배포

### ssh-copy-id 사용 (권장)

```bash
ssh-copy-id -i ~/.ssh/id_ed25519.pub user@server
```

비밀번호로 한 번 인증한 후 공개키를 서버의 `~/.ssh/authorized_keys`에 자동으로 추가합니다.

### 수동 배포

```bash
# 방법 1: 파이프로 직접 추가
cat ~/.ssh/id_ed25519.pub | ssh user@server \
  "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"

# 방법 2: 클립보드로 복사 후 서버에서 직접 추가
cat ~/.ssh/id_ed25519.pub
# → ssh-ed25519 AAAA... your_email
# 서버에서: echo "위 내용" >> ~/.ssh/authorized_keys
```

![ssh-keygen 실전 패턴](/assets/posts/linux-ssh-key-pair-code.svg)

---

## 권한 설정 (필수)

SSH는 파일 권한이 너무 열려 있으면 키를 무시합니다.

```bash
# .ssh 디렉터리
chmod 700 ~/.ssh

# 개인키
chmod 600 ~/.ssh/id_ed25519

# 공개키 (선택, 보통 644도 무방)
chmod 644 ~/.ssh/id_ed25519.pub

# authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

권한이 잘못돼 SSH 접속이 실패할 때 서버 로그에서 확인할 수 있습니다.

```bash
# 서버 SSH 로그 확인
sudo journalctl -u sshd -n 20 --no-pager
# 또는
sudo tail -20 /var/log/auth.log
```

---

## 키 관리

### 핑거프린트 확인

```bash
# SHA256 핑거프린트 (기본)
ssh-keygen -lf ~/.ssh/id_ed25519.pub

# MD5 핑거프린트 (구형 시스템 비교용)
ssh-keygen -lf ~/.ssh/id_ed25519.pub -E md5
```

서버에 등록된 키와 로컬 키가 같은지 확인할 때 사용합니다.

### 패스프레이즈 변경

```bash
ssh-keygen -p -f ~/.ssh/id_ed25519
```

### 공개키 재생성 (개인키에서)

개인키만 있고 공개키 파일이 없어진 경우:

```bash
ssh-keygen -y -f ~/.ssh/id_ed25519 > ~/.ssh/id_ed25519.pub
```

### known_hosts 관리

첫 접속 시 서버 호스트 키가 `~/.ssh/known_hosts`에 저장됩니다.

```bash
# 특정 호스트 키 삭제 (호스트 재설치 후)
ssh-keygen -R hostname
ssh-keygen -R "192.168.1.100"
```

---

## 보안 모범 사례

**반드시 지킬 것:**
- 개인키를 이메일, 메신저, 코드 저장소에 절대 올리지 않는다
- 패스프레이즈를 설정해 개인키를 암호화한다 (자동화 예외 제외)
- 용도별로 키를 분리해 키 탈취 시 영향 범위를 최소화한다

**서버 측 설정 권장:**
```bash
# /etc/ssh/sshd_config에 추가
PasswordAuthentication no     # 비밀번호 인증 비활성화
PermitRootLogin prohibit-password  # 루트 비밀번호 로그인 금지
```

## 정리

| 명령어 | 역할 |
|--------|------|
| `ssh-keygen -t ed25519` | ed25519 키 생성 |
| `ssh-keygen -t rsa -b 4096` | RSA 4096 키 생성 |
| `ssh-copy-id user@host` | 서버에 공개키 배포 |
| `ssh-keygen -lf key.pub` | 핑거프린트 확인 |
| `ssh-keygen -p -f key` | 패스프레이즈 변경 |
| `ssh-keygen -R host` | known_hosts 항목 삭제 |

---

**지난 글:** [jq · yq — JSON/YAML 커맨드라인 처리](/posts/linux-jq-yq/)

**다음 글:** [SSH config 파일 — 접속 설정 관리](/posts/linux-ssh-config/)

<br>
읽어주셔서 감사합니다. 😊
