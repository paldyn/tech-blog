---
title: "NFS 마운트 — 네트워크 파일시스템 공유와 연결"
description: "NFS 서버 설정(/etc/exports), 클라이언트 마운트, NFSv3 vs NFSv4 차이, fstab 영구 설정, hard/soft 옵션, 성능 튜닝 포인트까지 실전 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["linux", "nfs", "filesystem", "network", "mount", "exports", "nfs4", "storage"]
featured: false
draft: false
---

[지난 글](/posts/linux-tmpfs-procfs-sysfs/)에서 메모리 기반 가상 파일시스템을 살펴봤습니다. 이번에는 **NFS(Network File System)** — 네트워크를 통해 파일시스템을 공유하는 프로토콜을 다룹니다. 다수의 서버가 같은 데이터 디렉터리를 접근하거나, 개발 환경에서 코드를 공유할 때 가장 널리 쓰이는 방식입니다.

## NFS 동작 원리

NFS는 **RPC(Remote Procedure Call)** 기반 프로토콜입니다. 클라이언트가 파일을 열거나 읽을 때 커널 NFS 모듈이 RPC 요청을 서버에 보내고, 서버의 nfsd 데몬이 처리해 결과를 돌려줍니다. 사용자 프로그램 입장에서는 로컬 파일을 읽는 것과 차이가 없습니다.

![NFS 아키텍처](/assets/posts/linux-nfs-mount-arch.svg)

**NFSv3 vs NFSv4**:
- NFSv3: stateless, 여러 포트 사용(rpcbind 111 + 추가 포트)
- NFSv4: stateful, 단일 포트 2049만 사용, 방화벽 설정이 단순, Kerberos 보안 지원
- 신규 환경에서는 NFSv4 권장

## 서버 설정

### 패키지 설치 및 서비스 시작

```bash
# Debian/Ubuntu
sudo apt install nfs-kernel-server

# RHEL/CentOS
sudo dnf install nfs-utils

# 서비스 시작
sudo systemctl enable --now nfs-server
```

### /etc/exports 구성

```bash
# 형식: 공유경로  클라이언트(옵션)
/data  192.168.1.0/24(rw,sync,no_subtree_check)
/pub   *(ro,no_root_squash)
/home  192.168.1.0/24(rw,sync,root_squash,all_squash,anonuid=1000,anongid=1000)
```

주요 exports 옵션:

| 옵션 | 설명 |
|------|------|
| `rw` / `ro` | 읽기쓰기 / 읽기전용 |
| `sync` | 쓰기를 디스크에 완전히 저장 후 응답 |
| `async` | 성능 향상 (장애 시 데이터 손실 위험) |
| `no_subtree_check` | 하위 디렉터리 검사 생략 (성능 향상) |
| `root_squash` | 클라이언트 root → 서버 nobody 매핑 |
| `no_root_squash` | 클라이언트 root = 서버 root |

```bash
# 설정 적용 (재시작 없이)
sudo exportfs -rav

# 내보내기 목록 확인
sudo exportfs -v
```

## 클라이언트 마운트

![NFS 명령어](/assets/posts/linux-nfs-mount-commands.svg)

```bash
# 패키지 설치
sudo apt install nfs-common

# 서버의 내보내기 목록 조회
showmount -e 192.168.1.10

# 임시 마운트
sudo mkdir -p /mnt/nfs
sudo mount -t nfs4 192.168.1.10:/data /mnt/nfs

# 마운트 확인
df -hT /mnt/nfs
findmnt /mnt/nfs

# 해제
sudo umount /mnt/nfs
```

### fstab 영구 설정

```bash
# /etc/fstab
192.168.1.10:/data  /mnt/nfs  nfs4  rw,hard,intr,timeo=14,retrans=3,_netdev  0 0
```

`_netdev` 옵션은 네트워크가 준비된 후에 마운트하도록 systemd에 알려줍니다. NFS 항목에 반드시 넣어야 부팅 시 무한 대기를 막을 수 있습니다.

## 주요 마운트 옵션

**hard vs soft**: `hard`는 서버가 응답할 때까지 계속 재시도합니다. `soft`는 타임아웃 후 I/O 에러를 반환합니다. 데이터 무결성이 중요한 환경에서는 `hard`를 사용합니다.

**성능 관련 옵션**:

```bash
# 읽기/쓰기 블록 크기 (기본 1MB, Gigabit 환경에서 높이면 처리량 향상)
mount -t nfs4 -o rsize=1048576,wsize=1048576 server:/data /mnt/nfs

# atime 업데이트 생략 (읽기 성능 향상)
mount -t nfs4 -o noatime server:/data /mnt/nfs
```

## 성능 모니터링

```bash
# NFS 클라이언트 통계
nfsstat -c

# 서버 통계
nfsstat -s

# I/O 대기 확인
iostat -x 1

# NFS 속도 테스트
dd if=/dev/zero of=/mnt/nfs/testfile bs=1M count=1024 conv=fsync
```

## 보안 고려사항

```bash
# NFSv4 Kerberos 인증 (운영 환경 권장)
mount -t nfs4 -o sec=krb5p server:/secure /mnt/secure
# krb5: 인증만 / krb5i: 인증+무결성 / krb5p: 인증+무결성+암호화

# 방화벽 설정 (NFSv4 = 포트 2049만)
sudo firewall-cmd --add-service=nfs --permanent
sudo firewall-cmd --reload

# NFSv3이면 추가 포트 필요
sudo firewall-cmd --add-service=rpc-bind --permanent
sudo firewall-cmd --add-service=mountd --permanent
```

## Autofs — 필요할 때 자동 마운트

항상 마운트해두는 대신 접근할 때만 자동으로 마운트하고 일정 시간 후 자동 해제하는 방식입니다.

```bash
sudo apt install autofs

# /etc/auto.master
/mnt/nfs  /etc/auto.nfs  --timeout=60

# /etc/auto.nfs
data  -rw,hard  192.168.1.10:/data
pub   -ro       192.168.1.10:/pub

sudo systemctl restart autofs

# 접근 시 자동 마운트
ls /mnt/nfs/data
```

---

**지난 글:** [tmpfs·procfs·sysfs — 메모리와 커널이 만드는 가상 파일시스템](/posts/linux-tmpfs-procfs-sysfs/)

**다음 글:** [CIFS/SMB 마운트 — 윈도우 공유 폴더를 리눅스에서 연결하기](/posts/linux-cifs-smb/)

<br>
읽어주셔서 감사합니다. 😊
