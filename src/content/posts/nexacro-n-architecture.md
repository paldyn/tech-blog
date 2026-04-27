---
title: "[Nexacro N] 아키텍처 개요 — 브라우저·런타임·서버"
description: "Nexacro N이 어떤 구조로 브라우저와 서버를 연결하는지, 런타임의 4대 엔진(컴포넌트·레이아웃·Dataset·Transaction)을 중심으로 전체 아키텍처를 해부합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "architecture", "runtime", "transaction", "dataset"]
featured: false
draft: false
---

이 글은 **Nexacro N 기준**으로 작성되었습니다.

[지난 글](/posts/nexacro-n-history/)에서 Nexacro가 ActiveX 기반의 14버전에서 HTML5 순수 엔진의 N·V24까지 진화해 온 역사를 살펴봤습니다. 그렇다면 현재의 Nexacro N은 내부적으로 어떤 구조로 동작할까요? 이번 글에서는 브라우저부터 서버까지 3개 레이어를 세로로 쌓은 전체 아키텍처를 분해하고, 각 레이어가 맡은 역할을 구체적으로 살펴봅니다.

## 전체 구조: 3-Tier 아키텍처

Nexacro N은 크게 세 개의 층으로 이루어집니다.

![Nexacro N 3-Tier 아키텍처](/assets/posts/nexacro-n-architecture-overview.svg)

맨 위 **브라우저 레이어**는 Chrome·Firefox·Edge 같은 모던 브라우저의 HTML5 Canvas·DOM과 JavaScript 엔진(V8, SpiderMonkey 등)으로 구성됩니다. 사용자는 이 레이어를 통해 화면을 보고 조작합니다.

가운데 **Nexacro 런타임 레이어**는 Nexacro N이 직접 구현한 심장부입니다. 약 300개의 UI 컴포넌트를 관리하는 컴포넌트 엔진, 절대 좌표와 Anchor를 처리하는 레이아웃 엔진, 인메모리 관계형 데이터를 다루는 Dataset 관리자, 그리고 서버와 통신하는 Transaction 관리자가 이 레이어 안에 공존합니다.

맨 아래 **서버 레이어**는 Nexacro 전용 어댑터(Java/.NET/Node.js), 그 뒤의 비즈니스 로직, 그리고 데이터베이스로 이루어집니다. 브라우저와 서버 사이의 데이터는 PL(Protocol Language)이라는 Nexacro 전용 텍스트 프로토콜로 주고받습니다.

## 브라우저 레이어: Nexacro는 무엇을 빌려 쓰는가

Nexacro N은 브라우저를 "화면 그리기 도구"로 사용합니다. HTML5 Canvas에 컴포넌트를 픽셀 단위로 그리고, DOM은 일부 입력 영역(예: 에디트 컴포넌트 내부의 `<input>`)에만 제한적으로 활용합니다. 브라우저가 제공하는 CSS나 레이아웃 시스템(Flexbox, Grid)은 거의 사용하지 않고, 좌표 계산과 렌더링을 Nexacro 자체 엔진이 전담합니다.

이 구조 덕분에 브라우저 종류나 버전과 무관하게 **픽셀 퍼펙트**한 화면을 구현할 수 있습니다. 동일한 Form이 Chrome에서나 Firefox에서나 동일한 레이아웃으로 보이는 이유입니다. 반면, 웹 표준 CSS를 활용하지 않으므로 일반적인 웹 개발 지식이 Nexacro에 그대로 적용되지는 않습니다.

## 런타임 레이어: 4개의 엔진

런타임 레이어는 Nexacro의 핵심이며, 4개의 서브 시스템으로 나뉩니다.

### 컴포넌트 엔진

Button, Grid, Edit, Combo, Tree, Tab, Calendar 등 약 300개 컴포넌트의 생성·렌더링·이벤트 처리를 담당합니다. XFDL 파일에 선언된 컴포넌트 속성을 파싱해 각 컴포넌트 인스턴스를 메모리에 올리고, 변경 사항이 생기면 캔버스에 다시 그립니다.

```javascript
// 런타임이 컴포넌트 인스턴스를 이렇게 참조하게 됨
// this.컴포넌트id 형식으로 Form 스크립트에서 접근
function fn_init() {
    // 컴포넌트 속성 읽기
    var sVal = this.edt_name.value;

    // 컴포넌트 속성 쓰기 (런타임이 캔버스 업데이트)
    this.edt_name.enable = false;
    this.btn_save.text  = "저장 중...";
}
```

### 레이아웃 엔진

Nexacro는 기본적으로 **절대 좌표계**를 사용합니다. 각 컴포넌트는 `left`, `top`, `width`, `height` 속성을 명시적으로 갖습니다. Form의 크기가 바뀔 때 컴포넌트 위치를 자동으로 조정하려면 `Anchor` 속성을 설정해야 합니다.

```javascript
// Anchor 값: "left top right bottom" 조합
// 우측 고정 컴포넌트 예시 (창 크기 변경 시 우측 여백 고정)
this.btn_close.anchor = "right top";

// 양쪽 늘어남 (컨테이너 너비에 따라 컴포넌트 너비 변동)
this.grd_list.anchor = "left top right bottom";
```

### Dataset 관리자

Nexacro에서 데이터는 **Dataset**이라는 인메모리 테이블 객체로 관리됩니다. 브라우저 메모리 안에 완전히 상주하므로, 서버 요청 없이도 정렬·필터·합계 계산이 가능합니다. Dataset은 Grid와 같은 UI 컴포넌트와 직접 바인딩되어 데이터가 바뀌면 화면도 자동으로 갱신됩니다.

```javascript
// Dataset에 행 추가 후 값 설정
function fn_addRow() {
    var nRow = this.ds_emp.addRow();
    this.ds_emp.setColumn(nRow, "EMP_NM", "홍길동");
    this.ds_emp.setColumn(nRow, "DEPT_CD", "10");
    // Grid는 Dataset을 바라보고 있으므로 자동으로 화면 갱신
}
```

Dataset은 각 행의 상태(RowStatus)도 추적합니다. 추가된 행은 `1(insert)`, 수정된 행은 `2(update)`, 삭제된 행은 `4(delete)` 상태가 되며, 저장 요청 시 서버는 이 상태를 보고 INSERT/UPDATE/DELETE를 실행합니다.

### Transaction 관리자

`transaction()` 메서드를 호출할 때마다 Transaction 관리자가 동작합니다. 지정된 입력 Dataset을 PL 포맷으로 직렬화해 HTTP POST 요청을 서버로 보내고, 응답 받은 PL 데이터를 역직렬화해 출력 Dataset에 채운 뒤 콜백 함수를 실행합니다.

## transaction() 요청·응답 흐름

아래 다이어그램은 사용자가 조회 버튼을 클릭했을 때 데이터가 어떤 경로로 흐르는지를 보여줍니다.

![transaction() 요청·응답 흐름](/assets/posts/nexacro-n-architecture-request-flow.svg)

핵심은 **6개 인자**입니다. 트랜잭션 ID, 서비스 URL, 입력 Dataset 명세, 출력 Dataset 명세, 추가 인자, 콜백 함수명 순서로 전달합니다.

```javascript
function fn_search() {
    this.transaction(
        "search",              // ① 트랜잭션 ID (콜백 구분용)
        "svc::EmpService.do",  // ② 서비스 URL
        "input=ds_cond",       // ③ 입력 Dataset
        "output=ds_emp",       // ④ 출력 Dataset
        "",                    // ⑤ 추가 URL 파라미터
        "fn_searchCallback"    // ⑥ 콜백 함수명
    );
}

function fn_searchCallback(sId, nErrorCd, sErrorMsg) {
    if (nErrorCd < 0) {
        alert("조회 오류: " + sErrorMsg);
        return;
    }
    // ds_emp는 이미 채워져 있고, Grid도 자동으로 갱신됨
    trace("조회 완료, 건수: " + this.ds_emp.rowcount);
}
```

`nErrorCd`가 0 이상이면 정상, 음수이면 서버 측 오류입니다. 콜백 함수 안에서 이 값을 체크하는 패턴은 Nexacro 개발에서 가장 자주 쓰이는 관용구 중 하나입니다.

## 서버 레이어: 어댑터 패턴

서버 쪽에는 Nexacro 전용 **어댑터 라이브러리**가 필요합니다. Java 기반 Spring 프로젝트라면 `nexacro-java-adapter` jar를 추가하고, 컨트롤러 대신 어댑터가 제공하는 `DataSetMap`·`ParameterMap`을 사용해 비즈니스 로직을 작성합니다.

```java
// Java 어댑터 예시 (PlatformData 사용)
@RequestMapping("/EmpService.do")
public void searchEmp(
        HttpServletRequest req,
        HttpServletResponse res) throws Exception {

    PlatformData pData = new PlatformData();
    DataSetHandler handler = new DataSetHandler(req);

    // 입력 Dataset (ds_cond) 꺼내기
    DataSet dsCond = handler.getDataSet("ds_cond");
    String deptCd  = dsCond.getColumnAsString(0, "DEPT_CD");

    // 조회 후 출력 Dataset 구성
    DataSet dsEmp = empService.findByDept(deptCd);
    pData.addDataSet(dsEmp);  // ds_emp 이름으로 반환됨

    handler.writeData(res, pData);
}
```

어댑터가 없는 경우에는 표준 REST API를 호출하고 `loadJSON()` 메서드로 결과를 Dataset에 직접 파싱하는 방법도 있지만, 멀티 Dataset 동시 송수신이나 RowStatus 기반 일괄 저장 같은 Nexacro의 고급 기능을 사용하려면 어댑터 기반 PL 프로토콜이 훨씬 편리합니다.

## PL 프로토콜 한 줄 요약

PL 포맷은 Nexacro가 Dataset을 직렬화할 때 사용하는 텍스트 기반 포맷입니다. HTTP POST 본문에 담겨 전송되므로, 브라우저 개발자 도구(Network 탭)의 Request Payload에서 확인할 수 있습니다. 텍스트 기반이라 사람이 읽을 수 있고, 어댑터가 자동으로 파싱해 주므로 직접 다룰 일은 거의 없습니다.

## Dataset과 컴포넌트의 연결: 바인딩 모델

런타임의 또 다른 핵심은 **Data Binding**입니다. Grid나 Combo 같은 컴포넌트에 Dataset을 연결해 두면, Dataset 데이터가 바뀔 때마다 컴포넌트 화면이 자동으로 갱신됩니다. 반대로 사용자가 Grid 셀을 편집하면 Dataset의 해당 셀 값이 자동으로 수정됩니다.

```javascript
// Grid에 Dataset 바인딩
function onload() {
    // 1. Dataset 직접 바인딩
    this.grd_emp.setBindDataset("ds_emp");

    // 2. 또는 XFDL 속성에서 bindDataset="ds_emp" 선언 (더 일반적)
    //    → 이 경우 onload에서 별도 코드 불필요
}
```

이 바인딩 모델 덕분에 개발자는 "데이터를 바꾸면 화면도 바뀐다"는 원칙 하나만 기억하면 됩니다. DOM 조작이나 뷰 갱신 로직을 별도로 작성할 필요가 없습니다.

## 정리: 아키텍처가 개발 패턴을 결정한다

Nexacro의 3-Tier 구조를 이해하면 개발 관습의 이유가 보입니다.

- **Dataset 중심 개발**: 데이터는 항상 Dataset에 담아 컴포넌트에 바인딩합니다. DOM을 직접 조작하는 일은 없습니다.
- **transaction() 패턴**: 서버 통신은 반드시 `transaction()` 하나로 귀결됩니다. URL fetch나 XHR을 직접 쓰는 경우는 예외적입니다.
- **콜백 패턴**: 비동기 요청이므로 결과 처리는 항상 콜백 함수 안에서 합니다.
- **Form 단위 개발**: 화면 하나가 XFDL 파일 하나로 캡슐화됩니다. 여기에 Dataset, 컴포넌트, 스크립트가 모두 포함됩니다.

다음 글에서는 이 아키텍처를 기반으로 **Nexacro N과 Nexacro Platform의 실질적인 차이점**을 비교합니다. 같은 3-Tier 구조지만 어디서 무엇이 달라졌는지, 현장에서 반드시 알아야 할 포인트만 골라서 정리하겠습니다.

---

**지난 글:** [Nexacro 14 → Platform → N · V24 진화](/posts/nexacro-n-history/)

**다음 글:** [Nexacro N vs Platform 차이점](/posts/nexacro-n-vs-platform/)

<br>
읽어주셔서 감사합니다. 😊
