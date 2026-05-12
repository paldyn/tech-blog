---
title: "[Nexacro N] fn_new() 신규 행 추가 패턴"
description: "Nexacro N CRUD 패턴의 신규 함수 fn_new()를 구현하는 방법—addRow() vs insertRow(), 기본값 자동 설정, Grid 포커스 이동, 중복 신규 방지—을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 7
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "fn_new", "addRow", "신규", "Dataset", "CRUD", "rowStatus"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-fn-search/)에서 조회 함수 fn_search()를 구현했다. 이번에는 신규 행을 Dataset에 추가하는 `fn_new()` 패턴을 살펴본다. 서버 요청 없이 Dataset에 행만 추가하고 기본값을 채운 뒤 편집 상태로 전환하는 것이 핵심이다.

## fn_new() 기본 흐름

![fn_new() 흐름도](/assets/posts/nexacro-n-fn-new-flow.svg)

신규 추가는 세 단계다.

1. `addRow()`로 Dataset에 빈 행을 추가한다. 반환값이 새 행의 인덱스다.
2. `setColumn()`으로 등록일, 기본 상태코드, 등록자 ID 등 자동 생성 값을 채운다.
3. `Grid.setFocus(row, colId)`로 새 행의 첫 번째 편집 컬럼에 커서를 위치시킨다.

## 기본 구현

![fn_new() 코드](/assets/posts/nexacro-n-fn-new-code.svg)

```javascript
function fn_new() {
  // ① Dataset 신규 행 추가
  var row = this.ds_list.addRow();

  // ② 기본값 자동 채움
  this.ds_list.setColumn(row, "REG_DT",
    gfn_getToday());
  this.ds_list.setColumn(row, "STATUS",
    "01");
  this.ds_list.setColumn(row, "REG_DEPT",
    gfn_getDeptCd());
  this.ds_list.setColumn(row, "REG_USER",
    gfn_getUserId());

  // ③ Grid 신규 행으로 이동 후 포커스
  this.Grid00.setFocus(row, "ITEM_NM");
}
```

`gfn_getToday()`, `gfn_getUserId()` 같은 함수는 공통 라이브러리에 정의된 전역 함수다. 화면마다 직접 구현하는 대신 반드시 공통 함수를 사용해야 일관성을 유지할 수 있다.

## addRow() vs insertRow()

두 함수는 행을 추가하는 위치가 다르다.

| 함수 | 위치 | 반환값 |
|------|------|--------|
| `addRow()` | Dataset 맨 끝 | 새 행 인덱스 |
| `insertRow(idx)` | 지정 위치 앞 | 새 행 인덱스 |

현재 선택된 행 아래에 삽입하려면 `insertRow(row + 1)`을 사용한다.

```javascript
function fn_newBelow() {
  var cur = this.Grid00.currentrow;
  var insertAt = (cur < 0) ? 0 : cur + 1;
  var row = this.ds_list.insertRow(insertAt);
  this.ds_list.setColumn(row, "SEQ",
    row + 1);
  this.Grid00.setFocus(row, "COL_NM");
}
```

## 저장 전 신규 행 존재 감지

`fn_save()` 호출 전 또는 폼 이탈 시 미저장 신규 행이 있는지 확인하려면 `getInsertRowCount()`를 활용한다.

```javascript
function fn_checkUnsaved() {
  var ins = this.ds_list.getInsertRowCount();
  var upd = this.ds_list.getUpdateRowCount();
  var del = this.ds_list.getDeleteRowCount();
  return (ins + upd + del) > 0;
}
```

## 신규 행 기본값 정책

실무에서 자주 쓰이는 자동 채움 값의 출처를 정리하면 다음과 같다.

| 컬럼 | 출처 |
|------|------|
| 등록일 (`REG_DT`) | `gfn_getToday()` |
| 등록자 ID (`REG_USER`) | 세션/전역변수 `gv_userId` |
| 부서코드 (`DEPT_CD`) | `gfn_getDeptCd()` |
| 사용 여부 (`USE_YN`) | 하드코딩 `"Y"` |
| 정렬 순서 (`SORT_SEQ`) | `ds_list.rowcount` |
| 상태코드 (`STATUS`) | 업무 정의 초기값 |

이 값들을 fn_new() 안에서 일괄로 초기화하면 개발자마다 다른 기본값을 설정하는 문제를 방지할 수 있다.

## 중복 신규 방지

연속 클릭으로 빈 행이 여러 개 생기는 것을 막으려면 아래처럼 빈 신규 행이 이미 있으면 새로 추가하지 않는다.

```javascript
function fn_new() {
  // 맨 마지막 행이 신규 INSERT이면 추가 금지
  var lastRow = this.ds_list.rowcount - 1;
  if (lastRow >= 0 &&
      this.ds_list.getRowStatus(lastRow) ===
        Dataset.ROWSTATUS_INSERT) {
    this.Grid00.setFocus(lastRow, "ITEM_NM");
    return;
  }
  var row = this.ds_list.addRow();
  // ... 기본값 설정 ...
  this.Grid00.setFocus(row, "ITEM_NM");
}
```

## Grid가 없는 Form 뷰에서의 신규

Grid 없이 개별 Edit 컴포넌트에 직접 바인딩한 폼 뷰에서는 `addRow()` 후 `currentrow`를 변경하면 컴포넌트들이 자동으로 새 행의 값을 표시한다.

```javascript
function fn_new() {
  var row = this.ds_list.addRow();
  this.ds_list.currentrow = row;
  // Edit 컴포넌트들이 row의 값을 표시
  this.edt_name.setFocus();
}
```

---

**지난 글:** [fn_search() 표준 조회 함수 구현](/posts/nexacro-n-fn-search/)

**다음 글:** [Dataset 변경 추적과 rowStatus](/posts/nexacro-n-update-tracking/)

<br>
읽어주셔서 감사합니다. 😊
