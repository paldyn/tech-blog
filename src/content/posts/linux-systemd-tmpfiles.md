---
title: "systemd-tmpfiles — 임시 파일과 디렉터리 자동 관리"
description: "tmpfiles.d 설정 파일 문법으로 런타임 디렉터리를 생성하고 오래된 파일을 자동으로 정리하는 방법, 그리고 패키지 기본값을 /etc에서 오버라이드하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["linux", "systemd", "tmpfiles", "tmpfiles.d", "runtime", "tmp", "cleanup"]
featured: false
draft: false
---

[지난 글](/posts/linux-systemd-resolved-networkd/)에서 systemd-resolved와 networkd로 DNS와 네트워크를 설정했습니다. 이번에는 **systemd-tmpfiles**를 다룹니다. `/tmp` 자동 정리, 런타임 디렉터리 생성, 권한 설정을 선언적으로 관리하는 systemd 컴포넌트입니다.

## tmpfiles가 해결하는 문제

서비스가 시작될 때 `/run/myapp/` 디렉터리가 필요하다고 가정하겠습니다. 이 디렉터리는 재부팅 시 사라지는 tmpfs에 있기 때문에 매번 다시 만들어야 합니다. 예전에는 init 스크립트나 ExecStartPre에서 직접 `mkdir -p`를 호출했습니다. systemd-tmpfiles는 이를 설정 파일로 선언하고, 부팅 시 자동으로 처리합니다.

## 설정 파일 위치와 우선순위

설정 파일은 세 경로에서 읽힙니다. 같은 이름의 파일이 여러 경로에 있으면 `/etc`가 가장 높은 우선순위를 가집니다.

```
/etc/tmpfiles.d/     ← 관리자 커스텀 (최우선)
/run/tmpfiles.d/     ← 런타임 생성
/usr/lib/tmpfiles.d/ ← 패키지 기본값
```

배포판 패키지가 `/usr/lib/tmpfiles.d/nginx.conf`를 제공하더라도, 같은 이름의 파일을 `/etc/tmpfiles.d/nginx.conf`에 만들면 완전히 대체됩니다.

![tmpfiles 설정 파일 검색 순서](/assets/posts/linux-systemd-tmpfiles-flow.svg)

## 설정 파일 문법

각 줄은 `타입 경로 모드 소유자 그룹 나이 인자` 형식입니다.

```
# 타입  경로              모드  소유자  그룹   나이
d       /run/myapp        0755  root    root   -
D       /tmp/cache        1777  root    root   10d
f       /run/myapp/lock   0644  myapp   myapp  -
z       /var/log/myapp    0750  myapp   adm    -
r       /tmp/old-files    -     -       -      -
```

![tmpfiles.d 설정 문법](/assets/posts/linux-systemd-tmpfiles-syntax.svg)

주요 타입을 정리하면 다음과 같습니다.

| 타입 | 동작 |
|------|------|
| `d` | 디렉터리 생성, 이미 있으면 소유자·권한 수정 |
| `D` | `d`와 같지만 나이 설정에 따라 오래된 하위 파일 삭제 |
| `f` | 빈 파일 생성 (이미 있으면 건드리지 않음) |
| `F` | 파일 생성 또는 비우기 |
| `z` | 소유자·권한·SELinux 레이블 설정 |
| `Z` | `z`를 재귀적으로 적용 |
| `r` | 파일 삭제 (디렉터리 비재귀) |
| `R` | 디렉터리 재귀 삭제 |
| `L` | 심볼릭 링크 생성 |

## 실전 예제: 서비스 런타임 디렉터리

```ini
# /etc/tmpfiles.d/myapp.conf
d /run/myapp         0750 myapp myapp -
d /run/myapp/sockets 0750 myapp myapp -
f /run/myapp/status  0640 myapp myapp -
z /var/log/myapp     0750 myapp adm   -
```

이 파일을 만들고 서비스 유닛에서 `RuntimeDirectory=myapp`을 쓰는 것과 비교하면, tmpfiles는 여러 경로를 한꺼번에 정의할 수 있고, 기존 파일의 권한 수정(`z`)도 함께 처리할 수 있다는 장점이 있습니다.

## 적용 방법

```bash
# 즉시 적용 (파일 생성)
sudo systemd-tmpfiles --create /etc/tmpfiles.d/myapp.conf

# 오래된 파일 정리
sudo systemd-tmpfiles --clean

# 전체 설정 재적용
sudo systemd-tmpfiles --create --clean --remove
```

부팅 시에는 `systemd-tmpfiles-setup.service`가 `--create`를, `systemd-tmpfiles-clean.timer`가 주기적으로 `--clean`을 실행합니다.

## /tmp 자동 정리

기본 제공되는 `/usr/lib/tmpfiles.d/tmp.conf`가 `/tmp`를 10일마다 정리합니다. 이 주기를 바꾸려면 오버라이드 파일을 만듭니다.

```bash
# /tmp 정리 주기를 3일로 단축
sudo cp /usr/lib/tmpfiles.d/tmp.conf /etc/tmpfiles.d/tmp.conf
# 파일 열어서 나이 값(10d)을 3d로 수정
```

---

**지난 글:** [systemd-resolved와 systemd-networkd — DNS와 네트워크 설정](/posts/linux-systemd-resolved-networkd/)

**다음 글:** [systemd-logind — 세션과 전원 관리](/posts/linux-systemd-logind/)

<br>
읽어주셔서 감사합니다. 😊
