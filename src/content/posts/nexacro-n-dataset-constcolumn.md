---
title: "[Nexacro N] Dataset ConstColumn — 상수 컬럼 활용"
description: "Nexacro N Dataset의 ConstColumn(상수 컬럼)이 무엇인지, 선언 방법과 addConstColumn · getConstColumn · setConstColumn API를 실전 예제로 익힙니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "dataset", "constcolumn", "addConstColumn", "setConstColumn", "getConstColumn"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-dataset-overview/)에서 Dataset의 기본 구조와 역할을 살펴봤습니다. 이번에는 Dataset의 특수 컬럼 유형 중 하나인 **ConstColumn(상수 컬럼)**을 집중적으로 다룹니다. ConstColumn은 이름 그대로 모든 행이 동일한 상수 값을 공유하는 컬럼으로, 일반 컬럼과는 데이터 저장 방식이 근본적으로 다릅니다.

## ConstColumn이란?

일반 컬럼은 행마다 독립된 값을 저장합니다. 반면 ConstColumn은 **Dataset 전체에 딱 하나의 값만 유지**되며, 새 행이 추가되어도 그 값을 그대로 상속받습니다.

대표적인 사용 시나리오:

- 현재 로그인 사용자의 사번·부서 코드를 모든 저장 행에 자동 포함
- 서버 요청 시 공통으로 전달해야 하는 세션 키나 필터 값
- 그리드에서 체크박스 컬럼의 전체 기본값(Y/N) 초기화

![ConstColumn vs 일반 컬럼 비교](/assets/posts/nexacro-n-dataset-constcolumn-structure.svg)

## 선언 방법

### 디자인 패널에서 선언

Nexacro Studio에서 Dataset 컴포넌트를 선택하고 **Column** 탭을 열면 컬럼 추가 버튼 옆에 **Const Column** 추가 버튼이 있습니다. 이름·타입·기본값을 입력하면 `.xfdl` 파일에 아래와 같이 저장됩니다.

```xml
<Dataset id="dsSave">
  <ColumnInfo>
    <Column id="EMP_CD"  type="string" size="10"/>
    <Column id="EMP_NM"  type="string" size="50"/>
    <ConstColumn id="DEPT_CD" type="string" size="10" value="D001"/>
  </ColumnInfo>
</Dataset>
```

### 스크립트로 런타임 선언

화면 초기화 시 동적으로 추가해야 할 때는 `addConstColumn()`을 사용합니다.

```javascript
function form_onload(obj, e) {
    var ds = this.dsSave;

    // ConstColumn 추가 (name, type, value)
    ds.addConstColumn("DEPT_CD", "string", "D001");
    ds.addConstColumn("REG_ID",  "string", "");

    // 로그인 정보를 ConstColumn에 세팅
    ds.setConstColumn("REG_ID", gv_userId);
}
```

## 값 읽기·변경

```javascript
// 값 읽기 — 어떤 행 인덱스와도 무관
var dept = ds.getConstColumn("DEPT_CD"); // "D001"

// 값 변경 — 선언된 단 하나의 값만 바꿈
ds.setConstColumn("DEPT_CD", "D003");
// 이후 ds.getColumn(n, "DEPT_CD")도 "D003" 반환
```

## 일반 컬럼 API와의 차이

| 구분 | 일반 컬럼 | ConstColumn |
|------|-----------|-------------|
| 값 개수 | 행 수만큼 | 딱 1개 |
| 읽기 | `getColumn(row, col)` | `getConstColumn(col)` |
| 쓰기 | `setColumn(row, col, val)` | `setConstColumn(col, val)` |
| 행 추가 시 | 기본값(emptyValue) | 현재 const 값 |

![ConstColumn 선언·읽기·변경 예제](/assets/posts/nexacro-n-dataset-constcolumn-code.svg)

## 트랜잭션과 ConstColumn

`transaction()` 으로 서버에 데이터를 보낼 때, ConstColumn은 일반 컬럼과 동일하게 XML 패킷에 포함됩니다. 즉 서버 측에서는 어느 행을 읽어도 같은 값이 들어있는 컬럼으로 보입니다.

```xml
<!-- 서버로 전송되는 Dataset XML 예시 -->
<Dataset id="dsSave">
  <ColumnInfo>
    <Column id="EMP_CD"  type="string"/>
    <Column id="EMP_NM"  type="string"/>
    <ConstColumn id="DEPT_CD" type="string" value="D001"/>
  </ColumnInfo>
  <Rows>
    <Row><Col id="EMP_CD">E001</Col><Col id="EMP_NM">김철수</Col></Row>
    <Row><Col id="EMP_CD">E002</Col><Col id="EMP_NM">이영희</Col></Row>
  </Rows>
</Dataset>
```

서버 Java 어댑터에서는 `dataset.getColumn(row, "DEPT_CD")` 로 동일하게 읽을 수 있습니다.

## 주의사항

- `setConstColumn()`으로 값을 변경하면 **rowType이 변하지 않습니다.** 즉 변경 추적(modified/inserted 행 체크) 대상이 아닙니다.
- `clearData()` 를 호출하면 행은 모두 삭제되지만 ConstColumn 값은 유지됩니다.
- `clear()` 를 호출하면 컬럼 정의(ConstColumn 포함)까지 모두 초기화됩니다.

---

**다음 글:** [[Nexacro N] Dataset 타입 완전 정리](/posts/nexacro-n-dataset-types/)

<br>
읽어주셔서 감사합니다. 😊
