---
title: "try / except / else / finally 완전 정복"
description: "Python try/except/else/finally 네 절의 정확한 역할과 실행 순서를 설명합니다. else와 finally가 없는 코드는 왜 위험한지, 각 절을 어떤 상황에서 써야 하는지를 코드 예시로 완전히 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 2
type: "knowledge"
category: "Python"
tags: ["Python", "예외처리", "try", "except", "else", "finally"]
featured: false
draft: false
---

[지난 글](/posts/python-exception-basics/)에서 예외의 기본 개념과 `try/except` 기초를 다뤘다. 실무 코드에서는 여기에 `else`와 `finally`가 추가된다. 이 두 절을 모르면 리소스 누수와 미묘한 버그를 피하기 어렵다. 이번 글에서는 네 절을 모두 정확히 이해하고 올바르게 조합하는 법을 배운다.

## 네 절의 실행 규칙

```python
try:
    # (1) 실행할 코드
except SomeError:
    # (2) try에서 SomeError 발생 시에만 실행
else:
    # (3) try가 예외 없이 완료된 경우에만 실행
finally:
    # (4) 예외 여부에 관계없이 항상 실행
```

핵심 규칙을 표로 정리하면 다음과 같다.

![try/except/else/finally 실행 흐름](/assets/posts/python-try-except-else-finally-flow.svg)

아래 코드로 네 가지 시나리오를 직접 확인해 보자.

```python
def demo(value):
    try:
        result = 10 / value
        print("try 완료")
    except ZeroDivisionError:
        print("except 실행")
    else:
        print(f"else 실행, result={result}")
    finally:
        print("finally 실행")

demo(2)   # try완료 → else실행 → finally실행
demo(0)   # except실행 → finally실행
```

`demo(2)` 출력:
```
try 완료
else 실행, result=5.0
finally 실행
```

`demo(0)` 출력:
```
except 실행
finally 실행
```

## else 절: 왜 필요한가

`else`는 "예외가 없을 때 실행할 코드"를 `try` 블록과 분리하는 역할을 한다. 이 분리가 왜 중요한지 예를 보자.

```python
# else 없이 작성: 의도가 불명확
try:
    conn = connect_to_db()
    result = conn.query("SELECT ...")
    process(result)    # ← 이 줄의 예외도 except가 잡는다
except ConnectionError:
    print("연결 실패")

# else로 분리: 의도 명확
try:
    conn = connect_to_db()
except ConnectionError:
    print("연결 실패")
else:
    result = conn.query("SELECT ...")    # 연결 성공 시에만 실행
    process(result)                      # query 예외는 위로 전파됨
```

`else`를 쓰면 `except`가 잡는 예외의 범위가 명확해진다. `try` 블록에는 오류가 날 가능성 있는 최소한의 코드만 넣고, 나머지는 `else`에 넣는 것이 좋은 습관이다.

## finally 절: 반드시 실행되는 정리 코드

`finally`는 예외가 발생하든 안 하든, `return`을 쓰든, `break`를 쓰든 **항상** 실행된다. 파일·소켓·데이터베이스 연결 같은 외부 리소스를 정리하는 용도로 쓴다.

```python
f = None
try:
    f = open("data.txt")
    data = f.read()
    process(data)
except FileNotFoundError:
    print("파일 없음")
finally:
    if f:
        f.close()    # 예외 여부와 무관하게 파일을 닫는다
```

단, Python에서 파일처럼 컨텍스트 관리자를 지원하는 객체는 `with` 문을 쓰는 것이 더 낫다.

```python
# with 문이 finally 역할을 자동으로 한다
try:
    with open("data.txt") as f:
        data = f.read()
    process(data)
except FileNotFoundError:
    print("파일 없음")
```

그러나 `with`가 없는 리소스(직접 만든 커넥션 등)에서는 `finally`가 여전히 필수다.

### finally와 return의 상호작용

```python
def tricky():
    try:
        return "try"
    finally:
        return "finally"   # try의 return을 덮어씀!

print(tricky())   # "finally"
```

`try`에서 `return`을 해도 `finally`가 실행되고, `finally`에서도 `return`이 있으면 그것이 최종 반환값이 된다. 이런 동작은 혼란스러울 수 있으니 `finally`에서는 `return`을 쓰지 않는 것이 좋다.

## 각 절 작성 가이드

![각 절의 역할](/assets/posts/python-try-except-else-finally-clauses.svg)

### try 블록을 짧게 유지하라

```python
# 나쁜 예: try 범위가 너무 넓다
try:
    data = fetch_from_api()
    parsed = parse_json(data)
    result = compute(parsed)
    save_to_db(result)
    send_notification(result)
except Exception:
    log_error()

# 좋은 예: 실패 가능성 있는 부분만 try에
try:
    data = fetch_from_api()
except NetworkError as e:
    log_error(e)
    return
try:
    parsed = parse_json(data)
except json.JSONDecodeError as e:
    log_error(e)
    return
result = compute(parsed)
save_to_db(result)
```

`try` 블록이 클수록 어떤 코드에서 예외가 발생했는지 파악하기 어렵다.

### except는 구체적으로

```python
# 나쁜 예: 모든 예외를 하나로
except Exception as e:
    print(f"오류: {e}")

# 좋은 예: 타입별 다른 처리
except ValueError as e:
    print(f"값 오류: {e}")
except KeyError as e:
    print(f"키 없음: {e}")
except OSError as e:
    print(f"파일 오류: {e}")
```

## 중첩 try와 예외 전파

`try` 블록은 중첩될 수 있고, 안쪽에서 처리되지 않은 예외는 바깥쪽 `try`로 전파된다.

```python
def outer():
    try:
        inner()
    except ValueError:
        print("outer: ValueError 처리")

def inner():
    try:
        risky()
    except TypeError:
        print("inner: TypeError 처리")
    # ValueError는 잡지 않으므로 outer로 전파
```

이 전파 메커니즘 덕분에 예외를 발생 지점에서 바로 처리하지 않고 호출 스택 위쪽에서 일괄 처리할 수 있다. 비즈니스 로직 함수는 예외를 발생시키고, 진입점(main, 라우터 핸들러 등)에서 일괄 처리하는 패턴이 널리 쓰인다.

## 실전 패턴: 재시도 로직

```python
import time

def fetch_with_retry(url, max_retries=3):
    last_error = None
    for attempt in range(max_retries):
        try:
            return requests.get(url, timeout=5)
        except requests.Timeout as e:
            last_error = e
            print(f"시도 {attempt + 1}/{max_retries} 타임아웃")
            time.sleep(2 ** attempt)   # 지수 백오프
        except requests.ConnectionError as e:
            last_error = e
            break   # 연결 오류는 재시도해도 소용없음
    raise RuntimeError(f"요청 실패: {url}") from last_error
```

`else`와 `finally`를 이해하면 예외 처리 코드가 훨씬 명확해진다. 다음 글에서는 `raise`와 `raise ... from ...`을 사용해 예외를 재발생시키고 원인을 연결하는 방법을 살펴본다.

---

**지난 글:** [Python 예외 처리 기초: try, except, 그리고 예외 객체](/posts/python-exception-basics/)

**다음 글:** [raise와 raise from: 예외 재발생과 원인 연결](/posts/python-raise-from/)

<br>
읽어주셔서 감사합니다. 😊
