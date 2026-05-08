---
title: "숨김 파일 완전 이해: 점(.)으로 시작하는 파일의 비밀"
description: "Linux에서 점으로 시작하는 숨김 파일의 원리, 탐색 방법, 주요 설정 파일 위치와 관리 패턴을 완전히 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 1
type: "knowledge"
category: "Linux"
tags: ["Linux", "숨김 파일", "dotfiles", "ls", "설정 파일"]
featured: false
draft: false
---

[지난 글](/posts/linux-file-vs-directory/)에서 파일과 디렉터리의 내부 구조를 살펴봤다. 이번 글에서는 Linux를 쓰다 보면 반드시 마주치는 **숨김 파일(hidden files)**을 다룬다. `ls` 명령으로 보이지 않던 `.bashrc`, `.ssh/`, `.gitconfig` 같은 파일들이 어떤 원리로 숨겨지는지, 어떻게 보고 다루는지 정리한다.

## 숨김 파일이란

Linux에서 숨김 파일은 **파일 이름이 점(`.`)으로 시작하는 파일이나 디렉터리**다. 운영체제 커널이 특별한 속성으로 파일을 숨기는 것이 아니라, `ls` 같은 유틸리티가 관례적으로 점으로 시작하는 항목을 출력에서 생략하는 것이다.

이 관례는 Unix 초기부터 이어졌다. `.`(현재 디렉터리)과 `..`(상위 디렉터리)를 기본 목록에서 빼기 위한 단순한 처리가 기점이었고, 이후 설정 파일들도 같은 접두사를 사용해 사용자의 홈 디렉터리를 깔끔하게 보이게 하는 관습이 됐다.

## 숨김 파일 보기

기본 `ls` 명령은 점 파일을 출력하지 않는다. `-a` 또는 `-A` 플래그를 사용해야 보인다.

```bash
ls           # 숨김 파일 제외한 일반 파일·디렉터리만
ls -a        # . .. 포함 모든 항목 출력
ls -A        # . .. 는 제외하고 나머지 숨김 파일 출력
ls -la       # 긴 형식 + 모든 숨김 파일
ls -lA       # 긴 형식 + . .. 제외 숨김 파일
ls -lah      # 긴 형식 + 숨김 + 사람이 읽기 좋은 크기 단위
```

`-a`와 `-A`의 차이는 `.`(현재 디렉터리)과 `..`(상위 디렉터리) 포함 여부다. 실제로 그 두 항목은 항상 존재하므로 스크립트에서 목록을 처리할 때는 `-A`가 더 안전하다.

![숨김 파일 원리: ls vs ls -a 비교](/assets/posts/linux-hidden-files-concept.svg)

## 숨김 파일만 골라내기

숨김 파일만 선별적으로 보고 싶을 때는 `find` 명령이나 셸 글로브를 사용한다.

```bash
# find로 홈 디렉터리의 숨김 파일만
find ~ -maxdepth 1 -name '.*' -not -name '.'

# 글로브 확장 (shopt -s dotglob 없이도 동작)
ls -d ~/.* 2>/dev/null

# grep으로 숨김 항목만 필터
ls -A ~ | grep '^[.]'
```

`find`에서 `-maxdepth 1`을 빠뜨리면 하위 디렉터리까지 재귀 탐색하므로 주의한다.

## 주요 홈 디렉터리 숨김 파일

서버나 데스크톱 환경을 막론하고 홈 디렉터리에서 자주 만나는 숨김 파일들이다.

| 파일/디렉터리 | 역할 |
|---|---|
| `~/.bashrc` | bash 대화형 셸 초기화 스크립트 |
| `~/.bash_profile` | bash 로그인 셸 초기화 스크립트 |
| `~/.ssh/` | SSH 키, `known_hosts`, `config` 보관 |
| `~/.gitconfig` | git 사용자 이름·이메일·별명 설정 |
| `~/.vimrc` | vim 편집기 설정 |
| `~/.config/` | XDG Base Directory 규격의 앱 설정 |
| `~/.local/share/` | 앱별 데이터 (XDG) |
| `~/.cache/` | 재생성 가능한 캐시 데이터 |

![숨김 파일 관리 명령 모음](/assets/posts/linux-hidden-files-management.svg)

## dotfiles 관리 전략

개발자들이 `.bashrc`, `.vimrc`, `.gitconfig` 같은 설정 파일들을 묶어 **dotfiles**라 부른다. 이 파일들은 사용자 환경 설정 전체를 담기 때문에 Git으로 버전 관리하는 것이 보편적이다.

```bash
# dotfiles 저장소 초기화 예시
git init ~/dotfiles
cp ~/.bashrc ~/dotfiles/bashrc
ln -s ~/dotfiles/bashrc ~/.bashrc   # 심볼릭 링크로 연결
```

심볼릭 링크를 활용하면 저장소의 파일이 실제 설정 파일로 동작하면서 Git으로 이력을 관리할 수 있다. 여러 머신에 동일 환경을 구성할 때 유용하다.

## 숨김 파일 생성과 제거

점 접두사를 붙이기만 하면 숨김 파일이 된다. 별도 명령이 필요 없다.

```bash
touch .my-secret-notes        # 숨김 파일 생성
mkdir .private-dir            # 숨김 디렉터리 생성
mv visible.txt .visible.txt   # 기존 파일을 숨김으로 전환
mv .hidden.txt unhidden.txt   # 숨김 해제
rm .old-config                # 숨김 파일 삭제
rm -rf .old-dir               # 숨김 디렉터리 삭제
```

`rm` 글로브 사용 시 주의할 점이 있다. `rm -rf .*`는 `..`(상위 디렉터리)도 패턴에 매칭되어 의도치 않은 피해가 발생할 수 있다. `rm -rf ~/.old-*` 처럼 구체적인 패턴을 쓰거나 개별 경로를 명시한다.

## 셸 글로브와 숨김 파일

bash 기본 설정에서 `*` 글로브는 숨김 파일을 포함하지 않는다. `shopt -s dotglob` 옵션을 켜면 `*`가 점 파일도 매칭한다.

```bash
# 기본: * 는 점 파일 제외
echo *             # 일반 파일만 출력

# dotglob 활성화 후
shopt -s dotglob
echo *             # 점 파일도 포함

# cp, rsync 등에서 숨김 파일까지 복사하려면
shopt -s dotglob
cp -r ~/dotfiles/* ~/new-home/
shopt -u dotglob   # 사용 후 복원
```

스크립트에서 일시적으로 dotglob을 쓸 때는 작업 후 반드시 `shopt -u dotglob`으로 원래 상태로 돌린다.

---

**지난 글:** [파일과 디렉터리의 차이: Linux가 구분하는 방법](/posts/linux-file-vs-directory/)

**다음 글:** [절대 경로 vs 상대 경로: Linux 파일 주소 완벽 이해](/posts/linux-paths-absolute-relative/)

<br>
읽어주셔서 감사합니다. 😊
