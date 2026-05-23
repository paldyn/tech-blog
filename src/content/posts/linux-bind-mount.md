---
title: "Bind Mount — 디렉터리를 다른 경로에 재마운트하기"
description: "Bind Mount의 inode 공유 원리, mount --bind와 --rbind 차이, 읽기 전용 bind mount 2단계 방법, fstab·systemd .mount 영구 설정, 컨테이너·chroot 활용 사례를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-24"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["linux", "filesystem", "bind-mount", "mount", "container", "chroot", "fstab", "systemd"]
featured: false
draft: false
---

[지난 글](/posts/linux-mount-types/)에서 리눅스의 모든 마운트 유형을 개괄적으로 살펴봤습니다. 이번에는 그 중 **Bind Mount** — 디렉터리를 다른 경로에 재마운트하는 기법을 깊이 파고듭니다. 컨테이너 기술과 chroot 격리의 핵심 도구입니다.

## Bind Mount의 원리

일반 마운트는 블록 디바이스를 마운트포인트에 연결합니다. Bind Mount는 **이미 존재하는 디렉터리(또는 파일)를 다른 경로에도 접근할 수 있게** 합니다.

복사가 아닙니다. 두 경로가 **동일한 inode**를 가리키므로 한쪽에서 파일을 수정하면 다른 쪽에도 즉시 반영됩니다.

![Bind Mount 개념과 활용 사례](/assets/posts/linux-bind-mount-concept.svg)

```bash
# 개념 확인: 두 경로의 inode 번호가 같음
sudo mount --bind /var/www/html /mnt/web
stat /var/www/html | grep Inode
stat /mnt/web | grep Inode
# 출력이 동일함
```

## 기본 사용법

```bash
# 디렉터리 bind mount
sudo mount --bind /var/www/html /mnt/web

# 파일 bind mount (단일 파일도 가능)
sudo touch /mnt/myfile
sudo mount --bind /etc/hosts /mnt/myfile

# 마운트 확인
findmnt /mnt/web

# 해제
sudo umount /mnt/web
```

![Bind Mount 명령·fstab·systemd 설정](/assets/posts/linux-bind-mount-commands.svg)

## 읽기 전용 Bind Mount (2단계)

`--bind`는 원본의 읽기/쓰기 권한을 그대로 가져옵니다. 읽기 전용으로 바인드하려면 **두 단계**가 필요합니다.

```bash
# 1단계: bind
sudo mount --bind /etc/ssl /mnt/certs

# 2단계: remount with ro
sudo mount -o remount,ro,bind /mnt/certs

# 확인
findmnt -o TARGET,OPTIONS /mnt/certs
# OPTIONS: ro,bind,...
```

왜 두 단계인가? `mount --bind` 자체는 마운트 네임스페이스 수준의 플래그를 다루고, `-o ro`는 파일시스템 레벨 플래그입니다. 커널이 이 두 플래그를 한 번에 처리하지 않기 때문입니다.

## rbind — 중첩 마운트 포함

`--bind`는 마운트포인트 안에 중첩된 마운트를 포함하지 않습니다. `--rbind`(recursive bind)는 모든 중첩 마운트도 함께 바인드합니다.

```bash
# /proc 안의 중첩 마운트까지 포함
sudo mount --rbind /proc /jail/proc
sudo mount --rbind /sys /jail/sys
sudo mount --rbind /dev /jail/dev

# chroot 환경에서 proc/sys/dev 접근 가능
sudo chroot /jail /bin/bash
```

컨테이너 런타임과 systemd-nspawn이 이 방식으로 격리 환경을 구성합니다.

## Docker 볼륨과 Bind Mount

Docker의 `-v` 옵션은 내부적으로 bind mount를 사용합니다.

```bash
# Docker bind mount
docker run -v /host/data:/container/data:ro nginx

# 명시적 --mount 형식 (권장)
docker run \
    --mount type=bind,source=/host/data,target=/container/data,readonly \
    nginx
```

`type=bind`는 호스트 경로를 컨테이너에 직접 노출합니다. `type=volume`은 Docker가 관리하는 볼륨입니다.

## /etc/fstab 영구 설정

```bash
# /etc/fstab
/var/www/html  /mnt/web   none  bind        0  0
/etc/ssl       /mnt/certs none  bind,ro     0  0
```

읽기 전용 bind의 경우 fstab에서 `bind,ro`를 한 줄에 쓰면 동작하지 않는 경우가 있습니다. 이 때는 systemd .mount 유닛을 사용합니다.

## systemd .mount 유닛

```bash
# /etc/systemd/system/mnt-web.mount
```

```ini
[Unit]
Description=Bind mount for web content
After=local-fs.target

[Mount]
What=/var/www/html
Where=/mnt/web
Type=none
Options=bind

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mnt-web.mount
sudo systemctl status mnt-web.mount
```

유닛 파일명은 마운트포인트 경로에서 `/`를 `-`로 바꾼 것과 일치해야 합니다 (`/mnt/web` → `mnt-web.mount`).

## 실전 활용: chroot 격리 환경 구성

```bash
JAIL=/var/chroot

# 기본 구조 생성
sudo mkdir -p "$JAIL"/{bin,lib,lib64,proc,sys,dev,etc}

# 필요 바이너리 복사 (bash, ls 등)
sudo cp /bin/bash "$JAIL/bin/"
sudo cp /bin/ls "$JAIL/bin/"

# 동적 라이브러리 복사
sudo cp -r /lib/x86_64-linux-gnu "$JAIL/lib/"
sudo cp /lib64/ld-linux-x86-64.so.2 "$JAIL/lib64/"

# 커널 가상 FS bind
sudo mount --rbind /proc "$JAIL/proc"
sudo mount --rbind /sys "$JAIL/sys"
sudo mount --rbind /dev "$JAIL/dev"

# chroot 진입
sudo chroot "$JAIL" /bin/bash

# 나간 후 정리
sudo umount -R "$JAIL/proc"
sudo umount -R "$JAIL/sys"
sudo umount -R "$JAIL/dev"
```

## 주의사항

**원본 데이터 직접 접근**: bind mount는 복사본이 아닙니다. bind된 경로에서 삭제하면 원본도 삭제됩니다.

**중첩 bind mount**: bind된 경로 안에서 다시 bind하면 복잡한 마운트 트리가 생깁니다. `findmnt` 로 확인하면서 작업합니다.

**umount 순서**: `--rbind`로 중첩 마운트를 만들었다면 `umount -R`로 재귀적으로 해제합니다.

```bash
# 재귀 언마운트
sudo umount -R /jail
```

---

**지난 글:** [마운트 유형 완전 정리](/posts/linux-mount-types/)

**다음 글:** [루프백 마운트 — 파일을 블록 디바이스로](/posts/linux-loopback-mount/)

<br>
읽어주셔서 감사합니다. 😊
