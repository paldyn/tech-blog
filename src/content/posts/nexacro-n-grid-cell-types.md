---
title: "[Nexacro N] Grid Cell Types — 셀 타입 완전 가이드"
description: "Nexacro N Grid의 normal·edit·combo·button·checkbox·image 셀 타입 설정 방법, combo 코드 Dataset 연결, checkbox 값 매핑, button 이벤트 처리를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 10
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "grid", "celltype", "combo", "checkbox", "button", "edit", "코드dataset"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-grid-format-editor/)에서 Format Editor의 구조를 살펴봤습니다. 이번에는 Grid에서 가장 중요한 설정 중 하나인 `celltype`을 다룹니다. 셀 타입에 따라 사용자가 데이터를 어떻게 보고 입력하는지가 결정됩니다.

## celltype 종류

Nexacro N Grid의 셀 타입은 크게 여섯 가지입니다.

| celltype | 용도 |
|---|---|
| `normal` | 읽기 전용 텍스트 표시 (기본값) |
| `edit` | 직접 입력 가능한 텍스트 편집 셀 |
| `combo` | 코드 Dataset 기반 드롭다운 선택 |
| `button` | 셀 안에 삽입된 버튼 |
| `checkbox` | 체크박스 ON/OFF |
| `image` | 아이콘·이미지 표시 |

![celltype 종류 개요](/assets/posts/nexacro-n-grid-cell-types-overview.svg)

## normal — 기본 읽기 전용

`celltype`을 지정하지 않으면 `normal`이 기본값입니다. 데이터를 텍스트로만 표시하며 클릭해도 편집 상태가 되지 않습니다.

```xml
<Cell col="0" datacolumn="emp_id" celltype="normal" halign="center"/>
```

`halign`으로 정렬을 지정합니다. `left`(기본), `center`, `right`를 사용합니다. 숫자 컬럼은 `right`가 표준입니다.

## edit — 직접 입력

사용자가 셀을 클릭하면 커서가 생겨 텍스트를 입력할 수 있습니다.

```xml
<Cell col="1" datacolumn="emp_nm"
  celltype="edit"
  edittype="normal"
  maxlength="50"/>
```

`edittype`에는 `normal`(일반 입력), `readonly`(읽기 전용), `password`(마스킹)가 있습니다. `maxlength`로 최대 입력 글자 수를 제한합니다.

### 마스크 편집

전화번호나 날짜처럼 입력 형식을 강제하려면 `mask` 속성을 사용합니다.

```xml
<Cell col="3" datacolumn="phone"
  celltype="edit"
  mask="999-9999-9999"/>
```

`9`는 숫자 한 자리, `A`는 영문자, `*`는 모든 문자를 의미합니다.

## combo — 코드 Dataset 연결

코드-명칭 쌍의 데이터를 드롭다운으로 선택하는 가장 빈번하게 사용하는 셀 타입입니다.

```xml
<Cell col="2" datacolumn="dept_cd"
  celltype="combo"
  lcodetype="dataset"
  lcdataset="ds_dept"
  codecolumn="dept_cd"
  datacolumn2="dept_nm"
  usenull="true"/>
```

- `lcdataset`: 코드 목록을 담은 Dataset ID
- `codecolumn`: 실제 저장되는 코드 컬럼
- `datacolumn2`: 화면에 표시되는 명칭 컬럼
- `usenull`: 빈 항목(선택 안함) 허용 여부

Dataset `ds_dept`에 `dept_cd`, `dept_nm` 컬럼이 있으면 그리드 셀에서 부서 드롭다운이 표시됩니다. 실제 Dataset에 저장되는 값은 `dept_cd`(코드)이고, 화면에는 `dept_nm`(이름)이 보입니다.

![combo/checkbox 셀 타입 코드](/assets/posts/nexacro-n-grid-cell-types-combo.svg)

## checkbox — 체크박스

`checkedvalue`와 `uncheckedvalue`로 Dataset에 저장될 값을 지정합니다.

```xml
<Cell col="5" datacolumn="use_yn"
  celltype="checkbox"
  checkedvalue="Y"
  uncheckedvalue="N"/>
```

Dataset의 `use_yn` 컬럼이 `"Y"`이면 체크 상태, `"N"`이면 해제 상태로 표시됩니다. 사용자가 체크를 바꾸면 Dataset 값도 자동으로 `"Y"` / `"N"`으로 갱신됩니다.

## button — 셀 내 버튼

셀 안에 버튼을 삽입하고 `onclick` 이벤트를 연결합니다.

```xml
<Cell col="6" celltype="button" text="상세"/>
```

```javascript
function grd_emp_oncellclick(obj, e) {
  if (e.col == 6) {
    // 버튼 셀 클릭
    var empId = this.ds_emp.getColumn(e.row, "emp_id");
    this.fn_openDetail(empId);
  }
}
```

`oncellclick` 이벤트에서 `e.col`로 버튼 컬럼인지 확인하고 처리합니다.

## image — 아이콘 표시

상태값에 따라 다른 이미지를 표시합니다.

```xml
<Cell col="7" datacolumn="status"
  celltype="image"
  imageInfo="images/ok.png;images/warn.png;images/error.png"/>
```

`status` 컬럼의 값(0, 1, 2)이 `imageInfo` 이미지 목록의 인덱스가 됩니다.

## 동적 celltype 변경

특정 조건에 따라 셀을 읽기/편집으로 전환하려면 `setCellProperty()`를 사용합니다.

```javascript
function fn_toggleCellEdit(rowIdx, editable) {
  var editType = editable ? "normal" : "readonly";
  this.grd_emp.setCellProperty(
    "body", rowIdx, 1, "edittype", editType
  );
}
```

`setCellProperty(band, row, col, property, value)`로 특정 셀의 속성을 런타임에 바꿀 수 있습니다.

## 실무 조합 예시

일반 업무 그리드의 전형적인 celltype 조합입니다.

| 컬럼 | celltype | 비고 |
|---|---|---|
| 행번호 | `normal` | center 정렬, read-only |
| 사번 | `normal` | read-only |
| 성명 | `edit` | 직접 수정 가능 |
| 부서 | `combo` | 코드 Dataset 연결 |
| 입사일 | `edit` + `mask` | 날짜 마스크 |
| 사용여부 | `checkbox` | Y/N 저장 |
| 상세 | `button` | 팝업 연결 |

## 정리

`celltype`은 사용자가 데이터와 상호작용하는 방식을 결정하는 핵심 속성입니다. `combo`의 코드 Dataset 연결과 `checkbox`의 값 매핑만 올바르게 설정하면 복잡한 입력 폼 역할을 그리드 하나로 처리할 수 있습니다.

---

**지난 글:** [Nexacro N Grid Format Editor — 그리드 포맷 에디터 활용](/posts/nexacro-n-grid-format-editor/)

**다음 글:** [Nexacro N Grid Binding — 그리드 바인딩 심화](/posts/nexacro-n-grid-binding/)

<br>
읽어주셔서 감사합니다. 😊
