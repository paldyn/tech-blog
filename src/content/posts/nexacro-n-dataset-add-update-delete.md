---
title: "[Nexacro N] Dataset 행 추가·수정·삭제"
description: "Nexacro N Dataset의 addRow, insertRow, insertCopyRow, setColumn, deleteRow API를 사용법과 rowType 변화까지 포함해 체계적으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 5
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "dataset", "addRow", "setColumn", "deleteRow", "insertRow", "insertCopyRow", "crud"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-dataset-saved-org/)에서 savedOrg로 원본 값을 보관하는 구조를 살펴봤습니다. 이번에는 Dataset을 실제로 다루는 핵심 연산인 **행 추가·수정·삭제**를 다룹니다. 이 세 가지를 정확히 이해하면 Nexacro N의 CRUD 패턴 대부분을 짤 수 있습니다.

## 행 추가 — addRow()

`addRow()`는 Dataset의 **마지막 행 뒤에 빈 행을 하나 추가**하고, 새로 추가된 행의 인덱스를 반환합니다.

```javascript
function btn_add_onclick(obj, e) {
    var ds = this.dsSave;
    var r = ds.addRow();          // 새 행 인덱스 반환
    ds.setColumn(r, "EMP_CD", "");
    ds.setColumn(r, "EMP_NM", "");
    ds.setColumn(r, "USE_YN", "Y");  // 기본값 세팅
    ds.currentrow = r;            // 그리드 포커스 이동
}
```

새 행의 rowType은 자동으로 **INSERT(2)**가 됩니다.

![Dataset 행 추가·수정·삭제 흐름](/assets/posts/nexacro-n-dataset-add-update-delete-flow.svg)

## 특정 위치에 삽입 — insertRow()

`addRow()`는 항상 마지막에 추가되지만, `insertRow(index)`는 지정한 인덱스 위치에 삽입합니다.

```javascript
// 현재 선택 행 바로 앞에 삽입
var pos = this.dsSave.currentrow;
var r = this.dsSave.insertRow(pos);
```

## 기존 행 복사 삽입 — insertCopyRow()

기존 행의 값을 그대로 복사해서 바로 아래에 삽입합니다. 유사한 데이터를 빠르게 여러 건 추가할 때 유용합니다.

```javascript
// 현재 행을 복사해서 다음 위치에 삽입
var src = this.dsSave.currentrow;
var r = this.dsSave.insertCopyRow(src + 1, src);
// 복사된 행의 키 컬럼 초기화
this.dsSave.setColumn(r, "EMP_CD", "");
```

## 행 수정 — setColumn()

`setColumn(rowIndex, colName, value)` 로 특정 행·컬럼의 값을 변경합니다.

```javascript
var i = this.dsSave.currentrow;
this.dsSave.setColumn(i, "EMP_NM", "홍길동");
// NORMAL(1) → UPDATE(4)
// INSERT(2) 행에 setColumn → rowType은 여전히 INSERT(2)
```

컬럼을 지정할 때 이름 대신 컬럼 **인덱스**를 쓸 수도 있습니다.

```javascript
// 컬럼 인덱스로 접근 (0-based)
this.dsSave.setColumn(i, 1, "홍길동"); // 1번 컬럼
```

## 행 삭제 — deleteRow()

```javascript
function btn_delete_onclick(obj, e) {
    var ds = this.dsSave;
    var sel = ds.currentrow;
    if (sel < 0) {
        alert("삭제할 행을 선택하세요.");
        return;
    }
    ds.deleteRow(sel);
    // NORMAL → DELETE(8), INSERT → 완전 제거
}
```

![행 추가·수정·삭제 코드 패턴](/assets/posts/nexacro-n-dataset-add-update-delete-code.svg)

## 다중 행 선택 삭제

그리드에서 체크박스로 여러 행을 선택하고 삭제하는 패턴입니다. **역순 순회**가 핵심입니다.

```javascript
function fn_deleteChecked() {
    var ds = this.dsSave;
    // 뒤에서 앞으로 순회 (인덱스 밀림 방지)
    for (var i = ds.rowcount - 1; i >= 0; i--) {
        if (ds.getColumn(i, "CHK_YN") == "Y") {
            ds.deleteRow(i);
        }
    }
}
```

앞에서부터 삭제하면 인덱스가 밀려 원하는 행을 삭제하지 못할 수 있으므로 반드시 역순으로 순회합니다.

## clearData() vs deleteRow() 전체 삭제

모든 행을 한 번에 비울 때는 `clearData()`가 편리합니다.

```javascript
// 전체 행 삭제 (컬럼 정의는 유지)
this.dsSave.clearData();

// 컬럼 정의까지 모두 초기화
this.dsSave.clear();
```

`clearData()`는 컬럼 구조를 유지하고 데이터만 비웁니다. `clear()`는 컬럼 정의까지 초기화하므로 동적으로 컬럼을 다시 추가하거나 `loadXML()`로 새로 로드할 때 씁니다.

---

**지난 글:** [[Nexacro N] Dataset savedOrg — 원본 데이터 보관](/posts/nexacro-n-dataset-saved-org/)

**다음 글:** [[Nexacro N] Dataset 행 순회 패턴](/posts/nexacro-n-dataset-iteration/)

<br>
읽어주셔서 감사합니다. 😊
