---
title: "mkdir & rmdir: 디렉터리 생성과 삭제"
description: "mkdir -p로 중첩 디렉터리를 한 번에 만들고, rmdir과 rm -r의 차이를 이해하며 안전하게 디렉터리를 관리한다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["Linux", "mkdir", "rmdir", "디렉터리", "파일시스템"]
featured: false
draft: false
---

[지난 글](/posts/linux-cp-mv-rm/)에서 파일을 복사·이동·삭제하는 방법을 배웠다. 이번 글에서는 **디렉터리를 만들고 지우는 `mkdir`과 `rmdir`**을 다룬다. 단순해 보이지만 `-p` 옵션과 브레이스 확장을 함께 쓰면 복잡한 디렉터리 구조를 한 줄로 만들 수 있다.

## mkdir — 디렉터리 생성

`mkdir`(make directory)는 새 디렉터리를 만든다.

```bash
mkdir newdir                     # 단일 디렉터리 생성
mkdir dir1 dir2 dir3             # 여러 디렉터리 한 번에 생성
mkdir -v newdir                  # 생성 과정 출력
mkdir -m 700 private             # 권한을 700 으로 지정하며 생성
```

중간 경로가 없는 상태에서 `mkdir a/b/c`를 시도하면 `a/b` 경로가 존재하지 않는다는 오류가 난다. 이때 `-p` 옵션을 사용한다.

## mkdir -p: 중간 경로 자동 생성

`-p`(parents) 옵션은 경로에 존재하지 않는 중간 디렉터리를 모두 함께 만든다. 경로가 이미 존재해도 오류 없이 조용히 넘어간다.

```bash
mkdir -p a/b/c/d                 # 경로 전체를 한 번에 생성
mkdir -p /var/log/myapp          # 절대 경로도 가능
mkdir -p ~/projects/myapp        # 홈 디렉터리 아래 중첩 생성

# 이미 존재하는 경우에도 오류 없음 (멱등)
mkdir -p /tmp                    # /tmp 이미 있어도 오류 없음
```

![mkdir -p 중첩 디렉터리 생성 다이어그램](/assets/posts/linux-mkdir-rmdir-tree.svg)

## 브레이스 확장으로 여러 경로 한 번에

셸의 브레이스 확장(`{...}`)과 `mkdir -p`를 결합하면 프로젝트 뼈대를 한 줄로 만들 수 있다.

```bash
# 프로젝트 디렉터리 구조 한 번에 생성
mkdir -p project/{src,test,docs,build}
# 결과: project/src, project/test, project/docs, project/build

# 중첩 브레이스 확장
mkdir -p project/{src/{main,util},test/{unit,integration},docs}
# 결과: project/src/main, project/src/util,
#       project/test/unit, project/test/integration, project/docs

# 날짜별 백업 디렉터리
mkdir -p backup/{2025,2026}/{01,02,03,04,05,06,07,08,09,10,11,12}
```

브레이스 확장은 셸이 처리하는 기능이므로 `mkdir` 뿐만 아니라 모든 명령에서 사용할 수 있다.

## rmdir — 빈 디렉터리 삭제

`rmdir`(remove directory)는 **빈 디렉터리만** 삭제한다. 안에 파일이 하나라도 있으면 오류가 발생한다.

```bash
rmdir emptydir                   # 빈 디렉터리 삭제
rmdir dir1 dir2 dir3             # 여러 빈 디렉터리 삭제
rmdir -p a/b/c                   # c → b → a 순서로 거슬러 올라가며 삭제
rmdir -v dir                     # 삭제 과정 출력
```

`rmdir -p`는 지정한 경로를 끝에서부터 차례로 삭제한다. 중간에 비어 있지 않은 디렉터리가 있으면 그 지점에서 멈춘다.

`rmdir`의 강점은 **의도치 않은 삭제를 방지하는 안전장치**라는 점이다. 자동화 스크립트에서 비어 있어야 할 임시 디렉터리를 정리할 때 `rm -r` 대신 `rmdir`을 쓰면 예상치 못한 데이터가 남아 있을 때 명령이 실패해 문제를 알 수 있다.

## rm -r vs rmdir

내용물이 있는 디렉터리를 지우려면 `rm -r`이나 `rm -rf`를 사용한다.

```bash
# 내용 확인 후 대화형 삭제
ls -la target-dir/
rm -ri target-dir/               # 각 파일마다 확인

# 조건부 삭제 패턴
[ -d "./tmp" ] && rm -rf "./tmp"

# 삭제 전 내용 확인 후 실행
du -sh target-dir/ && rm -rf target-dir/
```

`rm -rf`는 확인 없이 재귀 삭제하므로 **경로를 변수로 받는 경우 반드시 변수 내용을 검증**한다.

```bash
# 위험한 패턴
rm -rf $TMPDIR     # TMPDIR 이 비어있으면 rm -rf '' 가 됨

# 안전한 패턴
if [ -n "$TMPDIR" ] && [ -d "$TMPDIR" ]; then
    rm -rf "$TMPDIR"
fi
```

![mkdir · rmdir 핵심 명령 모음](/assets/posts/linux-mkdir-rmdir-commands.svg)

## 디렉터리 구조 복제

기존 디렉터리 구조만 복사하고 파일은 제외하고 싶을 때는 `find`와 `mkdir`을 조합한다.

```bash
# 디렉터리 구조만 복제 (파일 제외)
find src/ -type d | sed 's|^src/|dst/|' | xargs mkdir -p
```

`rsync --dirs` 또는 `cp -a`는 파일까지 복사하지만, 위 방법은 디렉터리 트리만 미리 만들어 두고 싶을 때 유용하다.

---

**지난 글:** [cp·mv·rm: 파일 복사·이동·삭제 완전 정복](/posts/linux-cp-mv-rm/)

**다음 글:** [touch & stat: 파일 생성과 메타데이터 조회](/posts/linux-touch-stat/)

<br>
읽어주셔서 감사합니다. 😊
