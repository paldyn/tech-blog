---
title: "HTTP 상태 코드 완전 정복 — 5개 범주 개요"
description: "HTTP 상태 코드 1xx·2xx·3xx·4xx·5xx의 의미와 범주별 특성, 올바른 코드 선택 기준, 알 수 없는 코드 처리 방법을 RFC 7231 기준으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-09"
archiveOrder: 7
type: "knowledge"
category: "Network"
tags: ["HTTP상태코드", "1xx", "2xx", "3xx", "4xx", "5xx", "RFC7231", "상태코드범주"]
featured: false
draft: false
---

[지난 글](/posts/http-method-put-patch-delete/)에서 PUT, PATCH, DELETE 메서드를 다뤘다. 이번 글에서는 응답 메시지의 핵심인 **HTTP 상태 코드**의 5개 범주를 정리한다.

## 상태 코드란

HTTP 상태 코드는 서버가 클라이언트의 요청을 어떻게 처리했는지 알려주는 **3자리 숫자**다. RFC 7231 §6에서 정의하며, 첫 번째 자리가 범주를 결정한다.

모르는 상태 코드를 받으면 **첫 번째 자리만 보고 범주를 파악**하면 된다. 예를 들어 299는 처음 보더라도 2xx이므로 성공이다.

![HTTP 상태 코드 5개 범주](/assets/posts/http-status-codes-overview-categories.svg)

## 5개 범주 요약

### 1xx — 정보성 (Informational)

100~199 범위. 요청을 수신했고 처리가 계속됨을 의미한다. 실무에서 자주 보이는 코드:

- **100 Continue**: 요청 본문을 계속 보내도 됨 (대용량 업로드 전 서버 확인)
- **101 Switching Protocols**: WebSocket 업그레이드 시 `Connection: Upgrade` 후 응답

### 2xx — 성공 (Successful)

200~299 범위. 요청이 성공적으로 처리됨.

| 코드 | 이름 | 주요 사용처 |
|------|------|------------|
| 200 | OK | 대부분의 성공 응답 |
| 201 | Created | POST로 리소스 생성 완료 |
| 202 | Accepted | 비동기 처리 수락 |
| 204 | No Content | DELETE 성공, 본문 없음 |
| 206 | Partial Content | Range 요청 부분 응답 |

### 3xx — 리다이렉션 (Redirection)

300~399 범위. 추가 동작이 필요함. 대부분 `Location` 헤더로 새 URL을 제공한다.

- **301**: 영구 이동 — 검색엔진이 주소 업데이트
- **302**: 임시 이동 — POST→GET 변환 문제 있음
- **304**: Not Modified — 캐시 유효, 본문 없이 캐시 사용

### 4xx — 클라이언트 오류 (Client Error)

400~499 범위. **클라이언트가 잘못 보낸 요청**. 클라이언트가 수정해야 한다.

- **400 Bad Request**: 문법 오류, 파라미터 누락
- **401 Unauthorized**: 인증 필요
- **403 Forbidden**: 인증은 됐으나 권한 없음
- **404 Not Found**: 리소스 없음
- **429 Too Many Requests**: Rate Limit 초과

### 5xx — 서버 오류 (Server Error)

500~599 범위. 요청은 올바른데 **서버가 처리에 실패**. 서버·인프라 팀이 수정해야 한다.

- **500 Internal Server Error**: 서버 내부 예외
- **502 Bad Gateway**: 프록시→업스트림 응답 불량
- **503 Service Unavailable**: 서버 과부하·점검
- **504 Gateway Timeout**: 업스트림 응답 시간 초과

## 상태 코드 선택 흐름

![상태 코드 선택 결정 트리](/assets/posts/http-status-codes-overview-flow.svg)

## 4xx vs 5xx 구분의 중요성

이 구분이 **디버깅의 출발점**이다.

```
4xx → 클라이언트 코드(요청)가 잘못됨 → 프론트엔드·API 호출 코드 검토
5xx → 서버 코드·인프라가 잘못됨   → 백엔드·DB·네트워크 검토
```

모니터링 대시보드에서 4xx와 5xx 비율을 분리해서 추적하는 이유다.

## 알 수 없는 상태 코드 처리

```javascript
function handleResponse(status) {
  const category = Math.floor(status / 100);
  switch (category) {
    case 2: return "success";
    case 3: return "redirect";
    case 4: return "client-error";
    case 5: return "server-error";
    default: return "unknown";
  }
}

// 299, 452, 599 등 처음 보는 코드도 처리 가능
handleResponse(299);  // "success"
handleResponse(452);  // "client-error"
```

## 자주 혼동하는 코드 쌍

| 혼동 쌍 | 차이 |
|---------|------|
| 401 vs 403 | 401 = 로그인 필요 / 403 = 로그인해도 접근 불가 |
| 400 vs 422 | 400 = 파싱 불가 문법 오류 / 422 = 파싱 성공 but 의미 오류 |
| 301 vs 308 | 301 = POST→GET 변환 가능 / 308 = 메서드 보존 |
| 502 vs 504 | 502 = 업스트림 잘못된 응답 / 504 = 업스트림 응답 없음(타임아웃) |

---

**지난 글:** [PUT vs PATCH vs DELETE](/posts/http-method-put-patch-delete/)

**다음 글:** [2xx 성공과 3xx 리다이렉션 상태 코드](/posts/http-status-2xx-3xx/)

<br>
읽어주셔서 감사합니다. 😊
