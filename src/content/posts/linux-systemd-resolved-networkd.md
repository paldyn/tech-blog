---
title: "systemd-resolved와 systemd-networkd — DNS와 네트워크 설정"
description: "systemd-resolved의 DNS 스텁 리졸버 동작 방식과 resolvectl 사용법, systemd-networkd의 .network 파일로 정적 IP 및 DHCP를 설정하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["linux", "systemd", "resolved", "networkd", "dns", "network", "resolvectl", "DHCP"]
featured: false
draft: false
---

[지난 글](/posts/linux-systemd-journal-rotation/)에서 저널 보존 정책을 설정하는 방법을 배웠습니다. 이번에는 systemd 생태계의 네트워크 담당 두 서비스 — **systemd-resolved**(DNS 해석)와 **systemd-networkd**(IP 설정) — 를 살펴봅니다. 두 서비스는 독립적으로도 사용할 수 있지만, 함께 사용하면 서버와 컨테이너 환경에서 일관된 네트워크 관리가 가능합니다.

## systemd-resolved

`systemd-resolved`는 로컬 DNS 캐싱 리졸버입니다. `127.0.0.53:53`에서 스텁(stub) 리스너를 실행하고, 애플리케이션의 DNS 질의를 받아 업스트림 DNS 서버에 전달한 뒤 결과를 캐시합니다.

![systemd-resolved DNS 해석 흐름](/assets/posts/linux-systemd-resolved-networkd-arch.svg)

`/etc/resolv.conf`는 `stub-resolv.conf`의 심볼릭 링크로 만들어야 합니다. 이렇게 해야 모든 애플리케이션의 DNS 질의가 resolved를 거칩니다.

```bash
# 심볼릭 링크 설정 (이미 됐는지 확인)
ls -la /etc/resolv.conf
# → /etc/resolv.conf -> /run/systemd/resolve/stub-resolv.conf

# 아직 안 됐다면
sudo ln -sf /run/systemd/resolve/stub-resolv.conf /etc/resolv.conf
```

### resolvectl로 상태 확인

```bash
resolvectl status             # 전체 DNS 설정 (인터페이스별)
resolvectl query example.com  # DNS 조회 테스트
resolvectl statistics         # 캐시 히트율, 질의 수
resolvectl flush-caches       # 캐시 초기화
```

DNSSEC 검증이 활성화된 경우 `resolvectl query`에 `DNSSEC: yes`가 표시됩니다.

### resolved.conf 설정

```ini
# /etc/systemd/resolved.conf
[Resolve]
DNS=8.8.8.8 1.1.1.1
FallbackDNS=9.9.9.9
Domains=~.
DNSSEC=allow-downgrade
DNSOverTLS=opportunistic
Cache=yes
```

`Domains=~.`는 모든 도메인을 이 DNS 서버로 해석한다는 의미입니다. VPN 환경에서 특정 도메인만 내부 DNS로 보내려면 `Domains=~company.internal`처럼 지정합니다.

## systemd-networkd

`systemd-networkd`는 네트워크 인터페이스를 관리하는 데몬입니다. NetworkManager 없이 서버나 컨테이너 환경에서 가볍게 사용할 수 있습니다. `/etc/systemd/network/` 디렉터리의 `.network`, `.link`, `.netdev` 파일로 설정합니다.

![systemd-networkd .network 파일](/assets/posts/linux-systemd-resolved-networkd-config.svg)

파일 이름 앞의 숫자(`10-`, `20-`)는 우선순위를 결정합니다. 낮은 숫자가 먼저 적용됩니다.

### .link 파일 — 인터페이스 이름 고정

```ini
# /etc/systemd/network/10-eth.link
[Match]
MACAddress=aa:bb:cc:dd:ee:ff

[Link]
Name=eth0
```

MAC 주소로 인터페이스를 매칭해 이름을 고정합니다. `udev`의 persistent naming과 유사한 역할을 합니다.

### networkd 상태 확인

```bash
networkctl                    # 인터페이스 목록과 상태
networkctl status eth0        # 특정 인터페이스 상세
networkctl reload             # 설정 파일 다시 불러오기
networkctl reconfigure eth0   # 특정 인터페이스 재설정
```

### NetworkManager와의 관계

Ubuntu 데스크톱이나 일반 배포판은 `NetworkManager`를 기본으로 사용합니다. `systemd-networkd`는 서버, Raspberry Pi, 컨테이너처럼 GUI 없이 가볍게 동작해야 하는 환경에 적합합니다. 두 서비스를 동시에 활성화하면 충돌이 발생하므로 하나만 사용해야 합니다.

```bash
# NetworkManager 비활성화 후 networkd 사용
sudo systemctl disable NetworkManager
sudo systemctl enable --now systemd-networkd systemd-resolved
```

---

**지난 글:** [systemd 저널 로테이션과 보존 정책](/posts/linux-systemd-journal-rotation/)

**다음 글:** [systemd-tmpfiles — 임시 파일과 디렉터리 관리](/posts/linux-systemd-tmpfiles/)

<br>
읽어주셔서 감사합니다. 😊
