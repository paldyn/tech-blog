---
title: "[Nexacro N] 네트워크 트레이스 분석"
description: "Nexacro N의 Transaction 요청·응답을 브라우저 DevTools로 분석하는 방법을 설명합니다. Request Payload 확인, 응답 XML 파싱, TTFB 분석, 타임아웃 처리 패턴을 실무 기준으로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 7
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "네트워크트레이스", "DevTools", "디버깅", "Transaction", "타임아웃"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-trace-logging/)에서 `trace()` 기반 로깅 전략을 살펴보았다. 클라이언트 로그만으로는 원인을 파악할 수 없는 문제가 있다. "조회 결과가 왜 비는가", "파라미터가 서버에 제대로 전달됐는가", "응답이 느린 이유가 서버인가 네트워크인가" — 이 질문들에 답하려면 네트워크 레벨에서 Transaction을 직접 들여다봐야 한다. 브라우저 DevTools의 Network 탭이 그 도구다.

## Transaction의 네트워크 실체

Nexacro N의 `this.transaction()`은 HTTP POST 요청을 보낸다. 요청 본문에는 Nexacro Protocol(PL) 형식의 XML이 포함되며, 응답도 동일한 XML 형식으로 돌아온다. DevTools의 Network 탭에서 이 요청을 캡처해 내용을 확인할 수 있다.

![네트워크 트레이스 분석 흐름](/assets/posts/nexacro-n-network-trace-flow.svg)

## DevTools Network 탭 설정

1. 브라우저에서 F12를 눌러 개발자 도구를 연다
2. Network 탭을 선택한다
3. 필터 입력창에 서비스 URL 패턴을 입력한다 (예: `.do`, `svc/`, `api/`)
4. Nexacro N 화면에서 조회 버튼을 누르면 요청이 목록에 나타난다

요청 항목을 클릭하면 다음 탭에서 상세 정보를 확인할 수 있다.

## Request Headers 확인

헤더에서 세션 토큰, Content-Type, 인증 정보가 제대로 전송되는지 확인한다.

```
POST /api/selectList.do HTTP/1.1
Content-Type: application/x-www-form-urlencoded
Cookie: JSESSIONID=abcdef123456
X-Auth-Token: Bearer eyJhbGci...
```

Content-Type이 `application/x-www-form-urlencoded`인지 확인한다. Nexacro Protocol을 사용하는 경우 기본값이다. REST API 방식이라면 `application/json`이어야 한다.

## Request Payload 분석

Payload(Form Data) 탭에서 서버로 전송된 Dataset XML을 확인한다. `dsSearch`의 내용이 예상과 다르면 파라미터 세팅 코드를 점검한다.

```xml
<!-- Request Payload 예시 (Nexacro Protocol) -->
<PlatformData version="1.0">
  <Parameters>
    <Parameter id="SVC_ID">selectUserList</Parameter>
    <Parameter id="PAGE_NO">1</Parameter>
  </Parameters>
  <DatasetList>
    <Dataset id="dsSearch">
      <ColumnInfo>
        <Column id="DEPT_CD" type="STRING"/>
        <Column id="KEYWORD" type="STRING"/>
      </ColumnInfo>
      <Rows>
        <Row>
          <Col id="DEPT_CD">001</Col>
          <Col id="KEYWORD">홍길동</Col>
        </Row>
      </Rows>
    </Dataset>
  </DatasetList>
</PlatformData>
```

여기서 `DEPT_CD="001"`, `KEYWORD="홍길동"`이 실제로 전송됐는지 확인한다. 값이 비어있거나 다르면 `dsSearch.setColumn()` 코드를 점검한다.

## Response 분석

Response 탭(또는 Preview 탭)에서 서버 응답 XML을 확인한다.

```xml
<!-- Response 예시 -->
<PlatformData version="1.0">
  <Parameters>
    <Parameter id="ErrorCode">0</Parameter>
    <Parameter id="ErrorMsg">OK</Parameter>
  </Parameters>
  <DatasetList>
    <Dataset id="dsList">
      <ColumnInfo>
        <Column id="USER_ID" type="STRING"/>
        <Column id="USER_NM" type="STRING"/>
      </ColumnInfo>
      <Rows>
        <Row>
          <Col id="USER_ID">U001</Col>
          <Col id="USER_NM">홍길동</Col>
        </Row>
      </Rows>
    </Dataset>
  </DatasetList>
</PlatformData>
```

`ErrorCode`가 0이면 정상이다. 0이 아닌 경우 `ErrorMsg`에서 서버 오류 메시지를 확인한다. Dataset의 컬럼 이름이 클라이언트의 Dataset 컬럼과 일치하는지도 확인한다. 불일치 시 바인딩이 되지 않는다.

## Timing 분석으로 병목 파악

Network 탭의 Timing 탭에서 요청 단계별 소요 시간을 확인한다.

| 항목 | 의미 | 병목 시 원인 |
|---|---|---|
| Queueing | 요청 큐 대기 | 동시 요청 과다 |
| Stalled | 연결 수립 대기 | TCP 연결 풀 부족 |
| TTFB | 서버 첫 바이트 수신까지 | 서버 처리 지연 |
| Content Download | 본문 다운로드 | 응답 데이터 크기 과다 |

TTFB가 길면 서버 쿼리나 비즈니스 로직이 느린 것이다. Content Download가 길면 응답 데이터가 너무 크다는 신호다. 이 경우 Dataset 컬럼 수나 행 수를 줄이는 것이 효과적이다.

## Transaction 타임아웃 처리

![Transaction 타임아웃 및 재시도 패턴](/assets/posts/nexacro-n-network-trace-code.svg)

Nexacro N의 Transaction은 기본 타임아웃이 설정되어 있지만, 특정 화면에서 더 짧거나 긴 타임아웃이 필요할 때 `setTimeout`으로 클라이언트 타임아웃을 직접 구현한다.

```javascript
var nTimerId = -1;

function fnSearch() {
    // 기존 타임아웃 취소
    if (nTimerId != -1) { clearTimeout(nTimerId); }

    // 로딩 상태 표시
    this.divLoading.set_visible(true);
    this.btnSearch.set_enable(false);

    // 10초 타임아웃 설정
    nTimerId = setTimeout(this.id + ".fnSearchTimeout()", 10000);

    this.transaction("LIST", svcUrl, args, output, "", "cbSearch");
}

function cbSearch(sId, nErrorCode, sErrorMsg) {
    // 타임아웃 타이머 해제
    if (nTimerId != -1) { clearTimeout(nTimerId); nTimerId = -1; }

    this.divLoading.set_visible(false);
    this.btnSearch.set_enable(true);

    if (nErrorCode != 0) {
        alert("조회 실패: " + sErrorMsg);
        return;
    }
}

function fnSearchTimeout() {
    nTimerId = -1;
    this.divLoading.set_visible(false);
    this.btnSearch.set_enable(true);
    alert("서버 응답 시간이 초과됐습니다. 잠시 후 다시 시도해 주세요.");
}

function form_onunload(obj, e) {
    if (nTimerId != -1) { clearTimeout(nTimerId); nTimerId = -1; }
}
```

## CORS 오류 확인

동일 출처 정책(SOP)으로 인한 CORS 오류는 DevTools Console 탭에서 확인할 수 있다.

```
Access to XMLHttpRequest at 'https://api.example.com/svc/list.do'
from origin 'https://app.example.com' has been blocked by CORS policy
```

이 오류는 서버에서 `Access-Control-Allow-Origin` 헤더를 올바르게 설정해야 해결된다. 클라이언트 코드에서는 해결할 수 없다.

## Nexacro Studio의 서비스 트레이스

DevTools 외에 Nexacro Studio의 서비스 트레이스 기능도 활용할 수 있다. Studio 실행 중 Tools > Trace 메뉴에서 Transaction 요청·응답 로그를 확인할 수 있다. DevTools보다 Nexacro 프로토콜 형식으로 파싱된 결과를 보여주어 Dataset 내용을 더 편리하게 볼 수 있다.

## 흔한 문제와 확인 방법

| 증상 | 확인할 곳 | 원인 |
|---|---|---|
| Dataset이 비어있음 | Response XML | 서버에서 데이터 없음, 컬럼명 불일치 |
| 파라미터가 안 넘어감 | Request Payload | setColumn 누락, dsSearch 행 없음 |
| 서버 오류 발생 | Response ErrorCode | 쿼리 오류, 권한 없음 |
| 조회가 너무 느림 | Timing > TTFB | 서버 쿼리 최적화 필요 |
| 응답이 큼 | Timing > Content Download | Dataset 컬럼·행 수 축소 필요 |

## 정리

Nexacro N의 Transaction 문제는 대부분 네트워크 레벨에서 확인하면 원인이 명확해진다. Request Payload에서 파라미터가 제대로 전달됐는지, Response에서 서버가 올바른 데이터를 돌려보냈는지, Timing에서 어느 구간이 느린지를 순서대로 확인하는 것이 가장 빠른 진단 방법이다. DevTools를 열고 요청을 직접 들여다보는 습관을 들이면 디버깅 시간을 크게 줄일 수 있다.

---

**지난 글:** [\[Nexacro N\] trace() 로깅 활용 가이드](/posts/nexacro-n-trace-logging/)

**다음 글:** [\[Nexacro N\] Studio 디버그 모드 활용](/posts/nexacro-n-studio-debug-mode/)

<br>
읽어주셔서 감사합니다. 😊
