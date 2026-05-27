---
title: "modprobe와 modinfo — 의존성을 고려한 모듈 관리"
description: "modprobe로 의존성을 자동 해결하며 모듈을 로드·제거하는 방법, modinfo로 모듈 메타데이터를 읽는 방법, 그리고 모듈 파라미터와 블랙리스트 설정까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["Linux", "modprobe", "modinfo", "커널모듈", "의존성", "드라이버"]
featured: false
draft: false
---

[지난 글](/posts/linux-kernel-modules-lsmod/)에서 `insmod`와 `rmmod`로 커널 모듈을 수동으로 다루는 방법을 살펴봤습니다. 하지만 모듈 간 의존성을 직접 추적하며 로드 순서를 관리하는 것은 번거롭습니다. `modprobe`가 이 문제를 해결해 줍니다.

![modprobe vs insmod 비교](/assets/posts/linux-modprobe-modinfo-flow.svg)

## modprobe — 스마트한 모듈 관리자

`modprobe`는 `/lib/modules/$(uname -r)/modules.dep` 파일을 참조해 의존성 그래프를 자동으로 탐색합니다. 모듈 이름만 지정하면 필요한 모든 의존 모듈을 올바른 순서로 자동 로드합니다.

```bash
# 이름만 지정 — 경로 불필요
sudo modprobe ext4

# 로드 확인
lsmod | grep -E 'ext4|jbd2|mbcache'
# ext4     974848  2
# jbd2     147456  1 ext4
# mbcache   16384  1 ext4
```

`insmod`가 `ext4.ko`의 전체 경로를 요구하고 의존성을 수동 처리해야 했던 것과 달리, `modprobe`는 모듈 이름 하나로 전체 의존성 체인을 처리합니다.

## modprobe -r — 역방향 자동 제거

제거도 마찬가지로 의존성을 역순으로 처리합니다.

```bash
# ext4와 그 의존 모듈(jbd2, mbcache) 자동 제거
sudo modprobe -r ext4

# 제거 확인
lsmod | grep ext4
# (출력 없음)
```

단, 다른 모듈이 해당 의존 모듈을 참조 중이면 제거하지 않습니다. 안전한 동작입니다.

## modprobe로 파라미터 전달

모듈은 로드 시 파라미터를 받을 수 있습니다. `modinfo`의 `parm` 필드로 지원 파라미터를 확인합니다.

```bash
# 파라미터 확인
modinfo -F parm e1000e
# InterruptThrottleRate:Maximum interrupts per second (uint)
# TxDescriptors:Number of transmit descriptors (uint)

# 파라미터와 함께 로드
sudo modprobe e1000e InterruptThrottleRate=3000
```

파라미터를 영구 적용하려면 `/etc/modprobe.d/` 아래에 설정 파일을 만듭니다.

```bash
# /etc/modprobe.d/e1000e.conf
echo "options e1000e InterruptThrottleRate=3000" \
  | sudo tee /etc/modprobe.d/e1000e.conf
```

이 파일은 부팅 시 `modprobe`가 자동으로 읽습니다.

## modinfo — 모듈 메타데이터 조회

![modinfo 출력 구조](/assets/posts/linux-modprobe-modinfo-info.svg)

`modinfo`는 `.ko` 파일에 내장된 메타데이터를 읽어 출력합니다. 모듈이 커널에 로드되지 않아도 파일만 있으면 조회 가능합니다.

```bash
modinfo nvidia
# filename: /lib/modules/.../nvidia.ko
# description: NVIDIA Linux x86_64 Kernel Module
# license: NVIDIA
# depends: videodev,drm
# vermagic: 6.8.0-51-generic SMP

# 특정 필드만 출력
modinfo -F license nvidia
# NVIDIA  (← GPL 아님 → 일부 커널 심볼 접근 제한)
```

`license`가 `GPL`이 아닌 모듈은 커널 내부 비공개 심볼에 접근할 수 없습니다. 커널 로그에 "module is not GPL licensed" 경고가 나타날 수 있습니다.

## vermagic — 커널 버전 서명

```bash
modinfo -F vermagic ext4
# 6.8.0-51-generic SMP preempt mod_unload
```

`vermagic`은 해당 `.ko` 파일을 컴파일한 커널 버전의 서명입니다. 실행 중인 커널과 `vermagic`이 다르면 `modprobe`는 로드를 거부합니다.

```
insmod: ERROR: could not insert module: Invalid module format
```

커널 업그레이드 후 드라이버(특히 서드파티 DKMS 모듈)가 로드되지 않는 가장 흔한 원인입니다.

## 블랙리스트 — 특정 모듈 로드 차단

오픈소스 `nouveau` 드라이버 대신 NVIDIA 독점 드라이버를 사용할 때처럼, 특정 모듈 자동 로드를 막고 싶을 때 블랙리스트를 사용합니다.

```bash
# /etc/modprobe.d/blacklist-nouveau.conf
echo "blacklist nouveau" \
  | sudo tee /etc/modprobe.d/blacklist-nouveau.conf
echo "options nouveau modeset=0" \
  | sudo tee -a /etc/modprobe.d/blacklist-nouveau.conf

# initramfs 업데이트 (Ubuntu/Debian)
sudo update-initramfs -u
```

블랙리스트는 initramfs에도 반영해야 부팅 초기단계에서도 적용됩니다.

## modules.dep 직접 보기

```bash
# ext4 의존성 확인
grep 'ext4.ko:' /lib/modules/$(uname -r)/modules.dep
# kernel/fs/ext4/ext4.ko: kernel/fs/jbd2/jbd2.ko kernel/fs/mbcache.ko

# depmod — 의존성 DB 재생성 (커널 업데이트 후)
sudo depmod -a
```

## 요약

| 명령 | 역할 |
|------|------|
| `modprobe ext4` | 의존성 포함 자동 로드 |
| `modprobe -r ext4` | 의존성 포함 역순 제거 |
| `modinfo ext4` | 모듈 메타데이터 조회 |
| `modinfo -F depends ext4` | 특정 필드만 출력 |
| `/etc/modprobe.d/*.conf` | 파라미터·블랙리스트 영구 설정 |

`modprobe`는 실제 운영 환경에서 모듈을 다룰 때 `insmod`보다 항상 선호됩니다. 의존성 오류와 로드 순서 문제를 자동으로 처리해 주기 때문입니다.

---

**지난 글:** [커널 모듈과 lsmod — 동적으로 확장되는 Linux 커널의 구조](/posts/linux-kernel-modules-lsmod/)

**다음 글:** [sysctl — 커널 파라미터를 런타임에 조정하기](/posts/linux-sysctl/)

<br>
읽어주셔서 감사합니다. 😊
