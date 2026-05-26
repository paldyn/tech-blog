---
title: "systemd-nspawn — systemd 내장 OS 컨테이너 런타임"
description: "systemd-nspawn의 동작 원리, machinectl을 이용한 컨테이너 라이프사이클 관리, 네트워크 격리 옵션, Docker/VM과의 차이를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 3
type: "knowledge"
category: "Linux"
tags: ["linux", "systemd-nspawn", "container", "machinectl", "namespace", "systemd"]
featured: false
draft: false
---

[지난 글](/posts/linux-podman-rootless/)에서 Podman이 루트 권한 없이 컨테이너를 실행하는 방식을 살펴봤습니다. 이번에는 별도 설치 없이 systemd에 포함된 **systemd-nspawn** — 완전한 init 시스템을 갖춘 OS 수준 컨테이너 런타임을 다룹니다.

## systemd-nspawn이란

`systemd-nspawn`은 systemd 패키지에 내장된 컨테이너 런타임으로, 다음 두 가지 방식으로 사용됩니다.

- **비-boot 모드** (`systemd-nspawn -D /rootfs`): chroot처럼 단순히 루트 파일시스템을 바꾸고 셸을 실행
- **boot 모드** (`systemd-nspawn -bD /rootfs`): 컨테이너 내부에서 systemd를 PID 1로 실행 → 완전한 init 시스템 구동

![systemd-nspawn 컨테이너 구조](/assets/posts/linux-systemd-nspawn-arch.svg)

Docker 컨테이너와 달리, boot 모드에서는 게스트 systemd가 서비스를 직접 관리합니다. `systemctl`로 서비스를 시작하고, `journalctl`로 로그를 볼 수 있습니다.

## 컨테이너 루트 파일시스템 준비

### debootstrap으로 Debian 컨테이너

```bash
sudo apt install -y debootstrap systemd-container

# Debian bookworm 루트fs 생성
sudo debootstrap bookworm /var/lib/machines/mydebian

# 컨테이너 부팅
sudo systemd-nspawn -bD /var/lib/machines/mydebian
# 컨테이너 내 systemd 시작 → 로그인 프롬프트 표시
```

### dnf/yum으로 Fedora 컨테이너

```bash
# Fedora 루트fs 생성
sudo dnf --releasever=40 --installroot=/var/lib/machines/myfedora \
    install -y fedora-release systemd passwd dnf

sudo systemd-nspawn -bD /var/lib/machines/myfedora
```

## machinectl로 컨테이너 관리

컨테이너를 `/var/lib/machines/` 아래 배치하면 `machinectl`로 관리할 수 있습니다.

![machinectl 명령어](/assets/posts/linux-systemd-nspawn-commands.svg)

```bash
# 실행 중인 컨테이너 목록
machinectl list

# 컨테이너 시작/정지
machinectl start mydebian
machinectl poweroff mydebian

# 컨테이너 셸 접속
machinectl shell mydebian

# 컨테이너 상태
machinectl status mydebian

# 부팅 시 자동 시작 (systemd 서비스로 등록)
machinectl enable mydebian
```

`machinectl enable`을 실행하면 `/etc/systemd/system/systemd-nspawn@mydebian.service` 파일이 생성되고, 호스트 부팅 시 자동으로 컨테이너가 시작됩니다.

## 네트워크 격리 옵션

```bash
# 네트워크 없음 (격리)
sudo systemd-nspawn -bD /var/lib/machines/mydebian \
    --network-veth

# veth 가상 인터페이스 (브리지 연결)
sudo systemd-nspawn -bD /var/lib/machines/mydebian \
    --network-veth \
    --network-bridge=br0

# 호스트 네트워크 공유 (격리 없음)
sudo systemd-nspawn -bD /var/lib/machines/mydebian \
    --network-namespace-path=

# systemd-networkd로 컨테이너 네트워크 설정
# /etc/systemd/network/80-container.network
```

veth 페어를 사용할 때 호스트 측 인터페이스는 `ve-mydebian`, 컨테이너 측은 `host0`으로 이름이 붙습니다.

## 파일 시스템 공유

```bash
# 호스트 디렉터리를 컨테이너에 바인드 마운트
sudo systemd-nspawn -bD /var/lib/machines/mydebian \
    --bind=/srv/data:/srv/data \
    --bind-ro=/etc/ssl/certs:/etc/ssl/certs

# 임시 오버레이 (컨테이너 변경사항 휘발)
sudo systemd-nspawn -bD /var/lib/machines/mydebian \
    --overlay=+/:/var/lib/machines/overlay-mydebian
```

## .nspawn 설정 파일

반복적인 옵션을 파일로 관리할 수 있습니다.

```ini
# /etc/systemd/nspawn/mydebian.nspawn
[Exec]
Boot=yes
PrivateUsers=pick

[Network]
VirtualEthernet=yes
Bridge=br0

[Files]
Bind=/srv/data:/srv/data
BindReadOnly=/etc/ssl/certs

[System]
CPUQuota=50%
MemoryHigh=512M
```

설정 파일이 있으면 `machinectl start mydebian`만으로 모든 옵션이 적용됩니다.

## Docker와의 비교

| 항목 | systemd-nspawn | Docker |
|------|----------------|--------|
| 데몬 | 없음 (systemd 직접) | dockerd 필요 |
| PID 1 | 게스트 systemd | 앱 프로세스 |
| 서비스 관리 | systemctl (게스트) | docker 명령 |
| 이미지 형식 | 디렉터리 / tar | OCI Image |
| 네트워크 격리 | 선택 가능 | 기본 격리 |
| 용도 | 개발 환경, OS 격리 | 앱 배포, 마이크로서비스 |

## 언제 사용할까

- **OS 업그레이드 테스트**: 새 배포판을 컨테이너에서 먼저 검증
- **레거시 의존성**: 특정 라이브러리 버전이 필요한 앱을 격리
- **CI 빌드 환경**: 컴파일러·도구 체인을 격리된 환경에서 관리
- **경량 VM 대체**: KVM VM 대비 오버헤드가 적음

완전한 VM이 필요하지 않고, Docker 이미지 생태계도 불필요한 경우 systemd-nspawn은 매력적인 선택입니다.

---

**지난 글:** [Podman 루트리스 컨테이너 — 데몬 없이 안전하게](/posts/linux-podman-rootless/)

**다음 글:** [KVM 가상화 — Linux 커널 기반 하이퍼바이저](/posts/linux-kvm-virtualization/)

<br>
읽어주셔서 감사합니다. 😊
