---
title: "[Nexacro N] Dataset loadXml로 클라이언트 데이터 초기화하기"
description: "Nexacro N Dataset의 loadXml과 saveXml API를 소개하고, 콤보 초기값 설정·임시저장·테스트 데이터 주입 등 실전 활용 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "dataset", "loadXml", "saveXml", "dataset-xml"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-dataset-find-functions/)에서 Dataset 탐색 함수를 살펴봤습니다. 이번에는 XML 문자열을 Dataset으로 직접 로드하는 `loadXml()` API를 다룹니다. 서버 호출 없이 클라이언트 단에서 Dataset 데이터를 초기화하거나, `saveXml()`과 짝을 이뤄 임시저장 기능을 구현할 때 핵심적인 API입니다.

## loadXml이란

`loadXml(xmlStr)` 는 Nexacro 고유 XML 포맷 문자열을 Dataset으로 파싱합니다. 파싱이 완료되면 기존 데이터는 사라지고 XML의 내용으로 Dataset이 완전히 재구성됩니다. 로드된 모든 행의 rowType은 `NORMAL(1)`이므로, 이후 `transaction()`을 호출해도 해당 행들은 서버로 전송되지 않습니다.

![loadXml 데이터 로드 흐름](/assets/posts/nexacro-n-dataset-loadxml-flow.svg)

## XML 구조

`loadXml()`에 전달하는 XML은 `<Dataset>` 루트 태그, `<ColumnInfo>`, `<Rows>`로 구성됩니다.

```xml
<Dataset id="dsCombo">
  <ColumnInfo>
    <Column id="CODE" type="STRING" size="10"/>
    <Column id="NAME" type="STRING" size="50"/>
  </ColumnInfo>
  <Rows>
    <Row CODE="A01" NAME="사과"/>
    <Row CODE="A02" NAME="배"/>
    <Row CODE="A03" NAME="포도"/>
  </Rows>
</Dataset>
```

`id` 속성은 Dataset 자체의 ID와 같지 않아도 동작하지만, 일치시키는 것이 관행입니다. 컬럼 타입은 `STRING`, `INT`, `FLOAT`, `DATE`를 지원합니다.

## 기본 사용 예

```javascript
function fn_initComboCode() {
    var xmlStr = ""
        + "<Dataset id='dsCode'>"
        + "  <ColumnInfo>"
        + "    <Column id='CODE' type='STRING' size='10'/>"
        + "    <Column id='NAME' type='STRING' size='50'/>"
        + "  </ColumnInfo>"
        + "  <Rows>"
        + "    <Row CODE='10' NAME='신규'/>"
        + "    <Row CODE='20' NAME='진행중'/>"
        + "    <Row CODE='30' NAME='완료'/>"
        + "  </Rows>"
        + "</Dataset>";
    this.dsStatus.loadXml(xmlStr);
}
```

`loadXml()`은 동기적으로 실행됩니다. 호출이 끝나면 즉시 Dataset에 데이터가 채워지고, 바인딩된 콤보나 그리드도 즉시 갱신됩니다.

## saveXml — Dataset을 XML 문자열로 직렬화

`saveXml()`은 현재 Dataset의 모든 행(rowType 무관)을 XML 문자열로 반환합니다. `loadXml()`과 짝을 이뤄 임시저장·복원 패턴에 사용합니다.

![loadXml 주요 활용 시나리오](/assets/posts/nexacro-n-dataset-loadxml-usecases.svg)

```javascript
// 임시저장
function fn_saveDraft() {
    var xmlStr = this.dsMain.saveXml();
    nexacro.setLocalStorage("orderDraft", xmlStr);
    alert("임시저장 완료");
}

// 복원
function fn_loadDraft() {
    var saved = nexacro.getLocalStorage("orderDraft");
    if (!saved) { alert("임시저장 데이터 없음"); return; }
    this.dsMain.loadXml(saved);
}
```

## 테스트 데이터 주입 패턴

서버가 준비되지 않은 개발 초기에 유용합니다. 실제 서버 응답과 동일한 XML 구조를 `loadXml()`로 주입해 UI를 먼저 검증합니다.

```javascript
function fn_onload_formload(obj, e) {
    var USE_MOCK = (nexacro.getDevice().name == "PC_Dev");
    if (USE_MOCK) {
        this.fn_loadMockData();
    } else {
        this.fn_search();
    }
}

function fn_loadMockData() {
    var mock = "<Dataset id='dsGrid'>"
             + "<ColumnInfo><Column id='ID' type='STRING' size='10'/>"
             + "<Column id='AMT' type='INT'/></ColumnInfo>"
             + "<Rows><Row ID='M001' AMT='5000'/>"
             + "<Row ID='M002' AMT='12000'/></Rows></Dataset>";
    this.dsGrid.loadXml(mock);
}
```

## loadXml vs clearData + addRow

| 방법 | 컬럼 구조 | 성능 | 주 용도 |
|------|-----------|------|---------|
| `loadXml()` | XML에서 재정의 | 파싱 오버헤드 | 초기화·복원 |
| `clearData()` + `addRow()` | 기존 컬럼 유지 | 빠름 | 동적 행 추가 |

소량 데이터(수십 행 이하)를 코드로 채울 때는 `clearData()` + `addRow()`가 더 직관적입니다. 수백 행의 고정 코드나 저장된 데이터를 복원할 때는 `loadXml()`이 간결합니다.

## 주의사항

`loadXml()` 호출 후 rowType이 모두 NORMAL로 설정되기 때문에, 로드된 행을 수정해도 `saveModified()`나 `transaction()`의 변경 행 집합에 포함되지 않습니다. 수정 추적을 원한다면 `loadXml()` 후 별도로 `setRowType(row, Dataset.ROWTYPE_NORMAL)` 대신 `addRow()` 방식으로 전환하거나, 서버 전송 전 rowType을 명시적으로 바꿔야 합니다.

---

**지난 글:** [[Nexacro N] Dataset 탐색 함수 완전 정복](/posts/nexacro-n-dataset-find-functions/)

**다음 글:** [[Nexacro N] Dataset JSON 데이터 다루기](/posts/nexacro-n-dataset-json/)

<br>
읽어주셔서 감사합니다. 😊
