---
title: "libvirt와 virsh — 가상화 통합 관리 API와 CLI"
description: "libvirt의 아키텍처, virsh CLI로 VM 생명주기·스냅샷·네트워크·스토리지를 관리하는 방법, XML 도메인 정의, 라이브 마이그레이션을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["linux", "libvirt", "virsh", "kvm", "vm", "virtualization", "virt-manager"]
featured: false
draft: false
---

[지난 글](/posts/linux-kvm-virtualization/)에서 KVM 하이퍼바이저의 원리와 기본 설치 방법을 살펴봤습니다. 이번에는 KVM(및 LXC, QEMU 등 여러 하이퍼바이저)을 통합 관리하는 **libvirt** API와 CLI 도구 **virsh**를 체계적으로 다룹니다.

## libvirt 아키텍처

libvirt는 여러 하이퍼바이저(KVM/QEMU, LXC, Xen, VMware ESXi 등)를 단일 API로 추상화합니다. 클라이언트(virsh, virt-manager, 오픈스택 등)는 libvirtd 데몬의 유닉스 소켓 또는 TLS 연결을 통해 하이퍼바이저와 통신합니다.

![libvirt 아키텍처](/assets/posts/linux-libvirt-virsh-arch.svg)

주요 연결 URI:
- `qemu:///system` — 로컬 KVM (시스템 권한)
- `qemu:///session` — 로컬 KVM (사용자 권한, rootless)
- `qemu+ssh://user@host/system` — 원격 KVM

## virsh 기본 사용법

![virsh 필수 명령어](/assets/posts/linux-libvirt-virsh-commands.svg)

```bash
# libvirtd에 연결 (기본: qemu:///system)
virsh

# 특정 URI 지정
virsh -c qemu+ssh://admin@192.168.1.10/system

# VM(도메인) 목록
virsh list --all

# VM 시작 / 정상 종료 / 강제 종료
virsh start ubuntu24
virsh shutdown ubuntu24
virsh destroy ubuntu24   # SIGKILL 수준 강제 종료

# 부팅 시 자동 시작
virsh autostart ubuntu24
virsh autostart --disable ubuntu24
```

## XML 도메인 정의

virsh에서 VM 설정은 XML 형식으로 관리됩니다. `virsh dumpxml`로 현재 설정을 확인하고, `virsh edit`으로 편집합니다.

```bash
# 현재 XML 설정 출력
virsh dumpxml ubuntu24

# 실시간 편집 (편집 후 즉시 적용)
virsh edit ubuntu24
```

주요 XML 요소:

```xml
<domain type='kvm'>
  <name>ubuntu24</name>
  <memory unit='MiB'>2048</memory>
  <vcpu placement='static'>2</vcpu>
  <os>
    <type arch='x86_64'>hvm</type>
    <boot dev='hd'/>
  </os>
  <devices>
    <disk type='file' device='disk'>
      <driver name='qemu' type='qcow2'/>
      <source file='/var/lib/libvirt/images/ubuntu24.qcow2'/>
      <target dev='vda' bus='virtio'/>
    </disk>
    <interface type='network'>
      <source network='default'/>
      <model type='virtio'/>
    </interface>
  </devices>
</domain>
```

## 스냅샷 관리

```bash
# 스냅샷 생성
virsh snapshot-create-as ubuntu24 \
    --name "before-upgrade" \
    --description "Ubuntu 24 업그레이드 전"

# 스냅샷 목록
virsh snapshot-list ubuntu24

# 특정 스냅샷 상세 정보
virsh snapshot-info ubuntu24 before-upgrade

# 스냅샷으로 복원
virsh snapshot-revert ubuntu24 before-upgrade

# 스냅샷 삭제
virsh snapshot-delete ubuntu24 before-upgrade
```

## 네트워크 관리

```bash
# 가상 네트워크 목록
virsh net-list --all

# 기본 NAT 네트워크 시작
virsh net-start default
virsh net-autostart default

# 네트워크 상세 정보 (XML)
virsh net-dumpxml default

# 새 네트워크 정의
cat > mynet.xml <<'EOF'
<network>
  <name>mynet</name>
  <forward mode='nat'/>
  <bridge name='virbr1'/>
  <ip address='192.168.100.1' netmask='255.255.255.0'>
    <dhcp>
      <range start='192.168.100.10' end='192.168.100.100'/>
    </dhcp>
  </ip>
</network>
EOF
virsh net-define mynet.xml
virsh net-start mynet

# VM에 NIC 핫플러그
virsh attach-interface ubuntu24 \
    --type network --source mynet \
    --model virtio --live
```

## 스토리지 풀 관리

```bash
# 스토리지 풀 목록
virsh pool-list --all

# 기본 풀의 볼륨 목록
virsh vol-list default

# 새 디스크 이미지 생성
virsh vol-create-as default \
    data-disk.qcow2 50G --format qcow2

# VM에 디스크 핫플러그
virsh attach-disk ubuntu24 \
    /var/lib/libvirt/images/data-disk.qcow2 vdb \
    --driver qemu --type disk --subdriver qcow2 \
    --live --config
```

## VM 리소스 실시간 조정

```bash
# 메모리 조정 (--live: 즉시, --config: 영구)
virsh setmem ubuntu24 4096M --live --config

# vCPU 수 조정
virsh setvcpus ubuntu24 4 --live --config

# CPU 핀닝 (vCPU → 물리 코어)
virsh vcpupin ubuntu24 0 2
virsh vcpupin ubuntu24 1 3

# CPU/메모리 사용량 확인
virsh cpu-stats ubuntu24
virsh dommemstat ubuntu24
```

## 라이브 마이그레이션

```bash
# 두 KVM 호스트 간 VM 라이브 마이그레이션
# (공유 스토리지가 있거나 블록 마이그레이션 사용)
virsh migrate --live ubuntu24 \
    qemu+ssh://192.168.1.20/system \
    --verbose

# 블록 장치도 함께 마이그레이션
virsh migrate --live --copy-storage-all ubuntu24 \
    qemu+ssh://192.168.1.20/system
```

라이브 마이그레이션 시 VM 다운타임이 밀리초 수준으로 줄어 운영 중인 서비스를 중단 없이 다른 호스트로 이전할 수 있습니다.

## Python으로 libvirt API 사용

```python
import libvirt

# 로컬 KVM 연결
conn = libvirt.open('qemu:///system')

# 모든 VM 목록
for dom in conn.listAllDomains():
    print(f"{dom.name()} - {dom.state()[0]}")

# VM 시작
dom = conn.lookupByName('ubuntu24')
dom.create()

conn.close()
```

---

**지난 글:** [KVM 가상화 — Linux 커널 내장 하이퍼바이저](/posts/linux-kvm-virtualization/)

**다음 글:** [QEMU 개요 — 에뮬레이터이자 가상화 도구](/posts/linux-qemu-overview/)

<br>
읽어주셔서 감사합니다. 😊
