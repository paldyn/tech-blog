---
title: "[Nexacro N] Grid 트러블슈팅"
description: "Nexacro N Grid 개발에서 자주 발생하는 문제(빈 Grid, 콤보 목록 없음, 변경 미전송, 스크롤 스타일 오염 등)의 원인과 해결책, 그리고 trace()를 활용한 디버깅 체크포인트를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 9
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "grid", "트러블슈팅", "디버깅", "trace", "문제해결"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-grid-render-tuning/)에서 Grid 렌더링 성능 최적화를 다뤘습니다. Grid 시리즈의 마지막으로, 실무에서 가장 자주 마주치는 Grid 문제들의 원인과 해결책을 정리합니다. 문제가 발생했을 때 이 글을 빠른 참조 가이드로 활용하기 바랍니다.

## 문제 1: Grid가 텅 비어 보인다

**증상**: 트랜잭션 후 Dataset에 데이터가 들어왔는데 Grid에 아무것도 표시되지 않는다.

**원인**:
- `bindeddataset` 속성이 Dataset ID와 일치하지 않는다.
- Dataset이 Grid와 다른 Form에 선언되어 있고 경로가 맞지 않는다.
- Grid 컴포넌트의 `visible = false` 상태이다.

**해결**:
```javascript
function fn_debugEmpty() {
    trace("bindeddataset=" + grd.bindeddataset);
    trace("ds.rowcount=" + ds.rowcount);
    trace("grd.visible=" + grd.visible);
    trace("grd.width=" + grd.width + ", height=" + grd.height);
}
```

`trace()` 출력으로 연결 상태를 먼저 확인합니다. `rowcount`가 0이면 트랜잭션 문제이고, 0보다 크면 바인딩이나 가시성 문제입니다.

![Grid 자주 발생하는 문제와 원인](/assets/posts/nexacro-n-grid-troubleshooting-cases.svg)

## 문제 2: 콤보 셀 드롭다운 목록이 비어 있다

**증상**: `edittype="combo"`로 설정한 셀을 클릭해도 드롭다운이 열리지 않거나 빈 목록이 나온다.

**원인**:
- `bindingcodedataset`이 연결되지 않았다.
- `bindingcodedataset`이 연결됐지만 해당 Dataset의 데이터가 아직 로드되지 않았다.
- `codecolumn` 또는 `datacolumn` ID가 Dataset 컬럼명과 다르다.

**해결**:
```javascript
function fn_debugCombo() {
    var oCol = grd.getColumnById("colDeptCd");
    trace("bindingcodedataset=" + oCol.bindingcodedataset);
    trace("codecolumn=" + oCol.codecolumn);
    trace("datacolumn=" + oCol.datacolumn);

    var dsCode = eval(oCol.bindingcodedataset);
    trace("코드 Dataset 행수=" + (dsCode ? dsCode.rowcount : "없음"));
}
```

코드 Dataset이 비어 있다면 공통 코드 로드 트랜잭션이 Grid 렌더링보다 늦게 완료된 것입니다. 코드 로드 콜백 함수 안에서 `bindingcodedataset`을 재연결합니다.

```javascript
function fn_loadCodeCb(svcId, errCode, errMsg) {
    // 코드 로드 완료 후 바인딩
    grd.getColumnById("colDeptCd").bindingcodedataset = "dsDeptCode";
}
```

![Grid 디버깅 체크포인트 코드](/assets/posts/nexacro-n-grid-troubleshooting-debug.svg)

## 문제 3: 편집 후 저장 시 변경 사항이 서버에 전달되지 않는다

**증상**: Grid에서 값을 수정한 뒤 저장 버튼을 누르면 서버에서 변경 데이터를 받지 못한다.

**원인**:
- Dataset의 `rowType`이 여전히 `NORMAL(1)`이다. 즉, 편집이 Dataset에 반영되지 않았다.
- 트랜잭션 `argvariables`에서 Dataset을 `ds=` 형식으로만 전달하고 있지 않다.

**해결**:
```javascript
function fn_checkRowTypes() {
    for (var r = 0; r < ds.rowcount; r++) {
        var nType = ds.getRowType(r);
        trace("row[" + r + "] rowType=" + nType);
        // 1: NORMAL, 2: INSERT, 4: UPDATE, 8: DELETE
    }
    trace("총 변경 행=" + ds.getUpdatedRowCount());
}
```

`ds.getUpdatedRowCount()`가 0이면 Dataset에 변경 플래그가 없는 것입니다. Grid의 `edittype="none"`인 열은 사용자가 편집해도 Dataset에 반영되지 않습니다. 또한 스크립트에서 직접 `ds.setColumn()`으로 값을 바꿀 때도 rowType이 UPDATE로 바뀝니다.

## 문제 4: 스크롤 시 배경색이 엉뚱한 행에 나타난다

**증상**: 가상화 Grid에서 오류 행 배경색을 `setCellBackgroundColor()`로 설정했는데, 스크롤 후 다른 행에 색이 표시된다.

**원인**: 가상화는 DOM을 재사용합니다. `setCellBackgroundColor()`로 특정 DOM에 색을 칠했는데, 스크롤 후 그 DOM이 다른 행 데이터를 표시하면서 이전 색이 그대로 남습니다.

**해결**: `setCellBackgroundColor()` 대신 `oncellstyle` 이벤트에서 스타일을 지정합니다. 이 이벤트는 DOM이 재사용될 때마다 호출되므로 항상 올바른 스타일이 적용됩니다.

```javascript
// 가상화 환경에서 올바른 스타일 적용 방법
function grd_oncellstyle(obj, e) {
    var sState = ds.getColumn(e.row, "STATE");
    if (sState == "ERR") {
        e.backgroundColor = "rgba(224,85,85,0.2)";
        e.foreColor = "#ff4444";
    } else {
        e.backgroundColor = ""; // 반드시 초기화
        e.foreColor = "";
    }
}
```

`else` 분기에서 색을 빈 문자열로 초기화하는 것이 핵심입니다. 초기화하지 않으면 이전 DOM의 색이 유지됩니다.

## 문제 5: addRow + setColumn 후 oncellchange가 발생하지 않는다

**증상**: 새 행을 추가하고 `setColumn()`으로 값을 설정했는데 `oncellchange` 이벤트가 발생하지 않는다.

**원인**: `oncellchange`는 Grid에서 사용자 편집에 의해 값이 변경될 때 발생합니다. 스크립트에서 `ds.setColumn()`을 직접 호출하는 것은 편집이 아니라 프로그램 변경이므로 이벤트가 발생하지 않습니다.

**해결**: `setColumn()` 직후 연동 함수를 명시적으로 호출합니다.

```javascript
function fn_addRow() {
    var nRow = ds.addRow();
    ds.setColumn(nRow, "QTY", "10");
    ds.setColumn(nRow, "PRICE", "5000");
    // oncellchange 대신 직접 계산 함수 호출
    fn_calcAmt(nRow);
}
```

## 문제 6: Grid 행 높이가 의도와 다르게 나온다

**증상**: `rowheight`를 설정했는데 특정 행만 높이가 다르게 나온다.

**원인**: `autorowheight="true"` 속성이 활성화되어 있거나, 특정 셀의 `height` 속성이 직접 지정되어 있다.

**해결**:
```javascript
// autorowheight 비활성화
grd.set_autorowheight(false);
grd.set_rowheight(24);

// 개별 행 높이 리셋
grd.setRowHeight(-1, 24); // -1은 모든 행에 적용
```

## 문제 7: Grid 클릭 후 oncellclick이 발생하지 않는다

**증상**: Grid 셀을 클릭해도 `oncellclick` 이벤트 핸들러가 실행되지 않는다.

**원인**:
- 이벤트 핸들러가 등록되지 않았다(디자인 패널에서 연결 누락).
- 다른 투명 컴포넌트가 Grid 위에 겹쳐 있어 클릭을 가로채고 있다.
- Grid의 `enable = false` 상태이다.

**해결**:
```javascript
// 이벤트 동적 연결 확인
trace("oncellclick handler=" + typeof(grd.oncellclick));
trace("grd.enable=" + grd.enable);

// 동적 연결
grd.oncellclick = fn_grdClick;
```

## 공통 디버깅 루틴

문제가 발생하면 다음 순서로 점검합니다.

```javascript
function fn_gridDiagnostic() {
    // 1. 기본 상태
    trace("=== Grid Diagnostic ===");
    trace("grd.name=" + grd.name);
    trace("grd.bindeddataset=" + grd.bindeddataset);
    trace("grd.enable=" + grd.enable);
    trace("grd.visible=" + grd.visible);

    // 2. Dataset 상태
    trace("ds.rowcount=" + ds.rowcount);
    trace("ds.colcount=" + ds.colcount);
    trace("ds.updatedRowCount=" + ds.getUpdatedRowCount());

    // 3. 현재 포커스
    trace("currentrowindex=" + grd.currentrowindex);
    trace("currentcolindex=" + grd.currentcolindex);
}
```

이 진단 함수를 문제 재현 직후에 호출하면 대부분의 원인을 빠르게 파악할 수 있습니다.

---

**지난 글:** [Grid 렌더링 최적화](/posts/nexacro-n-grid-render-tuning/)

**다음 글:** [Dataset 개요 — 데이터의 심장](/posts/nexacro-n-dataset-overview/)

<br>
읽어주셔서 감사합니다. 😊
