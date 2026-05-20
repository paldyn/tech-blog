---
title: "trap으로 시그널 처리와 정리"
description: "Bash trap 내장 명령으로 EXIT, ERR, SIGINT, SIGTERM 등의 시그널을 잡아 임시 파일 정리, 오류 추적, 잠금 해제를 구현하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 2
type: "knowledge"
category: "Linux"
tags: ["bash", "trap", "signal", "cleanup", "EXIT", "ERR", "shell", "scripting"]
featured: false
draft: false
---

[지난 글](/posts/bash-parameter-expansion/)에서 파라미터 확장으로 변수를 안전하게 다루는 법을 살펴봤습니다. 스크립트를 더 견고하게 만드는 다음 단계는 **예기치 않은 종료가 발생해도 정리 작업이 반드시 실행**되도록 보장하는 것입니다. `trap`이 그 역할을 합니다.

## trap 기본 문법

```bash
trap '명령어' 시그널...
trap 함수명  시그널...
trap ''      시그널...   # 시그널 무시
trap -       시그널...   # 기본 동작 복원
```

주요 시그널과 이벤트는 다음과 같습니다.

| 이름 | 번호 | 발생 시점 |
|------|------|-----------|
| EXIT | — | 스크립트가 어떤 방식으로든 종료될 때 |
| ERR | — | 명령 반환값이 0이 아닐 때 (`set -e` 환경) |
| INT | 2 | Ctrl+C |
| TERM | 15 | `kill PID` 기본 시그널 |
| HUP | 1 | 터미널 세션 종료 |
| DEBUG | — | 각 명령 실행 전 |

SIGKILL(9)과 SIGSTOP(19)은 커널이 직접 처리하므로 trap으로 잡을 수 없습니다.

![trap 시그널 처리 흐름](/assets/posts/bash-trap-signals.svg)

## EXIT trap: 임시 파일 자동 정리

가장 자주 쓰이는 패턴입니다. `EXIT`에 cleanup 함수를 연결하면 정상 종료, 오류 종료, Ctrl+C 등 **모든 종료 경로에서 정리 코드가 실행**됩니다.

```bash
#!/usr/bin/env bash

TMPDIR=""

cleanup() {
  [[ -d "$TMPDIR" ]] && rm -rf "$TMPDIR"
  echo "정리 완료" >&2
}

trap cleanup EXIT

# 이후 언제 종료되어도 cleanup이 실행됨
TMPDIR=$(mktemp -d)
cp /etc/hosts "$TMPDIR/"
process_files "$TMPDIR"
```

`trap cleanup EXIT`는 스크립트 상단 — TMPDIR 생성 전에 — 등록해야 합니다. 나중에 등록하면 TMPDIR이 생성된 후 스크립트가 죽을 때 핸들러가 없는 구간이 생깁니다.

## ERR trap: 오류 위치 자동 기록

```bash
#!/usr/bin/env bash
set -euo pipefail

on_error() {
  local rc=$?
  local ln=${BASH_LINENO[0]}
  local cmd="$BASH_COMMAND"
  echo "오류: 라인 ${ln}, 종료코드 ${rc}" >&2
  echo "  명령어: ${cmd}" >&2
}

trap on_error ERR

# 이제 어떤 명령이 실패해도 위치와 명령을 기록함
git pull origin main
npm ci
npm run build
```

`BASH_COMMAND`는 현재 실행 중인 명령어, `BASH_LINENO[0]`은 그 명령이 있는 라인 번호입니다. `set -e`와 함께 쓰면 파이프라인 내 실패도 잡을 수 있습니다.

![trap 실전 패턴](/assets/posts/bash-trap-patterns.svg)

## INT/TERM trap: 우아한 종료 처리

```bash
#!/usr/bin/env bash

RUNNING=true
PID_FILE="/var/run/myapp.pid"

shutdown() {
  echo "종료 시그널 수신, 작업 마무리 중..." >&2
  RUNNING=false
}

trap shutdown INT TERM

echo $$ > "$PID_FILE"
trap 'rm -f "$PID_FILE"' EXIT

while $RUNNING; do
  do_work
  sleep 1
done

echo "정상 종료"
```

`RUNNING` 플래그를 이용하면 진행 중인 작업을 끝까지 마무리한 뒤 종료할 수 있습니다. 즉시 `exit`를 호출하면 현재 작업 단계가 중간에 끊길 수 있습니다.

## 서브셸과 함수 내에서의 trap

```bash
# trap은 현재 셸에만 적용됨 — 서브셸은 상속되지 않음
trap 'echo parent' EXIT

(
  # 서브셸은 독립된 trap 환경
  trap 'echo subshell' EXIT
  echo "서브셸"
)
# 출력: 서브셸 → subshell → parent

# 함수 내 trap은 현재 셸의 trap을 덮어씀
set_trap() {
  trap 'echo function trap' RETURN
  echo "함수 실행"
}
set_trap
```

## 잠금 파일 패턴

```bash
#!/usr/bin/env bash

LOCK_FILE="/tmp/myapp.lock"

acquire_lock() {
  if ! mkdir "$LOCK_FILE" 2>/dev/null; then
    echo "이미 실행 중입니다" >&2
    exit 1
  fi
  trap 'rm -rf "$LOCK_FILE"' EXIT INT TERM
}

acquire_lock
echo "독점 작업 시작"
# ...
```

`mkdir`은 원자적으로 동작하므로 레이스 컨디션 없이 단일 실행을 보장하는 잠금에 활용할 수 있습니다.

---

**지난 글:** [Bash 파라미터 확장 완전 정복](/posts/bash-parameter-expansion/)

**다음 글:** [set 옵션과 Strict Mode](/posts/bash-set-options-strict-mode/)

<br>
읽어주셔서 감사합니다. 😊
