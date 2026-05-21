---
title: "[Nexacro N] MVP·MVC 아키텍처 적용"
description: "Nexacro N 프로젝트에 MVP 또는 MVC 아키텍처 패턴을 적용하는 방법을 설명합니다. View-Presenter 분리 방법, Presenter 파일 구조, 역할 경계 설정, 패턴 선택 기준을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 9
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "MVP", "MVC", "아키텍처", "Presenter", "View분리", "설계패턴"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-protocol-pl/)에서 PL 프로토콜의 내부 동작을 살펴보았다. 이번에는 Nexacro N 프로젝트에서 유지보수성을 높이기 위해 MVP 또는 MVC 패턴을 적용하는 방법을 다룬다.

Nexacro N Form은 기본적으로 모든 코드(UI 배치 + 이벤트 핸들러 + 비즈니스 로직)가 하나의 `.xfdl` 파일 안에 집중된다. 소규모 화면이라면 문제없지만, 200줄 이상의 Script가 Form에 직접 들어가면 테스트가 어렵고 코드 탐색도 힘들어진다. 아키텍처 패턴을 도입하면 역할을 명확히 나눌 수 있다.

## MVP vs MVC 비교

![MVP vs MVC 패턴 비교](/assets/posts/nexacro-n-mvp-mvc-patterns.svg)

**MVP(Model-View-Presenter)**는 View와 Presenter를 1:1로 분리하는 패턴이다. Form(View)은 UI 컴포넌트 배치와 이벤트 진입점만 담당하고, 실제 로직은 별도 `.xjs` Presenter 파일에서 처리한다. View가 Presenter를 참조하고, Presenter가 View의 컴포넌트에 접근하는 방향이다.

**MVC(Model-View-Controller)**는 Form Script 안에서 Controller 역할을 수행하는 함수들이 직접 Model(Dataset)을 조작하는 방식이다. Nexacro N의 기본 개발 방식에 가까우며, 코드량이 적고 설정이 단순하다.

규모가 큰 화면(Script 300줄 이상)이나 단위 테스트가 필요한 경우 MVP가 유리하다. 간단한 조회·저장 화면이라면 MVC가 실용적이다.

## MVP 구현 방법

![MVP Presenter 구현 예시](/assets/posts/nexacro-n-mvp-mvc-code.svg)

### View (Form)

Form은 이벤트 핸들러에서 Presenter를 호출하는 역할만 한다. Dataset과 컴포넌트는 Form에 선언되어 있고 Presenter가 참조해 사용한다.

```nexacro
// UserForm.xfdl Script
var presenter;

function Form_onload(obj, e) {
    presenter = gv_common.loadPresenter("UserPresenter.xjs", this);
    presenter.init(this);
}

function btn_search_onclick(obj, e) {
    presenter.onSearchClick();
}

function btn_save_onclick(obj, e) {
    presenter.onSaveClick();
}

function btn_delete_onclick(obj, e) {
    presenter.onDeleteClick();
}

// 콜백은 View에서 받아 Presenter로 위임
function fn_callback(id, errCode, errMsg) {
    presenter.onTransactionComplete(id, errCode, errMsg);
}
```

### Presenter

Presenter는 비즈니스 로직을 담당한다. View(Form)의 참조를 `init()`에서 받아서 Dataset과 컴포넌트에 접근한다.

```nexacro
// UserPresenter.xjs
var view, dsSearch, dsResult;

function init(frm) {
    view     = frm;
    dsSearch = frm.dsSearch;
    dsResult = frm.dsResult;

    // 초기 데이터 로드
    onSearchClick();
}

function onSearchClick() {
    if (!fn_validate()) return;
    view.transaction(
        "search",
        "SVC::UserService::search",
        "in:dsSearch",
        "out:dsResult",
        "",
        "fn_callback"
    );
}

function onSaveClick() {
    if (dsResult.rowcount == 0) {
        alert("저장할 데이터가 없습니다.");
        return;
    }
    if (!fn_validateForSave()) return;
    view.transaction(
        "save",
        "SVC::UserService::save",
        "in:dsResult",
        "out:dsResult",
        "",
        "fn_callback"
    );
}

function onTransactionComplete(id, errCode, errMsg) {
    if (errCode != 0) {
        alert("오류: " + errMsg);
        return;
    }
    if (id == "save") {
        alert("저장되었습니다.");
        onSearchClick();
    }
}

function fn_validate() {
    var userId = dsSearch.getColumn(0, "USER_ID");
    if (userId == "" && dsSearch.getColumn(0, "USER_NM") == "") {
        alert("검색 조건을 입력하세요.");
        view.Edit_userId.setFocus();
        return false;
    }
    return true;
}
```

## MVC 방식 (기본 패턴)

소규모 화면이라면 Form Script 안에서 Controller 함수를 잘 구조화하는 것만으로 충분하다.

```nexacro
// 단순 MVC — Form Script에서 직접 처리
// Controller 역할: fn_ 함수들
function btn_search_onclick(obj, e) {
    fn_search();
}

function fn_search() {
    if (!fn_validate()) return;
    this.transaction("search", "SVC::UserService::search",
        "in:dsSearch", "out:dsResult", "", "fn_searchCallback");
}

function fn_searchCallback(id, errCode, errMsg) {
    if (errCode != 0) { alert(errMsg); return; }
    // 결과 처리 (Dataset 바인딩으로 Grid 자동 갱신)
}
```

## 패턴 선택 가이드

| 상황 | 권장 패턴 |
|---|---|
| 조회·저장 단순 화면 | MVC (기본 방식) |
| Script 300줄 초과 | MVP로 전환 |
| 단위 테스트 필요 | MVP (Presenter 분리) |
| 팀 규모 10인 이상 | MVP + 공통 BasePresenter |
| 레거시 유지보수 | 기존 방식 유지, 신규만 MVP |

---

**지난 글:** [Nexacro 프로토콜 PL](/posts/nexacro-n-protocol-pl/)

**다음 글:** [베이스 폼 아키텍처 설계](/posts/nexacro-n-base-form-architecture/)

<br>
읽어주셔서 감사합니다. 😊
