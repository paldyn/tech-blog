---
title: "[Nexacro N] Grid 셀 유효성 검사"
description: "Nexacro N Grid에서 oncelleditend 이벤트를 활용해 필수값·범위·형식 검사를 수행하고, setCellBackgroundColor로 오류 셀을 강조하는 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "grid", "validation", "oncelleditend", "setCellBackgroundColor", "유효성검사"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-grid-cell-events/)에서 Grid 셀 이벤트의 발생 순서와 이벤트 객체 활용법을 살펴봤습니다. 이번에는 실무에서 빠질 수 없는 **Grid 셀 유효성 검사** 패턴을 정리합니다. 어느 이벤트에서 검사할지, 실패 시 어떻게 사용자에게 알릴지까지 단계별로 설명합니다.

## 언제 검사할까?

Grid 셀 유효성 검사는 크게 두 시점에서 수행합니다.

| 시점 | 이벤트 | 특징 |
|---|---|---|
| 셀 편집 완료 시 | `oncelleditend` | 즉각적, 셀 단위 취소 가능 |
| 저장 버튼 클릭 시 | `btnSave_onclick` | Dataset 전체 순회, 종합 오류 목록 |

두 방식을 함께 쓰는 것이 일반적입니다. 셀 편집 시점에는 간단한 형식·범위 체크를 하고, 저장 시점에는 전체 행을 순회하며 필수값 누락이나 업무 규칙 위반을 최종 확인합니다.

![Grid 셀 유효성 검사 흐름](/assets/posts/nexacro-n-grid-cell-validation-flow.svg)

## oncelleditend에서 셀 단위 검사

편집이 끝나는 순간 `e.newvalue`를 검사하고, 실패하면 `e.cancel = true`로 편집을 원복합니다.

```javascript
function grd_oncelleditend(obj, e) {
    var sColId = obj.getColumnId(e.col);
    var sVal   = e.newvalue;

    if (sColId == "EMAIL") {
        var reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (sVal && !reEmail.test(sVal)) {
            fn_markError(obj, e.row, e.col, "이메일 형식이 올바르지 않습니다.");
            e.cancel = true;
            return;
        }
    }

    if (sColId == "QTY") {
        var nQty = parseInt(sVal);
        if (isNaN(nQty) || nQty < 1 || nQty > 9999) {
            fn_markError(obj, e.row, e.col, "수량은 1 ~ 9999 사이로 입력하세요.");
            e.cancel = true;
            return;
        }
    }

    fn_clearError(obj, e.row, e.col);
}
```

![Grid 셀 유효성 검사 코드 패턴](/assets/posts/nexacro-n-grid-cell-validation-code.svg)

## 오류 표시 헬퍼 함수

오류를 표시하고 제거하는 작업은 공통 함수로 분리해 두면 여러 Grid에서 재사용할 수 있습니다.

```javascript
function fn_markError(grd, nRow, nCol, sMsg) {
    grd.setCellBackgroundColor(nRow, nCol, "rgba(224,85,85,0.3)");
    grd.setCellForeColor(nRow, nCol, "#ff4444");
    stcErrMsg.set_text(sMsg);
    stcErrMsg.set_visible(true);
}

function fn_clearError(grd, nRow, nCol) {
    grd.setCellBackgroundColor(nRow, nCol, "");
    grd.setCellForeColor(nRow, nCol, "");
}
```

`stcErrMsg`는 화면 하단에 배치한 `Static` 컴포넌트로, 오류 메시지를 비블로킹 방식으로 표시합니다. `alert()`은 사용자 흐름을 끊기 때문에 입력이 많은 Grid에서는 이 패턴이 더 자연스럽습니다.

## 저장 시 전체 Grid 일괄 검사

저장 버튼 핸들러에서 Dataset을 순회하며 변경 행만 검사합니다.

```javascript
function btnSave_onclick(obj, e) {
    var bValid = true;
    var nRowCnt = ds.rowcount;

    for (var i = 0; i < nRowCnt; i++) {
        var nStatus = ds.getRowType(i);
        // 추가/수정 행만 검사
        if (nStatus == Dataset.ROWTYPE_INSERT ||
            nStatus == Dataset.ROWTYPE_UPDATE) {

            var sName = ds.getColumn(i, "NAME");
            var sQty  = ds.getColumn(i, "QTY");

            if (!sName) {
                alert((i + 1) + "행: 이름은 필수 입력입니다.");
                grd.setCurrentRowIndex(i);
                bValid = false;
                break;
            }
            if (parseInt(sQty) < 1) {
                alert((i + 1) + "행: 수량은 1 이상이어야 합니다.");
                grd.setCurrentRowIndex(i);
                bValid = false;
                break;
            }
        }
    }

    if (bValid) {
        fn_save();
    }
}
```

오류가 발생한 행으로 Grid 포커스를 이동시켜(`setCurrentRowIndex`) 사용자가 바로 수정할 수 있게 합니다.

## 셀 배경색 일괄 초기화

저장 또는 조회 후 오류 표시를 모두 지우려면 Dataset의 모든 셀을 순회합니다.

```javascript
function fn_clearAllErrors() {
    var nCols = grd.getColumnCount();
    var nRows = ds.rowcount;
    for (var r = 0; r < nRows; r++) {
        for (var c = 0; c < nCols; c++) {
            grd.setCellBackgroundColor(r, c, "");
            grd.setCellForeColor(r, c, "");
        }
    }
}
```

조회 버튼 클릭 이벤트 첫 줄에 이 함수를 호출하면, 이전 오류 표시가 새 데이터로 덮이지 않고 깔끔하게 초기화됩니다.

## 콤보·체크박스 셀 검사 주의사항

`edittype="combo"` 셀의 `oncelleditend`에서 `e.newvalue`는 **codecolumn 값**(코드)입니다. `datacolumn`의 표시 텍스트가 아닙니다. 유효한 코드인지 확인하려면 bindingcodedataset에서 해당 코드를 찾아야 합니다.

```javascript
function grd_oncelleditend(obj, e) {
    if (obj.getColumnId(e.col) == "DEPT_CD") {
        var nIdx = dsDept.findRow("DEPT_CD", e.newvalue);
        if (nIdx < 0) {
            fn_markError(obj, e.row, e.col, "유효하지 않은 부서 코드입니다.");
            e.cancel = true;
        }
    }
}
```

체크박스 셀은 클릭만으로 값이 토글되므로 `oncelleditend`가 발생하지 않습니다. 체크 상태 변화를 감지하려면 `oncellchange`를 사용합니다.

## 정규식을 이용한 형식 검사

| 대상 | 정규식 | 비고 |
|---|---|---|
| 숫자만 | `/^\d+$/` | 소수점 포함 시 `/^\d+(\.\d+)?$/` |
| 날짜 YYYYMMDD | `/^\d{8}$/` | 추가 범위 검사 별도 필요 |
| 사업자번호 | `/^\d{3}-\d{2}-\d{5}$/` | 하이픈 포함 형식 |
| 전화번호 | `/^0\d{1,2}-\d{3,4}-\d{4}$/` | |

정규식은 형식만 확인합니다. 날짜의 월/일이 실제로 유효한지(2월 30일 방지 등)는 별도 Date 파싱 검사를 추가합니다.

---

**지난 글:** [Grid 셀 이벤트 완전 정복](/posts/nexacro-n-grid-cell-events/)

**다음 글:** [Grid 엑셀 단축키 설정](/posts/nexacro-n-grid-excel-shortcuts/)

<br>
읽어주셔서 감사합니다. 😊
