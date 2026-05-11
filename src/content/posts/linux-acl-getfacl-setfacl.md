---
title: "ACL — getfacl·setfacl로 세밀한 권한 제어"
description: "리눅스 ACL(Access Control List)의 개념, getfacl로 ACL 읽기, setfacl로 사용자·그룹별 권한 설정, mask 동작 원리, 기본 ACL(default ACL) 설정까지 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 8
type: "knowledge"
category: "Linux"
tags: ["linux", "acl", "getfacl", "setfacl", "permissions", "security", "filesystem"]
featured: false
draft: false
---

[지난 글](/posts/linux-special-bits-suid-sgid-sticky/)에서 SUID·SGID·Sticky 비트를 다뤘습니다. 전통적인 리눅스 권한은 소유자·그룹·기타 3계층만 표현할 수 있어, 여러 사용자에게 각기 다른 권한을 줘야 할 때 한계가 있습니다. **ACL(Access Control List)**은 이 한계를 돌파합니다.

## ACL이란

ACL은 **파일 하나에 여러 사용자·그룹별 권한을 독립적으로 부여**할 수 있는 확장 권한 체계입니다. 파일시스템(ext4, xfs, btrfs 등)이 지원해야 하며, 마운트 옵션에 `acl`이 포함되어 있어야 합니다(현대 배포판 기본 활성화).

```bash
# ACL 지원 여부 확인
mount | grep acl
tune2fs -l /dev/sda1 | grep "Default mount"
```

![전통 권한 vs ACL — 표현력 비교](/assets/posts/linux-acl-traditional-vs-acl.svg)

## 패키지 설치

```bash
# Debian/Ubuntu
sudo apt install acl

# RHEL/Rocky
sudo dnf install acl
```

## getfacl — ACL 읽기

```bash
# ACL 보기
getfacl report.txt

# 짧은 형식
getfacl -c report.txt   # 주석 제거

# 재귀 (디렉터리)
getfacl -R /srv/team/
```

![getfacl 출력 해석](/assets/posts/linux-acl-getfacl-output.svg)

`ls -l`에서 권한 문자열 끝에 `+`가 붙으면 ACL이 설정된 파일입니다.

```bash
ls -l report.txt
# -rw-r--r--+ 1 alice devteam 1024 ... report.txt
#           ^--- + = ACL 있음
```

## setfacl — ACL 설정

### 기본 문법

```bash
setfacl -m  항목  파일   # 수정(modify)
setfacl -x  항목  파일   # 삭제(remove)
setfacl -b        파일   # 모든 ACL 제거
setfacl -k        파일   # 기본 ACL만 제거
```

### 사용자별 권한 설정

```bash
# bob에게 읽기 권한
setfacl -m u:bob:r report.txt

# alice에게 읽기/쓰기
setfacl -m u:alice:rw report.txt

# charlie 접근 차단
setfacl -m u:charlie:--- report.txt

# 여러 항목 한 번에
setfacl -m u:bob:r,u:alice:rw,g:devops:r report.txt
```

### 그룹별 권한 설정

```bash
# devops 그룹에게 읽기
setfacl -m g:devops:r report.txt

# ops 그룹 ACL 제거
setfacl -x g:ops report.txt
```

### ACL 전체 제거

```bash
# 모든 ACL 항목 제거 (전통 권한만 남김)
setfacl -b report.txt
```

## mask — 유효 권한 상한선

ACL에는 `mask` 항목이 존재합니다. **named user와 named group의 ACL에 AND 연산**으로 적용되어 유효 권한의 최대치를 제한합니다.

```bash
# mask 확인
getfacl report.txt | grep mask
# mask::rw-

# mask를 r--로 변경하면 bob의 rw 권한도 r--로 제한됨
setfacl -m m::r report.txt
```

mask를 변경하면 `chmod` 그룹 권한 비트가 mask를 반영합니다. 주의: `chmod g+w` 명령은 mask를 변경합니다.

## 기본 ACL (Default ACL)

디렉터리에 **기본 ACL(default ACL)**을 설정하면, 해당 디렉터리 안에 새로 만들어지는 파일과 하위 디렉터리가 자동으로 ACL을 상속합니다.

```bash
# /srv/team에 기본 ACL 설정
setfacl -d -m u:bob:r /srv/team
setfacl -d -m g:devops:rw /srv/team

# 확인 (default: 접두사)
getfacl /srv/team
# default:user::rwx
# default:user:bob:r--
# default:group::rwx
# default:group:devops:rw-
# default:mask::rwx
# default:other::---
```

SGID 대신 기본 ACL을 쓰면 그룹 상속 외에도 **개별 사용자 차등 권한**까지 처리할 수 있습니다.

## ACL 백업 및 복원

ACL 정보는 `cp`나 `rsync`로 항상 복사되지 않습니다. 명시적 백업이 필요합니다.

```bash
# ACL 백업
getfacl -R /srv/team > /tmp/acl-backup.txt

# ACL 복원
setfacl --restore=/tmp/acl-backup.txt
```

## 실전 시나리오: 프로젝트 디렉터리

```bash
# /srv/project 구성
sudo mkdir /srv/project
sudo chown alice:devteam /srv/project
sudo chmod 770 /srv/project

# 프리랜서 charlie에게 읽기만
sudo setfacl -m u:charlie:rx /srv/project

# 감사 도구(auditd)가 쓸 수 있도록
sudo setfacl -m u:auditd:r /srv/project/logs/

# 새 파일도 자동으로 같은 ACL 상속
sudo setfacl -d -m u:charlie:rx /srv/project
```

---

**지난 글:** [SUID·SGID·Sticky 비트 — 특수 권한 완전 정복](/posts/linux-special-bits-suid-sgid-sticky/)

**다음 글:** [chattr — 파일 속성으로 추가 보호](/posts/linux-attributes-chattr/)

<br>
읽어주셔서 감사합니다. 😊
