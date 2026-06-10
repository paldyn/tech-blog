---
title: "입력 검증과 출력 인코딩: 인젝션 공격의 근본 방어"
description: "Allowlist 기반 입력 검증, 유니코드 정규화, SQL Parameterized Query, HTML/JS/URL 컨텍스트별 출력 인코딩, DOMPurify, Pydantic 활용법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 9
type: "knowledge"
category: "Security"
tags: ["입력검증", "출력인코딩", "XSS방어", "SQLInject", "DOMPurify", "Pydantic"]
featured: false
draft: false
---

[지난 글](/posts/websec-rate-limiting/)에서 Rate Limiting 구현을 살펴봤다. 이번 글은 SQL Injection, XSS, Command Injection 같은 인젝션 공격 전반의 근본 방어인 입력 검증과 출력 인코딩을 다룬다.

![입력 검증 · 정규화 · 출력 인코딩 흐름](/assets/posts/websec-input-validation-output-encoding-flow.svg)

## 왜 두 가지 모두 필요한가

**입력 검증만**으로는 충분하지 않다. 검증을 통과한 정상 텍스트도 HTML 페이지에 그대로 출력되면 XSS가 된다. **출력 인코딩만**으로도 충분하지 않다. 데이터를 DB에 저장할 때 잘못 처리하면 Second-Order Injection이 발생한다. 두 가지를 레이어로 적용하는 것이 핵심이다.

핵심 원칙:
- **입력 검증**: Allowlist(허용 목록) 방식 — 허용된 문자/형식만 통과
- **Blocklist 방식 금지**: `<script>` 같은 패턴을 차단하는 방식은 우회 가능
- **출력 인코딩**: 컨텍스트(HTML, JS, URL, SQL)에 맞게 이스케이프

## Allowlist 기반 입력 검증

![Python/JS 검증·인코딩 코드 예시](/assets/posts/websec-input-validation-output-encoding-code.svg)

```python
# Pydantic v2로 강타입 검증
from pydantic import BaseModel, field_validator, EmailStr
from typing import Annotated
from pydantic import StringConstraints
import re, bleach

ALLOWED_HTML_TAGS = ["b", "i", "em", "strong", "a"]
ALLOWED_ATTRIBUTES = {"a": ["href"]}

class CommentInput(BaseModel):
    # 길이 제한 + 패턴 강제
    username: Annotated[str, StringConstraints(
        min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$"
    )]
    email: EmailStr
    # HTML이 허용되는 필드: 화이트리스트 sanitize
    content: str

    @field_validator("content")
    @classmethod
    def sanitize_content(cls, v: str) -> str:
        # bleach로 허용된 태그만 남기고 나머지 제거
        return bleach.clean(
            v,
            tags=ALLOWED_HTML_TAGS,
            attributes=ALLOWED_ATTRIBUTES,
            strip=True
        )

    @field_validator("username")
    @classmethod
    def no_reserved_names(cls, v: str) -> str:
        if v.lower() in {"admin", "root", "system"}:
            raise ValueError("Reserved username")
        return v
```

## 유니코드 정규화 우회 방지

```python
import unicodedata

def normalize_input(text: str) -> str:
    # NFC 정규화: 동일 의미 다른 코드포인트 통일
    # ＜ (U+FF1C 전각 부등호) → < (U+003C)는 변환 안 됨, 별도 처리 필요
    normalized = unicodedata.normalize("NFC", text)

    # 전각 문자를 반각으로 변환 (선택적)
    result = []
    for ch in normalized:
        cp = ord(ch)
        if 0xFF01 <= cp <= 0xFF5E:   # 전각 ASCII 범위
            result.append(chr(cp - 0xFEE0))
        else:
            result.append(ch)
    return "".join(result)

# 검증 전 반드시 정규화 먼저
def validate_and_store(user_input: str) -> None:
    normalized = normalize_input(user_input)
    # URL 디코딩 후 검증
    from urllib.parse import unquote
    decoded = unquote(normalized)
    # 이제 패턴 매칭
    if not re.fullmatch(r"[a-zA-Z0-9_\-\.]{1,100}", decoded):
        raise ValueError("Invalid input")
```

## SQL Parameterized Query

```python
# 취약 (문자열 포맷팅)
query = f"SELECT * FROM users WHERE name = '{username}'"

# 안전 (Parameterized Query)
# psycopg2
cursor.execute(
    "SELECT * FROM users WHERE name = %s AND active = %s",
    (username, True)
)

# SQLAlchemy ORM
from sqlalchemy import select
stmt = select(User).where(User.name == username, User.active == True)
result = session.execute(stmt).scalars().all()

# 동적 ORDER BY — 파라미터화 불가, Allowlist로 처리
ALLOWED_SORT_COLUMNS = {"name", "email", "created_at"}
def safe_order_by(column: str) -> str:
    if column not in ALLOWED_SORT_COLUMNS:
        raise ValueError(f"Invalid sort column: {column}")
    return column

# SQLAlchemy에서 동적 필터
from sqlalchemy import text
order_col = safe_order_by(user_provided_sort)
stmt = select(User).order_by(text(order_col))
```

## HTML 출력 인코딩

```python
# Jinja2 템플릿: 기본 자동 이스케이프
from jinja2 import Environment, select_autoescape

env = Environment(
    autoescape=select_autoescape(["html", "xml"])
)

# 템플릿에서 사용
# {{ user.name }}          → 자동 HTML 인코딩 (안전)
# {{ user.bio | safe }}    → 인코딩 안 함 (명시적으로 신뢰할 때만)

# Python 직접 인코딩
import html
safe_output = html.escape(user_input)   # <script> → &lt;script&gt;

# 속성값 인코딩 (따옴표 포함)
import html
attr_val = html.escape(user_input, quote=True)
```

## JavaScript 컨텍스트 인코딩

```javascript
// React: JSX 기본 자동 인코딩 (안전)
function Comment({ text }) {
  return <div>{text}</div>;  // 자동 인코딩
}

// 위험: dangerouslySetInnerHTML
// 절대 사용하지 말 것 — 반드시 sanitize 후 사용
import DOMPurify from "dompurify";
function RichText({ html }) {
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p"],
    ALLOWED_ATTR: ["href"],
    FORBID_SCRIPTS: true
  });
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}

// URL 파라미터 인코딩
const safeUrl = `/profile?name=${encodeURIComponent(userName)}`;

// JSON 데이터를 HTML에 임베드할 때
// <script> 내에 직접 포함 금지 (CSRF/XSS 위험)
// 대신 data 속성이나 API 응답으로 전달
```

## 파일명 / 경로 검증

```python
import os
from pathlib import Path

BASE_DIR = Path("/var/uploads")

def safe_path(filename: str) -> Path:
    # 1. 허용 문자만
    if not re.fullmatch(r"[a-zA-Z0-9_\-\.]+", filename):
        raise ValueError("Invalid filename")
    # 2. 확장자 Allowlist
    allowed = {".jpg", ".jpeg", ".png", ".pdf"}
    if Path(filename).suffix.lower() not in allowed:
        raise ValueError("Invalid extension")
    # 3. 경로 탈출 방지
    resolved = (BASE_DIR / filename).resolve()
    if not str(resolved).startswith(str(BASE_DIR)):
        raise ValueError("Path traversal detected")
    return resolved
```

---

**지난 글:** [Rate Limiting: API와 웹 서비스 속도 제한 구현](/posts/websec-rate-limiting/)

**다음 글:** [파일 업로드 보안: 악성 파일 업로드 방어 전략](/posts/websec-file-upload-security/)

<br>
읽어주셔서 감사합니다. 😊
