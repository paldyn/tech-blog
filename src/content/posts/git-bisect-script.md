---
title: "git bisect run으로 버그 탐색 자동화하기"
description: "git bisect run에 테스트 스크립트를 연결해 수동 입력 없이 버그 커밋을 자동으로 탐색하는 방법. 종료 코드 규칙과 실전 스크립트 작성법을 설명한다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 2
type: "knowledge"
category: "Git"
tags: ["Git", "bisect", "자동화", "bisect run", "디버깅"]
featured: false
draft: false
---

[지난 글](/posts/git-bisect-basics/)에서 `git bisect`의 기본 개념과 수동 bad/good 판정 방법을 살펴봤다. 수동 방식은 커밋마다 직접 테스트하고 입력해야 해서 번거롭다. `git bisect run`을 사용하면 테스트 스크립트 하나로 전체 탐색을 자동화할 수 있다.

## bisect run 작동 원리

`git bisect run <script>` 는 Git이 커밋을 체크아웃할 때마다 스크립트를 자동 실행하고, 그 **종료 코드(exit code)** 로 good/bad/skip을 판정한다. 사람이 개입하지 않아도 최종 결과까지 자동으로 도달한다.

![bisect run 자동화 흐름](/assets/posts/git-bisect-script-flow.svg)

## 종료 코드 규칙

스크립트가 어떤 종료 코드를 반환하느냐에 따라 bisect가 다르게 동작한다.

![bisect run 종료 코드 규칙](/assets/posts/git-bisect-script-exitcode.svg)

가장 중요한 특수 코드는 **125**다. 컴파일 실패나 의존성 문제로 테스트 자체를 실행할 수 없는 커밋에서 `exit 125`를 반환하면 Git이 그 커밋을 skip하고 인접 커밋으로 이동한다.

## 가장 간단한 예: 단위 테스트 한 줄

```bash
git bisect start
git bisect bad HEAD
git bisect good v3.1.0

# 단위 테스트 파일 직접 지정
git bisect run npm test -- --testPathPattern="auth.test"
# 또는
git bisect run pytest tests/test_auth.py -q
```

테스트 명령의 종료 코드(0=통과, 1=실패)가 그대로 good/bad 판정에 쓰인다. 전체 테스트 스위트를 돌리면 느리므로, 버그와 관련된 특정 테스트만 필터링하는 게 실용적이다.

## 스크립트 파일 작성 패턴

더 복잡한 빌드 프로세스가 필요하면 별도 스크립트 파일로 분리한다.

```bash
#!/bin/bash
# bisect-test.sh

set -e   # 에러 발생 시 즉시 종료

# 빌드 실패 = 테스트 불가 → skip
make build 2>/dev/null || exit 125

# 특정 기능 테스트
./run_e2e.sh --test-case "checkout_flow"
# 종료 코드 0 → good, 0이 아님 → bad
```

```bash
# 실행 권한 부여 후 run
chmod +x bisect-test.sh
git bisect run ./bisect-test.sh
```

`set -e`는 넣지 않는 것이 더 안전한 경우도 있다. 중간 단계가 실패해도 최종 테스트 결과만으로 판정하고 싶다면 `set -e` 없이 마지막 명령의 종료 코드만 반환하도록 설계한다.

## 파이썬 스크립트로 정밀한 검증

쉘 스크립트보다 복잡한 판정 로직이 필요할 때는 파이썬 스크립트를 사용한다.

```python
#!/usr/bin/env python3
# bisect_check.py
import subprocess
import sys

# 빌드 확인
result = subprocess.run(["make", "build"],
                        capture_output=True)
if result.returncode != 0:
    sys.exit(125)  # skip

# 특정 API 응답 검증
result = subprocess.run(
    ["curl", "-s", "http://localhost:8080/api/health"],
    capture_output=True, text=True
)
if '"status":"ok"' in result.stdout:
    sys.exit(0)   # good
else:
    sys.exit(1)   # bad
```

```bash
git bisect run python3 bisect_check.py
```

## 인라인 명령 사용 (스크립트 파일 없이)

짧은 판정이라면 파일 없이 인라인으로 처리한다.

```bash
# grep이 패턴을 찾으면 0(good), 못 찾으면 1(bad)
git bisect run grep -q "expected output" output.log

# 컴파일 + 바이너리 실행 확인
git bisect run bash -c "make && ./myapp --test; exit $?"

# 특정 함수 존재 여부 확인
git bisect run bash -c \
  "grep -r 'def process_payment' src/ && exit 0 || exit 1"
```

## 진행 로그 실시간 확인

`bisect run` 중에는 각 커밋에서 스크립트 출력이 터미널에 표시된다.

```bash
# 상세 출력 예시
# running ./bisect-test.sh
# Build successful
# Test PASSED
# Bisecting: 3 revisions left to test after this
# [abc1234] feat: 결제 모듈 리팩토링
#
# running ./bisect-test.sh
# Build successful
# Test FAILED
# Bisecting: 1 revision left to test after this
# ...
# def5678 is the first bad commit
```

모든 탐색이 완료되면 버그를 도입한 커밋 SHA와 메시지가 자동으로 출력된다.

## 세션 종료 및 커밋 분석

```bash
# 자동 탐색 완료 후 반드시 reset
git bisect reset

# 발견된 커밋 상세 분석
git show def5678
git diff def5678^ def5678          # 해당 커밋의 변경 내역
git show def5678 --stat            # 변경 파일 목록
```

## 실전 팁

- **테스트는 빠를수록 좋다**: 탐색 횟수가 `log₂(N)`이어도, 각 테스트가 느리면 전체 시간이 길어진다. 관련 테스트만 선택적으로 실행하자.
- **상태 오염 주의**: 각 커밋에서 이전 빌드 산출물이 남아 있으면 테스트 결과가 오염될 수 있다. 스크립트 시작 부분에 `make clean` 또는 해당 디렉터리 정리를 추가하자.
- **서버 기반 테스트**: 서버를 시작·종료하는 테스트라면 스크립트에서 포트 충돌을 방지하도록 정리 로직을 포함시켜야 한다.

`bisect run`의 자동화 능력은 다음 글에서 다룰 **bisect skip**과 결합할 때 더욱 강력해진다. 컴파일 불가능한 커밋이 탐색 범위 안에 있어도 자동으로 건너뛰고 결과를 찾아낼 수 있다.

---

**지난 글:** [git bisect로 버그 커밋 이진 탐색하기](/posts/git-bisect-basics/)

**다음 글:** [git bisect skip으로 불량 커밋 건너뛰기](/posts/git-bisect-skip/)

<br>
읽어주셔서 감사합니다. 😊
