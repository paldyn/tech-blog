---
title: "[Nexacro N] fn_save() 저장 처리 완전 가이드"
description: "Nexacro N CRUD 패턴의 저장 함수 fn_save()를 구현하는 방법—저장 전 유효성 검사, transaction() 호출, 콜백 처리, savePoint() 초기화, 재조회 패턴—을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 10
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "fn_save", "저장", "transaction", "savePoint", "유효성검사", "CRUD"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-fn-delete/)에서 fn_delete()로 행을 논리 삭제하는 방법을 다뤘다. 이번에는 CRUD 패턴의 마지막 단계인 `fn_save()` 저장 함수를 구현한다. 신규·수정·삭제된 모든 변경을 한 번에 서버로 전송하고, 성공 후 화면을 재조회하는 전체 흐름을 정리한다.

## fn_save() 전체 흐름

![fn_save() 흐름도](/assets/posts/nexacro-n-fn-save-flow.svg)

저장 처리는 다섯 단계로 이루어진다.

1. **변경 확인**: INSERT + UPDATE + DELETE 행이 하나라도 있는지 체크
2. **유효성 검사**: 필수값·형식·범위를 `gfn_validate()`로 검증
3. **transaction() 호출**: 변경된 Dataset을 서버로 전송
4. **콜백 처리**: 에러면 alert + return, 성공이면 다음 단계로
5. **savePoint() + 재조회**: rowStatus 초기화 후 최신 데이터로 화면 갱신

## 기본 구현

![fn_save() 코드](/assets/posts/nexacro-n-fn-save-code.svg)

```javascript
function fn_save() {
  // ① 변경 여부 확인
  var changed = this.ds_list.getInsertRowCount()
              + this.ds_list.getUpdateRowCount()
              + this.ds_list.getDeleteRowCount();
  if (changed === 0) {
    alert("변경된 내용이 없습니다.");
    return;
  }

  // ② 유효성 검사
  if (!gfn_validate(this.ds_list)) return;

  // ③ 저장 트랜잭션
  this.transaction(
    "OrderSvc::saveOrder.do",
    "ds_list:input",
    "ds_list:output",
    "",
    "",
    "fn_saveCb"
  );
}

function fn_saveCb(svcID, errCode, errMsg) {
  if (errCode != 0) {
    alert("저장 실패: " + errMsg);
    return;
  }
  // ④ 저장 성공 처리
  this.ds_list.savePoint();  // rowStatus → NORMAL 초기화
  alert("저장되었습니다.");
  this.fn_search();          // 재조회로 최신 데이터 반영
}
```

## 유효성 검사 연동

`gfn_validate()`는 공통 라이브러리에 정의하는 표준 함수다. Dataset의 변경 행을 순회하며 필수값, 날짜 형식, 숫자 범위 등을 검사하고, 오류 발생 시 해당 셀에 포커스를 이동한다.

```javascript
// 공통 라이브러리 (CommonLib.xjs)
function gfn_validate(ds) {
  for (var i = 0; i < ds.rowcount; i++) {
    var st = ds.getRowStatus(i);
    // DELETE 행은 검증 제외
    if (st === Dataset.ROWSTATUS_DELETE) continue;

    if (ds.getColumn(i, "ITEM_NM") === "") {
      alert("품목명은 필수입니다. (행 " + (i+1) + ")");
      return false;
    }
    var qty = ds.getColumn(i, "QTY");
    if (isNaN(qty) || qty <= 0) {
      alert("수량은 0보다 큰 숫자여야 합니다.");
      return false;
    }
  }
  return true;
}
```

## savePoint() vs fn_search() 재조회 선택

저장 성공 후 두 가지 방식을 선택할 수 있다.

| 방식 | 장점 | 단점 |
|------|------|------|
| `savePoint()` | 네트워크 왕복 없음 | 서버 생성 값(시퀀스·계산 컬럼) 미반영 |
| `fn_search()` 재조회 | 서버 최신 데이터 반영 | 추가 요청 발생 |

서버 DB에서 자동 생성되는 ID, 계산 컬럼, 타임스탬프가 있다면 반드시 `fn_search()` 재조회를 사용해야 화면 데이터가 정확해진다.

## 마스터-디테일 동시 저장

마스터와 디테일 Dataset을 한 번의 트랜잭션으로 서버에 전송하는 패턴이다.

```javascript
function fn_save() {
  if (!gfn_validate(this.ds_master)) return;
  if (!gfn_validate(this.ds_detail)) return;

  this.transaction(
    "OrderSvc::saveOrder.do",
    "ds_master:input|ds_detail:input",
    "ds_master:output|ds_detail:output",
    "",
    "",
    "fn_saveCb"
  );
}
```

`|`로 구분해 여러 Dataset을 동시에 전송한다. 서버는 트랜잭션 단위로 두 Dataset을 함께 처리한다.

## 저장 중 중복 요청 방지

저장 버튼을 빠르게 여러 번 클릭하면 같은 데이터가 중복 전송될 수 있다. 요청 중에는 버튼을 비활성화한다.

```javascript
function fn_save() {
  this.btn_save.enable = false;  // 요청 중 비활성화
  // ... 유효성 검사 ...
  this.transaction(/* ... */, "fn_saveCb");
}

function fn_saveCb(svcID, errCode, errMsg) {
  this.btn_save.enable = true;   // 완료 후 활성화
  if (errCode != 0) { alert(errMsg); return; }
  this.ds_list.savePoint();
  this.fn_search();
}
```

## 부분 저장 실패 처리

서버에서 일부 행만 오류가 발생한 경우, 응답 Dataset에 오류 컬럼(`ERR_MSG`)을 포함해 클라이언트에 반환하고 Grid에서 해당 행을 강조 표시할 수 있다.

```javascript
function fn_saveCb(svcID, errCode, errMsg) {
  if (errCode != 0) {
    // 전체 실패
    alert("저장 실패: " + errMsg);
    return;
  }
  // 행별 오류 확인
  var hasRowErr = false;
  for (var i = 0; i < this.ds_list.rowcount; i++) {
    if (this.ds_list.getColumn(i, "ERR_MSG") !== "") {
      hasRowErr = true;
      break;
    }
  }
  if (hasRowErr) {
    alert("일부 행에서 오류가 발생했습니다.");
    return;
  }
  this.ds_list.savePoint();
  this.fn_search();
}
```

## CRUD 시리즈 정리

이 글로 Nexacro N CRUD 패턴의 네 가지 표준 함수—`fn_search`, `fn_new`, `fn_delete`, `fn_save`—를 모두 살펴봤다. 각 함수는 서로 독립적이지만 Dataset의 rowStatus를 통해 상태를 공유하며 협력한다.

| 함수 | 서버 호출 | rowStatus 역할 |
|------|----------|----------------|
| fn_search | ✓ 조회 | 결과를 NORMAL로 초기화 |
| fn_new | ✗ | INSERT(2) 행 생성 |
| fn_delete | ✗ | DELETE(8) 행 생성 |
| fn_save | ✓ 저장 | 변경 행 전송 후 NORMAL 초기화 |

---

**지난 글:** [fn_delete() 삭제 처리 패턴](/posts/nexacro-n-fn-delete/)

<br>
읽어주셔서 감사합니다. 😊
