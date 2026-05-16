---
title: "[Nexacro N] 페이지 내비게이션"
description: "Nexacro N에서 탭 방식, Frame 직접 전환 방식, 팝업 방식의 페이지 내비게이션 패턴을 비교하고, 히스토리 스택으로 뒤로가기를 구현하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "페이지내비게이션", "Tab", "ChildFrame", "히스토리", "화면전환"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-tab-frame/)에서 TabControl과 ChildFrame을 조합한 MDI 탭 Frame 구현을 살펴보았다. Nexacro N 애플리케이션에서 화면 전환 전략은 탭 방식 하나만 있는 것이 아니다. 프로젝트 성격에 따라 Frame 직접 전환이나 팝업을 선택할 수 있으며, 각 방식의 특성을 이해해야 적절한 내비게이션 패턴을 선택할 수 있다.

## 세 가지 내비게이션 패턴

Nexacro N에서 화면 전환에는 크게 세 가지 패턴이 있다.

**탭 내비게이션**: 업무 시스템의 표준. 여러 화면을 동시에 열어두고 탭으로 전환한다.

**직접 Frame 전환**: ContentFrame에 새 Form을 로드해 이전 Form을 교체한다. 모바일 앱이나 단순 흐름의 화면에 적합하다.

**팝업 내비게이션**: 부모 화면 위에 Modal 창을 띄운다. 코드 조회나 상세 선택에 최적이다.

![페이지 내비게이션 흐름](/assets/posts/nexacro-n-page-navigation-flow.svg)

## 탭 내비게이션

이전 글에서 상세히 다루었으므로 핵심만 정리한다. `tabMain.addTabItem(sId, sTitle)`으로 새 탭을 추가하고, `oNew.frame.loadForm(sUrl)`로 Form을 로드한다. 중복 탭 확인(`findTabItemById()`)과 닫기 전 변경 확인이 필수다.

## 직접 Frame 전환

단일 ContentFrame에 Form을 교체하는 방식이다.

```javascript
function fn_navigate(sUrl, oArg) {
    // 이전 Form에 이탈 경고 기회 제공
    var oForm = this.frmContent.form;
    if (oForm && oForm.fn_isDirty && oForm.fn_isDirty()) {
        if (this.gfn_confirm("변경 내용이 있습니다. 이동하시겠습니까?") != 1) {
            return;
        }
    }
    application["navArg"] = oArg;
    this.frmContent.loadForm(sUrl);
}
```

`application["navArg"]`에 전달 인자를 저장하면 새 Form의 `onload`에서 읽어 초기화할 수 있다.

## 히스토리 스택으로 뒤로가기 구현

직접 Frame 전환 방식에서는 브라우저 Back 버튼이 없으므로 배열 스택으로 히스토리를 직접 관리해야 한다.

```javascript
var aHistory = [];

function fn_navigate(sUrl) {
    aHistory.push(sUrl);
    this.frmContent.loadForm(sUrl);
}

function fn_goBack() {
    aHistory.pop();  // 현재 제거
    var sPrev = aHistory[aHistory.length - 1];
    if (sPrev) this.frmContent.loadForm(sPrev);
    else       this.frmContent.loadForm("home.xfdl");
}
```

![히스토리 스택 구현](/assets/posts/nexacro-n-page-navigation-code.svg)

뒤로가기 버튼 또는 헤더 Back 아이콘의 `onclick` 이벤트에서 `fn_goBack()`을 호출한다.

## 팝업 내비게이션

조회 팝업, 코드 선택 팝업처럼 결과를 부모에 전달하는 흐름은 `open()` + 콜백 패턴을 사용한다.

```javascript
// 부모 Form에서 팝업 열기
function btn_search_onclick(obj, e) {
    var oArg = { searchTerm: this.edtSearch.value };
    this.open("popSearch", "popSearch.xfdl", oArg, "fn_searchCallback");
}

// 팝업이 닫힐 때 실행되는 콜백
function fn_searchCallback(sId, oResult) {
    if (oResult) {
        this.edtCode.value = oResult.code;
        this.edtName.value = oResult.name;
    }
}
```

팝업 Form에서는 `this.close(oResult)`로 결과를 부모에 전달한다. 팝업 내비게이션은 별도 글에서 더 자세히 다룬다.

## 패턴 선택 기준

| 상황 | 권장 패턴 |
|------|----------|
| 여러 업무 화면 동시 작업 | 탭 내비게이션 |
| 목록 → 상세 단방향 흐름 | 직접 Frame 전환 + 히스토리 스택 |
| 코드/데이터 선택 | 팝업 (Modal) |
| 단순 공지·안내 | 팝업 (Modaless) |

대부분의 업무 시스템은 **탭 내비게이션을 기본**으로 하고, 팝업을 보조로 조합한다. 직접 Frame 전환은 모바일 환경이나 단계적 Wizard UI에 적합하다.

## Form 간 데이터 전달

어떤 내비게이션 패턴을 쓰더라도 데이터 전달 방법은 일관되게 적용할 수 있다.

```javascript
// application 전역 객체 활용
application["selectedRow"] = this.dsOrder.rowposition;
this.fn_navigate("order_detail.xfdl");

// 수신측 Form onload에서 읽기
function Form_onload(obj, e) {
    var nRow = application["selectedRow"];
    this.fn_search(nRow);
}
```

간단한 단일 값은 `application` 전역 객체, 복잡한 데이터는 공유 Dataset을 활용하는 것이 실무 관례다.

## 정리

Nexacro N 내비게이션의 핵심은 **탭(MDI), 직접 Frame, 팝업** 세 패턴의 조합이다. 업무 시스템은 탭 중심, 모바일 앱은 직접 Frame + 히스토리 스택, 데이터 선택은 팝업으로 구분하면 대부분의 시나리오를 커버할 수 있다.

---

**지난 글:** [Tab Frame 구성](/posts/nexacro-n-tab-frame/)

**다음 글:** [파일 업로드·다운로드](/posts/nexacro-n-file-upload-download/)

<br>
읽어주셔서 감사합니다. 😊
