---
title: "PUT vs PATCH vs DELETE — 수정과 삭제의 정확한 의미"
description: "PUT(전체 교체)과 PATCH(부분 수정)의 차이, application/merge-patch+json 형식, DELETE의 멱등성, 각 메서드를 REST API에서 올바르게 사용하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 6
type: "knowledge"
category: "Network"
tags: ["PUT", "PATCH", "DELETE", "HTTP메서드", "전체교체", "부분수정", "멱등성", "REST"]
featured: false
draft: false
---

[지난 글](/posts/http-method-get-post/)에서 GET과 POST의 차이를 다뤘다. 이번 글에서는 **리소스 수정과 삭제**에 사용하는 PUT, PATCH, DELETE를 완전히 정리한다.

## PUT — 리소스 전체 교체

PUT은 지정한 URI에 **요청 본문의 표현을 그대로 저장**한다. 누락된 필드는 제거되거나 기본값으로 초기화된다.

![PUT vs PATCH 비교](/assets/posts/http-method-put-patch-delete-compare.svg)

```http
# 현재 상태
GET /api/users/42 → {"id":42, "name":"Alice", "age":30, "email":"alice@a.com"}

# PUT 요청 (email 미포함)
PUT /api/users/42 HTTP/1.1
Content-Type: application/json

{"name":"Bob", "age":25}

# 결과 — email 사라짐!
{"id":42, "name":"Bob", "age":25}
```

### PUT의 멱등성

같은 PUT 요청을 여러 번 보내도 결과가 동일하므로 **멱등**하다. 이 덕분에 네트워크 오류 시 안전하게 재시도할 수 있다.

```python
# PUT은 안전하게 재시도 가능
for attempt in range(3):
    resp = requests.put(
        "https://api.example.com/users/42",
        json={"name": "Bob", "age": 25, "email": "bob@b.com"}
    )
    if resp.status_code == 200:
        break
```

## PATCH — 부분 수정

PATCH는 RFC 5789(2010)에서 정의된 메서드다. PUT과 달리 **명시한 필드만 변경**한다.

```http
# 현재 상태
{"id":42, "name":"Alice", "age":30, "email":"alice@a.com"}

# PATCH 요청 (name만 변경)
PATCH /api/users/42 HTTP/1.1
Content-Type: application/merge-patch+json

{"name":"Bob"}

# 결과 — age, email 유지
{"id":42, "name":"Bob", "age":30, "email":"alice@a.com"}
```

### PATCH 미디어 타입

PATCH 요청의 본문은 **변경 내용을 표현하는 패치 문서**다. 두 가지 표준 형식이 있다.

**application/merge-patch+json (RFC 7396)** — 단순 병합

```json
{"name":"Bob", "bio": null}
```
- 값이 있으면 해당 필드를 그 값으로 교체
- 값이 `null`이면 해당 필드 삭제
- 언급 안 한 필드는 유지

**application/json-patch+json (RFC 6902)** — 명시적 연산

```json
[
  {"op": "replace", "path": "/name", "value": "Bob"},
  {"op": "remove", "path": "/bio"},
  {"op": "add", "path": "/tags/-", "value": "admin"}
]
```
- `add`, `remove`, `replace`, `move`, `copy`, `test` 연산 지원
- 배열 원소 추가/제거 등 복잡한 변경에 적합

## DELETE — 삭제

![DELETE 동작과 멱등성](/assets/posts/http-method-put-patch-delete-delete.svg)

```http
DELETE /api/users/42 HTTP/1.1
Host: api.example.com

# 성공 응답
HTTP/1.1 204 No Content
```

### 적절한 응답 코드

| 응답 코드 | 의미 | 본문 |
|-----------|------|------|
| 200 OK | 삭제 완료 + 삭제된 리소스 반환 | 있음 |
| 202 Accepted | 삭제 큐 등록 (비동기) | 선택적 |
| 204 No Content | 삭제 완료 (본문 없음) | 없음 |

REST API에서는 **204 No Content**가 가장 일반적이다.

### 소프트 삭제 (Soft Delete)

실제로 DB에서 삭제하지 않고 플래그만 바꾸는 패턴이다.

```sql
-- 하드 삭제
DELETE FROM users WHERE id = 42;

-- 소프트 삭제 (is_deleted 플래그)
UPDATE users SET deleted_at = NOW() WHERE id = 42;
```

소프트 삭제 구현 시에도 HTTP 응답은 동일하게 204를 반환한다. 클라이언트는 내부 구현을 알 필요 없다.

## 실무 가이드라인

```
리소스 전체를 교체할 때      → PUT  (모든 필드 포함 필수)
특정 필드만 업데이트할 때    → PATCH (변경 필드만 보냄)
리소스를 삭제할 때           → DELETE
```

```javascript
// PUT: 사용자 정보 전체 교체
await fetch('/api/users/42', {
  method: 'PUT',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({ name: 'Bob', age: 25, email: 'bob@b.com' })
})

// PATCH: 이름만 변경
await fetch('/api/users/42', {
  method: 'PATCH',
  headers: {'Content-Type': 'application/merge-patch+json'},
  body: JSON.stringify({ name: 'Bob' })
})

// DELETE: 사용자 삭제
await fetch('/api/users/42', { method: 'DELETE' })
```

---

**지난 글:** [GET vs POST — 언제 어떤 메서드를 써야 할까](/posts/http-method-get-post/)

**다음 글:** [HTTP 상태 코드 완전 정복 — 5개 범주 개요](/posts/http-status-codes-overview/)

<br>
읽어주셔서 감사합니다. 😊
