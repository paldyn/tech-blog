---
title: "fail2ban — 무차별 대입 공격 자동 차단"
description: "fail2ban의 동작 원리, jail.local 핵심 설정(maxretry/findtime/bantime), SSH·Nginx·커스텀 필터 설정, fail2ban-client 운영 명령을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["linux", "fail2ban", "security", "brute-force", "iptables", "ssh", "intrusion-prevention", "jail"]
featured: false
draft: false
---

[지난 글](/posts/linux-apparmor-basics/)에서 AppArmor로 애플리케이션을 격리하는 방법을 살펴봤습니다. 이번에는 외부에서 들어오는 **무차별 대입 공격(brute-force)**을 자동으로 차단하는 **fail2ban**을 다룹니다. 인터넷에 노출된 서버는 SSH 포트를 향한 로그인 시도가 끊임없이 들어옵니다. fail2ban은 로그를 감시하다 일정 횟수 이상 실패한 IP를 iptables로 차단합니다.

## 동작 원리

fail2ban은 세 가지 요소로 구성됩니다.

1. **Filter**: 로그에서 실패 이벤트를 찾는 정규식(failregex)
2. **Jail**: 필터, 로그 파일, maxretry/findtime/bantime 설정의 묶음
3. **Action**: 밴 시 실행할 명령 (iptables DROP, 이메일 알림 등)

로그에서 failregex와 일치하는 라인이 `findtime` 초 안에 `maxretry`회 이상 발견되면 해당 IP에 `bantime`초 동안 차단 규칙을 추가합니다.

![fail2ban 동작 아키텍처](/assets/posts/linux-fail2ban-architecture.svg)

## 설치와 기본 설정

```bash
# 설치
sudo apt install fail2ban

# 서비스 시작
sudo systemctl enable --now fail2ban
```

설정은 `/etc/fail2ban/jail.conf`를 직접 수정하지 않고 **`jail.local`을 만들어** 덮어씁니다. 패키지 업데이트 시 `jail.conf`가 초기화되더라도 `jail.local`은 유지됩니다.

```bash
# jail.local 생성 (jail.conf 일부 복사 또는 처음부터 작성)
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
```

## jail.local 핵심 설정

```ini
# /etc/fail2ban/jail.local

[DEFAULT]
# 내 IP / 신뢰 대역은 절대 밴 안 함
ignoreip = 127.0.0.1/8 ::1 192.168.1.0/24

# 기본값 (각 jail에서 재정의 가능)
bantime  = 3600       # 1시간 차단
findtime = 600        # 10분 윈도우
maxretry = 5          # 5회 실패 시 밴

[sshd]
enabled  = true
port     = ssh
logpath  = %(sshd_log)s
backend  = %(sshd_backend)s
maxretry = 3          # SSH는 더 엄격하게
bantime  = 86400      # 24시간
```

`bantime = -1`로 설정하면 영구 차단입니다. 재귀적 증가 밴 타임(`bantime.increment = true`)도 지원합니다.

## Nginx 실패 로그인 차단

```ini
# jail.local에 추가
[nginx-http-auth]
enabled  = true
port     = http,https
logpath  = /var/log/nginx/error.log

[nginx-botsearch]
enabled  = true
port     = http,https
filter   = nginx-botsearch
logpath  = /var/log/nginx/access.log
maxretry = 2
```

## 커스텀 필터 작성

```ini
# /etc/fail2ban/filter.d/myapp.conf
[Definition]
failregex = ^.*Login failed for user .* from <HOST>.*$
ignoreregex =
```

```ini
# jail.local에 jail 추가
[myapp]
enabled  = true
filter   = myapp
logpath  = /var/log/myapp/auth.log
maxretry = 5
bantime  = 3600
```

## 운영 명령

![fail2ban-client 운영 명령](/assets/posts/linux-fail2ban-commands.svg)

```bash
# 전체 상태
sudo fail2ban-client status

# 특정 jail 상세 (밴된 IP 목록)
sudo fail2ban-client status sshd

# 수동 밴 / 언밴
sudo fail2ban-client ban sshd 1.2.3.4
sudo fail2ban-client unban 1.2.3.4

# 필터 테스트 (매칭 확인)
sudo fail2ban-regex /var/log/auth.log /etc/fail2ban/filter.d/sshd.conf

# 설정 리로드
sudo fail2ban-client reload
```

## 자신의 IP를 밴당했을 때

가장 흔한 실수 중 하나입니다. 서버 콘솔 접근 가능하면:

```bash
sudo fail2ban-client unban 자신의_IP
```

콘솔 접근도 안 되면 서버 제공업체의 구조 콘솔(rescue mode)을 통해 iptables 규칙을 직접 제거합니다. 이 상황을 미리 막으려면 `ignoreip`에 자신의 고정 IP나 대역을 등록해두는 것이 중요합니다.

## 실무 팁

**SSH 포트 변경과 병용**: fail2ban만으로는 충분하지 않습니다. SSH 포트를 22에서 변경하면 자동화 스캐너의 대부분을 막습니다. fail2ban은 그 이후의 시도를 처리합니다.

**이메일 알림**: `action = %(action_mwl)s`로 밴 발생 시 이메일 알림을 보낼 수 있습니다. Postfix가 설치되어 있어야 합니다.

**로그 모니터링**: `sudo tail -f /var/log/fail2ban.log`로 실시간 밴/언밴 내역을 확인할 수 있습니다.

---

**지난 글:** [AppArmor 기초 — 경로 기반 MAC으로 앱 격리하기](/posts/linux-apparmor-basics/)

<br>
읽어주셔서 감사합니다. 😊
