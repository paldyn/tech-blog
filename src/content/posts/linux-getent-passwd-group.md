---
title: "getent — 사용자·그룹 데이터베이스 조회"
description: "getent 명령으로 passwd, group, shadow, hosts 등 NSS 데이터베이스를 조회하는 방법과 /etc/nsswitch.conf의 역할을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["linux", "getent", "passwd", "group", "nsswitch", "nss", "ldap", "user-management", "linux-admin"]
featured: false
draft: false
---

[지난 글](/posts/linux-id-whoami-w-who/)에서 현재 사용자를 확인하는 명령어를 살펴봤습니다. 이번에는 **getent**를 다룹니다. `cat /etc/passwd`로 사용자 정보를 보는 것에 익숙하다면, `getent`가 왜 더 올바른 방법인지 이해하면 LDAP, NIS 등 외부 인증 소스와 통합된 환경에서 도움이 됩니다.

## getent가 필요한 이유

`/etc/passwd`에는 로컬 사용자만 있습니다. 기업 환경에서는 LDAP(Active Directory 포함)이나 NIS로 사용자 정보를 중앙 관리합니다. 이런 외부 소스의 사용자를 `cat /etc/passwd`로 찾으면 나타나지 않습니다.

`getent`는 `/etc/nsswitch.conf`에 설정된 모든 소스를 순서대로 조회해 일관된 결과를 반환합니다. 로컬 파일과 외부 디렉터리를 구분하지 않고 통합 조회하는 것이 핵심입니다.

## 기본 사용법

```bash
# 사용자 조회 (이름 또는 UID)
getent passwd alice
getent passwd 1001

# 그룹 조회 (이름 또는 GID)
getent group docker
getent group 999

# 전체 목록 (외부 소스 포함)
getent passwd
getent group
```

![getent NSS 데이터베이스 조회](/assets/posts/linux-getent-passwd-group-usage.svg)

`getent passwd alice`의 출력은 `/etc/passwd`와 같은 콜론 구분 형식입니다.

```
alice:x:1001:1001:Alice:/home/alice:/bin/bash
```

7개 필드: 이름, 비밀번호 자리표시자(x), UID, GID, GECOS(표시 이름), 홈 디렉터리, 셸.

## NSS와 nsswitch.conf

`getent`가 조회하는 순서는 `/etc/nsswitch.conf`(Name Service Switch)가 결정합니다.

```
passwd:   files systemd ldap
group:    files systemd
hosts:    files dns
shadow:   files
```

`files`는 `/etc/passwd`, `/etc/group` 등 로컬 파일을 의미합니다. `dns`는 DNS 서버, `ldap`은 LDAP 디렉터리입니다. 앞에서 찾으면 뒤는 조회하지 않습니다.

![NSS 조회 흐름](/assets/posts/linux-getent-passwd-group-nss.svg)

## 지원하는 데이터베이스 목록

```bash
# 지원 데이터베이스 확인
getent --help 2>&1 | grep "Supported"

# 자주 쓰는 데이터베이스
getent passwd    # 사용자
getent group     # 그룹
getent shadow    # 비밀번호 해시 (root 필요)
getent hosts     # 호스트 이름 → IP
getent services  # 서비스명 → 포트
getent protocols # 프로토콜
getent networks  # 네트워크 이름 → 주소
```

`hosts` 조회는 특히 유용합니다. `/etc/hosts`에 있는 항목과 DNS 결과를 함께 반환하므로, `nslookup`보다 실제 애플리케이션이 보는 해석 결과에 가깝습니다.

## 실전 활용 패턴

```bash
# 사용자 존재 여부 확인 (스크립트)
if getent passwd alice > /dev/null 2>&1; then
  echo "alice 존재"
fi

# 사용자의 홈 디렉터리 추출
getent passwd alice | cut -d: -f6

# 사용자의 로그인 셸 추출
getent passwd alice | cut -d: -f7

# 특정 셸을 쓰는 사용자 목록
getent passwd | awk -F: '$7 == "/bin/bash" {print $1}'

# 그룹 멤버 목록 추출
getent group docker | cut -d: -f4 | tr ',' '\n'
```

`cut -d: -f6` 처럼 필드 번호를 외우기 어렵다면, `awk -F:`를 쓰는 것이 더 읽기 좋습니다.

## getent vs cat /etc/passwd

| 상황 | cat /etc/passwd | getent passwd |
|------|-----------------|---------------|
| 로컬 사용자만 있는 서버 | 동일 | 동일 |
| LDAP 사용자 포함 | 로컬만 반환 | 전체 반환 |
| systemd homed 사용자 | 없음 | 반환 |
| 스크립트 이식성 | 로컬에서만 신뢰 가능 | 모든 환경에서 신뢰 가능 |

스크립트에서 사용자·그룹 정보를 조회할 때는 항상 `getent`를 사용하는 것이 올바릅니다.

## shadow 조회 (root 전용)

```bash
# 비밀번호 해시 및 만료 정보 조회
sudo getent shadow alice
# alice:$6$rounds=5000$...:19500:0:99999:7:::

# 필드 순서: 이름:해시:마지막변경:최소:최대:경고:비활성:만료
```

shadow 데이터베이스는 root만 읽을 수 있습니다. 일반 사용자가 실행하면 빈 결과를 반환합니다.

---

**지난 글:** [id, whoami, w, who — 현재 사용자 확인 명령어](/posts/linux-id-whoami-w-who/)

**다음 글:** [PAM 기초 — 플러그인 가능한 인증 모듈](/posts/linux-pam-basics/)

<br>
읽어주셔서 감사합니다. 😊
