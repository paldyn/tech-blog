---
title: "QEMU 개요 — 범용 에뮬레이터이자 가상화 가속기"
description: "QEMU의 전체 시스템 에뮬레이션과 사용자 모드 에뮬레이션, TCG 동적 번역, KVM 가속 원리, qemu-img 디스크 관리, QEMU Monitor를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["linux", "qemu", "emulation", "virtualization", "kvm", "tcg", "qemu-img", "binfmt"]
featured: false
draft: false
---

[지난 글](/posts/linux-libvirt-virsh/)에서 libvirt/virsh로 KVM VM을 관리하는 방법을 살펴봤습니다. 이번에는 KVM 아래에서 실제 디바이스 에뮬레이션을 담당하고, 동시에 독립적으로 사용할 수 있는 **QEMU(Quick EMUlator)** 의 구조와 활용법을 다룹니다.

## QEMU란

QEMU는 1999년 Fabrice Bellard가 시작한 오픈소스 에뮬레이터/가상화 도구입니다. 두 가지 역할을 합니다.

1. **가상화 가속기 (KVM/Xen과 결합)**: CPU/메모리는 KVM 하드웨어 가속, 나머지 디바이스는 QEMU가 에뮬레이션
2. **독립 에뮬레이터**: KVM 없이 TCG(Tiny Code Generator)로 다른 아키텍처 게스트를 순수 소프트웨어로 에뮬레이션

![QEMU 동작 모드 비교](/assets/posts/linux-qemu-overview-arch.svg)

## 두 가지 실행 모드

### 전체 시스템 에뮬레이션 (qemu-system-*)

전체 하드웨어 환경(CPU, RAM, 디스크, NIC, VGA 등)을 에뮬레이션합니다.

```bash
# x86_64 시스템 에뮬레이션 (KVM 가속)
qemu-system-x86_64 \
    -accel kvm \
    -m 2G \
    -smp 2 \
    -hda ubuntu.qcow2 \
    -net nic -net user

# ARM 시스템 에뮬레이션 (TCG, x86 호스트에서 가능)
qemu-system-aarch64 \
    -M virt \
    -cpu cortex-a57 \
    -m 1G \
    -kernel Image \
    -append "console=ttyAMA0" \
    -nographic
```

### 사용자 모드 에뮬레이션 (qemu-user)

Linux 바이너리만 에뮬레이션합니다. OS 전체가 아닌 개별 프로세스를 다른 아키텍처로 실행합니다.

```bash
# ARM64 바이너리를 x86_64 호스트에서 실행
qemu-aarch64 -L /usr/aarch64-linux-gnu ./hello-aarch64

# binfmt_misc로 자동화 (qemu-user-static 설치 시)
apt install qemu-user-static
./hello-aarch64  # 자동으로 qemu-aarch64-static을 통해 실행
```

`binfmt_misc`는 리눅스 커널의 실행 파일 형식 자동 인식 기능입니다. ARM ELF 실행 파일을 만나면 커널이 자동으로 `qemu-aarch64-static`을 통해 실행합니다. Docker `buildx`의 멀티 아키텍처 빌드가 이 방식을 사용합니다.

## QEMU 직접 실행

![QEMU 직접 실행 예시](/assets/posts/linux-qemu-overview-commands.svg)

```bash
# KVM 가속 VM 실행 (포트 포워딩 포함)
qemu-system-x86_64 \
    -accel kvm \
    -m 2G \
    -smp 2 \
    -hda /var/lib/libvirt/images/ubuntu24.qcow2 \
    -net nic,model=virtio \
    -net user,hostfwd=tcp::2222-:22 \
    -display none \
    -daemonize \
    -monitor unix:/tmp/qemu.sock,server,nowait

# 2222번 포트로 SSH 접속
ssh -p 2222 user@localhost
```

주요 QEMU 옵션:

| 옵션 | 설명 |
|------|------|
| `-accel kvm` | KVM 하드웨어 가속 |
| `-m 2G` | 메모리 크기 |
| `-smp 2` | CPU 코어 수 |
| `-hda file` | 첫 번째 디스크 |
| `-cdrom file` | CD-ROM ISO |
| `-boot d` | CD-ROM 부팅 |
| `-nographic` | 그래픽 없음 (직렬 콘솔) |
| `-daemonize` | 백그라운드 실행 |

## TCG — 동적 이진 번역

TCG(Tiny Code Generator)는 QEMU가 KVM 없이 동작할 때 사용하는 동적 번역 엔진입니다.

```
Guest ARM 명령어 블록
        ↓ (번역)
호스트 x86_64 TCG 중간 표현 (IR)
        ↓ (코드 생성)
호스트 x86_64 기계어 (캐시에 저장)
        ↓ (실행)
```

한 번 번역된 블록은 Translation Block Cache에 저장되어 재사용합니다. 처음에는 느리지만 시간이 지날수록 속도가 올라갑니다. 순수 TCG는 KVM 가속 대비 3~10배 느린 편입니다.

## qemu-img 디스크 이미지 관리

```bash
# 새 qcow2 이미지 생성
qemu-img create -f qcow2 disk.qcow2 20G

# 이미지 정보 확인
qemu-img info disk.qcow2

# 이미지 크기 확장
qemu-img resize disk.qcow2 +10G

# 형식 변환 (raw → qcow2)
qemu-img convert -f raw -O qcow2 disk.raw disk.qcow2

# 스냅샷 목록
qemu-img snapshot -l disk.qcow2

# backing file 체인 (CoW 기반 스냅샷)
qemu-img create -f qcow2 -b base.qcow2 overlay.qcow2
# overlay에 쓰면 base는 변경 없이 차이만 저장
```

## QEMU Monitor

실행 중인 VM을 QEMU Monitor 인터페이스로 실시간 제어할 수 있습니다.

```bash
# stdio 모니터 (시작 시 -monitor stdio)
(qemu) info status
(qemu) info network
(qemu) savevm snap1         # 스냅샷
(qemu) loadvm snap1         # 복원
(qemu) migrate tcp:host:4444  # 마이그레이션
(qemu) device_add virtio-balloon-pci,id=balloon0  # 핫플러그
(qemu) quit

# Unix 소켓 모니터 (virsh가 사용하는 방식)
socat - UNIX-CONNECT:/tmp/qemu.sock
```

## virtio — 반가상화 드라이버

순수 에뮬레이션(e1000, IDE)보다 성능이 훨씬 높은 반가상화 드라이버입니다.

```bash
# virtio 디스크
-drive file=disk.qcow2,if=virtio

# virtio 네트워크
-net nic,model=virtio

# virtio-fs (호스트 디렉터리 공유)
-chardev socket,id=char0,path=/tmp/vhostqemu \
-device vhost-user-fs-pci,chardev=char0,tag=myfs
```

게스트 OS에 virtio 드라이버가 내장되어 있어야 합니다. 현대 Linux 커널은 기본 내장, Windows는 VirtIO 드라이버 패키지를 별도 설치합니다.

---

**지난 글:** [libvirt와 virsh — 가상화 통합 관리 API와 CLI](/posts/linux-libvirt-virsh/)

**다음 글:** [iptables NAT와 Docker 네트워크 — 컨테이너 트래픽 흐름](/posts/linux-iptables-nat-docker/)

<br>
읽어주셔서 감사합니다. 😊
