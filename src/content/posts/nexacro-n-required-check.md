---
title: "[Nexacro N] 필수값 검사 구현"
description: "Nexacro N에서 Dataset의 특정 컬럼이 null·빈 문자열·공백만 있는 값인지 확인하는 필수값 검사 패턴과 gfn_isNull() 공통 함수 구현을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 4
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "필수값검사", "gfn_isNull", "validation", "required", "Dataset"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-validation/)에서 유효성 검사의 계층 구조와 검증 시점을 정리했다. 이번에는 가장 기본이 되는 **필수값 검사**를 구체적으로 구현한다. 필수값 검사는 단순해 보이지만, null·빈 문자열·공백만 있는 문자열이라는 세 가지 경우를 모두 잡아야 정확한 검증이 된다.

## 세 가지 빈 값

Nexacro N의 Dataset에서 `getColumn()`이 반환하는 값은 세 종류의 "빈" 상태가 있다.

| 상태 | 예시 | 설명 |
|---|---|---|
| `null` | `null` | 값이 전혀 입력되지 않음 |
| 빈 문자열 | `""` | 입력 후 전부 지움 |
| 공백만 | `"   "` | 스페이스·탭만 입력 |

세 가지 중 어느 하나라도 해당하면 필수값 검사를 실패로 처리해야 한다. `== null`만 확인하면 공백만 입력된 경우를 놓친다.

## gfn_isNull() 구현

![필수값 검사 판단 흐름](/assets/posts/nexacro-n-required-check-logic.svg)

공통 라이브러리에 `gfn_isNull()` 함수를 만들어 세 가지 케이스를 한 번에 처리한다.

```javascript
// 공통 라이브러리 (lib/commonFunctions.xfdl)
function gfn_isNull(vVal) {
    if (vVal == null) return true;
    if (String(vVal).trim().length == 0) return true;
    return false;
}
```

`String(vVal)`로 변환하는 이유는 `getColumn()`이 숫자 타입으로 컬럼을 정의한 경우 숫자 0을 반환하기도 하기 때문이다. 숫자 0은 빈 값이 아니므로 trim() 후 길이가 1이 되어 통과한다. 빈 문자열은 길이가 0이 되어 실패한다.

## 단건 폼에서 필수값 검사

![필수값 검사 코드](/assets/posts/nexacro-n-required-check-code.svg)

```javascript
function fn_save() {
    if (!fn_checkRequired(this.ds_input)) return;
    this.transaction("save", "svc/save.do",
        "in:ds_input=ds_input", "", "fn_saveCb");
}

function fn_checkRequired(ds) {
    var aRequired = [
        { col: "user_nm", label: "사용자명" },
        { col: "dept_cd", label: "부서코드" },
        { col: "email",   label: "이메일" }
    ];
    for (var i = 0; i < aRequired.length; i++) {
        var val = ds.getColumn(0, aRequired[i].col);
        if (gfn_isNull(val)) {
            alert(aRequired[i].label + "은(는) 필수 입력값입니다.");
            return false;
        }
    }
    return true;
}
```

검증 항목을 배열로 선언하면 항목 추가/삭제가 코드 변경 없이 배열 원소만으로 가능하다. 실패 시 `return false`로 즉시 중단하여 첫 번째 실패 항목만 사용자에게 알린다.

## 그리드 전체 행 필수값 검사

그리드에 여러 행이 있는 경우 INSERT·UPDATE 행만 대상으로 각 행을 순회하며 검사한다.

```javascript
function fn_checkGridRequired(ds) {
    var nRowCnt = ds.getRowCount();
    for (var r = 0; r < nRowCnt; r++) {
        var nType = ds.getRowType(r);
        // NORMAL·DELETE 행은 검사 건너뜀
        if (nType == Dataset.ROWTYPE_NORMAL ||
            nType == Dataset.ROWTYPE_DELETE) continue;

        if (gfn_isNull(ds.getColumn(r, "item_nm"))) {
            alert((r + 1) + "행: 품목명은 필수 입력값입니다.");
            return false;
        }
        if (gfn_isNull(ds.getColumn(r, "qty"))) {
            alert((r + 1) + "행: 수량은 필수 입력값입니다.");
            return false;
        }
    }
    return true;
}
```

`getRowType(r)`으로 행의 상태를 확인하고 NORMAL이나 DELETE 행은 건너뛴다. 삭제될 행의 필드를 검증할 필요가 없기 때문이다.

## Combo·Select 컴포넌트 필수값

Combo나 Select 컴포넌트에서 초기값이 `""` 또는 특정 코드(예: `"0"`, `"ALL"`)로 설정된 경우, `gfn_isNull()`만으로는 부족하다.

```javascript
function fn_checkComboRequired(ds, col, emptyVal, label) {
    var val = ds.getColumn(0, col);
    if (gfn_isNull(val) || val == emptyVal) {
        alert(label + "을(를) 선택해 주세요.");
        return false;
    }
    return true;
}

// 사용 예: "0"을 선택 안 함으로 처리
fn_checkComboRequired(this.ds_input, "dept_cd", "0", "부서");
```

Combo의 초기 선택 항목 코드가 무엇인지 규약으로 정해두고 공통 함수에 파라미터로 전달하는 것이 좋다.

## 포커스 이동 처리

단순 `alert` 대신 실패한 컨트롤로 포커스를 이동하면 UX가 훨씬 좋아진다. 컨트롤 참조는 `this.컨트롤명`으로 직접 접근한다.

```javascript
if (gfn_isNull(ds.getColumn(0, "user_nm"))) {
    alert("사용자명은 필수 입력값입니다.");
    this.edt_user_nm.setFocus(); // Edit 컨트롤로 포커스 이동
    return false;
}
```

포커스 이동과 함께 컨트롤 배경색을 변경해 시각적으로 강조하는 방법은 `nexacro-n-validation-ux` 글에서 다룬다.

---

**지난 글:** [[Nexacro N] 유효성 검사 개요](/posts/nexacro-n-validation/)

**다음 글:** [[Nexacro N] 형식 검사](/posts/nexacro-n-format-check/)

<br>
읽어주셔서 감사합니다. 😊
