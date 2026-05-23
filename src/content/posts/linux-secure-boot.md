---
title: "Secure Boot — 부팅 체인 검증으로 부트킷 막기"
description: "Secure Boot의 신뢰 체인 구조(PK·KEK·db·dbx), shim과 GRUB의 역할, mokutil·sign-file을 이용한 MOK 관리, 커널 lockdown 모드를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["linux", "security", "secure-boot", "uefi", "shim", "mok", "grub", "bootkit", "lockdown"]
featured: false
draft: false
---

[지난 글](/posts/linux-auditd/)에서 auditd로 시스템 이벤트를 감사하는 방법을 살펴봤습니다. 이번에는 OS가 로드되기 전 단계를 보호하는 **Secure Boot** — UEFI의 부팅 체인 검증 메커니즘을 다룹니다.

## Secure Boot가 필요한 이유

부트킷은 OS가 로드되기 전 MBR이나 EFI 파티션에 위치합니다. OS 안의 어떤 도구로도 감지할 수 없고, 안티바이러스가 시작되기 전에 이미 제어권을 잡습니다. Secure Boot는 **각 부팅 단계의 바이너리에 디지털 서명을 요구**해서 변조된 코드가 실행되지 못하도록 차단합니다.

## 신뢰 체인 구조

![Secure Boot 신뢰 체인](/assets/posts/linux-secure-boot-chain.svg)

UEFI 펌웨어는 4개의 키 데이터베이스를 가집니다.

| 변수 | 역할 |
|---|---|
| PK (Platform Key) | 하드웨어 제조사 최상위 키 |
| KEK (Key Exchange Key) | db/dbx를 업데이트할 수 있는 키 |
| db (Signature Database) | 허용된 서명자 목록 (MS, Canonical 등) |
| dbx (Forbidden Database) | 폐기된 서명 목록 (블랙리스트) |

부팅 순서는 **UEFI → shim.efi → GRUB 2 → 커널**입니다. 각 단계에서 다음 단계의 서명을 검증합니다.

### shim의 역할

대부분의 Linux 배포판은 **shim**이라는 중간 로더를 사용합니다. shim은 Microsoft가 서명한 바이너리이므로 기본 UEFI DB에서 신뢰합니다. shim 안에는 배포판 키(예: Canonical 키)가 내장되어 있어, GRUB과 커널에 대한 검증을 이어받습니다.

## Secure Boot 상태 확인

![Secure Boot 상태 확인 및 MOK 서명 명령](/assets/posts/linux-secure-boot-commands.svg)

```bash
# mokutil로 확인 (가장 간단)
mokutil --sb-state

# efivar로 직접 확인
ls /sys/firmware/efi/efivars/ | grep SecureBoot

# bootctl (systemd-boot 환경)
bootctl status | grep "Secure Boot"

# dmesg에서 확인
sudo dmesg | grep "Secure boot"
```

`SecureBoot enabled` 또는 `Secure boot: enabled` 출력이면 활성화된 상태입니다.

## MOK — Machine Owner Key

직접 빌드한 커널 모듈이나 드라이버는 Secure Boot 환경에서 서명 없이는 로드되지 않습니다. MOK는 사용자가 추가하는 자체 서명 키입니다.

```bash
# 1. RSA 키 쌍과 인증서 생성
openssl req -new -x509 -newkey rsa:2048 -nodes \
    -keyout /root/mok.key \
    -out /root/mok.crt \
    -days 3650 \
    -subj "/CN=My Module Signing Key/"

# 2. MOK 등록 (재부팅 시 MOKManager에서 비밀번호 입력)
sudo mokutil --import /root/mok.crt

# 3. 재부팅 → MOKManager 화면에서 키 등록 확인
sudo reboot

# 4. 등록 확인
mokutil --list-enrolled | grep Subject
```

### 커널 모듈 서명

```bash
# sign-file로 모듈 서명
/usr/lib/linux-kbuild-$(uname -r)/scripts/sign-file sha256 \
    /root/mok.key /root/mok.crt \
    /lib/modules/$(uname -r)/updates/mymodule.ko

# 서명 확인
modinfo mymodule | grep signer
```

### DKMS와 자동 서명

DKMS 모듈은 `/etc/dkms/framework.conf`에서 MOK 키 경로를 설정하면 빌드 시 자동으로 서명됩니다.

```bash
# /etc/dkms/framework.conf
mok_signing_key="/root/mok.key"
mok_certificate="/root/mok.crt"
sign_tool="/etc/dkms/sign_helper.sh"
```

## 커널 Lockdown 모드

Secure Boot가 활성화되면 리눅스 커널이 **lockdown** 모드로 진입합니다. 이 모드에서는 다음이 차단됩니다.

- `/dev/mem`, `/dev/kmem` 직접 접근
- eBPF JIT 로 커널 메모리 쓰기
- 서명 없는 커널 모듈 로드
- `kexec_load` (서명 없는 커널로 교체)
- Hibernation (resume 이미지 무결성 불보장)

```bash
# lockdown 모드 확인
cat /sys/kernel/security/lockdown
# 예: [none] integrity confidentiality
```

## 실전 운영 팁

**1. Secure Boot 비활성화가 필요한 경우**

VirtualBox, VMware, Nvidia 독점 드라이버 일부는 MOK 서명이 번거롭습니다. 이 경우 MOK 등록이 권장 대안이고, UEFI에서 비활성화는 마지막 수단입니다.

**2. dbx 업데이트**

```bash
# Ubuntu: fwupd로 dbx 업데이트
sudo fwupdmgr get-devices
sudo fwupdmgr update
```

**3. 서명 검증 실패 대응**

부팅 중 서명 실패가 발생하면 UEFI 셸로 들어가 `bcfg boot`로 부팅 순서를 확인하거나, Secure Boot를 일시 비활성화 후 원인을 파악합니다.

## 정리

Secure Boot는 **부팅 전 단계**를 보호하는 UEFI 표준입니다. OS가 로드된 이후의 런타임 보안은 SELinux, AppArmor, auditd 등 별도 레이어가 담당합니다. 두 레이어를 모두 갖추어야 공격 표면을 최소화할 수 있습니다.

---

**지난 글:** [auditd — 리눅스 감사 시스템 완전 정리](/posts/linux-auditd/)

**다음 글:** [LUKS — 디스크 전체 암호화](/posts/linux-disk-encryption-luks/)

<br>
읽어주셔서 감사합니다. 😊
