---
title: "raise와 raise from: 예외 재발생과 원인 연결"
description: "Python에서 raise와 raise ... from ...의 차이를 설명합니다. 예외 연결의 의미, __cause__와 __context__의 차이, raise ... from None으로 원인을 숨기는 방법까지 완전히 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 3
type: "knowledge"
category: "Python"
tags: ["Python", "예외처리", "raise", "raise from", "예외연결", "__cause__"]
featured: false
draft: false
---

[지난 글](/posts/python-try-except-else-finally/)에서 try/except/else/finally의 네 절을 완전히 파악했다. 예외를 잡는 방법을 알았으니, 이번에는 예외를 **던지는** 방법을 더 깊이 살펴본다. 특히 라이브러리를 만들거나 예외를 변환해서 재발생시킬 때 `raise ... from`을 모르면 디버깅을 매우 어렵게 만드는 코드를 쓰게 된다.

## raise의 세 가지 형태

```python
# 1. 새 예외 발생
raise ValueError("값이 잘못되었습니다")

# 2. 현재 예외 재발생 (except 블록 안에서만)
try:
    risky()
except ValueError:
    log_it()
    raise   # 원본 예외를 그대로 다시 던짐

# 3. 예외 인스턴스 재발생
try:
    risky()
except ValueError as e:
    raise e   # raise와 미묘하게 다름 (트레이스백 시작점)
```

`raise`(인자 없음)는 현재 예외와 원래 트레이스백을 그대로 전파한다. `raise e`는 현재 줄에서 새로 시작하는 것처럼 트레이스백이 잘린다. 원본 스택을 살리려면 인자 없는 `raise`를 쓰는 것이 원칙이다.

## 예외 연결: raise ... from ...

라이브러리나 모듈 경계에서 예외를 변환할 때 원본 예외 정보를 보존하고 싶다면 `raise NewError() from original_error`를 쓴다.

```python
import json

class ConfigError(Exception):
    """설정 관련 오류"""

def load_config(path):
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError as e:
        raise ConfigError(f"설정 파일 없음: {path}") from e
    except json.JSONDecodeError as e:
        raise ConfigError(f"설정 파일 형식 오류: {path}") from e
```

`load_config`를 호출하는 쪽은 `ConfigError`만 알면 된다. 하지만 트레이스백에는 원본 `FileNotFoundError`나 `JSONDecodeError`도 함께 표시되어 디버깅이 쉽다.

트레이스백 출력 예시:
```
FileNotFoundError: [Errno 2] No such file or directory: 'config.json'

The above exception was the direct cause of the following exception:

ConfigError: 설정 파일 없음: config.json
```

![raise vs raise from 비교](/assets/posts/python-raise-from-comparison.svg)

## __cause__ vs __context__

Python의 예외 연결에는 두 가지 종류가 있다.

### 명시적 연결: __cause__

`raise B() from A`를 쓰면 `B.__cause__ = A`가 설정된다. 트레이스백에 "The above exception was the **direct cause** of..."가 출력된다.

```python
try:
    connect()
except OSError as e:
    raise ConnectionError("연결 실패") from e
    # → e.__cause__ = OSError 인스턴스
```

### 암묵적 연결: __context__

`except` 블록 안에서 `from` 없이 새 예외를 발생시키면 Python이 자동으로 `B.__context__ = A`를 설정한다.

```python
try:
    connect()
except OSError:
    raise ConnectionError("연결 실패")
    # → ConnectionError.__context__ = OSError 인스턴스 (자동)
```

트레이스백: "During handling of the above exception, another exception occurred:"

두 경우 모두 트레이스백에 원본 예외가 표시되지만, `__cause__`가 더 명확하게 인과관계를 나타낸다.

![예외 연결 구조](/assets/posts/python-raise-from-chaining.svg)

## raise ... from None: 원인 숨기기

때로는 구현 세부사항인 원본 예외를 사용자에게 노출하고 싶지 않을 때가 있다.

```python
class DatabaseError(Exception):
    pass

def get_user(user_id):
    try:
        return db.query(f"SELECT * FROM users WHERE id={user_id}")
    except psycopg2.Error as e:
        # psycopg2 내부 오류를 숨기고 앱 레벨 오류만 노출
        raise DatabaseError(f"사용자 {user_id}를 찾을 수 없습니다") from None
```

`from None`을 쓰면 `__suppress_context__ = True`가 설정되어 트레이스백에 원본 예외가 표시되지 않는다. 다만 내부 로그에는 원본 예외를 별도로 남기는 것이 좋다.

```python
import logging

def get_user(user_id):
    try:
        return db.query(...)
    except psycopg2.Error as e:
        logging.error("DB 오류 (내부): %s", e)   # 내부 로그에는 남김
        raise DatabaseError(f"사용자 {user_id}를 찾을 수 없습니다") from None
```

## 커스텀 예외에서의 패턴

라이브러리를 만들 때 권장하는 패턴이다.

```python
class AppError(Exception):
    """앱 전역 기본 예외"""

class NetworkError(AppError):
    """네트워크 관련 오류"""

class ParseError(AppError):
    """데이터 파싱 오류"""

def fetch_data(url):
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
    except requests.Timeout as e:
        raise NetworkError(f"타임아웃: {url}") from e
    except requests.HTTPError as e:
        raise NetworkError(f"HTTP 오류 {e.response.status_code}: {url}") from e
    
    try:
        return response.json()
    except json.JSONDecodeError as e:
        raise ParseError(f"JSON 파싱 실패: {url}") from e
```

호출자는 `requests`나 `json` 같은 외부 라이브러리 예외를 몰라도 된다. `AppError` 계층만 알면 된다. 하지만 `from e`로 원인을 연결해두면 실제 오류 원인을 트레이스백에서 확인할 수 있다.

## 예외를 다시 발생시킬 때의 의사결정 흐름

1. **단순히 로깅 후 재전파**: `log(e); raise`
2. **예외 타입 변환 + 원인 보존**: `raise NewError() from original_e`
3. **예외 타입 변환 + 원인 숨김**: `raise NewError() from None`
4. **처리 가능한 경우**: `return default_value`

외부 라이브러리 예외를 앱 예외로 변환할 때 `from` 없이 쓰면 `__context__`로 암묵적 연결은 되지만, 의도를 명확히 하려면 `from e`가 항상 낫다. 팀 코드베이스에서 `from` 사용을 컨벤션으로 정하는 것을 권장한다.

---

**지난 글:** [try / except / else / finally 완전 정복](/posts/python-try-except-else-finally/)

**다음 글:** [Python 예외 계층 구조 완전 탐구](/posts/python-exception-hierarchy/)

<br>
읽어주셔서 감사합니다. 😊
