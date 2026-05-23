---
title: "LUKS — 리눅스 디스크 전체 암호화"
description: "LUKS2 구조(dm-crypt·keyslot·Argon2id), cryptsetup으로 암호화 볼륨 생성·마운트·키슬롯 관리, /etc/crypttab 자동 해제, TPM 연동까지 실전 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["linux", "security", "luks", "cryptsetup", "dm-crypt", "encryption", "disk-encryption", "tpm"]
featured: false
draft: false
---

[지난 글](/posts/linux-secure-boot/)에서 Secure Boot로 부팅 체인을 검증하는 방법을 살펴봤습니다. 이번에는 디스크 자체를 암호화하는 **LUKS(Linux Unified Key Setup)** — 리눅스의 표준 디스크 암호화 방법을 다룹니다. 노트북 분실이나 서버 폐기 시에도 데이터가 노출되지 않도록 합니다.

## LUKS 아키텍처

![LUKS 암호화 레이어 구조](/assets/posts/linux-disk-encryption-luks-architecture.svg)

LUKS는 **dm-crypt** 커널 모듈 위에 구축된 표준화된 헤더 포맷입니다.

- **dm-crypt**: Linux Device Mapper의 암호화 타깃 — AES-XTS-256 방식으로 투명하게 암호화
- **LUKS 헤더**: 암호화 메타데이터와 최대 32개의 Keyslot 보유
- **Keyslot**: 마스터 키를 패스프레이즈로 암호화한 사본. 여러 패스프레이즈로 같은 볼륨 접근 가능

### LUKS1 vs LUKS2

| 항목 | LUKS1 | LUKS2 |
|---|---|---|
| KDF | PBKDF2 | Argon2id (메모리하드) |
| Keyslot 수 | 8개 | 32개 |
| 헤더 크기 | 1MB | 4MB (헤더 이중화) |
| 인증 암호화 | 미지원 | AEAD 지원 |
| 권장 여부 | 레거시 | ✓ 권장 |

## 암호화 볼륨 생성

![LUKS 볼륨 생성 · 키슬롯 관리 명령](/assets/posts/linux-disk-encryption-luks-commands.svg)

```bash
# 1. 디스크 확인
lsblk
fdisk -l /dev/sdb

# 2. LUKS2 포맷 (⚠ 기존 데이터 삭제됨)
sudo cryptsetup luksFormat --type luks2 /dev/sdb

# 강력한 옵션 명시
sudo cryptsetup luksFormat --type luks2 \
    --cipher aes-xts-plain64 \
    --key-size 512 \
    --hash sha256 \
    --iter-time 2000 \
    /dev/sdb
```

`--iter-time 2000`은 KDF(키 유도 함수) 반복 시간을 2초로 설정해 브루트포스를 어렵게 합니다.

## 볼륨 열기 · 마운트

```bash
# LUKS 열기 (가상 블록 디바이스 생성)
sudo cryptsetup luksOpen /dev/sdb data_crypt

# /dev/mapper/data_crypt 가 생성됨
ls -la /dev/mapper/data_crypt

# 파일시스템 생성 (처음 한 번만)
sudo mkfs.ext4 /dev/mapper/data_crypt

# 마운트
sudo mkdir -p /mnt/data
sudo mount /dev/mapper/data_crypt /mnt/data

# 언마운트 · 닫기
sudo umount /mnt/data
sudo cryptsetup luksClose data_crypt
```

## 키슬롯 관리

LUKS2는 최대 32개의 키슬롯을 지원합니다. 여러 패스프레이즈를 등록하거나 기존 것을 안전하게 교체할 수 있습니다.

```bash
# 헤더 정보 확인
sudo cryptsetup luksDump /dev/sdb

# 새 패스프레이즈 추가 (키슬롯 1)
sudo cryptsetup luksAddKey /dev/sdb

# 특정 키슬롯 제거
sudo cryptsetup luksKillSlot /dev/sdb 1

# 패스프레이즈 변경 (기존 입력 후 새 입력)
sudo cryptsetup luksChangeKey /dev/sdb
```

### 헤더 백업 (필수)

LUKS 헤더가 손상되면 **데이터 복구가 불가능**합니다.

```bash
# 헤더 백업
sudo cryptsetup luksHeaderBackup /dev/sdb \
    --header-backup-file /secure/sdb_header.bak

# 헤더 복원
sudo cryptsetup luksHeaderRestore /dev/sdb \
    --header-backup-file /secure/sdb_header.bak
```

백업 파일은 암호화된 별도 스토리지(USB, 원격 서버)에 보관합니다.

## /etc/crypttab 자동 해제

부팅 시 자동으로 암호화 볼륨을 해제하려면 `/etc/crypttab`과 `/etc/fstab`을 설정합니다.

```bash
# /etc/crypttab
# <name>    <device>    <keyfile>    <options>
data_crypt  /dev/sdb    none         luks,timeout=60
```

```bash
# /etc/fstab
/dev/mapper/data_crypt  /mnt/data  ext4  defaults,nofail  0  2
```

### 키 파일로 자동 해제

부팅 시 패스프레이즈 입력 없이 키 파일을 사용할 수 있습니다. 키 파일 자체는 안전한 위치에 보관해야 합니다.

```bash
# 랜덤 키 파일 생성
sudo dd if=/dev/urandom of=/etc/luks/data.key bs=4096 count=1
sudo chmod 400 /etc/luks/data.key

# 키 파일을 keyslot에 추가
sudo cryptsetup luksAddKey /dev/sdb /etc/luks/data.key

# /etc/crypttab 에 키 파일 지정
# data_crypt  /dev/sdb  /etc/luks/data.key  luks
```

## 파일 컨테이너로 LUKS 사용

파티션 전체가 아니라 파일 안에 LUKS 볼륨을 만들 수 있습니다. VeraCrypt 컨테이너와 유사한 방식입니다.

```bash
# 500MB 파일 생성
dd if=/dev/urandom of=vault.img bs=1M count=500

# LUKS 포맷
sudo cryptsetup luksFormat vault.img

# 루프 디바이스로 연결
sudo losetup -f vault.img
LOOP=$(sudo losetup -j vault.img | cut -d: -f1)

# 열기
sudo cryptsetup luksOpen "$LOOP" vault
sudo mkfs.ext4 /dev/mapper/vault  # 처음 한 번

# 마운트
sudo mount /dev/mapper/vault /mnt/vault
```

## TPM 연동

LUKS2는 TPM 2.0과 연동해 패스프레이즈 없이 부팅 시 자동 해제를 지원합니다. systemd-cryptenroll이 이 기능을 담당합니다.

```bash
# TPM2에 마스터 키 바인딩 (PCR 7 = Secure Boot 상태)
sudo systemd-cryptenroll --tpm2-device=auto \
    --tpm2-pcrs=7+14 /dev/sdb

# 기존 패스프레이즈 슬롯은 유지 (백업용)
```

TPM PCR 7은 Secure Boot 상태를 반영합니다. Secure Boot가 꺼지거나 키가 변경되면 TPM이 마스터 키 해제를 거부합니다.

## 정리

| 시나리오 | 방법 |
|---|---|
| 파티션 암호화 | `cryptsetup luksFormat /dev/sdXN` |
| 자동 마운트 | `/etc/crypttab` + 키 파일 |
| 부팅 디스크 암호화 | 설치 시 "암호화" 옵션 선택 (LUKS on LVM) |
| 패스프레이즈 없는 자동 해제 | systemd-cryptenroll + TPM 2.0 |

---

**지난 글:** [Secure Boot — 부팅 체인 검증으로 부트킷 막기](/posts/linux-secure-boot/)

**다음 글:** [권한 강화 — 최소 권한 원칙 적용](/posts/linux-permission-hardening/)

<br>
읽어주셔서 감사합니다. 😊
