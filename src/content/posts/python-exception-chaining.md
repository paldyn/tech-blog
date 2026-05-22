---
title: "예외 연결: __cause__와 __context__"
description: "Python 예외 연결의 내부 메커니즘을 설명합니다. __cause__와 __context__의 차이, raise from의 동작 원리, suppress_context로 원인 숨기기, 예외 체인 순회까지 완전히 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 6
type: "knowledge"
category: "Python"
tags: ["Python", "예외연결", "__cause__", "__context__", "raise from", "예외체인"]
featured: false
draft: false
---

[지난 글](/posts/python-custom-exception/)에서 커스텀 예외 클래스를 설계하는 방법을 배웠다. 이번에는 예외 연결(exception chaining)의 내부 동작을 깊이 파고든다. `raise ... from`을 사용하면 어떤 일이 일어나는지, `__cause__`와 `__context__`가 어떻게 다른지를 코드로 직접 확인해 보자.

## 예외 연결이 필요한 이유

```python
def connect_db():
    raise OSError("연결 거부됨")

def get_user(user_id):
    try:
        conn = connect_db()
    except OSError as e:
        raise ValueError(f"사용자 {user_id} 조회 실패") from e
```

`ValueError`가 발생했을 때 트레이스백에 `OSError`도 같이 보인다:

```
OSError: 연결 거부됨

The above exception was the direct cause of the following exception:

ValueError: 사용자 42 조회 실패
```

이렇게 하면 "왜 ValueError가 발생했나" → "OSError 때문에" 라는 인과 관계가 명확해진다.

## __cause__: 명시적 연결

`raise B() from A`를 쓰면:

1. `B.__cause__ = A` 설정 (명시적 원인)
2. `B.__suppress_context__ = True` 설정 (암묵적 연결 숨김)

```python
try:
    int("abc")
except ValueError as e:
    new_exc = RuntimeError("파싱 실패")
    raise new_exc from e

# 이후 except 블록에서
# new_exc.__cause__ is e     → True
# new_exc.__suppress_context__ → True
```

`__cause__`가 있으면 트레이스백에 "The above exception was the **direct cause** of..."가 출력된다. 이 표현이 "프로그래머가 의도적으로 원인을 지정했다"는 신호다.

## __context__: 암묵적 연결

`except` 블록 안에서 `from` 없이 새 예외를 발생시키면 Python이 자동으로 `__context__`를 설정한다.

```python
try:
    int("abc")
except ValueError as e:
    raise RuntimeError("파싱 실패")
    # RuntimeError.__context__ = ValueError 자동 설정
```

트레이스백:
```
ValueError: invalid literal...

During handling of the above exception, another exception occurred:

RuntimeError: 파싱 실패
```

`__context__`는 "이 예외를 처리하다가 또 다른 예외가 났다"는 의미다. 의도적 연결(`__cause__`)과 달리, 이건 처리 중 우연히 발생한 연결이다.

![예외 연결 흐름](/assets/posts/python-exception-chaining-flow.svg)

## 두 속성의 차이점 정리

```python
try:
    raise ValueError("원본 오류")
except ValueError as e:
    new = RuntimeError("새 오류")
    print(new.__context__)          # ValueError 인스턴스
    print(new.__cause__)            # None (아직 from 없음)
    print(new.__suppress_context__) # False

    new2 = RuntimeError("또 다른 오류")
    new2.__cause__ = e              # 수동으로 설정 가능
    print(new2.__suppress_context__) # False (수동 설정 시 True 안 됨)
    raise new2 from e               # → suppress=True, cause=e
```

| 속성 | 설정 방법 | 트레이스백 메시지 |
|------|---------|----------------|
| `__cause__` | `raise B from A` | "direct cause of..." |
| `__context__` | 자동 (except 내 raise) | "During handling of..." |
| `__suppress_context__` | `from None` | 원인 숨김 |

## raise ... from None

```python
class DBError(Exception):
    pass

def find_user(uid):
    try:
        return db.execute(f"SELECT * FROM users WHERE id={uid}")
    except psycopg2.OperationalError as e:
        # 내부 구현 세부사항(psycopg2)을 노출하지 않음
        raise DBError("사용자 조회 실패") from None
```

`from None`은 다음 두 가지를 동시에 한다:
- `__suppress_context__ = True` (암묵적 __context__ 숨김)
- `__cause__ = None` (명시적 원인도 없음)

결과적으로 트레이스백에 원본 예외가 전혀 보이지 않는다.

```
DBError: 사용자 조회 실패
```

이렇게 하면 호출자에게 깔끔한 에러 메시지를 제공할 수 있다. 단, 내부 로그에는 원본 예외를 별도로 남겨야 한다.

```python
import logging

def find_user(uid):
    try:
        return db.execute(...)
    except psycopg2.OperationalError as e:
        logging.exception("DB 오류 발생 (내부)")  # 로그에는 원본 트레이스백
        raise DBError("사용자 조회 실패") from None
```

## 예외 체인 순회

긴 예외 체인을 프로그래밍적으로 탐색해야 할 때는 `__cause__`와 `__context__`를 따라간다.

```python
def get_root_cause(exc):
    """예외 체인에서 최초 원인을 찾는다"""
    seen = set()
    current = exc
    while current is not None:
        exc_id = id(current)
        if exc_id in seen:
            break
        seen.add(exc_id)
        next_exc = current.__cause__ or (
            current.__context__ if not current.__suppress_context__ else None
        )
        if next_exc is None:
            return current
        current = next_exc
    return exc

try:
    risky()
except Exception as e:
    root = get_root_cause(e)
    print(f"최초 원인: {type(root).__name__}: {root}")
```

![예외 연결 실전 코드](/assets/posts/python-exception-chaining-context.svg)

## traceback 모듈로 체인 출력

```python
import traceback

try:
    try:
        int("abc")
    except ValueError as e:
        raise RuntimeError("파싱 실패") from e
except RuntimeError:
    # 전체 체인 출력
    traceback.print_exc()
    
    # 문자열로 얻기
    chain_str = traceback.format_exc()
    print(chain_str)
```

## 실전 패턴: 레이어드 아키텍처

```python
# Repository 레이어
class UserRepository:
    def find(self, user_id):
        try:
            return self.db.query(f"WHERE id={user_id}")
        except DatabaseConnectionError as e:
            raise RepositoryError(f"사용자 조회 실패: {user_id}") from e

# Service 레이어
class UserService:
    def get_profile(self, user_id):
        try:
            user = self.repo.find(user_id)
        except RepositoryError as e:
            raise ServiceError(f"프로필 로드 실패: {user_id}") from e
        return build_profile(user)

# Controller 레이어
@app.get("/users/{user_id}")
def get_user_endpoint(user_id: int):
    try:
        return service.get_profile(user_id)
    except ServiceError as e:
        # 체인 맨 끝: 클라이언트에게 깔끔한 메시지
        return {"error": str(e)}, 500
```

각 레이어에서 `from e`로 원인을 연결하면, 로그에서 전체 체인을 볼 수 있으면서도 각 레이어는 자신의 추상화 수준에 맞는 예외 타입만 노출한다.

예외 연결은 복잡해 보이지만 실제로는 단순한 원칙이다: **경계를 넘어 예외를 변환할 때는 항상 `raise NewError() from original`**. 다음 글에서는 Python 3.11에서 추가된 `ExceptionGroup`과 `except*` 문법을 살펴본다.

---

**지난 글:** [커스텀 예외 클래스 설계하기](/posts/python-custom-exception/)

**다음 글:** [예외 그룹과 except*: Python 3.11의 새 문법](/posts/python-exception-groups/)

<br>
읽어주셔서 감사합니다. 😊
