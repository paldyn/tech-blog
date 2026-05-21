---
title: "[Nexacro N] 베이스 폼 아키텍처 설계"
description: "대규모 Nexacro N 프로젝트에서 베이스 폼(Base Form)을 활용한 아키텍처를 설계하는 방법을 설명합니다. 공통 로직 중앙화, 세션 처리, 오류 핸들러, 도메인별 중간 베이스 폼 구조를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 10
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "베이스폼", "아키텍처", "폼상속", "공통처리", "오류처리", "세션"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-mvp-mvc/)에서 MVP·MVC 패턴을 Nexacro N에 적용하는 방법을 살펴보았다. 이번에는 대규모 프로젝트에서 반드시 도입해야 하는 **베이스 폼(Base Form) 아키텍처**를 설계하는 방법을 다룬다.

화면이 100개, 200개를 넘어가는 프로젝트에서 세션 만료 처리, 공통 오류 메시지, 권한 체크, 공통 Dataset 초기화 같은 코드가 각 Form에 반복되면 유지보수가 불가능해진다. 베이스 폼은 이 공통 코드를 한 곳에 집중시키고 모든 업무 Form이 상속받게 하는 구조다.

## 베이스 폼 계층 구조

![베이스 폼 계층 구조](/assets/posts/nexacro-n-base-form-architecture-hierarchy.svg)

3계층 구조가 효과적이다. 최상위 `BaseForm`이 전 화면 공통 로직을 담고, 화면 유형별 중간 베이스 폼(ListBaseForm, DetailBaseForm, PopupBaseForm)이 그 아래에 위치하며, 실제 업무 Form들이 가장 하위에서 중간 베이스 폼을 상속받는다.

이 구조의 핵심 이점은 공통 버그를 한 곳에서 수정하면 전체 화면에 적용된다는 것이다. 세션 만료 처리 로직을 바꾸거나 공통 오류 메시지 형식을 변경할 때 파일 하나만 수정하면 된다.

## BaseForm 설계

![BaseForm 코드 구조](/assets/posts/nexacro-n-base-form-architecture-code.svg)

`BaseForm.xfdl`에는 다음 기능을 구현한다.

```nexacro
// BaseForm.xfdl Script

// ① 세션 정보 초기화
function fn_setSession() {
    gv_userId     = nexacro.getVariable("SESSION_USER_ID");
    gv_userNm     = nexacro.getVariable("SESSION_USER_NM");
    gv_deptCd     = nexacro.getVariable("SESSION_DEPT_CD");
    gv_accessToken = nexacro.getVariable("ACCESS_TOKEN");
}

// ② 공통 Dataset 초기화 (코드 Dataset 등)
function fn_initCommonDs() {
    if (gv_dsCommonCode == null) {
        this.transaction(
            "loadCode",
            "SVC::CommonService::getCodes",
            "", "out:gv_dsCommonCode", "",
            "fn_loadCodeCallback"
        );
    }
}

// ③ 공통 오류 콜백 — 자식 폼이 재정의하지 않으면 기본 처리
function fn_errorCallback(id, errCode, errMsg) {
    if (errCode == "SESSION_EXPIRED") {
        fn_sessionExpired();
        return;
    }
    if (errCode == "NO_PERMISSION") {
        alert("접근 권한이 없습니다.");
        return;
    }
    fn_showError(errCode, errMsg);
}

// ④ 세션 만료 처리
function fn_sessionExpired() {
    alert("세션이 만료되었습니다. 다시 로그인하세요.");
    nexacro.gapplication.exit();
    nexacro.gapplication.open("/login.html");
}

// ⑤ 공통 오류 메시지 표시
function fn_showError(errCode, errMsg) {
    var sMsg = "[" + errCode + "] " + errMsg;
    nexacro.toast(sMsg, 3000);
}
```

## 중간 베이스 폼 설계

`ListBaseForm.xfdl`은 조회 화면의 공통 패턴을 제공한다.

```nexacro
// ListBaseForm.xfdl — BaseForm 상속
// inherits="BaseForm.xfdl"

// 검색 공통 템플릿
function fn_search() {
    // 자식 폼에서 오버라이드하거나 직접 호출
    this.transaction(
        "search",
        gv_serviceId + "::search",
        "in:dsSearch",
        "out:dsResult",
        "",
        "fn_searchCallback"
    );
}

function fn_searchCallback(id, errCode, errMsg) {
    if (errCode != 0) {
        fn_errorCallback(id, errCode, errMsg);
        return;
    }
    // 검색 후 처리 — 자식 폼에서 fn_afterSearch를 오버라이드
    if (typeof fn_afterSearch == "function") {
        fn_afterSearch();
    }
}

// 페이징 공통
function fn_paging(pageNo) {
    dsSearch.setColumn(0, "PAGE_NO", pageNo);
    fn_search();
}
```

## 자식 폼 상속 방법

Nexacro N Studio에서 Form을 새로 만들 때 또는 기존 Form의 속성창에서 `inherits` 속성을 설정한다.

```xml
<!-- UserList.xfdl -->
<form id="UserList" inherits="ListBaseForm.xfdl" ...>
```

자식 Form의 Script에서는 부모 메서드를 재사용하거나 오버라이드한다.

```nexacro
// UserList.xfdl Script
function Form_onload(obj, e) {
    // 부모 onload 호출 (세션 초기화 등)
    this.parent.Form_onload.call(this, obj, e);

    // 화면 전용 초기화
    gv_serviceId = "UserService";
    fn_initCombo();
    fn_search();     // ListBaseForm의 fn_search 사용
}

// fn_afterSearch 오버라이드 — 검색 후 특별 처리가 필요할 때만
function fn_afterSearch() {
    if (dsResult.rowcount == 0) {
        Alert_noData.set_visible(true);
    } else {
        Alert_noData.set_visible(false);
    }
}

// 저장 버튼 — DetailBaseForm 메서드 없으므로 직접 구현
function btn_save_onclick(obj, e) {
    if (!fn_validateForSave()) return;
    this.transaction("save", "SVC::UserService::save",
        "in:dsResult", "", "", "fn_saveCallback");
}

function fn_saveCallback(id, errCode, errMsg) {
    if (errCode != 0) {
        fn_errorCallback(id, errCode, errMsg); // 부모 메서드
        return;
    }
    alert("저장되었습니다.");
    fn_search();
}
```

## 베이스 폼 설계 원칙

베이스 폼을 설계할 때 지켜야 할 원칙이 있다.

**공통성 검증**: 최소 3개 이상의 화면에서 반복되는 코드만 베이스 폼으로 이동한다. 1~2개 화면에만 쓰이는 로직을 베이스 폼에 넣으면 불필요한 의존성이 생긴다.

**얕은 계층**: 3계층 이상으로 깊어지면 상속 추적이 어렵다. BaseForm → DomainBaseForm → ConcreteForm의 3계층을 권장한다.

**오버라이드 가능성**: 베이스 폼의 모든 메서드는 자식 폼에서 오버라이드 가능해야 한다. 자식 폼에서 재정의할 수 없는 고정 로직은 최소화한다.

**테스트 가능성**: 베이스 폼 변경이 전체 화면에 영향을 미치므로, 변경 전 주요 화면을 반드시 테스트한다. 회귀 테스트 체크리스트를 문서화해 두면 실수를 줄일 수 있다.

---

**지난 글:** [MVP·MVC 아키텍처 적용](/posts/nexacro-n-mvp-mvc/)

**다음 글:** [화면 책임 설계](/posts/nexacro-n-screen-responsibility/)

<br>
읽어주셔서 감사합니다. 😊
