---
title: "FUSE — 사용자 공간에서 파일시스템 만들기"
description: "FUSE(Filesystem in Userspace)의 동작 원리, libfuse 아키텍처, sshfs·rclone 실전 사용법, Python으로 커스텀 파일시스템 구현 개요, 성능 트레이드오프를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["linux", "fuse", "filesystem", "sshfs", "rclone", "userspace", "libfuse", "storage"]
featured: false
draft: false
---

[지난 글](/posts/linux-cifs-smb/)에서 윈도우 공유 폴더를 리눅스에서 마운트하는 방법을 살펴봤습니다. 이번에는 **FUSE(Filesystem in Userspace)** — 커널 코드 없이 사용자 공간에서 파일시스템을 직접 구현할 수 있게 해주는 메커니즘을 알아봅니다.

## FUSE란

전통적으로 파일시스템은 커널 모듈로 구현해야 했습니다. ext4, XFS, Btrfs 모두 커널 드라이버입니다. FUSE는 이 경계를 허물어, **일반 프로그램이 VFS 인터페이스를 구현하고 커널이 이를 파일시스템으로 사용**하게 합니다.

결과적으로 Python, Go, Rust 같은 언어로 파일시스템을 만들 수 있습니다. SSH 서버 파일시스템(sshfs), S3 마운트(rclone), 암호화 파일시스템(gocryptfs) 모두 FUSE 위에서 작동합니다.

![FUSE 아키텍처](/assets/posts/linux-fuse-overview-arch.svg)

## 동작 원리

1. FUSE 데몬(사용자 프로그램)이 `/dev/fuse` 장치를 열고 특정 경로를 마운트
2. 사용자가 해당 경로에 `open()`, `read()` 등의 시스템 콜 호출
3. VFS가 FUSE 파일시스템으로 라우팅
4. `fuse.ko`(커널 모듈)가 `/dev/fuse`를 통해 데몬에게 요청 전달
5. 데몬이 처리 후 결과를 `/dev/fuse`로 응답
6. 커널이 결과를 사용자 애플리케이션에 반환

```bash
# FUSE 모듈 확인
lsmod | grep fuse
# fuse  143360  3 sshfs

# /dev/fuse 장치
ls -la /dev/fuse
# crw-rw-rw- 1 root fuse 10, 229 ... /dev/fuse
```

## sshfs — SSH를 통한 원격 파일시스템

가장 널리 쓰이는 FUSE 구현입니다. SSH 접속이 가능한 서버라면 별도 서버 설정 없이 즉시 원격 파일시스템을 마운트할 수 있습니다.

![FUSE 실전 사용](/assets/posts/linux-fuse-overview-examples.svg)

```bash
# 설치
sudo apt install sshfs

# 원격 서버 마운트
mkdir -p ~/remote
sshfs alice@10.0.0.10:/home/alice ~/remote

# SSH 키 + 특정 포트
sshfs -p 2222 alice@10.0.0.10:/data ~/remote \
    -o IdentityFile=~/.ssh/id_rsa,reconnect

# 로컬처럼 사용
ls ~/remote
cp ~/remote/config.yml .

# 언마운트
fusermount -u ~/remote
```

### 성능 최적화 옵션

```bash
# 압축 + 대용량 읽기 버퍼 (LAN 환경)
sshfs alice@server:/data ~/remote \
    -o Compression=yes,large_read,kernel_cache
```

## rclone — 클라우드 스토리지 마운트

AWS S3, Google Cloud Storage, Dropbox, OneDrive 등 40여 개 스토리지를 FUSE로 마운트합니다.

```bash
# 설치
curl https://rclone.org/install.sh | sudo bash

# 원격 스토리지 설정 (대화형)
rclone config

# S3 버킷 마운트
rclone mount s3:my-bucket /mnt/s3 \
    --vfs-cache-mode writes \
    --vfs-cache-max-size 10G &

# 설정된 원격 스토리지 목록
rclone listremotes

# 언마운트
fusermount -u /mnt/s3
```

`--vfs-cache-mode writes`는 쓰기 작업을 로컬에 캐싱해 성능을 크게 향상시킵니다. 읽기/쓰기 모두 캐싱하려면 `full` 옵션을 씁니다.

## gocryptfs — 투명 암호화

디렉터리를 암호화된 상태로 저장하고, FUSE를 통해 복호화된 뷰를 제공합니다. Dropbox나 구글 드라이브에 암호화된 파일을 올릴 때 유용합니다.

```bash
sudo apt install gocryptfs

# 암호화 디렉터리 초기화
gocryptfs -init ~/encrypted

# 마운트 (복호화된 뷰)
mkdir ~/plain
gocryptfs ~/encrypted ~/plain

# 작업 후 언마운트
fusermount -u ~/plain
```

## 커스텀 FUSE 구현 (Python 개요)

`fusepy` 라이브러리를 사용하면 Python으로 파일시스템을 만들 수 있습니다.

```python
from fuse import FUSE, Operations
import stat, time

class MemoryFS(Operations):
    def __init__(self):
        self.files = {}

    def getattr(self, path, fh=None):
        if path == '/':
            return {'st_mode': stat.S_IFDIR | 0o755, 'st_nlink': 2}
        if path in self.files:
            return {'st_mode': stat.S_IFREG | 0o644, 'st_size': len(self.files[path])}
        raise OSError(2)  # ENOENT

    def read(self, path, size, offset, fh):
        return self.files[path][offset:offset+size]

    def write(self, path, data, offset, fh):
        self.files[path] = self.files.get(path, b'')[:offset] + data
        return len(data)

# 마운트
FUSE(MemoryFS(), '/mnt/memfs', foreground=True)
```

```bash
pip install fusepy
python memory_fs.py &
ls /mnt/memfs
fusermount -u /mnt/memfs
```

## 성능 트레이드오프

FUSE는 편리하지만 로컬 파일시스템보다 느립니다. 매 I/O마다 커널과 사용자 공간 사이의 컨텍스트 스위치가 발생합니다.

- **로컬 I/O 집약적 작업**: FUSE 오버헤드가 체감됨 (2~10배 느림)
- **네트워크/클라우드 스토리지**: 네트워크 지연이 압도적이라 FUSE 오버헤드는 무시됨
- **암호화 파일시스템**: 암호화 연산이 병목이라 FUSE 오버헤드는 작음

`-o allow_other`와 `kernel_cache` 옵션을 사용하면 다른 사용자도 마운트에 접근하고 커널 페이지 캐시를 활용해 읽기 성능을 높일 수 있습니다.

---

**지난 글:** [CIFS/SMB 마운트 — 윈도우 공유 폴더를 리눅스에서 연결하기](/posts/linux-cifs-smb/)

**다음 글:** [디스크 IOPS와 지연 시간 — 스토리지 성능 측정과 분석](/posts/linux-disk-iops-latency/)

<br>
읽어주셔서 감사합니다. 😊
