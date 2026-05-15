---
title: "chattr · lsattr — 파일 속성으로 추가 보호"
description: "chattr로 리눅스 파일 속성(immutable, append-only, secure delete 등)을 제어하고, lsattr로 속성을 확인하는 방법, 보안 강화 실전 시나리오를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["linux", "chattr", "lsattr", "attributes", "immutable", "security", "filesystem"]
featured: false
draft: false
---

[지난 글](/posts/linux-acl-getfacl-setfacl/)에서 ACL로 사용자별 세밀한 권한을 설정하는 방법을 배웠습니다. 이번에는 권한 시스템과는 별개로 **inode에 저장되는 파일 속성(attribute)**을 제어하는 `chattr`와 `lsattr`를 다룹니다. 이 속성은 **root조차 우회하기 어려운 보호**를 제공합니다.

## chattr란

`chattr`(change attribute)는 ext2/ext4/xfs 파일시스템의 inode에 저장되는 확장 속성을 변경합니다. 이 속성은 커널 레벨에서 파일 보호를 강제하므로, 소유자·권한과 무관하게 적용됩니다.

> root도 `+i`(immutable) 속성이 붙은 파일을 수정·삭제할 수 없습니다. 먼저 속성을 해제해야 합니다.

## 주요 속성

![chattr 주요 파일 속성](/assets/posts/linux-chattr-attributes.svg)

## lsattr — 속성 확인

```bash
# 단일 파일
lsattr /etc/resolv.conf
# ----i---------e-- /etc/resolv.conf
#     ^--- i = immutable
#                   e = extent format (ext4 기본)

# 디렉터리 내용
lsattr /etc/

# 재귀
lsattr -R /etc/ssh/

# 디렉터리 자체 속성 (-d)
lsattr -d /etc/
```

## chattr 사용법

![chattr · lsattr 실전 사용법](/assets/posts/linux-chattr-use-cases.svg)

```bash
# 속성 추가
sudo chattr +i file      # immutable 추가
sudo chattr +a logfile   # append-only 추가
sudo chattr +si file     # secure delete + immutable

# 속성 제거
sudo chattr -i file
sudo chattr -a logfile

# 여러 속성 동시 제거
sudo chattr -ia file

# 재귀 적용
sudo chattr -R +i /etc/ssh/
```

## 실전 보안 시나리오

### 중요 설정 파일 잠금

```bash
# DNS 설정을 DHCP 등이 덮어쓰지 못하게 잠금
sudo chattr +i /etc/resolv.conf

# SSH 설정 보호
sudo chattr +i /etc/ssh/sshd_config

# 확인
lsattr /etc/resolv.conf
# ----i---------e-- /etc/resolv.conf

# 변경 시도
sudo rm /etc/resolv.conf
# rm: cannot remove '/etc/resolv.conf': Operation not permitted
```

### 로그 파일 추가 전용 보호

```bash
# 로그 파일을 추가만 허용 → 삭제·덮어쓰기 차단
sudo chattr +a /var/log/auth.log
sudo chattr +a /var/log/syslog

# 확인 (a = append-only)
lsattr /var/log/auth.log
# -----a--------e-- /var/log/auth.log
```

`+a` 속성이 있으면 악성코드나 침입자가 로그를 지워도 실패합니다. logrotate는 root 권한으로 실행되지만 `+a` 파일의 truncate는 `+i`와 달리 CAP_LINUX_IMMUTABLE 없이는 차단됩니다.

### 침입 후 공격자 활동 제한

공격자가 root를 획득해도 `+i` 속성이 걸린 파일은 수정할 수 없습니다. 단, 커널 모듈 로드 권한이 있으면 우회 가능하므로 심층 방어의 한 레이어로 이해해야 합니다.

```bash
# 중요 바이너리 보호 (패키지 업데이트 전 해제 필요)
sudo chattr +i /usr/bin/sudo
sudo chattr +i /usr/bin/su
```

## 속성의 한계

| 제한 사항 | 설명 |
|-----------|------|
| 파일시스템 의존 | ext2/ext4/xfs 지원, tmpfs/vfat 등 미지원 |
| cp/mv 미복사 | 복사 시 속성이 따라가지 않음 |
| 커널 권한으로 우회 | CAP_LINUX_IMMUTABLE 권한이 있으면 해제 가능 |
| 마운트 우회 | 디스크를 다른 OS로 부팅해 마운트하면 무력화 |

## 속성 보존 복사

```bash
# tar로 속성 보존 (--preserve=all은 ext attr 포함)
tar --preserve=all -czf backup.tar.gz /etc/

# rsync로 복사 시 속성 보존 옵션 없음 → 속성 별도 백업 필요
```

---

**지난 글:** [ACL — getfacl·setfacl로 세밀한 권한 제어](/posts/linux-acl-getfacl-setfacl/)

**다음 글:** [불변 파일 — 시스템 파일을 침입자로부터 보호](/posts/linux-immutable-files/)

<br>
읽어주셔서 감사합니다. 😊
