---
title: "[Nexacro N] 데이터바인딩 — Dataset과 컴포넌트를 연결하는 핵심 메커니즘"
description: "Nexacro N의 데이터바인딩 원리를 이해하고, 단방향·양방향 바인딩, Master-Detail 패턴, 멀티바인딩까지 실전 예시로 완전 정복합니다."
author: "PALDYN Team"
pubDate: "2026-04-25"
archiveOrder: 6
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "databinding", "dataset"]
featured: false
draft: false
---

이 글은 **Nexacro N** 기준으로 작성되었습니다.

Nexacro N 개발에서 데이터바인딩(Data Binding)은 거의 모든 UI 구성의 토대입니다. Dataset에 데이터를 채우면 바인딩된 컴포넌트가 자동으로 갱신되고, 사용자가 컴포넌트를 수정하면 Dataset에 즉시 반영됩니다. 이 양방향 동기화 덕분에 "Grid에서 선택한 행을 Edit에 표시"하는 패턴 같은 복잡한 UI 흐름을 단 몇 줄의 속성 설정으로 완성할 수 있습니다.

이 글에서는 데이터바인딩의 작동 원리부터 단방향·양방향 바인딩, Master-Detail 패턴, 멀티바인딩, 그리고 주의해야 할 함정까지 체계적으로 살펴봅니다.

---

## 데이터바인딩의 기본 원리

Nexacro N의 데이터바인딩은 **Dataset ↔ 컴포넌트** 사이의 자동 동기화 구조입니다. Dataset이 데이터 저장소 역할을 하고, 컴포넌트는 Dataset의 특정 컬럼을 "구독(subscribe)"하는 방식입니다.

![Nexacro N 데이터바인딩 흐름](/assets/posts/nexacro-databinding-flow.svg)

핵심은 **rowposition(현재 행 포인터)**입니다. Dataset의 rowposition이 바뀌면 해당 행의 데이터가 바인딩된 모든 컴포넌트에 자동 전파됩니다. Grid는 전체 행을 렌더링하고, Edit/Combo 같은 단일 컴포넌트는 rowposition이 가리키는 행의 값을 표시합니다.

### 바인딩 설정 방식

바인딩 설정은 **폼 디자이너(속성 창)** 또는 **스크립트** 두 가지 방식으로 합니다.

**디자이너에서 설정**
- 컴포넌트 선택 → Properties 패널 → `datasource` 속성에 Dataset ID 입력 → `datacolumn` 속성에 컬럼명 입력

**스크립트에서 설정**

```javascript
// Edit 컴포넌트를 Dataset의 USER_NM 컬럼에 바인딩
function fn_bindEdit(obj, e) {
    // datasource: 바인딩할 Dataset의 ID
    this.edtUserName.set_datasource("dsUser");
    // datacolumn: Dataset 내 컬럼명
    this.edtUserName.set_datacolumn("USER_NM");
}

// Combo 컴포넌트 바인딩 (코드 Dataset 함께 설정)
function fn_bindCombo(obj, e) {
    this.cmbDept.set_datasource("dsUser");
    this.cmbDept.set_datacolumn("DEPT_CD");
    // Combo의 선택 목록은 별도 Dataset으로 설정
    this.cmbDept.set_codecolumn("DEPT_CD");
    this.cmbDept.set_datacodedataset("dsDeptCode");
    this.cmbDept.set_displaycolumn("DEPT_NM");
}
```

---

## Grid 바인딩 — 가장 흔한 패턴

Grid 컴포넌트는 Dataset의 모든 행을 한 번에 표시합니다. Grid의 `datasource` 속성에 Dataset ID를 지정하고, 각 컬럼의 `displaytype`과 `datacolumn`을 설정합니다.

```javascript
// Grid와 Dataset 바인딩 (스크립트)
function fn_bindGrid(obj, e) {
    // Grid 전체를 Dataset과 연결
    this.grdUser.set_datasource("dsUser");

    // Grid 내 특정 컬럼의 datacolumn 변경 (런타임 동적 변경 예시)
    // Grid 컬럼 인덱스로 접근: getColumn(index)
    var oColumn = this.grdUser.getColumn(0);
    oColumn.set_datacolumn("USER_ID");
}

// Grid에서 행 클릭 시 rowposition 이동
function grdUser_onclick(obj, e) {
    // e.row: 클릭된 행 인덱스
    // Grid의 currentrow가 바뀌면 dsUser의 rowposition도 자동 동기화
    var nRow = e.row;
    trace("선택된 행: " + nRow + ", USER_NM: " + this.dsUser.getColumn(nRow, "USER_NM"));
}
```

Grid의 행을 클릭하면 `dsUser.rowposition`이 자동으로 해당 행으로 이동합니다. 이 Dataset에 바인딩된 다른 컴포넌트(Edit, Label 등)는 즉시 그 행의 데이터를 표시합니다.

---

## Master-Detail 바인딩 패턴

업무 화면에서 가장 많이 쓰이는 패턴입니다. 상단 Grid(마스터)에서 행을 선택하면 하단 영역(디테일)에 관련 데이터가 채워집니다.

![Nexacro N Master-Detail 바인딩 패턴](/assets/posts/nexacro-databinding-master-detail.svg)

```javascript
// Master Grid의 행 변경 이벤트
function grdDept_onrowposchanged(obj, e) {
    // 마스터 Dataset의 현재 행에서 키 값 추출
    var sDeptCd = this.dsDept.getColumn(e.newrow, "DEPT_CD");

    // Detail Dataset 초기화 후 서버에서 데이터 조회
    this.dsEmp.clearData();

    // 파라미터 Dataset에 검색 조건 설정
    this.dsEmpParam.clearData();
    this.dsEmpParam.addRow();
    this.dsEmpParam.setColumn(0, "DEPT_CD", sDeptCd);

    // Transaction으로 Detail 데이터 조회
    this.transaction(
        "svcGetEmpList",
        "EMP/getList.do",
        "in:dsEmpParam",
        "out:dsEmp",
        "",
        "fn_getEmpCallback"
    );
}

function fn_getEmpCallback(svcid, errorCode, errorMsg) {
    if (errorCode != 0) {
        // 오류 처리
        this.alert("데이터 조회 실패: " + errorMsg);
        return;
    }
    // dsEmp에 데이터가 채워지면 grdEmp는 자동 갱신됨
    // 추가 UI 처리가 필요한 경우에만 여기서 작업
    if (this.dsEmp.rowcount == 0) {
        this.lblEmpEmpty.set_visible(true);
    } else {
        this.lblEmpEmpty.set_visible(false);
    }
}
```

---

## 양방향 바인딩과 단방향 바인딩

Nexacro N의 기본 바인딩은 **양방향(Two-way)**입니다. 컴포넌트에서 값을 수정하면 Dataset의 해당 셀이 즉시 변경됩니다.

```javascript
// 양방향 바인딩 동작 확인
function edtUserName_onchanged(obj, e) {
    // 사용자가 Edit에 값을 입력하는 순간 dsUser의 USER_NM 컬럼도 변경됨
    // 별도 코드 없이 자동으로 Dataset에 반영됨
    var sNewVal = this.dsUser.getColumn(this.dsUser.rowposition, "USER_NM");
    trace("Dataset 자동 갱신: " + sNewVal); // Edit에 입력한 값과 동일
}

// 단방향 바인딩이 필요할 때 — 컴포넌트를 readonly로 설정
function fn_setReadOnly(obj, e) {
    // 조회 전용 필드는 edit 속성을 false로 설정
    this.edtUserName.set_enable(false);
    // 또는 readonly 속성 활용
    this.edtUserName.set_readonly(true);
}
```

**주의:** 양방향 바인딩 중 Dataset의 rowstatus가 `U`(수정)로 변경됩니다. 의도치 않은 수정을 막으려면 컴포넌트를 `readonly` 또는 `enable=false`로 설정해야 합니다.

---

## Dataset 조작과 바인딩 연동

Dataset의 행 추가·삭제는 바인딩된 컴포넌트에 즉각 반영됩니다.

```javascript
// 신규 행 추가 — 바인딩된 Grid에 즉시 표시됨
function btn_addRow_onclick(obj, e) {
    var nRow = this.dsUser.addRow();

    // 기본값 설정
    this.dsUser.setColumn(nRow, "USE_YN", "Y");
    this.dsUser.setColumn(nRow, "REG_DT", gv_today); // 전역 변수 활용

    // Grid의 rowposition을 새 행으로 이동 (포커스 이동)
    this.grdUser.set_rowposition(nRow);

    // 신규 행의 첫 번째 Edit에 포커스
    this.edtUserId.setFocus();
}

// 현재 행 삭제
function btn_deleteRow_onclick(obj, e) {
    var nRow = this.dsUser.rowposition;
    if (nRow < 0) {
        this.alert("삭제할 행을 선택하세요.");
        return;
    }

    // Dataset에서 행 삭제 — deleteRow는 rowstatus를 D로 마킹
    // 서버에 전송 후 실제 삭제
    this.dsUser.deleteRow(nRow);
    // removeRow는 Dataset에서 즉시 제거 (서버 전송 대상에서도 제외)
    // this.dsUser.removeRow(nRow);
}

// Dataset 초기화
function fn_clearDataset(obj, e) {
    // clearData: 데이터만 지움 (컬럼 구조 유지)
    this.dsUser.clearData();
    // Dataset을 초기화하면 바인딩된 Grid는 빈 상태로 표시됨
}
```

---

## 멀티바인딩 — 하나의 컴포넌트에서 여러 컬럼 활용

일부 컴포넌트는 여러 컬럼을 동시에 참조합니다. 대표적으로 `MaskEdit`과 `TextArea`의 `linkedcontrol` 패턴, 그리고 Grid 컬럼의 복합 표현식입니다.

```javascript
// Grid 컬럼에서 여러 Dataset 컬럼을 합쳐 표시 (Expression 활용)
// Grid 컬럼의 displaytype을 "text"로 설정하고 expression 사용
// 예: "USER_NM + ' (' + DEPT_NM + ')'" 형태로 표시

// 스크립트에서 Dataset 값을 조합하여 Label에 표시
function fn_updateLabel(obj, e) {
    var nRow = this.dsUser.rowposition;
    if (nRow < 0) return;

    var sUserNm  = this.dsUser.getColumn(nRow, "USER_NM");
    var sDeptNm  = this.dsUser.getColumn(nRow, "DEPT_NM");
    var sGradeNm = this.dsUser.getColumn(nRow, "GRADE_NM");

    // Label은 바인딩 대신 스크립트로 조합 표시
    this.lblUserInfo.set_text(sUserNm + " / " + sDeptNm + " (" + sGradeNm + ")");
}

// dsUser의 rowposition 변경 이벤트에서 호출
function dsUser_onrowposchanged(obj, e) {
    fn_updateLabel();
}
```

---

## Dataset 이벤트로 바인딩 후처리

Dataset에는 데이터 변경을 감지하는 이벤트가 있어 바인딩과 조합하면 강력한 반응형 UI를 만들 수 있습니다.

```javascript
// Dataset 행 위치 변경 이벤트
function dsUser_onrowposchanged(obj, e) {
    // e.oldrow: 이전 행 인덱스
    // e.newrow: 새 행 인덱스
    var nNew = e.newrow;

    // 권한에 따른 필드 활성화 제어
    var sRole = this.dsUser.getColumn(nNew, "ROLE_CD");
    this.edtAdminMemo.set_enable(sRole == "ADMIN");

    trace("행 이동: " + e.oldrow + " → " + nNew);
}

// Dataset 컬럼 값 변경 이벤트
function dsUser_oncolumnchanged(obj, e) {
    // e.columnid: 변경된 컬럼명
    // e.oldvalue: 이전 값
    // e.newvalue: 새 값
    if (e.columnid == "DEPT_CD") {
        // 부서 변경 시 직급 코드 Dataset 갱신
        fn_loadGradeCode(e.newvalue);
    }
}

// Dataset에 데이터 로드 완료 후 처리
function dsUser_onload(obj, e) {
    // 첫 번째 행으로 이동
    if (this.dsUser.rowcount > 0) {
        this.dsUser.set_rowposition(0);
    }
}
```

---

## 동적 바인딩 변경

런타임에 바인딩 대상을 교체해야 할 때가 있습니다. 예를 들어 탭에 따라 Grid가 다른 Dataset을 참조하는 경우입니다.

```javascript
// 탭 변경 시 Grid의 Dataset 동적 교체
function tabMain_ontabchanged(obj, e) {
    var nTabIdx = e.tabindex;

    switch (nTabIdx) {
        case 0:
            // 탭 0: 내부 직원 Dataset
            this.grdUser.set_datasource("dsEmpInternal");
            break;
        case 1:
            // 탭 1: 외부 직원 Dataset
            this.grdUser.set_datasource("dsEmpExternal");
            break;
        default:
            break;
    }

    // Dataset이 비어있으면 서버에서 조회
    var oDs = this.getObject(this.grdUser.datasource);
    if (oDs && oDs.rowcount == 0) {
        fn_loadData(nTabIdx);
    }
}

// 바인딩 해제 (특정 조건에서 컴포넌트를 Dataset과 분리)
function fn_unbindComponent(obj, e) {
    // datasource를 빈 문자열로 설정하면 바인딩 해제
    this.edtUserName.set_datasource("");
    this.edtUserName.set_value("바인딩 해제 상태");
}
```

---

## 바인딩 사용 시 주의사항

**1. rowposition이 -1이면 바인딩 컴포넌트는 빈 값 표시**

Dataset에 데이터가 있어도 `rowposition`이 -1(초기 상태)이면 Edit, Label 등 단일 값 컴포넌트는 빈 값을 표시합니다. 데이터 조회 후 반드시 `set_rowposition(0)`을 호출하거나 Dataset의 `onload` 이벤트에서 처리해야 합니다.

```javascript
function fn_searchCallback(svcid, errorCode, errorMsg) {
    if (errorCode != 0) return;

    // 데이터가 있으면 첫 행을 현재 행으로 설정
    if (this.dsUser.rowcount > 0) {
        this.dsUser.set_rowposition(0);
        // 이 한 줄로 모든 바인딩 컴포넌트가 첫 행 데이터를 표시
    }
}
```

**2. 양방향 바인딩 중 clearData 호출 시 rowstatus 초기화**

```javascript
// clearData는 rowstatus도 모두 초기화됨
// 데이터를 다시 서버에서 받아오기 전에 clearData로 깨끗하게 시작
this.dsUser.clearData(); // 기존 수정 내역(rowstatus U/D/I)도 모두 초기화
```

**3. Grid 바인딩 시 컬럼 개수와 Dataset 컬럼 불일치**

Grid의 `datacolumn`에 존재하지 않는 컬럼명을 지정하면 빈 열이 표시됩니다. Dataset 구조와 Grid 컬럼 설정을 일치시켜야 합니다.

---

## 정리

| 바인딩 유형 | 속성 설정 | 특징 |
|---|---|---|
| 단일 값 (Edit, Label) | datasource + datacolumn | rowposition 기준 단일 셀 표시 |
| 목록 (Grid) | datasource | 전체 행 렌더링, rowposition 자동 동기화 |
| 선택 (Combo) | datasource + datacolumn + datacodedataset | 코드/표시 분리 |
| 마스터-디테일 | 각각 별도 Dataset | rowposchanged 이벤트로 연계 |

데이터바인딩을 잘 활용하면 데이터 동기화 코드를 최소화하고, Dataset 중심의 깔끔한 아키텍처를 유지할 수 있습니다. 다음 글에서는 이 바인딩의 데이터를 서버에서 가져오는 핵심 메커니즘인 **Transaction**을 다룹니다.

---

**다음 글:** Nexacro N Transaction — 서버 통신의 모든 것

<br>읽어주셔서 감사합니다 😊
