---
title: "[Nexacro N] CRUD 패턴 설계와 표준 구조"
description: "Nexacro N 업무 화면의 표준 CRUD 패턴—fn_search, fn_new, fn_delete, fn_save—의 설계 원칙, Dataset rowStatus 기반 상태 관리, 버튼·이벤트 연결 구조를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 5
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "CRUD", "fn_search", "fn_save", "rowStatus", "Dataset", "패턴"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-sse/)에서 서버 푸시 알림을 위한 SSE를 살펴봤다. 이번에는 Nexacro N 업무 화면의 핵심 뼈대인 CRUD 패턴을 정리한다. 표준 함수 명명 규칙과 Dataset rowStatus 기반 상태 관리를 이해하면, 이후 fn_search부터 fn_save까지 각 함수를 수월하게 구현할 수 있다.

## CRUD 패턴 개요

Nexacro N 업무 화면은 대부분 아래 네 가지 작업을 반복한다.

| 작업 | 함수 | 서버 즉시 호출 | 비고 |
|------|------|:---:|------|
| 조회 | `fn_search()` | ✓ | 조건 → 결과 Dataset |
| 신규 | `fn_new()` | ✗ | Dataset addRow만 |
| 삭제 | `fn_delete()` | ✗ | Dataset deleteRow만 |
| 저장 | `fn_save()` | ✓ | 변경 일괄 전송 |

신규와 삭제는 **서버에 즉시 요청하지 않는다**는 점이 핵심이다. 변경 사항은 Dataset의 `rowStatus`로만 추적하다가 `fn_save()` 호출 시 한 번에 서버로 전송한다.

![CRUD 표준 패턴 흐름도](/assets/posts/nexacro-n-crud-pattern-flow.svg)

## Dataset rowStatus 상태 관리

Dataset의 각 행은 `rowStatus` 속성으로 현재 상태를 나타낸다.

![rowStatus 상태 전이도](/assets/posts/nexacro-n-crud-pattern-dataset.svg)

| 값 | 상수 | 의미 |
|----|------|------|
| 1 | `Dataset.ROWSTATUS_NORMAL` | 서버에서 로드된 원본 행 |
| 2 | `Dataset.ROWSTATUS_INSERT` | `addRow()`로 추가된 신규 행 |
| 4 | `Dataset.ROWSTATUS_UPDATE` | `setColumn()`으로 수정된 행 |
| 8 | `Dataset.ROWSTATUS_DELETE` | `deleteRow()`로 논리 삭제된 행 |

`fn_save()`에서는 이 값을 기준으로 서버에 보낼 SQL(INSERT/UPDATE/DELETE)을 결정한다.

## 표준 UI 구성

```xml
<!-- 폼 UI 구성 -->
<Button id="btn_search" text="조회" onclick="fn_search"/>
<Button id="btn_new"    text="신규" onclick="fn_new"/>
<Button id="btn_delete" text="삭제" onclick="fn_delete"/>
<Button id="btn_save"   text="저장" onclick="fn_save"/>
<Grid   id="Grid00"     binddataset="ds_list"/>
```

버튼 이벤트를 함수 이름 문자열로 바인딩하면 함수 교체 시 XML을 수정할 필요가 없다.

## 표준 함수 구조 템플릿

```javascript
// ===== 1. 조회 =====
function fn_search() {
  this.transaction(
    "ListSvc::getList.do",
    "ds_cond:input",
    "ds_list:output",
    fn_nocache(),
    "",
    "fn_searchCb"
  );
}
function fn_searchCb(svcID, errCode, errMsg) {
  if (errCode != 0) { alert(errMsg); return; }
}

// ===== 2. 신규 =====
function fn_new() {
  var row = this.ds_list.addRow();
  this.ds_list.setColumn(row, "REG_DATE",
    gfn_getToday());
  this.Grid00.setFocus(row, "COL_NAME");
}

// ===== 3. 삭제 =====
function fn_delete() {
  var row = this.Grid00.currentrow;
  if (row < 0) { alert("행을 선택하세요."); return; }
  if (!confirm("삭제하시겠습니까?")) return;
  this.ds_list.deleteRow(row);
}

// ===== 4. 저장 =====
function fn_save() {
  if (!gfn_validate(this.ds_list)) return;
  this.transaction(
    "ListSvc::saveList.do",
    "ds_list:input",
    "ds_list:output",
    "",
    "",
    "fn_saveCb"
  );
}
function fn_saveCb(svcID, errCode, errMsg) {
  if (errCode != 0) { alert(errMsg); return; }
  alert("저장되었습니다.");
  this.fn_search();
}
```

## 폼 초기화 패턴

```javascript
function Form_onload(obj, e) {
  this.fn_initDataset();  // Dataset 컬럼 정의
  this.fn_search();       // 최초 조회
}

function fn_initDataset() {
  this.ds_cond.clearData();
  this.ds_cond.addRow();
}
```

폼 로드 시 조건 Dataset을 초기화하고 자동 조회하는 것이 표준이다. 권한 체크나 메뉴 파라미터 수신은 `fn_initDataset()` 안에서 처리한다.

## 변경 감지와 이탈 경고

저장하지 않은 변경이 있을 때 폼을 이탈하면 경고를 표시해야 한다.

```javascript
function Form_onunload(obj, e) {
  if (this.ds_list.rowcount > 0) {
    var changed = this.ds_list.getUpdateRowCount()
                + this.ds_list.getDeleteRowCount()
                + this.ds_list.getInsertRowCount();
    if (changed > 0) {
      if (!confirm("저장하지 않은 변경이 있습니다. 나가시겠습니까?")) {
        e.preventDefault();
      }
    }
  }
}
```

## 다음 글 예고

이어지는 글에서는 CRUD의 각 함수를 한 편씩 깊이 파고든다. fn_search()부터 시작해 조건 수집, 트랜잭션 호출, 결과 바인딩, 로딩 처리를 자세히 살펴본다.

---

**지난 글:** [SSE(Server-Sent Events) 실시간 수신](/posts/nexacro-n-sse/)

**다음 글:** [fn_search() 표준 조회 함수 구현](/posts/nexacro-n-fn-search/)

<br>
읽어주셔서 감사합니다. 😊
