---
title: "파일과 디렉터리의 차이: Linux가 구분하는 방법"
description: "Linux에서 파일과 디렉터리의 내부 구조 차이, inode, 그리고 조작 명령어를 명확히 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 10
type: "knowledge"
category: "Linux"
tags: ["Linux", "파일", "디렉터리", "inode", "파일시스템"]
featured: false
draft: false
---

[지난 글](/posts/linux-pwd-cd-ls/)에서 파일시스템을 탐색하는 명령어를 익혔다. 이번 글에서는 탐색의 대상인 **파일과 디렉터리**가 내부적으로 어떻게 다른지, 그리고 두 대상을 다루는 명령어를 체계적으로 정리한다. "디렉터리도 사실 파일이다"라는 말의 의미를 이해하면 Linux 파일시스템 전체가 훨씬 명확해진다.

## 파일이란

Linux에서 파일은 **데이터 블록과 inode로 이뤄진 저장 단위**다. 파일의 실제 내용(바이트 데이터)은 디스크의 데이터 블록에 저장된다. **inode(index node)**는 파일의 메타데이터 — 권한, 소유자, 크기, 수정 시간, 데이터 블록 위치 — 를 담는 작은 구조체다. 파일 이름은 inode에 없다. 파일 이름은 **디렉터리**가 관리한다.

```bash
# inode 번호 확인
ls -i /etc/hostname
# 262146 /etc/hostname

# inode 상세 정보
stat /etc/hostname
# File: /etc/hostname
# Size: 9          Inode: 262146   Links: 1
# Access: (0644/-rw-r--r--)
```

## 디렉터리란

이것이 핵심이다. **디렉터리는 특별한 파일이다.** 일반 파일의 데이터 블록에는 바이트 데이터가 있지만, 디렉터리의 데이터 블록에는 **파일명 → inode 번호 매핑 테이블(디렉터리 엔트리)**이 있다.

![파일 vs 디렉터리: 내부 구조](/assets/posts/linux-file-vs-directory-concept.svg)

디렉터리 `/etc/nginx/`의 데이터 블록에는 이런 내용이 들어 있다.

```
inode 262146  →  "nginx.conf"
inode 262147  →  "conf.d"
inode 262148  →  "sites-available"
inode 1       →  "."          (자기 자신)
inode 부모     →  ".."         (부모 디렉터리)
```

파일을 `open("/etc/nginx/nginx.conf")`로 열면 커널은 다음 과정을 거친다.

1. `/`의 inode를 찾는다
2. `/`의 데이터 블록에서 `etc` 엔트리를 찾아 inode를 얻는다
3. `/etc`의 데이터 블록에서 `nginx` 엔트리를 찾는다
4. `/etc/nginx`의 데이터 블록에서 `nginx.conf`의 inode를 찾는다
5. 해당 inode로 데이터 블록에 접근한다

## 타입 확인 방법

```bash
# file 명령어로 타입 확인
file /etc
# /etc: directory

file /etc/hostname
# /etc/hostname: ASCII text

file /dev/sda
# /dev/sda: block special (8/0)

# ls -la 첫 글자
# d = directory, - = regular file, l = symlink
ls -la /etc | head -5

# 셸 조건문에서 타입 검사
if [ -f /etc/hostname ]; then
  echo "파일입니다"
fi

if [ -d /etc/nginx ]; then
  echo "디렉터리입니다"
fi
```

## 파일 · 디렉터리 조작 명령어

![파일 · 디렉터리 조작 명령어 비교](/assets/posts/linux-file-vs-directory-operations.svg)

```bash
# 파일 생성
touch newfile.txt          # 빈 파일 생성 (또는 타임스탬프 갱신)
echo "content" > file.txt  # 내용 포함 생성

# 디렉터리 생성
mkdir mydir
mkdir -p /tmp/a/b/c        # 중간 경로까지 한번에 생성

# 삭제
rm file.txt                # 파일 삭제
rm -i file.txt             # 확인하며 삭제 (-i: interactive)
rmdir emptydir             # 빈 디렉터리만 삭제
rm -r mydir/               # 디렉터리와 내용 모두 삭제
rm -rf mydir/              # 확인 없이 강제 삭제 (위험!)
```

## 파일명과 inode의 분리가 주는 의미

파일 이름이 inode에 없다는 사실이 중요한 이유가 있다. 하나의 inode를 가리키는 이름이 여러 개 있을 수 있다. 이를 **하드 링크(hard link)**라 한다.

```bash
# 하드 링크 생성
ln /etc/hostname /tmp/myhostname

# 같은 inode를 공유
ls -i /etc/hostname /tmp/myhostname
# 262146 /etc/hostname
# 262146 /tmp/myhostname

# 링크 수가 2로 증가
stat /etc/hostname | grep Links
# Links: 2
```

파일을 "삭제"하는 것은 정확히는 디렉터리 엔트리(이름)를 제거하는 것이다. inode의 링크 수가 0이 되면 그때 커널이 데이터 블록을 회수한다. 그래서 프로세스가 파일을 열고 있는 상태에서 `rm`으로 삭제해도 프로세스가 종료될 때까지 데이터가 실제로 지워지지 않는다.

```bash
# 열린 파일 확인 (lsof: list open files)
lsof /var/log/syslog

# 삭제됐지만 아직 열린 파일 확인
lsof | grep deleted
```

## 권한의 차이

파일과 디렉터리에서 `rwx` 권한의 의미가 다르다.

| 권한 | 파일 | 디렉터리 |
|---|---|---|
| r | 내용 읽기 | `ls`로 내용 나열 |
| w | 내용 수정 | 파일 생성·삭제 |
| x | 실행 | `cd`로 진입 |

디렉터리의 `x` 권한이 없으면 `cd`로 들어갈 수 없다. `r`만 있으면 파일 이름은 보이지만 내부 접근이 불가능하다. 이 차이는 권한 문제를 디버깅할 때 중요하게 작동한다.

---

**지난 글:** [pwd, cd, ls: 파일시스템 탐색의 기본기](/posts/linux-pwd-cd-ls/)

<br>
읽어주셔서 감사합니다. 😊
