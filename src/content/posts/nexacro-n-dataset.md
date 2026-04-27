---
title: "[Nexacro N] Dataset — 화면 데이터의 핵심 저장소"
description: "Nexacro N에서 화면 데이터를 관리하는 Dataset의 구조, Column 정의, Row 추가/수정/삭제, 검색과 필터, 그리고 실무 CRUD 패턴을 코드 중심으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-22"
archiveOrder: 11
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "dataset", "getColumn", "setColumn", "addRow", "deleteRow", "filter"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-components-overview/)에서 이어집니다.

이 글은 **Nexacro N 기준으로 작성되었습니다.**
넥사크로 개발을 하면서 "Dataset은 결국 테이블이다"라는 말을 자주 듣게 됩니다.
맞습니다. Dataset은 열(Column)과 행(Row)으로 이루어진 **인메모리 테이블**이며, 서버에서 받아온 데이터를 화면에 표시하거나 사용자 입력을 서버로 전송하기 위한 중간 저장소 역할을 합니다.

넥사크로에서 Dataset을 제대로 이해하지 못하면 Grid 바인딩, Transaction, CRUD 코드 어느 것도 제대로 짜기 어렵습니다.
이번 글에서는 Dataset의 구조부터 Column·Row 조작 메서드, 검색·필터, 그리고 실무에서 가장 많이 쓰는 CRUD 패턴까지 코드 중심으로 정리합니다.

---

## Dataset의 기본 구조

Dataset은 크게 세 가지로 구성됩니다.

1. **Column 메타데이터** — 열의 이름, 타입, 크기를 정의합니다.
2. **Row 데이터** — 실제 값이 들어 있는 행들입니다.
3. **RowSaveType** — 각 행이 원본(`N`), 수정(`U`), 신규(`I`), 삭제(`D`) 중 어느 상태인지를 나타냅니다.

![Nexacro N Dataset 구조 — Column / Row / SaveType](/assets/posts/nexacro-dataset-structure.svg)

`RowSaveType`이 넥사크로 Dataset의 가장 큰 특징입니다.
행을 `deleteRow()`로 삭제하면 화면에서 사라지지만 Dataset 내부에서는 `D` 상태로 남아 있습니다.
이후 서버에 저장 요청을 보낼 때, 넥사크로는 `I`·`U`·`D` 행을 자동으로 구분해 서버에 전달합니다.
덕분에 개발자는 "변경된 행만 골라서 전송"하는 로직을 직접 구현할 필요가 없습니다.

---

## XFD에서 Dataset 정의하기

Nexacro Studio에서 Form의 **Dataset 탭**을 열면 컬럼을 GUI로 추가할 수 있습니다.
각 컬럼에는 ID, Type(`STRING` / `INT` / `FLOAT` / `DATE` / `BLOB`), 크기를 지정합니다.

XFD 파일에서 Dataset 정의 부분은 다음과 같이 생겼습니다.

```javascript
// XFD 안의 Dataset 정의 XML 예시 (참고용, 직접 편집하지 않음)
// <Dataset id="dsEmployee">
//   <ColumnInfo>
//     <Column id="empNo"    type="STRING" size="10"/>
//     <Column id="empName"  type="STRING" size="50"/>
//     <Column id="deptCd"   type="STRING" size="6"/>
//     <Column id="salary"   type="INT"/>
//     <Column id="joinDate" type="STRING" size="8"/>
//   </ColumnInfo>
// </Dataset>

// 스크립트로 Dataset을 동적으로 생성하는 패턴
function fn_createDatasetDynamically() {
    // 새 Dataset 객체 생성
    var oDs = new Dataset();
    oDs.id = "dsDynamic";

    // Column 추가
    oDs.addColumn("userId",   "STRING", 20);
    oDs.addColumn("userName", "STRING", 100);
    oDs.addColumn("score",    "INT");
    oDs.addColumn("regDate",  "STRING", 8);

    // Form에 Dataset 등록 (이후 this.dsDynamic 으로 접근 가능)
    this.addChild(oDs.id, oDs);
    oDs.init();

    trace("동적 Dataset 생성 완료 — 열 수: " + oDs.colcount);
}
```

---

## 값 읽기: getColumn

Dataset에서 값을 읽을 때는 `getColumn(행인덱스, 열ID)` 메서드를 사용합니다.

```javascript
// getColumn 기본 사용법
function fn_readDatasetValues() {
    var oDs = this.dsEmployee;

    // 방법 1: 행 인덱스 + 열 ID 문자열
    var sEmpNo   = oDs.getColumn(0, "empNo");
    var sEmpName = oDs.getColumn(0, "empName");
    trace("첫 번째 사원: " + sEmpNo + " / " + sEmpName);

    // 방법 2: 행 인덱스 + 열 인덱스 (열 인덱스는 getColIndex로 획득)
    var nColIdx  = oDs.getColIndex("salary");
    var nSalary  = oDs.getColumn(0, nColIdx);
    trace("급여: " + nSalary);

    // 방법 3: 현재 선택 행(rowposition)의 값 읽기
    //         Grid에서 행 클릭 시 rowposition이 자동으로 갱신됨
    var nCurRow  = oDs.rowposition;
    var sDeptCd  = oDs.getColumn(nCurRow, "deptCd");
    trace("현재 행(" + nCurRow + ")의 부서코드: " + sDeptCd);

    // 전체 행을 순회하며 값 읽기
    for (var i = 0; i < oDs.rowcount; i++) {
        var sName  = oDs.getColumn(i, "empName");
        var nSal   = oDs.getColumn(i, "salary");
        trace(i + ": " + sName + " — " + nSal);
    }
}
```

---

## 값 쓰기: setColumn

Dataset에 값을 쓸 때는 `setColumn(행인덱스, 열ID, 값)` 메서드를 사용합니다.
`setColumn`을 호출하면 해당 행의 `RowSaveType`이 `N`에서 `U`(Updated)로 자동 변경됩니다.

```javascript
// setColumn 기본 사용법
function fn_writeDatasetValues() {
    var oDs = this.dsEmployee;

    // 특정 행·열에 값 쓰기
    oDs.setColumn(0, "empName", "홍길동(수정)");
    oDs.setColumn(0, "salary",  5000000);

    // 현재 선택 행에 값 쓰기
    var nCurRow = oDs.rowposition;
    oDs.setColumn(nCurRow, "deptCd", "D002");

    // RowSaveType 확인 (N → U 로 바뀌었는지 검증)
    var sSaveType = oDs.getRowSaveType(0);
    trace("행 0의 SaveType: " + sSaveType);  // → "U"
}
```

---

## 행 추가, 삽입, 삭제

![Nexacro N Dataset 핵심 메서드 — 읽기 / 쓰기 / 검색](/assets/posts/nexacro-dataset-operations.svg)

### 행 추가 (addRow)

```javascript
// 행을 추가하고 초기값을 설정하는 완전한 패턴
function fn_addRow() {
    var oDs = this.dsEmployee;

    // addRow(): Dataset 끝에 빈 행 추가, 반환값은 새 행의 인덱스
    var nNewRow = oDs.addRow();

    // 새 행에 초기값 설정 (SaveType 은 자동으로 "I" 가 됨)
    oDs.setColumn(nNewRow, "empNo",    "EMP" + this.fn_makePadLeft(oDs.rowcount, 4));
    oDs.setColumn(nNewRow, "empName",  "");
    oDs.setColumn(nNewRow, "deptCd",   this.cboDept.value);
    oDs.setColumn(nNewRow, "salary",   0);
    oDs.setColumn(nNewRow, "joinDate", nexacro.getToday());

    // 새로 추가된 행으로 포커스 이동
    oDs.rowposition = nNewRow;

    trace("행 추가 완료 — 현재 행수: " + oDs.rowcount);
}

// 숫자를 특정 자릿수로 패딩하는 유틸 함수
function fn_makePadLeft(nNum, nLen) {
    var sNum = String(nNum);
    while (sNum.length < nLen) {
        sNum = "0" + sNum;
    }
    return sNum;
}
```

### 행 삭제 (deleteRow vs removeRow)

```javascript
// deleteRow: 서버에 삭제를 통보해야 할 때 사용 (SaveType → D)
// removeRow: 화면에서만 제거할 때 사용 (Dataset에서 완전 제거, 서버 전송 안됨)
function fn_deleteCurrentRow() {
    var oDs = this.dsEmployee;
    var nCurRow = oDs.rowposition;

    if (nCurRow < 0) {
        this.alert("삭제할 행을 선택하세요.");
        return;
    }

    // 신규 행(I)은 서버 삭제 불필요 → removeRow로 완전 제거
    var sSaveType = oDs.getRowSaveType(nCurRow);
    if (sSaveType == "I") {
        oDs.removeRow(nCurRow);
        trace("신규 행 제거 완료");
    } else {
        // 기존 행(N, U) → deleteRow로 D 표시 후 서버에 삭제 요청
        oDs.deleteRow(nCurRow);
        trace("행 삭제 표시 완료 — SaveType: " + oDs.getRowSaveType(nCurRow));
    }
}

// 체크된 행 전체 삭제 패턴
function fn_deleteCheckedRows() {
    var oDs = this.dsEmployee;

    // 뒤에서부터 삭제해야 인덱스 오류가 발생하지 않음
    for (var i = oDs.rowcount - 1; i >= 0; i--) {
        var sChk = oDs.getColumn(i, "chk");
        if (sChk == "1" || sChk == "true") {
            var sSaveType = oDs.getRowSaveType(i);
            if (sSaveType == "I") {
                oDs.removeRow(i);
            } else {
                oDs.deleteRow(i);
            }
        }
    }
    trace("삭제 처리 완료 — 남은 행수: " + oDs.rowcount);
}
```

---

## Dataset 초기화

```javascript
// clearData(): Row 데이터만 삭제 (Column 정의는 유지)
// clear()    : Column 정의까지 모두 삭제
function fn_clearDataset() {
    // 재조회 전 기존 결과 초기화 (Column 정의는 남김)
    this.dsResult.clearData();
    trace("행수 초기화 후: " + this.dsResult.rowcount);  // → 0

    // 완전 초기화가 필요한 경우 (Column 재정의 후 다시 addColumn)
    // this.dsResult.clear();
}
```

---

## 행 검색: findRow / findRowExpr

```javascript
// 특정 열 값으로 행 인덱스 찾기
function fn_findRow() {
    var oDs = this.dsEmployee;

    // findRow(열ID, 찾을값): 해당 값이 있는 첫 번째 행 인덱스 반환
    // 없으면 -1 반환
    var nRow = oDs.findRow("empNo", "EMP001");
    if (nRow < 0) {
        this.alert("해당 사원이 없습니다.");
        return;
    }
    oDs.rowposition = nRow;
    trace("찾은 행 인덱스: " + nRow);

    // findRowExpr(조건식): 조건식을 만족하는 첫 번째 행 인덱스
    var nRowHigh = oDs.findRowExpr("salary >= 5000000");
    trace("급여 500만 이상 첫 행: " + nRowHigh);
}

// 조건을 만족하는 모든 행 인덱스를 배열로 수집
function fn_findAllRows() {
    var oDs   = this.dsEmployee;
    var aDept = [];

    for (var i = 0; i < oDs.rowcount; i++) {
        if (oDs.getColumn(i, "deptCd") == "D001") {
            aDept.push(i);
        }
    }
    trace("D001 부서 사원 행: " + aDept.join(", "));
}
```

---

## 필터와 정렬

```javascript
// 필터: 조건에 맞는 행만 화면에 표시 (데이터는 유지)
function fn_applyFilter() {
    var oDs    = this.dsEmployee;
    var sDept  = this.cboDeptFilter.value;
    var nMinSal = nexacro.toNumber(this.edtMinSalary.value);

    if (nexacro.isNull(sDept) && (isNaN(nMinSal) || nMinSal <= 0)) {
        // 필터 해제
        oDs.filter("");
        trace("필터 해제 — 전체 행수: " + oDs.rowcount);
        return;
    }

    // 조건식 문자열 조합
    var sCondition = "";
    if (!nexacro.isNull(sDept)) {
        sCondition += "deptCd == '" + sDept + "'";
    }
    if (!isNaN(nMinSal) && nMinSal > 0) {
        if (sCondition != "") sCondition += " && ";
        sCondition += "salary >= " + nMinSal;
    }

    oDs.filter(sCondition);
    trace("필터 적용 — 조건: " + sCondition + " / 표시 행수: " + oDs.rowcount);
}

// 정렬: keystring 속성으로 오름차순(A)/내림차순(D) 지정
function fn_sortDataset() {
    var oDs = this.dsEmployee;

    // 급여 내림차순 정렬
    oDs.keystring = "salary:D";

    // 부서코드 오름차순 → 같은 부서 안에서 급여 내림차순
    oDs.keystring = "deptCd:A,salary:D";

    // 정렬 해제 (원래 순서)
    // oDs.keystring = "";

    trace("정렬 완료");
}
```

---

## Dataset 간 데이터 복사

```javascript
// copyData: 다른 Dataset의 내용을 통째로 복사
function fn_copyDataset() {
    // dsSource의 모든 데이터를 dsTarget으로 복사 (Column 정의도 포함)
    this.dsTarget.copyData(this.dsSource);
    trace("복사 완료 — 대상 행수: " + this.dsTarget.rowcount);
}

// 특정 행만 다른 Dataset에 추가
function fn_copySelectedRow() {
    var oSrc = this.dsList;
    var oDst = this.dsSelected;
    var nCurRow = oSrc.rowposition;

    if (nCurRow < 0) return;

    // 대상 Dataset에 행 추가
    var nNewRow = oDst.addRow();

    // 열별로 값 복사
    oDst.setColumn(nNewRow, "empNo",   oSrc.getColumn(nCurRow, "empNo"));
    oDst.setColumn(nNewRow, "empName", oSrc.getColumn(nCurRow, "empName"));
    oDst.setColumn(nNewRow, "deptCd",  oSrc.getColumn(nCurRow, "deptCd"));

    trace("행 복사 완료 — 대상 행수: " + oDst.rowcount);
}
```

---

## Dataset 이벤트: onrowposchanged · onvaluechanged

Dataset도 이벤트를 발생시킵니다. 가장 자주 쓰는 두 가지입니다.

```javascript
// onrowposchanged: 현재 선택 행이 바뀔 때마다 호출
// Grid에서 행을 클릭할 때도 이 이벤트가 발생
function dsEmployee_onrowposchanged(obj, e) {
    // e.newrow: 새로 선택된 행 인덱스
    // e.oldrow: 이전에 선택되었던 행 인덱스
    var nNewRow = e.newrow;
    if (nNewRow < 0) return;

    // 상세 폼 컴포넌트에 선택 행 데이터 표시
    this.edtEmpNo.set_value(obj.getColumn(nNewRow, "empNo"));
    this.edtEmpName.set_value(obj.getColumn(nNewRow, "empName"));
    this.edtSalary.set_value(obj.getColumn(nNewRow, "salary"));
    this.calJoinDate.set_value(obj.getColumn(nNewRow, "joinDate"));

    // 하위 Dataset 연동 조회
    this.fn_loadDetail(obj.getColumn(nNewRow, "empNo"));
}

// onvaluechanged: Dataset의 특정 셀 값이 바뀔 때 호출
function dsEmployee_onvaluechanged(obj, e) {
    // e.col   : 변경된 열 인덱스
    // e.row   : 변경된 행 인덱스
    // e.value : 변경 후 값 (신규값)
    // e.prevalue: 변경 전 값
    var sColId = obj.getColID(e.col);
    trace("Dataset 값 변경 — 행:" + e.row + " 열:" + sColId +
          " (" + e.prevalue + " → " + e.value + ")");

    // 급여가 변경되면 세금 자동 계산
    if (sColId == "salary") {
        var nTax = Math.floor(nexacro.toNumber(e.value) * 0.033);
        obj.setColumn(e.row, "taxAmt", nTax);
    }
}
```

---

## 실무 CRUD 흐름 전체 예시

```javascript
// ─────────────────────────────────────────────
// 1. 조회 (Read)
// ─────────────────────────────────────────────
function fn_search() {
    // 조회 전 Dataset 초기화
    this.dsEmployee.clearData();

    var sParam = "deptCd=" + this.cboDept.value;
    sParam    += "&keyword=" + nexacro.trim(this.edtKeyword.value);

    this.transaction(
        "empList",
        "/service/emp/list.do",
        sParam,
        "dsEmployee=dsEmployee",
        "",
        "fn_callbackSearch"
    );
}

function fn_callbackSearch(svcid, errorcode, errormsg) {
    if (errorcode < 0) {
        this.alert("조회 실패: " + errormsg);
        return;
    }
    this.lblCnt.set_text("총 " + this.dsEmployee.rowcount + "건");
}

// ─────────────────────────────────────────────
// 2. 신규 행 추가 (Create)
// ─────────────────────────────────────────────
function btnAdd_onclick(obj, e) {
    var oDs = this.dsEmployee;
    var nNewRow = oDs.addRow();

    oDs.setColumn(nNewRow, "empNo",   "");
    oDs.setColumn(nNewRow, "empName", "");
    oDs.setColumn(nNewRow, "deptCd", this.cboDept.value);
    oDs.setColumn(nNewRow, "salary",  0);
    oDs.setColumn(nNewRow, "joinDate", nexacro.getToday());

    oDs.rowposition = nNewRow;

    // Grid가 바인딩되어 있으면 자동으로 새 행 포커스
    this.edtEmpName.setFocus();
}

// ─────────────────────────────────────────────
// 3. 수정 (Update) — Grid 인라인 편집 또는 상세폼
// ─────────────────────────────────────────────
function fn_applyEditToDataset() {
    var oDs    = this.dsEmployee;
    var nCurRow = oDs.rowposition;
    if (nCurRow < 0) return;

    // 상세폼에서 편집한 값을 Dataset에 반영
    oDs.setColumn(nCurRow, "empName", this.edtEmpName.value);
    oDs.setColumn(nCurRow, "salary",  nexacro.toNumber(this.edtSalary.value));
    oDs.setColumn(nCurRow, "deptCd",  this.cboDept.value);

    // setColumn 호출 후 RowSaveType이 U로 바뀌었는지 확인
    trace("SaveType: " + oDs.getRowSaveType(nCurRow));
}

// ─────────────────────────────────────────────
// 4. 삭제 (Delete)
// ─────────────────────────────────────────────
function btnDelete_onclick(obj, e) {
    var oDs    = this.dsEmployee;
    var nCurRow = oDs.rowposition;

    if (nCurRow < 0) {
        this.alert("삭제할 행을 선택하세요.");
        return;
    }

    var nRet = this.confirm("선택한 행을 삭제하시겠습니까?");
    if (nRet !== 0) return;

    var sSaveType = oDs.getRowSaveType(nCurRow);
    if (sSaveType == "I") {
        oDs.removeRow(nCurRow);  // 신규 행은 완전 제거
    } else {
        oDs.deleteRow(nCurRow);  // 기존 행은 D 마킹
    }
}

// ─────────────────────────────────────────────
// 5. 저장 (Save) — I/U/D 행을 한 번에 서버 전송
// ─────────────────────────────────────────────
function btnSave_onclick(obj, e) {
    // 변경 행이 있는지 확인
    var oDs    = this.dsEmployee;
    var bDirty = false;
    for (var i = 0; i < oDs.rowcount; i++) {
        var sSt = oDs.getRowSaveType(i);
        if (sSt == "I" || sSt == "U") { bDirty = true; break; }
    }
    if (!bDirty && oDs.getDeletedRowCount() == 0) {
        this.alert("변경된 데이터가 없습니다.");
        return;
    }

    var nRet = this.confirm("저장하시겠습니까?");
    if (nRet !== 0) return;

    // In-Dataset으로 dsEmployee를 통째로 전송 (I/U/D 행 자동 포함)
    this.transaction(
        "empSave",
        "/service/emp/save.do",
        "",
        "",
        "dsEmployee=dsInput",
        "fn_callbackSave"
    );
}

function fn_callbackSave(svcid, errorcode, errormsg) {
    if (errorcode < 0) {
        this.alert("저장 실패: " + errormsg);
        return;
    }
    this.alert("저장되었습니다.");
    this.fn_search();  // 저장 후 재조회로 최신 상태 반영
}
```

---

## 자주 실수하는 패턴

### 실수 1: clearData 대신 clear를 써서 Column 정의를 날림

```javascript
// 잘못된 예: clear()는 Column 정의까지 삭제함
// this.dsEmployee.clear();
// → 이후 addRow(), setColumn() 호출 시 오류 발생

// 올바른 예: 조회 전 데이터만 초기화
function fn_search() {
    this.dsEmployee.clearData();  // Column 정의는 유지, Row만 삭제
    // ...
}
```

### 실수 2: deleteRow 후 인덱스 혼동

```javascript
// 잘못된 예: 앞에서부터 삭제하면 인덱스가 밀림
function fn_deleteAllChecked_wrong() {
    for (var i = 0; i < this.dsEmployee.rowcount; i++) {
        if (this.dsEmployee.getColumn(i, "chk") == "1") {
            this.dsEmployee.deleteRow(i);
            // deleteRow 후 rowcount가 줄어 i가 한 행을 건너뜀
        }
    }
}

// 올바른 예: 뒤에서부터 순회
function fn_deleteAllChecked_correct() {
    var oDs = this.dsEmployee;
    for (var i = oDs.rowcount - 1; i >= 0; i--) {
        if (oDs.getColumn(i, "chk") == "1") {
            var sSt = oDs.getRowSaveType(i);
            if (sSt == "I") { oDs.removeRow(i); }
            else             { oDs.deleteRow(i); }
        }
    }
}
```

### 실수 3: STRING 타입 열에 숫자를 넣을 때 타입 불일치

```javascript
// STRING 컬럼에 숫자를 그대로 넣으면 내부적으로 문자열 변환이 되긴 하지만
// 이후 비교 연산에서 "10" < "9" 같은 문자열 정렬 문제가 생길 수 있음
// 명시적으로 타입을 맞춰 주는 것이 안전

// 컬럼 타입에 맞춰 변환 후 저장
function fn_safeSetColumn() {
    var oDs = this.dsEmployee;
    var nRow = oDs.rowposition;

    // INT 타입 컬럼에는 toNumber()로 변환
    oDs.setColumn(nRow, "salary", nexacro.toNumber(this.edtSalary.value));

    // STRING 타입 컬럼에는 toString()으로 변환
    oDs.setColumn(nRow, "empNo", nexacro.toString(this.edtEmpNo.value));
}
```

---

## 정리: Dataset 핵심 API 요약

| 목적 | 메서드 / 속성 |
|------|-------------|
| 값 읽기 | `getColumn(row, colId)` |
| 값 쓰기 | `setColumn(row, colId, value)` |
| 행 추가 | `addRow()` → 행 인덱스 반환 |
| 행 삽입 | `insertRow(row)` |
| 행 삭제(D 마킹) | `deleteRow(row)` |
| 행 완전 제거 | `removeRow(row)` |
| 데이터 초기화 | `clearData()` |
| 행 포인터 | `rowposition` |
| 총 행수 | `rowcount` |
| SaveType 확인 | `getRowSaveType(row)` → `"N"/"I"/"U"/"D"` |
| 행 검색 | `findRow(colId, val)` / `findRowExpr(expr)` |
| 필터 적용 | `filter(expr)` |
| 정렬 | `keystring = "colId:A"` |
| 삭제 행수 | `getDeletedRowCount()` |

Dataset은 넥사크로 개발의 중심축입니다.
`getColumn` / `setColumn` / `addRow` / `deleteRow` 네 가지만 완벽히 익혀도 대부분의 CRUD 화면을 구현할 수 있습니다.
다음 글에서는 Dataset과 서버를 연결하는 **Transaction** 메커니즘을 다룹니다.

---

**지난 글:** [[Nexacro N] 주요 컴포넌트 한눈에 파악하기](/posts/nexacro-n-components-overview/)

**다음 글:** [[Nexacro N] 레이아웃과 스타일 완전 정복](/posts/nexacro-n-layout-and-style/)

<br>
읽어주셔서 감사합니다. 😊
