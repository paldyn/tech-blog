---
title: "[Nexacro N] Combo — 드롭다운 목록의 구조와 데이터 바인딩"
description: "Nexacro N Combo 컴포넌트의 innerdataset·codecolumn·displaycolumn 바인딩, 정적 데이터 초기화, 서버 데이터 연동, onchanged 이벤트, 드롭다운 스타일 설정, 연동 Combo 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 7
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "combo", "드롭다운", "innerdataset", "codecolumn", "displaycolumn", "onchanged"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-radio-checkbox/)에서 Radio와 CheckBox로 미리 정해진 항목을 선택하는 방법을 살펴봤습니다. 선택 항목이 많아지면 Radio 대신 **Combo** 컴포넌트가 적합합니다. Combo는 드롭다운 목록에서 항목을 선택하는 UI로, 코드/명칭 구조의 데이터를 표시하고 선택하는 데 특화되어 있습니다. Nexacro N의 Combo는 Dataset과의 바인딩 구조가 명확하게 설계되어 있어, 한번 이해하면 매우 유연하게 활용할 수 있습니다.

## Combo 컴포넌트 구조

Combo는 화면에 현재 선택 항목을 표시하는 **박스 영역**과 클릭 시 펼쳐지는 **드롭다운 목록**으로 구성됩니다. 사용자가 항목을 선택하면 드롭다운이 닫히고 선택 항목이 박스에 표시됩니다.

핵심은 **코드(code)와 명칭(name)의 분리**입니다. 사용자에게는 명칭(예: "개발팀")을 보여주지만, 내부적으로는 코드(예: "02")를 저장합니다.

## 데이터 바인딩 3요소

```javascript
// Combo 데이터 바인딩 설정
function Form_onload(obj, e) {
    // innerdataset: 목록 데이터 소스 Dataset
    this.cmbDept.set_innerdataset("dsCode");
    // codecolumn: value에 저장될 컬럼 (코드)
    this.cmbDept.set_codecolumn("DEPT_CD");
    // displaycolumn: 화면에 표시될 컬럼 (명칭)
    this.cmbDept.set_displaycolumn("DEPT_NM");
}
```

이 세 가지만 설정하면 `dsCode` Dataset의 데이터가 드롭다운 목록으로 표시됩니다. 사용자가 항목을 선택하면 `cmbDept.value`에는 `DEPT_CD` 컬럼의 값이 저장됩니다.

![Combo — 데이터 바인딩 구조](/assets/posts/nexacro-n-combo-binding.svg)

## 정적 데이터 초기화

항상 고정된 코드 목록(성별, 사용 여부 등)은 Dataset에 하드코딩합니다.

```javascript
// Dataset에 직접 데이터 추가
function fn_initGenderCombo() {
    var ds = this.dsGender;
    ds.clearData();
    // 전체 선택 항목 추가 (공백 코드)
    ds.addRow();
    ds.setColumn(0, "CD", "");
    ds.setColumn(0, "NM", "-- 선택 --");
    // 실제 코드 항목
    ds.addRow();
    ds.setColumn(1, "CD", "M");
    ds.setColumn(1, "NM", "남성");
    ds.addRow();
    ds.setColumn(2, "CD", "F");
    ds.setColumn(2, "NM", "여성");
    // 바인딩
    this.cmbGender.set_innerdataset("dsGender");
    this.cmbGender.set_codecolumn("CD");
    this.cmbGender.set_displaycolumn("NM");
}
```

"-- 선택 --" 같은 기본 선택 항목을 첫 행에 추가하면 사용자가 필수 입력 여부를 쉽게 알 수 있습니다.

## 서버에서 공통 코드 로딩

실무에서는 공통 코드를 서버에서 가져와 Combo에 바인딩합니다.

```javascript
// 공통 코드 조회 트랜잭션
function fn_loadCodeCombo(sSvcCd) {
    var sUrl = "svc/common/getCodeList.do";
    var sInput = "dsParam:dsParam";
    var sOutput = "dsCode:dsCode";

    // 조회 조건 Dataset에 서비스 코드 입력
    this.dsParam.clearData();
    this.dsParam.addRow();
    this.dsParam.setColumn(0, "SVC_CD", sSvcCd);

    this.transaction(
        "fnLoadCode",
        sUrl,
        sInput,
        sOutput,
        "",
        "fn_loadCodeCombo_cb"
    );
}

// 콜백
function fn_loadCodeCombo_cb(sSvcId, nErrorCode, sErrorMsg) {
    if (nErrorCode < 0) {
        alert("코드 조회 실패: " + sErrorMsg);
        return;
    }
    this.cmbDept.set_innerdataset("dsCode");
    this.cmbDept.set_codecolumn("DEPT_CD");
    this.cmbDept.set_displaycolumn("DEPT_NM");
}
```

## onchanged 이벤트

Combo에서 선택이 바뀔 때 `onchanged`가 발생합니다.

```javascript
function cmbDept_onchanged(obj, e) {
    var sDeptCd = obj.value;       // 선택된 코드
    var sDeptNm = obj.displayvalue; // 화면 표시 명칭
    trace("선택: " + sDeptCd + " / " + sDeptNm);
    // 부서 선택 시 담당자 목록 리로드
    this.fn_loadManagerList(sDeptCd);
}
```

`obj.value`는 코드, `obj.displayvalue`는 현재 표시 중인 명칭을 반환합니다.

![Combo — 데이터 초기화 패턴](/assets/posts/nexacro-n-combo-code.svg)

## 연동 Combo 패턴 (Cascading)

첫 번째 Combo 선택에 따라 두 번째 Combo 목록이 바뀌는 패턴입니다.

```javascript
// 시도 Combo 변경 → 시군구 Combo 갱신
function cmbSido_onchanged(obj, e) {
    var sSidoCd = obj.value;
    if (!sSidoCd) {
        this.dsGungu.clearData();
        return;
    }
    // 시군구 데이터 서버 조회
    this.fn_loadGungu(sSidoCd);
}

function fn_loadGungu(sSidoCd) {
    this.dsGunguParam.clearData();
    this.dsGunguParam.addRow();
    this.dsGunguParam.setColumn(0, "SIDO_CD", sSidoCd);
    this.transaction(
        "fnLoadGungu",
        "svc/common/getGungu.do",
        "dsGunguParam:dsGunguParam",
        "dsGungu:dsGungu",
        "",
        "fn_loadGungu_cb"
    );
}

function fn_loadGungu_cb(sSvcId, nErrorCode, sErrorMsg) {
    if (nErrorCode < 0) return;
    this.cmbGungu.set_innerdataset("dsGungu");
    this.cmbGungu.set_codecolumn("GUNGU_CD");
    this.cmbGungu.set_displaycolumn("GUNGU_NM");
    this.cmbGungu.set_value(""); // 첫 번째 항목으로 초기화
}
```

## 드롭다운 스타일 설정

드롭다운 높이, 항목 간격, 폰트 크기 등은 `dropdowncount`, `itemheight` 속성으로 조절합니다.

```javascript
// 최대 표시 항목 수 (기본 5~7)
this.cmbDept.set_dropdowncount(8);

// 항목 높이 (픽셀)
this.cmbDept.set_itemheight(24);
```

## Combo 초기화 (선택 해제)

현재 선택을 해제하려면 `set_value("")`를 사용합니다.

```javascript
// Combo 선택 초기화
function fn_clearCombos() {
    this.cmbDept.set_value("");
    this.cmbGender.set_value("");
}
```

빈 문자열을 설정하면 "-- 선택 --" 항목(코드가 빈 문자열인 첫 번째 항목)이 선택됩니다. 첫 번째 항목이 빈 코드가 아니면 드롭다운이 아무것도 선택되지 않은 상태가 됩니다.

## Combo와 Edit 차이점

| 항목 | Combo | Edit |
|------|-------|------|
| 입력 방식 | 목록에서 선택 | 직접 타이핑 |
| 자유 입력 | 기본 불가 | 가능 |
| 코드/명칭 분리 | 내장 지원 | 별도 처리 필요 |
| 목록 표시 | 드롭다운 | 없음 |
| 데이터 오류 위험 | 낮음 (목록 내에서만) | 높음 |

항목이 고정된 경우, 특히 코드/명칭 구조의 데이터는 항상 Combo를 선택하는 것이 안전합니다.

---

**지난 글:** [Radio / CheckBox — 선택 컴포넌트 활용 가이드](/posts/nexacro-n-radio-checkbox/)

**다음 글:** [Select / MultiSelect — 리스트 박스 선택 컴포넌트](/posts/nexacro-n-select-multiselect/)

<br>
읽어주셔서 감사합니다. 😊
