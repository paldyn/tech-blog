---
title: "Snap·Flatpak — 배포판 독립 패키지 시스템"
description: "Snap과 Flatpak의 구조적 차이, SquashFS·OSTree 기반 격리 원리, 핵심 명령어, 보안 샌드박스를 비교하고 사용 시나리오를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-15"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["linux", "snap", "flatpak", "snapd", "flathub", "squashfs", "ostree", "sandbox", "apparmor", "bubblewrap"]
featured: false
draft: false
---

[지난 글](/posts/linux-pacman/)에서 Arch Linux의 `pacman`을 살펴봤습니다. `apt`, `dnf`, `pacman`은 각각 Debian, Red Hat, Arch에 묶인 배포판 전용 도구입니다. 하지만 **Snap**과 **Flatpak**은 배포판과 무관하게 같은 패키지를 어디서든 설치할 수 있도록 설계된 범용 패키지 포맷입니다. 앱과 의존성을 하나의 컨테이너에 묶어 배포하고, 샌드박스로 격리한다는 공통 목표를 가지지만 구현 철학은 상당히 다릅니다.

## Snap

Snap은 Canonical(Ubuntu)이 개발했습니다. 패키지(`.snap` 파일)는 **SquashFS 이미지**로 묶여 `/snap/{name}/{revision}/` 에 읽기 전용으로 마운트됩니다. 앱을 실행할 때 이 이미지를 loop 디바이스로 마운트해 파일시스템처럼 사용합니다.

```bash
# snapd 상태 확인
systemctl status snapd

# 검색
snap find "code editor"

# 설치 (기본: stable 채널)
sudo snap install code --classic

# 설치된 snap 목록
snap list

# 업데이트 (자동 갱신, 수동 강제)
sudo snap refresh
sudo snap refresh code

# 제거
sudo snap remove code

# 특정 revision으로 롤백
sudo snap revert code
```

### 채널 시스템

Snap은 `stable`, `candidate`, `beta`, `edge` 네 채널을 제공합니다.

```bash
snap install chromium --channel=beta
snap switch chromium --channel=stable
snap info code | grep -A5 channels
```

`--classic` 옵션은 샌드박스를 해제해 호스트 파일시스템에 자유롭게 접근하게 합니다. VS Code, IntelliJ 같은 IDE에 주로 씁니다. `--devmode`는 개발 중 제한을 완화합니다.

### snapd 데몬

Snap은 `snapd`라는 백그라운드 데몬이 항상 실행되어야 합니다. 이 점이 가장 큰 비판 대상입니다.

```bash
snap services          # snap이 관리하는 서비스 목록
snap logs snapd        # snapd 로그
```

![Snap · Flatpak 핵심 명령어](/assets/posts/linux-snap-flatpak-commands.svg)

## Flatpak

Flatpak은 Red Hat과 GNOME 커뮤니티가 주도합니다. 앱을 **OSTree**(Git과 유사한 파일시스템 버전 관리) 위에 저장하고, **Bubblewrap**으로 샌드박스를 구성합니다. 별도 데몬 없이 `flatpak` CLI만으로 동작한다는 점이 Snap과 다릅니다.

```bash
# Flathub 저장소 추가 (최초 1회)
flatpak remote-add --if-not-exists flathub \
  https://flathub.org/repo/flathub.flatpakrepo

# 검색
flatpak search firefox

# 설치 (애플리케이션 ID 방식)
flatpak install flathub org.mozilla.firefox

# 실행
flatpak run org.mozilla.firefox

# 목록
flatpak list

# 업데이트
flatpak update

# 제거 (사용되지 않는 런타임도 정리)
flatpak uninstall org.mozilla.firefox
flatpak uninstall --unused
```

### 런타임과 SDK

Flatpak의 핵심 특징은 **공유 런타임**입니다. 여러 앱이 `org.gnome.Platform`, `org.freedesktop.Platform` 같은 공통 런타임을 공유해 디스크를 절약합니다.

```bash
# 설치된 런타임 목록
flatpak list --runtime

# 특정 앱의 런타임 정보
flatpak info org.mozilla.firefox
```

### 권한(Permission) 관리

Flatpak 앱은 기본적으로 호스트 파일시스템에 접근할 수 없습니다. **xdg-desktop-portal**을 통해 선택적 접근을 허용합니다.

```bash
# 앱 권한 확인
flatpak info --show-permissions org.mozilla.firefox

# 런타임 권한 수동 조정
flatpak override --user \
  --filesystem=home org.mozilla.firefox

# GUI 도구 (GNOME Software / Flatseal)
flatpak install flathub com.github.tchx84.Flatseal
```

![Snap vs Flatpak 비교](/assets/posts/linux-snap-flatpak-compare.svg)

## 사용 시나리오

| 상황 | 추천 |
|------|------|
| Ubuntu 서버에 최신 데몬 앱 | Snap |
| 데스크탑 GUI 앱 (크로스 배포판) | Flatpak |
| IDE · 개발 도구 | Snap (`--classic`) |
| 세밀한 권한 제어 필요 | Flatpak |
| 서드파티 저장소 없이 설치 | Snap (Snapcraft Store) |

## 정리

Snap은 Canonical 생태계와 통합이 깊고 `--classic`으로 개발 도구에 강점이 있습니다. Flatpak은 공유 런타임으로 디스크를 아끼고 권한 모델이 세밀해 데스크탑 GUI 앱에 적합합니다. 두 시스템은 경쟁하면서도 공존하며, 하나의 배포판에서 둘 다 쓰는 것도 일반적입니다.

---

**지난 글:** [pacman — Arch Linux 패키지 관리자 완전 가이드](/posts/linux-pacman/)

**다음 글:** [소스에서 빌드하기 — ./configure·make·make install](/posts/linux-source-build-make-install/)

<br>
읽어주셔서 감사합니다. 😊
