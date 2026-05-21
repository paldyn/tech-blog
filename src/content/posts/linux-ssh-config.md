---
title: "SSH config 파일 — 접속 설정 관리"
description: "~/.ssh/config 파일로 호스트 별칭, 점프 호스트, ControlMaster 설정을 구성해 SSH 접속을 단순화하는 방법을 실전 예제와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["SSH", "ssh config", "Linux", "보안", "ProxyJump"]
featured: false
draft: false
---

[지난 글](/posts/linux-ssh-key-pair/)에서 SSH 키 쌍을 생성하고 서버에 배포하는 방법을 살펴봤습니다. 키 인증을 설정했다면, 이번에는 `~/.ssh/config` 파일로 접속 설정을 체계적으로 관리하는 방법을 다룹니다. 긴 옵션을 반복 타이핑하는 대신 짧은 별칭 하나로 접속할 수 있습니다.

![SSH config 파일 구조](/assets/posts/linux-ssh-config-overview.svg)

## ~/.ssh/config 기본 구조

config 파일은 `Host` 블록으로 구성됩니다. 각 블록에 해당 호스트의 접속 옵션을 지정합니다.

```
Host <별칭>
    <지시어>  <값>
    <지시어>  <값>
```

```bash
# 파일 생성 및 권한 설정
touch ~/.ssh/config
chmod 600 ~/.ssh/config
```

권한이 너무 열려 있으면 SSH가 파일을 무시합니다. `600`(소유자만 읽기/쓰기)으로 설정해야 합니다.

---

## 기본 호스트 설정

```
Host work
    HostName     192.168.10.5
    User         admin
    Port         2222
    IdentityFile ~/.ssh/work_key
```

이제 `ssh -i ~/.ssh/work_key -p 2222 admin@192.168.10.5` 대신 `ssh work`만 입력하면 됩니다.

`scp`, `rsync`, `git` 모두 이 별칭을 그대로 사용합니다.

```bash
scp work:/etc/nginx/nginx.conf ./
rsync -av ./dist/ work:/var/www/html/
```

---

## 글로벌 기본값: Host *

```
Host *
    ServerAliveInterval  60
    ServerAliveCountMax  3
    AddKeysToAgent       yes
    IdentityFile         ~/.ssh/id_ed25519
```

`Host *`는 모든 호스트에 적용되는 기본값입니다. **파일 맨 아래에 위치**시켜야 합니다. SSH는 위에서 아래로 읽어 처음 매칭된 값을 사용하므로, `Host *`가 위에 있으면 개별 설정이 덮어써집니다.

- `ServerAliveInterval 60`: 60초마다 keepalive 패킷 전송 (연결 끊김 방지)
- `AddKeysToAgent yes`: 개인키 사용 시 자동으로 ssh-agent에 추가

---

## 점프 호스트: ProxyJump

방화벽 안의 내부 서버에 접근할 때 베스천(Bastion) 서버를 경유합니다.

```
Host bastion
    HostName     1.2.3.4
    User         ec2-user
    IdentityFile ~/.ssh/aws_key

Host internal
    HostName     10.0.1.5
    User         ubuntu
    IdentityFile ~/.ssh/aws_key
    ProxyJump    bastion
```

이제 `ssh internal`만 입력하면 자동으로 bastion을 경유합니다.

```bash
# 명령어로 직접 지정 (-J)
ssh -J bastion ubuntu@10.0.1.5

# 두 단계 점프
ssh -J bastion1,bastion2 target
```

### 구형 OpenSSH에서 ProxyCommand

OpenSSH 7.3 미만에서는 `ProxyJump` 대신 `ProxyCommand`를 사용합니다.

```
Host internal
    ProxyCommand ssh bastion -W %h:%p
```

---

## 와일드카드 패턴

```
Host dev-*
    User         ubuntu
    IdentityFile ~/.ssh/dev_key
    ForwardAgent no

Host prod-*
    User         ec2-user
    IdentityFile ~/.ssh/prod_key
```

`dev-web`, `dev-db`, `dev-worker` 등 접두사로 그룹화된 서버에 동일한 설정을 적용합니다.

![SSH config 고급 패턴](/assets/posts/linux-ssh-config-code.svg)

---

## ControlMaster: 연결 재사용

동일 서버에 여러 SSH 세션을 열 때 매번 인증하지 않고 기존 연결을 재사용합니다.

```
Host *
    ControlMaster   auto
    ControlPath     ~/.ssh/sockets/%r@%h:%p
    ControlPersist  10m
```

```bash
# 소켓 디렉터리 생성
mkdir -p ~/.ssh/sockets
```

첫 접속 시 소켓 파일이 생성되고, 이후 같은 호스트로의 SSH/SCP/rsync가 기존 연결을 재사용해 속도가 빨라집니다. `ControlPersist 10m`은 마지막 세션 종료 후 10분간 연결을 유지합니다.

---

## 주요 지시어 참조

```
Host        alias          # 별칭
HostName    1.2.3.4        # 실제 주소
User        ubuntu         # 사용자명
Port        22             # 포트
IdentityFile ~/.ssh/key    # 개인키 경로
ProxyJump   bastion        # 점프 호스트
ForwardAgent yes           # 에이전트 포워딩 (주의: 신뢰 서버만)
StrictHostKeyChecking no   # 호스트키 자동 수락 (테스트 환경)
LogLevel    DEBUG          # 디버그 로그 (문제 해결용)
```

`ForwardAgent yes`는 서버에서 또 다른 서버로 접속할 때 로컬 키를 사용할 수 있게 합니다. 단, 신뢰할 수 없는 서버에는 절대 사용하지 마세요. 서버가 침해되면 에이전트를 통해 다른 서버에 접근할 수 있습니다.

## 설정 테스트

```bash
# 설정 확인 (-G: 실제 적용될 옵션 출력)
ssh -G work

# 연결 테스트 (verbose)
ssh -v work
```

## 정리

| 지시어 | 역할 |
|--------|------|
| `Host` | 블록 시작, 별칭 또는 패턴 |
| `HostName` | 실제 IP/도메인 |
| `User` | 원격 사용자명 |
| `IdentityFile` | 개인키 경로 |
| `ProxyJump` | 점프 호스트 지정 |
| `ControlMaster auto` | 연결 재사용 활성화 |
| `ServerAliveInterval` | keepalive 주기 |

---

**지난 글:** [SSH 키 쌍 생성과 관리](/posts/linux-ssh-key-pair/)

**다음 글:** [ssh-agent — 키 패스프레이즈 캐싱](/posts/linux-ssh-agent/)

<br>
읽어주셔서 감사합니다. 😊
