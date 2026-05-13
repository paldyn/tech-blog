---
title: "pacman — Arch Linux 패키지 관리자 완전 가이드"
description: "Arch Linux의 pacman 패키지 관리자, -S/-R/-Q/-U 옵션, AUR(Arch User Repository), PKGBUILD, makepkg, yay/paru AUR 헬퍼 사용법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["linux", "pacman", "arch", "aur", "pkgbuild", "makepkg", "yay", "paru", "package-manager"]
featured: false
draft: false
---

[지난 글](/posts/linux-rpm/)에서 rpm의 저수준 조작을 살펴봤습니다. 이번엔 배포판 중 가장 간결한 설계를 자랑하는 Arch Linux의 **pacman** 패키지 관리자를 다룹니다. Arch, Manjaro, EndeavourOS, Garuda Linux 등 Arch 기반 배포판이라면 모두 pacman을 씁니다.

## pacman의 특징

`pacman`은 단순함을 철학으로 합니다. 바이너리 저장소와 소스 기반 AUR(Arch User Repository)을 함께 지원하며, 트랜잭션 방식으로 패키지를 관리합니다.

```bash
# pacman 버전 확인
pacman --version

# 저장소 설정
cat /etc/pacman.conf
```

## 저장소 구조

| 저장소 | 내용 |
|-------|------|
| `core` | 부트·네트워크 등 핵심 패키지 |
| `extra` | 데스크탑·개발 도구 등 |
| `multilib` | 64비트에서 32비트 호환 라이브러리 |
| `AUR` | 커뮤니티 기여 PKGBUILD (비공식) |

## 핵심 명령어

![pacman 패키지 관리 흐름](/assets/posts/linux-pacman-flow.svg)

pacman 옵션은 크게 `-S`(동기), `-R`(제거), `-Q`(조회), `-U`(로컬 설치)로 나뉩니다.

### -S (Sync) — 동기화 및 설치

```bash
# 데이터베이스 동기화 + 전체 업그레이드 (기본 루틴)
pacman -Syu

# 패키지 설치
pacman -S nginx git curl

# 저장소 검색
pacman -Ss nginx

# 패키지 정보 (원격)
pacman -Si nginx

# 캐시 정리
pacman -Sc   # 구버전 캐시 삭제
pacman -Scc  # 전체 캐시 삭제
```

### -R (Remove) — 제거

```bash
# 단순 제거
pacman -R nginx

# 의존성(고아 패키지) 포함 제거
pacman -Rs nginx

# 설정 파일까지 완전 제거
pacman -Rns nginx
```

### -Q (Query) — 조회

```bash
# 설치된 패키지 목록
pacman -Q

# 상세 정보
pacman -Qi nginx

# 파일 목록
pacman -Ql nginx

# 파일 → 패키지
pacman -Qo /usr/bin/curl

# 의존성 없이 설치된 고아 패키지
pacman -Qdt

# 명시적으로 설치된 패키지만
pacman -Qe
```

## AUR — Arch User Repository

AUR은 커뮤니티가 관리하는 비공식 저장소로, `PKGBUILD`라는 빌드 스크립트 형태로 패키지를 공유합니다. pacman은 AUR을 직접 지원하지 않으며, `yay`나 `paru` 같은 AUR 헬퍼가 필요합니다.

![PKGBUILD와 AUR 설치 흐름](/assets/posts/linux-pacman-pkgbuild.svg)

### 수동 AUR 설치

```bash
# 1. git clone
git clone https://aur.archlinux.org/yay.git
cd yay

# 2. PKGBUILD 반드시 검토!
less PKGBUILD

# 3. 빌드 및 설치
makepkg -si
```

### yay — AUR 헬퍼

```bash
# yay 설치 후 사용
yay -S visual-studio-code-bin

# 검색 (공식 + AUR)
yay -Ss code

# 업그레이드 (공식 + AUR)
yay -Syu

# AUR 패키지만 업그레이드
yay -Sua
```

## PKGBUILD

PKGBUILD는 패키지 빌드 방법을 기술한 bash 스크립트입니다. `makepkg`가 이를 실행해 `.pkg.tar.zst` 파일을 생성하고 설치합니다.

```bash
# PKGBUILD로 패키지 빌드만
makepkg

# 빌드 + 설치
makepkg -si

# 의존성 설치 포함
makepkg -s

# 이미 있으면 다시 빌드 안 함
makepkg -e
```

## 잠금 파일 처리

```bash
# pacman 실행 중 락 파일
ls /var/lib/pacman/db.lck

# 정말 pacman이 실행 중이 아닐 때만 삭제
rm /var/lib/pacman/db.lck
```

## 패키지 캐시

```bash
# 다운로드된 패키지 위치
ls /var/cache/pacman/pkg/

# 최근 3버전 제외 캐시 정리 (paccache)
paccache -r

# 전체 캐시 삭제
pacman -Scc
```

## downgrade — 버전 다운그레이드

```bash
# 캐시에서 이전 버전 설치
pacman -U /var/cache/pacman/pkg/nginx-1.24.0-1-x86_64.pkg.tar.zst

# downgrade 패키지 사용 (AUR)
downgrade nginx
```

## 정리

`pacman`은 `-S/-R/-Q/-U` 네 가지 주요 옵션으로 거의 모든 패키지 작업을 처리합니다. `pacman -Syu`를 정기적으로 실행해 시스템을 롤링 업데이트로 최신 상태로 유지하는 것이 Arch Linux의 기본 관리 방식입니다. AUR은 방대한 패키지 생태계를 제공하지만, 커뮤니티 관리이므로 반드시 PKGBUILD를 직접 검토한 뒤 설치해야 합니다.

---

**지난 글:** [rpm — Red Hat 패키지의 저수준 관리](/posts/linux-rpm/)

<br>
읽어주셔서 감사합니다. 😊
