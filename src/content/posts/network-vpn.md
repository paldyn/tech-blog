---
title: "VPN 완전 정복 — 터널링과 암호화로 안전한 통신"
description: "VPN의 터널링 원리, IPSec/IKEv2·OpenVPN·WireGuard·SSL VPN 비교, Split Tunneling, 사이트 간 VPN vs 원격 접속 VPN, WireGuard 설정 예시까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 9
type: "knowledge"
category: "Network"
tags: ["VPN", "WireGuard", "IPSec", "OpenVPN", "터널링", "보안", "네트워크"]
featured: false
draft: false
---

[지난 글](/posts/network-firewalls/)에서 방화벽의 동작과 DMZ 설계를 살펴봤습니다. 이번 글에서는 **VPN(Virtual Private Network)**의 터널링 원리부터 WireGuard 설정까지, 현대 VPN 기술을 실무 중심으로 정리합니다.

## VPN이 해결하는 문제

인터넷은 공용 네트워크입니다. 기업 직원이 집에서 사내 시스템에 접근하거나, 여러 지역의 사무소를 연결하려면 어떻게 해야 할까요? 전용선은 비싸고, 인터넷을 그냥 쓰면 도청 위험이 있습니다.

VPN은 공용 인터넷 위에 **암호화된 가상 전용 터널**을 만들어 이 문제를 해결합니다.

## 터널링 원리

![VPN 터널링 원리](/assets/posts/network-vpn-tunnel.svg)

```
캡슐화(Encapsulation):
  원본 패킷: [IP: 10.0.0.2→192.168.1.5][TCP 443][HTTP 데이터]
                         ↓ ESP로 암호화 + 새 IP 헤더 추가
  터널 패킷: [IP: 203.0.113.1→203.0.113.100][ESP][암호화된 원본 패킷]

공용망에서 보이는 것: 203.0.113.1 ↔ 203.0.113.100 (VPN GW IP만 노출)
실제 통신: 10.0.0.2 ↔ 192.168.1.5 (숨겨짐)
```

터널 모드와 전송 모드 두 가지가 있습니다:

- **터널 모드**: 원본 패킷 전체(IP 헤더 포함)를 암호화. 사이트 간 VPN에 사용
- **전송 모드**: IP 헤더는 그대로 두고 페이로드만 암호화. 호스트 간 직접 연결에 사용

## VPN 유형 비교

![VPN 유형 비교](/assets/posts/network-vpn-types.svg)

### IPSec / IKEv2

기업 환경에서 가장 많이 쓰이는 표준입니다.

```bash
# strongSwan으로 IKEv2 서버 설정 (Linux)
# /etc/ipsec.conf
conn ikev2-vpn
    auto=add
    compress=no
    type=tunnel
    keyexchange=ikev2
    ike=aes256-sha256-modp2048!
    esp=aes256-sha256!
    left=%any
    leftid=@vpn.example.com
    leftcert=server-cert.pem
    leftsendcert=always
    leftsubnet=0.0.0.0/0
    right=%any
    rightid=%any
    rightauth=eap-mschapv2
    rightsourceip=10.10.0.0/24
    rightdns=8.8.8.8
    rekey=no
    eap_identity=%identity
```

### WireGuard

현대 VPN 중 가장 단순하고 빠릅니다. 커널에 내장(Linux 5.6+).

```bash
# WireGuard 서버 설정
# 1. 키 쌍 생성
wg genkey | tee server-private.key | wg pubkey > server-public.key
wg genkey | tee client-private.key | wg pubkey > client-public.key

# 2. 서버 설정 파일 (/etc/wireguard/wg0.conf)
cat > /etc/wireguard/wg0.conf << EOF
[Interface]
PrivateKey = $(cat server-private.key)
Address = 10.0.0.1/24
ListenPort = 51820
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

[Peer]
PublicKey = $(cat client-public.key)
AllowedIPs = 10.0.0.2/32
EOF

# 3. 시작
wg-quick up wg0
systemctl enable wg-quick@wg0

# 클라이언트 설정 파일
cat > client.conf << EOF
[Interface]
PrivateKey = $(cat client-private.key)
Address = 10.0.0.2/24
DNS = 1.1.1.1

[Peer]
PublicKey = $(cat server-public.key)
Endpoint = vpn.example.com:51820
AllowedIPs = 0.0.0.0/0  # 전체 트래픽 VPN으로
PersistentKeepalive = 25
EOF
```

### Split Tunneling

모든 트래픽을 VPN으로 보내면 VPN 서버 부하가 크고 성능이 저하됩니다. **Split Tunneling**은 특정 대역만 VPN으로 보내고 나머지는 직접 연결합니다.

```bash
# WireGuard Split Tunneling: 사내망만 VPN
# AllowedIPs에 사내 대역만 지정
[Peer]
PublicKey = SERVER_PUB_KEY
Endpoint = vpn.example.com:51820
AllowedIPs = 192.168.0.0/16, 10.0.0.0/8   # 사내 대역만
# 0.0.0.0/0 대신 특정 대역만 → 인터넷 트래픽은 직접 연결
```

## VPN 유형: Site-to-Site vs Remote Access

```
Site-to-Site VPN (사이트 간):
  본사(192.168.1.0/24) ←→ 지사(192.168.2.0/24)
  
  [본사 GW]──VPN 터널──[지사 GW]
  
  특징: GW 장비 간 자동 연결
        직원은 VPN 클라이언트 불필요
        항상 켜져 있는 터널

Remote Access VPN (원격 접속):
  직원 PC ←→ 회사망
  
  [직원 노트북]──인터넷──[VPN 게이트웨이]──[사내망]
  
  특징: 직원이 VPN 클라이언트 실행
        인증 후 사내망 IP 할당
        필요 시에만 연결
```

## OpenVPN 설정

```bash
# OpenVPN 서버 설정 (/etc/openvpn/server.conf)
port 1194
proto udp
dev tun
ca ca.crt
cert server.crt
key server.key
dh dh2048.pem
tls-auth ta.key 0

server 10.8.0.0 255.255.255.0  # 클라이언트에 할당할 IP 범위
push "redirect-gateway def1"    # 전체 트래픽 VPN
push "dhcp-option DNS 8.8.8.8"
keepalive 10 120
cipher AES-256-GCM
auth SHA256
compress lz4-v2

# 클라이언트 접속
openvpn --config client.ovpn
```

## VPN 성능 최적화

```bash
# WireGuard 성능 확인
wg show
# interface: wg0
#   peer: CLIENT_PUB_KEY
#     endpoint: 1.2.3.4:51820
#     allowed ips: 10.0.0.2/32
#     latest handshake: 1 minute, 30 seconds ago
#     transfer: 45.67 MiB received, 12.34 MiB sent

# MTU 설정 (터널 오버헤드 고려)
# WireGuard 오버헤드: 약 60바이트
# 기본 MTU 1500 → WireGuard MTU 1420 권장
[Interface]
MTU = 1420
```

## 클라우드 환경의 VPN

```bash
# AWS Site-to-Site VPN 생성
aws ec2 create-vpn-gateway \
  --type ipsec.1 \
  --amazon-side-asn 64512

# AWS Client VPN 엔드포인트
aws ec2 create-client-vpn-endpoint \
  --client-cidr-block "10.0.0.0/22" \
  --server-certificate-arn arn:aws:acm:region:account:certificate/id \
  --authentication-options Type=certificate-authentication,\
    MutualAuthentication={ClientRootCertificateChainArn=arn:aws:acm:...} \
  --connection-log-options Enabled=false
```

---

**지난 글:** [방화벽 완전 정복 — 패킷 필터링부터 NGFW까지](/posts/network-firewalls/)

**다음 글:** [프록시 완전 정복 — 포워드 프록시와 리버스 프록시](/posts/network-proxy-forward-reverse/)

<br>
읽어주셔서 감사합니다. 😊
