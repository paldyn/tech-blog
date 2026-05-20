---
title: "[Nexacro N] v24 주요 변경 사항 총정리"
description: "Nexacro N v24 버전의 주요 변경 사항을 정리합니다. 성능 개선, API 변경, 컴포넌트 업데이트, 호환성 정책까지 v24 업그레이드 시 반드시 알아야 할 내용을 코드 예시와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 9
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "v24", "버전변경", "API변경", "업그레이드", "호환성"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-migration-platform-to-n/)에서 Nexacro Platform에서 N으로 마이그레이션하는 전략을 살펴보았다. 이번에는 Nexacro N 내부에서 버전이 올라갈 때, 특히 v24 메이저 업데이트에서 무엇이 바뀌었는지 구체적으로 정리한다. 버전 업그레이드는 "그냥 파일 교체"로 끝나지 않는다. API가 변경되거나 동작 방식이 달라진 부분이 있으면 기존 코드가 의도하지 않게 동작한다. v24 변경 사항을 미리 파악하면 업그레이드 전에 영향 범위를 알 수 있다.

## v24 변경 사항 개요

v24는 네 가지 영역에서 변화가 있었다.

![v24 주요 변경 사항](/assets/posts/nexacro-n-migration-v24-changes-map.svg)

1. **성능 개선**: 렌더링 엔진 최적화, 대용량 Dataset 처리 개선
2. **API 변경**: 일부 메서드명 변경 및 신규 API 추가
3. **컴포넌트 변경**: Grid 가상화 기본 적용, Calendar/MaskEdit 개선
4. **호환성 정책**: IE11 지원 공식 종료, Edge/Chrome 최적화

## 성능 개선 사항

**렌더링 엔진 최적화**

v24에서 폼 초기 렌더링이 평균 30~40% 빨라졌다. 컴포넌트가 많은 복잡한 폼에서 효과가 더 크다. 별도 코드 변경 없이 런타임 업그레이드만으로 혜택을 받는다.

**대용량 Dataset 처리**

Dataset에 10만 건 이상의 데이터를 다룰 때 메모리 사용량과 처리 속도가 개선되었다.

```javascript
// v24에서는 대용량 Dataset 처리 시 진행률을 알 수 있음
var ds = this.ds_large;

// 신규: loadProgress 이벤트 활용
ds.addEventHandler("onloadprogress", function(obj, e) {
  var nPct = Math.floor((e.loaded / e.total) * 100);
  this.stcProgress.set_text(nPct + "% 로딩 중...");
}, this);

ds.load("large-data.csv");
```

**Grid 가상 스크롤 기본 적용**

v23까지 옵션이었던 Grid 가상 스크롤이 v24부터 기본값으로 변경되었다. 대용량 데이터에서 그리드가 훨씬 빠르게 반응한다.

```xml
<!-- v23: 가상 스크롤 옵션으로 활성화 -->
<Grid id="grd_list" virtualscroll="true" .../>

<!-- v24: 기본 활성화 (설정 불필요)
         비활성화하려면 명시적으로 false 설정 -->
<Grid id="grd_list" virtualscroll="false" .../>
```

## API 변경 사항

v24에서 바뀐 주요 메서드와 대응 코드를 정리한다.

![v24 API 변경 코드](/assets/posts/nexacro-n-migration-v24-changes-code.svg)

### setURL → setServiceURL

서비스 URL을 런타임에 동적으로 변경할 때 사용하는 메서드가 바뀌었다.

```javascript
// v23 이하 — 폐기 (v24에서도 동작하지만 경고 출력)
this.setURL("SVC", "http://new-server/nexacro/");

// v24 이상 — 권장
this.setServiceURL("SVC", "http://new-server/nexacro/");
```

### getFormRef → getForm

폼 참조를 가져오는 메서드명이 변경되었다.

```javascript
// v23 이하
var oForm = this.getFormRef("frmOrder");

// v24 이상
var oForm = this.getForm("frmOrder");
```

### createComponent → addChild

동적으로 컴포넌트를 생성하는 방식이 변경되었다. v24부터 `createComponent`는 폐기 예정으로 분류된다.

```javascript
// v23 이하
var oBtn = this.createComponent("Button", "btnNew");
oBtn.set_text("신규");
this.divMain.addChild(oBtn);

// v24 이상 — addChild에서 직접 생성
var oBtn = new Button("btnNew", {text: "신규"});
this.divMain.addChild("btnNew", oBtn);
oBtn.show();
```

### transaction 콜백 개선

v24에서 Transaction 콜백에 상세 오류 정보가 추가되었다.

```javascript
// v24 콜백 — 추가된 errCode 활용
function cbSearch(sId, nErrorCode, sErrorMsg, oRequest) {
  if (nErrorCode !== 0) {
    // v24: 오류 코드 기반 상세 처리
    switch (nErrorCode) {
      case -1:  // 네트워크 오류
        gfn_alert("네트워크 오류입니다. 재시도해 주세요.");
        break;
      case 401: // 인증 오류
        gfn_alert("세션이 만료되었습니다. 재로그인해 주세요.");
        this.gfn_logout();
        break;
      default:
        gfn_alert(sErrorMsg);
    }
    return;
  }
  // 정상 처리
}
```

## 컴포넌트 변경

**MaskEdit 정규식 지원 강화**

v24에서 MaskEdit의 마스크 패턴에 정규식 스타일 검증을 추가할 수 있다.

```javascript
// v24 MaskEdit — 정규식 검증 추가
var oMask = this.edtPhone;
oMask.set_mask("999-9999-9999");

// v24 신규: 입력 완료 시 추가 검증
function edtPhone_onvalidate(obj, e) {
  var sVal = obj.getValue();
  // 010 또는 02 시작 검증
  if (!/^(010|02|0[3-9]\d)/.test(sVal)) {
    return "올바른 전화번호 형식이 아닙니다.";
  }
  return true;
}
```

**Calendar 주말/공휴일 표시 개선**

```javascript
// v24 Calendar — 공휴일 배열 직접 지정
var oCal = this.calPicker;

// 공휴일 배열 설정 (YYYYMMDD 형식)
oCal.set_holidayArray([
  "20260301",  // 삼일절
  "20260505",  // 어린이날
  "20260815",  // 광복절
]);

// 공휴일 텍스트 색 지정
oCal.set_holidayColor("#e05555");
```

## 호환성 정책 변경

**IE11 지원 공식 종료**

v24부터 IE11 지원이 공식적으로 종료되었다. IE11 사용자를 위한 안내 페이지를 준비한다.

```html
<!-- index.html — IE 감지 및 안내 -->
<!--[if IE]>
<div style="padding:20px; background:#fff3cd; color:#333;">
  <h2>브라우저 업그레이드가 필요합니다</h2>
  <p>이 시스템은 Internet Explorer를 더 이상 지원하지 않습니다.</p>
  <p>Microsoft Edge, Chrome, Firefox 등 최신 브라우저를 사용해 주세요.</p>
</div>
<![endif]-->
```

**Edge/Chrome 성능 최적화**

v24에서 Chrome 120+, Edge 120+에 대한 최적화가 추가되었다. 최신 브라우저 사용자는 자동으로 더 나은 성능을 경험한다.

## v24 업그레이드 체크리스트

```javascript
// scripts/v24-check.js
// v24 업그레이드 전 자동 점검

const DEPRECATED_IN_V24 = [
  { pattern: /\.setURL\s*\(/g,          msg: "setURL → setServiceURL" },
  { pattern: /\.getFormRef\s*\(/g,      msg: "getFormRef → getForm" },
  { pattern: /\.createComponent\s*\(/g, msg: "createComponent → addChild" },
  { pattern: /virtualscroll="true"/g,   msg: "Grid virtualscroll: v24 기본값" },
];

// 점검 스크립트 실행 후
// 발견된 항목을 우선순위별로 교체
```

```
v24 업그레이드 체크리스트

코드 점검
□ setURL → setServiceURL 교체
□ getFormRef → getForm 교체
□ createComponent → addChild 교체
□ Grid virtualscroll 속성 검토

컴포넌트 검토
□ MaskEdit 동작 변경 없는지 확인
□ Calendar 공휴일 설정 방식 확인
□ Grid 가상 스크롤 동작 검증

브라우저 정책
□ IE11 접속 안내 페이지 준비
□ Edge/Chrome 버전 정책 수립

테스트
□ 핵심 화면 50개 동작 확인
□ 대용량 Dataset 조회 성능 비교
□ 트랜잭션 오류 처리 동작 검증
```

## 정리

v24는 주로 성능 개선과 API 정리가 핵심이다. 코드를 많이 바꿀 필요 없이 런타임 파일 교체만으로도 성능 혜택을 얻을 수 있다. 다만 `setURL`, `getFormRef`, `createComponent` 같은 폐기 API는 v24에서도 경고만 출력하며 동작하지만, 다음 메이저 버전에서 완전히 제거될 수 있으므로 미리 교체해 두는 것이 좋다. 자동화 점검 스크립트로 영향 범위를 파악하고, 스테이징에서 충분히 검증한 뒤 운영에 적용한다.

---

**지난 글:** [\[Nexacro N\] Nexacro Platform에서 N으로 마이그레이션](/posts/nexacro-n-migration-platform-to-n/)

**다음 글:** [\[Nexacro N\] 레거시 컴포넌트 교체 전략](/posts/nexacro-n-legacy-component-replace/)

<br>
읽어주셔서 감사합니다. 😊
