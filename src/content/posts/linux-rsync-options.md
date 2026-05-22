---
title: "rsync 옵션 완전 해설 — -avz부터 --partial까지"
description: "rsync의 델타 전송 알고리즘 원리와 -a, -z, --delete, --exclude, --bwlimit, --partial 등 실무 필수 옵션을 체계적으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 3
type: "knowledge"
category: "Linux"
tags: ["linux", "rsync", "backup", "sync", "delta-transfer", "options", "exclude", "bwlimit"]
featured: false
draft: false
---

[지난 글](/posts/linux-ssh-tunnel/)에서 SSH 터널로 암호화 채널을 만드는 방법을 살펴봤습니다. rsync는 SSH 위에서 파일을 동기화하는 도구인데, 단순히 `-avz`만 알고 쓰다 보면 실수가 생깁니다. 이 글에서는 rsync의 핵심 옵션을 하나씩 짚고, 실무에서 자주 쓰는 조합 패턴을 정리합니다.

## 델타 전송의 원리

rsync가 빠른 이유는 **변경된 블록만 전송**하기 때문입니다. 원격 서버가 기존 파일의 각 블록에 대한 체크섬을 보내면, 로컬이 비교해서 달라진 부분만 전송합니다. 100GB 파일에서 1MB가 바뀌었다면 1MB+오버헤드만 전송됩니다.

![rsync 델타 전송 알고리즘](/assets/posts/linux-rsync-options-delta.svg)

기본적으로 rsync는 파일 크기와 수정 시각으로 변경 여부를 판단합니다. 더 정확한 판단이 필요하면 `--checksum`을 추가하면 MD5로 내용을 비교하지만 속도는 느려집니다.

## 필수 옵션 조합

```bash
# 가장 일반적인 로컬 디렉터리 동기화
rsync -av src/ dst/

# 원격 백업 (SSH 경유)
rsync -avz --delete user@host:/remote/src/ /local/dst/

# 사전 확인 — 실제 전송 없이 무엇이 변경되는지 확인
rsync -avn --delete src/ user@host:dst/
```

`-a`는 `-rlptgoD`의 묶음입니다: **r**ecursive, **l**inks(심볼릭 링크 보존), **p**ermissions, **t**imestamps, **g**roup, **o**wner, **D**(디바이스 파일). 대부분의 백업에서 `-a` 하나로 충분합니다.

![rsync 핵심 옵션 레퍼런스](/assets/posts/linux-rsync-options-flags.svg)

## --delete 주의사항

`--delete`는 목적지에만 있고 원본에 없는 파일을 삭제합니다. 백업을 완전한 미러로 유지할 때 필요하지만 실수로 파일이 지워질 위험이 있습니다.

```bash
# 반드시 --dry-run으로 먼저 확인
rsync -avn --delete src/ user@host:dst/

# 확인 후 실제 실행
rsync -av --delete src/ user@host:dst/
```

`--delete-after` 옵션은 전송 완료 후에 삭제를 처리하므로 전송 도중 중단되어도 목적지가 깨지지 않습니다.

## 파일 제외 패턴

```bash
# 단일 패턴 제외
rsync -av --exclude='*.log' src/ dst/

# 복수 제외
rsync -av --exclude='*.log' --exclude='tmp/' --exclude='.git/' src/ dst/

# 파일로 관리 (.gitignore 스타일)
rsync -av --exclude-from=.rsyncignore src/ dst/
```

`.rsyncignore` 파일 예:

```
*.log
*.tmp
.git/
node_modules/
__pycache__/
```

## 대용량 파일과 중단 재개

```bash
# --partial: 중단된 파일을 목적지에 보존 (다음 실행에 이어받기)
# --progress: 진행률 실시간 표시
rsync -av --partial --progress large_file.tar.gz user@host:~/

# --partial-dir: 임시 파일을 별도 디렉터리에 보관
rsync -av --partial-dir=.rsync-partial --progress src/ user@host:dst/
```

인터넷 연결이 불안정한 환경에서 대용량 파일을 전송할 때 `--partial`은 필수입니다.

## 대역폭 제한

운영 중인 서버에서 백업 실행 시 네트워크 포화를 막습니다.

```bash
# --bwlimit: KB/s 단위
rsync -av --bwlimit=5120 src/ user@host:dst/  # 5MB/s 제한
```

## SSH 옵션 전달

```bash
# 비표준 포트 사용
rsync -av -e "ssh -p 2222" src/ user@host:dst/

# SSH 키 명시
rsync -av -e "ssh -i ~/.ssh/deploy_key" src/ user@host:dst/

# SSH 압축 끄기 (rsync -z와 이중 압축 방지)
rsync -av -z -e "ssh -o Compression=no" src/ user@host:dst/
```

## 실무 백업 스크립트 패턴

```bash
#!/bin/bash
set -euo pipefail

SRC="/var/www/html/"
DEST="backup@192.168.1.10:/backup/web/$(date +%Y%m%d)/"
LOG="/var/log/rsync-$(date +%Y%m%d).log"

rsync -avz \
  --delete \
  --exclude='*.log' \
  --exclude='tmp/' \
  --partial \
  --bwlimit=10240 \
  --log-file="$LOG" \
  "$SRC" "$DEST"

echo "백업 완료: $(date)" >> "$LOG"
```

`--log-file`로 rsync 자체 로그를 남기면 어떤 파일이 전송됐는지 추후 추적할 수 있습니다.

---

**지난 글:** [SSH 터널 — 로컬·리모트·다이나믹 포워딩 완전 정리](/posts/linux-ssh-tunnel/)

**다음 글:** [SCP vs rsync — 무엇을 선택할까](/posts/linux-scp-vs-rsync/)

<br>
읽어주셔서 감사합니다. 😊
