---
title: "셸과 터미널의 차이: 무엇이 명령어를 실행하는가"
description: "터미널 에뮬레이터와 셸은 다른 프로그램이다. 각각의 역할과 관계, 명령어 실행 흐름을 명확히 이해한다."
author: "PALDYN Team"
pubDate: "2026-05-08"
archiveOrder: 6
type: "knowledge"
category: "Linux"
tags: ["Linux", "셸", "터미널", "bash", "TTY"]
featured: false
draft: false
---

[지난 글](/posts/linux-philosophy-everything-is-file/)에서 파일 철학을 살펴봤다. 이번 글은 Linux를 처음 접할 때 가장 흔히 혼동하는 개념을 정리한다. **"터미널"과 "셸"은 같은 것이 아니다.** 두 단어를 구분하지 못하면 "bash를 써라"와 "터미널을 열어라"가 섞여서 혼란스러워진다.

## 터미널이란 무엇인가

원래 "터미널"은 하드웨어였다. 1970~80년대 컴퓨터는 VT100 같은 물리적 단말기(terminal)에 키보드와 화면이 달려 있었고, 이를 중앙 서버에 연결해서 사용했다. 지금은 이런 물리 단말기 대신 **터미널 에뮬레이터(terminal emulator)**가 그 역할을 소프트웨어로 대신한다.

터미널 에뮬레이터는 **GUI 애플리케이션**이다. 키보드 입력을 받아 화면에 글자를 표시하고, 색상·폰트·스크롤을 처리한다. 대표적인 터미널 에뮬레이터는 다음과 같다.

| OS | 터미널 에뮬레이터 |
|---|---|
| Ubuntu (GNOME) | GNOME Terminal, Tilix |
| macOS | Terminal.app, iTerm2 |
| Windows | Windows Terminal, ConEmu |
| 범용 | Alacritty, Kitty, WezTerm |

## 셸이란 무엇인가

**셸(Shell)**은 커맨드 인터프리터다. 사용자가 입력한 명령어 텍스트를 받아, 파싱하고, 실제 프로그램을 실행한다. 셸은 터미널 에뮬레이터 안에서 실행되는 **사용자 공간 프로세스**다.

`ls -la`를 입력하면 터미널 에뮬레이터가 키 입력을 캡처해 셸에 전달한다. 셸은 `ls`가 내장 명령인지 외부 실행 파일인지 확인하고, 외부 파일이면 `fork()`로 자식 프로세스를 만들어 `exec()`로 실행한다.

![터미널·셸·커널 관계](/assets/posts/linux-shell-vs-terminal-architecture.svg)

## 명령어 실행 흐름

![셸이 명령어를 실행하는 과정](/assets/posts/linux-shell-vs-terminal-execution.svg)

```bash
# 현재 사용 중인 셸 확인
echo $SHELL
# /bin/bash

# 또는
ps -p $$
#   PID TTY          TIME CMD
#  1234 pts/0    00:00:00 bash

# 사용 가능한 셸 목록
cat /etc/shells
# /bin/sh
# /bin/bash
# /bin/zsh
# /usr/bin/fish
```

## TTY와 PTY

셸이 실행되는 환경에는 **TTY(TeleTYpewriter)**라는 개념이 있다. 물리 콘솔(`/dev/tty1` ~ `/dev/tty6`)과 가상 터미널(**PTY**, pseudo-terminal)로 나뉜다. 터미널 에뮬레이터를 열면 `/dev/pts/0` 같은 PTY 장치가 생성된다.

```bash
# 현재 TTY 확인
tty
# /dev/pts/0

# 열려 있는 모든 터미널 세션 보기
who
# user     pts/0    2026-05-08 09:00 (:0)
# user     pts/1    2026-05-08 09:05 (:0)
```

여러 터미널 창을 열면 각각 다른 PTY를 사용한다. 이 PTY도 "모든 것은 파일" 철학에 따라 `/dev/pts/` 아래 파일로 존재한다. 심지어 다른 터미널에 직접 메시지를 출력할 수도 있다.

```bash
# pts/1 터미널에 메시지 전송
echo "hello there" > /dev/pts/1
```

## 셸은 여러 종류가 있다

터미널 에뮬레이터는 화면 표시만 담당하므로 어떤 셸과도 조합할 수 있다. 반면 셸은 종류마다 문법과 기능이 다르다.

- **bash**: 대부분 Linux의 기본 셸. POSIX 호환. 스크립팅에 널리 사용.
- **zsh**: bash 호환이면서 플러그인 생태계(Oh My Zsh)가 풍부. macOS 기본.
- **fish**: 자동완성·문법 강조가 뛰어난 현대적 셸. bash 비호환.
- **sh/dash**: POSIX sh 최소 구현. 빠르고 가벼워 시스템 스크립트에 사용.

다음 글에서 이 셸들을 자세히 비교한다.

## 정리: 두 개의 프로그램

헷갈릴 때마다 이렇게 기억하자. **터미널은 창(window)**, **셸은 해석기(interpreter)**. "터미널을 열어라" = GUI 창을 띄워라. "bash를 쓴다" = 그 창 안에서 실행되는 셸 프로그램이 bash다. 터미널이 없어도 셸은 동작할 수 있다(SSH 세션, 스크립트 실행). 셸이 없는 터미널은 키 입력을 전달할 곳이 없다.

---

**지난 글:** [Linux 철학: 모든 것은 파일이다](/posts/linux-philosophy-everything-is-file/)

**다음 글:** [Bash vs Zsh vs Fish: 어떤 셸을 써야 할까](/posts/linux-bash-vs-zsh-fish/)

<br>
읽어주셔서 감사합니다. 😊
