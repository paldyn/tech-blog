---
title: "[Nexacro N] Nexacro 프로토콜 PL"
description: "Nexacro N이 서버와 통신할 때 사용하는 PL(Protocol Layer) 프로토콜의 구조와 동작 원리를 설명합니다. 요청/응답 패킷 구성, DataSet 직렬화 방식, RowType 인코딩, 디버깅 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 8
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "PL프로토콜", "ProtocolLayer", "DataSet직렬화", "트랜잭션", "네트워크"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-soap-rest/)에서 외부 SOAP·REST 서비스 연동 방법을 살펴보았다. 이번에는 Nexacro N이 서버와 통신할 때 사용하는 PL(Protocol Layer) 프로토콜을 깊이 이해한다.

PL은 Nexacro N의 고유 통신 포맷이다. `transaction()`을 호출하면 런타임이 Dataset과 Variable을 PL로 직렬화해 HTTP POST 본문에 담아 서버로 전송한다. 어댑터가 이를 파싱해 Java/JavaScript 객체로 변환하는 과정이 자동으로 이루어진다. 이 메커니즘을 이해하면 네트워크 트레이싱, 오류 디버깅, 어댑터 커스터마이징이 훨씬 쉬워진다.

## PL 패킷 구조

![PL 패킷 구조](/assets/posts/nexacro-n-protocol-pl-structure.svg)

PL 패킷은 요청과 응답 모두 동일한 구조를 따른다. 헤더, Variable 블록, DataSet 블록의 세 부분으로 구성된다.

**헤더**에는 프로토콜 버전, 인코딩(UTF-8), 트랜잭션 ID, 서비스 ID가 포함된다. 서비스 ID는 `SVC::ServiceClass::methodName` 형식으로, 어댑터가 이를 파싱해 서비스 빈을 찾는다.

**Variable 블록**은 `key=value` 쌍의 목록이다. 세션 ID, 페이지 번호 등 DataSet에 넣기 애매한 단일 값을 전달하는 데 사용한다. 응답 패킷에서는 `errCode`, `errMsg`, `TOTAL_CNT` 등 처리 결과 메타데이터가 Variable로 반환된다.

**DataSet 블록**은 컬럼 정의와 행 데이터로 구성된다. 여러 DataSet을 하나의 패킷에 담을 수 있다.

## PL 포맷 예시

![PL 텍스트 포맷 예시](/assets/posts/nexacro-n-protocol-pl-packet.svg)

실제 PL 바이트 스트림은 이진 형식이지만, 개념적으로는 다음과 같은 텍스트 구조다.

행 데이터의 RowType은 첫 번째 필드로 인코딩된다. `N`은 Normal(조회 결과), `I`는 Inserted, `U`는 Updated, `D`는 Deleted다. 서버는 이 값을 보고 해당 행에 INSERT/UPDATE/DELETE를 수행한다.

## PL의 Content-Type

Nexacro N의 HTTP 요청은 다음 헤더를 사용한다.

```
POST /nexacro/svc HTTP/1.1
Content-Type: application/x-www-form-urlencoded; charset=UTF-8
```

어댑터가 이 요청을 받아 `body` 파라미터에서 PL 스트림을 추출한다. REST API의 JSON 본문과 다르게 URL 인코딩된 form 데이터로 전송된다.

## RowType 인코딩 이해

RowType의 정수값은 다음과 같다.

```java
DataSet.ROW_TYPE_NORMAL   = 1  // N
DataSet.ROW_TYPE_INSERTED = 2  // I
DataSet.ROW_TYPE_UPDATED  = 4  // U
DataSet.ROW_TYPE_DELETED  = 8  // D
```

클라이언트에서 Dataset의 행을 수정하면 해당 행의 RowType이 자동으로 변경된다. `ds.addRow()`는 `INSERTED`, `ds.setColumn()`은 `UPDATED`, `ds.deleteRow()`는 `DELETED`로 설정된다. 이 정보가 PL로 직렬화되어 서버에 전달되므로, 서버는 어떤 행을 어떻게 처리해야 하는지 알 수 있다.

## 커스텀 헤더 추가

HTTP 헤더에 인증 토큰이나 추적 ID를 추가해야 할 때는 `transaction()` 여섯 번째 인자 이전에 헤더 문자열을 설정한다.

```nexacro
// 공통 서비스 함수에서 트랜잭션 헤더 설정
function fn_transaction(svcId, inDs, outDs, callback) {
    var sHeaders = "X-Session-Token=" + gv_sessionToken
                 + "&X-Request-Id=" + fn_generateUUID();

    this.transaction(
        "tx_" + svcId,          // callback ID
        "SVC::" + svcId,        // service ID
        inDs,                   // input datasets
        outDs,                  // output datasets
        sHeaders,               // 추가 헤더
        callback
    );
}
```

서버에서는 `HttpServletRequest.getHeader("X-Session-Token")`으로 읽거나, 어댑터 인터셉터에서 공통 처리한다.

## PL 트레이싱 (디버깅)

Nexacro N Studio의 **Tools → Trace** 메뉴나 크롬 개발자 도구 Network 탭에서 PL 패킷을 확인할 수 있다.

```
// 어댑터 서버 사이드 디버그 로그 (application.yml)
nexacro:
  debug: true   # PL 파싱 로그 출력
  log-level: DEBUG
```

`debug: true`를 설정하면 어댑터가 수신한 PL 스트림과 파싱된 DataSet 내용을 로그로 출력한다. 요청/응답 데이터가 의도한 대로 전달되는지 확인할 때 유용하다.

## 오류 응답 PL 구조

서버에서 오류가 발생하면 응답 PL의 헤더에 `ErrorCode`와 `ErrorMsg`가 설정된다.

```
NexacroProtocol
ErrorCode=-1
ErrorMsg=DB 연결 오류
```

클라이언트 콜백에서 `errCode`가 0이 아니면 오류다. `errCode`가 `-1`이면 어댑터 내부 오류, `0`이 아닌 서비스 정의 코드라면 비즈니스 로직 오류다. 프로젝트에서 `errCode` 규칙(0=성공, 음수=시스템 오류, 양수=비즈니스 오류)을 정의해 전 팀이 일관되게 사용하면 오류 처리 코드가 단순해진다.

---

**지난 글:** [SOAP과 REST 연동](/posts/nexacro-n-soap-rest/)

**다음 글:** [MVP·MVC 아키텍처 적용](/posts/nexacro-n-mvp-mvc/)

<br>
읽어주셔서 감사합니다. 😊
