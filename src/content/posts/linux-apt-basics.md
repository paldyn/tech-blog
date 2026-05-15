---
title: "apt 기초 — 패키지 설치·제거·업데이트 완전 가이드"
description: "Debian/Ubuntu 계열 패키지 관리자 apt의 동작 원리, sources.list, install/remove/upgrade/autoremove 명령, 버전 고정, 외부 저장소 추가를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["linux", "apt", "debian", "ubuntu", "package-manager", "dpkg", "sources-list", "apt-cache"]
featured: false
draft: false
---

[지난 글](/posts/linux-namespaces-overview/)에서 namespaces로 프로세스를 격리하는 원리를 살펴봤습니다. 이번엔 시스템 운영의 기본 중 기본인 패키지 관리로 넘어갑니다. Debian과 Ubuntu 계열에서 소프트웨어를 설치·제거·업데이트할 때 사용하는 **apt(Advanced Package Tool)** 를 완전히 익힙니다.

## apt의 구조

`apt`는 저수준 패키지 도구인 `dpkg` 위에 올라간 **고수준 프론트엔드**입니다. 저장소에서 메타데이터를 받아 의존성을 자동으로 해결하고, `.deb` 파일을 다운로드·설치까지 자동화합니다.

```
사용자  →  apt  →  dpkg  →  파일시스템
              ↘  apt-cache (검색/조회)
```

![apt 패키지 설치 흐름](/assets/posts/linux-apt-basics-flow.svg)

## sources.list — 저장소 설정

apt가 패키지를 어디서 가져올지를 `/etc/apt/sources.list`와 `/etc/apt/sources.list.d/*.list`에 정의합니다.

```
deb  https://deb.debian.org/debian  bookworm  main contrib non-free
^    ^                               ^          ^
|    URL                             배포판     컴포넌트
유형 (deb=이진, deb-src=소스)
```

최신 배포판은 `.sources` 형식(DEB822)도 사용합니다:

```bash
cat /etc/apt/sources.list.d/debian.sources
```

## 기본 명령어

### 패키지 목록 갱신

```bash
# 저장소 메타데이터만 갱신 — 설치/업그레이드 안 함
apt update
```

`apt update`는 자주 실행해야 합니다. install이나 upgrade 전에 항상 먼저 실행하세요.

### 패키지 설치

```bash
# 단일 설치
apt install nginx

# 여러 패키지 한 번에
apt install curl git vim build-essential

# 비대화형 스크립트용
apt install -y curl git
DEBIAN_FRONTEND=noninteractive apt install -y tzdata
```

### 패키지 제거

```bash
# 바이너리만 제거, 설정파일 유지
apt remove nginx

# 설정파일까지 완전 제거
apt purge nginx

# 더 이상 필요 없는 의존성 정리
apt autoremove
```

## 시스템 업그레이드

```bash
# 이미 설치된 패키지 업그레이드 (새 패키지 설치/제거 안 함)
apt upgrade

# 의존성 충돌 해결 포함 전체 업그레이드 (배포판 업그레이드 등)
apt full-upgrade

# 안전한 업그레이드 루틴
apt update && apt upgrade -y && apt autoremove -y
```

## 버전 고정(hold)

```bash
# 업그레이드에서 특정 패키지 제외
apt-mark hold nginx
apt-mark showhold

# 고정 해제
apt-mark unhold nginx
```

`/etc/apt/preferences.d/`에 핀 규칙을 작성해 더 세밀하게 제어할 수 있습니다.

## 외부 저장소 추가

```bash
# 예: Docker 공식 저장소 추가
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/trusted.gpg.d/docker.gpg

echo "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" \
  > /etc/apt/sources.list.d/docker.list

apt update
apt install docker-ce
```

![apt 고급 사용 패턴](/assets/posts/linux-apt-basics-code.svg)

## 진단 명령

```bash
# 설치된 패키지 목록
apt list --installed

# 업그레이드 가능한 패키지
apt list --upgradable

# 의존성 확인
apt-cache depends nginx
apt-cache rdepends nginx   # 역의존성

# 설치 이력 확인
cat /var/log/apt/history.log

# 깨진 의존성 수리
apt install -f
```

## 캐시 관리

```bash
# 다운로드 캐시 위치
ls /var/cache/apt/archives/

# 오래된 .deb 제거
apt autoclean

# 캐시 전체 비우기
apt clean
```

## apt vs apt-get

`apt`는 `apt-get`의 사용자 친화 래퍼입니다. 스크립트에서는 출력이 안정적인 `apt-get`을, 터미널에서는 컬러 출력과 진행 표시가 있는 `apt`를 쓰는 것이 관례입니다.

## 정리

`apt update` → `apt install`의 흐름을 익히면 데비안 계열 시스템의 소프트웨어 관리는 대부분 처리할 수 있습니다. 버전 고정, 외부 저장소 추가, 의존성 수리까지 알면 운영 환경에서 겪는 대부분의 상황을 다룰 수 있습니다. 다음 글에서는 `apt search`와 `apt show`로 패키지를 검색하고 정보를 조회하는 방법을 다룹니다.

---

**지난 글:** [namespaces 완전 개요](/posts/linux-namespaces-overview/)

**다음 글:** [apt search·show — 패키지 탐색과 정보 조회](/posts/linux-apt-search-show/)

<br>
읽어주셔서 감사합니다. 😊
