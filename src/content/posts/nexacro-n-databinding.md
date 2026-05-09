---
title: "[Nexacro N] 데이터바인딩 개념과 기초"
description: "Nexacro N 데이터바인딩의 핵심 원리를 설명하고, dataset·binddataset·value·bindcolumn 속성을 컴포넌트 유형별로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-09"
archiveOrder: 5
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "databinding", "dataset", "binddataset", "value", "bindcolumn"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-dataset-csv/)에서 Dataset의 CSV 처리를 살펴봤습니다. Nexacro N 개발의 핵심 메커니즘 중 하나가 데이터바인딩입니다. Dataset에 데이터를 채우면 바인딩된 컴포넌트가 자동으로 화면을 갱신하고, 사용자가 컴포넌트에서 값을 수정하면 Dataset에 자동으로 반영됩니다. 이 자동 동기화 덕분에 DOM 조작이나 값 복사 코드를 따로 작성하지 않아도 됩니다.

## 데이터바인딩이란

Dataset의 `currentrow` 값이 변경되거나 Dataset 내 데이터가 바뀌면, 해당 Dataset에 바인딩된 모든 컴포넌트가 즉시 새 값으로 표시됩니다. 반대로 Edit 컴포넌트에서 사용자가 텍스트를 수정하면 Dataset의 해당 컬럼 값도 실시간으로 변경됩니다.

![데이터바인딩 개념도](/assets/posts/nexacro-n-databinding-concept.svg)

이 양방향 동기화 구조 덕분에 Nexacro N 화면은 Dataset이 단일 진실 공급원(Single Source of Truth)이 됩니다. 서버에서 데이터를 받아 Dataset에 채우면 화면 전체가 갱신되는 방식입니다.

## 핵심 속성 4가지

| 속성 | 설명 |
|------|------|
| `dataset` | 연결할 Dataset의 ID |
| `value` | 표시할 컬럼명 (currentrow 기준 단건) |
| `binddataset` | 전체 행을 표시하는 컴포넌트(Grid·List·Select)용 |
| `bindcolumn` | Grid 셀이 참조할 컬럼명 |

`dataset`과 `value`는 한 행의 특정 컬럼을 컴포넌트에 연결할 때 씁니다. `binddataset`은 Dataset의 전체 행을 순회해 표시하는 Grid·List·Select 컴포넌트에 사용합니다.

## Edit 컴포넌트에 바인딩

```xml
<Edit id="edtName"
  dataset="dsMain"
  value="NAME"
  left="20" top="20" width="200" height="30"/>
```

`dataset`에 Dataset ID, `value`에 컬럼명을 지정합니다. `dsMain.currentrow`가 가리키는 행의 NAME 컬럼 값이 Edit에 표시됩니다. 사용자가 값을 수정하면 Dataset의 해당 컬럼도 자동으로 변경됩니다.

## Grid 컴포넌트에 바인딩

Grid는 `binddataset`으로 전체 행을 표시하고, 각 셀의 `bindcolumn`으로 컬럼을 지정합니다.

```xml
<Grid id="grdMain"
  binddataset="dsMain"
  left="20" top="60" width="600" height="300"/>
```

Grid Format 에디터에서 각 셀의 `bindcolumn`을 `CODE`, `NAME`, `AMT` 등으로 설정합니다. `binddataset`이 지정된 Grid는 Dataset의 모든 행을 자동으로 렌더링합니다.

![컴포넌트별 바인딩 속성 정리](/assets/posts/nexacro-n-databinding-props.svg)

## Combo 바인딩 — 코드·표시 분리

Combo는 내부 코드 Dataset(`binddataset`)과 현재 선택값을 저장하는 Dataset(`dataset`)을 분리해서 씁니다.

```xml
<Combo id="cboStatus"
  binddataset="dsCode"
  codecolumn="CODE"
  datacolumn="NAME"
  dataset="dsMain"
  value="STATUS"
  left="20" top="60" width="150" height="30"/>
```

`binddataset`+`codecolumn`+`datacolumn`이 드롭다운 목록을 구성하고, `dataset`+`value`가 현재 선택된 코드를 `dsMain.STATUS` 컬럼에 저장합니다.

## 스크립트로 Dataset 연결 변경

폼 로드 시 스크립트로 바인딩 속성을 지정할 수도 있습니다.

```javascript
function fn_onload_formload(obj, e) {
    // 스크립트로 바인딩 속성 설정
    this.edtName.set_dataset("dsMain");
    this.edtName.set_value("NAME");
    this.grdMain.set_binddataset("dsMain");
}
```

Designer에서 바인딩을 설정하는 것이 일반적이지만, 런타임에 Dataset을 동적으로 교체해야 할 때 이 방식을 사용합니다.

## currentrow가 바인딩에 미치는 영향

Edit·Combo·Static 컴포넌트는 `dataset.currentrow`가 가리키는 단 하나의 행을 보여줍니다. `currentrow`가 `-1`(선택 없음)이면 컴포넌트 값이 비어 있습니다. Grid에서 행을 클릭하면 `dsMain.currentrow`가 자동으로 해당 행 번호로 변경되고, 같은 Dataset에 바인딩된 Edit들도 즉시 새 값으로 업데이트됩니다. 이것이 마스터-디테일 UI의 기본 동작 원리입니다.

---

**지난 글:** [[Nexacro N] Dataset CSV 데이터 다루기](/posts/nexacro-n-dataset-csv/)

**다음 글:** [[Nexacro N] 바인딩 방향 — 단방향·양방향 제어](/posts/nexacro-n-binding-direction/)

<br>
읽어주셔서 감사합니다. 😊
