---
title: "[Nexacro N] 멀티 행 저장 패턴 완전 가이드"
description: "Nexacro N에서 Dataset에 쌓인 INSERT·UPDATE·DELETE 행을 한 번의 transaction()으로 서버에 일괄 전송하고 savePoint()로 초기화하는 멀티 행 저장 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "멀티행저장", "transaction", "rowStatus", "savePoint", "CRUD"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-fn-save/)에서 fn_save()의 기본 저장 흐름을 다뤘다. 실무에서는 그리드에서 신규 입력·수정·삭제를 동시에 수행한 뒤 한 번에 저장하는 **멀티 행 저장** 패턴이 훨씬 더 자주 등장한다. Dataset은 각 행에 `rowStatus`를 자동으로 관리하므로, 서버 Adapter는 이 값만 보고 어떤 SQL을 실행할지 결정한다.

## rowStatus와 멀티 행 저장 원리

Nexacro N의 Dataset은 행이 추가·변경·삭제될 때마다 해당 행의 `rowStatus`를 자동으로 갱신한다.

| rowStatus 값 | 상수 | 의미 |
|---|---|---|
| `1` | `Dataset.ROWSTATUS_NORMAL` | 변경 없음 |
| `2` | `Dataset.ROWSTATUS_INSERT` | 신규 추가 |
| `4` | `Dataset.ROWSTATUS_UPDATE` | 수정됨 |
| `8` | `Dataset.ROWSTATUS_DELETE` | 삭제 예약 |

`transaction()` 호출 시 Dataset 전체가 서버로 전송되며, 서버 Adapter는 rowStatus를 기준으로 각 행에 적절한 DML을 실행한다. 클라이언트 스크립트에서 행을 종류별로 분리할 필요가 없다.

![멀티 행 저장 흐름](/assets/posts/nexacro-n-multi-row-save-flow.svg)

## getRowCount("A") — 변경 행 수 확인

저장 전에 실제로 변경된 행이 있는지 확인해야 빈 전송을 막을 수 있다. `getRowCount()` 메서드에 `"A"` 플래그를 전달하면 INSERT + UPDATE + DELETE 행의 합을 반환한다.

```javascript
var nChanged = this.ds_list.getRowCount("A");
// "I" → INSERT만, "U" → UPDATE만, "D" → DELETE만
if (nChanged == 0) {
    alert("저장할 변경 내용이 없습니다.");
    return;
}
```

`"A"`는 All의 약자로, NORMAL 행은 카운트에서 제외된다. 이 확인을 반드시 먼저 수행해 불필요한 서버 요청을 차단한다.

## fn_multiSave() 전체 구현

![fn_multiSave() 코드](/assets/posts/nexacro-n-multi-row-save-code.svg)

```javascript
function fn_multiSave() {
    var ds = this.ds_list;
    var nCnt = ds.getRowCount("A"); // 변경 행 합산

    if (nCnt == 0) {
        alert("저장할 변경 내용이 없습니다.");
        return;
    }

    // 유효성 검사 (필수값·형식)
    if (!this.gfn_validate(ds)) return;

    this.transaction(
        "saveList",
        "svc/saveList.do",
        "in:ds_list=ds_list",  // Dataset 통째로 전송
        "",
        "fn_saveCallback"
    );
}

function fn_saveCallback(sId, nEC, sEM) {
    if (nEC != 0) {
        alert(sEM);
        return;
    }
    this.ds_list.savePoint();  // rowStatus 전부 NORMAL로 초기화
    this.fn_search();           // 최신 데이터 재조회
}
```

`transaction()` 세 번째 인자 `"in:ds_list=ds_list"`는 클라이언트 Dataset `ds_list`를 서버 파라미터 `ds_list`로 전달한다는 뜻이다. 서버 Adapter는 이 Dataset을 받아 rowStatus별로 루프를 돌며 DML을 수행한다.

## savePoint() 타이밍

저장 성공 콜백에서 `savePoint()`를 호출하면 모든 행의 rowStatus가 NORMAL로 초기화된다. 이후 `fn_search()`로 최신 데이터를 재조회하면 화면은 깨끗한 상태로 돌아온다.

```javascript
// savePoint()를 호출하지 않으면 rowStatus가 남아
// 다음 저장 시 이미 저장된 행이 또 전송됨
this.ds_list.savePoint();
this.fn_search();
```

`fn_search()` 없이 `savePoint()`만 호출하는 패턴도 유효하지만, 서버에서 DB 트리거나 기본값이 채워진 경우 클라이언트 데이터와 실제 DB가 다를 수 있으므로 재조회를 권장한다.

## 여러 Dataset 동시 저장

마스터-디테일 구조에서는 헤더 Dataset과 아이템 Dataset을 동시에 저장해야 한다. `transaction()` 인자에 Dataset을 나열하면 된다.

```javascript
this.transaction(
    "saveOrder",
    "svc/saveOrder.do",
    "in:ds_header=ds_header in:ds_item=ds_item",
    "",
    "fn_saveOrderCallback"
);
```

서버는 두 Dataset을 하나의 트랜잭션 안에서 처리한다. 어느 하나라도 실패하면 전체를 롤백하도록 서버 코드에서 트랜잭션을 묶어야 한다.

## 삭제 행 복원 — revertRow()

사용자가 그리드에서 행을 DELETE 상태로 표시했다가 취소하려면 `revertRow()`를 사용한다.

```javascript
// 현재 선택 행의 삭제 상태를 취소
var nRow = this.grd_list.currentrow;
if (this.ds_list.getRowType(nRow) == Dataset.ROWTYPE_DELETE) {
    this.ds_list.revertRow(nRow);
}
```

저장 전에 삭제를 취소할 수 있도록 UI에 "행 복원" 버튼을 제공하는 것이 좋은 UX다.

---

**지난 글:** [[Nexacro N] fn_save() 저장 처리 완전 가이드](/posts/nexacro-n-fn-save/)

**다음 글:** [[Nexacro N] 트랜잭션 단위 설계](/posts/nexacro-n-transaction-unit/)

<br>
읽어주셔서 감사합니다. 😊
