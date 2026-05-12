---
title: "[Nexacro N] fn_delete() 삭제 처리 패턴"
description: "Nexacro N CRUD 패턴의 삭제 함수 fn_delete()를 구현하는 방법—행 선택 검증, confirm 다이얼로그, deleteRow()의 INSERT/NORMAL 행 처리 차이, 다중 행 삭제—을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 9
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "fn_delete", "deleteRow", "rowStatus", "CRUD", "삭제"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-update-tracking/)에서 rowStatus 기반 변경 추적을 살펴봤다. 이번에는 CRUD 패턴의 세 번째 단계인 `fn_delete()` 삭제 함수를 구현한다. Nexacro N에서 삭제는 서버에 즉시 요청하지 않고 Dataset의 `deleteRow()`로 논리 삭제만 처리한 뒤 fn_save() 시 서버로 전송하는 것이 표준 패턴이다.

## fn_delete() 기본 흐름

![fn_delete() 흐름도](/assets/posts/nexacro-n-fn-delete-flow.svg)

삭제 처리는 반드시 세 가지 확인을 거쳐야 한다.

1. **행 선택 여부**: Grid에서 행이 선택되어 있는지 확인 (`currentrow >= 0`)
2. **사용자 최종 확인**: `confirm()` 다이얼로그로 실수 삭제 방지
3. **deleteRow() 실행**: 선택된 행을 논리 삭제 처리

## 기본 구현

![fn_delete() 코드](/assets/posts/nexacro-n-fn-delete-code.svg)

```javascript
function fn_delete() {
  var row = this.Grid00.currentrow;

  // ① 행 선택 확인
  if (row < 0) {
    alert("삭제할 행을 선택하세요.");
    return;
  }

  // ② 사용자 확인 다이얼로그
  if (!confirm("선택한 행을 삭제하시겠습니까?")) {
    return;
  }

  // ③ 논리 삭제 실행
  this.ds_list.deleteRow(row);
  // fn_save()에서 서버 DELETE 전송됨
}
```

## INSERT vs NORMAL 행의 deleteRow() 동작 차이

`deleteRow()`는 행의 현재 rowStatus에 따라 다르게 동작한다.

| 행 상태 | deleteRow() 결과 | 서버 처리 |
|---------|-----------------|----------|
| NORMAL (1) | rowStatus → DELETE(8), Grid 숨김 | fn_save() 시 서버 DELETE |
| INSERT (2) | Dataset에서 완전 제거 | 서버 요청 없음 |
| UPDATE (4) | rowStatus → DELETE(8), Grid 숨김 | fn_save() 시 서버 DELETE |

아직 서버에 저장되지 않은 신규 행(INSERT)은 삭제 시 Dataset에서 즉시 제거된다. 서버 전송 기록이 없으므로 DELETE 요청을 보낼 필요가 없기 때문이다.

## 다중 행 삭제

체크박스를 통해 여러 행을 한 번에 삭제하려면 역방향으로 순회해야 한다. 앞에서부터 삭제하면 행 인덱스가 밀려 올바른 행을 삭제하지 못할 수 있다.

```javascript
function fn_deleteMulti() {
  var deleted = 0;
  // 역순 순회 (뒤에서 앞으로)
  for (var i = this.ds_list.rowcount - 1; i >= 0; i--) {
    if (this.ds_list.getColumn(i, "CHK_YN") === "Y") {
      this.ds_list.deleteRow(i);
      deleted++;
    }
  }
  if (deleted === 0) {
    alert("삭제할 행을 선택하세요.");
    return;
  }
  if (!confirm(deleted + "건을 삭제하시겠습니까?")) {
    // confirm을 루프 전에 하거나 restorePoint()로 취소 처리
    this.ds_list.restorePoint();
  }
}
```

실무에서는 confirm을 루프 전에 먼저 띄우는 패턴이 더 자연스럽다.

## 상위 레코드 삭제 시 하위 레코드 처리

마스터-디테일 구조에서 마스터 행을 삭제할 때는 디테일 Dataset도 함께 처리해야 한다.

```javascript
function fn_deleteMaster() {
  var masterRow = this.Grid00.currentrow;
  if (masterRow < 0) {
    alert("삭제할 항목을 선택하세요.");
    return;
  }
  if (!confirm("관련 상세 정보도 함께 삭제됩니다.")) return;

  // 마스터 삭제
  this.ds_master.deleteRow(masterRow);

  // 연관 디테일 모두 삭제
  for (var i = this.ds_detail.rowcount - 1; i >= 0; i--) {
    this.ds_detail.deleteRow(i);
  }
}
```

## 삭제 불가 조건 처리

업무 규칙에 따라 특정 상태의 행은 삭제를 허용하지 않아야 한다.

```javascript
function fn_delete() {
  var row = this.Grid00.currentrow;
  if (row < 0) { alert("행을 선택하세요."); return; }

  // 결재 완료된 항목은 삭제 불가
  var status = this.ds_list.getColumn(row, "APPR_STATUS");
  if (status === "APPROVED") {
    alert("결재 완료 항목은 삭제할 수 없습니다.");
    return;
  }

  if (!confirm("삭제하시겠습니까?")) return;
  this.ds_list.deleteRow(row);
}
```

## 삭제 후 포커스 이동

삭제 후 Grid의 선택이 자동으로 이전 행으로 이동하지 않을 수 있다. 명시적으로 포커스를 조정한다.

```javascript
function fn_delete() {
  var row = this.Grid00.currentrow;
  if (row < 0 || !confirm("삭제?")) return;
  this.ds_list.deleteRow(row);

  // 삭제 후 이전 행 또는 첫 행으로 포커스
  var nextRow = Math.max(0, row - 1);
  if (this.ds_list.rowcount > 0) {
    this.Grid00.setFocus(nextRow, "ITEM_NM");
  }
}
```

---

**지난 글:** [Dataset 변경 추적과 rowStatus](/posts/nexacro-n-update-tracking/)

**다음 글:** [fn_save() 저장 처리 완전 가이드](/posts/nexacro-n-fn-save/)

<br>
읽어주셔서 감사합니다. 😊
