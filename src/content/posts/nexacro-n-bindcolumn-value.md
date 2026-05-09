---
title: "[Nexacro N] bindcolumn과 value 속성 완전 정복"
description: "Nexacro N의 value, bindcolumn, codecolumn, datacolumn 속성을 컴포넌트 유형별로 비교하고, 스크립트에서 값을 읽고 쓰는 올바른 방법을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 7
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "databinding", "bindcolumn", "value", "codecolumn", "datacolumn"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-binding-direction/)에서 바인딩 방향 제어를 살펴봤습니다. 이번에는 데이터바인딩의 핵심 속성인 `value`, `bindcolumn`, `codecolumn`, `datacolumn`의 역할을 컴포넌트별로 자세히 비교합니다. 이름이 비슷해 처음에는 헷갈리기 쉽지만 각 속성이 담당하는 역할은 명확하게 구분됩니다.

## value 속성 — 단건 컴포넌트의 컬럼 연결

Edit, Static, Button, MaskEdit 등 단건 값을 표시하는 컴포넌트는 `dataset` + `value` 조합으로 Dataset의 특정 컬럼을 연결합니다.

```xml
<Edit id="edtName"
  dataset="dsMain"
  value="NAME"
  left="20" top="20" width="200" height="30"/>
```

`value`는 컬럼명 문자열을 받습니다. `dsMain.currentrow`가 가리키는 행의 NAME 컬럼 값이 Edit에 표시됩니다.

![bindcolumn vs value 속성 해부](/assets/posts/nexacro-n-bindcolumn-value-anatomy.svg)

## bindcolumn — Grid 셀의 컬럼 연결

Grid는 `binddataset`으로 전체 행을 받고, 각 셀은 `bindcolumn`으로 표시할 컬럼을 지정합니다.

```xml
<!-- Grid Format 에디터에서 셀마다 지정 -->
<Cell bindcolumn="CODE"/>
<Cell bindcolumn="NAME"/>
<Cell bindcolumn="AMT"/>
```

`binddataset`이 Grid 레벨 속성이고 `bindcolumn`이 셀 레벨 속성입니다. 스크립트에서는 `grdMain.getBindColumnID(col)`, `grdMain.setCellProperty(col, "bindcolumn", "NEW_COL")` 등으로 접근합니다.

## Combo의 두 Dataset — 코드 목록 vs 선택값

Combo는 두 가지 Dataset이 관여합니다.

| 속성 | Dataset | 역할 |
|------|---------|------|
| `binddataset` | 코드 Dataset | 드롭다운 목록 구성 |
| `codecolumn` | 코드 Dataset | 저장할 코드 컬럼 |
| `datacolumn` | 코드 Dataset | 표시할 이름 컬럼 |
| `dataset` | 데이터 Dataset | 선택 결과를 저장할 Dataset |
| `value` | 데이터 Dataset | 코드를 저장할 컬럼 |

```xml
<Combo id="cboStatus"
  binddataset="dsCode"
  codecolumn="CODE"
  datacolumn="NAME"
  dataset="dsMain"
  value="STATUS"
  left="20" top="60" width="150" height="30"/>
```

사용자가 "신규"를 선택하면 `dsCode`에서 해당 행의 CODE 값(`10`)이 `dsMain.STATUS`에 저장됩니다. 화면에는 `datacolumn` 기준으로 "신규"가 표시됩니다.

## 스크립트에서 값 읽기

바인딩된 컴포넌트의 값은 컴포넌트에서 읽거나 Dataset에서 직접 읽을 수 있습니다.

![스크립트로 value / bindcolumn 읽기](/assets/posts/nexacro-n-bindcolumn-value-code.svg)

바인딩이 설정되어 있다면 `get_value()`와 `dsMain.getColumn(currentrow, "NAME")`은 동일한 값을 반환합니다. Dataset을 직접 다루는 방식을 선호합니다. 컴포넌트 ID보다 Dataset 컬럼명이 데이터 중심으로 읽히고, 같은 컬럼을 여러 컴포넌트가 공유하는 상황에도 일관성이 유지됩니다.

## 스크립트에서 값 쓰기

바인딩된 컴포넌트에 값을 쓸 때는 Dataset을 통해 쓰는 것이 원칙입니다.

```javascript
// 권장: Dataset 조작 → 컴포넌트 자동 갱신
this.dsMain.setColumn(this.dsMain.currentrow, "NAME", "홍길동");

// 비권장: 컴포넌트에 직접 set_value (Dataset도 변경되긴 함)
this.edtName.set_value("홍길동");
```

`edtName.set_value()`로 써도 Dataset 값이 변경되지만, 로직이 Dataset을 거치지 않으므로 onchanged 이벤트 발화 타이밍이 달라질 수 있습니다. 바인딩 없는 컴포넌트(상수 표시용 Static 등)에는 `set_value()`를 직접 씁니다.

## value 속성에 표현식 사용

`value`에는 단순 컬럼명 외에 Dataset 표현식을 쓸 수도 있습니다.

```xml
<!-- NAME + 직급 조합 표시 -->
<Static dataset="dsMain" value="name+' '+rank"/>
```

단, 표현식은 읽기 전용이 됩니다. 양방향 바인딩이 필요한 편집 컴포넌트(Edit 등)에서는 표현식 대신 단순 컬럼명만 지정해야 합니다.

---

**지난 글:** [[Nexacro N] 바인딩 방향 — 단방향·양방향 제어](/posts/nexacro-n-binding-direction/)

**다음 글:** [[Nexacro N] 바인딩 표현식 — 계산 컬럼과 포맷](/posts/nexacro-n-binding-expression/)

<br>
읽어주셔서 감사합니다. 😊
