---
title: "[Nexacro N] 언어 전환"
description: "Nexacro N 애플리케이션에서 런타임 중 언어를 전환하는 방법을 설명합니다. nexacro.setLanguage() API, 공통 gfn_setLanguage() 패턴, UI 전환 방식(Combo/버튼/자동감지), 세션 간 언어 설정 유지 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 5
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "언어전환", "setLanguage", "i18n", "다국어", "세션", "국제화"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-component-text-mapping/)에서 컴포넌트 텍스트 매핑 방법을 살펴보았다. 이번에는 앱이 실행 중인 상태에서 언어를 실시간으로 바꾸는 언어 전환 구현을 다룬다. 단순히 `nexacro.setLanguage()`를 호출하는 것 이상으로, 코드 Dataset 재조회·그리드 헤더 갱신·세션 유지까지 함께 처리해야 완성된 언어 전환이 된다.

## nexacro.setLanguage() API

Nexacro N이 제공하는 `nexacro.setLanguage()` API는 앱 전체의 현재 언어를 즉시 변경한다. 이 호출 이후 `$접두사`를 사용하는 컴포넌트들은 자동으로 새 언어 텍스트로 갱신된다.

```javascript
// 기본 사용법
nexacro.setLanguage("en");  // 영어로 전환
nexacro.setLanguage("ko");  // 한국어로 전환
nexacro.setLanguage("jp");  // 일본어로 전환

// 현재 언어 조회
var sCurrentLang = nexacro.getCurrentLanguage(); // "ko" | "en" | "jp"
```

하지만 `nexacro.setLanguage()`만 호출하면 XML 리소스 기반 컴포넌트 텍스트만 바뀐다. DB에서 조회한 코드값·메뉴·그리드 헤더는 별도로 처리해야 한다.

![언어 전환 흐름](/assets/posts/nexacro-n-language-switching-flow.svg)

## 공통 언어 전환 함수

프로젝트 전체에서 일관된 언어 전환을 보장하려면 공통 함수 하나에 모든 처리를 집중시킨다.

```javascript
// CommonLib/i18n.xjs
var gv_lang = "ko"; // 전역 현재 언어

function gfn_setLanguage(sLang) {
  if (gv_lang === sLang) return; // 동일 언어면 무시

  // 1. Nexacro 내장 API로 리소스 교체
  nexacro.setLanguage(sLang);
  gv_lang = sLang;

  // 2. 쿠키에 선택 언어 저장
  gfn_setCookie("NEXACRO_LANG", sLang, 365);

  // 3. DB 기반 코드·메시지 재조회
  gfn_reloadLangDatasets(sLang);

  // 4. 열려 있는 모든 Form의 그리드 헤더 갱신
  gfn_refreshAllGridHeaders();
}

function gfn_reloadLangDatasets(sLang) {
  // 공통 코드 재조회 (성별, 상태, 부서 등)
  application.commonDS.transaction(
    "reloadCodeData",
    "svc://CodeService/getAll",
    "",
    "ds_code=ds_code",
    "lang=" + sLang,
    ""
  );
}
```

## UI 언어 전환 패턴

언어 전환 UI는 서비스 규모와 지원 언어 수에 따라 선택한다.

![언어 전환 UI 패턴 & 세션 유지](/assets/posts/nexacro-n-language-switching-ui.svg)

### Combo 방식

지원 언어가 많거나 추가 가능성이 있을 때 적합하다.

```javascript
// 언어 선택 Combo 초기화
function fn_initLangCombo() {
  var ds = this.ds_langList;
  ds.clearData();

  var langs = [
    { cd: "ko", nm: "한국어" },
    { cd: "en", nm: "English" },
    { cd: "jp", nm: "日本語" }
  ];

  for (var i = 0; i < langs.length; i++) {
    var r = ds.addRow();
    ds.setColumn(r, "CD",   langs[i].cd);
    ds.setColumn(r, "CDNM", langs[i].nm);
  }

  // 현재 언어로 초기 선택
  this.cmb_lang.set_value(nexacro.getCurrentLanguage());
}

// Combo 값 변경 이벤트
function cmb_lang_onitemchanged(obj, e) {
  gfn_setLanguage(e.postvalue);
}
```

### 버튼 토글 방식

한국어/영어 두 가지만 지원할 때 직관적이다.

```javascript
function btn_ko_onclick(obj, e) {
  gfn_setLanguage("ko");
  this.btn_ko.set_cssclass("btn_lang_active");
  this.btn_en.set_cssclass("btn_lang_normal");
}

function btn_en_onclick(obj, e) {
  gfn_setLanguage("en");
  this.btn_ko.set_cssclass("btn_lang_normal");
  this.btn_en.set_cssclass("btn_lang_active");
}
```

## 세션 간 언어 설정 유지

사용자가 선택한 언어를 다음 로그인에도 유지하려면 쿠키 또는 서버 DB에 저장해야 한다.

### 쿠키 기반 유지

```javascript
// 쿠키에 저장
function gfn_setCookie(name, value, days) {
  var d = new Date();
  d.setTime(d.getTime() + (days * 86400000));
  document.cookie = name + "=" + value +
    ";expires=" + d.toUTCString() + ";path=/";
}

// 앱 시작 시 쿠키에서 언어 복원
function gfn_restoreLanguage() {
  var savedLang = gfn_getCookie("NEXACRO_LANG");
  if (savedLang) {
    nexacro.setLanguage(savedLang);
    gv_lang = savedLang;
  }
}
```

### 서버 사용자 프로필 기반 유지

로그인 사용자별로 선호 언어를 DB에 저장하는 방식이다. 장치나 브라우저가 바뀌어도 설정이 유지된다.

```javascript
// 로그인 후 사용자 프로필에서 언어 복원
function fn_loginCallback(sId, nErrCode, sErrMsg) {
  if (nErrCode == 0) {
    var sLang = this.ds_session.getColumn(0, "PREF_LANG") || "ko";
    nexacro.setLanguage(sLang);
    gv_lang = sLang;
    fn_initLangCombo(); // Combo 초기 선택값 동기화
  }
}

// 언어 변경 시 서버에도 저장
function gfn_setLanguage(sLang) {
  nexacro.setLanguage(sLang);
  gv_lang = sLang;

  // 서버에 언어 설정 저장
  this.transaction(
    "saveLangPref",
    "svc://UserService/saveLangPref",
    "",
    "",
    "lang=" + sLang,
    ""
  );
}
```

## 언어 전환 시 주의 사항

**1. 화면 레이아웃 변화 대비**

언어에 따라 텍스트 길이가 달라져 버튼이나 레이블이 잘릴 수 있다. 버튼 `width`를 고정 크기 대신 `autosize` 속성을 활용하거나, 가장 긴 언어 기준으로 여유 공간을 확보한다.

**2. 전환 후 현재 폼 상태 보존**

언어 전환 중에 그리드에 미저장 데이터가 있을 경우, 전환 전에 저장 확인 다이얼로그를 표시한다.

```javascript
function gfn_setLanguage(sLang) {
  if (gfn_hasUnsavedData()) {
    var bContinue = this.gfn_confirm(gfn_getText("MSG_LANG_CHANGE_CONFIRM"));
    if (!bContinue) return;
  }
  nexacro.setLanguage(sLang);
  // ...
}
```

**3. 자동 감지 초기화**

첫 방문 시 브라우저 언어를 기반으로 기본 언어를 설정한다.

```javascript
function gfn_detectAndSetLanguage() {
  // 저장 언어 확인
  var saved = gfn_getCookie("NEXACRO_LANG");
  if (saved) {
    nexacro.setLanguage(saved);
    return;
  }

  // 브라우저 언어 감지
  var browserLang = (navigator.language || "ko").substring(0, 2);
  var supported = ["ko", "en", "jp"];
  var lang = supported.indexOf(browserLang) >= 0 ? browserLang : "ko";
  nexacro.setLanguage(lang);
}
```

언어 전환은 `nexacro.setLanguage()` 한 줄로 시작하지만, 실제 서비스 품질을 위해서는 DB 코드 재조회·그리드 헤더 갱신·세션 유지·레이아웃 대응까지 체계적으로 처리해야 한다. 공통 함수에 이 흐름을 모두 담아두면 각 화면에서는 단순히 `gfn_setLanguage()` 한 줄로 완전한 언어 전환을 구현할 수 있다.

---

**지난 글:** [컴포넌트 텍스트 매핑](/posts/nexacro-n-component-text-mapping/)

**다음 글:** [테마 시스템](/posts/nexacro-n-theme-system/)

<br>
읽어주셔서 감사합니다. 😊
