---
title: "디스크 쿼터 — 사용자·그룹별 저장 공간 제한하기"
description: "리눅스 디스크 쿼터의 Soft/Hard Limit 구조, quotacheck·edquota·repquota 명령, Grace Period, XFS 쿼터까지 실전 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-25"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["linux", "quota", "filesystem", "disk", "storage", "edquota", "repquota", "xfs"]
featured: false
draft: false
---

[지난 글](/posts/linux-loopback-mount/)에서 루프백 마운트로 파일을 블록 디바이스처럼 다루는 방법을 살펴봤습니다. 이번에는 **디스크 쿼터(Quota)** — 사용자나 그룹이 사용할 수 있는 저장 공간과 파일 수를 제한하는 기능을 알아봅니다. 공유 서버나 NAS 환경에서 특정 사용자가 디스크를 독점하지 못하도록 막는 핵심 도구입니다.

## 쿼터의 두 가지 한계선

쿼터에는 두 종류의 임계값이 있습니다.

**Soft Limit**: 이 값을 초과해도 즉시 차단하지 않습니다. 대신 경고 메시지가 표시되고 **Grace Period**(유예 기간, 기본 7일)가 시작됩니다. 유예 기간 안에 사용량을 줄이지 않으면 이후 쓰기 작업이 차단됩니다.

**Hard Limit**: 이 값은 절대 초과할 수 없습니다. 초과하는 순간 커널이 `EDQUOT` 에러를 반환하고 쓰기가 즉시 실패합니다. 파일 크기뿐 아니라 **inode 수**(파일 개수)도 별도로 제한할 수 있습니다.

![디스크 쿼터 개념과 사용자·그룹 구조](/assets/posts/linux-quota-concept.svg)

## 쿼터 활성화 방법 (ext4 기준)

### 1단계: fstab에 마운트 옵션 추가

```bash
# /etc/fstab 편집
/dev/sda1  /home  ext4  defaults,usrquota,grpquota  0 2

# 변경 사항 적용 (재마운트)
sudo mount -o remount /home
```

`usrquota`는 사용자 쿼터, `grpquota`는 그룹 쿼터를 활성화합니다. 두 옵션을 동시에 사용할 수 있습니다.

### 2단계: 쿼터 데이터베이스 생성

```bash
# 쿼터 파일(aquota.user, aquota.group) 생성 및 초기화
sudo quotacheck -cugm /home
# -c: 새로 생성, -u: 사용자, -g: 그룹, -m: 재마운트 없이
```

### 3단계: 쿼터 활성화

```bash
# 모든 파일시스템 쿼터 켜기
sudo quotaon -a

# 특정 경로만
sudo quotaon /home
```

## 쿼터 설정: edquota

```bash
# 특정 사용자 쿼터 편집 (vi 에디터로 열림)
sudo edquota -u alice

# 그룹 쿼터 편집
sudo edquota -g developers

# Grace Period 변경
sudo edquota -t
```

에디터가 열리면 다음과 같은 형식을 볼 수 있습니다.

```
Disk quotas for user alice (uid 1001):
  Filesystem  blocks  soft    hard  inodes  soft  hard
  /dev/sda1   3276800 4194304 5242880  0     0     0
```

`blocks`는 현재 사용 중인 블록(1KB), `soft`와 `hard`는 각각 소프트/하드 한계입니다. inode도 같은 방식으로 제한합니다.

### 다른 사용자에게 동일한 설정 복사

```bash
# alice의 쿼터 설정을 bob, carol에게 복사
sudo edquota -p alice bob carol
```

## 쿼터 확인과 리포트

![쿼터 명령어 정리](/assets/posts/linux-quota-commands.svg)

```bash
# 현재 사용자 자신의 쿼터 확인
quota

# 특정 사용자 쿼터 확인 (root만 가능)
quota -u alice

# 파일시스템 전체 리포트 (GB 단위)
repquota -s /home

# 모든 파일시스템 리포트
repquota -a
```

`repquota` 출력 예시:

```
User            used    soft    hard  grace    used  soft  hard  grace
root      --      16       0       0              2     0     0
alice     --    3200    4096    5120              8     0     0
bob       -+    4900    4096    5120  6days      15     0     0
```

`-+` 표시는 soft limit를 초과해 Grace Period 카운트다운이 진행 중임을 의미합니다.

## XFS 쿼터

XFS는 별도 쿼터 파일 없이 커널이 내부적으로 관리합니다. `quotacheck`가 필요 없고 `xfs_quota` 명령을 사용합니다.

```bash
# fstab: uquota,gquota 옵션 사용
/dev/sdb1  /data  xfs  defaults,uquota,gquota  0 2

# xfs_quota로 제한 설정
sudo xfs_quota -x -c 'limit bsoft=4g bhard=5g alice' /data

# 상태 확인
sudo xfs_quota -x -c 'report -h' /data
```

XFS의 **프로젝트 쿼터**(`pquota`)는 사용자 단위가 아닌 **디렉터리 단위**로 제한을 걸 수 있어 웹 호스팅이나 프로젝트별 용량 분리에 유용합니다.

## 쿼터 비활성화

```bash
# 쿼터 끄기
sudo quotaoff -a

# 특정 사용자 쿼터 제거 (0으로 설정)
sudo edquota -u alice  # soft/hard를 0으로 변경
```

---

**지난 글:** [루프백 마운트 — 파일을 블록 디바이스로 다루기](/posts/linux-loopback-mount/)

**다음 글:** [심볼릭 링크의 함정 — 깨진 링크와 순환 참조 피하기](/posts/linux-symlink-pitfalls/)

<br>
읽어주셔서 감사합니다. 😊
