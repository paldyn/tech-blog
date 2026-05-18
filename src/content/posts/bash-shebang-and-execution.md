---
title: "Bash 셔뱅과 스크립트 실행 방식"
description: "Bash 스크립트의 셔뱅(#!) 라인 구조와 커널의 인터프리터 탐색 과정을 설명합니다. ./script.sh, bash script.sh, source, .의 차이점과 실행 권한, 표준 스크립트 구조를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 9
type: "knowledge"
category: "Linux"
tags: ["bash", "shebang", "script", "shell", "execve", "chmod", "source", "linux"]
featured: false
draft: false
---

[지난 글](/posts/linux-bpftrace-intro/)에서 eBPF 기반 동적 추적을 알아봤습니다. 이제 Bash 프로그래밍 섹션으로 넘어갑니다. 스크립트를 작성하면 가장 먼저 마주치는 것이 파일 첫 줄의 `#!/usr/bin/env bash`입니다. 이 줄이 없거나 잘못되면 스크립트가 예상치 못하게 동작합니다.

## 셔뱅이란

`#!`로 시작하는 첫 줄을 **셔뱅(shebang)** 또는 해시뱅(hashbang)이라고 합니다. 파일을 `execve` 시스템 콜로 실행할 때 커널이 이 두 바이트를 읽고 지정된 인터프리터를 찾아 스크립트를 실행합니다.

![셔뱅(Shebang) 라인 구조](/assets/posts/bash-shebang-anatomy.svg)

```bash
#!/usr/bin/env bash    # 권장: PATH에서 bash 탐색, 이식성 좋음
#!/bin/bash            # 절대 경로, /bin/bash가 없는 시스템에서 실패 가능
#!/usr/bin/python3     # Python 스크립트
#!/usr/bin/env node    # Node.js 스크립트
```

`/usr/bin/env bash`를 쓰는 이유는 macOS처럼 bash가 `/usr/local/bin/bash`에 설치되는 환경에서도 `PATH`를 통해 올바른 bash를 찾기 때문입니다.

## 스크립트 실행 방법 비교

![./script.sh 실행 시 커널 처리 흐름](/assets/posts/bash-execution-flow.svg)

```bash
# 셔뱅 인터프리터로 실행 (실행 권한 필요)
chmod +x script.sh
./script.sh

# bash를 명시적으로 지정 (실행 권한 불필요)
bash script.sh

# 현재 셸에서 실행 (변수·함수·cd가 현재 세션에 반영)
source script.sh
. script.sh     # source의 POSIX 단축형
```

`source`와 `./`의 차이는 **서브셸 생성 여부**입니다. `./script.sh`는 새 프로세스에서 실행되어 부모 셸의 환경변수를 변경할 수 없습니다. `source`는 현재 셸에서 직접 실행되므로 `cd`, `export`, 함수 정의가 실행 후에도 남습니다.

```bash
# 실험: source vs ./
echo 'export MY_VAR="hello"' > /tmp/test.sh
./tmp/test.sh; echo $MY_VAR    # 빈 출력 (서브셸)
source /tmp/test.sh; echo $MY_VAR  # hello (현재 셸)
```

## 실행 권한 설정

```bash
chmod +x script.sh       # 소유자·그룹·기타 모두에 실행권한
chmod 755 script.sh      # rwxr-xr-x
chmod u+x script.sh      # 소유자에게만 실행권한

# 셔뱅 줄 없이도 실행 확인
file script.sh           # "Bourne-Again shell script" 또는 "ASCII text"
```

## 표준 Bash 스크립트 구조

실무에서 쓰는 Bash 스크립트의 첫 부분은 대체로 다음 구조를 따릅니다.

```bash
#!/usr/bin/env bash
set -euo pipefail
# -e: 명령 실패 시 즉시 종료
# -u: 미정의 변수 참조 시 오류
# -o pipefail: 파이프 앞 단계 실패도 전파

# 스크립트 디렉터리 기준 상대 경로 (심볼릭 링크 안전)
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)

# 정리 함수 (EXIT 신호에 자동 호출)
cleanup() {
  rm -f /tmp/myapp.lock
  echo "정리 완료" >&2
}
trap cleanup EXIT
```

## shellcheck로 정적 검사

```bash
# 설치
apt install shellcheck

# 검사 실행
shellcheck script.sh

# 일반 실수 예: 따옴표 없는 변수 확장
MY_FILE="hello world.txt"
rm $MY_FILE       # 실수: "hello"와 "world.txt" 두 인자로 분리됨
rm "$MY_FILE"     # 올바름: 하나의 인자
```

shellcheck는 `SC2086`(따옴표 없는 변수), `SC2046`(명령 치환에 따옴표 누락) 같은 일반적인 실수를 잡아 줍니다.

---

**지난 글:** [bpftrace — eBPF 기반 동적 추적 입문](/posts/linux-bpftrace-intro/)

**다음 글:** [Bash 변수와 인용 부호](/posts/bash-variables-quoting/)

<br>
읽어주셔서 감사합니다. 😊
