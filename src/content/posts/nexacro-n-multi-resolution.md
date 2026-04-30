---
title: "[Nexacro N] 다중 해상도 지원 — DPI·해상도별 화면 최적화 전략"
description: "Nexacro N에서 FHD·QHD·4K 등 다양한 해상도와 DPI 스케일 환경에 대응하는 방법 — Environment.xml 설정, pixelper/autosize, 고해상도 이미지 분기, 폰트 보정 — 을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-30"
archiveOrder: 10
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "해상도", "DPI", "4K", "QHD", "pixelper", "autosize", "고해상도", "멀티해상도"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-responsive-layout/)에서 폼 크기 변화에 반응하는 레이아웃 전략을 살펴봤습니다. 반응형 레이아웃이 폼의 너비·높이 변화를 다룬다면, 다중 해상도 지원은 한 단계 더 나아가 **디바이스의 물리 픽셀 밀도(DPI)**에 따라 화면이 흐릿해지거나 너무 작게 보이는 문제를 해결합니다. 고해상도 모니터가 보편화된 현재, 엔터프라이즈 웹 앱에서도 이 대응이 필요한 경우가 늘고 있습니다.

## 해상도와 DPI의 관계

현대 모니터는 물리 픽셀(Physical Pixel)과 논리 픽셀(CSS Pixel)이 다릅니다. 4K 모니터(3840×2160)에 Windows DPI Scale 200% 설정이 적용되면 운영체제는 논리 픽셀을 1920×1080으로 보고하고, 각 논리 픽셀이 물리 픽셀 4개(2×2)에 렌더링됩니다. 이 비율이 `devicePixelRatio` (DPR)입니다.

Nexacro N 앱이 DPR을 고려하지 않고 1920×1080 기준으로만 만들어지면:
- **4K에서 작게 보임**: 논리 픽셀 공간이 1920×1080이라 화면이 작아집니다.
- **이미지 흐릿함**: 1x 해상도 이미지가 2x 공간에 확대되어 흐릿합니다.
- **폰트 미세 문제**: DPI 스케일에 따라 폰트가 흐릿하게 렌더링될 수 있습니다.

## Environment.xml — pixelper와 autosize

Nexacro N에서 해상도 관련 가장 중요한 설정은 `Environment.xml`의 `Nexacro` 태그입니다.

```xml
<!-- Environment.xml — 해상도 설정 -->
<Nexacro
  pixelper="1.0"
  autosize="false"
  autosizetype="ratio"
  designwidth="1920"
  designheight="1080"
/>
```

주요 속성:

| 속성 | 값 | 설명 |
|------|-----|------|
| `pixelper` | 숫자 | DPI 스케일 비율. 1.5이면 1.5배 스케일로 렌더링 |
| `autosize` | true/false | true이면 브라우저 창 크기에 맞게 앱을 자동 확대/축소 |
| `autosizetype` | ratio / fill | ratio: 비율 유지 확대, fill: 화면 가득 채우기 |
| `designwidth` | 숫자 | 기준 설계 너비 (autosize 기준점) |
| `designheight` | 숫자 | 기준 설계 높이 |

QHD(2560×1440)에서 DPI Scale 150% 환경이라면:

```xml
<Nexacro
  pixelper="1.5"
  autosize="true"
  autosizetype="ratio"
  designwidth="1920"
  designheight="1080"
/>
```

`autosize="true" autosizetype="ratio"`는 `designwidth × designheight` 비율을 유지하면서 현재 브라우저 창에 맞게 전체 앱을 확대/축소합니다. 이 설정 하나로 대부분의 해상도 문제가 해결됩니다.

![다중 해상도·DPI 지원 전략](/assets/posts/nexacro-n-multi-resolution-dpi.svg)

## devicePixelRatio 감지

스크립트에서 현재 DPR을 직접 감지해 분기 처리할 수 있습니다.

```javascript
// App.js — 앱 시작 시 DPI 감지
function Application_onload(obj, e) {
    // devicePixelRatio: 브라우저가 제공하는 물리/논리 픽셀 비율
    var dpr = window.devicePixelRatio || 1;
    obj.gv_dpr        = dpr;
    obj.gv_imgSuffix  = (dpr >= 2) ? "@2x" : "";
    obj.gv_isHiDpi    = (dpr >= 1.5);

    // 초기 레이아웃 적용
    this.fn_initLayout();
}
```

`window.devicePixelRatio`는 Chrome, Edge, Firefox에서 모두 지원됩니다. 1.0이면 일반, 1.5이면 QHD 150%, 2.0이면 4K 200% 환경입니다.

## 고해상도 이미지(@2x) 분기

로고, 아이콘처럼 선명하게 보여야 하는 이미지는 1x와 2x 두 버전을 준비하고 DPR에 따라 분기합니다.

```
res/images/
├── logo.png       ← 1x (96×32)
├── logo@2x.png    ← 2x (192×64)
├── icon-save.png
└── icon-save@2x.png
```

```javascript
// 공통 라이브러리 함수
function gfn_getImgSrc(sName) {
    var sfx = nexacro.getApplication().gv_imgSuffix;
    return "res/images/" + sName + sfx + ".png";
}

// Form 스크립트에서 사용
function Form_onload(obj, e) {
    this.imgLogo.set_src(gfn_getImgSrc("logo"));
    this.imgSave.set_src(gfn_getImgSrc("icon-save"));
}
```

이미지 컴포넌트의 `width`·`height`는 항상 논리 픽셀 기준(1x 크기)으로 지정합니다. 2x 이미지를 같은 논리 픽셀 크기에 담으면 고해상도에서 선명하게 보입니다.

## 폰트 크기 보정

Nexacro N의 `style` 속성 폰트 크기는 논리 픽셀 기준입니다. DPR이 2.0인 환경에서 `font-size:14px`는 물리 픽셀 28px에 렌더링되므로 원래 의도대로 보이지 않을 수 있습니다.

```javascript
// DPR에 따른 폰트 크기 보정
function fn_getFontSize(nBase) {
    var dpr = nexacro.getApplication().gv_dpr;
    // DPR 2.0이면 기준 폰트를 절반으로 — 논리 픽셀에서 동일하게 보임
    return Math.round(nBase / dpr);
}

// 사용 예
function Form_onload(obj, e) {
    var fs = fn_getFontSize(14);
    this.stcTitle.set_style("font-size:" + fs + "px; font-weight:bold;");
}
```

단, `pixelper` + `autosize="ratio"`로 전체 앱을 스케일링하면 폰트도 함께 확대되므로 별도 보정이 불필요할 수 있습니다. 두 접근을 혼용하면 오히려 복잡해집니다. **전체 autosize** 방식과 **개별 DPR 보정** 방식 중 하나를 팀 표준으로 정해야 합니다.

![다중 해상도 대응 코드](/assets/posts/nexacro-n-multi-resolution-code.svg)

## 해상도별 레이아웃 전환

고해상도 모니터에서는 단순히 크기 문제가 아니라, 더 넓은 화면에서 더 많은 정보를 보여줄 수 있습니다. 해상도 기반으로 레이아웃 자체를 전환하는 패턴입니다.

```javascript
// 해상도별 레이아웃 모드 결정
function fn_determineLayout() {
    var app = nexacro.getApplication();
    var screenW = screen.width;
    var screenH = screen.height;

    if (screenW >= 3840) {
        app.gv_layoutMode = "4k";
    } else if (screenW >= 2560) {
        app.gv_layoutMode = "qhd";
    } else {
        app.gv_layoutMode = "fhd"; // 기본
    }
}

// MainFrame.xfdl 에서 레이아웃 모드 적용
function MainFrame_onload(obj, e) {
    fn_determineLayout();

    var mode = nexacro.getApplication().gv_layoutMode;
    if (mode === "4k") {
        // 4K: 더 넓은 사이드바, 더 큰 폰트
        this.divNav.resize(280, this.height);
        this.cfContent.move(280, 60);
    } else {
        // FHD 기본 레이아웃
        this.divNav.resize(200, this.height);
        this.cfContent.move(200, 60);
    }
}
```

## 권장 대응 수준

| 환경 | 권장 대응 |
|------|-----------|
| FHD 1920×1080 (DPI 100%) | 기본 설계, 추가 설정 불필요 |
| QHD 2560×1440 (DPI 125~150%) | `pixelper="1.25"` + `autosize="true"` |
| 4K 3840×2160 (DPI 200%) | `pixelper="2.0"` + @2x 이미지 + `autosize="true"` |
| 태블릿 1366×768 | autosize + 브레이크포인트 조합 |

이번 글로 Nexacro N의 Form 타입, 화면 계층, 생명주기, 상속·Include, 레이아웃, Container, Anchor/Margin/Padding, 반응형, 다중 해상도 대응까지 화면 구성의 핵심 축을 모두 다뤘습니다. 다음 시리즈에서는 Div를 이용한 그루핑 기법과 컴포넌트 카탈로그로 이어집니다.

---

**지난 글:** [반응형 레이아웃 — 화면 크기 변화에 유연하게 대응하기](/posts/nexacro-n-responsive-layout/)

**다음 글:** [Div 그루핑 — 복잡한 화면을 논리 단위로 묶는 방법](/posts/nexacro-n-div-grouping/)

<br>
읽어주셔서 감사합니다. 😊
