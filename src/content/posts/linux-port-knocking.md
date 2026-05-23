---
title: "Port Knocking — 포트 숨겨두기로 공격 표면 줄이기"
description: "Port Knocking의 동작 원리, knockd 설치·설정, iptables 연동, 클라이언트 사용법, 보안 한계와 fwknop 대안까지 실전 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["linux", "security", "port-knocking", "knockd", "iptables", "firewall", "ssh"]
featured: false
draft: false
---

[지난 글](/posts/linux-fail2ban/)에서 fail2ban으로 무차별 대입 공격을 자동 차단하는 방법을 살펴봤습니다. 이번에는 한 발 더 나아가 **포트 자체를 숨겨버리는 Port Knocking** 기법을 다룹니다. 포트 스캐너를 돌려도 SSH 포트가 아예 안 보이기 때문에, 공격자가 존재 자체를 파악하기 어려워집니다.

## 왜 Port Knocking인가

`nmap` 같은 포트 스캐너로 서버를 조회하면 22번 포트가 열려 있으면 곧바로 공격 대상이 됩니다. fail2ban은 공격을 받은 후 차단하지만, Port Knocking은 **처음부터 포트를 닫아두고** 미리 약속한 포트 시퀀스를 받았을 때만 잠깐 엽니다. 포트가 닫혀 있으면 스캐너 입장에서는 서버가 응답하지 않는 것처럼 보입니다.

![Port Knocking 시퀀스 흐름](/assets/posts/linux-port-knocking-sequence.svg)

## 동작 원리

Port Knocking은 다음 세 요소로 구성됩니다.

1. **knockd 데몬** — 서버에서 실행되며, 방화벽 로그(패킷 캡처)를 감시합니다.
2. **시퀀스(Sequence)** — 클라이언트가 특정 포트를 정해진 순서로 노크합니다.
3. **iptables 명령** — 시퀀스가 맞으면 knockd가 iptables 규칙을 추가해 SSH 포트를 해당 IP에만 엽니다.

노크 패킷 자체는 방화벽이 드롭하므로 클라이언트에는 응답이 없습니다. 패킷 로그만 서버에 기록됩니다.

## 설치 및 기본 설정

### knockd 설치

```bash
# Debian/Ubuntu
sudo apt install knockd

# 서비스 시작 설정 파일 수정 (/etc/default/knockd)
sudo sed -i 's/START_KNOCKD=0/START_KNOCKD=1/' /etc/default/knockd
sudo sed -i 's/#KNOCKD_OPTS/KNOCKD_OPTS/' /etc/default/knockd
```

### SSH 포트 기본 차단

Port Knocking이 의미 있으려면 먼저 SSH 포트를 차단해야 합니다.

```bash
sudo iptables -A INPUT -p tcp --dport 22 -j DROP
sudo iptables-save > /etc/iptables/rules.v4
```

### knockd.conf 설정

![knockd 설정 파일과 클라이언트 명령](/assets/posts/linux-port-knocking-config.svg)

```bash
sudo nano /etc/knockd.conf
```

```ini
[options]
    UseSyslog
    Interface = eth0

[openSSH]
    sequence    = 7000,8000,9000
    seq_timeout = 5
    tcpflags    = syn
    start_command = /sbin/iptables -A INPUT -s %IP% -p tcp --dport 22 -j ACCEPT
    stop_command  = /sbin/iptables -D INPUT -s %IP% -p tcp --dport 22 -j ACCEPT
    cmd_timeout   = 30
```

- `sequence` — 클라이언트가 순서대로 노크할 포트 목록
- `seq_timeout` — 시퀀스 완료 제한 시간(초). 이 안에 모든 노크가 도착해야 함
- `tcpflags = syn` — SYN 패킷만 인식 (FIN·RST 등 무시)
- `start_command` — 시퀀스 일치 시 실행할 명령. `%IP%`는 노킹한 IP로 치환
- `stop_command` — `cmd_timeout` 후 실행해 포트를 닫음

```bash
sudo systemctl enable --now knockd
sudo systemctl status knockd
```

## 클라이언트에서 노크하기

```bash
# knock 패키지 설치 (클라이언트 측)
sudo apt install knockd

# 포트 노크 실행
knock <서버IP> 7000 8000 9000

# 이후 SSH 접속 (30초 이내)
ssh user@<서버IP>
```

스크립트로 묶어두면 편합니다.

```bash
#!/bin/bash
SERVER="203.0.113.10"
knock "$SERVER" 7000 8000 9000
sleep 1
ssh "user@$SERVER"
```

nmap으로 시퀀스를 보낼 수도 있습니다.

```bash
nmap -Pn --host-timeout 201ms -p 7000 <서버IP>
nmap -Pn --host-timeout 201ms -p 8000 <서버IP>
nmap -Pn --host-timeout 201ms -p 9000 <서버IP>
```

## 로그 확인

knockd는 syslog에 기록합니다.

```bash
sudo journalctl -u knockd -f
# 또는
grep knockd /var/log/syslog
```

시퀀스가 맞으면 아래와 같은 로그가 남습니다.

```
knockd: 192.168.1.100: openSSH: Stage 1
knockd: 192.168.1.100: openSSH: Stage 2
knockd: 192.168.1.100: openSSH: Stage 3
knockd: 192.168.1.100: openSSH: OPEN SESAME
```

## 보안 한계와 fwknop 대안

Port Knocking에는 한계가 있습니다.

- **재전송 공격(Replay attack)** — 패킷을 도청하면 시퀀스를 복사해 재사용 가능
- **시퀀스 노출** — 네트워크 감시자가 포트 순서를 추론할 수 있음

이를 극복하려면 **fwknop(Single Packet Authorization)**를 사용합니다. fwknop는 단일 암호화 패킷 안에 타임스탬프와 HMAC를 포함해 재전송 공격을 막습니다.

```bash
# fwknop 서버
sudo apt install fwknopd
# fwknop 클라이언트
fwknop -A tcp/22 -R -D <서버IP>
```

## 정리

| 항목 | knockd | fwknop |
|---|---|---|
| 방식 | 포트 시퀀스 | 암호화 단일 패킷 |
| 재전송 공격 | 취약 | 타임스탬프+HMAC로 방어 |
| 설정 복잡도 | 낮음 | 높음 |
| 적합 환경 | 소규모·내부망 | 인터넷 노출 서버 |

Port Knocking은 설정이 단순하고 iptables와 잘 통합되어 입문하기 좋습니다. 재전송 공격이 걱정되는 환경이라면 fwknop를 고려하십시오.

---

**지난 글:** [fail2ban — 무차별 대입 공격 자동 차단](/posts/linux-fail2ban/)

**다음 글:** [루트킷 탐지 — 숨은 침입자 찾기](/posts/linux-rootkit-detection/)

<br>
읽어주셔서 감사합니다. 😊
