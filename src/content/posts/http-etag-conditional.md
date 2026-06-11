---
title: "ETag 완전 정복 — 강한·약한 검증자, 생성 전략, If-Match 낙관적 잠금"
description: "ETag의 강한·약한 검증자 차이와 비교 알고리즘, 해시·mtime 기반 생성 전략, If-Match를 이용한 갱신 분실 방지까지 ETag를 깊이 있게 해설합니다."
author: "PALDYN Team"
pubDate: "2026-06-12"
archiveOrder: 1
type: "knowledge"
category: "Network"
tags: ["ETag", "조건부요청", "IfNoneMatch", "IfMatch", "낙관적잠금", "412", "캐시검증"]
featured: false
draft: false
---

[지난 글](/posts/http-cache-freshness-validation/)에서 캐시 신선도 계산과 재검증의 큰 흐름을 봤다. 이번 글에서는 재검증의 핵심 부품인 **ETag** 자체를 깊이 파헤친다. 강한 검증자와 약한 검증자의 차이, 서버가 ETag를 만들어내는 실제 전략, 그리고 캐시를 넘어 **동시성 제어 도구**로 ETag를 활용하는 If-Match 패턴까지 다룬다.

## ETag는 불투명 토큰이다

ETag(Entity Tag)는 리소스의 **특정 버전**을 식별하는 문자열이다. 핵심 성질은 **불투명(opaque)**하다는 것 — 클라이언트는 ETag 값의 의미를 해석하지 않고, 그대로 보관했다가 그대로 돌려보낼 뿐이다.

```http
HTTP/1.1 200 OK
ETag: "33a64df551425fcc55e4d42a148795d9f25f89d4"
Content-Type: application/json
```

서버 입장에서 ETag가 지켜야 할 계약은 하나다. **리소스 내용이 바뀌면 ETag도 바뀐다.** 반대로 같은 내용이면 같은 ETag를 줘야 304 재검증과 캐시 재사용이 정확하게 동작한다.

## 강한 ETag vs 약한 ETag

ETag에는 두 등급이 있다.

```http
# 강한 ETag — 바이트 단위로 완전히 동일함을 보장
ETag: "33a64df5454d"

# 약한 ETag — W/ 접두사, 의미적으로 같음만 보장
ETag: W/"33a64df5454d"
```

**강한 ETag**는 표현(representation)이 바이트 단위로 동일할 때만 같은 값을 가진다. 그래서 부분 다운로드 이어받기(Range)나 조건부 쓰기(If-Match)처럼 바이트 정합성이 필요한 곳에 쓸 수 있다.

**약한 ETag**는 "의미상 같은 콘텐츠"임만 보장한다. 광고 배너나 생성 타임스탬프처럼 사소한 차이는 무시하고 같은 버전으로 취급하고 싶을 때 쓴다. 약한 ETag는 캐시 재검증(If-None-Match)에는 충분하지만, Range 이어받기에는 쓸 수 없다.

![강한 ETag vs 약한 ETag](/assets/posts/http-etag-conditional-strong-weak.svg)

### 비교 알고리즘

RFC 9110은 두 가지 비교 함수를 정의한다.

```
강한 비교 (strong comparison):
  두 ETag 모두 W/ 가 없고, 값이 바이트 동일해야 일치
  "abc"  vs "abc"   → 일치
  W/"abc" vs "abc"  → 불일치
  W/"abc" vs W/"abc" → 불일치 (약한 ETag끼리도 불일치)

약한 비교 (weak comparison):
  W/ 접두사를 무시하고 값만 비교
  W/"abc" vs "abc"  → 일치
  W/"abc" vs W/"abc" → 일치
```

어떤 헤더가 어떤 비교를 쓰는지가 실무에서 중요하다.

- `If-None-Match` (캐시 재검증) → **약한 비교**. 약한 ETag로도 304를 받을 수 있다.
- `If-Match`, `If-Range` (쓰기 보호·이어받기) → **강한 비교만**. 약한 ETag는 절대 일치하지 않는다.

## 서버는 ETag를 어떻게 만드나

대표적인 생성 전략 세 가지다.

```nginx
# 1) nginx 기본: 파일 mtime(16진수) + 파일 크기
#    예: ETag: "6847f1a2-1f4d"
etag on;   # 정적 파일에 기본 활성화

# 2) Apache: FileETag 지시어로 구성 요소 선택
# FileETag MTime Size
```

```js
// 3) 콘텐츠 해시 기반 (Node.js/Express의 기본 동작)
import crypto from 'node:crypto';

function makeETag(body) {
  const hash = crypto.createHash('sha1')
    .update(body)
    .digest('base64url')
    .slice(0, 27);

  return `"${body.length.toString(16)}-${hash}"`;
}
```

**mtime + size 방식**은 계산이 공짜에 가깝지만 함정이 있다. 서버가 여러 대일 때 같은 파일이라도 배포 시각(mtime)이 서버마다 다르면 **같은 콘텐츠에 서로 다른 ETag**가 나간다. 로드밸런서 뒤에서 요청이 다른 서버로 가면 캐시가 계속 미스나고 304 대신 200이 반복된다.

**콘텐츠 해시 방식**은 어느 서버에서 계산해도 같은 값이 나오므로 분산 환경에서 안전하다. 대신 응답 본문 전체를 해시해야 하므로 동적 응답에서는 CPU 비용이 든다 (본문을 어차피 생성한 뒤 해시하므로, 스트리밍 응답에는 적용하기 어렵다).

**버전 번호 방식**도 좋은 선택이다. DB 레코드에 `version` 컬럼이 있다면 `ETag: "v42"`처럼 그대로 노출하면 된다. 해시 계산 없이 정확한 ETag가 나온다.

## If-None-Match 재검증 복습

캐시 재검증 흐름은 간단하다.

```http
GET /api/products/7 HTTP/1.1
If-None-Match: "v42"

# 변경 없음 → 본문 없이 304
HTTP/1.1 304 Not Modified
ETag: "v42"
Cache-Control: max-age=60
```

`If-None-Match`에는 여러 ETag를 나열할 수도 있고, 모든 버전과 일치하는 와일드카드도 있다.

```http
# 보관 중인 여러 변형 중 하나라도 일치하면 304
If-None-Match: "v40", "v41", "v42"

# 리소스가 존재하기만 하면 일치 — 주로 If-None-Match: * 로
# "이미 존재하면 만들지 마라"는 PUT 가드에 사용
If-None-Match: *
```

`If-None-Match: *`를 PUT에 붙이면 **리소스가 이미 존재할 때 412**가 떨어진다. "최초 생성만 허용"을 HTTP 수준에서 표현하는 방법이다.

## If-Match — ETag로 동시 수정 충돌 막기

ETag의 진짜 강력한 활용은 캐시가 아니라 **낙관적 동시성 제어(Optimistic Concurrency Control)**다.

두 사용자가 같은 문서를 편집하는 상황을 보자. A와 B가 동시에 버전 "v1"을 읽고, A가 먼저 저장하고, B가 나중에 저장하면 — 아무 보호 장치가 없다면 **B의 저장이 A의 변경을 통째로 덮어쓴다.** 이것이 갱신 분실(Lost Update) 문제다.

`If-Match`는 "내가 읽었던 그 버전일 때만 수정을 적용하라"는 전제조건이다.

![If-Match로 막는 갱신 분실](/assets/posts/http-etag-conditional-if-match.svg)

```http
# B의 저장 시도 — 서버의 현재 ETag는 이미 "v2"
PUT /doc/42 HTTP/1.1
If-Match: "v1"
Content-Type: application/json

{"title": "B의 수정안"}

# 강한 비교에서 "v1" ≠ "v2" → 거부
HTTP/1.1 412 Precondition Failed
```

412를 받은 클라이언트는 최신 버전을 다시 GET해서 충돌을 확인하고, 변경 사항을 병합한 뒤 새 ETag로 재시도해야 한다. DB의 `SELECT ... FOR UPDATE` 같은 비관적 잠금 없이, 순수 HTTP 헤더만으로 동시성을 제어하는 것이다.

서버 측 구현은 이렇게 단순하다.

```python
# FastAPI 예시 — If-Match 기반 낙관적 잠금
from fastapi import FastAPI, Header, HTTPException, Response

app = FastAPI()

@app.put("/doc/{doc_id}")
def update_doc(doc_id: int, body: dict,
               if_match: str | None = Header(default=None)):
    doc = db.get(doc_id)

    if if_match is None:
        # 전제조건 없는 무조건 덮어쓰기를 막고 싶다면 428
        raise HTTPException(428, "If-Match header required")

    if if_match.strip() != f'"{doc.version}"':
        raise HTTPException(412, "Precondition Failed")

    doc.update(body)          # version도 +1 증가
    return Response(headers={"ETag": f'"{doc.version}"'})
```

`428 Precondition Required`는 "조건부 헤더 없이는 이 작업을 받지 않겠다"는 상태 코드로, 클라이언트가 If-Match를 빼먹고 무조건 덮어쓰는 사고를 방지한다.

## 실무 함정: 압축과 ETag

같은 리소스라도 `Content-Encoding: gzip`이 적용된 표현과 원본 표현은 **바이트가 다르므로 강한 ETag도 달라야 한다.** 이 규칙 때문에 생기는 유명한 동작이 있다.

```nginx
# nginx는 동적 gzip 압축 시 강한 ETag를 약한 ETag로 강등한다
# 원본:    ETag: "6847f1a2-1f4d"
# gzip 후: ETag: W/"6847f1a2-1f4d"
gzip on;
```

압축된 바이트열에 대해 원본 기준 강한 ETag를 그대로 내보내면 거짓말이 되므로, nginx는 정직하게 `W/`를 붙인다. 문제는 일부 프록시·CDN 설정이 약한 ETag를 제거하거나, If-Range처럼 강한 비교가 필요한 기능이 동작하지 않게 된다는 점이다. 캐시 미스가 늘었다면 중간 장비가 ETag를 건드리고 있지 않은지 확인하라.

```bash
# ETag가 실제로 어떻게 나가는지 확인
curl -sI https://example.com/app.js | grep -i etag
# etag: W/"6847f1a2-1f4d"   ← gzip 강등 확인

# 조건부 요청으로 304 동작 검증
curl -sI -H 'If-None-Match: W/"6847f1a2-1f4d"' \
  https://example.com/app.js | head -1
# HTTP/1.1 304 Not Modified
```

## 정리

```
용도               | 헤더            | 비교 방식 | 실패 시
──────────────────────────────────────────────────────
캐시 재검증        | If-None-Match  | 약한 비교 | 200 (새 본문)
중복 생성 방지     | If-None-Match: * | 존재 여부 | 412
갱신 분실 방지     | If-Match       | 강한 비교 | 412
이어받기 보호      | If-Range       | 강한 비교 | 200 (전체 재전송)
```

ETag는 "캐시 최적화 헤더"로만 알려져 있지만, 실제로는 **리소스 버전 관리 프로토콜**이다. 다음 글에서는 If-Match·If-Unmodified-Since·If-Range를 포함한 조건부 요청 헤더 전체의 평가 순서와 상호작용을 깊이 있게 정리한다.

---

**지난 글:** [캐시 신선도와 재검증 완전 정복 — max-age, Age, stale-while-revalidate](/posts/http-cache-freshness-validation/)

**다음 글:** [조건부 요청 심화 — If-Match, If-Unmodified-Since, If-Range와 평가 순서](/posts/http-conditional-requests-deep/)

<br>
읽어주셔서 감사합니다. 😊
