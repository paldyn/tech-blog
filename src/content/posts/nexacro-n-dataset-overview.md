---
title: "[Nexacro N] Dataset 개요 — 데이터의 심장"
description: "Nexacro N의 Dataset이 무엇인지, 서버와 UI 컴포넌트 사이에서 어떤 역할을 하는지 구조와 API부터 rowType, clear/clearData 차이까지 Dataset의 기초를 완전히 이해합니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 10
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "dataset", "rowtype", "getColumn", "setColumn", "addRow", "deleteRow"]
featured: false
draft: false
---

Grid 시리즈를 마치고, 이번 글부터는 **Dataset** 챕터를 시작합니다. Nexacro N 개발에서 Dataset은 서버에서 받은 데이터를 저장하고, UI 컴포넌트에 바인딩하고, 변경 사항을 추적해서 다시 서버로 보내는 **데이터의 심장** 역할을 합니다. Dataset을 제대로 이해하면 Nexacro N 개발의 절반을 이해한 것과 같습니다.

## Dataset이란?

Dataset은 관계형 데이터베이스의 테이블과 유사한 구조로 데이터를 메모리에 보관하는 Nexacro N의 핵심 컴포넌트입니다. 컬럼과 행으로 구성되며, 각 행은 **rowType**이라는 상태 플래그를 가집니다.

Dataset의 세 가지 핵심 역할:

1. **데이터 저장소**: 서버에서 받은 XML/JSON 응답을 파싱해 메모리에 보관
2. **데이터 바인딩 소스**: Grid, Edit, Combo 등 UI 컴포넌트와 연결해 자동 동기화
3. **변경 추적**: 추가(INSERT)·수정(UPDATE)·삭제(DELETE) 행을 추적해 서버 전송

![Dataset 구조와 역할](/assets/posts/nexacro-n-dataset-overview-structure.svg)

## Dataset 선언

Form의 Script 또는 디자인 패널에서 선언합니다.

```xml
<!-- Form XML에서 Dataset 선언 -->
<Datasets>
  <Dataset id="dsList">
    <ColumnInfo>
      <Column id="DEPT_CD" type="STRING" size="10"/>
      <Column id="DEPT_NM" type="STRING" size="100"/>
      <Column id="USE_YN"  type="STRING" size="1" default="Y"/>
    </ColumnInfo>
  </Dataset>
</Datasets>
```

| 타입 | 설명 |
|---|---|
| `STRING` | 문자열 (기본) |
| `INT` | 정수 |
| `FLOAT` | 부동소수점 |
| `DATE` | 날짜 (YYYYMMDD) |
| `BLOB` | 바이너리 |

`default` 속성으로 행 추가 시 기본값을 지정할 수 있습니다.

## rowType — 행 상태 추적

Dataset의 각 행은 상태(rowType)를 가집니다. 이 상태를 기반으로 서버에 보낼 때 INSERT/UPDATE/DELETE를 분류합니다.

| rowType 값 | 상수 | 의미 |
|---|---|---|
| 1 | `Dataset.ROWTYPE_NORMAL` | 변경 없음 (서버 조회 결과) |
| 2 | `Dataset.ROWTYPE_INSERT` | 새로 추가된 행 |
| 4 | `Dataset.ROWTYPE_UPDATE` | 수정된 행 |
| 8 | `Dataset.ROWTYPE_DELETE` | 삭제 표시된 행 |

```javascript
function fn_checkStatus() {
    for (var r = 0; r < ds.rowcount; r++) {
        var nType = ds.getRowType(r);
        if (nType == Dataset.ROWTYPE_UPDATE) {
            trace("수정됨: " + r + "행");
        }
    }
    // 변경된 행 수 확인
    trace("INSERT: " + ds.getInsertedRowCount());
    trace("UPDATE: " + ds.getUpdatedRowCount());
    trace("DELETE: " + ds.getDeletedRowCount());
}
```

서버 조회 후 `acceptRow()` 또는 `acceptAllRow()`를 호출하면 모든 행의 rowType이 NORMAL로 초기화됩니다.

## 핵심 API

![Dataset 핵심 API 예시](/assets/posts/nexacro-n-dataset-overview-api.svg)

### 행 추가 / 삭제

```javascript
// 행 추가 (rowType: INSERT)
var nRow = ds.addRow();
ds.setColumn(nRow, "DEPT_CD", "D999");
ds.setColumn(nRow, "DEPT_NM", "테스트팀");

// 행 삭제 (rowType: DELETE로 표시 — 서버 저장 전까지 보존)
ds.deleteRow(nRow);

// 물리적 즉시 삭제 (DELETE 표시 없이)
ds.removeRow(nRow);
```

`deleteRow()`는 서버로 DELETE 정보를 보내야 하는 경우에, `removeRow()`는 단순히 행을 없애고 싶을 때 사용합니다.

### 값 읽기 / 쓰기

```javascript
// 값 읽기 (컬럼명 또는 인덱스 모두 사용 가능)
var sCode = ds.getColumn(0, "DEPT_CD");  // 컬럼명
var sName = ds.getColumn(0, 1);           // 컬럼 인덱스

// 값 쓰기 (rowType을 UPDATE로 변경)
ds.setColumn(0, "DEPT_NM", "수정된팀명");
```

### 전체 지우기: clear vs clearData

```javascript
ds.clearData(); // 행 데이터만 삭제 (컬럼 정의 유지)
ds.clear();     // 행 + 컬럼 정의 모두 삭제
```

대부분의 실무에서는 `clearData()`를 사용합니다. 재조회 시 컬럼 정의는 유지하고 데이터만 새로 채워야 하기 때문입니다.

### 행 검색

```javascript
// 특정 컬럼 값으로 행 찾기
var nRow = ds.findRow("DEPT_CD", "D001");
if (nRow >= 0) {
    trace("찾은 행: " + nRow);
}

// 복수 컬럼 조건으로 검색
var nRow2 = ds.findRowExpr("DEPT_CD == 'D001' && USE_YN == 'Y'");
```

`findRow()`는 첫 번째 일치 행만 반환합니다. 모든 일치 행을 찾으려면 루프에서 `getColumn()`으로 직접 비교합니다.

## UI 컴포넌트와 바인딩

Dataset을 UI 컴포넌트에 연결하는 방법은 두 가지입니다.

**1. Grid 바인딩**: `bindeddataset` 속성으로 연결
```javascript
grd.set_bindeddataset("dsList");
```

Grid는 Dataset의 `currentrow`를 따라가지 않고 모든 행을 표시합니다.

**2. 단일 컴포넌트 바인딩**: `binddataset` + `binddatacolumn`으로 연결
```javascript
edtName.set_binddataset("dsList");
edtName.set_binddatacolumn("DEPT_NM");
```

Edit에 바인딩하면 Dataset의 `currentrow` 기준으로 값이 표시됩니다. `currentrow`를 바꾸면 Edit 내용이 자동으로 갱신됩니다.

```javascript
// 현재 행 이동
ds.set_rowposition(2); // 3번째 행(0 인덱스)으로 이동
```

## Dataset 복수 활용 패턴

실무에서 한 Form에 여러 Dataset을 사용하는 것이 일반적입니다.

```text
dsList    — Grid에 바인딩, 목록 표시
dsDetail  — Edit에 바인딩, 상세 화면
dsCode    — 공통 코드 (콤보 목록 소스)
dsParam   — 팝업 파라미터 전달용
```

Dataset 이름은 용도가 명확히 드러나게 짓고, 접두사로 `ds`를 붙이는 것이 관례입니다.

## clear() 주의사항

`clear()`는 컬럼 정의까지 지우므로, 다시 데이터를 넣으려면 컬럼을 재정의해야 합니다. 런타임에 동적으로 컬럼을 추가하는 경우가 아니라면 `clearData()`를 사용합니다.

```javascript
// 잘못된 패턴: 조회마다 clear() → 컬럼 재정의 필요
ds.clear();               // 컬럼 날아감
ds.addColumn("ID", "STRING", 10); // 매번 재정의 필요

// 올바른 패턴: 데이터만 초기화
ds.clearData();           // 컬럼 유지
// 트랜잭션으로 새 데이터 채우기
```

---

**지난 글:** [Grid 트러블슈팅](/posts/nexacro-n-grid-troubleshooting/)

<br>
읽어주셔서 감사합니다. 😊
