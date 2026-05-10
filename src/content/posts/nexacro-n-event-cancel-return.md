---
title: "[Nexacro N] 이벤트 취소와 return 값 제어"
description: "Nexacro N 이벤트에서 e.cancel = true와 return false로 기본 동작을 취소하는 방법을 설명합니다. onkillfocus 포커스 유지, oncelleditbegin 편집 차단, onclose 닫기 방지 등 실전 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-10"
archiveOrder: 5
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "event-cancel", "return-false", "onkillfocus", "oncelleditbegin", "onclose"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-this-context/)에서 `this` 컨텍스트를 살펴봤습니다. 이번 글에서는 이벤트 핸들러 안에서 **기본 동작을 취소하는 두 가지 방법**, `e.cancel = true`와 `return false`를 다룹니다. 이 두 기법을 잘 활용하면 필수값 미입력 시 포커스를 유지하거나, 특정 조건에서 Grid 셀 편집을 막거나, 변경 사항이 있을 때 창 닫기를 방지하는 UX를 구현할 수 있습니다.

## 이벤트 취소의 두 가지 방법

Nexacro N에서 이벤트의 기본 동작을 취소하는 방법은 두 가지입니다.

- **`e.cancel = true`**: 이벤트 객체의 `cancel` 속성을 `true`로 설정합니다. 주로 `before*` 이벤트 또는 `onkillfocus`, `onclose` 등에서 사용합니다.
- **`return false`**: 핸들러 함수에서 `false`를 반환합니다. `oncelleditbegin`, `onvalidate` 등 일부 이벤트에서 지원합니다.

두 방법이 동일하게 동작하는 이벤트도 있고, 특정 방법만 지원하는 이벤트도 있습니다. 이벤트 레퍼런스에서 해당 이벤트가 취소를 지원하는지 확인하는 습관이 중요합니다.

![이벤트 취소 흐름 다이어그램](/assets/posts/nexacro-n-event-cancel-return-flow.svg)

## 활용 사례 1 — onkillfocus로 포커스 유지

필수 입력 필드에서 값 없이 포커스를 이탈하려 할 때, `e.cancel = true`로 포커스를 원래 컴포넌트에 유지시킬 수 있습니다.

```javascript
this.edt_userId.onkillfocus = function(obj, e) {
    if (obj.value === "" || obj.value === null) {
        e.cancel = true;  // 포커스 이탈 취소 → 포커스 유지
        alert("사용자 ID는 필수 입력 항목입니다.");
    }
};
```

단, `e.cancel = true`를 남용하면 사용자가 해당 필드에서 빠져나올 수 없어 불편함을 줄 수 있습니다. 실무에서는 저장 버튼 클릭 시 전체 유효성 검사를 하는 방식을 병행합니다.

## 활용 사례 2 — oncelleditbegin으로 편집 차단

Grid에서 특정 조건의 행은 편집을 막아야 할 때, `return false`를 사용합니다.

```javascript
this.grd_list.oncelleditbegin = function(obj, e) {
    var oDs    = obj.getBindDataset();
    var sRowSt = oDs.getRowStatus(e.row);

    // 조회 상태("R") 행은 편집 불가
    if (sRowSt === "R" && g_bReadOnly) {
        return false; // 셀 편집 시작 취소
    }

    // 특정 컬럼은 항상 읽기 전용
    var sColId = obj.getCellProperty(0, e.col, "id");
    if (sColId === "PROD_CD" && sRowSt !== "I") {
        return false;
    }
};
```

`e.row`와 `e.col`은 클릭한 셀의 행·열 인덱스입니다. `getCellProperty`로 해당 셀의 컬럼 ID를 확인할 수 있습니다.

## 활용 사례 3 — onclose로 창 닫기 방지

팝업이나 탭 Form을 닫기 전에 미저장 변경 사항이 있으면 사용자에게 확인을 받는 패턴입니다.

```javascript
this.form.onclose = function(obj, e) {
    if (!fn_hasUnsavedChanges()) return; // 변경 없으면 그냥 닫기

    var nResult = confirm("저장하지 않은 변경 사항이 있습니다. 닫으시겠습니까?");
    if (nResult !== 1) {
        // confirm 창에서 '취소'를 선택한 경우
        e.cancel = true; // 닫기 취소
    }
};

function fn_hasUnsavedChanges() {
    // Dataset의 변경 행 수가 0보다 크면 true
    return this.dsMain.rowcount > 0 &&
           this.dsMain.getDeletedRowCount() + this.dsMain.getModifiedRowCount() > 0;
}
```

![이벤트 취소 활용 사례 3가지](/assets/posts/nexacro-n-event-cancel-return-cases.svg)

## return false vs return true

일부 이벤트는 `return false`가 아닌 `return true`로 특정 동작을 활성화하기도 합니다. 예를 들어 `onvalidate`는 `true`를 반환해야 유효성 검사 통과로 인식합니다.

```javascript
this.edt_email.onvalidate = function(obj, e) {
    var sVal = obj.value;
    var re   = /^[^@]+@[^@]+\.[^@]+$/;

    if (!re.test(sVal)) {
        // 유효성 실패
        return false; // 또는 e.cancel = true
    }
    return true; // 유효성 통과
};
```

이벤트마다 취소 방법과 반환값의 의미가 조금씩 다르므로, 사용 전에 반드시 공식 레퍼런스를 확인해야 합니다.

## 정리

| 이벤트 | 취소 방법 | 효과 |
|--------|----------|------|
| `onkillfocus` | `e.cancel = true` | 포커스 이탈 방지 |
| `oncelleditbegin` | `return false` | 셀 편집 진입 방지 |
| `onclose` | `e.cancel = true` | 창/Form 닫기 방지 |
| `onvalidate` | `return false` | 유효성 실패 처리 |
| `onchanged` | `e.cancel = true` | 값 변경 취소 (일부 컴포넌트) |

이벤트 취소를 잘 활용하면 유효성 검사와 UX를 동시에 챙길 수 있습니다. 다음 글에서는 이벤트 버블링 개념을 다룹니다.

---

**지난 글:** [this 컨텍스트 이해와 활용](/posts/nexacro-n-this-context/)

**다음 글:** [이벤트 버블링과 전파 제어](/posts/nexacro-n-event-bubbling/)

<br>
읽어주셔서 감사합니다. 😊
