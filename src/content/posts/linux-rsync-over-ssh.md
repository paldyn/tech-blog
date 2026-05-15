---
title: "rsync over SSH — 원격 파일 동기화"
description: "rsync의 델타 전송 알고리즘, SSH를 통한 원격 동기화, 주요 옵션(-avz --delete --exclude), 백업 자동화 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 8
type: "knowledge"
category: "Linux"
tags: ["linux", "rsync", "ssh", "file-sync", "backup", "delta-transfer", "scp", "remote-copy"]
featured: false
draft: false
---

[지난 글](/posts/linux-ssh-port-forward/)에서 SSH 포트 포워딩으로 암호화된 터널을 만드는 방법을 살펴봤습니다. 이번에는 SSH 위에서 파일을 효율적으로 동기화하는 **rsync**를 다룹니다. rsync는 단순한 파일 복사 도구가 아닙니다. 변경된 부분만 전송하는 델타 알고리즘 덕분에 대용량 파일의 증분 백업과 원격 동기화를 매우 빠르게 수행할 수 있습니다.

## 왜 scp 대신 rsync인가

`scp`는 파일 전체를 복사합니다. 100GB 파일에서 1바이트만 변경됐더라도 100GB를 다시 전송합니다. rsync는 **델타 전송(delta-transfer algorithm)**을 사용해 변경된 블록만 전송합니다. 이미 목적지에 비슷한 파일이 있다면 전송량이 극적으로 줄어듭니다.

| 항목 | scp | rsync |
|------|-----|-------|
| 전송 방식 | 전체 파일 | 변경 블록만 |
| 재개 지원 | 없음 | 있음 (`--partial`) |
| 디렉터리 동기화 | 없음 | 있음 (`--delete`) |
| 제외 패턴 | 없음 | 있음 (`--exclude`) |
| 압축 | 없음 | 있음 (`-z`) |

## 기본 문법

```bash
# 로컬 → 원격
rsync [옵션] 소스경로/ user@host:목적지경로/

# 원격 → 로컬
rsync [옵션] user@host:소스경로/ 목적지경로/

# 로컬 → 로컬 (복사/동기화)
rsync [옵션] /src/ /dst/
```

경로 끝의 `/` 유무가 중요합니다. `src/`는 src 디렉터리의 **내용물**을 동기화하고, `src`(슬래시 없음)는 src 디렉터리 **자체**를 목적지 안에 복사합니다.

## 필수 옵션

```bash
rsync -avz --delete /src/ user@host:/dst/
```

- `-a` (archive): `-rlptgoD`의 묶음. 재귀(`-r`), 심볼릭 링크(`-l`), 권한(`-p`), 타임스탬프(`-t`), 그룹(`-g`), 소유자(`-o`), 장치 파일(`-D`) 보존
- `-v` (verbose): 전송 파일 목록 출력
- `-z` (compress): 전송 시 압축 (느린 네트워크에서 유용)
- `--delete`: 소스에 없는 파일을 목적지에서 삭제 (미러 동기화)

![rsync 델타 전송](/assets/posts/linux-rsync-over-ssh-transfer.svg)

## 주요 옵션 상세

```bash
# 진행 상태 표시
rsync -avz --progress /src/ user@host:/dst/

# 드라이런 (실제 전송 없이 미리보기)
rsync -avzn /src/ user@host:/dst/
rsync -avz --dry-run /src/ user@host:/dst/

# 파일/디렉터리 제외
rsync -avz --exclude='*.log' --exclude='node_modules/' \
  /src/ user@host:/dst/

# 제외 패턴 파일로 관리
rsync -avz --exclude-from='.rsyncignore' \
  /src/ user@host:/dst/

# 체크섬으로 비교 (타임스탬프 대신)
rsync -avzc /src/ user@host:/dst/

# 부분 전송 (중단 후 재개)
rsync -avz --partial /src/ user@host:/dst/

# 백업 (덮어쓰기 전 이전 파일 보관)
rsync -avz --backup --backup-dir=/backup/$(date +%Y%m%d) \
  /src/ /dst/
```

![rsync 옵션 명령어](/assets/posts/linux-rsync-over-ssh-options.svg)

## SSH 옵션 지정

rsync는 기본적으로 SSH를 사용합니다. 포트나 키 파일을 바꾸려면 `-e` 옵션으로 SSH 명령을 지정합니다.

```bash
# 비표준 SSH 포트 사용
rsync -avz -e 'ssh -p 2222' /src/ user@host:/dst/

# 특정 키 파일 사용
rsync -avz -e 'ssh -i ~/.ssh/backup_key' \
  /src/ user@host:/dst/

# 포트 + 키 + StrictHostKeyChecking 조합
rsync -avz \
  -e 'ssh -p 2222 -i ~/.ssh/id_rsa -o StrictHostKeyChecking=no' \
  /src/ user@host:/dst/
```

## 실전 패턴: 백업 자동화

```bash
#!/bin/bash
# 일별 증분 백업 스크립트

SRC="/data/app/"
DST="backup@storage.example.com:/backups/"
DATE=$(date +%Y-%m-%d)
LOG="/var/log/rsync-backup.log"

rsync -avz --delete \
  --log-file="$LOG" \
  --stats \
  "$SRC" "$DST$DATE/" \
  2>&1 | tail -5

echo "[$DATE] 백업 완료, 종료 코드: $?" >> "$LOG"
```

```bash
# crontab -e 에 추가 (매일 새벽 2시 실행)
0 2 * * * /opt/scripts/backup.sh
```

## 대역폭 제한

```bash
# 초당 최대 5MB로 제한 (KB 단위)
rsync -avz --bwlimit=5120 /src/ user@host:/dst/

# 초당 최대 1MB
rsync -avz --bwlimit=1024 /src/ user@host:/dst/
```

업무 시간 중 백업을 실행할 때 서비스 대역폭을 보호하는 데 유용합니다.

## 전송 통계 확인

```bash
# 전송 후 통계 요약 출력
rsync -avz --stats /src/ user@host:/dst/

# 주요 통계 항목
# Number of files: 전체 파일 수
# Number of regular files transferred: 실제 전송된 파일 수
# Total file size: 원본 전체 크기
# Total transferred file size: 실제 전송 크기
# Literal data: 새로 보낸 데이터 (델타)
# Matched data: 이미 목적지에 있어서 복사 안 한 데이터
```

`Literal data`가 작을수록 델타 전송이 효율적으로 동작하고 있다는 뜻입니다.

## rsync 데몬 모드

SSH 없이 rsync 자체 프로토콜(873 포트)로도 동작할 수 있습니다. 내부망에서 고속 동기화가 필요할 때 쓰지만, 암호화가 없으므로 신뢰 네트워크에서만 권장됩니다.

```bash
# 데몬 실행 (서버 측)
rsync --daemon --config=/etc/rsyncd.conf

# 클라이언트 접속
rsync -av user@host::module_name /dst/
```

rsync는 파일 동기화와 백업의 사실상 표준 도구입니다. `-avz`로 시작해서 `--delete`, `--exclude`, `--bwlimit`, `--stats`를 상황에 맞게 조합하면 대부분의 파일 동기화 요구사항을 해결할 수 있습니다.

---

**지난 글:** [SSH 포트 포워딩 — -L, -R, -D 완전 정복](/posts/linux-ssh-port-forward/)

**다음 글:** [useradd & userdel — 사용자 생성과 삭제](/posts/linux-useradd-userdel/)

<br>
읽어주셔서 감사합니다. 😊
