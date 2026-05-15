---
title: "df/du — 디스크 사용량 한눈에 파악하기"
description: "df로 파일시스템 전체 공간을 확인하고, du로 어느 디렉터리가 공간을 잡아먹는지 탐색하는 방법을 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 3
type: "knowledge"
category: "Linux"
tags: ["linux", "df", "du", "disk", "storage", "filesystem"]
featured: false
draft: false
---

[지난 글](/posts/linux-fstab/)에서 `/etc/fstab`으로 부팅 시 자동 마운트를 설정하는 방법을 배웠습니다. 파일시스템이 마운트됐다면, 이제 **얼마나 공간이 남아 있는지** 확인해야 합니다. 여기서 `df`와 `du`가 등장합니다.

두 명령은 관점이 다릅니다. `df`(Disk Free)는 **파일시스템 단위** 전체 용량을 보고, `du`(Disk Usage)는 **디렉터리 단위**로 실제 사용량을 파고듭니다. 디스크가 가득 찼을 때는 df로 어느 파티션인지 파악한 뒤, du로 어느 디렉터리가 범인인지 추적합니다.

## df — 파일시스템 전체 현황

![df 출력 분석](/assets/posts/linux-disk-usage-df-output.svg)

```bash
# 가장 많이 쓰는 형태 — 사람이 읽기 쉬운 단위
df -h

# 파일시스템 타입(ext4, xfs 등)도 포함
df -hT

# inode 사용률 확인 (파일 개수 한도)
df -i

# 특정 경로만
df -h /var
```

**inode 소진 주의**: 파일시스템 블록 공간이 남아 있어도 inode가 모두 소모되면 새 파일을 만들 수 없습니다. `df -i`로 `IUse%`가 100%에 가까우면 작은 파일(캐시, 세션 파일 등)이 대량 생성된 것이니 정리가 필요합니다.

## du — 디렉터리별 사용량 탐색

![du 트리 분석 — 어느 디렉터리가 공간을 차지하나](/assets/posts/linux-disk-usage-du-tree.svg)

```bash
# 현재 디렉터리 합계
du -sh .

# 1단계 하위 디렉터리 크기 정렬
du -h --max-depth=1 /var | sort -rh | head -10

# 특정 디렉터리 전체 합계
du -sh /home/alice

# 심볼릭 링크 따라가기 (-L 주의: 이중 계산 가능)
du -shL /var/log
```

`sort -rh`의 `-h`는 `1G > 100M > 10K` 식의 사람이 읽는 단위 정렬을 처리합니다. `--max-depth=1`을 빼면 재귀적으로 전체 트리를 출력해 출력이 매우 길어집니다.

## 디스크 가득 찼을 때 실전 추적

```bash
# 1. 어느 파티션이 꽉 찼나?
df -h

# 2. 그 파티션에서 큰 디렉터리 순위 탐색
du -h --max-depth=1 /var | sort -rh | head -20

# 3. 그 안에서 다시 드릴다운
du -h --max-depth=1 /var/log | sort -rh | head -10

# 4. 대용량 파일 직접 검색
find /var/log -type f -size +100M -ls 2>/dev/null

# 5. 삭제된 파일이지만 프로세스가 열어 두고 있는 경우
lsof +L1 | grep deleted
```

5번은 흔히 놓치는 함정입니다. 로그 파일을 `rm`으로 지워도 프로세스가 파일 핸들을 유지하면 공간이 해제되지 않습니다. `lsof +L1`으로 확인 후 해당 프로세스를 재시작하거나 `> /proc/<PID>/fd/<FD>` 로 비우면 됩니다.

## ncdu — 대화형 du 탐색기

```bash
# 설치 (Debian/Ubuntu)
sudo apt install ncdu

# /var 디렉터리 대화형 탐색
ncdu /var
```

`ncdu`는 화살표 키로 탐색하고 `d`로 삭제까지 할 수 있는 터미널 UI입니다. 대용량 서버에서 공간을 확보할 때 매우 편리합니다.

## df와 du의 수치 차이

```bash
du -sh /var      # 출력: 8.5G
df -h /var       # Used 컬럼: 9.1G
```

두 수치가 다를 수 있습니다. `du`는 디렉터리 트리를 순회해서 파일 크기를 합산하지만, `df`는 파일시스템 슈퍼블록의 블록 사용량을 읽습니다. 삭제됐지만 핸들이 열린 파일, 저널 공간, 예약된 블록(루트 예약 5%) 등이 차이를 만듭니다.

## 정리

- `df -h`: 파일시스템 전체 용량·사용률 확인
- `df -i`: inode 소진 여부 확인
- `du -sh 경로`: 특정 디렉터리 크기
- `du -h --max-depth=1 경로 | sort -rh`: 디렉터리별 크기 순위
- 삭제했는데 공간 안 늘어나면 `lsof +L1`으로 열린 파일 핸들 확인

---

**지난 글:** [/etc/fstab — 부팅 자동 마운트 설정 완전 정복](/posts/linux-fstab/)

**다음 글:** [lsblk/blkid — 블록 장치 조회하기](/posts/linux-lsblk-blkid/)

<br>
읽어주셔서 감사합니다. 😊
