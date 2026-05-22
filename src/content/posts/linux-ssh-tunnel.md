---
title: "SSH 터널 — 로컬·리모트·다이나믹 포워딩 완전 정리"
description: "SSH의 세 가지 포트 포워딩 방식(Local, Remote, Dynamic)의 원리와 실무 활용 패턴, ProxyJump를 이용한 점프 호스트 구성을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["linux", "ssh", "tunnel", "port-forwarding", "local-forwarding", "remote-forwarding", "socks5", "bastion", "proxyjump"]
featured: false
draft: false
---

[지난 글](/posts/linux-scp-vs-sftp/)에서 SCP와 SFTP로 파일을 전송하는 방법을 비교했습니다. SSH는 파일 전송뿐 아니라 **임의의 TCP 트래픽을 암호화 채널로 감싸는 터널** 기능도 제공합니다. 방화벽 뒤에 있는 데이터베이스에 접근하거나, 사내 개발 서버를 외부에 임시로 노출하거나, SOCKS 프록시로 트래픽 전체를 우회할 때 SSH 포트 포워딩이 해답이 됩니다.

## 로컬 포워딩 (-L)

가장 흔히 쓰는 방식입니다. 내 로컬 포트로 들어오는 연결을 SSH 터널을 통해 원격 네트워크의 특정 호스트:포트로 전달합니다.

```bash
# 형식: ssh -L [로컬주소:]로컬포트:목적지호스트:목적지포트 user@ssh서버
ssh -L 5432:db.internal:5432 user@bastion

# 이후 로컬에서 원격 DB에 직접 접속 가능
psql -h localhost -p 5432 -U admin mydb
```

방화벽으로 외부 접근이 막힌 내부 서비스(DB, Redis, 관리 콘솔)를 로컬에서 개발할 때 필수입니다.

## 리모트 포워딩 (-R)

방향이 반대입니다. 원격 서버의 포트로 들어오는 연결을 내 로컬 서비스로 전달합니다. 공인 IP 없는 로컬 서버를 외부에 임시 노출할 때 사용합니다.

```bash
# 원격 9000번 포트 → 내 로컬 3000번 앱으로 연결
ssh -R 9000:localhost:3000 user@public-server

# 외부에서 public-server:9000 접속 시 내 로컬 앱에 도달
```

원격 서버의 `GatewayPorts yes` 설정이 있어야 외부 IP에서 해당 포트에 접근할 수 있습니다. 기본값은 `127.0.0.1`에만 바인딩됩니다.

![SSH 터널 세 가지 유형](/assets/posts/linux-ssh-tunnel-types.svg)

## 다이나믹 포워딩 (-D) — SOCKS5 프록시

로컬에 SOCKS5 프록시 서버를 만들어 브라우저나 앱의 모든 트래픽을 SSH 서버를 통해 내보냅니다.

```bash
# 로컬 1080 포트에 SOCKS5 프록시 생성
ssh -D 1080 -fNT user@remote-server

# 크롬에서 사용: --proxy-server="socks5://127.0.0.1:1080"
# curl에서 사용
curl --socks5 127.0.0.1:1080 https://example.com
```

**`-f`**: 백그라운드 실행, **`-N`**: 원격 명령 실행 없음, **`-T`**: 가상 터미널 할당 안 함. 터널 전용으로 SSH를 띄울 때 이 세 옵션을 묶어 씁니다.

## ProxyJump — 점프 호스트 경유

배스천(bastion) 호스트를 경유해 내부 서버에 접속하는 패턴입니다. 과거에는 `ProxyCommand`로 복잡하게 설정했지만 OpenSSH 7.3부터 `ProxyJump`로 간결해졌습니다.

```bash
# 커맨드라인
ssh -J bastion user@10.0.0.5

# 다단 경유 (bastion1 → bastion2 → target)
ssh -J bastion1,bastion2 user@target
```

![ProxyJump 점프 호스트 패턴](/assets/posts/linux-ssh-tunnel-jumphost.svg)

### ~/.ssh/config 영구 설정

매번 긴 옵션을 입력하지 않으려면 설정 파일에 저장합니다.

```
Host bastion
    HostName 203.0.113.1
    User ec2-user
    IdentityFile ~/.ssh/bastion_key

Host internal
    HostName 10.0.0.5
    User admin
    ProxyJump bastion
    LocalForward 5432 db.internal:5432
    ServerAliveInterval 60
    ExitOnForwardFailure yes
```

이렇게 설정하면 `ssh internal` 한 줄로 배스천을 자동 경유하고, 로컬 5432 포트로 원격 DB에도 동시에 접근할 수 있습니다.

## 터널 연결 상태 확인

```bash
# 열려 있는 터널 포트 확인
ss -tlnp | grep ssh

# 특정 터널 PID 찾기
pgrep -a ssh

# 터널 종료
kill $(pgrep -f "ssh -fNT")
```

## 보안 고려사항

SSH 터널은 강력한 만큼 남용될 여지가 있습니다. 서버에서 터널을 제한하려면 `sshd_config`에 다음을 추가합니다.

```
AllowTcpForwarding no      # 포트 포워딩 전체 비활성
PermitTunnel no            # tun 디바이스 터널 비활성
GatewayPorts no            # 리모트 포워딩을 127.0.0.1만 바인딩
```

배스천 계정처럼 터널만 허용하고 셸은 막고 싶을 때는 `ForceCommand /usr/sbin/nologin` 대신 `AllowTcpForwarding yes`만 열고 `ForceCommand echo "no shell"` 패턴을 씁니다.

---

**지난 글:** [SCP vs SFTP — SSH 기반 파일 전송 완전 비교](/posts/linux-scp-vs-sftp/)

**다음 글:** [rsync 옵션 완전 해설](/posts/linux-rsync-options/)

<br>
읽어주셔서 감사합니다. 😊
