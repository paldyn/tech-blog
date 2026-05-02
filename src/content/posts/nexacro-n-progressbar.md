---
title: "[Nexacro N] ProgressBar — 진행 상태 시각화 컴포넌트"
description: "Nexacro N ProgressBar 컴포넌트의 value·min·max·direction 속성, 트랜잭션 연동 진행률 표시, setInterval 애니메이션, 색상 상태 제어 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "progressbar", "진행률", "set_value", "트랜잭션", "애니메이션"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-imageviewer-picture/)에서 이미지 표시 컴포넌트를 살펴봤습니다. 이번에는 작업 진행 상태를 시각적으로 표현하는 `ProgressBar` 컴포넌트를 다룹니다. 파일 업로드, 배치 처리, 단계별 마법사 UI 등 다양한 곳에서 활용됩니다.

## ProgressBar 기본 속성

`ProgressBar`는 숫자 범위 내에서 현재 진행 위치를 막대 형태로 표시합니다.

```xml
<ProgressBar id="prg_upload"
  left="20" top="20" width="600" height="24"
  min="0" max="100"
  value="0"
  direction="right"
  showvalue="false"/>
```

| 속성 | 설명 | 기본값 |
|---|---|---|
| `min` | 최솟값 | 0 |
| `max` | 최댓값 | 100 |
| `value` | 현재 값 | 0 |
| `direction` | 진행 방향 (right/left/up/down) | right |
| `showvalue` | 진행률 텍스트 표시 여부 | false |

`direction`은 막대가 채워지는 방향입니다. 세로형 배터리 게이지라면 `up`, 오른쪽에서 왼쪽으로 채우는 역방향 UI라면 `left`를 사용합니다.

![ProgressBar 시각 상태](/assets/posts/nexacro-n-progressbar-states.svg)

## 값 설정과 읽기

스크립트에서 `set_value()` 메서드로 값을 변경하고, `value` 속성으로 현재 값을 읽습니다.

```javascript
// 값 설정
this.prg_upload.set_value(50);

// 현재 값 읽기
var cur = this.prg_upload.value;  // 50

// 퍼센트 계산
var pct = Math.round((cur / this.prg_upload.max) * 100);
```

`min`과 `max`를 커스텀 범위로 지정하면 파일 개수나 레코드 건수를 그대로 사용할 수 있습니다. 예를 들어 총 500건을 처리할 때 `max="500"`으로 설정하고 처리된 건수를 `value`로 넣으면 환산 계산 없이 바로 적용됩니다.

## 트랜잭션 연동 패턴

가장 흔한 사용 패턴은 트랜잭션 호출 전에 ProgressBar를 표시하고, 콜백에서 완료 처리하는 방식입니다.

```javascript
function fn_startUpload() {
  this.prg_upload.set_value(0);
  this.prg_upload.set_visible(true);
  this.transaction(
    "upload",
    "SVC:fileUpload",
    "",
    "out:ds_result",
    "",
    "fn_uploadCallback"
  );
}

function fn_uploadCallback(sId, nEC, sEM) {
  if (nEC == 0) {
    this.prg_upload.set_value(100);
  } else {
    alert("업로드 실패: " + sEM);
  }
  this.prg_upload.set_visible(false);
}
```

트랜잭션이 단일 요청이라면 0 → 100 직행이지만, 서버에서 진행률을 반환한다면 중간 값을 콜백에서 설정할 수 있습니다.

![ProgressBar 트랜잭션 연동](/assets/posts/nexacro-n-progressbar-code.svg)

## setInterval로 애니메이션 구현

서버 응답을 기다리는 동안 ProgressBar가 멈춰 보이면 사용자가 오류로 오인할 수 있습니다. `setInterval`로 값을 점진적으로 증가시켜 활성 상태를 표현합니다.

```javascript
var _timer = null;

function fn_startProgress() {
  var self = this;
  this.prg_upload.set_value(0);
  _timer = setInterval(function() {
    var cur = self.prg_upload.value;
    if (cur < 90) {
      self.prg_upload.set_value(cur + 5);
    }
  }, 300);
}

function fn_stopProgress() {
  if (_timer) {
    clearInterval(_timer);
    _timer = null;
  }
  this.prg_upload.set_value(100);
}
```

90에서 멈추고 실제 완료 시점에 100을 설정합니다. 90%를 넘기면 사용자가 "거의 다 됐는데 왜 안 끝나지"라는 인상을 받기 때문에 의도적으로 상한선을 둡니다.

## 색상 상태 제어

Nexacro N의 스타일 시스템을 이용하면 진행률 구간별로 색상을 바꿀 수 있습니다. 스크립트에서 `setStyleValue()`를 호출해 바 색상을 동적으로 변경합니다.

```javascript
function fn_updateProgressColor(value) {
  var barColor;
  if (value < 30) {
    barColor = "#7ec8e3";   // 초기: 파랑
  } else if (value < 70) {
    barColor = "#e0a030";   // 중간: 주황
  } else {
    barColor = "#55c555";   // 완료: 초록
  }
  this.prg_upload.setStyleValue("bar-background-color", barColor);
}
```

값이 바뀔 때마다 이 함수를 호출하면 진행 구간에 따라 색이 전환됩니다.

## 세로형 ProgressBar

`direction="up"`과 `width`·`height` 비율을 조정하면 세로 막대 형태로 쓸 수 있습니다.

```xml
<ProgressBar id="prg_battery"
  left="20" top="20" width="30" height="120"
  min="0" max="100"
  value="70"
  direction="up"/>
```

배터리 잔량 표시, 재고 수준 시각화, 단계별 점수 표현 등에 활용됩니다.

## 정리

`ProgressBar`는 단순하지만 사용자 경험에 큰 영향을 줍니다. 트랜잭션 전후로 표시/숨김을 제어하고, 장시간 작업에는 `setInterval` 애니메이션을 더하면 응답성 있는 UI를 만들 수 있습니다. 색상 상태 제어까지 더하면 진행 구간을 직관적으로 전달할 수 있습니다.

---

**지난 글:** [Nexacro N ImageViewer · Picture — 이미지 표시 컴포넌트 완전 정복](/posts/nexacro-n-imageviewer-picture/)

**다음 글:** [Nexacro N Plot — 차트 컴포넌트 완전 정복](/posts/nexacro-n-plot-charts/)

<br>
읽어주셔서 감사합니다. 😊
