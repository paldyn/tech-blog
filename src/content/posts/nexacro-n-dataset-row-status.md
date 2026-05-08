---
title: "[Nexacro N] Dataset rowType — 행 상태 추적"
description: "Nexacro N Dataset의 rowType(NORMAL·INSERT·UPDATE·DELETE)이 어떻게 결정되고 바뀌는지, getRowType·setRowType 활용과 트랜잭션 후 초기화까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "dataset", "rowtype", "getRowType", "setRowType", "row-status"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-dataset-types/)에서 Dataset의 여러 타입을 살펴봤습니다. Dataset이 단순한 데이터 저장소에 그치지 않고 **변경 사항을 자동으로 추적**하는 능력은 `rowType` 덕분입니다. 서버에 INSERT·UPDATE·DELETE를 따로 구분해서 보내는 Nexacro N의 CRUD 패턴은 모두 이 rowType 위에서 동작합니다.

## rowType 값과 의미

Dataset의 각 행에는 현재 상태를 나타내는 `rowType` 값이 있습니다.

| 상수 | 정수 값 | 의미 |
|------|---------|------|
| `Dataset.ROWTYPE.NORMAL` | **1** | 서버에서 받은 후 수정 없음 |
| `Dataset.ROWTYPE.INSERT` | **2** | `addRow()`로 추가된 신규 행 |
| `Dataset.ROWTYPE.UPDATE` | **4** | `setColumn()`으로 값이 변경된 행 |
| `Dataset.ROWTYPE.DELETE` | **8** | `deleteRow()`로 삭제 표시된 행 |

![Dataset rowType 상태 전이](/assets/posts/nexacro-n-dataset-row-status-diagram.svg)

## 상태 전이 규칙

### INSERT → DELETE
`addRow()`로 추가한 행을 곧바로 `deleteRow()`하면 DELETE(8)가 아니라 **Dataset에서 완전히 제거**됩니다. 아직 서버에 저장된 적이 없으므로 DELETE 상태로 남길 필요가 없기 때문입니다.

### NORMAL → DELETE
서버에서 받아온 NORMAL(1) 행을 `deleteRow()`하면 **DELETE(8)로 전환**되어 행이 Dataset에 남아 있습니다. 이후 `transaction()`을 호출하면 서버에 DELETE 요청을 보냅니다.

### NORMAL → UPDATE
NORMAL 행에 `setColumn()`을 호출하면 **UPDATE(4)로 전환**됩니다. 이후 `setColumn()`을 여러 번 더 해도 rowType은 4에서 바뀌지 않습니다.

### INSERT → UPDATE
INSERT(2) 행에 `setColumn()`을 호출해도 rowType은 **INSERT(2)로 유지**됩니다. 처음 추가된 신규 행이라는 정보가 더 중요하기 때문입니다.

## rowType 읽기와 변경

```javascript
// rowType 읽기
var rowType = ds.getRowType(i);

if (rowType == Dataset.ROWTYPE.NORMAL) {
    trace("정상 행: 변경 없음");
} else if (rowType == Dataset.ROWTYPE.INSERT) {
    trace("신규 행: 저장 필요");
} else if (rowType == Dataset.ROWTYPE.UPDATE) {
    trace("수정 행: 업데이트 필요");
} else if (rowType == Dataset.ROWTYPE.DELETE) {
    trace("삭제 대기: 서버 삭제 필요");
}

// rowType 강제 변경 (특수 상황에서만)
ds.setRowType(i, Dataset.ROWTYPE.UPDATE);
```

![rowType 조회·분기 처리 패턴](/assets/posts/nexacro-n-dataset-row-status-code.svg)

## transaction() 후 rowType 초기화

`transaction()` 콜백에서 서버가 성공(`errorCode == 0`)을 반환하면 Nexacro N은 자동으로 **모든 행의 rowType을 NORMAL(1)로 리셋**합니다. DELETE(8)였던 행은 Dataset에서 완전히 제거됩니다.

```javascript
function fn_save_callback(e) {
    if (e.errorCode != 0) {
        alert("저장 실패: " + e.errorMsg);
        return;
    }
    // 이 시점에서 dsSave의 모든 행 rowType == 1 (NORMAL)
    // DELETE 행은 사라짐
    alert("저장 성공");
}
```

## 변경된 행만 세기

저장 전 사용자에게 "N건의 변경 사항이 있습니다" 안내가 필요할 때 유용합니다.

```javascript
function fn_countChanges() {
    var cnt = 0;
    for (var i = 0; i < ds.rowcount; i++) {
        if (ds.getRowType(i) != Dataset.ROWTYPE.NORMAL) {
            cnt++;
        }
    }
    return cnt;
}
```

## 주의사항

- `setRowType()`으로 rowType을 강제 변경하면 예기치 않은 서버 저장이 발생할 수 있습니다. 꼭 필요한 경우에만 사용하세요.
- `clearData()`를 호출하면 모든 행이 제거되므로 변경 추적도 초기화됩니다.
- DELETE(8) 행은 `ds.rowcount`에 포함되지 않고, 별도의 `ds.deletedrowcount`로 접근합니다.

---

**지난 글:** [[Nexacro N] Dataset 타입 완전 정리](/posts/nexacro-n-dataset-types/)

**다음 글:** [[Nexacro N] Dataset savedOrg — 원본 데이터 보관](/posts/nexacro-n-dataset-saved-org/)

<br>
읽어주셔서 감사합니다. 😊
