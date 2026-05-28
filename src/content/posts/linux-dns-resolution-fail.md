---
title: "DNS 이름 해석 실패 트러블슈팅"
description: "curl: Could not resolve host 에러 원인을 /etc/resolv.conf, systemd-resolved, nsswitch.conf 관점에서 단계별로 진단하고, dig · nslookup · resolvectl을 이용한 DNS 복구 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-29"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["linux", "dns", "troubleshooting", "resolv.conf", "systemd-resolved", "dig"]
featured: false
draft: false
---

[지난 글](/posts/linux-network-unreachable/)에서 IP 레벨 연결 불가 문제를 계층별로 좁혀가는 흐름을 살펴봤다. 이번에는 IP로 직접 통신은 되는데 도메인 이름이 해석되지 않는 상황을 다룬다. `curl: (6) Could not resolve host`, `Name or service not known` 같은 에러가 반복될 때 어디서 무엇이 실패했는지 빠르게 찾는 법을 정리한다.

## DNS 해석 경로 이해

리눅스에서 호스트명 조회는 여러 계층을 거친다.

1. `/etc/hosts` — 로컬 정적 매핑
2. `nsswitch.conf` — 조회 순서 결정 (`files dns` 또는 `dns files`)
3. DNS 리졸버 — `/etc/resolv.conf`가 가리키는 DNS 서버로 쿼리
4. `systemd-resolved` — systemd 기반 배포판의 캐싱 리졸버 (127.0.0.53)

![DNS 이름 해석 실패 트러블슈팅](/assets/posts/linux-dns-resolution-fail-flow.svg)

## 1단계 — IP 직접 접속으로 네트워크 분리

```bash
ping -c 3 8.8.8.8
curl -I --max-time 5 http://142.250.206.46
```

IP로 직접 통신이 된다면 네트워크 자체는 정상이다. 순수 DNS 해석 문제다. IP로도 실패하면 이전 단계(라우팅, 인터페이스)를 먼저 해결한다.

## 2단계 — /etc/resolv.conf 점검

```bash
cat /etc/resolv.conf
```

`nameserver` 줄이 없거나 잘못된 IP가 적혀 있으면 쿼리할 서버가 없다. 임시 해결책:

```bash
# 임시 DNS 설정 (재부팅 후 사라질 수 있음)
echo "nameserver 8.8.8.8" | sudo tee /etc/resolv.conf
echo "nameserver 1.1.1.1" | sudo tee -a /etc/resolv.conf
```

`systemd-resolved`를 사용하는 시스템이라면 `/etc/resolv.conf`는 심볼릭 링크여야 한다.

```bash
ls -la /etc/resolv.conf
# 올바른 링크: /etc/resolv.conf -> /run/systemd/resolve/stub-resolv.conf
```

링크가 깨져 있으면 재생성한다.

```bash
sudo ln -sf /run/systemd/resolve/stub-resolv.conf /etc/resolv.conf
```

## 3단계 — DNS 서버 직접 쿼리

```bash
# 시스템 기본 DNS
dig google.com

# 외부 DNS 직접 지정
dig @8.8.8.8 google.com
dig @1.1.1.1 google.com A
```

`dig @8.8.8.8`이 성공하고 `dig`(서버 지정 없음)는 실패한다면, `/etc/resolv.conf`의 nameserver가 응답하지 않거나 잘못된 것이다.

## 4단계 — systemd-resolved 상태 확인

```bash
systemctl status systemd-resolved
resolvectl status
journalctl -u systemd-resolved --since "10 min ago"
```

![DNS 진단 핵심 명령어](/assets/posts/linux-dns-resolution-fail-commands.svg)

서비스가 실패(failed) 상태라면 재시작한다.

```bash
sudo systemctl restart systemd-resolved
```

DNS 서버 설정을 확인하고 업데이트한다.

```bash
# 현재 사용 중인 DNS 서버 확인
resolvectl dns

# NetworkManager를 통해 DNS 영구 설정
nmcli con mod "My Connection" ipv4.dns "8.8.8.8 1.1.1.1"
nmcli con up "My Connection"
```

## 5단계 — nsswitch.conf 순서 확인

```bash
grep ^hosts /etc/nsswitch.conf
```

일반적인 출력: `hosts: files mdns4_minimal [NOTFOUND=return] dns`

`dns`가 없으면 DNS 조회를 시도하지 않는다. `files dns`로 수정한다.

```bash
sudo sed -i 's/^hosts:.*/hosts: files dns/' /etc/nsswitch.conf
```

## 방화벽 — UDP 53 차단 여부

```bash
# 방화벽 없이 DNS 테스트
sudo iptables -I OUTPUT -p udp --dport 53 -j ACCEPT
dig google.com
```

내부 DNS 서버를 사용하는 환경에서는 외부 53번 포트가 차단된 경우가 많다. 이 경우에는 내부 DNS 서버 IP를 올바르게 설정해야 한다.

## 자주 발생하는 패턴 요약

| 현상 | 원인 | 조치 |
|------|------|------|
| `dig @8.8.8.8` 성공, `dig` 실패 | resolv.conf nameserver 오류 | nameserver 수정 |
| `nslookup` 성공, `curl` 실패 | nsswitch.conf 순서 | dns 항목 추가 |
| 모든 DNS 실패, IP 직접 성공 | UDP 53 방화벽 차단 | firewalld/iptables 허용 |
| resolved failed 상태 | 서비스 충돌, 설정 오류 | systemctl restart |
| resolv.conf 링크 깨짐 | 수동 편집으로 심볼릭 링크 덮어씀 | 링크 재생성 |

## /etc/hosts 우선순위 활용

긴급 복구 시에는 `/etc/hosts`에 직접 IP를 추가해 DNS 없이 접속할 수 있다.

```bash
echo "93.184.216.34 example.com" | sudo tee -a /etc/hosts
```

DNS 복구 후에는 반드시 제거한다.

DNS 해석 실패는 대부분 `resolv.conf` 설정 오류, `systemd-resolved` 서비스 중단, 방화벽 UDP 53 차단 세 가지 중 하나다. `dig @8.8.8.8`으로 외부 DNS와 내부 리졸버를 분리해서 테스트하는 것이 핵심이다.

---

**지난 글:** [Network Unreachable — 네트워크 연결 불가 트러블슈팅](/posts/linux-network-unreachable/)

**다음 글:** [Permission Denied — 권한 거부 트러블슈팅](/posts/linux-permission-denied/)

<br>
읽어주셔서 감사합니다. 😊
