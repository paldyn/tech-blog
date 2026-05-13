---
title: "rpm — Red Hat 패키지의 저수준 관리"
description: "rpm 명령어의 설치·제거·조회(-q)·검증(-V) 옵션, .rpm 파일 구조, GPG 서명 검증, rpm 데이터베이스 재구성 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["linux", "rpm", "rhel", "centos", "package", "gpg", "rpm2cpio", "rpm-database", "spec-file"]
featured: false
draft: false
---

[지난 글](/posts/linux-yum-dnf/)에서 `dnf`로 Red Hat 계열 패키지를 관리하는 방법을 배웠습니다. `dnf`가 Debian의 `apt`라면, **rpm**은 `dpkg`에 해당하는 저수준 도구입니다. `.rpm` 파일을 파일시스템에 배치하고, 패키지 데이터베이스를 관리하며, 파일 무결성을 검증하는 엔진입니다.

## .rpm 파일 구조

rpm 파일명은 형식이 정해져 있습니다.

```
nginx-1.26.0-1.el9.x86_64.rpm
│      │       │    │      └── 아키텍처 (noarch, x86_64, aarch64)
│      │       │    └── 배포판 태그 (el9=RHEL9, fc40=Fedora40)
│      │       └── 릴리스 번호
│      └── 버전
└── 패키지명
```

파일 내부는 4개 섹션으로 구성됩니다.

![.rpm 패키지 구조](/assets/posts/linux-rpm-structure.svg)

## rpm 핵심 명령어

rpm 옵션은 크게 설치(-i, -U), 제거(-e), 조회(-q), 검증(-V)으로 나뉩니다.

![rpm 핵심 명령어](/assets/posts/linux-rpm-commands.svg)

```bash
# 설치 (verbose + 진행 표시)
rpm -ivh package.rpm

# 업그레이드 (없으면 설치)
rpm -Uvh package.rpm

# 다운그레이드 포함 강제 교체
rpm -Fvh package.rpm

# 제거
rpm -e nginx
```

### 조회 옵션 (-q)

```bash
rpm -q nginx             # 설치 여부 + 버전
rpm -qi nginx            # 상세 정보 (info)
rpm -ql nginx            # 설치된 파일 목록
rpm -qc nginx            # 설정 파일만
rpm -qd nginx            # 문서 파일만
rpm -qf /etc/nginx.conf  # 파일 소속 패키지

# 설치 전 .rpm 파일 조회
rpm -qpl nginx.rpm       # 파일 목록
rpm -qpi nginx.rpm       # 패키지 정보
```

### 검증 옵션 (-V)

설치된 파일이 변조되지 않았는지 확인합니다.

```bash
rpm -V nginx

# 출력 예: S.5....T.  /etc/nginx/nginx.conf
# S=크기 변경, 5=MD5 불일치, T=시간 변경
# 보안 감사에 유용
```

출력 코드 의미:

| 코드 | 의미 |
|------|------|
| `S` | 파일 크기 변경 |
| `M` | 파일 모드/권한 변경 |
| `5` | MD5 체크섬 불일치 |
| `L` | 심볼릭 링크 변경 |
| `T` | 수정 시간 변경 |
| `U` | 소유자 변경 |
| `G` | 그룹 변경 |

## GPG 서명 검증

```bash
# 신뢰할 수 있는 GPG 키 추가
rpm --import https://nginx.org/keys/nginx_signing.key

# 키 목록 확인
rpm -q gpg-pubkey --qf '%{name}-%{version}-%{release} --> %{summary}\n'

# 서명 검증
rpm -K nginx.rpm
# nginx.rpm: digests signatures OK

# 설치된 패키지 서명 일괄 검증
rpm -Va --nofiles --nodigest
```

## rpm 데이터베이스

```bash
# DB 위치
ls /var/lib/rpm/

# DB 재구성 (손상 시)
rpm --rebuilddb

# 재구성 전 백업
cp -a /var/lib/rpm /var/lib/rpm.bak
```

RHEL 9부터는 SQLite 기반 DB를 사용합니다. `rpmdb_dump`나 `rpmdb_load`로 내보내고 가져올 수도 있습니다.

## .rpm 파일에서 파일 추출

설치하지 않고 `.rpm` 안의 파일만 꺼낼 때 `rpm2cpio`를 씁니다.

```bash
# 현재 디렉터리에 파일 추출
rpm2cpio nginx.rpm | cpio -idv

# 특정 파일만 추출
rpm2cpio nginx.rpm | cpio -idv './etc/nginx/nginx.conf'
```

## rpm 스펙 파일 (패키지 빌드)

```bash
# 빌드 도구 설치
dnf install rpm-build rpmdevtools

# 빌드 환경 초기화
rpmdev-setuptree
ls ~/rpmbuild/  # SOURCES SPECS BUILD RPMS SRPMS

# .spec 파일 작성 후 빌드
rpmbuild -ba ~/rpmbuild/SPECS/myapp.spec

# 소스 rpm만 빌드
rpmbuild -bs myapp.spec
```

## 정리

`rpm`은 Red Hat 계열에서 `dpkg`에 해당하는 저수준 패키지 엔진입니다. `-q`로 설치 정보를 조회하고, `-V`로 파일 무결성을 검증하며, `-K`로 GPG 서명을 확인합니다. 평소엔 `dnf`를 쓰지만, `.rpm`을 직접 다루거나 DB를 복구할 때는 `rpm`이 필수입니다. 다음 글에서는 Arch Linux 계열의 패키지 관리자 `pacman`을 다룹니다.

---

**지난 글:** [yum / dnf — Red Hat 계열 패키지 관리자](/posts/linux-yum-dnf/)

**다음 글:** [pacman — Arch Linux 패키지 관리자 완전 가이드](/posts/linux-pacman/)

<br>
읽어주셔서 감사합니다. 😊
