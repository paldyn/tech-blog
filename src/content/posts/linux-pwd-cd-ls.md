---
title: "pwd, cd, ls: 파일시스템 탐색의 기본기"
description: "Linux에서 가장 많이 쓰는 세 명령어 pwd·cd·ls의 옵션과 출력 형식을 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["Linux", "pwd", "cd", "ls", "파일탐색", "명령어"]
featured: false
draft: false
---

[지난 글](/posts/linux-fhs-directory-structure/)에서 Linux의 디렉터리 구조를 파악했다. 이제 그 구조를 실제로 탐색하는 세 가지 명령어를 익힐 차례다. **`pwd`, `cd`, `ls`** — Linux 사용자가 하루에 수백 번 입력하는 명령어들이다. 기본처럼 보이지만 옵션을 알면 작업 속도가 달라진다.

## pwd: 지금 어디 있는가

**pwd(Print Working Directory)**는 현재 위치하는 절대 경로를 출력한다. 길고 복잡한 디렉터리 구조를 오가다 보면 현재 위치를 잃기 쉽다. `pwd`로 먼저 위치를 확인하는 습관을 들이면 좋다.

```bash
pwd
# /home/alice/projects/myapp

# -P 옵션: 심볼릭 링크를 따라가 실제 경로 출력
pwd -P
# /data/mnt/volumes/myapp
```

프롬프트에 현재 경로를 표시하는 셸도 있지만(`$PS1`), 심볼릭 링크를 거친 경우 실제 물리 경로와 다를 수 있다. `-P`는 그런 경우 유용하다.

## cd: 디렉터리 이동

**cd(Change Directory)**는 현재 작업 디렉터리를 변경한다.

```bash
# 절대 경로로 이동
cd /etc/nginx

# 상대 경로로 이동 (현재 위치 기준)
cd conf.d

# 상위 디렉터리
cd ..

# 두 단계 위로
cd ../..

# 홈 디렉터리 (세 가지 방법 모두 동일)
cd
cd ~
cd $HOME

# 이전 위치로 복귀 (매우 유용!)
cd -
# /etc/nginx (이동 전 디렉터리 출력 후 이동)
```

`cd -`는 두 디렉터리를 오갈 때 특히 유용하다. `/var/log`와 `/etc/nginx`를 왔다갔다 해야 할 때 `cd -`를 반복하면 된다.

```bash
# pushd/popd: 디렉터리 스택 활용
pushd /etc/nginx    # 스택에 저장하고 이동
pushd /var/log      # 스택에 저장하고 이동
popd                # 이전 위치로 복귀 (/etc/nginx)
popd                # 그 이전 위치로 복귀
dirs                # 스택 내용 확인
```

## ls: 디렉터리 내용 보기

**ls(LiSt)**는 디렉터리 내용을 나열한다. 옵션 조합에 따라 출력 형식이 크게 달라진다.

![pwd·cd·ls 핵심 사용법](/assets/posts/linux-pwd-cd-ls-commands.svg)

가장 많이 쓰는 옵션들:

| 옵션 | 의미 |
|---|---|
| `-l` | 상세 형식(권한·크기·날짜) |
| `-a` | 숨김 파일(`.`으로 시작) 포함 |
| `-h` | 사람이 읽기 쉬운 크기(KB, MB) |
| `-t` | 수정 시간 역순 정렬 |
| `-r` | 역순 정렬 |
| `-S` | 파일 크기 정렬 |
| `-R` | 하위 디렉터리 재귀 나열 |

```bash
# 실무에서 가장 많이 쓰는 조합
ls -la        # 숨김 포함 상세
ls -lh        # 사람이 읽기 좋은 크기
ls -lt        # 최근 수정 파일 상위에
ls -lahtr     # 숨김+상세+크기단위+시간역순

# 특정 패턴 필터링
ls *.log      # 현재 디렉터리의 .log 파일
ls /var/log/*.log

# 디렉터리만 보기
ls -d */

# 특정 디렉터리 지정
ls -la /etc/ssh/
```

## ls -la 출력 해석

![ls -la 출력 해석](/assets/posts/linux-pwd-cd-ls-output.svg)

`ls -la` 출력의 각 컬럼은 다음을 의미한다.

1. **파일 타입 + 권한** (10글자): 첫 글자 `-`(파일) `d`(디렉터리) `l`(링크), 이후 9글자 rwxrwxrwx
2. **링크 수**: 하드 링크 개수
3. **소유자**: 파일 소유 사용자
4. **그룹**: 파일 소유 그룹
5. **크기**: 바이트 단위 (`-h`면 사람이 읽기 좋은 단위)
6. **수정 시간**: 마지막 수정 일시
7. **파일명**: `.`은 현재 디렉터리, `..`은 상위 디렉터리

```bash
# 파일 메타데이터 상세 확인
stat /etc/hostname
# File: /etc/hostname
# Size: 9              Blocks: 8         IO Block: 4096  regular file
# Device: fd00h/64768d  Inode: 262146   Links: 1
# Access: (0644/-rw-r--r--)  Uid: (   0/  root)   Gid: (   0/  root)
# Access: 2026-05-08 09:00:00
# Modify: 2026-04-01 12:00:00
# Change: 2026-04-01 12:00:00
```

## 유용한 별칭 설정

자주 쓰는 조합은 `~/.bashrc`에 alias로 등록해두면 편하다.

```bash
# ~/.bashrc에 추가
alias ll='ls -lahtr'
alias la='ls -la'
alias l='ls -lh'

# 색상 출력 항상 켜기
alias ls='ls --color=auto'

# 적용
source ~/.bashrc
```

`ls`에 색상이 보이는 이유는 대부분의 배포판이 `~/.bashrc`에 `alias ls='ls --color=auto'`를 기본으로 넣어두기 때문이다.

---

**지난 글:** [Linux FHS: 디렉터리 구조 완전 정복](/posts/linux-fhs-directory-structure/)

**다음 글:** [파일과 디렉터리의 차이: Linux가 구분하는 방법](/posts/linux-file-vs-directory/)

<br>
읽어주셔서 감사합니다. 😊
