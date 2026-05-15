---
title: "/etc/hosts — 정적 호스트 매핑"
description: "/etc/hosts 파일의 형식, DNS보다 우선하는 이름 해석 동작, 로컬 개발·광고 차단·보안 활용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["linux", "hosts", "dns", "name-resolution", "nsswitch", "etc-hosts", "loopback", "blackhole"]
featured: false
draft: false
---

[지난 글](/posts/linux-resolv-conf-systemd-resolved/)에서 `resolv.conf`와 `systemd-resolved`를 통한 DNS 해석 흐름을 살펴봤습니다. 이번에는 그보다 먼저 확인되는 **`/etc/hosts`** 파일을 다룹니다. 인터넷이 없던 초창기 ARPANET 시절부터 사용되어 온 이 파일은, 운영체제의 네임 해석 스택 최우선 순위를 차지합니다.

## /etc/hosts 파일 형식

파일 구조는 단순합니다. 한 줄에 IP 주소, 정규 호스트명, 별칭(들)을 공백/탭으로 구분합니다. `#`으로 시작하는 줄은 주석입니다.

```
IP주소     정규호스트명        [별칭1] [별칭2] ...
127.0.0.1  localhost
::1        localhost ip6-localhost ip6-loopback
127.0.1.1  myhost.example.com  myhost

192.168.1.10  db.internal      db
192.168.1.20  api.internal     api
192.168.1.30  redis.internal
```

하나의 IP에 여러 이름을 붙이거나, 여러 줄에 걸쳐 같은 IP를 반복해도 됩니다.

## 우선순위: /etc/hosts > DNS

`/etc/nsswitch.conf`의 `hosts:` 항목이 해석 순서를 결정합니다.

```bash
# 현재 설정 확인
grep hosts /etc/nsswitch.conf
# 결과 예시:
# hosts: files mdns4_minimal [NOTFOUND=return] dns myhostname
```

`files`가 `dns`보다 앞에 있으므로, `/etc/hosts`에 있는 항목은 DNS 서버를 전혀 조회하지 않고 즉시 반환됩니다. 이를 이용하면 특정 도메인을 원하는 IP로 강제로 연결할 수 있습니다.

![/etc/hosts 우선순위](/assets/posts/linux-hosts-file-priority.svg)

## 기본으로 들어있는 항목

```
127.0.0.1   localhost
127.0.1.1   <hostname>         # 호스트명→IP 매핑
::1         localhost ip6-localhost ip6-loopback
fe00::0     ip6-localnet
ff00::0     ip6-mcastprefix
ff02::1     ip6-allnodes
ff02::2     ip6-allrouters
```

`127.0.0.1 localhost` 항목이 없으면 `ping localhost`나 `curl http://localhost` 같은 명령이 DNS로 넘어가거나 실패할 수 있습니다.

## 활용 1: 로컬 개발 환경

팀 개발 시 `/etc/hosts`에 서버 별칭을 추가하면 IP를 외울 필요가 없습니다.

```bash
# /etc/hosts에 추가
sudo tee -a /etc/hosts <<EOF
192.168.1.10  db.local
192.168.1.20  api.local
192.168.1.30  redis.local
EOF
```

이후 `psql -h db.local`이나 `curl http://api.local:8080`처럼 사용할 수 있습니다.

![/etc/hosts 파일 형식과 활용](/assets/posts/linux-hosts-file-format.svg)

## 활용 2: 광고·트래커 차단 (블랙홀)

`0.0.0.0`은 연결 자체를 즉시 거부합니다. 광고 도메인을 `0.0.0.0`으로 매핑하면 DNS를 우회한 빠른 차단이 가능합니다.

```
0.0.0.0  ads.example.com
0.0.0.0  tracker.example.com
0.0.0.0  telemetry.example.com
```

[StevenBlack/hosts](https://github.com/StevenBlack/hosts) 같은 오픈소스 프로젝트가 수백만 개 광고/악성 도메인 목록을 주기적으로 업데이트해 배포합니다.

## 활용 3: 개발 중 외부 서비스 모킹

실제 외부 API 서버를 로컬 서버로 리다이렉트할 때 유용합니다.

```
127.0.0.1  api.payment-provider.com
127.0.0.1  smtp.sendgrid.com
```

단, 이 경우 TLS 인증서 검증이 실패할 수 있으므로 개발/테스트 환경에서만 사용해야 합니다.

## 활용 4: /etc/hosts 없이 테스트 (curl)

curl은 `/etc/hosts`를 수정하지 않고 특정 호스트→IP 매핑을 지정할 수 있습니다.

```bash
# curl --resolve 옵션 (hosts 파일 수정 불필요)
curl --resolve "example.com:443:203.0.113.5" \
  https://example.com/

# 여러 매핑 지정
curl --resolve "api.example.com:80:192.168.1.20" \
     --resolve "db.example.com:5432:192.168.1.10" \
  http://api.example.com/health
```

## 변경 후 캐시 초기화

`/etc/hosts`를 수정해도 일부 애플리케이션(특히 브라우저)은 자체 DNS 캐시를 가지고 있어 즉시 반영되지 않을 수 있습니다.

```bash
# systemd-resolved 캐시 플러시
resolvectl flush-caches

# nscd (Name Service Cache Daemon) 사용 시
sudo nscd --invalidate=hosts

# 브라우저: 주소창에 chrome://net-internals/#dns 입력 후 Clear host cache
```

## 주의 사항

**권한**: `/etc/hosts`는 root 권한으로만 쓸 수 있습니다. 일반 사용자가 임시로 매핑을 추가하려면 `~/.config/hosts` 같은 사용자별 파일은 지원되지 않으며, `sudo`를 써야 합니다.

**동기화**: 여러 서버에서 동일한 `/etc/hosts`를 유지하려면 Ansible, Puppet, Chef 같은 구성 관리 도구나 DNS 서버를 활용하는 것이 현실적입니다.

**IPv6**: IPv4 항목과 IPv6 항목을 모두 추가해야 합니다. IPv4만 추가하면 IPv6를 먼저 시도하는 애플리케이션이 DNS로 폴백할 수 있습니다.

```
# 양쪽 모두 추가
192.168.1.10  db.internal
fd00::10      db.internal
```

단순하지만 강력한 `/etc/hosts`. 개발 환경 설정, 장애 대응, 보안 정책 적용까지 다양하게 활용할 수 있는 도구입니다.

---

**지난 글:** [resolv.conf & systemd-resolved — DNS 설정](/posts/linux-resolv-conf-systemd-resolved/)

**다음 글:** [네트워크 네임스페이스 — 격리된 네트워크 스택](/posts/linux-network-namespaces/)

<br>
읽어주셔서 감사합니다. 😊
