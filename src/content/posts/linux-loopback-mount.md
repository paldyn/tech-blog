---
title: "루프백 마운트 — 파일을 블록 디바이스로 다루기"
description: "루프 디바이스의 원리, losetup으로 이미지 파일을 블록 디바이스에 연결하는 방법, ISO 마운트, sparse 이미지, kpartx로 파티션 테이블 처리, LUKS 파일 컨테이너까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["linux", "filesystem", "loopback", "losetup", "loop-device", "iso", "disk-image", "kpartx", "sparse"]
featured: false
draft: false
---

[지난 글](/posts/linux-bind-mount/)에서 Bind Mount로 디렉터리를 재마운트하는 방법을 살펴봤습니다. 이번에는 **루프백 마운트(Loopback Mount)** — 파일을 블록 디바이스처럼 다루는 리눅스의 강력한 기능을 다룹니다. ISO 이미지 마운트, VM 디스크 편집, 암호화 파일 컨테이너까지 폭넓게 활용됩니다.

## 루프 디바이스란

리눅스에서 `/dev/loop0`, `/dev/loop1` 등의 **루프 디바이스**는 파일을 블록 디바이스처럼 보이게 하는 가상 디바이스입니다. 실제 하드웨어가 아니라 파일 시스템이 파일에서 데이터를 읽고 씁니다.

이를 통해 `disk.img` 같은 파일 안에 완전한 파일시스템을 만들고 마운트할 수 있습니다.

![루프백 마운트 원리와 활용 사례](/assets/posts/linux-loopback-mount-concept.svg)

## 기본 사용: 이미지 파일 마운트

### 방법 1: `-o loop` 옵션 (간단)

```bash
# ISO 이미지 마운트
sudo mkdir -p /mnt/iso
sudo mount -o loop,ro ubuntu-24.04.iso /mnt/iso
ls /mnt/iso

# 언마운트
sudo umount /mnt/iso
```

### 방법 2: losetup + mount (세밀한 제어)

```bash
# 빈 이미지 파일 생성 (1GB)
dd if=/dev/zero of=disk.img bs=1M count=1024

# loop 디바이스에 연결 (-f: 사용 가능한 첫 번째, --show: 이름 출력)
sudo losetup -f --show disk.img
# 출력: /dev/loop0

# 파일시스템 생성
sudo mkfs.ext4 /dev/loop0

# 마운트
sudo mkdir -p /mnt/disk
sudo mount /dev/loop0 /mnt/disk

# 사용 후 정리
sudo umount /mnt/disk
sudo losetup -d /dev/loop0
```

![루프백 마운트 명령 상세](/assets/posts/linux-loopback-mount-commands.svg)

## losetup 명령 정리

```bash
# 현재 사용 중인 loop 디바이스 목록
sudo losetup -a
sudo losetup -l  # 테이블 형식

# 특정 파일에 연결된 loop 확인
losetup -j disk.img

# loop 디바이스 해제
sudo losetup -d /dev/loop0

# 모든 loop 해제
sudo losetup -D

# 이미지 크기 조회
sudo losetup --sizelimit 0 /dev/loop0
```

## Sparse 이미지 — 공간 절약

`dd`로 만든 이미지는 선언한 크기만큼 즉시 디스크를 차지합니다. **Sparse 이미지**는 실제로 사용한 만큼만 디스크에 저장됩니다.

```bash
# 10GB sparse 이미지 생성 (실제 디스크 사용량은 거의 0)
truncate -s 10G sparse.img

# 실제 사용량 확인
ls -lh sparse.img      # 10G로 보임
du -sh sparse.img      # 실제 저장 블록만

# 파일시스템 포맷 및 마운트
sudo losetup -f --show sparse.img
sudo mkfs.ext4 -E lazy_itable_init=0 /dev/loop0
sudo mount /dev/loop0 /mnt/sparse
```

## 파티션이 있는 이미지 처리

파티션 테이블이 있는 이미지(VM 디스크 이미지 등)는 단순 `-o loop`로 마운트하면 전체를 하나의 파일시스템으로 보려 하므로 실패합니다.

### kpartx 사용

```bash
sudo apt install kpartx

# 이미지의 파티션을 /dev/mapper/loop0pN 으로 노출
sudo kpartx -av disk.img
# 출력:
# add map loop0p1 (254:0): 0 2048000 linear /dev/loop0 2048
# add map loop0p2 (254:1): 0 18872319 linear /dev/loop0 2050048

# 개별 파티션 마운트
sudo mount /dev/mapper/loop0p1 /mnt/part1
sudo mount /dev/mapper/loop0p2 /mnt/part2

# 해제
sudo umount /mnt/part1 /mnt/part2
sudo kpartx -dv disk.img
```

### 오프셋 계산 후 직접 마운트

파티션 오프셋을 알면 kpartx 없이도 마운트할 수 있습니다.

```bash
# 파티션 정보 확인
fdisk -l disk.img
# Start 열의 섹터 번호 × 512 = 바이트 오프셋

# 예: 파티션이 섹터 2048에서 시작 → 2048 × 512 = 1048576
sudo mount -o loop,offset=1048576 disk.img /mnt/part1
```

## LUKS 암호화 파일 컨테이너

루프 디바이스와 LUKS를 결합하면 파일 기반 암호화 볼트를 만들 수 있습니다.

```bash
# 1. sparse 이미지 생성 (2GB)
truncate -s 2G vault.img

# 2. loop 디바이스 연결
LOOP=$(sudo losetup -f --show vault.img)
echo "Loop: $LOOP"

# 3. LUKS2 포맷
sudo cryptsetup luksFormat --type luks2 "$LOOP"

# 4. 열기
sudo cryptsetup luksOpen "$LOOP" vault

# 5. 파일시스템 생성
sudo mkfs.ext4 /dev/mapper/vault

# 6. 마운트
sudo mkdir -p /mnt/vault
sudo mount /dev/mapper/vault /mnt/vault

# 사용 후 닫기
sudo umount /mnt/vault
sudo cryptsetup luksClose vault
sudo losetup -d "$LOOP"
```

이 vault.img 파일을 USB나 클라우드에 저장하면 이식 가능한 암호화 볼트가 됩니다.

## VM 디스크 이미지 수정 (guestmount)

libguestfs를 사용하면 VM을 끄지 않고도 QCOW2 이미지의 파일을 편집할 수 있습니다.

```bash
sudo apt install libguestfs-tools

# QCOW2 이미지 마운트
sudo guestmount -a vm.qcow2 -i --ro /mnt/vm
ls /mnt/vm/etc/

# 마운트 해제
sudo guestunmount /mnt/vm
```

`-i` 옵션은 파티션을 자동으로 감지합니다. `--ro`는 읽기 전용입니다.

## /etc/fstab에 loop 마운트 등록

```bash
# /etc/fstab
/path/to/disk.img  /mnt/disk  ext4  loop,defaults,nofail  0  0
```

`nofail`을 붙여두면 이미지 파일이 없어도 부팅이 계속됩니다.

## loop 디바이스 수 조정

시스템 기본 loop 디바이스는 256개입니다. 많은 컨테이너나 이미지를 동시에 사용한다면 늘려야 합니다.

```bash
# 현재 최대 수 확인
cat /sys/module/loop/parameters/max_loop

# 영구 설정 (/etc/modprobe.d/loop.conf)
echo "options loop max_loop=64" | sudo tee /etc/modprobe.d/loop.conf

# 즉시 적용
sudo modprobe -r loop
sudo modprobe loop max_loop=64
```

---

**지난 글:** [Bind Mount — 디렉터리를 다른 경로에 재마운트하기](/posts/linux-bind-mount/)

<br>
읽어주셔서 감사합니다. 😊
