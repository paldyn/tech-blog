---
title: "[Nexacro N] 다국어(i18n) 개요"
description: "Nexacro N 애플리케이션의 다국어 처리(i18n) 구조를 설명합니다. XML 리소스 파일, TypeDefinition 언어 등록, DB 기반 다국어, gfn_getText()를 활용한 스크립트 메시지, 컴포넌트 텍스트 ID 바인딩 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "i18n", "다국어", "언어리소스", "gfn_getText", "TypeDefinition", "국제화"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-data-encryption/)에서 데이터 암호화를 살펴보았다. 이번에는 Nexacro N 애플리케이션에서 한국어·영어·일본어 등 여러 언어를 지원하는 다국어(i18n) 처리 구조를 살펴본다. 단순 텍스트 교체를 넘어 코드값·그리드 헤더·동적 메시지까지 일관된 다국어 체계가 필요하다.

## Nexacro N i18n 구조 개요

Nexacro N의 다국어 처리는 크게 세 가지 입력 소스를 갖는다.

- **XML 리소스 파일**: 빌드 시 포함. 공통 버튼·레이블 등 정적 텍스트
- **DB 기반 조회**: 런타임 조회. 코드 테이블·메뉴·동적 메시지
- **TypeDefinition 등록**: 언어 리소스를 앱에 연결하는 진입점

컴포넌트는 `text="$TEXT_ID"` 형식으로 텍스트 ID를 참조하고, 런타임에 현재 언어에 맞는 값으로 자동 교체된다.

![다국어 구조 개요](/assets/posts/nexacro-n-i18n-overview.svg)

## XML 언어 리소스 파일

가장 기본적인 방식이다. 언어별 XML 파일을 프로젝트에 포함한다.

```xml
<!-- resource/ko.xml -->
<resource lang="ko">
  <text id="SAVE">저장</text>
  <text id="SEARCH">조회</text>
  <text id="DELETE">삭제</text>
  <text id="CANCEL">취소</text>
  <text id="MSG_SAVE_OK">저장되었습니다.</text>
  <text id="MSG_CONFIRM_DELETE">삭제하시겠습니까?</text>
</resource>
```

```xml
<!-- resource/en.xml -->
<resource lang="en">
  <text id="SAVE">Save</text>
  <text id="SEARCH">Search</text>
  <text id="DELETE">Delete</text>
  <text id="CANCEL">Cancel</text>
  <text id="MSG_SAVE_OK">Saved successfully.</text>
  <text id="MSG_CONFIRM_DELETE">Are you sure to delete?</text>
</resource>
```

![언어 리소스 파일 구조](/assets/posts/nexacro-n-i18n-resource.svg)

## TypeDefinition에 언어 등록

`TypeDefinition.xadl`에서 언어 리소스를 앱에 연결한다.

```xml
<!-- TypeDefinition.xadl -->
<TypeDefinition>
  <Languages>
    <Language id="ko" default="true">
      <Resource src="resource/ko.xml"/>
    </Language>
    <Language id="en">
      <Resource src="resource/en.xml"/>
    </Language>
    <Language id="jp">
      <Resource src="resource/jp.xml"/>
    </Language>
  </Languages>
</TypeDefinition>
```

`default="true"`로 지정된 언어가 앱 시작 시 기본 언어로 적용된다.

## 컴포넌트 텍스트 ID 바인딩

컴포넌트의 `text` 속성에 `$` 접두사로 텍스트 ID를 지정하면 런타임에 자동 변환된다.

```xml
<!-- Form XFDL -->
<Button id="btn_save"   text="$SAVE"   width="80" height="30"/>
<Button id="btn_search" text="$SEARCH" width="80" height="30"/>
<Static id="lbl_name"   text="$LBL_USER_NAME"/>
```

런타임에 현재 언어가 `ko`이면 버튼에 "저장"이, `en`이면 "Save"가 표시된다.

## 스크립트에서 텍스트 조회

동적 메시지나 alert/confirm 대화상자 텍스트는 `gfn_getText()`로 조회한다.

```javascript
// CommonLib/i18n.xjs
function gfn_getText(sTextId) {
  return nexacro.getLanguageText(sTextId);
}

// 사용 예
function fn_save_confirm() {
  var sMsg = gfn_getText("MSG_CONFIRM_DELETE");
  this.gfn_confirm(sMsg, fn_doDelete);
}

function fn_saveCallback(sId, nErrCode, sErrMsg) {
  if (nErrCode == 0) {
    this.gfn_alert(gfn_getText("MSG_SAVE_OK"));
  } else {
    this.gfn_alert(sErrMsg);
  }
}
```

## DB 기반 다국어 처리

메뉴 이름, 코드 설명, 업무 메시지처럼 변경 빈도가 높은 텍스트는 DB에서 관리한다.

```javascript
// BaseForm.xfdl — 앱 초기화 시 다국어 Dataset 로드
function fn_loadLanguageData() {
  var sLang = nexacro.getCurrentLanguage(); // "ko" | "en"
  this.transaction(
    "getLanguageData",
    "svc://CommonService/getLanguageData",
    "ds_langParam=ds_langParam",
    "ds_langData=ds_langData",
    "lang=" + sLang,
    "fn_langCallback"
  );
}

function fn_langCallback(sId, nErrCode, sErrMsg) {
  if (nErrCode == 0) {
    // Dataset을 Map으로 변환해 전역 저장
    gv_langMap = gfn_datasetToMap(this.ds_langData, "MSG_ID", "MSG_TEXT");
  }
}

// 텍스트 조회 (XML fallback 포함)
function gfn_getMsg(sId) {
  if (gv_langMap && gv_langMap[sId]) {
    return gv_langMap[sId];
  }
  return gfn_getText(sId); // XML 리소스 fallback
}
```

## 그리드 헤더 다국어

그리드 헤더는 Format Editor에서 직접 텍스트 ID를 지정하거나, 스크립트로 동적 설정한다.

```javascript
// 그리드 헤더를 언어에 맞게 동적 설정
function fn_setGridHeader() {
  var grid = this.grd_user;
  grid.setColProperty(0, "header.text", gfn_getText("COL_USER_ID"));
  grid.setColProperty(1, "header.text", gfn_getText("COL_USER_NAME"));
  grid.setColProperty(2, "header.text", gfn_getText("COL_DEPT"));
}
```

Format XML에서 직접 ID를 쓰는 방식도 있다.

```xml
<!-- Grid Format XML -->
<Grid id="grd_user">
  <Formats>
    <Format id="default">
      <Columns>
        <Column size="100"/>
        <Column size="150"/>
      </Columns>
      <Rows>
        <Row size="24" band="head">
          <Cell text="$COL_USER_ID"/>
          <Cell text="$COL_USER_NAME"/>
        </Row>
      </Rows>
    </Format>
  </Formats>
</Grid>
```

## 코드 Dataset 다국어

공통 코드(성별, 상태코드 등)를 언어별로 다르게 표시할 때는 Dataset에 언어별 컬럼을 두거나 서버에서 언어에 맞는 값을 반환한다.

```javascript
// 서버에 현재 언어 파라미터 전달
this.transaction(
  "getCode",
  "svc://CodeService/getCode",
  "ds_codeParam=ds_codeParam",
  "ds_code=ds_code",
  "grpCd=GENDER&lang=" + nexacro.getCurrentLanguage(),
  "fn_codeCallback"
);
```

## i18n 설계 체크리스트

| 항목 | XML 방식 | DB 방식 |
|------|---------|---------|
| 버튼·레이블 등 정적 텍스트 | ✅ | |
| 공통 메시지 | ✅ | ✅ |
| 메뉴 이름 | | ✅ |
| 코드 설명 | | ✅ |
| 동적 메시지 | | ✅ |
| 수정 후 즉시 반영 | ❌ 재배포 필요 | ✅ |

프로젝트 규모가 클수록 XML과 DB를 병행해서 사용하는 하이브리드 방식을 권장한다. 공통 버튼·레이블은 XML로 빠르게 적용하고, 업무 메시지·코드값은 DB에서 관리해 배포 없이 변경할 수 있다.

---

**지난 글:** [데이터 암호화](/posts/nexacro-n-data-encryption/)

**다음 글:** [컴포넌트 텍스트 매핑](/posts/nexacro-n-component-text-mapping/)

<br>
읽어주셔서 감사합니다. 😊
