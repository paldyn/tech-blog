---
title: "alias: 나만의 명령어 단축키 만들기"
description: "Bash alias의 동작 원리와 생성·삭제·영구 저장 방법, 그리고 alias와 함수 선택 기준을 익힌다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["Linux", "alias", "bash", "단축키", "bashrc", "생산성"]
featured: false
draft: false
---

[지난 글](/posts/linux-history-bang/)에서 히스토리 확장으로 이전 명령을 재사용하는 방법을 배웠다. 이번에는 아예 **긴 명령어에 짧은 이름을 붙이는** `alias`를 다룬다. `ls -alF --color=auto`를 매번 입력하는 대신 `ll` 하나로 해결하는 것이 `alias`의 역할이다. 올바르게 관리하면 작업 속도를 높이고 오타를 줄일 수 있다.

## alias 기본 사용법

```bash
alias ll='ls -alF --color=auto'   # alias 생성
alias                              # 모든 alias 목록 출력
alias ll                           # 특정 alias 내용 확인
unalias ll                         # alias 삭제
```

`alias 이름='명령'` 형식에서 등호 양쪽에 공백을 넣으면 안 된다. 값 부분에 공백이 있을 때는 반드시 따옴표로 감싼다.

## alias 치환 시점

셸이 명령줄을 파싱할 때 **alias 치환은 가장 먼저 일어난다**. `ll`을 입력하면 셸은 alias 테이블을 조회해 `ls -alF --color=auto`로 치환한 뒤 실행한다. 이 과정 때문에 alias는 파이프라인 첫 번째 단어에만 동작하고 인자 위치에서는 치환되지 않는다.

```bash
alias ll='ls -alF --color=auto'
ll /tmp            # OK: ll이 명령 위치에 있음
sudo ll /tmp       # OK: sudo 다음 첫 단어도 치환 대상
ls -la | ll        # ❌: 파이프 뒤 ll은 치환 안 됨
```

![alias 동작 원리](/assets/posts/linux-alias-concept.svg)

## alias 우회 — 원본 명령 실행

`ls`에 alias가 걸려 있어도 때로는 원본 명령을 실행해야 할 때가 있다.

```bash
\ls          # 백슬래시로 alias 무력화
'ls'         # 따옴표로 감싸도 동일
command ls   # command 빌트인 사용
```

스크립트에서 외부 명령이 alias와 이름이 겹칠 때 `command ls`를 쓰면 안전하다.

## 영구 저장 — ~/.bashrc와 ~/.bash_aliases

`alias` 명령으로 만든 별칭은 **현재 셸 세션에만 존재**한다. 터미널을 닫으면 사라진다. 영구 적용하려면 설정 파일에 저장해야 한다.

Ubuntu/Debian은 기본적으로 `~/.bashrc` 안에 `~/.bash_aliases`를 불러오는 코드가 포함되어 있다. 없다면 직접 추가하면 된다.

```bash
# ~/.bashrc에 추가 (없을 경우)
if [ -f ~/.bash_aliases ]; then
    . ~/.bash_aliases
fi
```

이후 alias는 `~/.bash_aliases`에 모아 관리한다.

```bash
# ~/.bash_aliases
alias ll='ls -alF --color=auto'
alias la='ls -A'
alias l='ls -CF'
alias grep='grep --color=auto'
alias ..='cd ..'
alias ...='cd ../..'
alias update='sudo apt update && sudo apt upgrade -y'
alias gs='git status'
alias gp='git push'
alias gc='git commit'
```

변경 후 현재 세션에 즉시 적용하려면 `source` 명령을 쓴다.

```bash
source ~/.bash_aliases
# 또는
. ~/.bash_aliases
```

## 유용한 alias 패턴

```bash
# 실수 방지 — 확인 요청
alias rm='rm -i'
alias cp='cp -i'
alias mv='mv -i'

# 디렉터리 이동
alias ..='cd ..'
alias ...='cd ../..'
alias ~='cd ~'

# 자주 쓰는 명령 단축
alias h='history'
alias c='clear'
alias ports='netstat -tulanp'
alias myip='curl -s ifconfig.me'
```

![alias 관리 & 고급 패턴](/assets/posts/linux-alias-management.svg)

## alias vs 함수 — 선택 기준

`alias`는 **단순 치환**만 가능하다. 인자를 받거나, 조건 분기가 필요하거나, 여러 줄 로직이 필요하면 함수를 써야 한다.

| 상황 | 선택 |
|---|---|
| 긴 명령에 짧은 이름 부여 | `alias` |
| 인자를 특정 위치에 삽입 | 함수 |
| 조건 분기, 루프 | 함수 |
| 임시 디렉터리 생성 후 이동 | 함수 |

```bash
# alias로 구현 불가 — 인자가 중간에 들어감
# alias mkcd='mkdir -p ??? && cd ???'

# 함수로 구현
mkcd() {
    mkdir -p "$1" && cd "$1"
}
```

함수도 `~/.bashrc` 또는 별도 `~/.bash_functions` 파일에 저장하면 영구적으로 사용할 수 있다.

---

**지난 글:** [history & !bang: 셸 히스토리 완전 활용](/posts/linux-history-bang/)

**다음 글:** [echo & printf: 표준 출력 제어하기](/posts/linux-echo-printf/)

<br>
읽어주셔서 감사합니다. 😊
