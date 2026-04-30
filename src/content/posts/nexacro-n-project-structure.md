---
title: "[Nexacro N] 프로젝트 구조 완전 해부 — 파일·폴더 역할 총정리"
description: "Nexacro Studio N으로 생성된 프로젝트의 디렉터리 구조와 핵심 파일(Application.xadl, TypeDef.xadl, .xfdl, .xjs)의 역할을 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 5
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "프로젝트구조", "xadl", "xfdl", "xjs", "Application"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-studio-shortcuts/)에서 Nexacro Studio N의 단축키를 익혔다면, 이제 그 Studio가 만들어내는 **프로젝트 구조**를 속속들이 이해해야 할 차례입니다. Nexacro N 프로젝트는 처음 보는 개발자에게 낯선 확장자(.xadl, .xfdl, .xjs)가 뒤섞여 있어 당황스럽게 느껴질 수 있습니다. 하지만 각 파일의 목적을 파악하고 나면, 그 구조가 의외로 명확한 설계 원칙 위에 서 있다는 것을 알 수 있습니다.

## 프로젝트 최상위 구조

Studio N에서 새 프로젝트를 생성하면 다음과 같은 폴더·파일이 자동으로 만들어집니다.

```
MyProject/
├── Application.xadl       ← 앱 진입점·전역 설정
├── TypeDef.xadl           ← 컴포넌트 타입 등록
├── Environment.xml        ← 서버 URL·프로토콜 설정
├── Service.xml            ← 트랜잭션 서비스 URL 매핑
├── Forms/                 ← 화면 Form (.xfdl)
│   ├── Main.xfdl
│   └── Sub/
│       └── Detail.xfdl
├── Variables/             ← 전역 변수 정의
├── Common/                ← 공통 스크립트 라이브러리
│   └── CommonLib.xjs
├── Images/                ← 이미지 리소스
└── Output/                ← 빌드 결과물 (배포용)
```

![Nexacro N 프로젝트 디렉터리 구조와 주요 파일 역할](/assets/posts/nexacro-n-project-structure-tree.svg)

폴더명은 팀 컨벤션에 따라 자유롭게 변경할 수 있지만, **루트 레벨의 xadl·xml 파일들은 Studio N이 인식하는 고정 이름**이므로 임의로 바꾸면 빌드가 깨집니다.

## Application.xadl — 프로젝트의 심장

`Application.xadl`은 Nexacro N 앱이 기동될 때 가장 먼저 로드되는 파일입니다. 여기서 설정하는 내용이 전체 앱의 뼈대가 됩니다.

```xml
<Application
  id="MyApplication"
  startupform="Forms::Main"
  enableskin="true"
  enableshortcut="true"
>
  <!-- 전역 Dataset: 어느 Form에서도 접근 가능 -->
  <Dataset id="ds_userInfo">
    <ColumnInfo>
      <Column id="userNm" type="STRING" size="50"/>
      <Column id="userId" type="STRING" size="20"/>
      <Column id="authCd" type="STRING" size="10"/>
    </ColumnInfo>
  </Dataset>

  <!-- 전역 Variable -->
  <Variable id="gv_menuId" type="STRING" value=""/>
</Application>
```

주요 속성의 의미를 정리하면 다음과 같습니다.

| 속성 | 설명 |
|------|------|
| `id` | 앱 식별자. `nexacro.getApplication()`으로 참조 |
| `startupform` | 앱 최초 실행 시 열리는 Form. `폴더::FormID` 형식 |
| `enableskin` | 테마/스킨(StyleSheet) 적용 여부 |
| `enableshortcut` | 전역 단축키 활성화 여부 |

전역 Dataset은 로그인 후 사용자 정보를 담아두는 `ds_userInfo`처럼 **앱 수명 동안 유지해야 하는 공유 데이터**를 담는 데 사용됩니다. Script에서는 `nexacro.getApplication().ds_userInfo`로 바로 접근할 수 있습니다.

![Application.xadl 주요 속성 해설](/assets/posts/nexacro-n-project-structure-xadl.svg)

## TypeDef.xadl — 컴포넌트 타입 등록

Nexacro N은 사용할 컴포넌트를 미리 `TypeDef.xadl`에 등록해야 런타임에서 인식합니다. Studio N이 자동으로 관리해 주지만, 커스텀 컴포넌트를 추가할 때는 직접 편집해야 합니다.

```xml
<TypeDef>
  <!-- 기본 컴포넌트 -->
  <Comp id="Button"
    classname="nexacro.Button"
    lazyload="true"/>
  <Comp id="Grid"
    classname="nexacro.Grid"
    lazyload="true"/>
  <!-- 커스텀 컴포넌트 등록 예시 -->
  <Comp id="MyDatePicker"
    classname="com.example.MyDatePicker"
    src="Common/MyDatePicker.js"/>
</TypeDef>
```

`lazyload="true"`로 설정된 컴포넌트는 해당 Form이 열릴 때 비로소 로드되므로, 초기 로딩 시간을 줄이는 데 효과적입니다.

## .xfdl — Form 정의 파일

`.xfdl` 파일은 화면 하나를 정의하는 핵심 파일로, **레이아웃(XML)과 Script(JavaScript 유사)가 하나의 파일** 안에 공존합니다.

```xml
<xadl:Form xmlns:xadl="http://www.tobesoft.com/2014/Nexacro"
  id="Main" width="1280" height="768">

  <xadl:Script type="javascript"><![CDATA[
    function Form_onload(obj, e) {
      // 폼 로드 시 실행
      this.fn_search();
    }

    function fn_search() {
      var sSvcId  = "searchList";
      var sInDs   = "";
      var sOutDs  = "ds_list=ds_list";
      this.transaction(sSvcId, sInDs, sOutDs,
        "fn_searchCallback");
    }

    function fn_searchCallback(svcId, errCode, errMsg) {
      if (errCode != 0) {
        alert(errMsg);
        return;
      }
    }
  ]]></xadl:Script>

  <xadl:Objects>
    <Grid id="grd_list" left="20" top="80"
          width="1240" height="600"
          binddataset="ds_list"/>
  </xadl:Objects>
</xadl:Form>
```

Script는 `<![CDATA[ ... ]]>` 블록 안에 작성하며, `this`는 현재 Form 객체를 가리킵니다. Form 내부의 컴포넌트는 `this.컴포넌트ID`로 직접 접근합니다.

## .xjs — 공통 Script 파일

`.xjs` 파일은 여러 Form에서 공유하는 함수를 담는 순수 Script 파일입니다. 레이아웃 정의 없이 Script만 포함하며, `Application.xadl`이나 각 Form에서 `include` 방식으로 불러 씁니다.

```javascript
// Common/CommonLib.xjs
// 날짜 포맷 변환 (YYYYMMDD → YYYY-MM-DD)
function fn_formatDate(sDate) {
  if (nexacro.isEmpty(sDate) || sDate.length != 8) return "";
  return sDate.substr(0, 4) + "-"
       + sDate.substr(4, 2) + "-"
       + sDate.substr(6, 2);
}

// 천단위 콤마 포맷
function fn_formatNumber(nVal) {
  if (nexacro.isEmpty(nVal)) return "0";
  return Number(nVal).toLocaleString();
}
```

공통 함수는 `.xjs`로 분리해 두면 Form별 Script 파일 크기를 줄이고, 변경 시 한 곳만 수정하면 됩니다.

## Variables 폴더 — 전역 변수 관리

전역 변수를 별도 `.xadl` 파일로 분리해 `Variables/` 폴더에서 관리하는 것이 일반적인 패턴입니다. 메뉴 ID, 현재 언어 코드, 사용자 권한 등 앱 전역에서 읽고 쓰는 값들을 여기에 모아 둡니다.

```xml
<!-- Variables/GlobalVars.xadl -->
<Variables>
  <Variable id="gv_langCd"   type="STRING" value="ko"/>
  <Variable id="gv_menuId"   type="STRING" value=""/>
  <Variable id="gv_authLevel" type="INT"   value="0"/>
</Variables>
```

## Output 폴더 — 빌드 산출물

Studio N에서 **빌드(Build)** 를 실행하면 `Output/` 폴더에 배포 가능한 HTML5 파일 셋이 생성됩니다. 이 폴더의 내용물만 웹 서버에 올리면 사용자가 브라우저로 접근할 수 있습니다.

```
Output/
├── index.html         ← 앱 진입 HTML
├── nexacro/           ← 넥사크로 런타임 라이브러리
├── app/               ← 컴파일된 앱 파일
│   ├── Application.js
│   └── Forms/
│       └── Main.js
└── resource/          ← 이미지·폰트 등 리소스
```

`Output/`은 Git에서 `.gitignore`로 제외하는 것이 일반적이며, CI/CD 파이프라인에서 빌드 후 배포 서버로 전송하는 방식을 사용합니다.

## 프로젝트 구조 설계 팁

실무에서는 업무 단위로 폴더를 나누는 것이 유지보수에 유리합니다.

```
Forms/
├── Login/          ← 로그인 관련
├── Main/           ← 메인 프레임
├── Sales/          ← 영업 업무
│   ├── Order/
│   └── Invoice/
└── Admin/          ← 관리자 화면
```

폴더 깊이는 3단계 이하로 유지하고, Form ID는 업무 접두어(`SCR_`, `POP_` 등)를 붙여 역할을 명시하면 대규모 프로젝트에서도 파일 탐색이 쉬워집니다.

---

**지난 글:** [[Nexacro N] Nexacro Studio N 단축키 완전 정복](/posts/nexacro-n-studio-shortcuts/)

**다음 글:** [[Nexacro N] Environment.xml 완전 해부 — 서버 연결·프로토콜·인코딩 설정](/posts/nexacro-n-environment-xml/)

<br>
읽어주셔서 감사합니다. 😊
