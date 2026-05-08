---
title: "[Nexacro N] Dataset 필터(setFilter) 완전 정복"
description: "Nexacro N Dataset의 setFilter·clearFilter를 사용해 원본 데이터를 유지하면서 화면에 표시할 행을 제한하는 방법, 표현식 문법, totalrowcount 활용까지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 7
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "dataset", "setFilter", "clearFilter", "totalrowcount", "filter-expression"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-dataset-iteration/)에서 Dataset을 순회하는 패턴을 익혔습니다. 데이터가 많을 때 사용자가 원하는 행만 보이도록 하는 방법이 `setFilter()`입니다. 서버에 다시 요청하지 않고 **메모리 내에서 즉시 결과가 반영**되기 때문에 반응 속도가 매우 빠릅니다.

## setFilter() 동작 원리

`setFilter()`는 Dataset의 원본 데이터를 지우거나 복사하지 않습니다. 내부적으로 **어느 행을 화면에 보여줄지 플래그만 바꿉니다.** 따라서 필터를 해제하면 숨겨졌던 행이 그대로 돌아옵니다.

```javascript
// 부서코드가 D001인 행만 표시
this.dsList.setFilter("DEPT_CD == 'D001'");

// 필터 해제 — 전체 행 다시 표시
this.dsList.clearFilter();
```

![Dataset setFilter 동작 원리](/assets/posts/nexacro-n-dataset-filter-flow.svg)

## 표현식 문법

`setFilter()`의 인수는 문자열 표현식입니다. 컬럼 이름을 직접 쓰고 값을 비교합니다.

| 연산 | 예시 |
|------|------|
| 등호 | `"DEPT_CD == 'D001'"` |
| 부등호 | `"AMT >= 300"` |
| AND | `"DEPT_CD == 'D001' && USE_YN == 'Y'"` |
| OR | `"DEPT_CD == 'D001' \|\| DEPT_CD == 'D002'"` |
| LIKE | `"like(EMP_NM, '*철*')"` |
| 범위 | `"AMT >= 100 && AMT <= 500"` |

```javascript
// 복합 조건 필터
this.dsEmp.setFilter(
    "DEPT_CD == 'D001' && AMT >= 300"
);

// LIKE 검색 (사원명에 '철' 포함)
this.dsEmp.setFilter("like(EMP_NM, '*철*')");
```

## totalrowcount — 전체 행 수 확인

필터가 적용된 상태에서 `rowcount`는 필터를 통과한 행의 수만 반환합니다. 전체 원본 행 수를 알고 싶다면 `totalrowcount`를 씁니다.

```javascript
this.dsEmp.setFilter("DEPT_CD == 'D001'");

trace("필터 후 rowcount: " + this.dsEmp.rowcount);         // 3
trace("전체 totalrowcount: " + this.dsEmp.totalrowcount);  // 5
```

이 차이를 이용해 "전체 N건 중 M건 표시" 같은 UI 안내 문구를 쉽게 만들 수 있습니다.

## 콤보 선택과 필터 연동

검색 조건 Combo의 `onitemchanged` 이벤트에서 필터를 적용하는 것이 가장 흔한 패턴입니다.

![setFilter 실전 활용 코드](/assets/posts/nexacro-n-dataset-filter-code.svg)

```javascript
function cmbDept_onitemchanged(obj, e) {
    var dept = obj.value;
    if (!dept) {
        this.dsList.clearFilter();
    } else {
        this.dsList.setFilter("DEPT_CD == '" + dept + "'");
    }
}
```

## 검색어 입력과 동적 필터

사용자가 입력창에 값을 입력할 때마다 필터를 다시 적용합니다.

```javascript
function edtSearch_onkeyup(obj, e) {
    var kw = obj.value.trim();
    if (!kw) {
        this.dsList.clearFilter();
    } else {
        this.dsList.setFilter("like(EMP_NM, '*" + kw + "*')");
    }
}
```

## 필터와 정렬의 조합

필터와 정렬(`setSortByField`)은 독립적으로 동작하며 함께 사용할 수 있습니다.

```javascript
// 필터 후 정렬
this.dsEmp.setFilter("DEPT_CD == 'D001'");
this.dsEmp.setSortByField("AMT", "DESC");
```

필터를 해제해도 정렬 상태는 유지됩니다.

## 주의사항

- `setFilter()` 중에 `addRow()`를 호출하면 새 행이 현재 필터 조건을 만족하지 않을 경우 **그리드에 즉시 보이지 않을 수 있습니다.** 신규 행이 필터를 통과하도록 ConstColumn이나 setColumn으로 미리 값을 세팅하세요.
- `setFilter()`는 rowType에 영향을 주지 않으므로 트랜잭션 전송 시 숨겨진 행도 INSERT/UPDATE/DELETE 상태라면 정상 전송됩니다.

---

**지난 글:** [[Nexacro N] Dataset 행 순회 패턴](/posts/nexacro-n-dataset-iteration/)

**다음 글:** [[Nexacro N] Dataset 정렬(setSortByField) 가이드](/posts/nexacro-n-dataset-sort/)

<br>
읽어주셔서 감사합니다. 😊
