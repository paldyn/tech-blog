---
title: "cp·mv·rm: 파일 복사·이동·삭제 완전 정복"
description: "cp, mv, rm 명령어의 옵션과 사용 패턴을 익히고, 실수 없이 안전하게 파일을 다루는 방법을 배운다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["Linux", "cp", "mv", "rm", "파일관리", "파일시스템"]
featured: false
draft: false
---

[지난 글](/posts/linux-less-more/)에서 파일을 읽는 방법을 배웠다. 이번 글에서는 **파일을 복사·이동·삭제하는 가장 기본적인 세 명령어**인 `cp`, `mv`, `rm`을 다룬다. 간단해 보이지만 옵션을 잘못 사용하면 데이터를 영구히 잃을 수 있어 정확히 알아두는 것이 중요하다.

## cp — 파일 복사

`cp`는 파일이나 디렉터리를 **원본을 유지한 채 복사**한다.

```bash
cp src.txt dst.txt               # 파일 복사
cp src.txt /tmp/                 # 디렉터리로 복사 (파일명 유지)
cp file1 file2 file3 /dest/      # 여러 파일을 디렉터리로 복사
cp -r srcdir/ dstdir/            # 디렉터리 재귀 복사
cp -a srcdir/ dstdir/            # 권한·소유자·시간·링크 모두 보존
cp -p src.txt dst.txt            # 권한·시간 유지
cp -i src.txt dst.txt            # 덮어쓰기 전 확인 요청
cp -u src.txt dst.txt            # src가 dst보다 새 경우만 복사
cp --backup=numbered src dst     # 기존 dst를 dst.~1~ 로 백업 후 복사
```

`-a`(archive) 옵션은 `-dRp`의 단축어다. 백업이나 시스템 이전 시 파일 속성을 그대로 보존해야 할 때 사용한다.

## mv — 이동 및 이름 변경

`mv`는 파일이나 디렉터리를 **다른 위치로 옮기거나 이름을 변경**한다. 같은 파일시스템 안에서 이동할 때는 데이터를 실제로 복사하지 않고 디렉터리 항목만 수정하므로 파일 크기와 무관하게 즉시 완료된다.

```bash
mv old.txt new.txt               # 이름 변경
mv file.txt /tmp/                # 다른 디렉터리로 이동
mv file.txt /tmp/newname.txt     # 이동 + 이름 변경 동시에
mv dir1/ /data/dir2/             # 디렉터리 이동
mv -i src dst                    # 덮어쓰기 전 확인
mv -n src dst                    # 기존 dst가 있으면 이동 중단
mv -v *.txt /archive/            # 이동 내역 출력
```

`mv -n`과 `mv -i`는 중요한 파일이 실수로 덮어씌워지는 것을 방지한다.

![cp·mv·rm 동작 원리 다이어그램](/assets/posts/linux-cp-mv-rm-operations.svg)

## rm — 파일 삭제

`rm`은 파일이나 디렉터리를 삭제한다. **Linux의 기본 `rm`은 휴지통 없이 바로 삭제**하므로 복구가 어렵다. 특히 `-rf` 옵션은 신중하게 사용해야 한다.

```bash
rm file.txt                      # 파일 삭제
rm -i file.txt                   # 삭제 전 확인
rm -r directory/                 # 디렉터리 재귀 삭제
rm -rf directory/                # 강제 재귀 삭제 (확인 없음) ⚠
rm *.log                         # 글로브 패턴으로 여러 파일 삭제
rm -v file1 file2                # 삭제 내역 출력
```

`rm -rf /` 또는 `rm -rf /*` 같은 명령은 절대 실행해서는 안 된다. 최신 GNU `rm`은 이를 차단하지만 모든 환경에서 보장되지 않는다.

## 글로브 사용 시 주의사항

`rm *.txt`처럼 글로브를 사용할 때는 먼저 `ls *.txt`로 대상을 확인한 다음 삭제하는 습관이 좋다. `rm`을 실행하기 전에 `ls`로 같은 패턴이 어떤 파일들을 잡는지 눈으로 확인한다.

```bash
# 삭제 전 대상 확인 패턴
ls *.log         # 1단계: 무엇이 잡히는지 확인
rm *.log         # 2단계: 확인 후 삭제
```

## 안전을 위한 alias 설정

대화형 셸에서 실수를 줄이기 위해 `~/.bashrc`에 `-i` 옵션을 기본으로 붙이는 alias를 등록하는 것이 좋다.

```bash
# ~/.bashrc 에 추가
alias cp='cp -i'
alias mv='mv -i'
alias rm='rm -i'
```

다만 스크립트 내에서 이 alias는 동작하지 않는다(스크립트는 alias 확장을 하지 않는다). 스크립트에서는 `-i`를 명시적으로 쓰거나 삭제 전 조건 검사를 추가한다.

![안전한 파일 조작 패턴](/assets/posts/linux-cp-mv-rm-safety.svg)

## 디렉터리 통째로 복사 vs rsync

대용량 디렉터리를 백업하거나 동기화할 때는 `cp -a` 보다 `rsync`가 더 강력하다. `rsync`는 이미 복사된 파일을 건너뛰고 변경된 파일만 전송한다.

```bash
# cp -a 로 전체 복사
cp -a /src/dir/ /dst/dir/

# rsync 로 증분 동기화
rsync -av /src/dir/ /dst/dir/

# 삭제된 파일도 동기화
rsync -av --delete /src/dir/ /dst/dir/
```

`rsync`는 SSH를 통한 원격 복사도 지원하므로 서버 백업 자동화에 자주 사용된다.

## 이름 일괄 변경

`mv`로 여러 파일을 한 번에 이름 변경하려면 `rename` 명령이 유용하다.

```bash
# Perl rename (많은 배포판에 기본 포함)
rename 's/.txt/.bak/' *.txt      # *.txt를 *.bak 으로 일괄 변경
rename 's/old/new/' *.conf       # 파일명 내 old를 new로 치환

# mmv 도구 (더 직관적인 패턴)
mmv '*.txt' '#1.bak'
```

---

**지난 글:** [less & more: 대용량 파일을 페이지 단위로 읽기](/posts/linux-less-more/)

**다음 글:** [mkdir & rmdir: 디렉터리 생성과 삭제](/posts/linux-mkdir-rmdir/)

<br>
읽어주셔서 감사합니다. 😊
