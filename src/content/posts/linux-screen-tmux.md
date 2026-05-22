---
title: "screen & tmux — 터미널 멀티플렉서 완전 정리"
description: "SSH 세션이 끊겨도 프로세스를 유지하는 screen과 tmux의 세션·윈도우·팬 구조, 주요 단축키, tmuxinator 자동화를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 5
type: "knowledge"
category: "Linux"
tags: ["linux", "tmux", "screen", "terminal-multiplexer", "session", "pane", "detach", "remote-work"]
featured: false
draft: false
---

[지난 글](/posts/linux-scp-vs-rsync/)에서 SCP와 rsync를 비교했습니다. 원격 서버에서 작업할 때 SSH 연결이 끊기면 실행 중이던 프로세스가 종료됩니다. **터미널 멀티플렉서**는 이 문제를 해결합니다. 세션을 서버에 유지하면서 연결을 끊었다 다시 붙일 수 있고, 한 터미널을 여러 창으로 분할할 수도 있습니다. `screen`과 `tmux` 두 가지가 대표적입니다.

## 왜 필요한가

SSH로 서버에 접속해 빌드나 마이그레이션을 실행하는 도중 인터넷이 끊기면 프로세스도 함께 사라집니다. `nohup`으로 막을 수도 있지만 멀티플렉서는 더 강력합니다. **세션을 서버 프로세스로 유지**하기 때문에 detach(분리) 후 언제든 다시 attach(재접속)할 수 있습니다.

## tmux 기본 사용법

```bash
# 새 세션 시작
tmux new-session -s dev -n editor

# 세션 목록 확인
tmux ls

# 세션 재접속
tmux attach -t dev
# 또는 줄여서
tmux a -t dev

# 세션 종료
tmux kill-session -t dev
```

### tmux 계층 구조

tmux는 **세션 → 윈도우 → 팬** 계층으로 구성됩니다.

- **세션(Session)**: 독립적인 작업 컨텍스트. `dev`, `deploy` 같은 이름 할당
- **윈도우(Window)**: 세션 내 탭. `editor`, `server`, `logs` 등으로 나눔
- **팬(Pane)**: 윈도우 내 분할 화면. 에디터와 터미널을 나란히

![tmux 세션·윈도우·팬 구조](/assets/posts/linux-screen-tmux-architecture.svg)

### prefix 키

tmux의 모든 단축키는 **prefix** 다음에 명령 키를 누릅니다. 기본 prefix는 `Ctrl+b`입니다.

```
Ctrl+b  c     새 윈도우 생성
Ctrl+b  n/p   다음/이전 윈도우 이동
Ctrl+b  0~9   번호로 윈도우 이동
Ctrl+b  %     팬 수직 분할
Ctrl+b  "     팬 수평 분할
Ctrl+b  화살표  팬 간 이동
Ctrl+b  z     팬 전체화면 토글
Ctrl+b  d     세션 detach
Ctrl+b  [     스크롤 모드 (q로 종료)
```

## screen 기본 사용법

`screen`은 더 오래된 도구로 대부분의 서버에 기본 설치되어 있습니다. 팬 분할은 지원하지 않지만 세션 관리는 tmux와 동일한 개념입니다.

```bash
# 새 세션 시작
screen -S dev

# 세션 목록
screen -ls

# 특정 세션 재접속
screen -r dev

# 중단된 세션 강제 재접속 (이미 attached 상태)
screen -dr dev
```

## screen vs tmux 단축키 비교

![tmux vs screen 주요 단축키](/assets/posts/linux-screen-tmux-keybindings.svg)

## .tmux.conf 커스터마이징

```
# ~/.tmux.conf

# prefix를 Ctrl+a로 변경 (screen 사용자 편의)
set -g prefix C-a
unbind C-b
bind C-a send-prefix

# 마우스 지원 (클릭으로 팬 선택, 스크롤)
set -g mouse on

# 256 색상
set -g default-terminal "tmux-256color"

# 팬 번호 표시 시간 (ms)
set -g display-panes-time 2000

# 상태바 색상
set -g status-bg colour235
set -g status-fg colour136
```

## tmuxinator — 세션 자동화

복잡한 개발 환경을 매번 수동으로 설정하는 대신 tmuxinator로 레이아웃을 파일로 정의합니다.

```bash
gem install tmuxinator
tmuxinator new myproject
```

```yaml
# ~/.config/tmuxinator/myproject.yml
name: myproject
root: ~/projects/myapp

windows:
  - editor:
      layout: main-vertical
      panes:
        - vim .
        - git status
  - server:
      panes:
        - npm run dev
  - logs:
      panes:
        - tail -f logs/app.log
```

```bash
# 프로젝트 환경 한 번에 시작
tmuxinator start myproject
```

## 실무 활용 패턴

**장시간 작업 보호**: 데이터베이스 마이그레이션, 대규모 빌드, 배치 처리 등 시간이 오래 걸리는 작업은 항상 tmux 세션 안에서 실행합니다.

```bash
# 작업 시작
tmux new -s migration
python manage.py migrate

# 연결 끊기 (Ctrl+b d)
# ...나중에...
tmux attach -t migration
```

**멀티 서버 모니터링**: `synchronize-panes` 기능으로 모든 팬에 동시에 명령을 입력할 수 있습니다.

```bash
# 여러 서버 팬을 동기화해서 한 번에 명령 실행
tmux set-window-option synchronize-panes on
```

---

**지난 글:** [SCP vs rsync — 실무에서 무엇을 선택해야 하나](/posts/linux-scp-vs-rsync/)

**다음 글:** [mosh — 불안정한 네트워크에서의 SSH 대안](/posts/linux-mosh/)

<br>
읽어주셔서 감사합니다. 😊
