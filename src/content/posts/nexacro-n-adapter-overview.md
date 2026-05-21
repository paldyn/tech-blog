---
title: "[Nexacro N] 어댑터 개요"
description: "Nexacro N과 백엔드 서버를 연결하는 어댑터의 역할과 종류를 소개합니다. PL 프로토콜 파싱, Dataset 변환, 서비스 메서드 호출 구조를 설명하고 Java·Node.js·.NET 어댑터의 차이를 비교합니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "어댑터", "PL프로토콜", "백엔드연동", "Java어댑터", "트랜잭션"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-ie-to-modern/)에서 IE 전용 코드를 모던 브라우저 표준으로 전환하는 방법을 다루었다. 이번에는 Nexacro N 프론트엔드와 백엔드를 연결하는 핵심 인프라인 **어댑터(Adapter)**를 살펴본다.

Nexacro N의 `transaction()` 호출이 서버에 도달했을 때, 그 요청을 받아 비즈니스 로직과 연결해 주는 컴포넌트가 어댑터다. 일반적인 REST API 컨트롤러와 달리 어댑터는 Nexacro 고유의 PL(Protocol Layer) 형식으로 인코딩된 데이터를 파싱하고, Dataset 객체를 생성하며, 서비스 메서드에 전달하는 역할을 담당한다.

## 어댑터의 역할

![Nexacro N 어댑터 아키텍처](/assets/posts/nexacro-n-adapter-overview-arch.svg)

어댑터는 세 가지 역할을 수행한다.

**PL 파싱**: 클라이언트가 `transaction()`을 호출하면 Nexacro N 런타임이 Dataset과 Variable을 PL 형식으로 직렬화해 HTTP 요청 본문에 담아 서버로 전송한다. 어댑터는 이 바이너리/텍스트 스트림을 파싱해 Dataset 객체로 변환한다.

**서비스 라우팅**: 요청에 포함된 서비스 ID(`SVC::MethodName` 형식)를 파싱해 해당 서비스 클래스와 메서드를 찾아 호출한다. Spring의 `@RequestMapping`과 유사한 역할이지만 Nexacro 전용 규칙을 따른다.

**응답 직렬화**: 서비스 메서드 실행 결과(결과 Dataset, 오류 코드, 오류 메시지 등)를 다시 PL 형식으로 직렬화해 클라이언트에 반환한다. 클라이언트는 수신한 PL 스트림을 Dataset으로 복원한다.

## 트랜잭션 처리 흐름

![트랜잭션 요청 처리 흐름](/assets/posts/nexacro-n-adapter-overview-flow.svg)

전체 흐름을 요약하면 다음과 같다.

```
클라이언트 transaction()
  → PL 직렬화
    → HTTP POST 전송
      → 어댑터 PL 파싱 → Dataset/Variable 생성
        → 서비스 메서드 호출(인 Dataset, 아웃 Dataset)
          → DB 쿼리 실행
        → 아웃 Dataset에 결과 채움
      → 어댑터 PL 직렬화 → HTTP 응답
    → 클라이언트 수신
  → 콜백 함수 실행
```

어댑터가 제공하는 서비스 메서드 시그니처는 고정된 패턴을 따른다.

```java
// Java 어댑터 서비스 메서드 패턴
public void search(
    DataSet dsSearch,    // 입력 Dataset
    DataSet dsResult,    // 출력 Dataset
    VariableList vl      // 변수 목록
) throws NexaServiceException {
    // 비즈니스 로직 구현
}
```

클라이언트에서는 이 메서드를 다음과 같이 호출한다.

```nexacro
this.transaction(
    "search",                           // 콜백 ID
    "SVC::UserService::search",         // 서버 서비스::메서드
    "in:dsSearch",                      // 입력 Dataset
    "out:dsResult",                     // 출력 Dataset
    "",                                 // 변수
    "fn_callback"                       // 콜백 함수명
);
```

## 어댑터 종류 비교

Nexacro N이 공식 지원하는 어댑터는 세 종류다.

| 어댑터 | 기반 기술 | 주요 특징 |
|---|---|---|
| Java 어댑터 | Spring MVC / Servlet | 국내 기업 시스템에서 가장 많이 사용 |
| Node.js 어댑터 | Express / Fastify | 경량 API 서버, JavaScript 풀스택 |
| .NET 어댑터 | ASP.NET Core | 금융·공공 .NET 환경 |

Java 어댑터가 압도적으로 많이 쓰인다. Spring Boot 기반 프로젝트에서 의존성 하나만 추가하면 어댑터 기능이 활성화되는 구조다.

## 어댑터 없이 REST API 직접 호출 비교

어댑터를 사용하지 않고 순수 REST API로 연동하는 방법도 있다. `WebService` 컴포넌트나 JavaScript의 `fetch`를 사용하는 방식이다.

```nexacro
// REST API 직접 호출 (어댑터 없이)
nexacro.http.request({
    url: "/api/users",
    method: "GET",
    oncomplete: function(e) {
        var oData = JSON.parse(e.responsetext);
        // Dataset에 수동으로 데이터 채우기 필요
        for (var i = 0; i < oData.length; i++) {
            dsResult.addRow();
            dsResult.setColumn(i, "userId", oData[i].userId);
        }
    }
});
```

어댑터 방식에 비해 Dataset 바인딩이 자동으로 이루어지지 않아 코드량이 늘어난다. 대규모 엔터프라이즈 프로젝트라면 어댑터 방식이 생산성과 일관성 측면에서 유리하다. 신규 경량 API 연동이나 외부 서비스 호출에는 REST 직접 호출이 적합하다.

## 어댑터 선택 기준

기존 Spring 생태계가 있다면 Java 어댑터를 선택한다. Node.js로 BFF(Backend for Frontend) 레이어를 구성하는 구조라면 Node.js 어댑터가 자연스럽다. 하이브리드 환경(일부 서비스는 Spring, 일부는 외부 REST)이라면 Java 어댑터를 주로 쓰되 외부 호출은 서비스 레이어에서 `RestTemplate`이나 `WebClient`로 처리한다.

---

**지난 글:** [IE에서 모던 브라우저로 전환](/posts/nexacro-n-ie-to-modern/)

**다음 글:** [Spring Boot 연동](/posts/nexacro-n-spring-boot/)

<br>
읽어주셔서 감사합니다. 😊
