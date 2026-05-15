---
title: "[Nexacro N] 유효성 검사 UX 패턴"
description: "Nexacro N에서 유효성 검사 실패 시 사용자 경험을 개선하는 방법—구체적 에러 메시지, 자동 포커스 이동, 컨트롤 시각적 강조, 비파괴적 피드백—을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 10
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "validationUX", "포커스이동", "에러표시", "UX패턴", "setErrorCtrl"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-validation-common-fn/)에서 유효성 검사 공통 함수를 설계했다. 마지막으로 **유효성 검사 UX**를 다룬다. 검증 로직이 아무리 완벽해도 사용자에게 명확한 피드백을 주지 않으면 UX가 나빠진다. 어떤 피드백이 좋은 UX를 만들고 어떤 방식이 사용자를 혼란스럽게 하는지 정리한다.

## 좋은 UX와 나쁜 UX 비교

![유효성 검사 UX 패턴 비교](/assets/posts/nexacro-n-validation-ux-patterns.svg)

핵심은 네 가지 원칙이다.

1. **구체적 메시지**: "입력 오류"가 아닌 "사용자명은 필수 입력값입니다."
2. **자동 포커스 이동**: 사용자가 어디를 고쳐야 하는지 즉시 알 수 있게
3. **비파괴적 피드백**: 입력한 값을 지우지 말 것
4. **시각적 강조**: 오류 컨트롤에 배경색·테두리 변경

## 자동 포커스 이동 패턴

단건 폼에서는 오류 Edit 컨트롤의 `setFocus()`를 호출하고, 그리드에서는 `setCellPos()`를 사용한다.

```javascript
// 단건 폼 — Edit 포커스 이동
if (gfn_isNull(this.ds_input.getColumn(0, "user_nm"))) {
    alert("사용자명은 필수 입력값입니다.");
    this.edt_user_nm.setFocus(); // 포커스 이동
    return;
}

// 그리드 — 특정 셀로 포커스 이동
this.grd_list.setCellPos(rowIndex, "item_nm");
```

`setFocus()`는 해당 컨트롤로 커서를 이동하고 선택 상태로 만든다. 사용자는 alert를 닫는 즉시 수정을 시작할 수 있다.

## 컨트롤 시각적 강조

![오류 컨트롤 강조 코드](/assets/posts/nexacro-n-validation-ux-highlight.svg)

오류가 발생한 컨트롤의 배경색과 테두리를 변경해 시각적으로 강조한다. 수정 후 원래 스타일로 복원한다.

```javascript
// 공통 라이브러리
function gfn_setErrorCtrl(ctrl, bError) {
    if (bError) {
        ctrl.style.background = "#FFF0F0"; // 연한 빨간 배경
        ctrl.style.border     = "1px solid #e05555"; // 빨간 테두리
    } else {
        ctrl.style.background = ""; // 원래 스타일로
        ctrl.style.border     = "";
    }
}

// onkillfocus에서 자동 복원
function edt_user_nm_onkillfocus(obj, e) {
    var isErr = gfn_isNull(obj.value);
    gfn_setErrorCtrl(obj, isErr);
}
```

`onkillfocus`에서 실시간으로 오류 상태를 갱신하면, 사용자가 내용을 입력하는 즉시 빨간 강조가 사라져 즉각적인 긍정 피드백을 준다.

## 에러 메시지 품질 가이드

좋은 에러 메시지는 세 가지를 포함한다.

| 요소 | 나쁜 예 | 좋은 예 |
|---|---|---|
| 항목 | "오류" | "이메일 주소" |
| 문제 | "잘못됨" | "형식이 올바르지 않습니다" |
| 기대 | (없음) | "(예: user@example.com)" |

```javascript
// 나쁜 예
alert("입력값을 확인하세요.");

// 좋은 예
alert("이메일 주소 형식이 올바르지 않습니다. (예: user@example.com)");
```

실무에서는 에러 메시지를 코드화해 다국어 지원과 일관성을 확보한다.

## 저장 전 confirm 팝업 — 사용 기준

일부 프로젝트에서는 저장 전 "저장하시겠습니까?" confirm을 표시한다. 이것이 항상 좋은 패턴은 아니다.

```javascript
// confirm이 적합한 경우: 삭제처럼 되돌리기 어려운 작업
function fn_delete() {
    if (!confirm("선택한 항목을 삭제하시겠습니까?")) return;
    this.transaction("delete", "svc/delete.do", ...);
}

// confirm이 불필요한 경우: 일반 저장 (검증을 통과했으면 바로 저장)
function fn_save() {
    if (!gfn_validate(this.ds_input, rules, ctrl)) return;
    // confirm 없이 바로 저장
    this.transaction("save", "svc/save.do", ...);
}
```

저장은 확인 없이 진행하고, 삭제처럼 복구가 어려운 작업에만 confirm을 사용하는 것이 현대적인 UX 설계다.

## 그리드 오류 행 표시

그리드에서 오류가 발생한 행 전체를 강조할 수 있다. `Grid.setRowBackgroundColor()` 같은 메서드는 없으므로, Dataset의 컬럼을 활용하거나 그리드 스타일 표현식을 사용한다.

```javascript
// Dataset에 오류 플래그 컬럼 추가
this.ds_order.addColumn("err_yn", "string", 1);

// 오류 발생 시 플래그 설정
this.ds_order.setColumn(r, "err_yn", "Y");

// 그리드 Format Editor에서 셀 배경 표현식 설정
// background: dataset.getColumn(currentrow, "err_yn") == "Y" ?
//             "#FFF0F0" : ""
```

그리드 셀의 배경 표현식을 `err_yn` 컬럼 값에 연동하면 저장 전 오류 행을 시각적으로 구분할 수 있다.

## 검증 성공 피드백

검증 성공(저장 완료) 시에도 사용자에게 알리는 것이 좋다. 단순 `alert` 대신 일시적으로 표시되는 메시지나 상태바를 활용한다.

```javascript
function fn_saveCb(sId, nEC, sEM) {
    if (nEC != 0) { alert(sEM); return; }
    this.ds_list.savePoint();

    // 저장 성공 메시지 — 2초 후 자동 사라짐
    this.sta_msg.set_text("저장이 완료되었습니다.");
    this.sta_msg.set_visible(true);
    var self = this;
    setTimeout(function() {
        self.sta_msg.set_visible(false);
    }, 2000);
}
```

`Static` 컴포넌트를 메시지 표시용으로 활용하면 alert를 닫아야 하는 불편함 없이 저장 성공을 알릴 수 있다.

---

**지난 글:** [[Nexacro N] 유효성 검사 공통 함수 설계](/posts/nexacro-n-validation-common-fn/)

<br>
읽어주셔서 감사합니다. 😊
