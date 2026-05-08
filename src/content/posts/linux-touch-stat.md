---
title: "touch & stat: 파일 생성과 메타데이터 조회"
description: "touch로 파일을 만들고 타임스탬프를 조작하며, stat 명령어로 파일의 모든 메타데이터를 읽는 방법을 배운다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 7
type: "knowledge"
category: "Linux"
tags: ["Linux", "touch", "stat", "타임스탬프", "inode", "메타데이터"]
featured: false
draft: false
---

[지난 글](/posts/linux-mkdir-rmdir/)에서 디렉터리를 만들고 지우는 방법을 배웠다. 이번 글에서는 **파일을 빈 상태로 생성하거나 타임스탬프를 조작하는 `touch`**와 **파일의 모든 메타데이터를 조회하는 `stat`**을 다룬다. 두 명령어는 쉘 스크립트에서 조건 판단이나 빌드 시스템에서 자주 등장한다.

## touch — 파일 생성과 타임스탬프 갱신

`touch`는 두 가지 역할을 한다. 파일이 존재하지 않으면 **0바이트 빈 파일을 생성**하고, 이미 존재하면 **atime(접근 시각)과 mtime(수정 시각)을 현재 시각으로 갱신**한다.

```bash
touch newfile.txt                # 빈 파일 생성 또는 타임스탬프 갱신
touch file1.txt file2.txt        # 여러 파일을 한 번에
touch -a file.txt                # atime 만 갱신
touch -m file.txt                # mtime 만 갱신
touch -t 202601011200 file.txt   # 특정 시각으로 설정 (YYYYMMDDhhmm)
touch -d "2026-01-01 12:00" file # 날짜 문자열로 지정
touch -r ref.txt target.txt      # ref.txt 의 타임스탬프를 target.txt 에 복사
```

`-t` 포맷은 `[[CC]YY]MMDDhhmm[.ss]` 형식이다. 초까지 지정하려면 `.ss`를 추가한다.

## atime · mtime · ctime 이해

Linux 파일에는 세 가지 타임스탬프가 있다.

| 이름 | 의미 | 갱신 조건 |
|---|---|---|
| **atime** | Access Time — 마지막 접근 | 파일 읽기 (`cat`, `less`, `cp` 원본) |
| **mtime** | Modify Time — 마지막 수정 | 파일 데이터 내용 변경 |
| **ctime** | Change Time — 마지막 변경 | inode 변경 (권한, 소유자, 링크, 내용 변경) |

`ctime`은 파일 **생성 시각이 아니다**. inode가 변경되는 모든 경우에 갱신된다. 생성 시각(Birth)은 `ext4` 이상의 파일시스템에서 `stat` 명령으로 확인할 수 있지만 `-`로 표시되는 경우도 있다.

![파일의 세 가지 타임스탬프](/assets/posts/linux-touch-stat-timestamps.svg)

`ls`의 타임스탬프 옵션:

```bash
ls -l    # mtime 기준 (기본)
ls -lu   # atime 기준
ls -lc   # ctime 기준
ls -lt   # mtime 내림차순 정렬
```

## stat — 파일 메타데이터 전체 조회

`stat`는 파일의 inode에 저장된 모든 메타데이터를 보여준다.

```bash
stat file.txt                    # 전체 정보 출력
stat -L symlink.txt              # 심볼릭 링크의 실제 대상 정보
stat --file-system file.txt      # 파일시스템 정보 출력
```

출력에서 주요 항목은 다음과 같다.

- **Size**: 파일 데이터 크기(바이트)
- **Blocks**: 실제 점유 디스크 블록 수(512바이트 단위)
- **Inode**: 이 파일의 inode 번호
- **Links**: 하드 링크 수
- **Access (0644)**: 8진수 권한 + 심볼릭 표현
- **Uid / Gid**: 소유 사용자·그룹 ID 및 이름
- **Access / Modify / Change**: atime, mtime, ctime

![stat 명령 출력 해설](/assets/posts/linux-touch-stat-output.svg)

## stat -c: 선택적 필드 출력

스크립트에서 타임스탬프나 크기만 추출할 때는 `-c` 포맷 옵션을 사용한다.

```bash
stat -c '%s' file.txt            # 파일 크기(바이트)만 출력
stat -c '%Y' file.txt            # mtime 에포크(초) 출력
stat -c '%n %s %Y' *.txt         # 여러 파일의 이름·크기·mtime
stat -c '%a' file.txt            # 8진수 권한만 (예: 644)
stat -c '%U:%G' file.txt         # 소유자:그룹 이름
```

`%Y`는 epoch 초이므로 `date -d @$(stat -c '%Y' file.txt)` 처럼 사람이 읽기 좋은 시각으로 변환할 수 있다.

## make와 빌드 시스템에서의 활용

`make`는 대상 파일(target)의 `mtime`과 소스 파일의 `mtime`을 비교해 재컴파일 여부를 결정한다. `touch`로 소스 파일의 `mtime`을 갱신하면 강제 재빌드를 유도할 수 있다.

```bash
touch src/main.c       # main.c 의 mtime 갱신 → make 가 재컴파일
touch -m -d "yesterday" src/main.c  # mtime 을 어제로 설정 → 재빌드 억제
```

## 파일 존재 여부 확인과 touch 활용

쉘 스크립트에서 "파일이 없으면 만들고, 있으면 건드리지 않는다"는 패턴이 자주 쓰인다.

```bash
# 파일이 없을 때만 생성 (-n 으로 분기)
[ -f lockfile ] || touch lockfile

# 임시 작업 완료 마커 생성
touch /tmp/job.done

# 스크립트에서 자주 쓰는 임시 파일
TMPFILE=$(mktemp)
trap "rm -f $TMPFILE" EXIT
```

---

**지난 글:** [mkdir & rmdir: 디렉터리 생성과 삭제](/posts/linux-mkdir-rmdir/)

**다음 글:** [find 기초: 파일 이름·크기·날짜로 검색하기](/posts/linux-find-basics/)

<br>
읽어주셔서 감사합니다. 😊
