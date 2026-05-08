---
title: "[Nexacro N] Grid 엑셀 단축키 설정"
description: "Nexacro N Grid에서 keyactiontype, keyhandler 속성과 onkeydown 이벤트를 활용해 Enter·Tab·F2·Delete 키를 엑셀처럼 동작시키는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 4
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "grid", "단축키", "keydown", "keyactiontype", "excel", "키보드"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-grid-cell-validation/)에서 Grid 셀 유효성 검사 패턴을 살펴봤습니다. Grid 기반 입력 화면에서 사용자 생산성을 높이려면 키보드로 자연스럽게 셀을 이동하고 편집할 수 있어야 합니다. 이번 글에서는 엑셀처럼 Grid를 키보드로 다루는 설정 방법을 정리합니다.

## 기본 키 동작과 문제점

Nexacro N Grid의 기본 키 동작은 엑셀과 다소 다릅니다.

- **Enter**: 편집을 완료하지만 행 이동이 없음
- **Tab**: Grid를 벗어나 다음 컴포넌트로 포커스 이동
- **F2**: 별도 설정이 없으면 아무 동작 없음

업무 시스템에서 데이터 입력이 많은 화면이라면 이 동작을 엑셀 스타일로 바꾸는 것이 UX 향상에 크게 도움이 됩니다.

![Grid 엑셀 스타일 단축키 비교](/assets/posts/nexacro-n-grid-excel-shortcuts-table.svg)

## keyactiontype 속성

Grid의 `keyactiontype` 속성으로 Tab/Enter 키의 이동 방향을 설정할 수 있습니다.

```xml
<Grid id="grd" keyactiontype="excel" ... />
```

| 값 | Enter 동작 | Tab 동작 |
|---|---|---|
| `"default"` | 편집 확인 | 다음 컴포넌트 |
| `"excel"` | 다음 행으로 이동 | 다음 열로 이동 |
| `"tab"` | 다음 열로 이동 | 다음 열로 이동 |

`keyactiontype="excel"`만 설정해도 기본적인 엑셀 스타일 내비게이션이 됩니다. 런타임에도 변경 가능합니다.

```javascript
grd.set_keyactiontype("excel");
```

## onkeydown으로 세밀한 제어

`keyactiontype`으로 커버되지 않는 단축키는 `onkeydown` 이벤트 핸들러에서 직접 처리합니다.

![onkeydown 단축키 커스터마이징 코드](/assets/posts/nexacro-n-grid-excel-shortcuts-code.svg)

```javascript
function grd_onkeydown(obj, e) {
    var nKey = e.keycode;

    // Enter → 다음 행 이동
    if (nKey == 13) {
        var nNext = obj.currentrowindex + 1;
        if (nNext < ds.rowcount) {
            obj.setCurrentRowIndex(nNext);
        }
        e.cancel = true; // 기본 동작 방지
        return;
    }

    // F2 → 셀 편집 진입
    if (nKey == 113) {
        obj.beginEdit(obj.currentrowindex, obj.currentcolindex);
        e.cancel = true;
        return;
    }

    // Delete → 현재 셀 값 삭제
    if (nKey == 46) {
        var r = obj.currentrowindex;
        var c = obj.getColumnId(obj.currentcolindex);
        ds.setColumn(r, c, "");
        e.cancel = true;
        return;
    }
}
```

`e.cancel = true`는 기본 키 동작(특히 브라우저 기본 동작)을 막아 줍니다. 이를 생략하면 커스텀 동작과 기본 동작이 중복 실행될 수 있습니다.

## 주요 키코드 참고표

| 키 | keycode | 비고 |
|---|---|---|
| Enter | 13 | |
| Tab | 9 | |
| Escape | 27 | 편집 취소 |
| Delete | 46 | 셀 값 삭제 |
| BackSpace | 8 | |
| F2 | 113 | |
| F5 | 116 | 브라우저 새로고침 주의 |
| ↑ / ↓ | 38 / 40 | |
| ← / → | 37 / 39 | |
| Ctrl+C | e.ctrlkey && 67 | 복사 |
| Ctrl+V | e.ctrlkey && 86 | 붙여넣기 |

`e.ctrlkey`, `e.shiftkey`, `e.altkey`로 조합키를 확인할 수 있습니다.

## Escape로 편집 취소

엑셀에서 Escape를 누르면 편집이 취소되고 이전 값으로 돌아갑니다. Nexacro N에서도 같은 동작을 구현할 수 있습니다.

```javascript
function grd_onkeydown(obj, e) {
    if (e.keycode == 27) { // Escape
        obj.cancelEdit();  // 편집 중이면 취소
        e.cancel = true;
    }
}
```

`cancelEdit()`은 편집 상태를 중단하고 Dataset 원래 값으로 복원합니다. 편집 중이 아닐 때 호출해도 오류가 발생하지 않습니다.

## Tab으로 같은 행 내 이동 (열 순서 제어)

특정 열만 Tab으로 이동하고 싶다면, `onkeydown`에서 편집 가능한 다음 열 인덱스를 계산합니다.

```javascript
function grd_onkeydown(obj, e) {
    if (e.keycode != 9) return; // Tab만 처리

    var aEditCols = [
        obj.getColumnIndex("NAME"),
        obj.getColumnIndex("QTY"),
        obj.getColumnIndex("PRICE")
    ];

    var nCurCol = obj.currentcolindex;
    var nNextIdx = -1;
    for (var i = 0; i < aEditCols.length; i++) {
        if (aEditCols[i] > nCurCol) {
            nNextIdx = aEditCols[i];
            break;
        }
    }

    if (nNextIdx >= 0) {
        obj.setCurrentCell(obj.currentrowindex, nNextIdx);
    } else {
        // 마지막 열이면 다음 행 첫 편집 열로
        var nNextRow = obj.currentrowindex + 1;
        if (nNextRow < ds.rowcount) {
            obj.setCurrentCell(nNextRow, aEditCols[0]);
        }
    }
    e.cancel = true;
}
```

## Ctrl+Z 실행 취소 패턴

Grid에 자체적인 Undo 기능은 없지만, Dataset의 `undoUpdate()` / `undoInsert()` / `undoDelete()`로 마지막 변경을 취소할 수 있습니다.

```javascript
function grd_onkeydown(obj, e) {
    if (e.ctrlkey && e.keycode == 90) { // Ctrl+Z
        var nRow = obj.currentrowindex;
        var nType = ds.getRowType(nRow);
        if (nType == Dataset.ROWTYPE_UPDATE) {
            ds.undoUpdate(nRow);
        } else if (nType == Dataset.ROWTYPE_INSERT) {
            ds.undoInsert(nRow);
        }
        e.cancel = true;
    }
}
```

`undoUpdate()`는 해당 행의 모든 컬럼을 수정 전 값으로 돌립니다. 셀 단위 실행 취소는 Dataset API만으로는 구현하기 어려우므로, 이전 값을 별도 변수에 보관해 두는 방식이 필요합니다.

## 실무 팁

- `keyactiontype="excel"` 설정 후 Tab이 Grid 내에서 이동하지 않는다면, Grid의 `taborder`가 잘못 설정된 경우가 많습니다.
- `onkeydown`에서 `e.cancel = true`를 남발하면 브라우저 기본 단축키까지 막힐 수 있습니다. F5(새로고침), Ctrl+S(저장) 등은 처리 후 명시적으로 cancel 여부를 결정합니다.
- 모바일·태블릿 환경에서는 `onkeydown`이 발생하지 않을 수 있으므로, 키보드 단축키 의존도를 높이기 전에 배포 환경을 확인합니다.

---

**지난 글:** [Grid 셀 유효성 검사](/posts/nexacro-n-grid-cell-validation/)

**다음 글:** [Grid 클립보드(복사·붙여넣기)](/posts/nexacro-n-grid-clipboard/)

<br>
읽어주셔서 감사합니다. 😊
