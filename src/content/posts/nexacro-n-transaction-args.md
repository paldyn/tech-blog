---
title: "[Nexacro N] transaction() args 파라미터 완전 활용"
description: "Nexacro N transaction()의 다섯 번째 파라미터 args의 형식, 사용 시점, 페이징·정렬·플래그 전달 패턴, 서버에서의 수신 방법과 주의사항을 실전 예제로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 5
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "transaction", "args", "getParameter", "pagination", "sorting"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-input-output-dataset/)에서 입력·출력 Dataset 매핑을 배웠습니다. `transaction()`의 다섯 번째 파라미터인 **args**는 Dataset 없이 단순 스칼라 값을 서버로 전달할 때 사용합니다. 페이지 번호, 정렬 컬럼, 승인/반려 플래그처럼 Dataset 구조를 만들기에는 과한 값들이 args의 적절한 용도입니다.

## args 파라미터 기본 형식

![transaction() args 파라미터 활용](/assets/posts/nexacro-n-transaction-args-overview.svg)

args는 `"key=value"` 쌍을 **공백**으로 구분하는 문자열입니다.

```javascript
// 기본 형식
"key1=value1 key2=value2 key3=value3"

// 예
"pageNo=1 pageSize=20 sortCol=EMP_NO sortDir=ASC"
```

`transaction()` 다섯 번째 자리에 직접 문자열로 넣거나, 변수로 조립해서 전달합니다.

```javascript
this.transaction(
    "SVC_SRCH",
    "SVC_EMP::getList",
    "dsCond=dsSearch",
    "dsResult=dsMain",
    "pageNo=1 pageSize=20",   // ← args
    "fn_searchCb"
);
```

## 서버에서 args 수신

서버 어댑터에서는 `request.getParameter()`로 args 값을 받습니다.

```java
@Override
public void getList(NexacroRequest req, NexacroResponse res)
        throws Exception {
    // args로 전달된 값 수신
    String pageNo   = req.getParameter("pageNo");
    String pageSize = req.getParameter("pageSize");
    String sortCol  = req.getParameter("sortCol");
    String sortDir  = req.getParameter("sortDir");

    // Dataset도 함께 수신 가능
    NexacroDataSet dsCond = req.getDataset("dsCond");

    // 비즈니스 로직에 파라미터 전달
    Map<String, Object> param = new HashMap<>();
    param.put("deptCd", dsCond.getColumnAsString(0, "DEPT_CD"));
    param.put("pageNo", Integer.parseInt(pageNo));
    param.put("pageSize", Integer.parseInt(pageSize));
    param.put("sortCol", sortCol);
    param.put("sortDir", sortDir);

    List<Map> list = empMapper.selectList(param);
    // ...
}
```

## 주요 활용 사례

![args 실전 활용 사례](/assets/posts/nexacro-n-transaction-args-usecase.svg)

### 1. 페이징 + 정렬

가장 많이 쓰이는 패턴입니다. 그리드 헤더 클릭 시 정렬 정보를 args로 전달합니다.

```javascript
function fn_search(nPage) {
    var nPageNo = nPage || 1;
    var sSortCol = this.sSortCol || "REG_DATE";
    var sSortDir = this.sSortDir || "DESC";

    var sArgs = "pageNo=" + nPageNo
              + " pageSize=20"
              + " sortCol=" + sSortCol
              + " sortDir=" + sSortDir;

    this.transaction(
        "SVC_SRCH",
        "SVC_EMP::getList",
        "dsCond=dsSearch",
        "dsResult=dsMain dsPager=dsPager",
        sArgs,
        "fn_searchCb"
    );
}
```

### 2. 단건 삭제 — PK 전달

현재 선택 행의 PK를 args로 전달하는 방식입니다.

```javascript
function fn_delete() {
    var nRow = this.dsMain.rowposition;
    if (nRow < 0) {
        alert("삭제할 행을 선택하세요.");
        return;
    }
    var sEmpNo = this.dsMain.getColumn(nRow, "EMP_NO");

    if (!confirm("삭제하시겠습니까?")) return;

    this.transaction(
        "SVC_DEL",
        "SVC_EMP::delete",
        "",
        "",
        "empNo=" + sEmpNo,
        "fn_deleteCb"
    );
}
```

### 3. 플래그 값 전달 — 승인/반려

동일한 서비스에 모드를 구분하는 플래그를 args로 전달합니다.

```javascript
function fn_approve(sType) {
    // sType: "Y"=승인, "N"=반려
    this.transaction(
        "SVC_APPR",
        "SVC_APPR::process",
        "dsAppr=dsApprList",
        "",
        "apprType=" + sType + " apprId=" + this.sUserId,
        "fn_approvalCb"
    );
}
```

### 4. inDatasets와 args 혼합

복잡한 조건은 Dataset으로, 단순 값은 args로 함께 보냅니다.

```javascript
this.transaction(
    "SVC_SRCH",
    "SVC_EMP::getList",
    "dsCond=dsFilter",    // 다중 조건 Dataset
    "dsResult=dsMain",
    "pageNo=" + this.nPage + " exportType=EXCEL", // 단순 값
    "fn_searchCb"
);
```

## args 사용 시 주의사항

### 공백이 포함된 값

args의 key=value 구분자는 공백이므로, **값 안에 공백이 있으면** 파싱이 잘못됩니다.

```javascript
// 잘못된 예 — 값에 공백 포함
"searchName=홍 길동"  // "searchName=홍"과 "길동" 두 개로 파싱됨

// 올바른 방법 — Dataset 컬럼으로 전달하거나 encodeURIComponent 사용
// 또는 인라인 값 대신 Dataset 컬럼으로 이동
```

공백이 있을 가능성이 있는 값은 inDatasets의 Dataset 컬럼으로 전달하는 것이 안전합니다.

### 숫자 타입 변환

args의 모든 값은 문자열로 전달됩니다. 서버에서 Integer로 쓰려면 변환이 필요합니다.

```java
int pageNo = Integer.parseInt(req.getParameter("pageNo"));
```

### args가 빈 경우

args를 쓰지 않을 때는 빈 문자열 `""`를 그대로 전달합니다.

```javascript
this.transaction("SVC_SRCH", "SVC_EMP::getList",
    "dsCond=dsSearch", "dsResult=dsMain", "", "fn_searchCb");
```

`null` 대신 `""`를 쓰는 것이 관례입니다.

## Dataset vs args 선택 기준

| 상황 | 권장 방식 |
|------|-----------|
| 값이 단순하고 공백 없음 | args |
| 값에 공백·특수문자 가능성 | inDatasets |
| 여러 행 데이터 | inDatasets (Dataset만 가능) |
| 컬럼이 많은 구조화된 조건 | inDatasets |
| 페이지 번호, PK 키값, 플래그 | args |

---

**지난 글:** [입력·출력 Dataset 매핑 심화](/posts/nexacro-n-input-output-dataset/)

**다음 글:** [콜백(Callback) 패턴 완전 정리](/posts/nexacro-n-callback-pattern/)

<br>
읽어주셔서 감사합니다. 😊
