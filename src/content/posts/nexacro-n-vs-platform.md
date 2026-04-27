---
title: "[Nexacro N] Nexacro N vs Platform — 실질적 차이점"
description: "Nexacro Platform에서 N으로 전환할 때 무엇이 달라지는지, 어떤 코드를 그대로 쓸 수 있고 어디를 수정해야 하는지 현장 관점에서 비교합니다."
author: "PALDYN Team"
pubDate: "2026-04-27"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "nexacro-platform", "migration", "compatibility"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-architecture/)에 이어 이 글은 **Nexacro N 기준**으로 작성되었습니다.

[지난 글](/posts/nexacro-n-architecture/)에서 Nexacro N의 3-Tier 아키텍처와 Transaction 관리자가 어떻게 동작하는지를 살펴봤습니다. 이번 글에서는 많은 기업 현장에서 실제로 부딪히는 질문, "Platform에서 N으로 올리면 코드를 얼마나 고쳐야 하나?"에 집중적으로 답합니다. 두 버전이 공유하는 것과 달라진 것을 명확히 나눠서 정리합니다.

## 항목별 비교 한눈에 보기

![Nexacro Platform vs N 비교](/assets/posts/nexacro-n-vs-platform-comparison.svg)

가장 먼저 눈에 들어오는 차이는 **IE 지원 여부**입니다. Nexacro Platform은 IE11을 공식 지원했지만, N은 IE를 완전히 포기하고 Chrome·Edge·Firefox·Safari 기반의 모던 브라우저만 지원합니다. 국내 공공기관이나 금융권처럼 IE 의존도가 높은 조직에서는 이 한 가지 차이만으로도 N 전환이 선뜻 결정되지 않는 이유가 됩니다.

두 번째 중요한 변화는 **런타임 엔진의 완전 재설계**입니다. Platform의 HTML5 레이어는 IE 포함 레거시 브라우저를 지원하기 위해 수많은 폴리필과 조건 분기를 안고 있었습니다. N은 이 무게를 걷어내고 W3C 표준 API를 적극 활용한 신규 엔진으로 갈아탔습니다. 결과적으로 렌더링 성능이 향상되고 버그 유발 요소도 줄었습니다.

## 핵심 API는 그대로다

먼저 좋은 소식을 전합니다. **Nexacro의 핵심 비즈니스 API는 Platform과 N이 사실상 동일합니다.** 가장 자주 쓰이는 `transaction()`, Dataset 조작 메서드, Form 라이프사이클 이벤트는 버전이 달라져도 동일한 방식으로 동작합니다.

```javascript
// Platform에서 작성한 코드 — N에서 그대로 동작
function fn_search() {
    this.transaction(
        "search",
        "svc::EmpService.do",
        "input=ds_cond",
        "output=ds_emp",
        "",
        "fn_searchCallback"
    );
}

function fn_searchCallback(sId, nErrorCd, sErrorMsg) {
    if (nErrorCd < 0) {
        alert(sErrorMsg);
        return;
    }
    trace("조회 완료: " + this.ds_emp.rowcount + "건");
}
```

Dataset API도 마찬가지입니다.

```javascript
// 아래 Dataset 조작 코드는 Platform·N 모두에서 동일하게 동작
function fn_addEmp() {
    var nRow = this.ds_emp.addRow();

    this.ds_emp.setColumn(nRow, "EMP_NM", "홍길동");
    this.ds_emp.setColumn(nRow, "DEPT_CD", "10");
    this.ds_emp.setColumn(nRow, "HIRE_DT", "20260101");
}

function fn_deleteRow() {
    var nRow = this.grd_emp.currentrow;

    if (nRow < 0) {
        alert("삭제할 행을 선택하세요.");
        return;
    }
    this.ds_emp.deleteRow(nRow);
}
```

Form 라이프사이클도 동일합니다. `onload`, `oninit`, `ondestroy` 이벤트 구조와 `this`가 Form 인스턴스를 가리키는 컨텍스트 규칙은 그대로입니다.

## 달라진 부분: 무엇을 수정해야 하는가

![Platform → N 마이그레이션 체크포인트](/assets/posts/nexacro-n-vs-platform-migration.svg)

### 1. IE11 종속 코드 제거

Platform 코드베이스에 IE 전용 조건 분기나 ActiveX 객체 호출이 섞여 있다면 제거 또는 교체해야 합니다. 예를 들어 파일 다운로드를 `window.navigator.msSaveBlob()` 같은 IE 전용 API로 처리했다면, N에서는 표준 `<a download>` 패턴이나 Nexacro의 `FileDownload` 컴포넌트로 대체해야 합니다.

```javascript
// Platform 시절 IE 전용 파일 저장 코드 (N에서 동작 안 함)
// if (window.navigator && window.navigator.msSaveBlob) {
//     window.navigator.msSaveBlob(blob, fileName);
// }

// N에서는 Nexacro FileDownload 컴포넌트 또는 표준 방식 사용
function fn_download() {
    this.fd_file.saveFile(
        "svc::FileService.do",
        "FILE_ID=" + this.ds_sel.getColumn(0, "FILE_ID")
    );
}
```

### 2. deprecated 컴포넌트 교체

Platform에 존재했던 일부 컴포넌트는 N에서 지원이 중단됐습니다. 대표적으로 `XPSpreadsheet`는 Excel과 유사한 스프레드시트 컴포넌트였는데, N에서는 Grid 컴포넌트의 인라인 편집 기능으로 대체해야 합니다. `OCXControl` 같은 ActiveX 래퍼 컴포넌트도 N에서는 사용할 수 없습니다.

마이그레이션 전 프로젝트 안에서 deprecated 컴포넌트를 사용하는 XFDL 파일을 먼저 조사하는 것이 좋습니다. Studio N의 "Find in Files" 기능으로 컴포넌트 타입을 검색할 수 있습니다.

### 3. environment.xml과 TypeDef 재설정

N은 환경 설정 방식이 일부 변경됐습니다. Platform의 `environment.xml`을 N 프로젝트에 그대로 복사해서는 사용할 수 없고, Studio N에서 프로젝트를 새로 생성한 뒤 서비스 URL 매핑과 TypeDef 경로를 재설정해야 합니다.

```xml
<!-- environment.xml 주요 설정 (N 프로젝트 기준) -->
<environment>
    <!-- 서비스 URL 등록 -->
    <services>
        <service id="svc" url="http://localhost:8080/app/service/"/>
    </services>

    <!-- TypeDef 파일 경로 -->
    <typedefs>
        <typedef id="default" src="TypeDef/default.xadl"/>
    </typedefs>
</environment>
```

### 4. CSS·스타일 파일 재검증

N은 스타일 체계가 Platform과 다소 다릅니다. Platform에서 만든 `.xss` 스타일 파일을 그대로 가져오면 일부 속성이 무시되거나 렌더링이 어색해질 수 있습니다. 특히 테마 관련 스타일 클래스명과 `Appearance` 계층 구조가 N에서 재정리됐으므로, 스타일 파일은 N 프로젝트 기본 템플릿을 기준으로 재작성하거나 매핑 작업을 해야 합니다.

## 버전 확인: 내 프로젝트는 Platform인가 N인가

현장에서 종종 혼동되는 포인트입니다. 가장 빠른 확인 방법은 Studio에서 프로젝트를 열었을 때 상단 타이틀 바나 Help > About에 표시되는 버전 문자열을 보는 것입니다. `Nexacro N`이라고 명시되어 있거나 버전 번호가 `1.x` 또는 `V24`이면 N 계열입니다. `Nexacro Platform`이나 버전 번호가 `17.x`이면 Platform 계열입니다.

스크립트 코드에서도 `nexacro.version` 전역 변수로 확인할 수 있습니다.

```javascript
// 스크립트에서 런타임 버전 확인
function fn_checkVersion() {
    trace("Runtime version: " + nexacro.version);
    // 예: "NexacroN 1.0.0.3000" 또는 "NexacroPlatform 17.0.0.2200"
}
```

## 마이그레이션 전략: 점진적 접근이 현실적

수백 개의 화면을 가진 대규모 프로젝트를 한 번에 N으로 전환하기는 어렵습니다. 현실적인 접근은 **화면 단위로 점진적 마이그레이션**하는 것입니다.

가장 효과적인 순서는 다음과 같습니다.

**1단계 — 환경 구성**: N 프로젝트 생성, environment.xml 재설정, 공통 라이브러리 이식.

**2단계 — 공통 모듈 검증**: 공통 fn 파일들(`fn_common.js`, `fn_validation.js` 등)을 N 환경에서 실행해 보며 문제 없는지 확인. 대부분 그대로 동작합니다.

**3단계 — 화면별 순차 이식**: deprecated 컴포넌트를 사용하지 않는 단순 조회 화면부터 시작해 복잡한 입력 화면, 팝업, 첨부파일 화면 순서로 진행합니다.

```javascript
// 마이그레이션 과정에서 자주 쓰이는 버전 분기 패턴
// (임시로 사용하고 마이그레이션 완료 후 제거)
function fn_openFile(sFilePath) {
    var sVersion = nexacro.version.toLowerCase();

    if (sVersion.indexOf("platform") >= 0) {
        // Platform 방식
        this.ExternalLib.OpenFile(sFilePath);
    } else {
        // N 방식
        this.fd_viewer.set_src(sFilePath);
    }
}
```

## V24와의 관계

Nexacro N 안에서 한 번 더 구분되는 것이 **V24**입니다. V24는 Nexacro N의 최신 버전 라인으로, 기본 N과 동일한 아키텍처 위에서 UX 컴포넌트 추가, 성능 개선, 보안 강화가 이루어졌습니다. API 호환성이 높아 N 기준 코드는 V24에서도 대부분 그대로 동작합니다.

신규 프로젝트라면 V24를 선택하는 것이 유리하고, 기존 N 프로젝트를 V24로 올리는 것은 major 업그레이드 없이 진행할 수 있는 경우가 많습니다.

## 정리

Nexacro N은 Platform에서 파생된 다음 세대이지만, **비즈니스 로직을 담당하는 핵심 API는 놀라울 정도로 그대로 유지**됩니다. `transaction()`, Dataset, Form 라이프사이클 — 이 세 가지를 손대지 않아도 된다는 사실 하나만으로도 마이그레이션의 실질적 부담이 크게 줄어듭니다.

수정이 필요한 영역은 IE 종속 코드, deprecated 컴포넌트, 스타일 파일, 환경 설정에 집중됩니다. 이 네 가지를 화면별로 체크하면서 점진적으로 옮기는 전략이 현장에서 가장 무난하게 통합니다.

다음 글에서는 "그렇다면 언제 Nexacro를 선택하는가"라는 도구 선택 관점의 질문을 다룹니다.

---

**지난 글:** [[Nexacro N] 아키텍처 개요 — 브라우저·런타임·서버](/posts/nexacro-n-architecture/)

<br>
읽어주셔서 감사합니다. 😊
