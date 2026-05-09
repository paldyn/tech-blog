---
title: "inode 완전 해부: 파일 시스템의 심장"
description: "inode가 무엇인지, 어떤 메타데이터를 담는지, 파일 이름과의 관계, inode 고갈 문제를 stat·ls·df 명령으로 실제 확인하는 방법을 익힌다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 8
type: "knowledge"
category: "Linux"
tags: ["Linux", "inode", "파일시스템", "stat", "메타데이터", "하드링크"]
featured: false
draft: false
---

[지난 글](/posts/linux-read-input/)에서 `read`로 입력을 처리하는 방법을 익혔다. 이번에는 리눅스 파일 시스템의 핵심 개념인 **inode**를 해부한다. "파일을 어떻게 저장하는가?"를 이해하려면 inode를 피해갈 수 없다. inode를 알면 하드 링크, 파일 이름 변경, 권한 변경, 디스크 "파일 생성 불가" 오류의 원인까지 한 번에 이해된다.

## inode란 무엇인가

파일 시스템은 각 파일에 고유한 번호(**inode 번호**)를 부여하고, 그 번호에 해당하는 **inode** 자료구조에 파일의 모든 메타데이터를 저장한다.

inode에 담기는 정보:

- 파일 유형 (일반 파일, 디렉터리, 심볼릭 링크, …)
- 권한 (rwxrwxrwx)
- 소유자 UID/GID
- 파일 크기 (bytes)
- 하드 링크 수
- 접근/수정/변경 시간 (atime/mtime/ctime)
- 데이터 블록 포인터

**inode에 없는 것: 파일 이름.** 파일 이름은 디렉터리가 관리한다. 디렉터리는 `{파일 이름 → inode 번호}` 매핑 테이블이다.

## 파일 이름과 inode의 분리

```bash
ls -li     # -i: inode 번호 함께 출력
# 42381 -rw-r--r-- 2 user user 2048 May 10 hello.txt
# 42381 -rw-r--r-- 2 user user 2048 May 10 link.txt
```

`hello.txt`와 `link.txt`가 같은 inode 번호(42381)를 가리키는 것을 확인할 수 있다. 이것이 **하드 링크**다. 두 이름은 완전히 동등하며 어느 쪽으로 수정해도 동일한 데이터를 변경한다.

![inode 구조](/assets/posts/linux-inode-essence-structure.svg)

## stat — inode 전체 정보 조회

```bash
stat hello.txt
```

`stat` 출력에서 중요한 필드:

| 필드 | 의미 |
|---|---|
| `Inode` | inode 번호 |
| `Links` | 하드 링크 수 |
| `Access` | atime — 마지막으로 읽은 시각 |
| `Modify` | mtime — 내용을 마지막으로 수정한 시각 |
| `Change` | ctime — inode 메타데이터(권한·소유자 등)를 마지막으로 변경한 시각 |

**ctime과 mtime은 다르다.** `chmod`로 권한을 바꾸면 ctime은 갱신되지만 mtime은 변하지 않는다. 반대로 내용을 수정하면 둘 다 갱신된다.

## 세 가지 시간 타임스탬프

```bash
# 파일 읽기 → atime 갱신 (noatime 마운트 옵션으로 비활성화 가능)
cat hello.txt

# 파일 내용 수정 → mtime, ctime 갱신
echo "data" >> hello.txt

# 권한 변경 → ctime 갱신 (mtime은 유지)
chmod 644 hello.txt

# find: 수정 시각 기준 검색
find /var/log -mtime -7        # 7일 이내에 수정된 파일
find /tmp -newer /etc/fstab    # /etc/fstab보다 최근 파일
```

성능이 중요한 서버에서는 `/etc/fstab`에 `noatime` 옵션을 붙여 불필요한 atime 기록을 생략하는 경우가 많다.

## inode 번호 확인

```bash
ls -i file.txt          # 42381 file.txt
stat file.txt           # Inode: 42381 출력
find . -inum 42381      # inode 번호로 파일 찾기
```

파일 이름을 모르지만 inode 번호를 알고 있을 때 `find -inum`으로 해당 파일을 찾을 수 있다.

## inode 고갈 — 파일 크기 여유가 있는데 생성 불가

```bash
df -h /      # 디스크 용량: 30% 사용 중
touch newfile.txt
# touch: cannot touch 'newfile.txt': No space left on device
```

용량이 충분한데 파일을 못 만든다면 inode가 고갈된 것이다.

```bash
df -i /      # inode 사용률 확인
# IUse% 100% → inode 고갈
```

![inode 조회 명령어](/assets/posts/linux-inode-essence-commands.svg)

inode 고갈은 소규모 파일이 극단적으로 많을 때 발생한다. 메일 서버의 스풀 디렉터리, 임시 파일 누적, npm/pip 캐시 등이 대표적인 원인이다. 해결책은 불필요한 파일을 삭제해 inode를 회수하거나, 파일 시스템 생성 시 더 많은 inode를 할당하는 것이다.

```bash
# inode 가장 많이 쓰는 디렉터리 찾기
find / -xdev -printf '%h\n' | sort | uniq -c | sort -rn | head -20
```

## inode와 파일 삭제

파일을 `rm`으로 삭제하면 디렉터리에서 `{파일명 → inode}` 항목이 제거되고, inode의 링크 수가 1 줄어든다. 링크 수가 0이 되면 그때 비로소 inode와 데이터 블록이 해제된다. 따라서 **파일이 열려 있는 동안 rm으로 삭제해도 해당 프로세스는 계속 파일에 접근할 수 있다.**

```bash
# 열린 파일이 삭제됐는지 확인
lsof | grep deleted
```

---

**지난 글:** [read: 스크립트에서 사용자 입력 받기](/posts/linux-read-input/)

**다음 글:** [하드 링크 vs 심볼릭 링크: 연결의 두 가지 방식](/posts/linux-hard-vs-soft-link/)

<br>
읽어주셔서 감사합니다. 😊
