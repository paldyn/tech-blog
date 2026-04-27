---
title: "[Nexacro N] 주요 컴포넌트 한눈에 파악하기"
description: "Nexacro N에서 자주 쓰는 컴포넌트(Edit, MaskEdit, ComboBox, CheckBox, Radio, Grid, Calendar 등)의 속성·메서드·이벤트를 실무 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-22"
archiveOrder: 10
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "components", "edit", "grid", "combobox", "calendar"]
featured: false
draft: false
---

이 글은 **Nexacro N 기준으로 작성되었습니다.**
넥사크로 개발을 막 시작한 분들이 가장 먼저 마주치는 질문은 대부분 이렇습니다.
*"이 컴포넌트의 값은 어떻게 읽지?", "버튼 클릭 이벤트는 어디에 쓰지?", "콤보박스 코드와 표시명을 어떻게 구분하지?"*

이번 글에서는 넥사크로 N의 컴포넌트 구조 원리부터, 실무에서 가장 많이 쓰는 컴포넌트별 속성·메서드·이벤트를 코드 위주로 정리합니다.

---

## 컴포넌트의 세 가지 구성 요소

넥사크로 N의 모든 컴포넌트는 **속성(Property) · 메서드(Method) · 이벤트(Event)** 세 요소로 이루어집니다.

![Nexacro N 컴포넌트 구성 요소](/assets/posts/nexacro-component-anatomy.svg)

- **속성(Property)**: 컴포넌트의 현재 상태를 나타냅니다. `obj.value`처럼 읽거나, `obj.set_value("abc")`처럼 씁니다.
- **메서드(Method)**: 컴포넌트에게 특정 동작을 지시합니다. `obj.setFocus()`, `obj.set_visible(false)` 등.
- **이벤트(Event)**: 사용자 행동이나 시스템 이벤트에 반응하는 핸들러를 등록합니다. `onclick`, `onchange`, `onfocus` 등.

속성을 읽을 때는 `obj.속성명`, 쓸 때는 반드시 `obj.set_속성명(값)` 메서드를 사용해야 넥사크로 런타임이 변경을 감지합니다.
직접 `obj.visible = false` 처럼 대입하면 동작하지 않는 경우가 있으니 주의하세요.

---

## 컴포넌트 전체 분류

![Nexacro N 컴포넌트 분류 맵](/assets/posts/nexacro-components-map.svg)

실무에서 가장 자주 등장하는 컴포넌트는 크게 네 범주입니다.

| 범주 | 대표 컴포넌트 |
|------|-------------|
| 입력 | Edit, MaskEdit, ComboBox, CheckBox, Radio, Calendar, TextArea |
| 표시 | Static, Image, HtmlView, ProgressBar |
| 데이터 | Grid, TreeView |
| 컨테이너/제어 | Div, Tab, Button, Splitter |

---

## Edit — 기본 텍스트 입력

`Edit`는 가장 기본적인 단일행 텍스트 입력 컴포넌트입니다.

```javascript
// 값 읽기 / 설정
function fn_editBasic(obj, e) {
    var sVal = this.edt_name.value;  // 현재 입력 값 읽기
    trace("입력값: " + sVal);

    this.edt_name.set_value("홍길동");  // 값 설정
    this.edt_name.set_readonly(true);   // 읽기 전용 전환
    this.edt_name.set_enable(false);    // 비활성화
}

// 포커스 이동 및 값 초기화
function fn_clearAndFocus(obj, e) {
    this.edt_name.set_value("");   // 값 비우기
    this.edt_name.setFocus();      // 포커스 이동
}

// onchange 이벤트: 값이 바뀔 때마다 호출
function edt_keyword_onchange(obj, e) {
    // 실시간 검색 트리거 예시
    var sKeyword = obj.value;
    if (sKeyword.length >= 2) {
        fn_search.call(this, sKeyword);
    }
}

// onkillfocus 이벤트: 포커스 잃을 때 유효성 검사
function edt_email_onkillfocus(obj, e) {
    var sEmail = obj.value;
    var reEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (sEmail !== "" && !reEmail.test(sEmail)) {
        alert("올바른 이메일 형식이 아닙니다.");
        obj.setFocus();
        obj.set_cssclass("error");
    } else {
        obj.set_cssclass("");
    }
}
```

---

## MaskEdit — 포맷 입력 (날짜·금액·전화번호)

`MaskEdit`는 입력 포맷을 `mask` 속성으로 지정하면 자동 포맷팅과 유효성 검사를 지원합니다.

```javascript
// MaskEdit 주요 속성: mask, edittype, value, text

// 금액 입력 (###,###,##0 원 포맷)
// Studio에서 mask="###,###,##0" 설정 후 스크립트로 접근
function fn_maskEditAmount(obj, e) {
    // value: 포맷 제거된 순수 숫자 문자열
    var nAmount = Number(this.medt_amount.value);   // "1000000" → 1000000

    // text: 화면에 표시되는 포맷 문자열
    var sDisplay = this.medt_amount.text;            // "1,000,000"

    trace("금액(숫자): " + nAmount + " / 표시: " + sDisplay);
}

// 날짜 입력 (mask="####-##-##")
function fn_maskEditDate(obj, e) {
    var sDate = this.medt_date.value;   // "20260422" (포맷 제거)
    var sText = this.medt_date.text;    // "2026-04-22" (표시)

    trace("날짜 value: " + sDate + " / text: " + sText);
}

// 전화번호 입력 (mask="###-####-####")
function fn_maskEditPhone(obj, e) {
    var sPhone = this.medt_phone.text;   // "010-1234-5678"
    trace("전화번호: " + sPhone);
}

// 현재 날짜로 자동 입력
function fn_setTodayDate(obj, e) {
    var oDate = new Date();
    var sYear  = String(oDate.getFullYear());
    var sMon   = String(oDate.getMonth() + 1).padStart(2, "0");
    var sDay   = String(oDate.getDate()).padStart(2, "0");

    // mask="####-##-##" MaskEdit에 "2026-04-22" 형태로 입력
    this.medt_date.set_value(sYear + sMon + sDay);
}
```

---

## ComboBox — 드롭다운 선택

`ComboBox`는 코드(value)와 표시명(text)이 분리된 점이 핵심입니다.
보통 Dataset을 바인딩하거나 스크립트로 코드 목록을 채웁니다.

```javascript
// ComboBox 값 읽기
function fn_comboRead(obj, e) {
    // value: 실제 코드값 (예: "M", "F")
    var sCode = this.cmb_gender.value;

    // text: 화면 표시 텍스트 (예: "남성", "여성")
    var sText = this.cmb_gender.text;

    trace("선택 코드: " + sCode + " / 표시명: " + sText);
}

// 스크립트로 코드 목록 동적 구성
function fn_buildCombo(obj, e) {
    // Dataset으로 ComboBox 아이템 채우기
    var oDsCode = this.ds_gender;
    oDsCode.clearData();

    oDsCode.addRow();
    oDsCode.setColumn(0, "cd", "M");
    oDsCode.setColumn(0, "nm", "남성");

    oDsCode.addRow();
    oDsCode.setColumn(1, "cd", "F");
    oDsCode.setColumn(1, "nm", "여성");

    // ComboBox에 Dataset 바인딩
    this.cmb_gender.set_codecolumn("cd");    // 코드 컬럼 지정
    this.cmb_gender.set_datacolumn("nm");    // 표시명 컬럼 지정
    this.cmb_gender.set_dataset("ds_gender");
}

// 특정 코드로 선택 상태 지정
function fn_setComboValue(obj, e) {
    this.cmb_gender.set_value("F");  // "여성" 항목이 자동 선택됨
}

// onchange 이벤트: 선택 변경 시 연관 화면 갱신
function cmb_dept_onchange(obj, e) {
    var sDeptCd = obj.value;

    if (sDeptCd !== "") {
        // 부서 선택 시 해당 부서 직원 목록 조회
        fn_loadEmployees.call(this, sDeptCd);
    }
}
```

---

## CheckBox / Radio — 다중·단일 선택

```javascript
// CheckBox: 체크 여부는 value로 확인 ("true" / "false")
function fn_checkboxRead(obj, e) {
    // value는 문자열 "true" 또는 "false"를 반환함
    var bChecked = (this.chk_agree.value === "true");

    if (bChecked) {
        trace("동의함");
    } else {
        trace("비동의");
    }
}

// CheckBox 체크/해제
function fn_checkboxSet(obj, e) {
    this.chk_agree.set_value("true");   // 체크 상태로 변경
    this.chk_all.set_value("false");    // 체크 해제
}

// CheckBox onchange 이벤트
function chk_all_onchange(obj, e) {
    // 전체 선택 체크박스 변경 시 하위 체크박스 일괄 설정
    var sVal = obj.value;  // "true" 또는 "false"

    this.chk_item1.set_value(sVal);
    this.chk_item2.set_value(sVal);
    this.chk_item3.set_value(sVal);
}

// Radio: 같은 RadioGroup 내에서 하나만 선택
// Studio에서 Radio 컴포넌트의 radiogroup 속성을 동일하게 맞춰야 함
function fn_radioRead(obj, e) {
    // 선택된 Radio의 value를 직접 읽음
    var sSex = this.rdo_male.value;  // "M" or "" (선택 안됨)

    // RadioGroup으로 묶인 경우 선택된 값을 RadioGroup에서 읽는 방법 없음
    // 각 Radio의 checked 상태로 판별해야 함
    if (this.rdo_male.value === "M" && this.rdo_male.checked) {
        trace("남성 선택");
    } else if (this.rdo_female.value === "F" && this.rdo_female.checked) {
        trace("여성 선택");
    }
}

// Radio 선택 상태 설정
function fn_radioSet(obj, e) {
    this.rdo_male.set_checked(false);
    this.rdo_female.set_checked(true);
}
```

---

## Calendar — 날짜 선택

`Calendar` 컴포넌트는 달력 UI를 제공하며, `value` 속성으로 선택된 날짜를 읽습니다.

```javascript
// Calendar 기본 사용
function fn_calendarBasic(obj, e) {
    // value: 선택된 날짜를 "YYYYMMDD" 형식 문자열로 반환
    var sDate = this.cal_start.value;   // 예: "20260422"

    // 날짜 파싱
    var sYear = sDate.substring(0, 4);
    var sMon  = sDate.substring(4, 6);
    var sDay  = sDate.substring(6, 8);
    trace("선택 날짜: " + sYear + "년 " + sMon + "월 " + sDay + "일");
}

// 오늘 날짜로 초기화 (Form_onload에서 자주 사용)
function fn_initCalendar(obj, e) {
    var oNow = new Date();
    var sToday = nexacro.getFormatDate(oNow, "yyyyMMdd");

    this.cal_start.set_value(sToday);

    // 종료일: 오늘 + 30일
    var oEnd = new Date(oNow.getTime() + 30 * 24 * 60 * 60 * 1000);
    var sEnd = nexacro.getFormatDate(oEnd, "yyyyMMdd");
    this.cal_end.set_value(sEnd);
}

// onchange 이벤트: 날짜 선택 시 유효성 검사
function cal_end_onchange(obj, e) {
    var sStart = this.cal_start.value;
    var sEnd   = obj.value;

    // 종료일이 시작일보다 이전이면 경고
    if (sEnd < sStart) {
        alert("종료일은 시작일 이후여야 합니다.");
        obj.set_value(sStart);  // 시작일로 되돌림
    }
}

// Calendar 날짜 범위 제한 (mindate / maxdate)
function fn_setCalendarRange(obj, e) {
    var sToday = nexacro.getFormatDate(new Date(), "yyyyMMdd");

    // 오늘 이전 날짜는 선택 불가
    this.cal_start.set_mindate(sToday);

    // 1년 후까지만 선택 가능
    var oMax = new Date();
    oMax.setFullYear(oMax.getFullYear() + 1);
    this.cal_start.set_maxdate(nexacro.getFormatDate(oMax, "yyyyMMdd"));
}
```

---

## Static — 레이블과 읽기 전용 텍스트

`Static`은 텍스트 출력에 사용하는 가장 단순한 컴포넌트입니다.

```javascript
// Static 텍스트 설정
function fn_staticBasic(obj, e) {
    // text 속성으로 표시할 내용을 지정
    this.stt_title.set_text("조회 결과");

    // 숫자 포맷팅해서 표시
    var nCount = 1523;
    this.stt_count.set_text("총 " + nCount.toLocaleString() + "건");
}

// 조회 결과 건수를 강조해서 표시
function fn_showResultCount(nCount) {
    if (nCount === 0) {
        this.stt_count.set_text("조회 결과가 없습니다.");
        this.stt_count.set_cssclass("no_result");
    } else {
        this.stt_count.set_text("총 " + nCount + "건");
        this.stt_count.set_cssclass("result_ok");
    }
}
```

---

## Button — 클릭 액션

```javascript
// 기본 버튼 이벤트 처리 패턴
function btn_search_onclick(obj, e) {
    // 1. 입력값 수집
    var sName   = this.edt_name.value;
    var sDeptCd = this.cmb_dept.value;

    // 2. 필수 입력 체크
    if (sName === "" && sDeptCd === "") {
        alert("이름 또는 부서를 입력하세요.");
        this.edt_name.setFocus();
        return;
    }

    // 3. 조회 실행
    fn_transaction.call(this, sName, sDeptCd);
}

// 저장 버튼: 중복 클릭 방지 패턴
function btn_save_onclick(obj, e) {
    // 저장 중 버튼 비활성화 → 완료 후 활성화
    obj.set_enable(false);
    obj.set_text("저장 중...");

    // 트랜잭션 콜백에서 다시 활성화
    fn_saveTransaction.call(this, function() {
        obj.set_enable(true);
        obj.set_text("저장");
    });
}

// ImageButton: 아이콘만 있는 버튼
function btn_refresh_onclick(obj, e) {
    fn_search.call(this);
}
```

---

## Grid — 가장 강력한 데이터 컴포넌트

Grid는 이후 별도 포스트에서 상세히 다루지만, 자주 쓰는 기초 패턴은 미리 알아두면 좋습니다.

```javascript
// Grid 선택 행의 특정 컬럼 값 읽기
function grd_list_oncellclick(obj, e) {
    // e.row: 클릭된 행 인덱스 (0부터 시작)
    // e.col: 클릭된 열 인덱스
    var nRow = e.row;

    // Grid에 바인딩된 Dataset에서 직접 값 읽기
    var sUserId = this.ds_user.getColumn(nRow, "user_id");
    var sName   = this.ds_user.getColumn(nRow, "user_nm");

    trace("선택: " + sUserId + " / " + sName);

    // 상세 조회 폼으로 값 전달
    this.edt_detail_id.set_value(sUserId);
    this.edt_detail_nm.set_value(sName);
}

// Grid 현재 선택 행 인덱스 가져오기
function fn_getSelectedRow(obj, e) {
    var nCurRow = this.grd_list.currentrow;  // 현재 선택 행 인덱스
    if (nCurRow < 0) {
        alert("항목을 선택해 주세요.");
        return -1;
    }
    return nCurRow;
}

// Grid 전체 행 순회
function fn_iterateGrid(obj, e) {
    var oDs   = this.ds_user;
    var nRows = oDs.rowcount;

    for (var i = 0; i < nRows; i++) {
        var sId   = oDs.getColumn(i, "user_id");
        var sName = oDs.getColumn(i, "user_nm");
        trace("[" + i + "] " + sId + " - " + sName);
    }
}
```

---

## 공통 패턴: Form_onload에서 초기화

```javascript
// 대부분의 Form은 이런 구조로 시작합니다
function Form_onload(obj, e) {
    // 1. 컴포넌트 초기 상태 설정
    fn_initComponents.call(this);

    // 2. 코드 콤보박스 목록 로드
    fn_loadCodes.call(this);

    // 3. 초기 데이터 조회 (필요 시)
    fn_search.call(this);
}

function fn_initComponents() {
    // 오늘 날짜를 Calendar에 기본값으로 설정
    var sToday = nexacro.getFormatDate(new Date(), "yyyyMMdd");
    this.cal_start.set_value(sToday);
    this.cal_end.set_value(sToday);

    // 첫 번째 포커스 위치 지정
    this.edt_name.setFocus();

    // 저장/삭제 버튼은 항목 선택 전까지 비활성화
    this.btn_save.set_enable(false);
    this.btn_delete.set_enable(false);
}

function fn_loadCodes() {
    // 공통 코드 ComboBox를 서버에서 조회 (트랜잭션 방식)
    // 자세한 내용은 Dataset·Transaction 편에서 다룸
}
```

---

## 정리

| 컴포넌트 | 핵심 속성/메서드 | 주요 이벤트 |
|----------|----------------|------------|
| Edit | `value`, `set_value()`, `set_readonly()` | `onchange`, `onkillfocus`, `onenter` |
| MaskEdit | `value`(순수값), `text`(포맷값) | `onchange`, `onkillfocus` |
| ComboBox | `value`(코드), `text`(표시명) | `onchange` |
| CheckBox | `value`("true"/"false"), `set_checked()` | `onchange` |
| Radio | `checked`, `set_checked()` | `onchange` |
| Calendar | `value`(YYYYMMDD), `set_mindate()` | `onchange` |
| Static | `set_text()`, `set_cssclass()` | — |
| Button | `set_enable()`, `set_text()` | `onclick` |
| Grid | `currentrow`, `oncellclick` | `oncellclick`, `oncelldbclick` |

컴포넌트마다 고유 속성과 이벤트가 있지만, **값을 읽으려면 `.value`, 쓰려면 `set_value()`**라는 원칙은 거의 모든 컴포넌트에서 동일하게 적용됩니다.
이 원칙 하나만 기억해도 낯선 컴포넌트를 만났을 때 빠르게 적응할 수 있습니다.

---

**지난 글:** [화면 기본 단위 이해하기: Application · Frame · Form](/posts/nexacro-application-frame-form/)

**다음 글:** [[Nexacro N] Dataset — 화면 데이터의 핵심 저장소](/posts/nexacro-n-dataset/)

<br>
읽어주셔서 감사합니다. 😊
