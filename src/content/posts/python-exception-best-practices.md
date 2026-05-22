---
title: "예외 처리 모범 사례와 안티패턴"
description: "Python 예외 처리에서 흔히 저지르는 안티패턴과 올바른 대안을 코드로 비교합니다. 예외를 언제 써야 하는지, 어떻게 설계해야 하는지, 프로덕션에서 예외를 어떻게 다뤄야 하는지를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 10
type: "knowledge"
category: "Python"
tags: ["Python", "예외처리", "모범사례", "안티패턴", "클린코드"]
featured: false
draft: false
---

[지난 글](/posts/python-traceback-module/)에서 traceback 모듈로 예외 정보를 다루는 방법을 배웠다. 예외 처리 시리즈의 마지막 글로, 지금까지 배운 내용을 바탕으로 **무엇을 해야 하고 무엇을 피해야 하는지**를 정리한다. 코드 리뷰에서 자주 지적받는 안티패턴과 그에 대한 올바른 대안을 코드로 나란히 비교한다.

## 안티패턴 1: Bare except

```python
# ❌ 안티패턴
try:
    process()
except:
    pass   # 모든 것을 무시

# ✅ 모범 사례
try:
    process()
except ValueError as e:
    logger.warning("잘못된 값: %s", e)
except OSError as e:
    logger.error("파일 오류: %s", e)
    raise
```

`except:`는 `SystemExit`와 `KeyboardInterrupt`까지 잡아버린다. 프로그램을 종료할 수 없게 되거나 오류가 조용히 사라진다. 항상 구체적인 예외 타입을 명시하라.

## 안티패턴 2: pass만 있는 except

```python
# ❌ 안티패턴
try:
    value = config["timeout"]
except KeyError:
    pass   # 조용히 무시

# ✅ 기본값 사용
try:
    value = config["timeout"]
except KeyError:
    value = 30   # 기본값 명확히

# ✅ 더 나은 방법: dict.get()
value = config.get("timeout", 30)
```

예외를 무시할 이유가 있다면 주석으로 이유를 설명하라.

```python
try:
    cache.invalidate(key)
except KeyError:
    pass   # 이미 캐시에 없음: 정상 상황
```

## 안티패턴 3: 너무 넓은 try 블록

```python
# ❌ 안티패턴: 무엇이 실패한지 알 수 없음
try:
    data = fetch_api()
    parsed = parse(data)
    result = compute(parsed)
    save(result)
    notify(result)
except Exception as e:
    log_error(e)

# ✅ 모범 사례: 실패 지점별 처리
try:
    data = fetch_api()
except NetworkError as e:
    log_error("API 호출 실패", e)
    return

parsed = parse(data)      # 파싱 실패는 버그이므로 전파
result = compute(parsed)  # 계산 오류도 전파

try:
    save(result)
except DatabaseError as e:
    log_error("저장 실패", e)
    return

notify(result)   # 알림 실패는 무시해도 되는 경우
```

## 안티패턴 4: except에서 원인 숨기기

```python
# ❌ 안티패턴: 원본 예외 정보 손실
try:
    connect_db()
except Exception as e:
    raise RuntimeError("DB 연결 실패")
    # 트레이스백에 원본 예외가 표시되지만 연결이 불명확

# ✅ 모범 사례: from으로 명시적 연결
try:
    connect_db()
except OSError as e:
    raise DatabaseError("DB 연결 실패") from e
```

![안티패턴 vs 모범 사례](/assets/posts/python-exception-best-practices-patterns.svg)

## 안티패턴 5: 제어 흐름에 예외 사용

```python
# ❌ 안티패턴: 정상 흐름에 예외 사용
def find_user(users, name):
    try:
        return next(u for u in users if u.name == name)
    except StopIteration:
        return None

# ✅ 모범 사례: 조건문 사용
def find_user(users, name):
    return next((u for u in users if u.name == name), None)
```

예외는 **예외적인** 상황에만 써야 한다. 정상 흐름(사용자가 없는 것이 가능한 상황)은 조건문이나 기본값으로 처리하는 것이 더 빠르고 명확하다.

## 안티패턴 6: finally에서 return/raise

```python
# ❌ 안티패턴
def dangerous():
    try:
        risky()
    except ValueError:
        raise   # 예외 전파 의도
    finally:
        return "완료"   # try/except의 return/raise를 모두 덮어씀!

# ✅ 모범 사례: finally에는 정리 코드만
def safe():
    try:
        return risky()
    except ValueError:
        raise
    finally:
        cleanup()   # return/raise 없이 정리만
```

## 로깅 모범 사례

```python
import logging

logger = logging.getLogger(__name__)

# ❌ 안티패턴: 예외를 잡고 로그만 남기면서 계속 진행
try:
    critical_operation()
except Exception as e:
    logger.error(f"오류: {e}")   # 트레이스백 없음, 문제 지속

# ✅ 모범 사례: exc_info=True로 트레이스백 포함
try:
    critical_operation()
except Exception:
    logger.exception("치명적 오류 발생")   # exception()은 exc_info=True 포함
    raise   # 또는 적절한 처리

# ✅ 또는 명시적으로
try:
    critical_operation()
except Exception as e:
    logger.error("치명적 오류", exc_info=True)
    raise
```

## 예외 처리 체크리스트

![예외 처리 모범 사례 체크리스트](/assets/posts/python-exception-best-practices-checklist.svg)

```python
# 예외 처리 코드 작성 전 자문할 것들:

# 1. 이 예외가 실제로 발생할 수 있는가?
# 2. 발생했을 때 어떻게 복구할 수 있는가?
# 3. 발생 원인을 추적할 수 있는 정보를 남기는가?
# 4. 호출자에게 올바른 정보를 전달하는가?
# 5. 리소스 정리를 보장하는가?
```

## 프로덕션 예외 처리 패턴

```python
import logging
import traceback

logger = logging.getLogger(__name__)

class ServiceError(Exception):
    def __init__(self, message, code=None, **context):
        super().__init__(message)
        self.code = code
        self.context = context

def handle_request(request):
    """프로덕션 엔드포인트 예외 처리 패턴"""
    try:
        result = process_request(request)
        return {"status": "ok", "data": result}
    except ValidationError as e:
        # 사용자 오류: 400
        logger.info("검증 실패: %s (요청: %s)", e, request.id)
        return {"status": "error", "message": str(e)}, 400
    except ServiceError as e:
        # 비즈니스 로직 오류: 422
        logger.warning("서비스 오류: %s", e, extra=e.context)
        return {"status": "error", "code": e.code, "message": str(e)}, 422
    except Exception:
        # 예상치 못한 오류: 500
        logger.exception("예상치 못한 오류 (요청 ID: %s)", request.id)
        return {"status": "error", "message": "서버 내부 오류"}, 500
```

## 타입 힌트와 예외 문서화

```python
from typing import Union

def parse_config(path: str) -> dict:
    """
    설정 파일을 파싱한다.

    Args:
        path: 설정 파일 경로

    Returns:
        파싱된 설정 딕셔너리

    Raises:
        FileNotFoundError: 파일이 존재하지 않을 때
        ConfigError: 파일 형식이 잘못되었을 때
    """
    try:
        with open(path) as f:
            return json.load(f)
    except FileNotFoundError:
        raise   # 그대로 전파
    except json.JSONDecodeError as e:
        raise ConfigError(f"잘못된 JSON: {path}") from e
```

`Raises` 섹션에 발생 가능한 예외를 문서화하면 호출자가 어떤 예외를 처리해야 하는지 알 수 있다.

## 요약: 예외 처리 원칙

| 원칙 | 요약 |
|------|------|
| 구체적으로 | `except ValueError` > `except Exception` > `except` |
| 원인 보존 | `raise NewError() from original` |
| 리소스 정리 | `with` 문 또는 `finally` |
| 로그 남기기 | `logger.exception()` 또는 `exc_info=True` |
| 범위 최소화 | `try` 블록을 짧게 유지 |
| EAFP vs LBYL | Python은 EAFP(허락보다 용서) 스타일 선호 |

EAFP(Easier to Ask Forgiveness than Permission)는 Python 스타일이다. 먼저 시도하고 실패하면 처리하는 방식이다. 반면 LBYL(Look Before You Leap)은 먼저 조건을 확인한다. 두 방식 모두 상황에 따라 맞는 경우가 있으니 맥락에 따라 선택하라.

```python
# LBYL (Look Before You Leap)
if "key" in d:
    value = d["key"]

# EAFP (Easier to Ask Forgiveness)
try:
    value = d["key"]
except KeyError:
    value = default
```

딕셔너리 접근처럼 간단한 경우엔 `d.get("key", default)`가 가장 간결하다.

예외 처리는 코드의 신뢰성을 결정한다. 오류를 예측하고, 의미 있게 처리하고, 원인을 추적할 수 있게 기록하라. 그것이 프로덕션에서 살아남는 코드를 만드는 방법이다.

---

**지난 글:** [traceback 모듈로 예외 정보 완전 제어하기](/posts/python-traceback-module/)

**다음 글:** [Python 이터레이터 프로토콜: __iter__와 __next__](/posts/python-iterator-protocol/)

<br>
읽어주셔서 감사합니다. 😊
