---
title: "[Nexacro N] 복수 Dataset 동시 처리 — 효율적인 서버 통신 설계"
description: "Nexacro N에서 한 번의 transaction()으로 여러 Dataset을 주고받는 패턴, 목록+페이징+집계 동시 수신, 마스터·디테일 동시 저장, Form 초기화 공통코드 일괄 로딩을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 9
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "transaction", "multi-dataset", "마스터디테일", "공통코드", "페이징"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-transaction-error/)에서 트랜잭션 오류 처리 전략을 다뤘습니다. 이번 글에서는 한 번의 `transaction()` 호출로 **여러 Dataset을 동시에 교환하는 패턴**을 살펴봅니다. 트랜잭션 수를 줄이면 서버 왕복이 줄어들고 화면 로딩 속도가 빨라집니다.

## 복수 Dataset을 써야 하는 이유

공통코드 3종, 목록 데이터, 페이징 정보를 각각 별도 트랜잭션으로 가져오면 총 5번의 서버 요청이 필요합니다. 이것을 1~2번으로 줄이는 것이 복수 Dataset의 목적입니다.

## 다중 출력 Dataset — 목록 + 페이징 + 집계

![복수 Dataset 동시 처리 패턴](/assets/posts/nexacro-n-multi-dataset-pattern.svg)

outDatasets에 공백으로 구분해 여러 Dataset을 지정합니다.

```javascript
function fn_search() {
    this.dsSearch.clearData();
    this.dsSearch.addRow();
    this.dsSearch.setColumn(0, "DEPT_CD", this.cboDept.value);
    this.dsSearch.setColumn(0, "SRCH_NM", this.edtName.value);

    this.transaction(
        "SVC_SRCH",
        "SVC_EMP::getList",
        "dsCond=dsSearch",
        "dsResult=dsMain dsPager=dsPager dsSummary=dsSummary",
        "pageNo=1 pageSize=20",
        "fn_searchCb"
    );
}

function fn_searchCb(svcId, errCode, errMsg) {
    if (errCode !== 0) { alert(errMsg); return; }

    // 세 개 Dataset이 모두 채워짐
    var totalCnt  = this.dsPager.getColumn(0, "TOTAL_CNT");
    var totalAmt  = this.dsSummary.getColumn(0, "TOTAL_AMT");
    var listCnt   = this.dsMain.rowcount;

    trace("목록: " + listCnt + "건 / 전체: " + totalCnt
        + "건 / 합계금액: " + totalAmt);

    this.fn_setPager(totalCnt);
}
```

서버에서는 세 Dataset을 각각 addDataset으로 추가합니다:

```java
public void getList(NexacroRequest req, NexacroResponse res)
        throws Exception {
    NexacroDataSet dsCond = req.getDataset("dsCond");
    int pageNo   = Integer.parseInt(req.getParameter("pageNo"));
    int pageSize = Integer.parseInt(req.getParameter("pageSize"));

    // 비즈니스 로직
    NexacroDataSet dsResult  = empService.getList(dsCond, pageNo, pageSize);
    NexacroDataSet dsPager   = empService.getPager(dsCond, pageSize);
    NexacroDataSet dsSummary = empService.getSummary(dsCond);

    res.addDataset("dsResult",  dsResult);
    res.addDataset("dsPager",   dsPager);
    res.addDataset("dsSummary", dsSummary);
}
```

이름 매핑: `dsResult` → `dsMain`, `dsPager` → `dsPager`, `dsSummary` → `dsSummary`.

## 다중 입력 Dataset — 마스터·디테일 동시 저장

주문 헤더와 주문 라인처럼 연관된 두 Dataset을 한 번에 저장합니다.

```javascript
function fn_save() {
    if (!this.fn_validate()) return;

    this.transaction(
        "SVC_SAVE",
        "SVC_ORDER::save",
        "dsOrder=dsMaster dsLine=dsDetail",  // 두 Dataset 동시 전송
        "",
        "",
        "fn_saveCb"
    );
}
```

서버에서 수신:

```java
public void save(NexacroRequest req, NexacroResponse res)
        throws Exception {
    NexacroDataSet dsOrder = req.getDataset("dsOrder");
    NexacroDataSet dsLine  = req.getDataset("dsLine");

    // 트랜잭션 처리
    orderService.saveOrder(dsOrder, dsLine);
    // 서버 DB 트랜잭션으로 묶어서 처리
}
```

## Form 초기화 — 공통코드 일괄 로딩

여러 콤보박스의 데이터를 한 번에 가져오는 패턴입니다.

![Form 초기화 — 공통코드 일괄 로딩](/assets/posts/nexacro-n-multi-dataset-init.svg)

```javascript
function Form_onload(obj, e) {
    this.fn_initCombo();
}

function fn_initCombo() {
    this.transaction(
        "SVC_COMBO",
        "SVC_CODE::getMultiCode",
        "",
        "dsDept=dsDept dsType=dsType dsStatus=dsStatus dsGrade=dsGrade",
        "codeGroup=DEPT,TYPE,STATUS,GRADE",
        "fn_comboCb"
    );
}

function fn_comboCb(svcId, errCode, errMsg) {
    if (errCode !== 0) {
        alert("[공통코드 로딩 실패] " + errMsg);
        return;
    }
    // 4개 콤보 Dataset이 모두 채워짐
    trace("공통코드 로딩 완료");
    this.fn_search(); // 코드 로딩 완료 후 조회
}
```

서버에서 `codeGroup` args를 파싱해 여러 코드그룹을 한 번에 조회:

```java
public void getMultiCode(NexacroRequest req, NexacroResponse res)
        throws Exception {
    String codeGroups = req.getParameter("codeGroup");
    String[] groups = codeGroups.split(",");

    for (String group : groups) {
        NexacroDataSet ds = codeService.getCode(group.trim());
        res.addDataset("ds" + capitalize(group.trim()), ds);
    }
}
```

## 주의: Dataset 이름 철자 정확성

복수 Dataset에서 가장 흔한 오류는 이름 불일치입니다.

```javascript
// 클라이언트 outDatasets 지정
"dsResult=dsMain dsPager=dsPager"

// 서버가 추가하는 이름이 정확히 일치해야 함
res.addDataset("dsResult", ...);  // ← 정확히 "dsResult"
res.addDataset("dsPager", ...);   // ← 정확히 "dsPager"

// 잘못된 예
res.addDataset("dsResults", ...); // ← 's' 추가로 dsMain에 데이터 안 들어감
```

이름 불일치 시 해당 Dataset만 비어 있고 다른 Dataset은 정상이므로 디버깅 시 각 Dataset을 개별 확인해야 합니다.

## 복수 Dataset 활용 정리

| 시나리오 | outDatasets 예 |
|----------|---------------|
| 목록 + 페이징 | `"dsResult=dsMain dsPager=dsPager"` |
| 목록 + 합계 | `"dsResult=dsMain dsSummary=dsSummary"` |
| 공통코드 3종 | `"dsDept=dsDept dsType=dsType dsStatus=dsStatus"` |
| 마스터 + 디테일 | inDatasets: `"dsOrder=dsMaster dsLine=dsDetail"` |

트랜잭션 횟수를 줄이되, Dataset 하나에 너무 많은 정보를 우겨넣는 것은 피합니다. 논리적으로 연관된 데이터를 함께 묶는 것이 적절한 기준입니다.

---

**지난 글:** [트랜잭션 오류 처리 전략](/posts/nexacro-n-transaction-error/)

**다음 글:** [트랜잭션 커스텀 HTTP 헤더 추가](/posts/nexacro-n-transaction-headers/)

<br>
읽어주셔서 감사합니다. 😊
