---
title: "Python 주석과 독스트링"
description: "Python의 한 줄 주석, 인라인 주석, 독스트링의 차이와 올바른 사용법, 좋은 주석을 쓰는 원칙을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-28"
archiveOrder: 9
type: "knowledge"
category: "Python"
tags: ["Python", "주석", "독스트링", "코드 문서화", "PEP 257"]
featured: false
draft: false
---

[지난 글](/posts/python-hello-world/)에서 첫 Python 프로그램을 작성했습니다. 코드를 쓰기 시작하면 곧 주석의 필요성을 느낍니다. Python에서 주석은 두 가지 형태입니다. `#`으로 시작하는 일반 주석과 삼중 따옴표를 쓰는 독스트링입니다.

## 한 줄 주석 (#)

`#` 기호부터 줄 끝까지가 주석입니다. 인터프리터가 완전히 무시합니다.

```python
# 이 함수는 세금을 계산합니다
def calculate_tax(income):
    rate = 0.22  # 22% 세율
    return income * rate
```

PEP 8 권장 사항:
- `#` 뒤에 스페이스 한 칸
- 인라인 주석은 코드와 최소 스페이스 2칸 이상
- 주석은 완전한 문장으로 쓸 것

## 좋은 주석 vs 나쁜 주석

주석은 **왜(WHY)**를 설명해야 합니다. **무엇(WHAT)**은 코드가 이미 말하고 있습니다.

```python
# 나쁜 주석 — 코드가 이미 말하는 것
x = x + 1  # x에 1을 더한다

# 좋은 주석 — 이유를 설명
x = x + 1  # 펜스 포스트 문제: 범위 끝을 포함하기 위해 +1

# 나쁜 주석 — 낡은 주석 (코드와 불일치)
# 이 값은 10이다
MAX = 100

# 좋은 주석 — 숨겨진 제약 설명
MAX = 100  # API 제한: 100건 이상 요청 시 429 에러 반환
```

**코드로 명확히 표현되는 것에는 주석이 필요 없습니다.** 주석이 필요하다면 코드를 더 명확하게 리팩터링할 수 없는지 먼저 고민하세요.

## 독스트링 (Docstring)

독스트링은 모듈, 클래스, 함수 정의 바로 다음에 오는 삼중 따옴표 문자열입니다. 단순한 주석이 아니라 `__doc__` 속성으로 런타임에 접근할 수 있습니다.

![Python 주석 세 종류](/assets/posts/python-comments-types.svg)

```python
def greet(name):
    """주어진 이름으로 인사 문자열을 반환한다."""
    return f"Hello, {name}!"

# 런타임에 접근
print(greet.__doc__)      # 주어진 이름으로 인사 문자열을 반환한다.
help(greet)               # help() 에서도 표시됨
```

## 독스트링 형식

PEP 257이 독스트링 스타일을 규정합니다. 현장에서는 Google 스타일, NumPy 스타일, reStructuredText 스타일이 많이 쓰입니다.

```python
# 한 줄 독스트링 — 단순한 함수
def square(n):
    """n의 제곱을 반환한다."""
    return n ** 2

# 여러 줄 독스트링 — Google 스타일
def fetch_data(url, timeout=30):
    """URL에서 데이터를 가져온다.

    Args:
        url: 요청할 HTTP 주소
        timeout: 타임아웃 (초, 기본값 30)

    Returns:
        bytes: 응답 본문

    Raises:
        requests.Timeout: timeout 초과 시
        requests.ConnectionError: 연결 실패 시
    """
    ...
```

![Google 스타일 독스트링 예시](/assets/posts/python-comments-docstring.svg)

## 클래스와 모듈 독스트링

```python
"""
이 모듈은 사용자 인증 관련 유틸리티를 제공합니다.

Usage:
    from auth_utils import hash_password, verify_password
"""

class UserAccount:
    """사용자 계정 정보를 나타내는 클래스.

    Attributes:
        username: 고유한 사용자 이름
        email: 이메일 주소
        is_active: 계정 활성화 여부
    """

    def __init__(self, username: str, email: str):
        self.username = username
        self.email = email
        self.is_active = True
```

## 주석으로 코드 비활성화

개발 중에 임시로 코드를 비활성화할 때 주석을 씁니다.

```python
# 임시 비활성화 — 디버깅 목적
result = compute_value()
# result = legacy_compute()  # 구 버전 — 비교용

# 에디터 단축키 활용: Ctrl+/ (VS Code)
```

단, 비활성화된 코드를 오래 남겨두면 혼란을 줍니다. 더 이상 필요 없으면 삭제하고 버전 관리 시스템에서 히스토리를 확인하세요.

## type: ignore 주석

타입 검사기(mypy, pyright)가 특정 줄의 오류를 무시하도록 지시합니다.

```python
# 타입 검사기가 이 줄을 무시
result = some_dynamic_value  # type: ignore[assignment]
```

## noqa 주석

린터가 특정 규칙을 무시하도록 지시합니다.

```python
import os, sys  # noqa: E401  — 여러 모듈 한 줄 import 허용
```

## 정리

주석과 독스트링의 역할은 다릅니다. 주석은 코드 옆에서 이유를 설명하고, 독스트링은 공개 API의 계약을 문서화합니다. 좋은 코드는 주석 없이도 의도가 드러나지만, 비직관적인 결정이나 외부 제약은 주석으로 설명해야 합니다. 다음 글에서는 Python에서 들여쓰기가 단순한 스타일이 아닌 문법 그 자체인 이유를 알아봅니다.

---

**지난 글:** [Python Hello World — 첫 번째 프로그램](/posts/python-hello-world/)

**다음 글:** [Python 들여쓰기 — 문법으로서의 공백](/posts/python-indentation/)

<br>
읽어주셔서 감사합니다. 😊
