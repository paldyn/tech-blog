---
title: "[Nexacro N] Hidden — 화면에 보이지 않는 데이터 컨테이너"
description: "Nexacro N Hidden 컴포넌트의 역할과 동작 원리, 로그인 사용자 정보·권한 코드·조회 조건 저장, Dataset 연동, 팝업 파라미터 전달, 보안 고려 사항을 실무 관점에서 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 9
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "hidden", "히든", "숨겨진컴포넌트", "파라미터전달", "사용자정보", "보안"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-select-multiselect/)에서 리스트 박스 형태의 Select와 MultiSelect 컴포넌트를 살펴봤습니다. 이번에는 화면에 전혀 보이지 않지만 중요한 역할을 하는 **Hidden 컴포넌트**를 다룹니다. Hidden은 폼 내에서 사용자에게 노출하지 않으면서 값을 보관하고, 서버 전송 시 Dataset에 포함시키는 용도로 사용됩니다. 제대로 이해하면 코드를 간결하게 만들고 로직을 더 명확하게 구조화할 수 있습니다.

## Hidden 컴포넌트란

`Hidden` 컴포넌트는 Edit 컴포넌트와 동일한 방식으로 값을 보관하지만, `visible` 속성이 기본적으로 `false`여서 사용자 눈에 보이지 않습니다. 내부적으로는 일반 Edit과 동일하게 동작하므로 `value`, `set_value()`, Dataset 바인딩이 모두 가능합니다.

Hidden을 사용하는 대신 전역 변수(`var gv_userId = "";`)에 값을 저장할 수도 있습니다. 두 방식의 차이는 다음과 같습니다.

| 방식 | Dataset 자동 포함 | 폼 초기화 시 관리 | 생명 주기 |
|------|-----------|-----------|---------|
| Hidden | 바인딩 시 자동 | 폼과 함께 초기화 | 폼 생명 주기 |
| 전역 변수 | 수동 처리 필요 | 앱 전체 유지 | 앱 생명 주기 |

전역 변수는 앱 전체에서 공유해야 하는 값(로그인 사용자 ID)에, Hidden은 특정 폼에서만 필요한 값(조회 조건, 팝업에서 전달된 파라미터)에 적합합니다.

![Hidden — 화면 데이터 흐름](/assets/posts/nexacro-n-hidden-input-flow.svg)

## Hidden 선언

Studio에서 `Hidden` 컴포넌트를 드래그 앤 드롭하면 됩니다. 폼 XFDL 파일에는 다음과 같이 선언됩니다.

```xml
<!-- 화면에 보이지 않는 Hidden 컴포넌트들 -->
<Edit id="hdnUserId"  left="0" top="0" width="0" height="0"
      taborder="-1"/>
<Edit id="hdnDeptCd"  left="0" top="0" width="0" height="0"
      taborder="-1"/>
<Edit id="hdnRefKey"  left="0" top="0" width="0" height="0"
      taborder="-1"/>
```

`taborder="-1"`로 설정해 Tab 키 이동 순서에서 제외합니다. 크기는 0×0으로 설정하거나 화면 밖 좌표에 배치합니다.

## Form 로드 시 값 설정

화면이 열릴 때 전역 변수나 Application 객체에서 값을 가져와 Hidden에 저장합니다.

```javascript
function Form_onload(obj, e) {
    var app = nexacro.getApplication();
    // 전역 변수에서 사용자 정보 읽기
    this.hdnUserId.set_value(app.gv_userId);
    this.hdnDeptCd.set_value(app.gv_deptCd);
    this.hdnUserNm.set_value(app.gv_userNm);
}
```

이후 서버 전송 Dataset에 이 Hidden들을 바인딩해 두면, 트랜잭션마다 자동으로 사용자 정보가 포함됩니다.

## Dataset 바인딩 연동

Hidden을 Dataset의 컬럼에 바인딩하면, Dataset에서 행이 변경될 때 Hidden의 값도 자동으로 갱신됩니다.

```xml
<!-- Dataset 바인딩된 Hidden -->
<Edit id="hdnRegUserId"
      binddataset="dsMain"
      bindcolumn="REG_USER_ID"
      left="0" top="0" width="0" height="0"/>
```

조회 결과의 `REG_USER_ID` 컬럼 값을 Hidden에 보관했다가, 수정 저장 시 그대로 서버로 전송하는 패턴입니다.

## fn_save 에서 Hidden 값 활용

저장 트랜잭션에서 Hidden 값을 Dataset에 직접 세팅하는 패턴입니다.

```javascript
function fn_save() {
    var nRow = this.dsMain.rowposition;
    if (nRow < 0) return;

    // Hidden에서 사용자 ID 가져와 Dataset에 설정
    this.dsMain.setColumn(nRow, "MOD_USER_ID",
        this.hdnUserId.value);
    this.dsMain.setColumn(nRow, "MOD_DEPT_CD",
        this.hdnDeptCd.value);

    // 저장 트랜잭션 실행
    this.transaction(
        "fnSave",
        "svc/main/save.do",
        "dsMain:dsMain",
        "dsResult:dsResult",
        "",
        "fn_save_cb"
    );
}
```

![Hidden — 값 설정 및 참조 패턴](/assets/posts/nexacro-n-hidden-input-code.svg)

## 팝업 파라미터 수신

팝업 화면에서 값을 받아올 때 Hidden을 임시 저장 공간으로 활용합니다.

```javascript
// 팝업 콜백에서 전달받은 값 Hidden에 저장
function fn_popupCallback(sPopupId, vReturnValue) {
    if (vReturnValue) {
        this.hdnRefKey.set_value(vReturnValue.refKey);
        this.hdnRefNm.set_value(vReturnValue.refNm);
        // 화면에도 표시
        this.edtRefNm.set_value(vReturnValue.refNm);
    }
}
```

팝업에서 받은 코드 키는 `hdnRefKey`에, 표시 명칭은 `edtRefNm`에 각각 저장합니다. 저장 시에는 Hidden의 키 값을 Dataset에 포함시켜 서버로 전송합니다.

## 조회 조건 보존

페이지 이동이나 탭 전환 후에도 이전 조회 조건을 유지해야 할 때 Hidden에 저장합니다.

```javascript
// 조회 전 조건 보존
function fn_search() {
    // 조회 조건을 Hidden에 백업
    this.hdnLastSearchKw.set_value(this.edtKeyword.value);
    this.hdnLastSearchDt.set_value(this.calDate.value);

    // 실제 조회 실행
    this.transaction(/* ... */);
}

// 탭 복귀 시 마지막 조건 복원
function fn_restoreSearchCondition() {
    if (this.hdnLastSearchKw.value) {
        this.edtKeyword.set_value(this.hdnLastSearchKw.value);
        this.calDate.set_value(this.hdnLastSearchDt.value);
    }
}
```

## Hidden vs 전역 변수 선택 기준

```javascript
// 전역 변수가 적합한 경우: 앱 전체에서 공유
var app = nexacro.getApplication();
app.gv_userId  = "U001"; // 로그인 사용자 ID (앱 전체)
app.gv_deptCd  = "D02";  // 소속 부서 코드

// Hidden이 적합한 경우: 특정 폼 내에서만 사용
// 팝업 콜백값, 조회 조건 임시 저장, 행별 키 값 등
```

로그인 정보처럼 앱 전체 수명 동안 유지되어야 하는 값은 Application 전역 변수에, 특정 화면의 임시 데이터는 Hidden에 저장하는 것이 원칙입니다.

## 보안 고려 사항

Hidden 컴포넌트의 값은 클라이언트 측에서 개발자 도구로 수정할 수 있습니다. 따라서 **권한 코드, 사용자 ID 같은 보안 민감 정보**를 Hidden에 저장했더라도 서버에서 반드시 재검증해야 합니다. 클라이언트가 전송한 사용자 ID를 그대로 신뢰하지 말고, 서버의 세션 정보와 대조하는 것이 안전합니다.

---

**지난 글:** [Select / MultiSelect — 리스트 박스 선택 컴포넌트](/posts/nexacro-n-select-multiselect/)

**다음 글:** [Static — 텍스트 레이블 컴포넌트의 모든 활용법](/posts/nexacro-n-static/)

<br>
읽어주셔서 감사합니다. 😊
