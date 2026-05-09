---
title: "[Nexacro N] Dataset JSON 데이터 다루기"
description: "Nexacro N에서 JSON 데이터를 Dataset으로 변환하거나 Dataset을 JSON으로 직렬화하는 방법을 saveJSON·loadJSON과 수동 매핑 패턴으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "dataset", "json", "saveJSON", "loadJSON", "rest-api"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-dataset-loadxml/)에서 `loadXml()` API를 살펴봤습니다. 현대 프로젝트에서는 REST API가 XML 대신 JSON을 반환하는 경우가 많습니다. Nexacro N은 `saveJSON()`·`loadJSON()` API를 제공하지만 이 포맷은 Nexacro 전용이라 외부 REST API와 직접 호환되지 않습니다. 이 글에서는 일반 JSON 응답을 Dataset으로 변환하는 수동 매핑 패턴과, Nexacro 전용 JSON API의 용도를 함께 정리합니다.

## saveJSON과 loadJSON

`saveJSON()`은 Dataset 전체를 Nexacro 전용 JSON 포맷으로 직렬화합니다. 컬럼 메타데이터와 rowType 정보까지 포함한 구조이므로 `loadJSON()`으로 완전히 복원할 수 있습니다.

```javascript
// 임시저장: JSON으로 직렬화
var jsonStr = this.dsMain.saveJSON();
nexacro.setLocalStorage("draft", jsonStr);

// 복원: 직렬화된 JSON으로 Dataset 재구성
var saved = nexacro.getLocalStorage("draft");
if (saved) this.dsMain.loadJSON(saved);
```

이 API는 `saveXml/loadXml`과 동일한 용도(임시저장·복원·테스트 데이터 주입)에 씁니다. 외부 API가 반환하는 순수 JSON 배열이나 객체에는 사용할 수 없습니다.

![Dataset ↔ JSON 변환 흐름](/assets/posts/nexacro-n-dataset-json-flow.svg)

## 외부 REST API JSON 수동 변환

REST API 응답은 보통 순수 JSON 배열입니다. Nexacro N에서 직접 WebService를 호출하거나, 어댑터를 통해 JSON 응답 본문을 받은 경우 `JSON.parse()` + `addRow()` 루프로 Dataset에 매핑합니다.

```javascript
function fn_onWebResponse(svc, obj, errorCode, errorMsg) {
    if (errorCode != 0) {
        trace("Error: " + errorMsg);
        return;
    }
    // responseText에 JSON 배열 문자열이 담겨 있다고 가정
    fn_jsonToDataset(this.dsMain, obj.responseText);
}
```

![JSON → Dataset 수동 변환 함수](/assets/posts/nexacro-n-dataset-json-convert.svg)

수동 매핑 함수를 공통 라이브러리에 두고 컬럼 매핑 규칙을 인자로 전달하면 재사용성이 높아집니다.

## Dataset → 순수 JSON 변환

Dataset을 외부 API로 전송할 때 순수 JSON 배열이 필요하다면 반복문으로 직접 구성합니다.

```javascript
function fn_datasetToJson(ds) {
    var result = [];
    for (var i = 0; i < ds.rowcount; i++) {
        result.push({
            code: ds.getColumn(i, "CODE"),
            name: ds.getColumn(i, "NAME"),
            amt:  ds.getColumn(i, "AMT")
        });
    }
    return JSON.stringify(result);
}
```

## WebSocket·SSE 연동 패턴

WebSocket으로 실시간 데이터를 수신하는 경우에도 동일한 수동 매핑 패턴을 적용합니다. WebSocket 메시지 수신 핸들러에서 JSON을 파싱해 `addRow()` 또는 `mergeData()`로 Dataset을 갱신합니다.

```javascript
function ws_onmessage(obj, e) {
    var msg = JSON.parse(e.data);
    var nRow = this.dsLive.findRow("TICKER", msg.ticker);
    if (nRow < 0) {
        nRow = this.dsLive.addRow();
        this.dsLive.setColumn(nRow, "TICKER", msg.ticker);
    }
    this.dsLive.setColumn(nRow, "PRICE", msg.price);
    this.dsLive.setColumn(nRow, "CHG", msg.change);
}
```

## 주의: JSON.parse 안전하게 사용하기

Nexacro 환경에서도 `JSON.parse()`는 표준 JavaScript API로 사용 가능합니다. 단, 응답 본문에 BOM이나 비표준 문자가 포함된 경우 파싱이 실패할 수 있습니다.

```javascript
function fn_safeJsonParse(str) {
    // BOM 제거
    str = str.replace(/^﻿/, "");
    try {
        return JSON.parse(str);
    } catch (e) {
        trace("JSON parse failed: " + e.message + " | str=" + str.substr(0, 80));
        return null;
    }
}
```

`try/catch`로 파싱 실패를 처리하고 `trace()`로 원인을 기록하는 것이 좋습니다.

## 정리

| 목적 | 방법 |
|------|------|
| Nexacro 내부 임시저장 | `saveJSON()` / `loadJSON()` |
| 외부 REST JSON → Dataset | `JSON.parse()` + `addRow()` 루프 |
| Dataset → 외부 REST JSON | 반복문 + `JSON.stringify()` |
| WebSocket 실시간 갱신 | `onmessage` 핸들러 내 수동 매핑 |

---

**지난 글:** [[Nexacro N] Dataset loadXml로 클라이언트 데이터 초기화하기](/posts/nexacro-n-dataset-loadxml/)

**다음 글:** [[Nexacro N] Dataset CSV 데이터 다루기](/posts/nexacro-n-dataset-csv/)

<br>
읽어주셔서 감사합니다. 😊
