---
title: "[Nexacro N] 대시보드 구성"
description: "Nexacro N으로 KPI 카드, 차트, 그리드를 조합한 대시보드를 구성하는 방법을 설명합니다. 레이아웃 설계, 멀티 트랜잭션 병렬 조회, setInterval 자동 갱신, 드릴다운 팝업 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 4
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "대시보드", "KPI", "setInterval", "멀티트랜잭션", "드릴다운"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-external-chart/)에서 WebBrowser를 통해 외부 차트를 연동하는 방법을 살펴보았다. 이번에는 KPI 카드, 차트, 그리드를 조합한 대시보드를 Nexacro N으로 구성하는 방법을 다룬다. 대시보드는 정보 밀도가 높고 여러 데이터 소스를 동시에 보여주므로, 레이아웃 설계와 성능에 특히 주의가 필요하다.

## 레이아웃 설계

대시보드의 전형적인 구조는 상단 KPI 카드 행, 중단 차트 영역, 하단 그리드다. Nexacro에서는 `Div`로 각 영역을 구획하고, 각 Div 안에 컴포넌트를 배치한다.

![대시보드 레이아웃 패턴](/assets/posts/nexacro-n-dashboard-layout.svg)

KPI 카드는 `Static`(수치 표시) + 배경색 지정 `Div`로 만든다. 수치를 크게 보여주기 위해 `Static`의 폰트 사이즈를 24~28pt로 설정하고, 배경색으로 지표 색상을 구분한다.

```nexacro
// KPI Static 값 업데이트
function fn_updateKpi(ds) {
    sta_orderCount.set_text(Eco.String.format(
        "{0:,}", ds.getColumn(0, "ORDER_CNT")
    ));
    sta_sales.set_text(Eco.String.format(
        "₩{0:,.0}", ds.getColumn(0, "SALES_AMT") / 100000000
    ) + "억");
    sta_errorRate.set_text(
        ds.getColumn(0, "ERROR_CNT") + "건"
    );
}
```

## 멀티 트랜잭션으로 병렬 조회

대시보드는 KPI, 차트 데이터, 그리드 데이터를 별도 서비스에서 받아오는 경우가 많다. 이를 순차적으로 조회하면 로딩 시간이 누적되므로, 여러 트랜잭션을 동시에 발행해 병렬로 받아온다.

```nexacro
function fn_loadAll() {
    // 세 트랜잭션 동시 발행
    this.transaction(
        "svcKpi",
        "/api/dashboard/kpi",
        "",
        "out:ds_kpi=KPI",
        "",
        "fn_kpiCallback"
    );

    this.transaction(
        "svcChart",
        "/api/dashboard/chart",
        "in:ds_filter=FILTER",
        "out:ds_chart=CHART",
        "",
        "fn_chartCallback"
    );

    this.transaction(
        "svcGrid",
        "/api/dashboard/list",
        "",
        "out:ds_list=LIST",
        "",
        "fn_gridCallback"
    );
}
```

세 트랜잭션을 동시에 발행하면 브라우저가 병렬로 HTTP 요청을 보내 전체 로딩 시간이 단일 요청의 최대값 수준으로 줄어든다.

## 자동 갱신 구현

대시보드는 주기적으로 데이터를 새로고침한다. `application.setInterval()`을 사용하고, 폼이 닫힐 때 반드시 `clearInterval()`을 호출해 타이머 누수를 막아야 한다.

![자동 갱신 패턴 — setInterval](/assets/posts/nexacro-n-dashboard-refresh.svg)

```nexacro
var g_timerId = null;
var INTERVAL = 60000;  // 1분

function Form_onload(obj, e) {
    fn_loadAll();
    g_timerId = application.setInterval("fn_loadAll()", INTERVAL);
}

function Form_onunload(obj, e) {
    if (g_timerId != null) {
        application.clearInterval(g_timerId);
        g_timerId = null;
    }
}
```

`clearInterval()`을 빠뜨리면 폼이 닫혀도 타이머가 계속 실행되어 서버에 불필요한 요청을 보내게 된다. 특히 탭 전환으로 폼이 닫혔다 열리는 환경에서는 타이머가 중복 등록될 수 있으므로 주의한다.

## 드릴다운 팝업

차트 항목이나 그리드 행을 클릭하면 상세 팝업을 여는 드릴다운 패턴이 대시보드에서 흔하다.

```nexacro
function grd_list_oncellclick(obj, e) {
    var orderId = ds_list.getColumn(e.row, "ORDER_ID");
    var popArgs = {
        orderId: orderId
    };
    this.open("PopDrilldown::popup/PopDrilldown.xfdl",
        this, "modal", popArgs,
        "fn_drilldownCallback"
    );
}

function fn_drilldownCallback(result) {
    if (result === "refresh") {
        fn_loadAll();
    }
}
```

팝업에서 데이터를 수정하고 닫을 때 `"refresh"` 신호를 보내면, 대시보드가 전체 데이터를 다시 조회한다.

## 갱신 중 UX 처리

자동 갱신이 진행되는 동안 화면이 깜빡이거나 사용자 조작이 방해받으면 안 된다. 백그라운드 갱신임을 알 수 있도록 마지막 갱신 시각을 표시하고, 로딩 인디케이터는 최소화한다.

```nexacro
function fn_kpiCallback(sId, nErrorCode, sErrorMsg) {
    if (nErrorCode < 0) return;
    fn_updateKpi(ds_kpi);

    // 마지막 갱신 시각 표시
    var now = new Date();
    var timeStr = Eco.Date.format(now, "HH:mm:ss");
    sta_lastUpdate.set_text("최근 갱신: " + timeStr);
}
```

갱신 중 에러가 발생하면 이전 데이터를 유지하고, 에러 메시지를 헤더 영역에 조용히 표시하는 방식이 사용자 경험에 좋다.

---

**지난 글:** [외부 차트 연동](/posts/nexacro-n-external-chart/)

**다음 글:** [세션과 로그인](/posts/nexacro-n-session-login/)

<br>
읽어주셔서 감사합니다. 😊
