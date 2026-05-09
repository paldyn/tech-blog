---
title: "[Nexacro N] 마스터-디테일 패턴 구현"
description: "Nexacro N에서 마스터 Grid 선택 시 디테일 Dataset을 자동 조회하는 패턴을 oncurrentchanged 이벤트와 transaction을 중심으로 단계별로 구현합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 10
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "master-detail", "databinding", "oncurrentchanged", "transaction"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-binding-dynamic/)에서 동적 바인딩을 살펴봤습니다. Nexacro N 업무 화면에서 가장 많이 등장하는 UI 패턴 중 하나가 마스터-디테일입니다. 상단에 목록 Grid(마스터)가 있고, 특정 행을 선택하면 하단 Grid나 입력 폼(디테일)에 해당 행의 상세 정보가 표시됩니다. Dataset의 `oncurrentchanged` 이벤트와 `transaction()`을 조합하면 이 패턴을 간결하게 구현할 수 있습니다.

## 화면 구조

마스터-디테일 화면은 두 개의 Dataset을 사용합니다.

- `dsMaster`: 마스터 Grid에 바인딩. 서버에서 전체 목록을 받아 채움
- `dsDetail`: 디테일 Grid 또는 입력 폼에 바인딩. 마스터 선택 시마다 서버에서 상세를 받아 채움

![마스터-디테일 화면 구조](/assets/posts/nexacro-n-master-detail-layout.svg)

마스터와 디테일은 별개의 Dataset이므로 각각 독립적으로 transaction을 호출합니다. 마스터를 저장할 때와 디테일을 저장할 때 transaction을 분리해 관리합니다.

## oncurrentchanged 이벤트 — 핵심 트리거

`dsMaster`에 `oncurrentchanged` 이벤트를 연결합니다. Grid에서 행을 클릭하면 `dsMaster.currentrow`가 변경되고 이 이벤트가 발화됩니다.

```javascript
// dsMaster 이벤트 핸들러 등록 (Designer에서 설정하거나 스크립트에서)
this.dsMaster.addEventHandler("oncurrentchanged",
    this.dsMaster_oncurrentchanged, this);
```

또는 Designer에서 Dataset의 `oncurrentchanged` 이벤트에 함수를 직접 연결합니다.

![마스터-디테일 핵심 코드](/assets/posts/nexacro-n-master-detail-code.svg)

## 전체 구현 코드

```javascript
// 1. 마스터 조회
function fn_search() {
    this.transaction("master", "SVC/getMasterList",
        "dsSearch=dsSearch", "dsMaster=dsMaster", "", "fn_search_cb");
}

function fn_search_cb(e) {
    if (e.errorCode != 0) {
        alert(e.errorMsg);
        return;
    }
    // 첫 번째 행 선택 → 디테일 자동 조회
    if (this.dsMaster.rowcount > 0) {
        this.dsMaster.setRow(0);
    }
}

// 2. 마스터 행 변경 시 디테일 조회
function dsMaster_oncurrentchanged(obj, e) {
    var nRow = obj.currentrow;
    if (nRow < 0) {
        this.dsDetail.clearData();
        return;
    }
    var ordNo = obj.getColumn(nRow, "ORD_NO");
    // 파라미터 Dataset에 키 값 설정
    this.dsParam.clearData();
    var r = this.dsParam.addRow();
    this.dsParam.setColumn(r, "ORD_NO", ordNo);
    // 디테일 조회
    this.transaction("detail", "SVC/getDetail",
        "dsParam=dsParam", "dsDetail=dsDetail", "", "");
}
```

## 디테일 편집 및 저장

디테일 Grid에서 직접 편집한 후 저장 버튼을 클릭하면 디테일 Dataset의 변경 행만 서버로 전송합니다.

```javascript
function btn_detailSave_onclick(obj, e) {
    // 마스터 키를 디테일 데이터에 주입
    var ordNo = this.dsMaster.getColumn(
        this.dsMaster.currentrow, "ORD_NO");
    for (var i = 0; i < this.dsDetail.rowcount; i++) {
        this.dsDetail.setColumn(i, "ORD_NO", ordNo);
    }
    this.transaction("detailSave", "SVC/saveDetail",
        "dsDetail=dsDetail", "", "", "fn_detailSave_cb");
}

function fn_detailSave_cb(e) {
    if (e.errorCode != 0) { alert(e.errorMsg); return; }
    alert("저장 완료");
    // 디테일 재조회
    this.dsMaster_oncurrentchanged(this.dsMaster, null);
}
```

## 중복 조회 방지

마스터 행 변경이 빠르게 반복될 때 이전 디테일 transaction이 완료되기 전에 새 transaction이 요청될 수 있습니다. `transaction ID`가 같으면 Nexacro가 이전 요청을 취소하고 새 요청을 보내므로, 디테일 조회 ID를 항상 고정된 이름(`"detail"`)으로 유지하면 자동으로 중복이 방지됩니다.

## 클라이언트 사이드 디테일 — 필터 패턴

서버 재조회 없이 클라이언트에서 필터링으로 디테일을 구현할 수도 있습니다. 마스터와 디테일 데이터를 한 번에 받아 클라이언트에서 필터로 분리하는 방식입니다.

```javascript
function dsMaster_oncurrentchanged(obj, e) {
    var nRow = obj.currentrow;
    if (nRow < 0) { this.dsDetail.setFilter(""); return; }
    var ordNo = obj.getColumn(nRow, "ORD_NO");
    // 전체 디테일 데이터에서 필터로 해당 행만 표시
    this.dsDetail.setFilter("ORD_NO == '" + ordNo + "'");
}
```

초기 조회 시 마스터+디테일 전체를 한 번에 받고, 이후 네트워크 없이 필터만 교체합니다. 데이터 양이 많지 않고 네트워크 지연을 최소화해야 할 때 적합합니다.

---

**지난 글:** [[Nexacro N] 동적 바인딩 — 런타임에 Dataset 교체하기](/posts/nexacro-n-binding-dynamic/)

<br>
읽어주셔서 감사합니다. 😊
