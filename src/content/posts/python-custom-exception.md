---
title: "커스텀 예외 클래스 설계하기"
description: "Python에서 커스텀 예외 클래스를 만드는 방법을 설명합니다. 앱 루트 예외 설계, 계층 구조 만들기, 컨텍스트 속성 추가, __str__ 오버라이드까지 실무에서 바로 쓸 수 있는 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 5
type: "knowledge"
category: "Python"
tags: ["Python", "커스텀예외", "예외설계", "Exception", "__init__", "__str__"]
featured: false
draft: false
---

[지난 글](/posts/python-exception-hierarchy/)에서 Python 내장 예외 계층 구조를 살펴봤다. 실무 프로젝트에서는 내장 예외만으로는 충분하지 않다. "어떤 모듈에서 어떤 종류의 오류가 발생했는지"를 명확히 표현하려면 커스텀 예외가 필요하다. 이번 글에서는 커스텀 예외를 올바르게 설계하는 방법을 단계적으로 배운다.

## 가장 단순한 커스텀 예외

```python
class AppError(Exception):
    """애플리케이션 전역 기본 예외"""
    pass
```

`Exception`을 상속받고 `pass`만 써도 완전히 동작하는 예외 클래스가 된다. 이것만으로도 내장 예외와 구분할 수 있고, 호출자가 `except AppError:`로 앱 전체 오류를 잡을 수 있다.

```python
raise AppError("처리 실패")
```

```
AppError: 처리 실패
```

## 계층 구조 설계

대규모 프로젝트에서는 오류를 카테고리별로 분류하는 계층을 만든다.

```python
# 앱 루트 예외
class AppError(Exception):
    """모든 앱 예외의 기본 클래스"""

# 입력 관련 오류
class ValidationError(AppError):
    """입력 검증 실패"""

class MissingFieldError(ValidationError):
    """필수 필드 누락"""

class InvalidValueError(ValidationError):
    """값 범위/형식 오류"""

# 외부 리소스 오류
class DatabaseError(AppError):
    """데이터베이스 작업 실패"""

class NetworkError(AppError):
    """네트워크 요청 실패"""
```

계층이 있으면 호출자가 원하는 세밀도로 잡을 수 있다.

```python
try:
    process(request)
except MissingFieldError as e:
    return 400, f"필수 필드 없음: {e}"
except ValidationError as e:
    return 400, f"입력 오류: {e}"
except DatabaseError as e:
    return 503, "데이터베이스 오류"
except AppError as e:
    return 500, "서버 오류"
```

## 컨텍스트 속성 추가하기

메시지만으로는 부족할 때 예외 객체에 직접 필드를 추가한다.

```python
class ValidationError(AppError):
    def __init__(self, field: str, message: str, value=None):
        super().__init__(message)
        self.field = field
        self.message = message
        self.value = value

    def __str__(self):
        if self.value is not None:
            return f"[{self.field}] {self.message} (받은 값: {self.value!r})"
        return f"[{self.field}] {self.message}"
```

```python
try:
    age = int(request["age"])
    if age < 0 or age > 150:
        raise ValidationError("age", "0~150 범위를 벗어남", value=age)
except ValidationError as e:
    print(e)           # [age] 0~150 범위를 벗어남 (받은 값: -1)
    print(e.field)     # age
    print(e.message)   # 0~150 범위를 벗어남
```

![커스텀 예외 설계 패턴](/assets/posts/python-custom-exception-design.svg)

## super().__init__() 호출의 중요성

커스텀 예외에서 `__init__`을 오버라이드할 때 `super().__init__(message)`를 반드시 호출해야 한다. 그래야 `e.args`와 `str(e)`가 올바르게 동작한다.

```python
class BadError(Exception):
    def __init__(self, code, msg):
        # super() 호출 없음 (나쁜 예)
        self.code = code
        self.msg = msg

class GoodError(Exception):
    def __init__(self, code, msg):
        super().__init__(msg)   # args = (msg,) 설정됨
        self.code = code
        self.msg = msg

e_bad = BadError(404, "없음")
e_good = GoodError(404, "없음")

print(str(e_bad))    # ''  ← 빈 문자열!
print(str(e_good))   # '없음' ← 올바름
print(e_bad.args)    # ()   ← 빈 튜플
print(e_good.args)   # ('없음',)
```

## 에러 코드 포함 패턴

API나 서비스에서 에러 코드를 응답에 포함해야 할 때 유용하다.

```python
from enum import Enum

class ErrorCode(Enum):
    VALIDATION_ERROR = "VALIDATION_ERROR"
    NOT_FOUND = "NOT_FOUND"
    PERMISSION_DENIED = "PERMISSION_DENIED"
    INTERNAL_ERROR = "INTERNAL_ERROR"

class AppError(Exception):
    def __init__(self, code: ErrorCode, message: str, **details):
        super().__init__(message)
        self.code = code
        self.details = details

    def to_dict(self):
        return {
            "error": self.code.value,
            "message": str(self),
            **self.details,
        }

# 사용 예
raise AppError(
    ErrorCode.NOT_FOUND,
    "사용자를 찾을 수 없습니다",
    user_id=42
)
```

```python
try:
    get_user(user_id)
except AppError as e:
    return json.dumps(e.to_dict()), 400
# → {"error": "NOT_FOUND", "message": "...", "user_id": 42}
```

## dataclass 기반 예외

Python 3.10+에서는 `dataclass`를 예외에도 쓸 수 있다. 다만 `dataclass`와 예외를 결합할 때는 주의가 필요하다.

```python
from dataclasses import dataclass, field

@dataclass
class ValidationError(Exception):
    field: str
    message: str
    value: object = None

    def __post_init__(self):
        # Exception.args 초기화
        super().__init__(self.message)

    def __str__(self):
        return f"[{self.field}] {self.message}"
```

```python
raise ValidationError(field="email", message="이메일 형식 오류", value="not_an_email")
```

## 예외 속성 표준화

![예외 객체 속성](/assets/posts/python-custom-exception-attributes.svg)

여러 팀원이 쓰는 공용 예외 클래스라면 속성 이름을 문서화해 두는 것이 좋다.

```python
class AppError(Exception):
    """
    모든 앱 예외의 기본 클래스.

    Attributes:
        message: 사람이 읽을 수 있는 오류 설명
        code: 머신이 읽을 수 있는 오류 코드 (선택)
        details: 추가 컨텍스트 딕셔너리 (선택)
    """
    def __init__(self, message: str, code: str = None, **details):
        super().__init__(message)
        self.code = code
        self.details = details
```

## 실전 예: API 클라이언트 예외 설계

```python
class APIError(Exception):
    """외부 API 호출 오류"""
    def __init__(self, status_code: int, message: str, url: str = None):
        super().__init__(message)
        self.status_code = status_code
        self.url = url

class ClientError(APIError):
    """4xx 오류: 잘못된 요청"""

class ServerError(APIError):
    """5xx 오류: 서버 측 오류"""

def check_response(response):
    if 400 <= response.status_code < 500:
        raise ClientError(response.status_code, response.text, response.url)
    if 500 <= response.status_code < 600:
        raise ServerError(response.status_code, response.text, response.url)
```

```python
try:
    check_response(response)
except ClientError as e:
    print(f"잘못된 요청 ({e.status_code}): {e}")
except ServerError as e:
    print(f"서버 오류 ({e.status_code}): {e}")
    retry()
```

커스텀 예외를 잘 설계하면 오류 처리 코드가 의도를 명확하게 드러내고, 디버깅 시간도 줄어든다. 다음 글에서는 예외 연결의 내부 메커니즘인 `__cause__`와 `__context__`를 더 깊이 파고든다.

---

**지난 글:** [Python 예외 계층 구조 완전 탐구](/posts/python-exception-hierarchy/)

**다음 글:** [예외 연결: __cause__와 __context__](/posts/python-exception-chaining/)

<br>
읽어주셔서 감사합니다. 😊
