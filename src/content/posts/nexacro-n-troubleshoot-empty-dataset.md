---
title: "[Nexacro N] 트러블슈팅: Dataset이 비어 있을 때"
description: "Nexacro N에서 트랜잭션 후 Dataset이 비어 있는 문제를 진단하고 해결하는 방법을 설명합니다. errCode 확인, Dataset 이름 불일치, 서버 응답 데이터, Protocol 파싱 문제를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 7
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "트러블슈팅", "Dataset", "빈데이터", "트랜잭션", "파싱오류", "디버깅"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-troubleshoot-double-transaction/)에서 이중 트랜잭션 문제를 다루었다. 이번에는 조회 버튼을 눌러 서버에서 데이터를 가져왔는데 **Dataset이 비어 있는 문제**를 살펴본다. 콜백의 `errCode`는 0(정상)인데 Grid가 빈 상태로 표시될 때, 원인을 체계적으로 추적하는 방법이다.

## 문제 발생 지점

트랜잭션 → Dataset 바인딩 → Grid 표시의 전체 흐름에서 어느 지점에서든 데이터가 사라질 수 있다.

![Dataset 비어 있음 — 원인 진단 흐름](/assets/posts/nexacro-n-troubleshoot-empty-dataset-flow.svg)

가장 먼저 할 일은 콜백에서 `errCode`와 `dsResult.rowcount`를 즉시 출력하는 것이다.

## 디버그 코드 삽입

원인 파악을 위한 최소한의 디버그 코드를 콜백에 추가한다.

![Dataset 디버그 코드 패턴](/assets/posts/nexacro-n-troubleshoot-empty-dataset-debug.svg)

```javascript
function fn_searchCb(svcId, errCode, errMsg) {
    trace("=== fn_searchCb 진입 ===");
    trace("errCode:  " + errCode);
    trace("errMsg:   " + errMsg);
    trace("rowcount: " + dsResult.rowcount);
    trace("colcount: " + dsResult.colcount);
    trace("getXml:   " + dsResult.getXml());

    if (errCode != 0) {
        gfn_alert(errMsg);
        return;
    }
    // 정상 처리
}
```

이 정보를 보고 다음 분기를 따른다.

## 원인 1: errCode != 0 (서버 에러)

`errCode`가 0이 아니라면 서버에서 에러가 발생한 것이다. 서버 로그를 확인하거나 `errMsg`를 자세히 살펴본다.

```javascript
// errCode 분류
if (errCode == -1) {
    // 네트워크 연결 오류 → 서버 상태 확인
} else if (errCode > 0) {
    // 서버 비즈니스 에러 → errMsg 내용 확인
}
```

## 원인 2: Output Dataset 이름 불일치

`transaction()` 호출 시 `"dsOut=dsResult"` 에서 `dsResult`가 폼에 실제로 존재하는 Dataset 이름과 다를 때 발생한다.

```javascript
// 주의: dsResult와 dsResultList는 다른 이름
this.transaction(
    "search", url,
    "dsInput=dsSearch",
    "dsOut=dsResult",    // ← 이름이 정확한지 확인
    "", "fn_searchCb"
);
```

Studio에서 Dataset 이름은 Properties > id 속성에서 확인한다.

## 원인 3: 서버 응답 자체가 0건

`colcount > 0`인데 `rowcount == 0`이라면 서버가 올바르게 응답했지만 조건에 맞는 데이터가 없는 것이다. 서버 쿼리의 조건을 확인한다.

```javascript
// 빈 결과임을 사용자에게 알림
function fn_searchCb(svcId, errCode, errMsg) {
    if (errCode != 0) { gfn_alert(errMsg); return; }

    if (dsResult.rowcount == 0) {
        gfn_alert("조회된 데이터가 없습니다.");
        return;
    }
    // Grid 표시
}
```

## 원인 4: colcount == 0 (Protocol 파싱 실패)

`rowcount`와 `colcount` 모두 0이라면 Dataset 자체가 바인딩되지 않은 것이다. 서버가 응답을 보냈는데 Dataset이 비어 있다면, Protocol 응답 형식을 확인한다.

네트워크 탭에서 실제 응답 XML/JSON을 보고, 기대하는 형식인지 확인한다.

```xml
<!-- 올바른 Nexacro XML Protocol 응답 형식 -->
<?xml version="1.0" encoding="utf-8"?>
<Root xmlns="http://www.nexacroplatform.com/platform/dataset">
  <Parameters>
    <Parameter id="ErrorCode">0</Parameter>
    <Parameter id="ErrorMsg">SUCC</Parameter>
  </Parameters>
  <Dataset id="dsResult">
    <ColumnInfo>
      <Column id="userId" type="STRING" size="50"/>
      <Column id="userName" type="STRING" size="100"/>
    </ColumnInfo>
    <Rows>
      <Row>
        <Col id="userId">user01</Col>
        <Col id="userName">홍길동</Col>
      </Row>
    </Rows>
  </Dataset>
</Root>
```

`<Dataset id="dsResult">` 의 `id` 값이 transaction 호출의 출력 Dataset 이름과 반드시 일치해야 한다.

## 원인 5: 비동기 타이밍 문제

트랜잭션을 호출하고 응답이 오기 전에 `dsResult`에 접근하면 항상 비어 있다.

```javascript
// 잘못된 예 — 응답 전에 접근
function fn_search() {
    this.transaction("search", url, "", "dsOut=dsResult", "", "");
    // 여기서 바로 dsResult에 접근 — 아직 비어 있음
    trace(dsResult.rowcount); // → 0
}

// 올바른 예 — 콜백에서만 접근
function fn_search() {
    this.transaction("search", url, "", "dsOut=dsResult", "", "fn_searchCb");
}

function fn_searchCb(svcId, errCode, errMsg) {
    if (errCode != 0) return;
    trace(dsResult.rowcount); // → 실제 건수
}
```

---

**지난 글:** [트러블슈팅: 이중 트랜잭션](/posts/nexacro-n-troubleshoot-double-transaction/)

**다음 글:** [트러블슈팅: Grid 렌더링 문제](/posts/nexacro-n-troubleshoot-grid-not-render/)

<br>
읽어주셔서 감사합니다. 😊
