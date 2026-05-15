---
title: "[Nexacro N] Dataset 변경 추적과 rowStatus 활용"
description: "Nexacro N Dataset의 rowStatus 값(NORMAL/INSERT/UPDATE/DELETE)을 이용한 변경 추적, getInsertRowCount·getOrgColumn 활용, savePoint() 초기화 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 8
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "rowStatus", "Dataset", "변경추적", "savePoint", "getOrgColumn", "CRUD"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-fn-new/)에서 fn_new()로 신규 행을 추가하는 방법을 살펴봤다. Nexacro N의 Dataset은 각 행에 `rowStatus` 값을 자동으로 부여해 어떤 행이 추가·수정·삭제됐는지 추적한다. 이 변경 추적 메커니즘을 이해하면 fn_save()에서 변경된 행만 효율적으로 서버로 전송할 수 있다.

## rowStatus 4가지 상태

![rowStatus 상태 테이블](/assets/posts/nexacro-n-update-tracking-rowstatus.svg)

Dataset의 각 행은 생성 시점부터 항상 `rowStatus` 속성을 갖는다.

- **NORMAL (1)**: 서버에서 조회된 직후, 또는 `savePoint()` 호출 후의 초기 상태
- **INSERT (2)**: `addRow()` / `insertRow()`로 추가된 신규 행
- **UPDATE (4)**: NORMAL 상태의 행을 `setColumn()`으로 값이 변경된 상태
- **DELETE (8)**: `deleteRow()`로 논리 삭제된 행. Grid에서는 숨겨지지만 Dataset에는 남아 있음

INSERT 상태 행을 `deleteRow()`하면 그 행은 DELETE가 아니라 Dataset에서 완전히 제거된다. 서버에 보낸 적 없는 행이므로 서버 삭제 불필요하기 때문이다.

## 변경 행 수 확인

```javascript
var ds = this.ds_list;

// 각 변경 타입별 행 수 조회
var insCount = ds.getInsertRowCount();
var updCount = ds.getUpdateRowCount();
var delCount = ds.getDeleteRowCount();

// 하나라도 변경이 있으면 저장 버튼 활성화
var hasChange = (insCount + updCount + delCount) > 0;
this.btn_save.enable = hasChange;
```

![변경 감지 코드 패턴](/assets/posts/nexacro-n-update-tracking-code.svg)

## 특정 행의 rowStatus 확인

```javascript
var row = this.Grid00.currentrow;
var status = this.ds_list.getRowStatus(row);

switch (status) {
  case Dataset.ROWSTATUS_NORMAL:
    trace("수정 없음");
    break;
  case Dataset.ROWSTATUS_INSERT:
    trace("신규 행");
    break;
  case Dataset.ROWSTATUS_UPDATE:
    trace("수정된 행");
    break;
  case Dataset.ROWSTATUS_DELETE:
    trace("삭제된 행");
    break;
}
```

## 원본값 비교: getOrgColumn()

`getOrgColumn(row, colId)`은 마지막 `savePoint()` 이후 (또는 서버 조회 직후)의 원본값을 반환한다. 현재값(`getColumn`)과 비교해 변경 사항을 감지하거나 롤백 시 이전 값으로 복원할 수 있다.

```javascript
function fn_showChanges() {
  for (var i = 0; i < this.ds_list.rowcount; i++) {
    var st = this.ds_list.getRowStatus(i);
    if (st === Dataset.ROWSTATUS_UPDATE) {
      var orgAmt = this.ds_list.getOrgColumn(i, "AMOUNT");
      var curAmt = this.ds_list.getColumn(i, "AMOUNT");
      trace("행" + i + ": " + orgAmt + " → " + curAmt);
    }
  }
}
```

## savePoint()로 추적 초기화

저장 성공 후에는 `savePoint()`를 호출해 모든 행의 rowStatus를 NORMAL로 리셋한다. 이후 `getOrgColumn()`이 저장된 값을 새로운 기준점으로 사용한다.

```javascript
function fn_saveCb(svcID, errCode, errMsg) {
  if (errCode != 0) {
    alert("저장 실패: " + errMsg);
    return;
  }
  // rowStatus 초기화 — NORMAL로 리셋
  this.ds_list.savePoint();
  alert("저장 완료");
}
```

`savePoint()` 없이 fn_search()로 재조회하면 서버 데이터로 Dataset이 완전히 교체되므로, 재조회를 하는 경우에는 별도로 `savePoint()`를 호출할 필요가 없다.

## 변경 취소: restorePoint()

`savePoint()`와 짝을 이루는 `restorePoint()`는 마지막 저장점(savePoint) 이후의 모든 변경을 취소하고 원본 상태로 되돌린다.

```javascript
function fn_cancel() {
  if (!this.fn_hasChanges()) return;
  if (!confirm("변경 사항을 취소하시겠습니까?")) return;
  this.ds_list.restorePoint();
}
```

## 이탈 경고 패턴

```javascript
function Form_onunload(obj, e) {
  if (this.fn_hasChanges()) {
    if (!confirm(
      "저장하지 않은 변경이 있습니다.\n페이지를 떠나시겠습니까?")) {
      e.preventDefault();
      return;
    }
  }
}
```

## 변경 행 순회 패턴

저장 전 변경된 행을 순회하며 추가 처리가 필요한 경우:

```javascript
function fn_iterateChanged() {
  for (var i = 0; i < this.ds_list.rowcount; i++) {
    var st = this.ds_list.getRowStatus(i);
    if (st === Dataset.ROWSTATUS_INSERT ||
        st === Dataset.ROWSTATUS_UPDATE) {
      // INSERT / UPDATE 행만 처리
      this.fn_validateRow(i);
    }
  }
}
```

---

**지난 글:** [fn_new() 신규 행 추가 패턴](/posts/nexacro-n-fn-new/)

**다음 글:** [fn_delete() 삭제 처리 패턴](/posts/nexacro-n-fn-delete/)

<br>
읽어주셔서 감사합니다. 😊
