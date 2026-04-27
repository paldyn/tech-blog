---
title: "[Nexacro N] CRUD 패턴 — 조회·신규·수정·삭제·저장 완전 정리"
description: "Nexacro N에서 실무에 바로 쓸 수 있는 CRUD 패턴을 단계별로 정리합니다. Dataset RowStatus 추적 원리부터 fn_search/fn_new/fn_delete/fn_save 함수 템플릿까지 코드 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 4
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "crud", "dataset", "transaction"]
featured: false
draft: false
---

지난 [\[Nexacro N\] Transaction — 서버 통신의 모든 것](/posts/nexacro-n-transaction/) 글에서 이어집니다.

이 글은 **Nexacro N** 기준으로 작성되었습니다.

기업 업무 시스템의 80%는 데이터를 조회하고, 추가하고, 수정하고, 삭제하는 작업으로 이루어집니다. Nexacro N은 이 CRUD 흐름을 **Dataset → Grid → Transaction** 구조로 일관성 있게 처리합니다. 이 글에서는 실무에서 반복적으로 사용하는 함수 패턴을 단계별로 정리하고, 각 단계에서 Dataset이 어떻게 행(Row)의 상태를 추적하는지 설명합니다.

---

## CRUD의 전체 흐름

![Nexacro N CRUD 패턴 흐름](/assets/posts/nexacro-n-crud-flow.svg)

Nexacro N의 CRUD는 세 계층으로 구성됩니다.

1. **UI 레이어** — Grid, 버튼이 사용자 이벤트를 받아 함수를 호출합니다.
2. **Dataset 레이어** — `insertRow()`, `setColumn()`, `deleteRow()` 호출로 행 상태(RowStatus)를 자동 추적합니다.
3. **서버 레이어** — `this.transaction()` 한 번으로 변경된 모든 행을 서버에 전송합니다.

이 흐름 덕분에 개발자는 "어떤 행이 INSERT인지, UPDATE인지"를 직접 관리할 필요가 없습니다. Dataset이 자동으로 추적합니다.

---

## RowStatus — Dataset의 핵심 추적 메커니즘

![Dataset RowStatus 상태 전환도](/assets/posts/nexacro-n-crud-rowstatus.svg)

Dataset의 모든 행은 네 가지 상태 중 하나를 가집니다.

| 상수 | 값 | 의미 | 전환 조건 |
|---|---|---|---|
| `nexacro.RowStatus.NORMAL` | 0 | 변경 없음 | 조회 직후, 저장 성공 후 |
| `nexacro.RowStatus.INSERT` | 2 | 새로 추가된 행 | `insertRow()` 호출 후 |
| `nexacro.RowStatus.UPDATE` | 4 | 수정된 행 | `setColumn()` 호출 후 |
| `nexacro.RowStatus.DELETE` | 1 | 삭제 예정 행 | `deleteRow()` 호출 후 (NORMAL 행만) |

`getRowStatus(nRow)` 메서드로 특정 행의 현재 상태를 확인할 수 있습니다. `transaction()`을 호출하면 Nexacro N이 각 RowStatus에 맞는 SQL 처리(INSERT/UPDATE/DELETE)를 서버에 요청하고, 성공하면 모든 행이 `NORMAL(0)`으로 초기화됩니다.

---

## 조회 — fn_search()

조회는 검색 조건 Dataset을 서버에 전송하고, 응답 Dataset을 Grid에 표시하는 가장 기본적인 흐름입니다.

```javascript
// 조회 버튼 onclick 또는 onload에서 호출
function fn_search(obj, e) {
    // 검색 조건을 요청 Dataset에 세팅
    this.dsSearch.clearData();
    var nRow = this.dsSearch.insertRow(0);
    this.dsSearch.setColumn(nRow, "searchKeyword", this.edtKeyword.value);
    this.dsSearch.setColumn(nRow, "searchType",    this.cboType.value);

    // transaction 호출: svcID, URL, inDs, outDs, callback, timeout
    this.transaction(
        "selectList",                       // svcID — 콜백에서 구분자로 사용
        "/service/sample/selectList.do",    // 서버 URL
        "inDsSrch=dsSearch",               // 요청 Dataset (서버변수명=클라이언트변수명)
        "outDsList=dsList",                 // 응답 Dataset
        "fn_callbackSearch",                // 콜백 함수명
        0                                   // 타임아웃(0=기본값)
    );
}

// 조회 콜백
function fn_callbackSearch(svcID, errorCode, errorMsg) {
    // errorCode가 0이 아니면 서버 오류
    if (errorCode < 0) {
        this.alert("[조회 실패] " + errorMsg);
        return;
    }
    // dsList에 데이터가 자동으로 바인딩됨
    // Grid은 dsList를 바인딩하고 있으므로 자동으로 갱신됨
    if (this.dsList.rowcount === 0) {
        this.alert("조회된 데이터가 없습니다.");
    }
}
```

> **팁:** Grid의 `binddataset` 속성에 Dataset 이름을 설정해 두면, Dataset이 바뀌는 순간 Grid 화면이 자동으로 갱신됩니다. 별도로 화면 갱신 코드를 작성하지 않아도 됩니다.

---

## 신규 — fn_new()

신규 입력은 `insertRow()`로 Dataset에 빈 행을 추가하는 것이 전부입니다.

```javascript
// 신규 버튼 onclick
function fn_new(obj, e) {
    // insertRow(-1): 마지막 행 뒤에 삽입. 특정 위치 삽입은 nRow 지정
    var nRow = this.dsList.insertRow(-1);

    // 기본값 세팅
    this.dsList.setColumn(nRow, "regDt",   this.getFormattedDate(new Date(), "YYYY-MM-DD"));
    this.dsList.setColumn(nRow, "useYn",   "Y");
    this.dsList.setColumn(nRow, "sortSeq", this.dsList.rowcount); // 마지막 순번

    // Grid에서 새 행으로 포커스 이동
    this.dsList.rowposition = nRow;
    this.grdList.setFocus();

    // RowStatus는 자동으로 INSERT(2)가 됨
}
```

`insertRow()`가 반환하는 값은 새로 추가된 행의 인덱스(0부터 시작)입니다. 이 값을 `rowposition`에 대입하면 Grid가 해당 행으로 스크롤하고 편집 준비 상태가 됩니다.

---

## 수정 — Grid 직접 편집과 fn_edit()

Grid 컬럼의 `edittype` 속성이 `text`, `combo`, `date` 등으로 설정되어 있으면 사용자가 셀을 클릭하거나 더블클릭해서 바로 편집할 수 있습니다. 이때 Grid는 내부적으로 `setColumn()`을 호출하므로 RowStatus가 `UPDATE(4)`로 자동 변경됩니다.

스크립트로 강제 수정이 필요할 때는 `setColumn()`을 직접 호출합니다.

```javascript
// 특정 컬럼 값을 스크립트로 수정
function fn_setDefaultValue(obj, e) {
    var nRow = this.dsList.rowposition; // 현재 선택된 행
    if (nRow < 0) {
        this.alert("선택된 행이 없습니다.");
        return;
    }

    // setColumn(행 인덱스, 컬럼 이름, 값)
    this.dsList.setColumn(nRow, "status",   "DONE");
    this.dsList.setColumn(nRow, "closeDt",  this.getFormattedDate(new Date(), "YYYY-MM-DD"));
    // 자동으로 RowStatus → UPDATE(4) (기존이 INSERT면 INSERT 유지)
}

// oncolumnchanged 이벤트: 컬럼 변경 시 연관 컬럼 자동 계산
function dsList_oncolumnchanged(obj, e) {
    // e.columnid: 변경된 컬럼 이름, e.row: 행 인덱스
    if (e.columnid == "unitPrice" || e.columnid == "qty") {
        var nRow    = e.row;
        var price   = parseFloat(obj.getColumn(nRow, "unitPrice")) || 0;
        var qty     = parseFloat(obj.getColumn(nRow, "qty"))       || 0;
        // setColumn을 사용하지 않고 직접 할당하면 RowStatus가 변경되지 않으므로 주의
        obj.setColumn(nRow, "totalAmt", price * qty);
    }
}
```

> **주의:** `oncolumnchanged` 이벤트 안에서 다른 컬럼을 `setColumn()`으로 변경하면, 그 변경이 다시 `oncolumnchanged`를 트리거할 수 있습니다. 무한 루프를 방지하려면 변경 대상 컬럼을 이벤트 핸들러 상단에서 명시적으로 필터링하세요.

---

## 삭제 — fn_delete()

삭제는 `deleteRow()`를 호출합니다. INSERT 상태의 행은 Dataset에서 즉시 제거되고, NORMAL/UPDATE 상태의 행은 숨겨지면서 RowStatus가 `DELETE(1)`로 변경됩니다. 실제 DB 삭제는 `transaction()` 호출 시 이루어집니다.

```javascript
// 삭제 버튼 onclick
function fn_delete(obj, e) {
    var nRow = this.dsList.rowposition;
    if (nRow < 0) {
        this.alert("삭제할 행을 선택하세요.");
        return;
    }

    // 삭제 확인 다이얼로그
    this.confirm("선택한 행을 삭제하시겠습니까?", "fn_deleteConfirm");
}

// confirm 콜백
function fn_deleteConfirm(sResult) {
    // sResult: "true" 또는 "false"
    if (sResult != "true") return;

    var nRow = this.dsList.rowposition;
    var status = this.dsList.getRowStatus(nRow);

    // INSERT 상태의 행은 즉시 완전 제거 (서버에 DELETE 요청 불필요)
    // NORMAL/UPDATE 상태의 행은 DELETE(1)로 마킹됨
    this.dsList.deleteRow(nRow);

    // 삭제 후 rowposition 보정 (마지막 행이면 한 칸 위로)
    var newPos = Math.min(nRow, this.dsList.rowcount - 1);
    this.dsList.rowposition = newPos;
}
```

---

## 저장 — fn_save()

저장은 Dataset의 모든 변경 행(INSERT/UPDATE/DELETE)을 서버에 한 번에 전송합니다.

```javascript
// 저장 버튼 onclick
function fn_save(obj, e) {
    // 1. 변경 행이 있는지 확인
    // NORMAL 행만 있으면 저장 불필요
    var bHasChange = false;
    for (var i = 0; i < this.dsList.rowcount; i++) {
        var st = this.dsList.getRowStatus(i);
        if (st != nexacro.RowStatus.NORMAL) {
            bHasChange = true;
            break;
        }
    }
    // DELETE 행은 rowcount에 포함되지 않으므로 deletedcount로 추가 확인
    if (this.dsList.deletedcount > 0) {
        bHasChange = true;
    }

    if (!bHasChange) {
        this.alert("변경된 데이터가 없습니다.");
        return;
    }

    // 2. 유효성 검사 (다음 글 주제)
    if (!fn_validate.call(this)) return;

    // 3. 저장 transaction 호출
    this.transaction(
        "saveList",                         // svcID
        "/service/sample/saveList.do",      // 서버 URL
        "inDsList=dsList",                  // Dataset 전체 전송 (서버에서 RowStatus로 분기)
        "",                                 // 응답 Dataset 없음
        "fn_callbackSave",                  // 콜백
        0
    );
}

// 저장 콜백
function fn_callbackSave(svcID, errorCode, errorMsg) {
    if (errorCode < 0) {
        this.alert("[저장 실패] " + errorMsg);
        return;
    }
    this.alert("저장이 완료되었습니다.");
    // 저장 후 재조회하여 Dataset RowStatus를 NORMAL로 초기화
    fn_search.call(this, null, null);
}
```

> **팁:** 서버가 단일 API로 INSERT/UPDATE/DELETE를 모두 처리하도록 설계하면, 클라이언트는 `transaction()` 한 번만 호출합니다. 서버에서는 전달받은 Dataset의 각 행 RowStatus를 확인해 적절한 SQL을 실행합니다.

---

## 다중 Dataset 동시 저장

마스터-디테일 구조처럼 두 Dataset을 동시에 저장해야 할 때는 `inDatasets` 파라미터에 여러 Dataset을 공백으로 구분해 나열합니다.

```javascript
function fn_saveAll(obj, e) {
    // 마스터 + 디테일 동시 저장
    this.transaction(
        "saveAll",
        "/service/sample/saveAll.do",
        // 서버변수명=클라이언트Dataset명 (공백으로 구분, 여러 개 가능)
        "inDsMaster=dsMaster inDsDetail=dsDetail",
        "",
        "fn_callbackSaveAll",
        0
    );
}
```

---

## 행 상태별 건수 확인

Dataset은 RowStatus별 건수를 쉽게 확인할 수 있는 속성을 제공합니다.

```javascript
function fn_checkStatus(obj, e) {
    // rowcount: 현재 보이는 행 수 (DELETE 행 제외)
    // deletedcount: 삭제 마킹된 행 수
    var total   = this.dsList.rowcount;
    var deleted = this.dsList.deletedcount;

    var insertCnt = 0, updateCnt = 0;
    for (var i = 0; i < total; i++) {
        var st = this.dsList.getRowStatus(i);
        if (st == nexacro.RowStatus.INSERT) insertCnt++;
        if (st == nexacro.RowStatus.UPDATE) updateCnt++;
    }

    var msg = "신규: " + insertCnt + "건\n"
            + "수정: " + updateCnt + "건\n"
            + "삭제: " + deleted   + "건";
    this.alert(msg);
}
```

---

## 전체 취소 — Dataset 원복

사용자가 "취소" 버튼을 누르면 Dataset을 원래 상태로 되돌려야 합니다. 가장 간단한 방법은 재조회입니다.

```javascript
// 취소 버튼 onclick
function fn_cancel(obj, e) {
    this.confirm("변경 내용을 취소하시겠습니까?", "fn_cancelConfirm");
}

function fn_cancelConfirm(sResult) {
    if (sResult != "true") return;
    // 재조회로 Dataset을 서버 원본 상태로 초기화
    fn_search.call(this, null, null);
}
```

---

## 실무 체크리스트

CRUD 기능을 개발할 때 놓치기 쉬운 항목들입니다.

- `insertRow()` 반환값을 변수에 저장하지 않으면 기본값 세팅 위치를 알 수 없습니다.
- `deleteRow()` 후 `rowposition`이 -1이 되지 않도록 보정해야 합니다.
- `this.dsList.deletedcount`를 체크하지 않으면 DELETE 행만 있을 때 "변경 없음"으로 오판할 수 있습니다.
- `oncolumnchanged` 내부에서 `setColumn()` 재귀 호출 시 무한 루프에 주의합니다.
- 저장 후 재조회하지 않으면 RowStatus가 NORMAL로 초기화되지 않아 다음 저장에서 중복 전송이 발생할 수 있습니다.
- 마스터-디테일 구조에서는 마스터 키(PK)를 디테일에도 항상 세팅해야 합니다.

---

**지난 글:** [[Nexacro N] Transaction — 서버 통신의 모든 것](/posts/nexacro-n-transaction/)

**다음 글:** [[Nexacro N] 유효성 검사 — 저장 전 데이터 무결성 보장하기](/posts/nexacro-n-validation/)

<br>
읽어주셔서 감사합니다. 😊
