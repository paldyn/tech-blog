---
title: "[Nexacro N] Grid Row Actions — 행 단위 액션"
description: "Nexacro N Grid에서 oncellclick/onrowdblclick으로 행 선택 처리, 행 추가/삭제/이동, 다중 선택(multiselect) 구현 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 10
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "grid", "oncellclick", "onrowdblclick", "multiselect", "행추가", "행삭제"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-grid-paging/)에서 페이징 처리 방법을 살펴봤습니다. 이번에는 Grid에서 행 단위로 다양한 액션을 처리하는 방법을 다룹니다. 클릭/더블클릭 이벤트 처리, 행 추가·삭제, 다중 선택까지 실무 패턴을 중심으로 설명합니다.

## 행 단위 액션 이벤트 종류

| 이벤트 | 발생 시점 | 주요 용도 |
|---|---|---|
| `oncellclick` | 셀 클릭 | 버튼 셀 처리, 행 선택 |
| `oncelldbclick` | 셀 더블클릭 | 셀 값 편집 활성화 |
| `onrowclick` | 행 클릭 | 행 선택 감지 |
| `onrowdblclick` | 행 더블클릭 | 팝업 열기, 상세 이동 |
| `oncellfocuschanged` | 포커스 변경 | 현재 행 추적 |

![Grid 행 단위 액션 이벤트](/assets/posts/nexacro-n-grid-row-actions-events.svg)

## oncellclick — 셀 클릭

`oncellclick` 이벤트의 `e.col`로 어느 컬럼을 클릭했는지 확인하고, `e.row`로 행 인덱스를 가져옵니다.

```javascript
function grd_emp_oncellclick(obj, e) {
  // 4번 컬럼(상세 버튼)을 클릭한 경우
  if (e.col == 4) {
    var empId = this.ds_emp.getColumn(e.row, "emp_id");
    this.fn_openDetail(empId);
    return;
  }

  // 그 외 컬럼: 선택 행 정보 표시
  var deptNm = this.ds_emp.getColumn(e.row, "dept_nm");
  this.lbl_info.set_text("선택: " + deptNm);
}
```

![행 단위 액션 구현 코드](/assets/posts/nexacro-n-grid-row-actions-code.svg)

## onrowdblclick — 행 더블클릭

행을 더블클릭하면 `onrowdblclick` 이벤트가 발생합니다. 수정 팝업을 열거나 상세 폼으로 이동하는 데 사용합니다.

```javascript
function grd_emp_onrowdblclick(obj, e) {
  var empId = this.ds_emp.getColumn(e.row, "emp_id");
  var empNm = this.ds_emp.getColumn(e.row, "emp_nm");

  // 수정 팝업 열기
  this.fn_openEditPopup(empId, empNm);
}
```

`oncelldbclick`과 `onrowdblclick`은 차이가 있습니다. `oncelldbclick`은 편집 가능한 셀 더블클릭 시 발생하고, `onrowdblclick`은 행 단위 더블클릭 이벤트입니다.

## 현재 선택 행 가져오기

Grid에서 현재 선택된 행의 정보는 Dataset의 `rowposition`을 통해 가져옵니다.

```javascript
function fn_getSelectedRow() {
  var rowPos = this.ds_emp.rowposition;
  if (rowPos < 0) {
    alert("선택된 행이 없습니다.");
    return null;
  }
  return {
    empId: this.ds_emp.getColumn(rowPos, "emp_id"),
    empNm: this.ds_emp.getColumn(rowPos, "emp_nm"),
    deptCd: this.ds_emp.getColumn(rowPos, "dept_cd")
  };
}
```

## 행 추가

Dataset에 새 행을 추가합니다. `addRow()`는 마지막 행 뒤에, `insertRow(rowIdx)`는 지정 위치에 삽입합니다.

```javascript
function btn_addRow_onclick(obj, e) {
  // Dataset에 새 행 추가
  var newRowIdx = this.ds_emp.addRow();

  // 신규 행 기본값 설정
  this.ds_emp.setColumn(newRowIdx, "dept_cd", "001");
  this.ds_emp.setColumn(newRowIdx, "status", "Y");

  // 신규 행으로 포커스 이동
  this.ds_emp.rowposition = newRowIdx;

  // Grid에서 해당 행 편집 활성화 (edittype: edit인 경우)
  this.grd_emp.setFocus();
}

function btn_insertRow_onclick(obj, e) {
  // 현재 선택 행 위에 삽입
  var curRow = this.ds_emp.rowposition;
  var newRowIdx = this.ds_emp.insertRow(curRow);
  this.ds_emp.rowposition = newRowIdx;
}
```

## 행 삭제

선택된 행을 삭제합니다. 삭제 전 사용자 확인 다이얼로그를 표시하는 것이 좋습니다.

```javascript
function btn_deleteRow_onclick(obj, e) {
  var rowPos = this.ds_emp.rowposition;
  if (rowPos < 0) {
    alert("삭제할 행을 선택하세요.");
    return;
  }

  var empNm = this.ds_emp.getColumn(rowPos, "emp_nm");
  if (!confirm(empNm + "을(를) 삭제하시겠습니까?")) {
    return;
  }

  // Dataset에서 행 삭제
  this.ds_emp.deleteRow(rowPos);
}
```

`deleteRow()`는 Dataset에서 행을 삭제하되, `rowtype`이 `ROWTYPE_DELETED`로 변경됩니다. 실제 DB 삭제는 저장 트랜잭션 시 처리됩니다.

## 다중 선택 (multiselect)

Grid에서 여러 행을 동시에 선택하려면 `selecttype` 속성을 설정합니다.

```xml
<Grid id="grd_emp"
  selecttype="multi"
  bindDataset="ds_emp">
</Grid>
```

`selecttype="multi"` 상태에서 Ctrl+클릭이나 Shift+클릭으로 여러 행을 선택합니다.

선택된 모든 행을 처리하려면 `getSelectRow()`로 선택 행 목록을 가져옵니다.

```javascript
function btn_deleteSelected_onclick(obj, e) {
  var selectedRows = this.grd_emp.getSelectRow();
  if (selectedRows == null || selectedRows.length == 0) {
    alert("삭제할 행을 선택하세요.");
    return;
  }

  // 역순으로 삭제 (앞에서 삭제하면 인덱스 밀림)
  for (var i = selectedRows.length - 1; i >= 0; i--) {
    this.ds_emp.deleteRow(selectedRows[i]);
  }
}
```

다중 삭제 시 **역순(마지막 행부터)**으로 처리해야 인덱스 밀림 현상을 방지할 수 있습니다.

## 선택 행 데이터 수집

여러 선택 행에서 데이터를 수집하는 패턴입니다.

```javascript
function fn_collectSelectedData() {
  var selectedRows = this.grd_emp.getSelectRow();
  var empIds = [];

  for (var i = 0; i < selectedRows.length; i++) {
    var rowIdx = selectedRows[i];
    var empId = this.ds_emp.getColumn(rowIdx, "emp_id");
    empIds.push(empId);
  }

  // 선택된 사번 목록 처리
  var idList = empIds.join(",");
  trace("선택된 사번: " + idList);

  return idList;
}
```

## 행 이동 (위로/아래로)

Dataset의 `moveRow(from, to)` 또는 행 데이터 복사 방식으로 행 순서를 변경합니다.

```javascript
function btn_moveUp_onclick(obj, e) {
  var rowPos = this.ds_emp.rowposition;
  if (rowPos <= 0) return;

  this.ds_emp.moveRow(rowPos, rowPos - 1);
  this.ds_emp.rowposition = rowPos - 1;
}

function btn_moveDown_onclick(obj, e) {
  var rowPos = this.ds_emp.rowposition;
  if (rowPos >= this.ds_emp.rowcount - 1) return;

  this.ds_emp.moveRow(rowPos, rowPos + 1);
  this.ds_emp.rowposition = rowPos + 1;
}
```

`moveRow(from, to)`는 `from` 인덱스 행을 `to` 위치로 이동합니다.

## 전체 선택/해제

체크박스 전체 선택 패턴입니다.

```javascript
function chk_allSelect_onitemchanged(obj, e) {
  var allChecked = (e.postvalue == "1");
  var rowCnt = this.ds_emp.rowcount;

  for (var i = 0; i < rowCnt; i++) {
    this.ds_emp.setColumn(i, "chk_yn", allChecked ? "Y" : "N");
  }
}
```

## 정리

Grid 행 단위 액션은 `oncellclick`(셀 단위)과 `onrowdblclick`(행 전체)으로 처리합니다. 행 추가는 `addRow()`/`insertRow()`, 삭제는 `deleteRow()`, 이동은 `moveRow()`를 사용합니다. 다중 선택은 `selecttype="multi"`와 `getSelectRow()`로 구현하며, 다중 삭제 시 역순 처리가 필수입니다.

---

**지난 글:** [Nexacro N Grid Paging — 페이징 처리](/posts/nexacro-n-grid-paging/)

**다음 글:** [Nexacro N Grid Edit Control — 셀 편집 제어](/posts/nexacro-n-grid-edit-control/)

<br>
읽어주셔서 감사합니다. 😊
