---
title: "KVM 가상화 — Linux 커널 내장 하이퍼바이저"
description: "KVM(Kernel-based Virtual Machine)의 동작 원리, QEMU와의 관계, Intel VT-x/AMD-V 하드웨어 가속, VM 생성과 관리 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["linux", "kvm", "virtualization", "qemu", "hypervisor", "vm", "virt-manager"]
featured: false
draft: false
---

[지난 글](/posts/linux-systemd-nspawn/)에서 systemd-nspawn으로 호스트 커널을 공유하는 OS 컨테이너를 살펴봤습니다. 이번에는 완전한 하드웨어 가상화를 제공하는 **KVM(Kernel-based Virtual Machine)** — Linux 커널에 내장된 Type-1 하이퍼바이저를 다룹니다.

## KVM이란

KVM은 2007년 Linux 2.6.20에 메인라인에 포함된 커널 모듈(`kvm.ko`, `kvm_intel.ko` 또는 `kvm_amd.ko`)입니다. 일반 Linux 프로세스로 게스트 VM을 실행하면서, `/dev/kvm`을 통해 CPU 하드웨어 가상화 확장(Intel VT-x, AMD-V)을 직접 활용합니다.

KVM만으로는 완전한 VM이 되지 않습니다. **QEMU**가 가상 디스크, 가상 NIC, VGA 등의 디바이스를 에뮬레이션하고, KVM은 CPU/메모리 가상화의 빠른 실행 경로를 제공합니다.

![KVM 가상화 스택 아키텍처](/assets/posts/linux-kvm-virtualization-arch.svg)

## KVM vs 컨테이너

| 항목 | KVM VM | 컨테이너 (Docker/nspawn) |
|------|--------|--------------------------|
| 커널 | 게스트 전용 커널 | 호스트 커널 공유 |
| 격리 강도 | 강함 (하드웨어 경계) | 상대적으로 약함 |
| 메모리 오버헤드 | GB 단위 | MB 단위 |
| 부팅 시간 | 수 초~수십 초 | 밀리초 |
| 용도 | 강한 격리, 다른 OS | 빠른 배포, 마이크로서비스 |

## 설치와 준비

![KVM 설치 및 기본 설정](/assets/posts/linux-kvm-virtualization-setup.svg)

```bash
# 1. CPU 가상화 지원 확인
grep -c 'vmx\|svm' /proc/cpuinfo
# 0이 아니면 VT-x(Intel) 또는 AMD-V 지원

# 2. KVM 패키지 설치 (Ubuntu/Debian)
sudo apt install -y qemu-kvm libvirt-daemon-system \
    libvirt-clients bridge-utils virtinst virt-manager

# Fedora/RHEL
sudo dnf install -y @virtualization

# 3. libvirtd 서비스 시작
sudo systemctl enable --now libvirtd

# 4. 현재 사용자를 libvirt, kvm 그룹에 추가
sudo usermod -aG libvirt,kvm $USER
newgrp libvirt  # 현재 셸에 즉시 적용

# 5. /dev/kvm 확인
ls -la /dev/kvm
# crw-rw---- 1 root kvm ...
```

## VM 생성

```bash
# ISO 파일로 VM 설치 (virt-install)
virt-install \
  --name ubuntu24 \
  --ram 2048 \
  --vcpus 2 \
  --disk path=/var/lib/libvirt/images/ubuntu24.qcow2,size=20,format=qcow2 \
  --os-variant ubuntu24.04 \
  --network bridge=virbr0 \
  --graphics vnc \
  --cdrom /path/to/ubuntu-24.04-server.iso \
  --boot cdrom,hd

# 설치 없이 cloud-init 이미지로 빠른 VM 생성
wget https://cloud-images.ubuntu.com/jammy/current/jammy-server-cloudimg-amd64.img
sudo cp jammy-server-cloudimg-amd64.img /var/lib/libvirt/images/vm1.qcow2
sudo qemu-img resize /var/lib/libvirt/images/vm1.qcow2 +10G
```

## virsh로 VM 관리

```bash
# VM 목록 (실행 중)
virsh list

# 모든 VM (정지 포함)
virsh list --all

# VM 시작/정지/재시작
virsh start ubuntu24
virsh shutdown ubuntu24    # 정상 종료
virsh destroy ubuntu24     # 강제 종료 (kill)
virsh reboot ubuntu24

# VM 일시정지 / 재개
virsh suspend ubuntu24
virsh resume ubuntu24

# VM 정보
virsh dominfo ubuntu24
virsh vcpuinfo ubuntu24
virsh domifaddr ubuntu24   # VM의 IP 주소 확인

# VM 콘솔 접속
virsh console ubuntu24
# 빠져나올 때: Ctrl+]
```

## 스냅샷

```bash
# 스냅샷 생성 (qcow2 내부)
virsh snapshot-create-as ubuntu24 snap1 "before upgrade"

# 스냅샷 목록
virsh snapshot-list ubuntu24

# 스냅샷으로 복원
virsh snapshot-revert ubuntu24 snap1

# 스냅샷 삭제
virsh snapshot-delete ubuntu24 snap1
```

## 네트워크 모드

libvirt는 기본적으로 `virbr0` 브리지와 NAT 네트워크(`192.168.122.0/24`)를 제공합니다.

```bash
# 기본 네트워크 확인
virsh net-list --all
virsh net-info default

# 브리지 네트워크 (호스트와 같은 네트워크 대역 사용)
# /etc/netplan 또는 NetworkManager에 br0 브리지 설정 후:
virt-install --network bridge=br0 ...

# VM간 통신만: 격리 네트워크
virsh net-define isolated.xml
```

## virt-manager GUI

`virt-manager`를 설치하면 VM 생성, 시작/정지, 콘솔, 스냅샷을 그래픽 인터페이스로 관리할 수 있습니다. 원격 KVM 호스트에 SSH로 연결해 관리하는 것도 가능합니다.

```bash
# GUI 설치
sudo apt install -y virt-manager

# SSH 터널로 원격 KVM 호스트 연결
virt-manager --connect qemu+ssh://user@remotehost/system
```

## 성능 최적화

```bash
# virtio 드라이버 사용 (반가상화 — 에뮬레이션보다 빠름)
virt-install --disk ...,bus=virtio \
             --network model=virtio

# CPU 핀닝 (물리 코어에 vCPU 고정)
virsh vcpupin ubuntu24 0 2   # vCPU 0 → 물리 코어 2
virsh vcpupin ubuntu24 1 3   # vCPU 1 → 물리 코어 3

# hugepage 메모리
virsh edit ubuntu24
# <memoryBacking><hugepages/></memoryBacking> 추가

# KSM (Kernel Samepage Merging) — 메모리 중복 제거
echo 1 > /sys/kernel/mm/ksm/run
```

---

**지난 글:** [systemd-nspawn — systemd 내장 OS 컨테이너 런타임](/posts/linux-systemd-nspawn/)

**다음 글:** [libvirt와 virsh — 가상화 관리 API와 CLI](/posts/linux-libvirt-virsh/)

<br>
읽어주셔서 감사합니다. 😊
