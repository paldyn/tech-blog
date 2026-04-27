---
title: "[Nexacro N] 이벤트와 스크립트 작성법"
description: "Nexacro N의 이벤트 구조, 핸들러 작성 패턴, this·nexacro·application 스코프 차이, 동적 이벤트 바인딩까지 실무 코드 중심으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-22"
archiveOrder: 13
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "event", "script", "onload", "onclick", "transaction"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-layout-and-style/)에서 이어집니다.

이 글은 **Nexacro N 기준으로 작성되었습니다.**
넥사크로를 처음 배울 때 가장 헷갈리는 부분 중 하나가 바로 "스크립트를 어디에, 어떻게 써야 하나"입니다.
웹 개발의 `addEventListener`나 React의 `onClick`에 익숙한 분들도, 넥사크로의 이벤트 등록 방식과 스코프 체계는 생소하게 느껴질 수 있습니다.
이번 글에서는 넥사크로 N의 이벤트 구동 원리부터 실무에서 매일 쓰는 핸들러 패턴, `this` · `nexacro` · `application` 세 스코프의 차이, 그리고 동적 이벤트 바인딩까지 코드 중심으로 정리합니다.

---

## 이벤트가 동작하는 원리

넥사크로 N에서 이벤트는 **사용자 행동 또는 시스템 상태 변화 → 이벤트 객체 생성 → 핸들러 함수 호출** 순서로 동작합니다.

![Nexacro N 이벤트 흐름 다이어그램](/assets/posts/nexacro-event-flow.svg)

모든 이벤트 핸들러는 두 개의 매개변수를 받습니다.

```javascript
// 이벤트 핸들러의 표준 시그니처
// obj: 이벤트가 발생한 컴포넌트 자신 (this.Button00 과 동일)
// e  : EventInfo 객체 — 이벤트 부가 정보를 담고 있음
function Button_onclick(obj, e) {
    // obj.id 로 어떤 컴포넌트에서 이벤트가 발생했는지 확인 가능
    trace("클릭된 버튼 ID: " + obj.id);
}
```

`e` 객체는 이벤트 종류에 따라 담겨 있는 정보가 달라집니다.

```javascript
// onchange 이벤트의 e 객체 활용 예시
function edtSearch_onchange(obj, e) {
    // e.postdata: 변경 이전 값
    // obj.value : 변경 이후 현재 값
    var sBefore = e.postdata;
    var sAfter  = obj.value;
    trace("변경 전: " + sBefore + " / 변경 후: " + sAfter);
}

// 트랜잭션 콜백(oncalldataset)에서 e 객체 활용 예시
function fn_callbackSearch(svcid, errorcode, errormsg) {
    // svcid    : this.transaction() 호출 시 지정한 서비스 ID
    // errorcode: 0 이면 정상, 음수이면 오류
    // errormsg : 오류 메시지 문자열
    if (errorcode < 0) {
        this.alert("조회 오류: " + errormsg);
        return;
    }
    trace("조회 완료 — 건수: " + this.dsResult.rowcount);
}
```

---

## XFD에서 이벤트 핸들러 등록하기

Nexacro Studio에서 컴포넌트를 선택하고 속성 패널의 **이벤트 탭**을 열면 해당 컴포넌트가 지원하는 모든 이벤트 목록이 나타납니다.
이벤트 이름 옆 입력란에 함수명을 입력하거나 더블클릭하면 스크립트 에디터에 핸들러 함수 뼈대가 자동 생성됩니다.

```javascript
// Nexacro Studio가 자동 생성하는 핸들러 뼈대 예시
// Form 이름이 "SampleForm", 컴포넌트 이름이 "btnSearch" 일 때
function SampleForm_onload(obj, e) {
    // Form이 완전히 로드된 시점에 호출됨 — 초기 데이터 조회 등에 사용
}

function btnSearch_onclick(obj, e) {
    // 버튼 클릭 시 호출
}

function edtName_onchange(obj, e) {
    // 값 변경 완료 시 호출 (포커스를 잃을 때 확정)
}

function edtName_onkeypress(obj, e) {
    // 키를 누르는 동안 매 입력마다 호출
    // e.keycode 로 어떤 키인지 확인 가능
    if (e.keycode == 13) {
        // 엔터 키 → 검색 실행
        this.fn_search();
    }
}
```

---

## Form의 생명주기 이벤트

넥사크로의 Form은 열림부터 닫힘까지 일련의 생명주기 이벤트를 발생시킵니다.
실무에서 가장 자주 쓰는 것은 `onload`와 `onunload`입니다.

```javascript
// Form 생명주기 이벤트 활용 패턴
function Form_onload(obj, e) {
    // 화면 로드 완료 — 초기 조회, 컴포넌트 초기화
    this.fn_initCombo();   // 공통 코드 콤보 초기화
    this.fn_search();      // 최초 목록 조회
}

function Form_onactivate(obj, e) {
    // 다른 폼에서 이 폼으로 포커스가 돌아올 때마다 호출됨
    // 팝업에서 돌아온 뒤 목록을 갱신해야 할 때 사용
    trace("폼 활성화 — 팝업 반환값이 있으면 처리");
}

function Form_onunload(obj, e) {
    // 폼이 닫히기 직전 — 변경 데이터 저장 여부 확인 등
    if (this.dsMain.getDeletedRowCount() > 0 ||
        this.dsMain.rowcount > 0 && this.dsMain.getRowSaveType(0) != "") {
        var nRet = this.confirm("저장하지 않은 변경사항이 있습니다. 닫으시겠습니까?");
        if (nRet == 0) {
            // confirm의 반환값: 0=Yes, 1=No
            return; // 닫기 취소 (실제로는 e.cancel = true 로도 처리)
        }
    }
}

function Form_onerror(obj, e) {
    // 폼에서 처리되지 않은 스크립트 오류 발생 시
    trace("오류 발생: " + e.errormsg + " (line: " + e.linenum + ")");
}
```

---

## 스크립트 스코프: this · nexacro · application

넥사크로 스크립트에서 가장 중요한 개념이 바로 세 가지 스코프입니다.

![Nexacro N 스크립트 스코프 — this, nexacro, application](/assets/posts/nexacro-script-structure.svg)

### this — 현재 Form

`this`는 스크립트가 속한 Form 인스턴스를 가리킵니다.
같은 Form 안의 컴포넌트, Dataset, 함수에 접근할 때 사용합니다.

```javascript
function fn_demonstrateThis(obj, e) {
    // 같은 폼의 컴포넌트 접근
    this.edtName.set_value("홍길동");
    this.btnSave.set_enable(false);

    // 같은 폼의 Dataset 접근
    var nRowCnt = this.dsMain.rowcount;
    trace("총 " + nRowCnt + "건");

    // 같은 폼의 함수 호출
    this.fn_search();

    // 컴포넌트를 문자열 ID로 동적 접근 (eval 없이)
    var sCompId = "edtName";
    var oComp = this.components[sCompId]; // 또는 this[sCompId]
    oComp.set_value("동적 접근");
}
```

### nexacro — 프레임워크 전역 유틸리티

`nexacro`는 넥사크로 프레임워크 자체가 제공하는 전역 객체입니다.
숫자/문자열/날짜 변환, 타입 검사, JSON 변환 등 유틸리티 함수를 담고 있습니다.

```javascript
function fn_demonstrateNexacro() {
    // 숫자 변환 — 쉼표가 포함된 문자열도 숫자로 변환
    var nVal = nexacro.toNumber("1,234,567");  // → 1234567

    // 문자열 포맷 — 숫자에 천단위 쉼표 적용
    var sFormatted = nexacro.tostring(nVal, "###,###,###");  // → "1,234,567"

    // 날짜 유효성 검사
    var bValid = nexacro.isValidDate("20261301");  // → false (13월은 없음)

    // 빈 값 확인 (null, undefined, "" 모두 포함)
    var sInput = this.edtSearch.value;
    if (nexacro.isNull(sInput)) {
        this.alert("검색어를 입력하세요.");
        return;
    }

    // 문자열 trim
    var sTrimmed = nexacro.trim("  hello world  ");  // → "hello world"

    // 배열 여부 확인
    var aList = ["A", "B", "C"];
    trace(nexacro.isArray(aList));  // → true
}
```

### application — 애플리케이션 전역 공유 공간

`application`은 로그인 정보, 서버 URL, 공통 Dataset처럼 모든 폼에서 공유해야 하는 데이터를 보관하는 객체입니다.
일반적으로 `application.xadl`(Application 정의 파일)에 전역 변수와 전역 Dataset을 선언해 두고 사용합니다.

```javascript
// application.xadl 에 선언된 전역 변수/Dataset 접근 예시
function fn_demonstrateApplication() {
    // 로그인한 사용자 정보 읽기 (로그인 폼에서 설정한 값)
    var sUserId   = application.gv_userId;
    var sUserName = application.gv_userName;
    var sDeptCd   = application.gv_deptCd;
    trace("로그인 사용자: " + sUserName + " (" + sUserId + ")");

    // 전역 공통 코드 Dataset 접근
    var oGdsCode = application.gds_commonCode;
    trace("공통코드 건수: " + oGdsCode.rowcount);

    // 공통 함수 호출 (application.xadl 에 정의된 Script)
    application.fn_loading(true);  // 로딩 인디케이터 표시

    // 서버 URL 설정값 접근
    var sServerUrl = application.gv_serverUrl;
    trace("서버 URL: " + sServerUrl);
}
```

---

## 이벤트 핸들러 작성의 핵심 패턴

실무에서 반복되는 이벤트 핸들러 패턴을 정리합니다.

### 패턴 1: 검색 버튼 클릭

```javascript
// 검색 버튼 클릭 — 가장 기본적인 패턴
function btnSearch_onclick(obj, e) {
    // 1. 필수 입력값 검증
    var sStartDt = this.calStart.value;
    var sEndDt   = this.calEnd.value;

    if (nexacro.isNull(sStartDt)) {
        this.alert("시작일을 선택하세요.");
        this.calStart.setFocus();
        return;
    }
    if (nexacro.isNull(sEndDt)) {
        this.alert("종료일을 선택하세요.");
        this.calEnd.setFocus();
        return;
    }
    if (sStartDt > sEndDt) {
        this.alert("시작일은 종료일보다 클 수 없습니다.");
        return;
    }

    // 2. 기존 조회 결과 초기화
    this.dsResult.clearData();

    // 3. 트랜잭션 호출 (Transaction 편에서 자세히 다룸)
    this.fn_search();
}

function fn_search() {
    var sParam = "startDt=" + this.calStart.value;
    sParam    += "&endDt="   + this.calEnd.value;
    sParam    += "&keyword="  + nexacro.trim(this.edtKeyword.value);

    this.transaction(
        "searchList",                         // 서비스 ID
        "/service/search/list.do",            // URL
        sParam,                               // In-param
        "dsResult=dsResult",                  // Out-Dataset 매핑
        "",                                   // In-Dataset 매핑
        "fn_callbackSearch"                   // 콜백 함수명
    );
}

function fn_callbackSearch(svcid, errorcode, errormsg) {
    if (errorcode < 0) {
        this.alert("조회 중 오류가 발생했습니다.\n" + errormsg);
        return;
    }
    var nCnt = this.dsResult.rowcount;
    this.lblResultCnt.set_text("총 " + nCnt + "건");
    if (nCnt === 0) {
        this.alert("조회된 데이터가 없습니다.");
    }
}
```

### 패턴 2: 엔터키 이벤트로 검색 실행

```javascript
// Edit에서 엔터 키를 누르면 검색 버튼을 대신 클릭
function edtKeyword_onkeypress(obj, e) {
    // e.keycode: 13 = Enter
    if (e.keycode == 13) {
        this.btnSearch_onclick(this.btnSearch, e);
    }
}

// 또는 onenter 이벤트를 직접 활용 (Edit 전용)
function edtKeyword_onenter(obj, e) {
    // onenter는 Edit 컴포넌트가 엔터 키 입력 시 자동 발생
    this.fn_search();
}
```

### 패턴 3: 값 변경 연동 처리

```javascript
// 상위 ComboBox 값이 바뀌면 하위 ComboBox를 다시 로드
function cboCategory_onchange(obj, e) {
    var sCateCd = obj.value;

    // 하위 콤보 초기화
    this.cboSubCategory.set_value("");
    this.dsSubCategory.clearData();

    if (nexacro.isNull(sCateCd)) return;

    // 하위 공통 코드 조회
    this.transaction(
        "getSubCode",
        "/service/code/sub.do",
        "parentCd=" + sCateCd,
        "dsSubCategory=dsSubCategory",
        "",
        "fn_callbackSubCode"
    );
}

function fn_callbackSubCode(svcid, errorcode, errormsg) {
    if (errorcode < 0) {
        this.alert("하위코드 조회 실패: " + errormsg);
        return;
    }
    // 조회 후 첫 번째 항목 자동 선택
    if (this.dsSubCategory.rowcount > 0) {
        this.cboSubCategory.set_value(this.dsSubCategory.getColumn(0, "code"));
    }
}
```

### 패턴 4: 저장 전 유효성 검사

```javascript
// 저장 버튼 클릭 — 검증 후 저장 실행
function btnSave_onclick(obj, e) {
    // 필수 항목 검증
    if (!this.fn_validate()) {
        return;
    }

    // 저장 확인
    var nRet = this.confirm("저장하시겠습니까?");
    if (nRet !== 0) return;  // 0 = Yes, 1 = No

    this.fn_save();
}

function fn_validate() {
    // 여러 필드를 순서대로 검증, 첫 번째 오류에서 중단
    if (nexacro.isNull(this.edtTitle.value)) {
        this.alert("제목을 입력하세요.");
        this.edtTitle.setFocus();
        return false;
    }
    if (this.edtTitle.value.length > 100) {
        this.alert("제목은 100자 이내로 입력하세요.");
        this.edtTitle.setFocus();
        return false;
    }
    if (nexacro.isNull(this.cboStatus.value)) {
        this.alert("상태를 선택하세요.");
        this.cboStatus.setFocus();
        return false;
    }
    return true;
}

function fn_save() {
    this.transaction(
        "saveData",
        "/service/data/save.do",
        "",
        "",
        "dsMain=dsInput",
        "fn_callbackSave"
    );
}

function fn_callbackSave(svcid, errorcode, errormsg) {
    if (errorcode < 0) {
        this.alert("저장 실패: " + errormsg);
        return;
    }
    this.alert("저장되었습니다.");
    this.fn_search();  // 목록 갱신
}
```

---

## 동적 이벤트 바인딩

컴포넌트를 런타임에 생성하거나, 여러 컴포넌트에 동일한 핸들러를 공유하고 싶을 때 `addEventHandler`를 사용합니다.

```javascript
// 폼 로드 시 동적으로 이벤트 바인딩
function Form_onload(obj, e) {
    // 런타임에 특정 이벤트 핸들러를 추가
    this.edtName.addEventHandler("onchange", this.fn_onInputChange, this);
    this.edtAge.addEventHandler("onchange", this.fn_onInputChange, this);
    this.edtEmail.addEventHandler("onchange", this.fn_onInputChange, this);
}

// 여러 Edit가 공유하는 단일 핸들러
function fn_onInputChange(obj, e) {
    // obj.id 로 어떤 컴포넌트에서 이벤트가 발생했는지 구분
    trace(obj.id + " 값 변경: " + obj.value);

    // 변경 감지 플래그 설정 (저장 여부 확인에 사용)
    this.bModified = true;
}

// 이벤트 핸들러 제거
function fn_removeHandler() {
    this.edtName.removeEventHandler("onchange", this.fn_onInputChange, this);
}
```

---

## 자주 실수하는 패턴과 해결법

### 실수 1: `this`를 잘못 참조하는 콜백

콜백 함수의 세 번째 인자에 `this`를 넘기지 않으면 콜백 안에서 `this`가 올바른 Form을 가리키지 않을 수 있습니다.

```javascript
// 잘못된 예: addEventHandler의 세 번째 인자(scope) 누락
function Form_onload(obj, e) {
    this.edtName.addEventHandler("onchange", this.fn_onChange);
    // fn_onChange 안에서 this.dsMain 접근 시 오류 발생 가능
}

// 올바른 예: scope 인자에 this 전달
function Form_onload(obj, e) {
    this.edtName.addEventHandler("onchange", this.fn_onChange, this);
}

function fn_onChange(obj, e) {
    // this 가 Form을 올바르게 가리킴
    this.dsMain.setColumn(this.dsMain.rowposition, "name", obj.value);
}
```

### 실수 2: onchange vs onkeypress 혼동

```javascript
// onchange: 값 변경이 '확정'될 때(포커스를 잃거나 엔터 입력 후) 호출
// onkeypress: 키를 누를 때마다 실시간으로 호출
// 실시간 글자 수 카운트 같은 용도에는 onkeypress 사용
function edtContent_onkeypress(obj, e) {
    var nLen = obj.value.length;
    this.lblCharCount.set_text(nLen + " / 500");
    if (nLen > 500) {
        this.lblCharCount.set_cssclass("txt_over");
    } else {
        this.lblCharCount.set_cssclass("txt_normal");
    }
}
```

### 실수 3: Form_onload보다 먼저 실행되는 코드

Form 스크립트 영역 최상위(함수 밖)에 초기화 코드를 두면 컴포넌트가 생성되기 전에 실행되어 오류가 발생합니다.

```javascript
// 잘못된 예: 함수 밖에서 컴포넌트 접근 (컴포넌트 미생성 시점)
// this.edtName.set_value("초기값");  ← 이 코드는 오류 발생!

// 올바른 예: 반드시 onload 이후에 컴포넌트 조작
function Form_onload(obj, e) {
    this.edtName.set_value("초기값");  // onload 안에서만 안전
    this.fn_initAll();
}

function fn_initAll() {
    // 초기화 로직을 별도 함수로 분리하면 관리가 쉬움
    this.edtSearch.set_value("");
    this.dsMain.clearData();
    this.calStart.set_value(nexacro.getToday());
    this.calEnd.set_value(nexacro.getToday());
}
```

---

## 이벤트 전파와 중단

특정 상황에서 이벤트 처리를 중단해야 할 때가 있습니다.

```javascript
// onkeypress 이벤트에서 특정 키 입력을 무시하는 패턴
function edtAmount_onkeypress(obj, e) {
    var nKey = e.keycode;

    // 숫자(48~57), 백스페이스(8), 탭(9), 엔터(13), 방향키(37~40)만 허용
    var bAllowedKey = (nKey >= 48 && nKey <= 57) ||
                      nKey == 8  || nKey == 9  ||
                      nKey == 13 || (nKey >= 37 && nKey <= 40);

    if (!bAllowedKey) {
        // 이벤트 처리를 중단하여 입력 자체를 막음
        e.stopPropagation();
        return false;
    }
}

// Grid의 oncellclick에서 특정 열 클릭 시 처리
function grdList_oncellclick(obj, e) {
    // e.col: 클릭된 열 인덱스
    // e.row: 클릭된 행 인덱스
    if (e.col == 0) {
        // 첫 번째 열(체크박스 등)은 Grid가 기본 처리하도록 이벤트 통과
        return;
    }
    if (e.col == obj.getColCount() - 1) {
        // 마지막 열(삭제 버튼 등) — 행 삭제 처리
        this.fn_deleteRow(e.row);
    }
}
```

---

## 정리: 이벤트 핸들러 작성 체크리스트

| 항목 | 확인 |
|------|------|
| 핸들러 시그니처 `function FuncName(obj, e)` 형태인가? | ✓ |
| 콜백 함수에 `this` 스코프가 올바르게 전달되었는가? | ✓ |
| `onchange`와 `onkeypress` 용도를 구분해서 사용하는가? | ✓ |
| 초기화 로직이 `Form_onload` 안에 있는가? | ✓ |
| `nexacro.isNull()`로 빈 값을 안전하게 검사하는가? | ✓ |
| `this.transaction()` 콜백에서 `errorcode < 0` 체크를 하는가? | ✓ |
| 전역 데이터는 `application`에서, 폼 로컬 데이터는 `this`에서 접근하는가? | ✓ |

이벤트 핸들러는 넥사크로 개발의 뼈대입니다.
`this` · `nexacro` · `application` 세 스코프의 역할을 명확히 구분하고, 콜백 패턴과 유효성 검사 흐름을 몸에 익히면 이후 Dataset, Transaction 편의 코드가 훨씬 자연스럽게 읽힙니다.

---

**지난 글:** [[Nexacro N] 레이아웃과 스타일 완전 정복](/posts/nexacro-n-layout-and-style/)

**다음 글:** [[Nexacro N] 데이터바인딩 — Dataset과 컴포넌트를 연결하는 핵심 메커니즘](/posts/nexacro-n-databinding/)

<br>
읽어주셔서 감사합니다. 😊
