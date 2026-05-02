---
title: "[Nexacro N] Grid — 그리드 컴포넌트 개요"
description: "Nexacro N Grid 컴포넌트의 구조(HeadBand·BodyBand·FootBand), bindingInfo, selecttype, oncellclick 이벤트, 행 선택 읽기, 기본 사용 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 8
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "grid", "그리드", "headband", "bodyband", "bindinginfo", "oncellclick"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-menu-navigation/)에서 메뉴 네비게이션을 구현하는 방법을 살펴봤습니다. 이번에는 Nexacro N에서 가장 많이 사용하는 `Grid` 컴포넌트의 기본 구조와 핵심 사용법을 다룹니다. Grid는 데이터 조회·수정·입력을 모두 처리하는 업무 시스템의 핵심 컴포넌트입니다.

## Grid 컴포넌트 구조

Grid는 세 개의 밴드로 구성됩니다.

- **HeadBand**: 열 제목(헤더)을 표시하는 영역
- **BodyBand**: 실제 데이터 행이 반복 렌더링되는 영역
- **FootBand**: 합계·건수 같은 요약 정보를 표시하는 영역

![Grid 컴포넌트 해부도](/assets/posts/nexacro-n-grid-overview-anatomy.svg)

## 기본 XML 구성

```xml
<Grid id="grd_emp"
  left="10" top="10" width="800" height="400"
  bindingInfo="ds_emp"
  selecttype="single"
  readonly="false">
  <Formats>
    <Format id="default">
      <Columns>
        <Column size="80"/>
        <Column size="120"/>
        <Column size="100"/>
        <Column size="120"/>
      </Columns>
      <Rows>
        <Row size="24" band="head"/>
        <Row size="24" band="body"/>
      </Rows>
      <Band id="head">
        <Cell col="0" text="사번"/>
        <Cell col="1" text="성명"/>
        <Cell col="2" text="부서"/>
        <Cell col="3" text="입사일"/>
      </Band>
      <Band id="body">
        <Cell col="0" datacolumn="emp_id"/>
        <Cell col="1" datacolumn="emp_nm"/>
        <Cell col="2" datacolumn="dept_nm"/>
        <Cell col="3" datacolumn="hire_dt"/>
      </Band>
    </Format>
  </Formats>
</Grid>
```

`bindingInfo="ds_emp"`는 연결할 Dataset의 ID입니다. `Columns`에서 각 열의 너비를 정의하고, `Band id="head"`에서 헤더 텍스트를, `Band id="body"`에서 데이터 컬럼을 매핑합니다.

![Grid XML 기본 구조](/assets/posts/nexacro-n-grid-overview-xml.svg)

## 핵심 속성

| 속성 | 설명 | 주요 값 |
|---|---|---|
| `bindingInfo` | 연결할 Dataset ID | `ds_emp` |
| `selecttype` | 행 선택 방식 | `single`, `multi`, `cell` |
| `readonly` | 전체 읽기 전용 여부 | `true`, `false` |
| `showrowcount` | 건수 표시 여부 | `true`, `false` |
| `scrollbars` | 스크롤바 표시 | `autoboth`, `none` |

## 이벤트 처리

가장 자주 사용하는 이벤트입니다.

```javascript
// 셀 클릭
function grd_emp_oncellclick(obj, e) {
  var row = e.row;    // 클릭된 행 인덱스
  var col = e.col;    // 클릭된 열 인덱스
  var val = e.value;  // 클릭된 셀 값

  // 선택된 행의 데이터 읽기
  var empId = this.ds_emp.getColumn(row, "emp_id");
  this.fn_loadDetail(empId);
}

// 행 변경 (키보드 이동 포함)
function grd_emp_onrowchanged(obj, e) {
  var curRow = e.row;  // 변경 후 현재 행
}
```

`oncellclick`의 `e.row`는 Grid의 보이는 행 인덱스로, Dataset의 `rowposition`과 자동으로 동기화됩니다.

## 행 선택 정보 읽기

```javascript
function fn_getSelectedRow() {
  // 현재 선택된 행 인덱스
  var curRow = this.grd_emp.currentrow;

  // 선택된 행의 컬럼 값 읽기
  var empNm = this.ds_emp.getColumn(curRow, "emp_nm");
  return empNm;
}
```

`currentrow` 속성은 현재 포커스가 있는 행의 인덱스입니다. Dataset의 `rowposition`과 같은 값입니다.

## multi 선택 모드

`selecttype="multi"`로 설정하면 Ctrl+클릭, Shift+클릭으로 여러 행을 선택할 수 있습니다.

```javascript
function fn_getMultiSelected() {
  var rows = [];
  for (var i = 0; i < this.ds_emp.rowcount; i++) {
    if (this.grd_emp.isSelectedRow(i)) {
      rows.push(i);
    }
  }
  return rows;
}
```

`isSelectedRow(rowIndex)`로 특정 행이 선택됐는지 확인합니다.

## 스크립트로 특정 행 이동

```javascript
// 그리드 특정 행으로 이동
this.grd_emp.setFocus(targetRow, 0);

// Dataset rowposition과 동기화
this.ds_emp.set_rowposition(targetRow);
```

`setFocus(row, col)`로 그리드 포커스를 이동합니다. Dataset의 `rowposition`을 변경하면 그리드도 자동으로 해당 행으로 스크롤됩니다.

## 그리드 새로고침

Dataset 데이터가 바뀌면 그리드는 자동으로 갱신됩니다. 강제 갱신이 필요한 경우에만 `redraw()`를 호출합니다.

```javascript
// 강제 재렌더링 (일반적으로 불필요)
this.grd_emp.redraw();
```

## 정리

`Grid`는 Nexacro N의 가장 복잡하고 강력한 컴포넌트입니다. `HeadBand-BodyBand-FootBand` 구조와 `bindingInfo`를 이해하면 기본 그리드는 바로 만들 수 있습니다. 다음 글부터 Format Editor, 셀 타입, 스타일, 다중 헤더 등 그리드의 심화 기능을 차례로 다룹니다.

---

**지난 글:** [Nexacro N Menu · Navigation — 메뉴 네비게이션 구현](/posts/nexacro-n-menu-navigation/)

**다음 글:** [Nexacro N Grid Format Editor — 그리드 포맷 에디터 활용](/posts/nexacro-n-grid-format-editor/)

<br>
읽어주셔서 감사합니다. 😊
