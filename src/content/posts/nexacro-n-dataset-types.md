---
title: "[Nexacro N] Dataset 타입 완전 정리"
description: "Nexacro N의 Dataset, ConstDataset, NativeDataset, Script Dataset 4가지 타입을 비교하고 각 타입을 언제 어떻게 선택해야 하는지 실전 기준으로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "dataset", "constdataset", "nativedataset", "dataset-types"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-dataset-constcolumn/)에서 ConstColumn을 살펴봤습니다. Dataset 자체에도 여러 가지 **타입**이 존재합니다. 처음 Nexacro N을 접하면 Dataset 하나만 알고 시작하지만, 프로젝트가 커질수록 ConstDataset과 NativeDataset을 적재적소에 쓰는 능력이 코드 품질을 크게 좌우합니다.

## Dataset 타입 개요

![Nexacro N Dataset 타입 한눈에](/assets/posts/nexacro-n-dataset-types-overview.svg)

Nexacro N에서 실무적으로 구분해야 하는 Dataset 타입은 크게 네 가지입니다.

| 타입 | 선언 위치 | 수정 가능 | 주 용도 |
|------|-----------|-----------|---------|
| **Dataset** | 디자인 or 스크립트 | O | CRUD, 서버 통신 |
| **ConstDataset** | 디자인 타임 고정 | X | 코드 목록, Combo |
| **NativeDataset** | 스크립트 | 원본 따라 | 팝업 Dataset 전달 |
| **Script Dataset** | 스크립트 `new Dataset()` | O | 임시 계산·병합 |

---

## 1. Dataset

가장 기본이 되는 타입으로, `.xfdl` 파일의 `<Dataset>` 태그로 선언합니다. 서버와 `transaction()`으로 데이터를 주고받고, 행의 추가·수정·삭제 상태(rowType)를 추적합니다.

```xml
<Dataset id="dsEmp">
  <ColumnInfo>
    <Column id="EMP_CD" type="string" size="10"/>
    <Column id="EMP_NM" type="string" size="50"/>
  </ColumnInfo>
</Dataset>
```

---

## 2. ConstDataset

디자인 타임에 데이터를 직접 입력해 고정하는 타입입니다. 런타임에는 읽기 전용으로 동작하며, 화면이 열릴 때마다 서버 조회 없이 바로 사용할 수 있어 **공통 코드 목록이나 Combo 바인딩**에 적합합니다.

```xml
<ConstDataset id="cdUseYn">
  <ColumnInfo>
    <Column id="CODE" type="string" size="1"/>
    <Column id="NAME" type="string" size="10"/>
  </ColumnInfo>
  <Rows>
    <Row><Col id="CODE">Y</Col><Col id="NAME">사용</Col></Row>
    <Row><Col id="CODE">N</Col><Col id="NAME">미사용</Col></Row>
  </Rows>
</ConstDataset>
```

Combo 컴포넌트의 `innerdataset` 속성에 이 ConstDataset을 지정하면 별도 서버 조회 없이 항목이 채워집니다.

---

## 3. NativeDataset

다른 Dataset을 **참조**하는 타입입니다. 독립된 메모리를 갖지 않고 원본 Dataset을 가리키는 포인터처럼 동작합니다. 주로 팝업 Form에 부모 Form의 Dataset을 그대로 전달할 때 씁니다.

```javascript
// 부모 Form에서 팝업 오픈 시
var popArgs = {
    dsInput: this.dsSave  // Dataset 참조 전달
};
this.openPopup("popSearch", popArgs);

// 팝업 Form 스크립트
function onOpenPopup(obj, e) {
    // NativeDataset으로 연결 (메모리 절약)
    this.dsRef.setNativeDataset(opener.dsSave);
}
```

팝업에서 `dsRef`를 수정하면 부모의 `dsSave`도 **즉시 반영**됩니다.

---

## 4. Script Dataset (동적 생성)

`new Dataset()`으로 런타임에 생성하는 Dataset입니다. 컬럼 정의부터 데이터 조작까지 모두 스크립트로 처리합니다. 여러 Dataset을 병합하거나 임시 계산 결과를 담는 버퍼로 쓸 때 유용합니다.

![Dataset 타입별 선언 코드](/assets/posts/nexacro-n-dataset-types-code.svg)

```javascript
function mergeDatasets() {
    var dsMerged = new Dataset();
    dsMerged.addColumn("KEY",  "string", 20);
    dsMerged.addColumn("VAL",  "string", 100);

    // dsA 데이터 병합
    for (var i = 0; i < this.dsA.rowcount; i++) {
        var r = dsMerged.addRow();
        dsMerged.setColumn(r, "KEY", this.dsA.getColumn(i, "KEY"));
        dsMerged.setColumn(r, "VAL", this.dsA.getColumn(i, "VAL"));
    }
    // 사용 후 반드시 null 처리 (메모리 해제)
    dsMerged = null;
}
```

---

## 타입 선택 기준

- **서버 데이터 조회·저장** → `Dataset`
- **화면에서만 쓰는 고정 목록** → `ConstDataset`
- **팝업·서브폼에 Dataset 전달** → `NativeDataset`
- **임시 계산·병합 처리** → `Script Dataset`

이 기준을 지키면 불필요한 서버 호출과 메모리 낭비를 동시에 줄일 수 있습니다.

---

**지난 글:** [[Nexacro N] Dataset ConstColumn — 상수 컬럼 활용](/posts/nexacro-n-dataset-constcolumn/)

**다음 글:** [[Nexacro N] Dataset rowType — 행 상태 추적](/posts/nexacro-n-dataset-row-status/)

<br>
읽어주셔서 감사합니다. 😊
