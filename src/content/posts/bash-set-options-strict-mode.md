---
title: "set 옵션과 Strict Mode"
description: "Bash set -euo pipefail의 의미와 효과, 그 외 유용한 set/shopt 옵션, 그리고 Strict Mode를 사용할 때 흔히 마주치는 예외 처리 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 3
type: "knowledge"
category: "Linux"
tags: ["bash", "set", "strict-mode", "pipefail", "shopt", "shell", "scripting", "linux"]
featured: false
draft: false
---

[지난 글](/posts/bash-trap-cleanup/)에서 trap으로 시그널을 처리하는 법을 알아봤습니다. 이번엔 그와 함께 쓰이는 **`set -euo pipefail`** — Bash Strict Mode — 의 각 옵션이 정확히 무엇을 하는지, 그리고 실무에서 자주 마주치는 예외 처리 패턴을 정리합니다.

## set -e: 명령 실패 시 즉시 종료

`set -e`는 명령의 종료 코드가 0이 아닐 때 스크립트를 즉시 종료시킵니다. 이게 없으면 중간에 명령이 실패해도 스크립트는 계속 실행됩니다.

```bash
set -e

# 이 명령이 실패하면 이후 라인은 실행되지 않음
git pull origin main
npm ci
npm run build
echo "빌드 완료"
```

단, 다음 위치의 명령은 `set -e`의 영향을 받지 않습니다.

```bash
# if 조건은 제외
if grep -q "pattern" file.txt; then
  echo "found"
fi

# || 오른쪽은 제외
find_result=$(find . -name "*.log") || true

# && 오른쪽은 제외
[ -d /tmp ] && echo "exists"
```

## set -u: 미설정 변수 참조 오류

`set -u`는 값이 설정되지 않은 변수를 참조할 때 오류로 종료합니다.

```bash
set -u

echo "$UNDEFINED_VAR"   # bash: UNDEFINED_VAR: unbound variable

# 예외: 기본값 확장은 허용
echo "${OPTIONAL:-default}"   # OK

# 예외: 배열 길이 관련
echo "${#@}"   # OK (위치 매개변수 개수)
```

`"$@"`와 `"$*"`은 위치 매개변수가 없어도 오류가 나지 않습니다. 스크립트 인수를 검사할 때 `set -u` 환경에서도 안전하게 쓸 수 있습니다.

## set -o pipefail: 파이프라인 실패 전파

기본적으로 파이프라인의 종료 코드는 **마지막 명령의 종료 코드**입니다. 중간 명령이 실패해도 마지막 명령이 성공하면 전체가 성공으로 처리됩니다.

```bash
# pipefail 없을 때
set -e
cat nonexistent.txt | sort   # cat은 실패, sort는 성공 → 전체 성공으로 처리

# pipefail 있을 때
set -eo pipefail
cat nonexistent.txt | sort   # cat이 실패하면 전체 실패로 종료
```

![set -euo pipefail 효과](/assets/posts/bash-set-options-diagram.svg)

## Strict Mode 예외 처리 패턴

Strict Mode를 쓰다 보면 일부러 실패를 허용해야 하는 상황이 생깁니다.

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. 특정 명령의 실패 무시
command_that_may_fail || true

# 2. 종료 코드 캡처 (|| true 없이)
if grep -q "pattern" file.txt; then
  echo "발견"
else
  echo "없음"
fi

# 3. 일시적으로 -e 해제 (서브셸로 격리)
result=$(set +e; risky_command; echo $?)
rc=${result##*$'\n'}

# 4. 종료 코드 직접 캡처
some_command && rc=$? || rc=$?
```

## 실전 Strict Mode 템플릿

```bash
#!/usr/bin/env bash
set -euo pipefail

# shopt -s inherit_errexit  # $() 에도 -e 상속 (Bash 4.4+)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR

cleanup() {
  local rc=$?
  # 정리 작업
  exit $rc
}
trap cleanup EXIT

main() {
  # 실제 로직
  :
}

main "$@"
```

`inherit_errexit`는 명령 치환 `$()` 안에서도 `set -e`가 동작하도록 합니다. Bash 4.4 이상에서 사용 가능하며, 서브셸에서의 오류가 조용히 묻히는 상황을 방지합니다.

## 다른 유용한 set / shopt 옵션

![유용한 set 및 shopt 옵션](/assets/posts/bash-set-options-other.svg)

```bash
# 디버깅: 실행 전 명령 출력
set -x
# 출력 형식: + echo "hello"

# 구문 검사만 (실행 안 함)
bash -n script.sh

# 재귀 글로브 활성화
shopt -s globstar
for f in src/**/*.ts; do echo "$f"; done

# 매칭 없을 때 빈 리스트 반환 (for 루프 오작동 방지)
shopt -s nullglob
for f in *.nonexistent; do echo "$f"; done  # 루프 실행 안 됨
```

Strict Mode의 세 옵션(`-e`, `-u`, `-o pipefail`)은 버그를 조기에 잡아주는 안전망입니다. 새 스크립트라면 항상 상단에 넣는 습관을 들이면 좋습니다. 단, 기존 스크립트에 나중에 추가하면 의도치 않게 동작이 바뀔 수 있으므로 테스트가 필요합니다.

---

**지난 글:** [trap으로 시그널 처리와 정리](/posts/bash-trap-cleanup/)

**다음 글:** [ShellCheck: 쉘 스크립트 정적 분석](/posts/bash-shellcheck/)

<br>
읽어주셔서 감사합니다. 😊
