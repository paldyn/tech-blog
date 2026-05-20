---
title: "ShellCheck: 쉘 스크립트 정적 분석"
description: "ShellCheck 설치와 사용법, 자주 잡히는 경고 패턴(SC2086 인용 누락, SC2155 선언+대입 등), 그리고 VS Code·CI/CD 연동 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 4
type: "knowledge"
category: "Linux"
tags: ["bash", "shellcheck", "linting", "static-analysis", "scripting", "linux", "ci-cd"]
featured: false
draft: false
---

[지난 글](/posts/bash-set-options-strict-mode/)에서 `set -euo pipefail`로 스크립트를 견고하게 만드는 법을 살펴봤습니다. Strict Mode가 **런타임** 안전망이라면, ShellCheck는 **정적 분석**으로 실행 전에 문제를 잡아주는 도구입니다. 쉘 스크립트에서 컴파일러처럼 동작합니다.

## 설치

```bash
# Ubuntu / Debian
sudo apt install shellcheck

# macOS (Homebrew)
brew install shellcheck

# 설치 확인
shellcheck --version
```

## 기본 사용법

```bash
# 단일 파일 검사
shellcheck script.sh

# 특정 셸 지정 (shebang 없을 때)
shellcheck -s bash script.sh

# 경고 레벨 필터 (error/warning/info/style)
shellcheck -S warning script.sh

# 여러 파일
shellcheck scripts/*.sh

# 파이프로 출력 확인
shellcheck script.sh | grep SC2086
```

출력 형식은 기본적으로 `파일:라인:컬럼: 레벨 [SC번호]: 설명`입니다. SC번호를 구글에 검색하면 shellcheck.net 위키에서 상세 설명과 수정 방법을 볼 수 있습니다.

## 자주 잡히는 경고 패턴

![ShellCheck이 잡아내는 대표 패턴](/assets/posts/bash-shellcheck-examples.svg)

### SC2086: 인용 누락

```bash
# 문제: 공백이나 글로브가 있는 변수는 단어 분리됨
FILES="a.txt b.txt"
for f in $FILES; do echo $f; done

# 수정: 배열로 받거나 인용 처리
IFS=$'\n' read -ra FILES <<< "$FILES_STR"
for f in "${FILES[@]}"; do echo "$f"; done
```

### SC2155: local/readonly와 대입 동시 사용

```bash
# 문제: local은 항상 0을 반환하므로 대입 실패를 감지 못 함
local var=$(risky_command)
echo $?   # 항상 0

# 수정: 선언과 대입 분리
local var
var=$(risky_command)
echo $?   # risky_command의 실제 종료 코드
```

### SC2039/SC2292: POSIX sh와 Bash 전용 기능 혼용

```bash
# 문제: #!/bin/sh 스크립트에서 Bash 전용 [[ ]] 사용
if [[ "$a" == "$b" ]]; then ...

# 수정 1: Bash로 shebang 변경
#!/usr/bin/env bash

# 수정 2: POSIX 호환 문법 사용
if [ "$a" = "$b" ]; then ...
```

## 인라인 무시 주석

의도적으로 경고를 무시할 때는 인라인 주석으로 특정 SC 번호를 비활성화합니다.

```bash
# shellcheck disable=SC2086
echo $UNSAFE_ON_PURPOSE

# 또는 파일 전체 특정 규칙 무시 (파일 상단에)
# shellcheck disable=SC2039,SC2155
```

무시 주석은 최소 범위에서 사용하고, 이유를 옆에 메모해 두는 것이 좋습니다.

## VS Code 연동

VS Code에서 `ShellCheck` 확장을 설치하면 파일을 저장할 때마다 실시간으로 경고를 표시합니다. `.vscode/settings.json`에서 경고 레벨을 설정할 수 있습니다.

```json
{
  "shellcheck.enable": true,
  "shellcheck.run": "onSave",
  "shellcheck.severity": "warning",
  "shellcheck.exclude": ["SC1090", "SC1091"]
}
```

`SC1090` / `SC1091`은 외부 파일 `source` 시 경고인데, 동적 경로를 사용하는 경우 잘못된 경고가 많아 프로젝트 단위로 무시하는 경우가 많습니다.

## CI/CD 연동

![ShellCheck 분석 워크플로우](/assets/posts/bash-shellcheck-workflow.svg)

```bash
# pre-commit hook (git 저장소 루트의 .git/hooks/pre-commit)
#!/bin/bash
changed_scripts=$(git diff --cached --name-only --diff-filter=ACM | grep '\.sh$')
if [[ -n "$changed_scripts" ]]; then
  shellcheck $changed_scripts || {
    echo "ShellCheck 실패 — 커밋 취소"
    exit 1
  }
fi
```

GitHub Actions에서는 `ludeeus/action-shellcheck` 액션을 사용하면 별도 설치 없이 PR마다 자동 검사를 실행할 수 있습니다.

ShellCheck은 쉘 스크립트에서 발생하기 쉬운 수백 가지 패턴을 알고 있습니다. 기존 스크립트에 처음 적용하면 경고가 많이 나올 수 있지만, 중요도가 높은 `error`와 `warning` 레벨부터 순차적으로 수정해 나가면 됩니다.

---

**지난 글:** [set 옵션과 Strict Mode](/posts/bash-set-options-strict-mode/)

**다음 글:** [grep/egrep/fgrep 텍스트 검색](/posts/linux-grep-egrep-fgrep/)

<br>
읽어주셔서 감사합니다. 😊
