---
title: "[Nexacro N] 유효성 검사 — 저장 전 데이터 무결성 보장하기"
description: "Nexacro N에서 저장 전 유효성 검사를 완전히 정리합니다. 필수값·형식·범위·연관 필드 검사부터 Grid 셀 수준 실시간 검증, 공통 함수 패턴, UX 친화적 오류 표시까지 코드 중심으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 5
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "validation", "dataset", "grid"]
featured: false
draft: false
---

지난 [\[Nexacro N\] CRUD 패턴 — 조회·신규·수정·삭제·저장 완전 정리](/posts/nexacro-n-crud-pattern/) 글에서 이어집니다.

이 글은 **Nexacro N** 기준으로 작성되었습니다.

아무리 잘 만든 CRUD 화면도 잘못된 데이터가 서버에 전달되면 의미가 없습니다. Nexacro N에서는 `this.transaction()` 호출 직전에 스크립트로 유효성 검사를 수행하는 것이 일반적인 패턴입니다. 이 글에서는 실무에서 필요한 다섯 가지 검사 유형과 공통 함수 구조, Grid 셀 수준 검증 방법, UX 친화적 오류 표시까지 코드와 함께 상세히 정리합니다.

---

## 유효성 검사 흐름

![Nexacro N 저장 전 유효성 검사 흐름](/assets/posts/nexacro-n-validation-flow.svg)

저장 버튼을 누르면 `fn_save()` 안에서 `fn_validate()` 함수를 먼저 호출합니다. 검사에 실패하면 오류 메시지를 띄우고 `return false`로 저장을 중단합니다. 모든 검사를 통과하면 `return true`를 반환해 `transaction()`으로 진행합니다.

```javascript
// fn_save() 안에서 호출하는 구조
function fn_save(obj, e) {
    // 유효성 검사 — false이면 저장 중단
    if (!fn_validate.call(this)) return;

    this.transaction(
        "saveList",
        "/service/sample/saveList.do",
        "inDsList=dsList",
        "",
        "fn_callbackSave",
        0
    );
}
```

---

## 검사 유형 정리

![Nexacro N 유효성 검사 유형 정리](/assets/posts/nexacro-n-validation-types.svg)

---

## 1. 필수값 검사 (Required)

가장 기본적인 검사입니다. `nexacro.isNull()` 함수는 `null`, `undefined`, 빈 문자열(`""`)을 모두 `true`로 판별합니다.

```javascript
// Dataset 행 전체를 순회하는 필수값 검사 예시
function fn_checkRequired(ds) {
    // INSERT / UPDATE 행만 검사 (DELETE 행과 NORMAL 행은 제외 가능)
    for (var i = 0; i < ds.rowcount; i++) {
        var st = ds.getRowStatus(i);
        if (st == nexacro.RowStatus.NORMAL || st == nexacro.RowStatus.DELETE) continue;

        var userId = ds.getColumn(i, "userId");
        var userName = ds.getColumn(i, "userName");
        var deptCd = ds.getColumn(i, "deptCd");

        if (nexacro.isNull(userId) || userId === "") {
            // 오류 행으로 커서 이동
            ds.rowposition = i;
            return { ok: false, msg: (i + 1) + "번 행: 사용자 ID는 필수입니다." };
        }
        if (nexacro.isNull(userName) || userName === "") {
            ds.rowposition = i;
            return { ok: false, msg: (i + 1) + "번 행: 사용자명은 필수입니다." };
        }
        if (nexacro.isNull(deptCd) || deptCd === "") {
            ds.rowposition = i;
            return { ok: false, msg: (i + 1) + "번 행: 부서 코드는 필수입니다." };
        }
    }
    return { ok: true };
}
```

> **팁:** `nexacro.isNull(val)`은 내부적으로 `val == null || val === undefined || val === ""`를 한 번에 처리합니다. 직접 `== null`을 쓰는 것보다 가독성이 높습니다.

---

## 2. 형식 검사 (Format / Regex)

날짜, 전화번호, 이메일, 주민등록번호 등 특정 형식을 따라야 하는 값은 정규식으로 검증합니다.

```javascript
// 형식별 정규식 모음 (전역 변수 또는 공통 스크립트에 정의)
var REGEX = {
    date:   /^\d{4}-\d{2}-\d{2}$/,                          // YYYY-MM-DD
    time:   /^\d{2}:\d{2}(:\d{2})?$/,                        // HH:MM 또는 HH:MM:SS
    tel:    /^\d{2,3}-\d{3,4}-\d{4}$/,                       // 전화번호
    email:  /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/,
    number: /^\d+(\.\d+)?$/,                                  // 양의 숫자
    bizNo:  /^\d{3}-\d{2}-\d{5}$/                            // 사업자등록번호
};

// 날짜 형식 검사 예시
function fn_checkDateFormat(ds) {
    for (var i = 0; i < ds.rowcount; i++) {
        var st = ds.getRowStatus(i);
        if (st == nexacro.RowStatus.NORMAL) continue;

        var startDt = ds.getColumn(i, "startDt");
        if (!nexacro.isNull(startDt) && startDt !== "") {
            if (!REGEX.date.test(startDt)) {
                ds.rowposition = i;
                return { ok: false, msg: (i + 1) + "번 행: 시작일 형식이 올바르지 않습니다. (YYYY-MM-DD)" };
            }
        }

        var email = ds.getColumn(i, "email");
        if (!nexacro.isNull(email) && email !== "") {
            if (!REGEX.email.test(email)) {
                ds.rowposition = i;
                return { ok: false, msg: (i + 1) + "번 행: 이메일 형식이 올바르지 않습니다." };
            }
        }
    }
    return { ok: true };
}
```

### Edit 컴포넌트의 inputtype 속성 활용

스크립트 검사 이전에, Edit 컴포넌트의 `inputtype` 속성을 설정하면 입력 자체를 제한할 수 있습니다.

| `inputtype` 값 | 허용 입력 |
|---|---|
| `"number"` | 숫자만 입력 가능 |
| `"date"` | 날짜 형식으로 제한 |
| `"alphanumeric"` | 영문·숫자만 |
| `"korean"` | 한글만 |

```javascript
// Form 컴포넌트에서 스크립트로 inputtype 설정
this.edtPhone.inputtype = "number";  // 숫자만 입력되도록 제한
this.edtEmail.inputtype = "email";   // 이메일 형식으로 제한
```

`mask` 속성을 추가하면 입력 패턴을 더 세밀하게 제어할 수 있습니다.

```javascript
// mask 속성: 9는 숫자 한 자리, A는 영문자, *는 임의 문자
this.edtBizNo.mask = "999-99-99999"; // 사업자등록번호 자동 서식 적용
```

---

## 3. 범위 검사 (Range)

수량, 금액, 순번 등 숫자 값이 허용 범위 내에 있는지 확인합니다.

```javascript
// 숫자 범위 검사 예시
function fn_checkRange(ds) {
    for (var i = 0; i < ds.rowcount; i++) {
        var st = ds.getRowStatus(i);
        if (st == nexacro.RowStatus.NORMAL) continue;

        // getColumn은 문자열을 반환하므로 숫자 변환 필요
        var qty    = parseInt(ds.getColumn(i, "qty")    || "0", 10);
        var price  = parseFloat(ds.getColumn(i, "price") || "0");
        var sortNo = parseInt(ds.getColumn(i, "sortNo") || "0", 10);

        if (isNaN(qty) || qty < 0 || qty > 9999) {
            ds.rowposition = i;
            return { ok: false, msg: (i + 1) + "번 행: 수량은 0~9,999 사이여야 합니다." };
        }
        if (isNaN(price) || price < 0) {
            ds.rowposition = i;
            return { ok: false, msg: (i + 1) + "번 행: 단가는 0 이상이어야 합니다." };
        }
        if (isNaN(sortNo) || sortNo < 1) {
            ds.rowposition = i;
            return { ok: false, msg: (i + 1) + "번 행: 순번은 1 이상이어야 합니다." };
        }
    }
    return { ok: true };
}
```

---

## 4. 연관 필드 검사 (Cross-field)

두 개 이상의 컬럼 간의 논리 관계를 검증합니다. 가장 흔한 사례는 시작일과 종료일의 순서 검증입니다.

```javascript
// 연관 필드 검사 예시
function fn_checkCrossField(ds) {
    for (var i = 0; i < ds.rowcount; i++) {
        var st = ds.getRowStatus(i);
        if (st == nexacro.RowStatus.NORMAL) continue;

        var startDt = ds.getColumn(i, "startDt") || "";
        var endDt   = ds.getColumn(i, "endDt")   || "";

        // 둘 다 입력된 경우에만 비교 (둘 중 하나가 없으면 필수값 검사에서 처리)
        if (startDt !== "" && endDt !== "") {
            // 날짜 문자열은 YYYY-MM-DD 형식이면 문자열 비교로 대소 비교 가능
            if (startDt > endDt) {
                ds.rowposition = i;
                return { ok: false, msg: (i + 1) + "번 행: 시작일이 종료일보다 클 수 없습니다." };
            }
        }

        // 최솟값 ≤ 최댓값 검사
        var minAmt = parseFloat(ds.getColumn(i, "minAmt") || "0");
        var maxAmt = parseFloat(ds.getColumn(i, "maxAmt") || "0");
        if (!isNaN(minAmt) && !isNaN(maxAmt) && minAmt > maxAmt) {
            ds.rowposition = i;
            return { ok: false, msg: (i + 1) + "번 행: 최솟값이 최댓값보다 클 수 없습니다." };
        }
    }
    return { ok: true };
}
```

---

## 5. Grid 셀 수준 실시간 검사 (onvalidate)

사용자가 셀을 떠나는 순간 검증하려면 Grid의 `onvalidate` 이벤트를 활용합니다. `return false`를 반환하면 셀 이동이 차단됩니다.

```javascript
// Grid의 onvalidate 이벤트 핸들러
// obj: Grid 객체, e: 이벤트 정보 (e.row, e.col, e.postvalue 등)
function grdList_onvalidate(obj, e) {
    var colId    = obj.currentcell;  // 현재 편집 중인 컬럼 ID
    var newValue = e.postvalue;      // 사용자가 입력한 새 값

    if (colId == "email") {
        var re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
        if (newValue !== "" && !re.test(newValue)) {
            this.alert("이메일 형식이 올바르지 않습니다.");
            return false; // false를 반환하면 셀 이동 차단
        }
    }

    if (colId == "qty") {
        var qty = parseInt(newValue, 10);
        if (isNaN(qty) || qty < 0) {
            this.alert("수량은 0 이상의 정수여야 합니다.");
            return false;
        }
    }

    // true 반환: 셀 이동 허용
    return true;
}
```

### 오류 셀 배경색 강조

`setCellAttribute()` 메서드로 오류가 있는 셀의 배경색을 변경해 시각적으로 표시할 수 있습니다.

```javascript
// 오류 셀 배경색 강조 / 원복 함수
function fn_markErrorCell(grid, nRow, sColId, bError) {
    if (bError) {
        // 오류: 붉은 배경
        grid.setCellAttribute(nRow, grid.getColumnIndex(sColId),
            "background", "#3a0a0a");
    } else {
        // 정상: 원래 배경으로 복원 (빈 문자열 전달 시 기본값 사용)
        grid.setCellAttribute(nRow, grid.getColumnIndex(sColId),
            "background", "");
    }
}

// onvalidate에서 호출
function grdList_onvalidate(obj, e) {
    var colId    = obj.currentcell;
    var newValue = e.postvalue;
    var nRow     = obj.currentrow;

    if (colId == "amount") {
        var amt = parseFloat(newValue);
        if (isNaN(amt) || amt < 0) {
            fn_markErrorCell.call(this, obj, nRow, "amount", true);
            return false;
        } else {
            fn_markErrorCell.call(this, obj, nRow, "amount", false);
        }
    }
    return true;
}
```

---

## 공통 유효성 검사 함수 패턴

여러 화면에서 반복되는 검사 로직을 공통 함수로 묶으면 유지보수가 쉬워집니다. 아래는 결과를 객체로 반환해 호출부에서 처리하는 패턴입니다.

```javascript
// fn_validate(): 모든 검사를 순서대로 실행
// this는 Form 객체여야 함 (call/apply로 호출)
function fn_validate() {
    var ds = this.dsList;

    // 1. 변경된 행이 있는지 확인
    var hasChange = false;
    for (var i = 0; i < ds.rowcount; i++) {
        if (ds.getRowStatus(i) != nexacro.RowStatus.NORMAL) { hasChange = true; break; }
    }
    if (ds.deletedcount > 0) hasChange = true;

    if (!hasChange) {
        this.alert("변경된 데이터가 없습니다.");
        return false;
    }

    // 2. 필수값 검사
    var r1 = fn_checkRequired.call(this, ds);
    if (!r1.ok) { this.alert(r1.msg); return false; }

    // 3. 형식 검사
    var r2 = fn_checkDateFormat.call(this, ds);
    if (!r2.ok) { this.alert(r2.msg); return false; }

    // 4. 범위 검사
    var r3 = fn_checkRange.call(this, ds);
    if (!r3.ok) { this.alert(r3.msg); return false; }

    // 5. 연관 필드 검사
    var r4 = fn_checkCrossField.call(this, ds);
    if (!r4.ok) { this.alert(r4.msg); return false; }

    return true; // 모든 검사 통과
}
```

> **설계 원칙:** 각 검사 함수는 `{ ok: boolean, msg: string }` 형태의 결과 객체를 반환합니다. 이 구조를 공통화하면 검사 함수를 추가하거나 제거해도 `fn_validate()` 구조가 변하지 않습니다.

---

## 단일 컴포넌트(Edit) 검사

Grid가 아닌 개별 Edit 컴포넌트에 입력된 값을 검사할 때는 `.value` 속성으로 값을 읽습니다.

```javascript
// 단일 폼 저장 전 Edit 값 검사
function fn_saveForm(obj, e) {
    var title   = this.edtTitle.value;
    var content = this.edtContent.value;
    var regDt   = this.edtRegDt.value;

    // 필수값 검사
    if (nexacro.isNull(title) || title === "") {
        this.alert("제목을 입력하세요.");
        this.edtTitle.setFocus(); // 오류 필드로 포커스 이동
        return;
    }
    if (nexacro.isNull(content) || content === "") {
        this.alert("내용을 입력하세요.");
        this.edtContent.setFocus();
        return;
    }

    // 날짜 형식 검사
    if (!nexacro.isNull(regDt) && regDt !== "") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(regDt)) {
            this.alert("등록일 형식이 올바르지 않습니다. (YYYY-MM-DD)");
            this.edtRegDt.setFocus();
            return;
        }
    }

    // 검사 통과 → 저장 진행
    this.transaction(
        "saveForm",
        "/service/sample/saveForm.do",
        "inDsForm=dsForm",
        "",
        "fn_callbackSaveForm",
        0
    );
}
```

---

## 오류 메시지 UX 가이드

유효성 오류를 사용자에게 전달하는 방법은 여러 가지가 있습니다.

**1. `this.alert()` — 가장 단순한 방법**
```javascript
this.alert("필수 항목을 입력하세요.");
```

**2. `this.confirm()` — 경고 후 사용자 선택 유도**
```javascript
// 경고 수준이지만 사용자가 그래도 진행할 수 있게 할 때
this.confirm("데이터가 불완전합니다. 계속 저장하시겠습니까?", "fn_confirmSave");
```

**3. 컴포넌트 포커스 이동 — 오류 위치 직접 안내**
```javascript
// Grid에서 오류 행·열로 포커스 이동
this.dsList.rowposition = nErrorRow;
this.grdList.setFocus();
// 특정 셀로 이동
this.grdList.setCellPos(nErrorRow, this.grdList.getColumnIndex("userId"));
```

**4. Static 컴포넌트로 오류 메시지 표시 — 비침습적 UX**
```javascript
// Form 안의 Static(stcError) 컴포넌트에 메시지 표시
this.stcError.text     = "사용자 ID는 필수입니다.";
this.stcError.visible  = true;
this.stcError.color    = "#ef5350"; // 붉은색
```

---

## 실무 체크리스트

- `nexacro.isNull()`은 `null`, `undefined`, `""`를 모두 잡습니다. `val == null` 단독 체크는 빈 문자열을 놓칠 수 있습니다.
- 날짜 문자열 비교는 `YYYY-MM-DD` 형식이면 문자열 비교(`>`, `<`)로 충분합니다.
- `getColumn()`은 항상 문자열을 반환합니다. 숫자 비교 전 반드시 `parseInt()` / `parseFloat()`로 변환하세요.
- `onvalidate` 이벤트에서 `return false`를 반환하면 셀 이동이 막힙니다. Grid 편집 중에 오류를 즉시 잡을 수 있지만, 오남용하면 사용성이 떨어집니다.
- 저장 버튼 클릭 시 검사(fn_validate)와 Grid 실시간 검사(onvalidate)를 **병행** 운영하는 것이 가장 견고합니다.
- 검사 순서는 "필수값 → 형식 → 범위 → 연관"으로 진행하면 사용자가 오류를 이해하기 쉽습니다.

---

**지난 글:** [[Nexacro N] CRUD 패턴 — 조회·신규·수정·삭제·저장 완전 정리](/posts/nexacro-n-crud-pattern/)

**다음 글:** [[Nexacro N] Nexacro란 무엇인가 (RIA 시대부터 N까지)](/posts/nexacro-n-what-is-nexacro/)

<br>
읽어주셔서 감사합니다. 😊
