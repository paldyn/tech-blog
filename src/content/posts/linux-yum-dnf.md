---
title: "yum / dnf — Red Hat 계열 패키지 관리자 완전 가이드"
description: "RHEL/CentOS/Fedora에서 사용하는 yum과 dnf의 차이, 주요 명령어, 저장소 설정, 모듈 스트림, 트랜잭션 롤백, versionlock 사용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 8
type: "knowledge"
category: "Linux"
tags: ["linux", "dnf", "yum", "rpm", "rhel", "centos", "fedora", "package-manager", "epel", "module-stream"]
featured: false
draft: false
---

[지난 글](/posts/linux-dpkg/)에서 Debian 계열의 저수준 패키지 도구 `dpkg`를 살펴봤습니다. 이번엔 Red Hat 계열(RHEL, CentOS Stream, Fedora, Rocky Linux, AlmaLinux)의 패키지 관리자인 **yum**과 그 후계자 **dnf**를 다룹니다.

## yum과 dnf의 관계

RHEL 8부터 `yum`은 `dnf`의 심볼릭 링크가 됐습니다. 명령 문법은 거의 동일하지만 내부가 다릅니다.

```bash
# RHEL 8+에서 yum은 dnf와 동일
which yum       # /usr/bin/dnf (심볼릭 링크)
dnf --version
```

`dnf`는 파이썬3 기반이고 `libsolv`를 사용해 더 빠르고 정확한 의존성 해결을 제공합니다. `yum`을 아는 사람이라면 `dnf`를 바로 쓸 수 있습니다.

![yum / dnf 명령 흐름](/assets/posts/linux-yum-dnf-flow.svg)

## 저장소 설정

저장소 파일은 `/etc/yum.repos.d/*.repo`에 위치합니다.

```ini
[nginx-stable]
name=nginx stable repo
baseurl=http://nginx.org/packages/rhel/$releasever/$basearch/
gpgcheck=1
enabled=1
gpgkey=https://nginx.org/keys/nginx_signing.key
```

```bash
# 활성화된 저장소 목록
dnf repolist

# 비활성 포함 전체
dnf repolist all

# 저장소 추가 (자동)
dnf config-manager --add-repo URL

# 저장소 활성/비활성
dnf config-manager --enable powertools
dnf config-manager --disable powertools
```

## 기본 명령어

```bash
# 메타데이터 갱신 (apt update와 유사)
dnf check-update
dnf makecache

# 설치
dnf install nginx
dnf install nginx-1.24.0

# 제거
dnf remove nginx

# 전체 업데이트
dnf update
dnf update nginx   # 단일 패키지

# 검색 및 정보
dnf search nginx
dnf info nginx
dnf list installed
dnf list available | grep nginx
```

## EPEL — Extra Packages for Enterprise Linux

RHEL에는 없는 패키지를 EPEL 저장소에서 가져올 수 있습니다.

```bash
# EPEL 활성화
dnf install epel-release

# RHEL의 경우 subscription-manager도 필요
subscription-manager repos --enable codeready-builder-for-rhel-9-x86_64-rpms
dnf install epel-release
```

## 패키지 그룹

관련 패키지를 묶은 그룹을 한 번에 설치할 수 있습니다.

```bash
# 그룹 목록
dnf group list

# 개발 도구 그룹 설치
dnf group install "Development Tools"

# 그룹 정보
dnf group info "Development Tools"
```

## 모듈 스트림 (dnf 전용)

동일 패키지의 여러 버전을 스트림으로 관리합니다. Node.js, PHP, PostgreSQL처럼 버전 선택이 필요한 패키지에 유용합니다.

```bash
# 사용 가능한 모듈 스트림 확인
dnf module list nodejs

# 특정 버전 스트림 활성화
dnf module enable nodejs:20

# 해당 스트림으로 설치
dnf install nodejs

# 스트림 전환 (기존 패키지 포함)
dnf module reset nodejs
dnf module enable nodejs:22
dnf distro-sync
```

## 트랜잭션 이력 및 롤백

dnf는 모든 설치/제거 작업을 트랜잭션으로 기록합니다. 이 덕분에 실수를 되돌릴 수 있습니다.

![dnf 고급 기능](/assets/posts/linux-yum-dnf-advanced.svg)

```bash
# 이력 보기
dnf history

# 특정 트랜잭션 상세
dnf history info 3

# 특정 트랜잭션 롤백
dnf history undo 3

# 마지막 트랜잭션 취소
dnf history undo last
```

## 버전 고정

```bash
# versionlock 플러그인 설치
dnf install 'dnf-command(versionlock)'

# 버전 고정
dnf versionlock add nginx

# 고정 목록 확인
dnf versionlock list

# 고정 해제
dnf versionlock delete nginx
```

## 파일로 패키지 찾기

```bash
# 어떤 패키지가 이 파일을 제공하는지
dnf provides /usr/bin/curl

# 라이브러리로 검색
dnf provides "*/libssl.so*"
```

## 정리

`dnf`는 RHEL 계열의 표준 패키지 관리자입니다. `apt`와 명령 이름만 다를 뿐 개념은 유사하지만, **모듈 스트림**과 **트랜잭션 롤백**은 dnf만의 강점입니다. 다음 글에서는 dnf 아래의 저수준 도구인 `rpm`을 살펴봅니다.

---

**지난 글:** [dpkg 완전 이해](/posts/linux-dpkg/)

**다음 글:** [rpm — Red Hat 패키지의 저수준 관리](/posts/linux-rpm/)

<br>
읽어주셔서 감사합니다. 😊
