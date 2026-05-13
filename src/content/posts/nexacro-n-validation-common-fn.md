---
title: "[Nexacro N] 유효성 검사 공통 함수 설계"
description: "Nexacro N 프로젝트에서 필수값·형식·범위 검사를 선언적 규칙 배열로 통합하는 gfn_validate() 공통 함수의 설계 원칙과 구현 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 9
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "공통함수", "gfn_validate", "선언적검증", "공통라이브러리", "validation"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-grid-validation/)에서 그리드 행별 유효성 검사를 구현했다. 지금까지 만든 개별 함수들(`gfn_isNull`, `gfn_checkFormat`, `gfn_checkRange`)을 하나로 묶는 **통합 유효성 검사 공통 함수** `gfn_validate()`를 설계한다. 이 함수가 있으면 각 화면에서는 검증 규칙만 배열로 선언하면 되고, 검증 로직을 직접 작성할 필요가 없다.

## 공통 함수의 필요성

프로젝트에 화면이 수십, 수백 개라면 각 화면마다 유효성 검사 코드를 직접 작성하는 것은 비효율적이다. 동일한 패턴이 반복되면서 오탈자나 누락이 발생하기 쉽다. 검증 로직을 공통 함수 하나에 모으고, 각 화면은 **"무엇을 검사할지(규칙)"만 선언**하는 구조가 훨씬 유지보수하기 좋다.

## 규칙 배열 설계

각 규칙 항목은 다음 속성을 가진다.

| 속성 | 타입 | 설명 |
|---|---|---|
| `col` | String | Dataset 컬럼명 |
| `label` | String | 에러 메시지에 표시할 항목명 |
| `required` | Boolean | 필수값 여부 |
| `format` | String | 형식 타입 (`"date8"`, `"email"`, 등) |
| `min` | Number/String | 최솟값 (숫자) 또는 최소 길이 |
| `max` | Number/String | 최댓값 또는 최대 길이 |
| `type` | String | 범위 타입 (`"num"`, `"date"`, `"len"`) |

## gfn_validate() 아키텍처

![gfn_validate() 아키텍처](/assets/posts/nexacro-n-validation-common-fn-arch.svg)

각 화면 폼은 규칙 배열만 정의하고 `gfn_validate()`에 위임한다. 공통 함수 안에서 필수값·형식·범위 검사를 순서대로 수행하고, 실패 시 포커스를 이동한 뒤 `false`를 반환한다.

## gfn_validate() 전체 구현

![gfn_validate() 코드](/assets/posts/nexacro-n-validation-common-fn-code.svg)

```javascript
// 공통 라이브러리 (lib/validation.xfdl)
function gfn_validate(ds, rules, ctrl, row) {
    row = (row == undefined) ? 0 : row;

    for (var i = 0; i < rules.length; i++) {
        var r   = rules[i];
        var val = ds.getColumn(row, r.col);

        // 1. 필수값 검사
        if (r.required && gfn_isNull(val)) {
            alert(r.label + "은(는) 필수 입력값입니다.");
            if (ctrl && ctrl[r.col]) ctrl[r.col].setFocus();
            return false;
        }

        // 2. 형식 검사 (빈 값은 건너뜀)
        if (r.format && !gfn_isNull(val) &&
            !gfn_checkFormat(val, r.format)) {
            alert(r.label + " 형식이 올바르지 않습니다.");
            if (ctrl && ctrl[r.col]) ctrl[r.col].setFocus();
            return false;
        }

        // 3. 범위 검사 (빈 값은 건너뜀)
        if ((r.min != null || r.max != null) &&
            !gfn_isNull(val)) {
            var sType = r.type || "num";
            if (!gfn_checkRange(val, sType, r.min, r.max)) {
                alert(r.label + " 값이 유효한 범위를 벗어났습니다.");
                if (ctrl && ctrl[r.col]) ctrl[r.col].setFocus();
                return false;
            }
        }
    }
    return true;
}
```

`ctrl` 파라미터는 컬럼명을 키로, 컨트롤 객체를 값으로 갖는 오브젝트다. 선택 사항으로, 없으면 포커스 이동 없이 `alert`만 표시한다.

## 화면에서 사용하는 방법

```javascript
function fn_save() {
    // 검증 규칙 선언
    var rules = [
        { col: "user_nm", label: "사용자명", required: true },
        { col: "birth_dt", label: "생년월일",
          required: true, format: "date8" },
        { col: "age", label: "나이",
          min: 0, max: 150, type: "num" },
        { col: "email", label: "이메일",
          format: "email" }
    ];

    // 포커스 이동용 컨트롤 매핑
    var ctrl = {
        user_nm  : this.edt_user_nm,
        birth_dt : this.edt_birth_dt,
        age      : this.spn_age,
        email    : this.edt_email
    };

    if (!gfn_validate(this.ds_input, rules, ctrl)) return;

    this.transaction("save", "svc/save.do",
        "in:ds_input=ds_input", "", "fn_saveCb");
}
```

검증 항목 추가 시 `rules` 배열에 원소 하나를 추가하고, 컨트롤 매핑에 한 줄을 추가하면 된다. 검증 로직 자체를 건드릴 필요가 없다.

## 그리드에 적용하는 방법

그리드는 행 순회가 필요하므로 `row` 파라미터를 활용한다.

```javascript
function fn_validateOrderGrid() {
    var rules = [
        { col: "item_nm", label: "품목명", required: true },
        { col: "qty",     label: "수량",
          required: true, min: 1, max: 9999, type: "num" }
    ];

    var nRowCnt = this.ds_order.getRowCount();
    for (var r = 0; r < nRowCnt; r++) {
        var t = this.ds_order.getRowType(r);
        if (t == Dataset.ROWTYPE_NORMAL ||
            t == Dataset.ROWTYPE_DELETE) continue;

        // 행 인덱스를 row 파라미터로 전달
        if (!gfn_validate(this.ds_order, rules, null, r)) {
            // 그리드 셀 포커스는 별도 처리 필요
            this.grd_order.setCellPos(r, "item_nm");
            return false;
        }
    }
    return true;
}
```

그리드의 경우 컨트롤 매핑(`ctrl`) 대신 `null`을 전달하고, 실패 후 `setCellPos()`로 포커스를 이동한다.

## 규칙 재사용 — 공통 규칙 분리

여러 화면에서 동일한 규칙이 반복된다면 공통 라이브러리에 정의해 재사용한다.

```javascript
// 공통 라이브러리
var COMMON_RULES = {
    user: [
        { col: "user_nm",  label: "사용자명", required: true },
        { col: "email",    label: "이메일",   format: "email" },
        { col: "birth_dt", label: "생년월일", format: "date8" }
    ],
    address: [
        { col: "post_cd", label: "우편번호", required: true },
        { col: "addr1",   label: "주소",     required: true }
    ]
};

// 화면에서 사용
if (!gfn_validate(this.ds_input, COMMON_RULES.user, ctrl)) return;
```

---

**지난 글:** [[Nexacro N] 그리드 유효성 검사](/posts/nexacro-n-grid-validation/)

**다음 글:** [[Nexacro N] 유효성 검사 UX 패턴](/posts/nexacro-n-validation-ux/)

<br>
읽어주셔서 감사합니다. 😊
