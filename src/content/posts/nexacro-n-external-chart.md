---
title: "[Nexacro N] 외부 차트 연동"
description: "Nexacro N의 WebBrowser 컴포넌트를 활용해 ECharts, Chart.js 같은 외부 차트 라이브러리를 연동하는 방법을 설명합니다. execScript로 Dataset 데이터를 JSON으로 전달하고, 클릭 이벤트를 Nexacro로 역전달하는 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "외부차트", "ECharts", "Chart.js", "WebBrowser", "execScript"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-plot-component/)에서 내장 Plot 컴포넌트로 기본 차트를 만드는 방법을 살펴보았다. 내장 Plot은 빠르게 적용할 수 있지만, 복잡한 시각화(다중 Y축, 드릴다운, 히트맵 등)가 필요하면 ECharts나 Chart.js 같은 외부 라이브러리를 연동해야 한다. Nexacro N에서는 WebBrowser 컴포넌트를 중계자로 사용해 이를 구현한다.

## 연동 구조

Nexacro Form 안에 WebBrowser 컴포넌트를 배치하고, 내부에 로드될 HTML 파일에 외부 차트 라이브러리를 포함한다. 데이터는 Nexacro Script에서 JSON으로 직렬화해 `execScript()`로 HTML 내부 함수에 전달한다.

![외부 차트 연동 아키텍처](/assets/posts/nexacro-n-external-chart-arch.svg)

HTML 파일은 프로젝트의 리소스 폴더에 두거나, 배포 서버의 정적 파일 경로에 위치시킨다. WebBrowser의 `url` 속성에 해당 경로를 지정한다.

## HTML 차트 파일 작성

HTML 파일은 차트 라이브러리 초기화 코드와 Nexacro에서 호출할 `updateChart()` 함수를 포함한다.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="echarts.min.js"></script>
  <style>
    body { margin: 0; background: #0a0a0a; }
    #chart { width: 100%; height: 100vh; }
  </style>
</head>
<body>
  <div id="chart"></div>
  <script>
    var chart = echarts.init(document.getElementById('chart'), 'dark');

    function updateChart(data) {
      var option = {
        xAxis: { type: 'category' },
        yAxis: { type: 'value' },
        series: [{ type: 'bar', data: data }]
      };
      chart.setOption(option);
    }

    // Nexacro로 이벤트 역전달
    chart.on('click', function(params) {
      if (window.external && window.external.notify) {
        window.external.notify(JSON.stringify({
          type: 'chartClick',
          name: params.name,
          value: params.value
        }));
      }
    });
  </script>
</body>
</html>
```

`echarts.min.js`를 CDN으로 불러오거나, 오프라인 환경이라면 프로젝트에 번들해 상대 경로로 참조한다.

## Nexacro에서 데이터 전달

![Dataset → JSON 변환 패턴](/assets/posts/nexacro-n-external-chart-code.svg)

```nexacro
function fn_updateChart() {
    var ds = ds_chartData;
    var arr = [];

    for (var i = 0; i < ds.rowcount; i++) {
        arr.push({
            name: ds.getColumn(i, "MONTH"),
            value: parseInt(ds.getColumn(i, "AMOUNT"))
        });
    }

    var json = JSON.stringify(arr);
    WebBrowser00.execScript("updateChart(" + json + ")");
}
```

`execScript()`의 인자는 HTML 내부에서 실행될 JavaScript 코드 문자열이다. 함수 호출식을 문자열로 만들어 전달하면 되는데, JSON 데이터가 크면 문자열 길이 제한에 주의해야 한다.

## WebBrowser 로드 완료 감지

HTML 파일 로딩이 끝나기 전에 `execScript()`를 호출하면 차트가 그려지지 않는다. WebBrowser의 `onload` 이벤트를 이용해 로드 완료 후 데이터를 전달한다.

```nexacro
function WebBrowser00_onload(obj, e) {
    // HTML 로드 완료 후 초기 데이터 전달
    fn_updateChart();
}
```

트랜잭션 콜백과 `onload` 순서가 보장되지 않는 경우, 플래그를 두어 둘 다 완료됐을 때 `fn_updateChart()`를 실행하는 패턴이 안전하다.

```nexacro
var g_chartLoaded = false;
var g_dataLoaded = false;

function WebBrowser00_onload(obj, e) {
    g_chartLoaded = true;
    if (g_dataLoaded) fn_updateChart();
}

function fn_searchCallback(sId, nErrorCode, sErrorMsg) {
    g_dataLoaded = true;
    if (g_chartLoaded) fn_updateChart();
}
```

## 차트 클릭 이벤트 수신

HTML에서 `window.external.notify()`로 보낸 메시지는 WebBrowser의 `onmessage` 이벤트로 수신된다.

```nexacro
function WebBrowser00_onmessage(obj, e) {
    try {
        var msg = JSON.parse(e.data);
        if (msg.type === "chartClick") {
            // 클릭한 항목으로 상세 조회
            fn_searchDetail(msg.name);
        }
    } catch(ex) {
        trace("onmessage parse error: " + ex.message);
    }
}
```

`e.data`에는 `notify()`에 전달한 문자열이 담긴다. JSON 파싱 시 예외를 반드시 처리한다.

## 차트 라이브러리 선택 가이드

| 라이브러리 | 강점 | 약점 |
|-----------|------|------|
| ECharts | 기능 풍부, 한국어 커뮤니티 | 번들 크기 큼 |
| Chart.js | 심플, 경량 | 복잡한 차트 제한적 |
| D3.js | 자유도 최고 | 학습 곡선 가파름 |

사내 인트라넷에서 CDN 접근이 막혀 있다면 라이브러리를 프로젝트에 포함하고 서버에서 정적으로 제공해야 한다. ECharts의 경우 기능을 선택적으로 번들하는 빌드 도구를 사용하면 크기를 크게 줄일 수 있다.

---

**지난 글:** [Plot 컴포넌트](/posts/nexacro-n-plot-component/)

**다음 글:** [대시보드 구성](/posts/nexacro-n-dashboard/)

<br>
읽어주셔서 감사합니다. 😊
