---
title: "history & !bang: 셸 히스토리 완전 활용"
description: "Bash history 명령어와 ! 히스토리 확장 문법을 마스터해 이전 명령을 빠르게 재사용하고, 히스토리 설정을 최적화한다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 3
type: "knowledge"
category: "Linux"
tags: ["Linux", "history", "bash", "히스토리확장", "bang", "Ctrl+R"]
featured: false
draft: false
---

[지난 글](/posts/linux-man-info-help/)에서 리눅스 매뉴얼 시스템을 살펴봤다. 이번에는 터미널 생산성을 크게 높이는 **셸 히스토리 시스템**을 파헤친다. 같은 명령을 반복 입력하거나 긴 명령어를 위아래 화살표로 찾는 것은 효율이 낮다. `!bang` 확장과 `Ctrl+R` 검색, 히스토리 설정을 제대로 익히면 명령어 입력 속도가 눈에 띄게 빨라진다.

## history — 히스토리 조회와 관리

`history` 명령은 현재 세션과 이전 세션에서 실행한 명령 목록을 번호와 함께 출력한다. 히스토리는 메모리와 `~/.bash_history` 파일 두 곳에 저장된다.

```bash
history          # 전체 히스토리 출력
history 20       # 최근 20개만
history | grep docker   # docker 관련 명령만
history -c       # 현재 세션 메모리 히스토리 삭제
history -d 42    # 42번 항목 삭제
history -w       # 메모리 내용을 ~/.bash_history에 저장
```

## ! — 히스토리 확장의 핵심

`!`(bang)은 Bash 히스토리 확장의 시작 문자다. 명령 앞에 붙이면 이전 명령을 참조하거나 인자를 추출할 수 있다.

### 이벤트 지시자

| 패턴 | 의미 |
|---|---|
| `!!` | 마지막 명령 전체 |
| `!git` | `git`으로 시작한 가장 최근 명령 |
| `!?nginx` | `nginx`를 포함한 가장 최근 명령 |
| `!42` | 히스토리 번호 42번 명령 |
| `!-2` | 2번 전 명령 |

가장 많이 쓰이는 패턴은 `sudo !!`다. 권한이 부족해서 실패한 명령을 `sudo`로 재실행한다.

```bash
apt update
# Permission denied
sudo !!
# → sudo apt update
```

### 단어 지시자 — 인자 추출

`!`로 이전 명령을 참조한 뒤 `:n`을 붙이면 특정 단어만 가져올 수 있다.

```bash
cp /very/long/source/path.txt /destination/
ls -la !$          # 마지막 인자만 → ls -la /destination/
cat !!:1           # 첫 번째 인자 → cat /very/long/source/path.txt
mv !!:1-2 /backup/ # 1~2번 인자 범위
```

`!$`(마지막 인자)와 `!*`(모든 인자)는 가장 자주 쓰이는 단어 지시자다.

### 치환 지시자 ^old^new

직전 명령에서 오타를 수정할 때 쓰는 빠른 방법이다.

```bash
git statsu
^statsu^status
# → git status
```

`^old^new`는 첫 번째 매치만 치환한다. 모든 매치를 치환하려면 `!!:gs/old/new`를 쓴다.

![! Bang 히스토리 확장](/assets/posts/linux-history-bang-expansion.svg)

## Ctrl+R — 역방향 증분 검색

히스토리에서 특정 명령을 찾을 때 가장 빠른 방법은 `Ctrl+R`이다. 인터랙티브 검색 창이 열리고 입력할수록 매칭 범위가 좁아진다.

```
Ctrl+R          # 검색 시작
  (reverse-i-search)`doc': docker run -it ubuntu
Ctrl+R          # 다음 이전 결과
Enter           # 선택 실행
Ctrl+G          # 취소
```

`fzf`(fuzzy finder)를 설치하면 `Ctrl+R`이 퍼지 검색 UI로 업그레이드된다. 히스토리 검색 경험이 획기적으로 개선된다.

## 히스토리 설정 최적화

기본 히스토리 크기와 동작은 `~/.bashrc`에서 조정한다.

![history 명령어 & 설정](/assets/posts/linux-history-bang-config.svg)

핵심 설정 세 가지를 정리하면 다음과 같다.

```bash
# ~/.bashrc에 추가
HISTSIZE=10000           # 메모리에 유지할 항목 수
HISTFILESIZE=20000       # 파일에 저장할 항목 수
HISTCONTROL=ignoreboth   # 공백 시작 + 중복 제외
HISTTIMEFORMAT="%F %T "  # 타임스탬프 기록
shopt -s histappend      # 세션 종료 시 덮어쓰지 않고 추가
shopt -s histverify      # !확장 전 내용을 편집라인에 먼저 표시
```

`histverify`를 설정하면 `!!`를 입력했을 때 즉시 실행되지 않고 명령줄에 내용을 표시한다. 의도치 않은 명령 실행을 방지하는 데 유용하다.

## HISTCONTROL — 민감한 명령 숨기기

비밀번호나 토큰을 직접 입력한 명령이 히스토리에 남는 것을 막으려면 명령 앞에 **공백 한 칸**을 추가한다.

```bash
 export API_KEY="secret123"   # 앞에 공백: 히스토리 미기록
 mysql -u root -psecret       # 패스워드 포함 명령 숨기기
```

`HISTCONTROL=ignorespace`(또는 `ignoreboth`)가 설정되어 있어야 공백 앞 명령이 히스토리에서 제외된다.

---

**지난 글:** [man · info · help: 리눅스 매뉴얼 완전 활용](/posts/linux-man-info-help/)

**다음 글:** [alias: 나만의 명령어 단축키 만들기](/posts/linux-alias/)

<br>
읽어주셔서 감사합니다. 😊
