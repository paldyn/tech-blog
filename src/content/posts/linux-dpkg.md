---
title: "dpkg 완전 이해 — .deb 패키지 저수준 관리"
description: "dpkg의 역할, .deb 패키지 구조, dpkg -i/-r/-l/-L/-S 명령, dpkg 데이터베이스, 설치 라이프사이클과 유지보수 스크립트를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 7
type: "knowledge"
category: "Linux"
tags: ["linux", "dpkg", "deb", "package", "debian", "ubuntu", "dpkg-deb", "control", "postinst"]
featured: false
draft: false
---

[지난 글](/posts/linux-apt-search-show/)에서 `apt search`와 `apt show`로 패키지를 탐색하는 방법을 배웠습니다. `apt`는 `dpkg` 위에 올라간 고수준 도구입니다. 이번엔 그 아래의 저수준 패키지 관리자인 **dpkg**를 직접 다뤄봅니다. `.deb` 파일이 어떻게 생겼는지, dpkg 데이터베이스가 어디에 무엇을 기록하는지 이해하면 패키지 문제 대부분을 스스로 해결할 수 있습니다.

## dpkg의 역할

`dpkg`는 **Debian Package**의 약자로, `.deb` 파일을 파일시스템에 풀고 데이터베이스를 관리하는 저수준 도구입니다. 의존성 해결은 하지 않으며, 그 역할은 `apt`가 담당합니다.

```
apt (의존성 해결 + 저장소 관리)
 └── dpkg (실제 설치·제거·DB 관리)
      └── dpkg-deb (.deb 아카이브 처리)
```

## .deb 패키지 구조

`.deb` 파일은 실제로 `ar` 아카이브로, 세 부분으로 구성됩니다.

```bash
# .deb 내부 확인
ar tv nginx.deb
# debian-binary
# control.tar.xz
# data.tar.xz

# control 파일 보기
dpkg -I nginx.deb
```

- `debian-binary`: 패키지 형식 버전("2.0")
- `control.tar.xz`: 패키지 메타데이터 + 유지보수 스크립트
- `data.tar.xz`: 실제 설치될 파일들

![.deb 패키지 구조와 dpkg DB](/assets/posts/linux-dpkg-structure.svg)

## 유지보수 스크립트

설치·제거 시 자동 실행되는 쉘 스크립트입니다.

| 스크립트 | 실행 시점 |
|----------|----------|
| `preinst` | 파일 배치 전 |
| `postinst` | 파일 배치 후 (서비스 시작 등) |
| `prerm` | 파일 제거 전 (서비스 중단 등) |
| `postrm` | 파일 제거 후 |

```bash
# 설치된 패키지의 스크립트 확인
cat /var/lib/dpkg/info/nginx.postinst
```

## dpkg 핵심 명령어

![dpkg 핵심 명령어](/assets/posts/linux-dpkg-commands.svg)

```bash
# .deb 직접 설치 (의존성 없을 시 오류)
dpkg -i package.deb

# 의존성 오류 발생 시 apt로 해결
apt install -f

# 설치된 패키지 목록
dpkg -l
dpkg -l 'nginx*'   # 패턴 검색

# 패키지가 설치한 파일 목록
dpkg -L nginx

# 파일이 어느 패키지 소속인지
dpkg -S /usr/sbin/nginx

# 설치된 패키지 정보
dpkg -s nginx
```

## dpkg 상태 코드

`dpkg -l` 출력의 첫 두 컬럼은 원하는 상태(want)와 실제 상태(status)를 나타냅니다.

```
ii  nginx  1.24.0  - 정상 설치됨
rc  nginx  ...     - 제거됐지만 설정파일 남아 있음
un  nginx  ...     - 알 수 없음 (설치 안 됨)
```

`r`이 보이면 `apt purge 패키지명`으로 설정파일까지 제거하세요.

## dpkg 데이터베이스

```bash
# 모든 설치 정보가 저장되는 위치
ls /var/lib/dpkg/

# 패키지 상태 파일 (직접 수정 금지)
head -30 /var/lib/dpkg/status

# 특정 패키지 상태 조회
grep -A 20 "^Package: nginx$" /var/lib/dpkg/status
```

## .deb 파일에서 파일 추출

```bash
# 설치하지 않고 파일만 꺼내기
dpkg-deb -x nginx.deb /tmp/nginx-extracted/

# control 정보만 추출
dpkg-deb -e nginx.deb /tmp/nginx-ctrl/

# .deb 내 파일 목록 (설치 안 함)
dpkg -c nginx.deb
```

## 깨진 패키지 복구

```bash
# 중간에 실패한 설치 완료
dpkg --configure -a

# 설치된 파일 무결성 검사
dpkg -V nginx
# 출력 없음 = 정상, 출력 있음 = 변경됨

# 강제 재설치
apt install --reinstall nginx
```

## 정리

`dpkg`는 `.deb` 파일을 파일시스템에 배치하고 `/var/lib/dpkg/` 데이터베이스를 관리하는 저수준 엔진입니다. 평소에는 `apt`를 쓰지만, 오프라인 설치나 패키지 내부 파일 확인, 깨진 DB 복구 시에는 `dpkg`를 직접 써야 합니다. 다음 글에서는 Red Hat 계열의 패키지 관리자 `yum`과 `dnf`를 다룹니다.

---

**지난 글:** [apt search · show — 패키지 탐색과 정보 조회](/posts/linux-apt-search-show/)

**다음 글:** [yum / dnf — Red Hat 계열 패키지 관리자](/posts/linux-yum-dnf/)

<br>
읽어주셔서 감사합니다. 😊
