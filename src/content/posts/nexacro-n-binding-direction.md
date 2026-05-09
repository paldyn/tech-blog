---
title: "[Nexacro N] 바인딩 방향 — 단방향·양방향 제어"
description: "Nexacro N 데이터바인딩의 방향을 displayonly·enable·readOnly 속성으로 제어하는 방법과, 조회 모드·편집 모드 전환 패턴을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 6
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "databinding", "binding-direction", "displayonly", "readonly", "enable"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-databinding/)에서 Nexacro N 데이터바인딩의 기본 원리를 살펴봤습니다. 기본 상태에서 바인딩은 양방향입니다. Dataset이 바뀌면 컴포넌트가 갱신되고, 컴포넌트에 입력한 값은 Dataset에 즉시 반영됩니다. 그러나 조회 전용 화면이나 특정 조건에서 입력을 막아야 할 때는 이 쓰기 방향을 차단해야 합니다.

## 양방향 vs 단방향

Nexacro N 자체에는 "바인딩 방향"을 한 번에 설정하는 단일 속성이 없습니다. 대신 컴포넌트의 `displayonly`, `enable`, `readOnly` 속성으로 사용자 입력을 차단해 사실상 단방향 바인딩을 구현합니다.

![바인딩 방향 — 단방향 vs 양방향](/assets/posts/nexacro-n-binding-direction-diagram.svg)

세 속성 모두 사용자 입력을 막지만 세부 동작이 다릅니다. 어떤 속성을 쓸지는 UX 요구사항에 따라 결정합니다.

## displayonly — 가장 많이 쓰는 읽기 전용

`displayonly="true"`로 설정하면 사용자가 편집할 수 없지만 컴포넌트는 활성화된 것처럼 보이고 포커스를 받을 수 있습니다. Dataset → 컴포넌트 방향은 정상 동작합니다.

```javascript
// 조회 모드로 전환
this.edtName.set_displayonly(true);
this.edtAmt.set_displayonly(true);
```

조회/편집 모드를 전환하는 화면에서 가장 많이 씁니다. 포커스를 받을 수 있어서 Tab 순서가 유지되고, 값 복사도 가능합니다.

## enable — 완전 비활성화

`enable="false"`는 컴포넌트를 완전히 비활성화합니다. 포커스도 받지 못하고 시각적으로 흐리게 표시됩니다.

```javascript
// 상태에 따라 콤보 비활성화
this.cboStatus.set_enable(someCondition);
```

특정 조건에서 컴포넌트 자체를 사용 불가로 만들 때 씁니다. 바인딩은 유지되므로 Dataset 값이 바뀌면 비활성 상태에서도 표시는 갱신됩니다.

## readOnly — 텍스트 복사 허용

`readOnly="true"`는 수정은 불가하지만 커서를 놓을 수 있고 텍스트 선택·복사가 가능합니다. Edit 계열 컴포넌트에서 지원합니다.

```javascript
this.edtCode.set_readOnly(true);
```

## 조회 모드 / 편집 모드 전환 패턴

실무 화면에서는 조회·신규·수정 세 가지 모드를 전환하는 패턴이 자주 쓰입니다.

![바인딩 방향 스크립트 제어](/assets/posts/nexacro-n-binding-direction-code.svg)

```javascript
function fn_onload_formload(obj, e) {
    this.fn_setViewMode(); // 처음에는 조회 모드
}

function btn_edit_onclick(obj, e) {
    this.fn_setEditMode(); // 수정 버튼 클릭 시 편집 모드
}

function btn_cancel_onclick(obj, e) {
    this.dsMain.restoreRow(this.dsMain.currentrow);
    this.fn_setViewMode(); // 취소 시 조회 모드 복귀
}
```

## Grid에서 바인딩 방향 제어

Grid에서는 개별 셀 단위로 편집 가능 여부를 설정합니다. Grid Format 에디터에서 셀의 `edittype`을 `none`으로 설정하면 해당 셀은 읽기 전용이 됩니다. 스크립트로 동적 변경도 가능합니다.

```javascript
// Grid 전체 편집 불가
this.grdMain.set_editable(false);

// 특정 컬럼만 편집 불가 — Format 에디터에서 edittype=none 설정
// 또는 oncellclick 이벤트에서 조건 분기
```

## 이벤트 활용 — onchanged 방향 제어

`onchanged` 이벤트 안에서 특정 컬럼 변경을 감지해 다른 컴포넌트를 활성/비활성하면 더 세밀한 제어가 가능합니다.

```javascript
function dsMain_onchanged(obj, e) {
    if (e.colid == "TYPE") {
        var isSpecial = (obj.getColumn(e.row, "TYPE") == "S");
        this.edtSpecialInfo.set_displayonly(!isSpecial);
    }
}
```

---

**지난 글:** [[Nexacro N] 데이터바인딩 개념과 기초](/posts/nexacro-n-databinding/)

**다음 글:** [[Nexacro N] bindcolumn과 value 속성 완전 정복](/posts/nexacro-n-bindcolumn-value/)

<br>
읽어주셔서 감사합니다. 😊
