---
title: "[Nexacro N] 폼 재사용 전략과 공통 컴포넌트"
description: "Nexacro N에서 폼 재사용을 극대화하는 세 가지 전략을 설명합니다. BaseForm 상속, Include 컴포넌트, 표준 팝업 패턴을 통해 중복 코드를 줄이고 유지보수성을 높이는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-19"
archiveOrder: 5
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "폼재사용", "BaseForm", "상속", "include", "공통컴포넌트"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-memory-leak-patterns/)에서 메모리 누수 패턴을 살펴보았다. 안정적인 코드를 작성하려면 성능 관리만큼이나 중복을 줄이는 설계가 중요하다. Nexacro N 프로젝트에서 수십, 수백 개의 화면을 개발하다 보면 동일한 코드가 여러 폼에 복붙되어 관리가 어려워지는 시점이 온다. 공통 단축키 처리, 권한 확인, 버튼 활성화 로직이 모든 폼에 산재하면, 정책이 바뀔 때마다 전체를 수정해야 한다. 폼 재사용 구조를 처음부터 잡으면 이 문제를 구조적으로 해결할 수 있다.

## 세 가지 재사용 레이어

Nexacro N의 폼 재사용 전략은 세 층위로 나뉜다.

![폼 재사용 아키텍처](/assets/posts/nexacro-n-form-reuse-architecture.svg)

**상속(Inheritance)**은 부모 폼의 코드와 이벤트를 자식 폼이 그대로 물려받는 구조다. `BaseForm.xfdl`에 공통 변수, 단축키 핸들러, 권한 체크, 공통 Transaction 래퍼를 구현하고, 모든 업무 폼이 이를 상속한다.

**Include**는 UI 조각을 현재 폼에 삽입하는 방식이다. 검색 바, 페이지 컨트롤, 버튼 영역 같은 반복 UI를 독립 파일로 만들어 필요한 곳에 삽입한다. Include된 폼은 독립적으로 레이아웃과 이벤트를 갖고, 부모 폼과는 커스텀 이벤트로 통신한다.

**팝업 재사용**은 검색 팝업, 코드 선택 팝업 같은 공용 팝업을 표준화하는 것이다. 인자(args)와 콜백으로 데이터를 교환하는 패턴을 통일하면 여러 화면에서 동일한 팝업을 공유할 수 있다.

## BaseForm 상속 구현

프로젝트에서 모든 폼이 공유해야 하는 기능을 `BaseForm.xfdl`에 집중시킨다.

![BaseForm 상속 코드 패턴](/assets/posts/nexacro-n-form-reuse-code.svg)

```javascript
// BaseForm.xfdl 스크립트

// 공통 단축키 처리: 자식 폼에 fnSearch가 있으면 F5로 호출
function form_onkeydown(obj, e) {
    if (e.keycode === 116) {   // F5
        if (typeof this.fnSearch === "function") {
            e.cancelBubble = true;
            this.fnSearch();
        }
    }
    if (e.keycode === 112) {   // F1 도움말
        this.fnShowHelp();
    }
}

// 공통 권한 확인 래퍼
function fnCheckAuth(sMenuId) {
    return gfn_checkAuth(sMenuId);
}

// 공통 메시지 확인 다이얼로그
function fnConfirm(sMsg, fnYes, fnNo) {
    gfn_confirm(sMsg, fnYes, fnNo, this);
}

// 공통 에러 처리
function fnHandleError(sId, nErrorCode, sErrorMsg) {
    if (nErrorCode != 0) {
        trace("[ERROR] " + sId + ": " + sErrorMsg);
        alert("오류가 발생했습니다.\n" + sErrorMsg);
        return false;
    }
    return true;
}
```

자식 폼은 `inheriturl` 속성으로 BaseForm을 상속한다.

```xml
<!-- UserList.xfdl -->
<Form
  id="UserList"
  inheriturl="BaseForm.xfdl"
  ...>
```

```javascript
// UserList.xfdl 스크립트

function form_onload(obj, e) {
    // 필요하면 부모의 onload 명시 호출
    // 상속된 이벤트는 자동 실행되므로 일반적으로 불필요
    this.fnSearch();
}

function fnSearch() {
    // 부모의 fnHandleError를 재사용
    this.transaction("USER_LIST", svcUrl, args, output, "", function(id, err, msg) {
        if (!this.fnHandleError(id, err, msg)) return;
        // 조회 결과 처리
    });
}
```

## Include 컴포넌트 설계

자주 반복되는 UI 영역을 `Include`로 분리한다. Studio에서 Form 타입을 `Include`로 설정하고, 삽입할 위치에 `<Include>` 태그로 연결한다.

```xml
<!-- SearchBar.xfdl (Include 폼) -->
<Form id="SearchBar" type="include" ...>
  <Objects>
    <Edit id="edtKeyword" .../>
    <Button id="btnSearch" text="조회" onclick="btnSearch_onclick" .../>
  </Objects>
</Form>
```

```javascript
// SearchBar.xfdl 스크립트
function btnSearch_onclick(obj, e) {
    // 부모 폼에 커스텀 이벤트 발생
    this.fireEvent("onsearch", { keyword: this.edtKeyword.value });
}
```

```xml
<!-- UserList.xfdl에 Include 삽입 -->
<Include id="incSearchBar"
         url="components/SearchBar.xfdl"
         onsearch="incSearchBar_onsearch" .../>
```

```javascript
// UserList.xfdl 스크립트
function incSearchBar_onsearch(obj, e) {
    var sKeyword = e.keyword;
    this.dsSearch.setColumn(0, "KEYWORD", sKeyword);
    this.fnSearch();
}
```

이 방식의 장점은 SearchBar가 어떤 폼에서든 독립적으로 동작하고, 부모 폼과의 결합이 느슨하다는 것이다.

## 표준 팝업 패턴

공용 검색 팝업은 인자와 콜백을 표준화해야 여러 화면에서 재사용할 수 있다.

```javascript
// 공통 팝업 오픈 함수 (공통 라이브러리에 위치)
function gfn_openPopup(sPopupId, sFormUrl, oArgs, fnCallback, oParent) {
    var oPopup = oParent.openPopup(sPopupId, sFormUrl, oArgs, "modal");
    oPopup._fnCallback = fnCallback;
    oPopup._oParent    = oParent;
    return oPopup;
}

// 팝업 내부에서 선택 완료 시
function fnConfirmSelection() {
    var oResult = {
        ID:   this.dsResult.getColumn(this.grdResult.currentrow, "ID"),
        NAME: this.dsResult.getColumn(this.grdResult.currentrow, "NAME")
    };
    if (typeof this._fnCallback === "function") {
        this._fnCallback.call(this._oParent, this, oResult);
    }
    this.close();
}

// 팝업 사용 측 (UserList.xfdl)
function btnPopup_onclick(obj, e) {
    var oArgs = { TYPE: "USER", DEPT: this.dsSearch.getColumn(0, "DEPT_CD") };
    gfn_openPopup("popUserSearch", "/forms/UserSearchPopup.xfdl",
                  oArgs, this.fnPopupCallback, this);
}

function fnPopupCallback(oPopup, oResult) {
    this.dsMain.setColumn(this.dsMain.rowposition, "USER_ID",   oResult.ID);
    this.dsMain.setColumn(this.dsMain.rowposition, "USER_NAME", oResult.NAME);
}
```

## 폼 캐싱 전략

자주 접근하는 화면은 닫지 않고 숨기는 방식으로 캐싱 효과를 낼 수 있다.

```javascript
// 탭 전환 시 폼을 소멸시키지 않고 숨기기
function fnSwitchTab(sTargetFormId) {
    var aForms = this.getContainerChildForms();
    for (var i = 0; i < aForms.length; i++) {
        aForms[i].set_visible(aForms[i].id === sTargetFormId);
    }
}
```

단, 캐시된 폼은 메모리를 계속 점유한다. 탭이 많거나 데이터가 큰 폼이라면 접근 빈도와 메모리 비용을 비교해 캐싱 여부를 결정한다.

## 공통 Dataset 공유

여러 폼에서 공통으로 사용하는 코드성 Dataset(부서 코드, 상태 코드 등)은 애플리케이션 레벨에서 한 번만 로드하고 공유한다.

```javascript
// Application 스크립트에서 공통 코드 로드
function application_onload(obj, e) {
    this.transaction("COMMON_CODE", svcUrl, "",
                     "dsDeptCode=dsDeptCode:G dsStsCode=dsStsCode:G",
                     "", "cbCommonCode");
}

// 각 폼에서 애플리케이션 Dataset 참조
function form_onload(obj, e) {
    // 애플리케이션 Dataset을 콤보에 바인딩
    this.cmbDept.set_innerdataset(application.dsDeptCode);
}
```

## 재사용 가능한 컴포넌트 체크리스트

폼/컴포넌트를 재사용 가능하게 만들 때 확인할 사항:

1. **하드코딩 없음**: URL, 서비스 이름, 컬럼명이 파라미터로 주입 가능한가
2. **단방향 의존**: Include/팝업이 부모를 직접 참조하지 않고 이벤트로 통신하는가
3. **독립 테스트**: 단독으로 열어도 오류 없이 동작하는가
4. **메모리 정리**: `onunload`에서 등록한 핸들러를 해제하는가
5. **문서화**: 이벤트 인터페이스와 인자 형식이 코드에 명시되어 있는가

## 정리

Nexacro N의 폼 재사용 구조는 크게 세 층위로 나뉜다. BaseForm 상속으로 공통 코드를 집중하고, Include로 반복 UI를 모듈화하며, 팝업 패턴을 표준화해 여러 화면이 공유하게 만든다. 처음부터 이 세 층위를 명확히 설계하면 화면이 수백 개로 늘어나도 유지보수가 가능하다. 늦게 도입할수록 레거시 코드를 리팩터링해야 하는 부담이 커진다.

---

**지난 글:** [\[Nexacro N\] 메모리 누수 패턴과 진단](/posts/nexacro-n-memory-leak-patterns/)

**다음 글:** [\[Nexacro N\] trace() 로깅 활용 가이드](/posts/nexacro-n-trace-logging/)

<br>
읽어주셔서 감사합니다. 😊
