---
title: "ExitStack — 동적 컨텍스트 매니저 스택"
description: "contextlib.ExitStack으로 런타임에 결정된 개수의 컨텍스트 매니저를 동적으로 쌓고 LIFO 순서로 해제하는 방법, callback 등록, 소유권 이전 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-27"
archiveOrder: 4
type: "knowledge"
category: "Python"
tags: ["Python", "contextlib", "ExitStack", "with문", "자원관리"]
featured: false
draft: false
---

[지난 글](/posts/python-suppress-redirect/)에서 `suppress`, `redirect_stdout` 같은 contextlib 유틸리티를 살펴봤다. 이번에는 contextlib의 가장 강력한 도구인 **`ExitStack`**을 다룬다. 컨텍스트 매니저의 개수가 컴파일 시점에 정해지지 않는 경우를 우아하게 처리한다.

## ExitStack이 필요한 이유

`with open(a) as f1, open(b) as f2:` 처럼 중첩 with 문은 파일 수가 고정일 때는 잘 동작한다. 그런데 파일 이름 목록이 런타임에 결정된다면?

```python
# 이렇게는 못 쓴다 — 개수가 동적이라서
files = [open(fn) for fn in filenames]  # 예외 발생 시 앞 파일이 닫히지 않음
```

수동으로 `try/finally`를 중첩하면 코드가 복잡해진다. `ExitStack`은 이 문제를 깔끔하게 해결한다.

![ExitStack 동작 개념](/assets/posts/python-exitstack-concept.svg)

## 기본 사용법

```python
from contextlib import ExitStack

filenames = ["a.csv", "b.csv", "c.csv"]

with ExitStack() as stack:
    files = [stack.enter_context(open(fn)) for fn in filenames]
    # 블록 종료 시 등록 역순(LIFO)으로 __exit__ 호출
    process(files)
```

`enter_context(cm)`은 `cm.__enter__()`를 호출하고 반환값을 돌려주면서, `cm`을 스택에 등록한다. `with` 블록을 나가면 등록된 매니저들이 LIFO 순서로 `__exit__`을 호출한다.

![ExitStack 코드 예제](/assets/posts/python-exitstack-code.svg)

## callback — 임의 정리 함수 등록

컨텍스트 매니저가 아닌 일반 함수도 스택에 등록할 수 있다.

```python
with ExitStack() as stack:
    conn = db.connect()
    stack.callback(conn.close)        # 함수 참조만 전달
    stack.callback(log.info, "done")  # 인수도 전달 가능

    do_work(conn)
# 블록 종료 시: log.info("done") → conn.close() 역순 실행
```

## pop_all — 소유권 이전

`pop_all()`은 현재 스택의 등록 목록을 새 `ExitStack`으로 이전하고 기존 스택을 비운다. 팩토리 함수에서 자원을 안전하게 반환할 때 유용하다.

```python
def open_multiple(filenames):
    with ExitStack() as cleanup:
        files = [cleanup.enter_context(open(fn)) for fn in filenames]
        # 여기까지 오면 모든 파일이 열린 것
        # cleanup 스택을 caller 에게 이전 (소유권 넘김)
        return files, cleanup.pop_all()

files, stack = open_multiple(["a.csv", "b.csv"])
with stack:
    process(files)
# 여기서 파일들 자동 닫힘
```

`pop_all()`이 없으면 `open_multiple`에서 예외가 나면 `cleanup`이 `with` 블록 종료로 파일을 닫아주지만, 정상 반환 시엔 정리 책임이 호출자에게 넘어가야 한다.

## 예외 처리

`ExitStack`은 각 `__exit__` 호출의 예외를 개별 처리한다. 하나가 실패해도 나머지 `__exit__`는 계속 실행된다.

```python
from contextlib import ExitStack, suppress

with ExitStack() as stack:
    # 특정 매니저의 예외만 억제
    stack.enter_context(suppress(OSError))
    stack.enter_context(open("data.txt"))
    stack.enter_context(open("log.txt", "w"))
    # OSError 는 억제, 나머지 예외는 전파
```

## AsyncExitStack

비동기 환경에서는 `contextlib.AsyncExitStack`을 쓴다. `aenter_context`와 `async with`를 사용한다는 점만 다르다.

```python
from contextlib import AsyncExitStack

async def main():
    async with AsyncExitStack() as stack:
        conn = await stack.enter_async_context(async_db_connect())
        await do_async_work(conn)
```

## 요약

- `ExitStack`: 런타임에 결정된 개수의 컨텍스트 매니저를 LIFO로 관리
- `enter_context(cm)`: 스택에 등록 + `__enter__()` 반환값 반환
- `callback(fn, *args)`: 일반 함수를 정리 콜백으로 등록
- `pop_all()`: 스택 소유권을 새 ExitStack으로 이전
- `AsyncExitStack`: 비동기 버전

---

**지난 글:** [contextlib.suppress와 redirect](/posts/python-suppress-redirect/)

**다음 글:** [비동기 컨텍스트 매니저](/posts/python-async-context-manager/)

<br>
읽어주셔서 감사합니다. 😊
