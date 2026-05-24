---
title: "CIFS/SMB 마운트 — 윈도우 공유 폴더를 리눅스에서 연결하기"
description: "리눅스에서 CIFS/SMB 공유 폴더를 마운트하는 방법, 자격증명 파일 관리, fstab 영구 설정, smbclient 사용법, SMB 버전 보안 설정까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["linux", "cifs", "smb", "samba", "windows", "filesystem", "mount", "network", "storage"]
featured: false
draft: false
---

[지난 글](/posts/linux-nfs-mount/)에서 유닉스 계열 서버 간 파일 공유에 쓰이는 NFS를 살펴봤습니다. 이번에는 **CIFS(Common Internet File System)** — Windows 네트워크 공유 폴더를 리눅스에서 마운트하는 방법을 알아봅니다. CIFS는 SMB 프로토콜을 리눅스 파일시스템으로 구현한 것으로, 윈도우·Mac·NAS 장비의 공유 폴더를 로컬 디렉터리처럼 접근할 수 있게 합니다.

## SMB와 CIFS의 관계

SMB(Server Message Block)는 Microsoft가 개발한 파일 공유 프로토콜입니다. CIFS는 SMB1을 인터넷 표준으로 공개한 이름이며, 현재는 **SMB2, SMB3**으로 발전했습니다. 리눅스 커널의 마운트 타입은 여전히 `cifs`를 사용하지만, 실제 통신 버전은 옵션으로 지정합니다.

![CIFS/SMB 아키텍처](/assets/posts/linux-cifs-smb-arch.svg)

**SMB 버전별 보안**: SMB1은 WannaCry 랜섬웨어가 악용한 EternalBlue 취약점이 있습니다. 반드시 SMB2 이상을 사용해야 합니다.

## 사전 준비

```bash
# Debian/Ubuntu
sudo apt install cifs-utils smbclient

# RHEL/CentOS
sudo dnf install cifs-utils samba-client
```

## 임시 마운트

```bash
# 마운트 포인트 생성
sudo mkdir -p /mnt/smb

# 기본 마운트 (비밀번호를 명령줄에 노출 — 개발/테스트용만)
sudo mount -t cifs //192.168.1.10/share /mnt/smb \
    -o username=alice,password=secret,vers=3.0

# 도메인 환경 (Active Directory)
sudo mount -t cifs //192.168.1.10/share /mnt/smb \
    -o username=alice,domain=CORP,vers=3.0

# 마운트 확인
df -hT /mnt/smb
findmnt /mnt/smb
```

## 자격증명 파일 — 비밀번호 보호

![CIFS/SMB 명령어](/assets/posts/linux-cifs-smb-commands.svg)

명령줄에 비밀번호를 직접 쓰면 `ps aux`로 노출됩니다. 자격증명 파일을 분리해야 합니다.

```bash
# ~/.smbcredentials 생성
cat > ~/.smbcredentials << 'EOF'
username=alice
password=secret123
domain=WORKGROUP
EOF

# root만 읽을 수 있도록 제한
chmod 600 ~/.smbcredentials

# 자격증명 파일로 마운트
sudo mount -t cifs //192.168.1.10/share /mnt/smb \
    -o credentials=/home/alice/.smbcredentials,vers=3.0
```

## fstab 영구 설정

```bash
# /etc/fstab
//192.168.1.10/share  /mnt/smb  cifs  credentials=/root/.smbcredentials,uid=1000,gid=1000,vers=3.0,_netdev,noauto,x-systemd.automount  0 0
```

주요 옵션 설명:

| 옵션 | 설명 |
|------|------|
| `uid=`, `gid=` | 마운트된 파일 소유자 (CIFS는 리눅스 권한 미지원) |
| `file_mode=0664` | 파일 권한 고정 |
| `dir_mode=0775` | 디렉터리 권한 고정 |
| `vers=3.0` | SMB3 사용 (보안) |
| `_netdev` | 네트워크 준비 후 마운트 |
| `noauto` | 부팅 시 자동 마운트 안 함 |
| `x-systemd.automount` | 첫 접근 시 자동 마운트 |

```bash
# fstab 적용 테스트
sudo mount -a

# systemd automount 활성화
sudo systemctl daemon-reload
```

## smbclient — FTP 방식 접근

마운트 없이 FTP처럼 파일을 주고받을 수 있습니다.

```bash
# 서버의 공유 목록 조회
smbclient -L //192.168.1.10 -U alice

# 대화형 접속
smbclient //192.168.1.10/share -U alice
# 내부 명령: ls, cd, get, put, mget, mput, del

# 단일 명령 실행 (스크립트용)
smbclient //192.168.1.10/share -U alice -c 'get report.pdf /tmp/'

# 익명 접속 (게스트)
smbclient //192.168.1.10/public -N
```

## 리눅스를 Samba 서버로 구성

리눅스가 Windows 클라이언트에 폴더를 제공할 때도 Samba를 사용합니다.

```bash
sudo apt install samba

# /etc/samba/smb.conf
cat >> /etc/samba/smb.conf << 'EOF'
[shared]
    path = /srv/shared
    valid users = alice bob
    writable = yes
    create mask = 0664
    directory mask = 0775
EOF

# Samba 사용자 추가 (별도 비밀번호)
sudo smbpasswd -a alice

# 서비스 재시작
sudo systemctl restart smbd

# 설정 검증
testparm
```

## 연결 진단

```bash
# 서버 접근 가능 여부
ping 192.168.1.10
telnet 192.168.1.10 445

# SMB 연결 테스트
smbclient //192.168.1.10/share -U alice -c 'ls' 2>&1

# 마운트된 CIFS 통계
cat /proc/fs/cifs/Stats

# 커널 CIFS 디버그
dmesg | grep -i cifs
```

---

**지난 글:** [NFS 마운트 — 네트워크 파일시스템 공유와 연결](/posts/linux-nfs-mount/)

**다음 글:** [FUSE — 사용자 공간에서 파일시스템 만들기](/posts/linux-fuse-overview/)

<br>
읽어주셔서 감사합니다. 😊
