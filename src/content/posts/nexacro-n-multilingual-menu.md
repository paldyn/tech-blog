---
title: "[Nexacro N] 다국어 메뉴 구성"
description: "Nexacro N에서 언어별 Dataset을 활용해 메뉴 이름을 런타임에 교체하는 다국어 메뉴 패턴, 언어 선택 Combo 연동, 전역 application 객체 저장 전략을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "다국어", "i18n", "메뉴", "Dataset", "언어전환"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-permission-menu/)에서 역할(Role)별 메뉴 권한을 Dataset 필터로 제어하는 방법을 살펴보았다. 글로벌 서비스나 다국어 지원이 필요한 업무 시스템에서는 같은 메뉴 트리를 사용자가 선택한 언어로 즉시 전환할 수 있어야 한다. 이 글은 Nexacro N에서 다국어 메뉴를 구현하는 실무 패턴을 다룬다.

## 다국어 메뉴의 핵심 아이디어

Nexacro N의 Menu 컴포넌트는 Dataset에 바인딩된 컬럼 값을 메뉴 텍스트로 표시한다. 다국어 전환은 이 컬럼 값(MENU_NM)을 언어 Dataset에서 가져온 번역 값으로 교체하고, Dataset 변경을 Menu가 감지해 자동 렌더링하는 원리다. 별도의 UI 재구성 없이 Dataset 조작만으로 즉각 전환된다.

![다국어 메뉴 구조](/assets/posts/nexacro-n-multilingual-menu-structure.svg)

## 언어 Dataset 설계

언어 Dataset(`dsLang`)은 다음 구조로 설계한다.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| KEY | STRING | 메뉴 식별자 (dsMenu.MENU_KEY와 동일) |
| KO | STRING | 한국어 텍스트 |
| EN | STRING | 영어 텍스트 |
| JA | STRING | 일본어 텍스트 |
| ZH | STRING | 중국어 텍스트 |

언어 Dataset은 서버에서 트랜잭션으로 받거나, 정적 XML 파일로 번들링해 `loadXML()`로 로드한다. 자주 바뀌지 않는 메뉴 텍스트는 정적 XML 번들이 초기 로딩 성능에 유리하다.

```xml
<!-- /res/lang/menu_lang.xml -->
<Root>
  <Parameters>
    <Parameter id="KEY" type="STRING"/>
    <Parameter id="KO"  type="STRING"/>
    <Parameter id="EN"  type="STRING"/>
  </Parameters>
  <Rows>
    <Row>
      <Col id="KEY">MNU_001</Col>
      <Col id="KO">홈</Col>
      <Col id="EN">Home</Col>
    </Row>
    <Row>
      <Col id="KEY">MNU_002</Col>
      <Col id="KO">공지사항</Col>
      <Col id="EN">Notice</Col>
    </Row>
  </Rows>
</Root>
```

## 메뉴 Dataset과 언어 Dataset 연결

메뉴 Dataset(`dsMenu`)의 `MENU_KEY`를 기준으로 언어 Dataset을 조인해 `MENU_NM`을 갱신한다.

```javascript
function fn_applyLang(sLang) {
    var nCnt = this.dsMenu.rowcount;
    for (var i = 0; i < nCnt; i++) {
        var sKey    = this.dsMenu.getColumn(i, "MENU_KEY");
        var nRow    = this.dsLang.findRow("KEY", sKey);
        if (nRow >= 0) {
            this.dsMenu.setColumn(i, "MENU_NM",
                this.dsLang.getColumn(nRow, sLang));
        }
    }
    application["lang"] = sLang;
}
```

`setColumn()`으로 Dataset 값을 변경하면 Menu 컴포넌트가 바인딩 감지 후 자동으로 재렌더링한다. `application["lang"]`에 현재 언어를 저장해 다른 Form에서도 참조할 수 있도록 한다.

![다국어 적용 스크립트](/assets/posts/nexacro-n-multilingual-menu-code.svg)

## 언어 선택 Combo 연동

Frame Form에 언어 선택 Combo를 배치하고 `onitemchanged` 이벤트에서 `fn_applyLang()`을 호출한다.

```javascript
// cboLang :: onitemchanged
function cboLang_onitemchanged(obj, e) {
    var sLang = obj.value;  // "KO", "EN", "JA"
    this.fn_applyLang(sLang);
}
```

Combo의 Dataset은 지원 언어 목록(`dsLangList`)으로 구성한다.

```
LANG_CD | LANG_NM
KO      | 한국어
EN      | English
JA      | 日本語
ZH      | 中文
```

## 초기 언어 설정

Application Frame의 `onload`에서 사용자 프로파일이나 브라우저 언어(`navigator.language`)를 참고해 초기 언어를 결정한다.

```javascript
function Frame_onload(obj, e) {
    var sDefault = application["userLang"] || "KO";
    this.cboLang.value = sDefault;
    this.fn_applyLang(sDefault);
}
```

로그인 트랜잭션 응답에 `LANG_CD`가 포함된다면, 로그인 완료 후 `application["lang"]`에 저장하고 Frame에 전달하는 방식이 가장 자연스럽다.

## 자식 Form에서 언어 유지

팝업이나 자식 Form이 열릴 때 현재 언어를 유지하려면, Form의 `onload`에서 부모가 저장한 `application["lang"]`을 읽어 같은 함수를 실행한다.

```javascript
function Form_onload(obj, e) {
    var sLang = application["lang"] || "KO";
    this.fn_applyLang(sLang);
}
```

공통 BaseForm에 `fn_applyLang()`을 정의해두면 모든 자식 Form이 상속받아 별도 구현 없이 활용할 수 있다.

## 정리

다국어 메뉴 구현의 핵심은 **메뉴 Dataset의 텍스트 컬럼을 언어 Dataset으로 교체**하는 단순한 Dataset 조작이다. Menu 컴포넌트는 바인딩된 Dataset 변경을 자동 감지하므로 UI 재생성 없이 즉각 전환된다. `application` 전역 객체로 언어 상태를 공유하면 Form 간 일관성을 유지할 수 있다.

---

**지난 글:** [권한 기반 메뉴](/posts/nexacro-n-permission-menu/)

**다음 글:** [Tab Frame 구성](/posts/nexacro-n-tab-frame/)

<br>
읽어주셔서 감사합니다. 😊
