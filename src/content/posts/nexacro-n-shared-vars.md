---
title: "[Nexacro N] 공유 변수와 application 객체 활용"
description: "Nexacro N에서 gv_ 전역 변수와 application 객체를 사용해 폼 간에 사용자 세션 정보와 공통 Dataset을 공유하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 4
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "공유변수", "gv_", "application객체", "전역변수", "Dataset공유"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-global-functions/)에서 `gfn_` 전역 함수 설계 원칙을 살펴보았다. 이번 글에서는 공통 라이브러리의 또 다른 축인 **공유 변수** 와 **`application` 객체**를 다룬다. 전역 함수가 "동작"을 공유한다면, 공유 변수는 "상태"를 공유한다.

## 전역 변수(gv_) — 로그인 세션 정보

Nexacro N에서 `.xjs` 파일 최상위에 선언한 `var` 변수는 전역 스코프에 등록되어 모든 폼에서 접근할 수 있다. 이 특성을 이용해 로그인 사용자 정보를 전역에 저장한다.

```javascript
// CommonVariables.xjs
var gv_userId = "";   // 로그인 사용자 ID
var gv_userNm = "";   // 로그인 사용자 이름
var gv_deptCd = "";   // 부서 코드
var gv_authCd = "";   // 권한 코드
var gv_langCd = "ko"; // 언어 코드
```

`gv_` (Global Variable) 접두사를 붙이면 전역 변수임을 즉시 알 수 있고, IDE 자동완성에서 목록을 쉽게 필터링할 수 있다.

![공유 변수 스코프 구조](/assets/posts/nexacro-n-shared-vars-scope.svg)

## gv_ 변수 설정 — 로그인 콜백

전역 변수는 로그인 성공 시 단 한 번 설정하고, 이후에는 읽기 전용으로 사용한다. 여러 곳에서 값을 변경하면 어느 폼이 값을 바꿨는지 추적하기 어려워진다.

![공유 변수 사용 코드 패턴](/assets/posts/nexacro-n-shared-vars-code.svg)

## application 객체 — Dataset 공유

Nexacro N의 `application` 객체는 애플리케이션 전체에서 접근 가능한 싱글턴이다. 이 객체에 Dataset을 붙여 두면 폼 간에 공통 코드 목록을 공유할 수 있다.

```javascript
// gfn_init.xjs 또는 로그인 폼에서 공통 코드 로드
function gfn_loadCommonCode() {
    var ds = new nexacro.Dataset("gds_code");
    application.addChild("gds_code", ds);
    // 서버에서 공통 코드 로드 (트랜잭션)
    application.transaction(
        "loadCode",
        "/common/getCode.do",
        "out:gds_code=output",
        "",
        "gfn_loadCodeCb",
        false
    );
}

function gfn_loadCodeCb(sId, nEC, sEM) {
    if (nEC != 0) { trace("공통 코드 로드 실패: " + sEM); return; }
    // 이제 모든 폼에서 application.gds_code 사용 가능
}
```

업무 폼에서는 별도 서버 호출 없이 `application.gds_code`를 콤보박스에 바인딩한다.

```javascript
// 업무 폼 Form_onload
function Form_onload(obj, e) {
    // 공통 코드 Dataset을 콤보에 바인딩
    this.cmb_deptCd.set_innerdataset(application.gds_code);
    this.cmb_deptCd.set_codecolumn("dept_cd");
    this.cmb_deptCd.set_datacolumn("dept_nm");

    // 전역 변수로 현재 사용자 표시
    this.sta_userName.set_text(gv_userNm + " 님");

    this.fn_search();
}
```

## application vs window — 범위 차이

| 구분 | application | window (PopupWindow/ChildFrame) |
|---|---|---|
| 범위 | 전체 애플리케이션 | 단일 창 |
| 수명 | 앱 종료까지 | 창 닫힐 때 해제 |
| 사용 용도 | 세션 정보, 공통 코드 | 창별 상태 |

멀티 윈도우 애플리케이션에서는 `application` 에 저장한 값이 모든 창에서 접근되므로 주의한다.

## 전역 변수 남용 경고

전역 변수는 편리하지만, 무분별하게 사용하면 유지보수가 어려워진다.

```javascript
// 나쁜 예 — 업무 데이터를 전역에 저장
var gv_currentOrderNo = ""; // 특정 화면의 임시 상태
var gv_tempDs = null;        // 특정 기능 전용 임시 변수

// 좋은 예 — 업무 데이터는 폼 레벨 변수에 보관
// SCR_ORDER.xfdl 내부
var m_currentOrderNo = "";
```

전역 변수는 **모든 폼이 공유해야 하는 불변 세션 데이터**에만 사용한다. 특정 화면의 임시 상태는 폼 레벨의 `var m_xxx` 변수에 보관한다.

## CommonVariables.xjs 초기화 시점

`CommonVariables.xjs`는 TypeDefinition 로드 시 파싱되므로, 초기값은 파일에 선언된 값이다. 로그인 전에 전역 변수를 읽으면 빈 문자열이 반환된다. 이를 방어하려면 업무 폼에서 필요 시 로그인 여부를 체크한다.

```javascript
function Form_onload(obj, e) {
    if (gfn_isNull(gv_userId)) {
        alert("세션이 만료되었습니다. 다시 로그인하세요.");
        gfn_gotoLogin();
        return;
    }
    this.fn_search();
}
```

---

**지난 글:** [[Nexacro N] 전역 함수(gfn) 설계와 활용](/posts/nexacro-n-global-functions/)

**다음 글:** [[Nexacro N] 공통 confirm·alert 팝업 설계](/posts/nexacro-n-common-confirm/)

<br>
읽어주셔서 감사합니다. 😊
