---
title: "SSH 포트 포워딩 — -L, -R, -D 완전 정복"
description: "SSH 로컬(-L)·원격(-R)·동적(-D) 포트 포워딩의 원리와 사용법, ~/.ssh/config 영구 설정, 실전 활용 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 7
type: "knowledge"
category: "Linux"
tags: ["linux", "ssh", "port-forwarding", "tunnel", "socks", "local-forward", "remote-forward", "dynamic"]
featured: false
draft: false
---

[지난 글](/posts/linux-network-namespaces/)에서 네트워크 네임스페이스로 격리된 네트워크 환경을 구성하는 방법을 살펴봤습니다. 이번에는 SSH의 강력한 기능인 **포트 포워딩(포트 터널링)**을 다룹니다. SSH 포트 포워딩은 암호화된 SSH 채널을 통해 다른 포트의 트래픽을 전달하는 기술로, VPN 없이 방화벽 우회, NAT 뒤 서버 접근, 프록시 구성 등에 활용됩니다.

## 세 가지 포워딩 방식

SSH 포트 포워딩은 트래픽 방향과 방식에 따라 세 가지로 나뉩니다.

![SSH 포트 포워딩 유형](/assets/posts/linux-ssh-port-forward-types.svg)

세 방식 모두 SSH 연결이 살아있는 동안만 터널이 유지됩니다. `-N` 플래그를 추가하면 원격 명령 실행 없이 포워딩만 합니다.

## 로컬 포워딩 (-L)

로컬 포워딩은 **내 로컬 포트에 접속하면 원격 서버가 다른 곳으로 전달**하는 방식입니다. 방화벽 뒤 내부 서비스에 접근할 때 주로 씁니다.

```
ssh -L [로컬IP:]로컬포트:목적지호스트:목적지포트 SSH서버
```

```bash
# 예시 1: 원격 DB(5432)를 로컬 5432로 포워딩
ssh -N -L 5432:localhost:5432 user@db-jump.example.com
# → 로컬에서 psql -h localhost -p 5432 로 접속 가능

# 예시 2: 내부망 웹서버를 로컬 8080으로
ssh -N -L 8080:internal-web.corp:80 user@jump.corp.com
# → 브라우저에서 http://localhost:8080 으로 접근

# 예시 3: 특정 인터페이스에만 바인딩 (보안 강화)
ssh -N -L 127.0.0.1:5432:db.internal:5432 user@jump
```

## 원격 포워딩 (-R)

원격 포워딩은 반대 방향입니다. **원격 서버의 포트에 접속하면 내 로컬로 전달**됩니다. NAT나 방화벽 뒤에 있는 로컬 서버를 외부에서 접근할 때 유용합니다.

```
ssh -R [원격IP:]원격포트:목적지호스트:목적지포트 SSH서버
```

```bash
# 예시: 로컬 개발 서버(3000)를 퍼블릭 서버의 9000으로 노출
ssh -N -R 0.0.0.0:9000:localhost:3000 user@public-server.example.com
# → public-server.example.com:9000 으로 로컬 앱에 접근 가능

# 원격에서 전체 IP 바인딩을 허용하려면 sshd_config에 설정 필요
# /etc/ssh/sshd_config
# GatewayPorts yes
```

## 다이나믹 포워딩 (-D): SOCKS5 프록시

다이나믹 포워딩은 로컬에 SOCKS5 프록시를 열어, 그 프록시를 통한 모든 트래픽을 SSH 서버를 거쳐 인터넷으로 전달합니다. 간이 VPN처럼 쓸 수 있습니다.

```bash
# 로컬 1080 포트에 SOCKS5 프록시 생성
ssh -N -D 1080 user@jump.example.com

# 백그라운드로 실행
ssh -fN -D 1080 user@jump.example.com

# curl에서 SOCKS5 프록시 사용
curl --proxy socks5h://localhost:1080 http://example.com

# 브라우저 설정: SOCKS 호스트 = localhost, 포트 = 1080
```

`socks5h`의 `h`는 DNS 해석도 원격에서 하도록 지시합니다. 로컬 DNS 누출을 방지하는 옵션입니다.

## 명령어 옵션 정리

```bash
# 자주 쓰는 SSH 포워딩 옵션
-N   # 원격 명령 실행 안 함 (포워딩 전용)
-f   # 백그라운드로 실행
-C   # 압축 활성화 (느린 링크에서 유용)
-v   # 상세 디버그 출력
-g   # 다른 호스트에서도 포워딩된 포트 접근 허용
     # (GatewayPorts 설정과 연관)

# 연결 유지 옵션 (터널 끊김 방지)
-o ServerAliveInterval=60
-o ServerAliveCountMax=3
```

## ~/.ssh/config 영구 설정

매번 긴 명령을 입력하는 대신, `~/.ssh/config`에 포워딩을 영구 설정할 수 있습니다.

```
# ~/.ssh/config
Host db-tunnel
  HostName jump.example.com
  User admin
  LocalForward 5432 db.internal:5432
  LocalForward 6379 redis.internal:6379
  ServerAliveInterval 60
  ServerAliveCountMax 3

Host expose-dev
  HostName public.example.com
  User deploy
  RemoteForward 9000 localhost:3000

Host socks-proxy
  HostName jump.example.com
  User admin
  DynamicForward 1080
  ExitOnForwardFailure yes
```

```bash
# 설정 파일에 정의된 터널 연결
ssh -N db-tunnel       # DB와 Redis 포워딩
ssh -N socks-proxy     # SOCKS 프록시 시작
```

![SSH 포트 포워딩 명령어](/assets/posts/linux-ssh-port-forward-commands.svg)

## 실전 패턴

**Jupyter Notebook 원격 접근**:
```bash
# 원격 서버에서 Jupyter 실행 (no-browser)
# 로컬에서
ssh -N -L 8888:localhost:8888 user@ml-server
# 브라우저에서 http://localhost:8888 접근
```

**여러 포워딩 동시에**:
```bash
ssh -N \
  -L 5432:db.internal:5432 \
  -L 6379:redis.internal:6379 \
  -L 9200:elastic.internal:9200 \
  user@jump.example.com
```

**포워딩 프로세스 관리**:
```bash
# 실행 중인 포워딩 SSH 프로세스 찾기
ps aux | grep 'ssh.*-[NfLD]'

# PID로 종료
kill <PID>

# 또는 이름으로
pkill -f 'ssh.*-N.*5432'
```

## JumpHost (ProxyJump)와의 조합

포워딩과 JumpHost를 조합하면 다단계 터널도 만들 수 있습니다.

```bash
# 점프 서버를 거쳐 내부 서버로 로컬 포워딩
ssh -N -J jumpuser@jump.example.com \
  -L 5432:db.internal:5432 \
  admin@bastion.internal

# config 파일로 설정
Host internal-tunnel
  HostName bastion.internal
  User admin
  ProxyJump jumpuser@jump.example.com
  LocalForward 5432 db.internal:5432
```

SSH 포트 포워딩은 네트워크 접근이 제한된 환경에서 안전하게 통신하는 가장 간단한 방법 중 하나입니다. 보안 키 기반 인증과 함께 사용하면 편의성과 보안성을 모두 확보할 수 있습니다.

---

**지난 글:** [네트워크 네임스페이스 — 격리된 네트워크 스택](/posts/linux-network-namespaces/)

**다음 글:** [rsync over SSH — 원격 파일 동기화](/posts/linux-rsync-over-ssh/)

<br>
읽어주셔서 감사합니다. 😊
