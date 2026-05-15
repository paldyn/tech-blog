---
title: "[Nexacro N] 트랜잭션 캐시 비활성화 전략"
description: "Nexacro N에서 HTTP 캐시로 인한 오래된 데이터 문제를 해결하는 타임스탬프 파라미터 패턴, HTTP 헤더 설정, 서버 측 캐시 제어 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "cache", "no-cache", "트랜잭션", "HTTP헤더", "캐시비활성화"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-file-transaction/)에서 파일 트랜잭션 처리를 다뤘다. 이번에는 일반 데이터 조회 트랜잭션에서 발생하는 HTTP 캐시 문제와 그 해결 전략을 살펴본다. 특히 IE 기반에서 Chrome 계열 브라우저로 마이그레이션한 직후 체감되는 "조회해도 이전 데이터가 보인다" 증상의 원인과 대처법을 정리한다.

## 문제의 원인

Nexacro N은 HTML5 런타임에서 `XMLHttpRequest`(또는 `fetch`)로 서버와 통신한다. GET 방식 요청 URL이 동일하면 브라우저는 이전 응답을 캐시에서 그대로 반환한다. 데이터베이스는 업데이트됐어도 화면에는 예전 값이 남아 있는 것이다.

아래 다이어그램이 두 경우의 차이를 보여준다.

![캐시 활성화 vs 비활성화 비교](/assets/posts/nexacro-n-cache-disable-comparison.svg)

POST 방식을 강제하면 캐시 자체가 적용되지 않지만, 기존 시스템이 GET을 사용하는 경우 URL을 고유하게 만들어 캐시 키를 바꾸는 것이 가장 간단한 대안이다.

## 타임스탬프 패턴 (권장)

`transaction()`의 `args` 파라미터에 타임스탬프를 쿼리 스트링으로 추가한다. URL이 매번 달라지므로 브라우저 캐시가 적용되지 않는다.

![캐시 무력화 코드 예시](/assets/posts/nexacro-n-cache-disable-code.svg)

```javascript
// 공통 라이브러리에 정의
function fn_nocache() {
  return "_t=" + (new Date()).getTime();
}

// 조회 함수에서 사용
function fn_search() {
  this.transaction(
    "ListSvc::getList.do",
    "ds_cond:input",
    "ds_list:output",
    fn_nocache(),   // args에 _t=타임스탬프
    "",
    "fn_searchCb"
  );
}
```

`fn_nocache()`를 공통 라이브러리(`gfn_nocache` 등)로 등록해 모든 조회 트랜잭션에서 재사용하면 일관성을 유지할 수 있다.

## HTTP 헤더 방식

`setHttpHeader()`로 `Cache-Control` 헤더를 설정하면 브라우저 및 프록시 캐시를 모두 제어할 수 있다.

```javascript
function fn_init() {
  // 세션 시작 시 전역 헤더 설정
  this.setHttpHeader("Cache-Control", "no-cache, no-store");
  this.setHttpHeader("Pragma", "no-cache");
}
```

단, 일부 CDN이나 리버스 프록시는 `Cache-Control: no-store`를 우선하므로 서버 응답 헤더와의 충돌 여부를 확인해야 한다.

## TypeDefinition cacheType 속성

서비스 단위로 캐시를 제어할 때는 TypeDefinition XML의 `cacheType` 속성을 사용한다.

```xml
<!-- TypeDefinition.xadl -->
<TypeDefinition>
  <Services>
    <!-- cacheType="0": 캐시 사용 안 함 -->
    <Service id="ListSvc"
             url="%ServiceURL%/list"
             cacheType="0"/>
    <!-- cacheType="1": 캐시 사용 (기본) -->
    <Service id="StaticSvc"
             url="%ServiceURL%/static"
             cacheType="1"/>
  </Services>
</TypeDefinition>
```

`cacheType="0"` 서비스는 모든 요청에서 캐시를 건너뛴다. 코드 변경 없이 설정 파일만으로 제어할 수 있어 배포 환경별 분리에 유용하다.

## 서버 측 응답 헤더 설정

클라이언트에서 아무리 캐시를 끄더라도 서버가 `Cache-Control: max-age=3600` 같은 헤더를 보내면 일부 프록시가 캐시할 수 있다. 조회 API에는 서버에서도 명시적으로 캐시를 금지한다.

```java
// Spring Boot 필터 예시
response.setHeader("Cache-Control",
    "no-cache, no-store, must-revalidate");
response.setHeader("Pragma", "no-cache");
response.setDateHeader("Expires", 0);
```

Spring Security를 사용하는 경우 `http.headers().cacheControl()`이 기본 활성화되어 있으므로 별도 설정 없이도 캐시가 비활성화된다.

## 정적 리소스는 캐시 활용

캐시 비활성화를 무조건 전역에 적용하면 스크립트·이미지 같은 정적 리소스까지 매번 재다운로드해 성능이 저하된다. 동적 데이터 API(`/api/**`, `/nexacro/**`)에만 `no-cache`를 적용하고, 정적 파일(`/static/**`, `/assets/**`)에는 적절한 `max-age`를 유지하는 것이 바람직하다.

## 요약

| 방법 | 적용 범위 | 비고 |
|------|----------|------|
| 타임스탬프 args | 개별 트랜잭션 | 코드 변경 필요, 가장 확실 |
| setHttpHeader | 폼/세션 단위 | 모든 요청에 일괄 적용 |
| cacheType="0" | 서비스 단위 | 설정 파일만 수정 |
| 서버 응답 헤더 | 프록시·CDN 포함 | 가장 광범위한 제어 |

---

**지난 글:** [파일 트랜잭션: fileupload()와 filedownload()](/posts/nexacro-n-file-transaction/)

**다음 글:** [WebSocket으로 실시간 서버 연동](/posts/nexacro-n-websocket/)

<br>
읽어주셔서 감사합니다. 😊
