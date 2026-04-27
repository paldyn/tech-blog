---
title: "[Nexacro N] Nexacro란 무엇인가 — RIA 시대부터 N까지"
description: "투비소프트 Nexacro N의 탄생 배경, RIA 시대의 흐름, 그리고 HTML5 기반 엔터프라이즈 UI 플랫폼으로 진화한 과정을 처음부터 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-26"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "ria", "html5", "enterprise-web"]
featured: false
draft: false
---

이 글은 **Nexacro N 기준**으로 작성되었습니다.

사내 업무 시스템을 개발하다 보면 "이건 Nexacro로 만들어야 한다"는 말을 자주 듣게 됩니다. 그런데 처음 이 플랫폼을 접하는 개발자라면 "Nexacro가 정확히 무엇인가?" 하는 질문이 먼저 떠오를 것입니다. 단순한 UI 라이브러리인지, 프레임워크인지, 아니면 아예 다른 범주의 무언가인지 헷갈리기 마련입니다. 이 글에서는 Nexacro가 어떤 맥락에서 태어났는지, 왜 지금도 국내 대기업·공공기관의 핵심 개발 플랫폼으로 쓰이는지를 역사와 구조 관점에서 풀어보겠습니다.

## Nexacro가 태어난 시대 — RIA(Rich Internet Application)

웹이 처음 등장했을 때 브라우저는 정적인 HTML 문서를 보여주는 뷰어에 불과했습니다. 1990년대 기업들은 C/S(Client/Server) 아키텍처의 두터운 클라이언트 프로그램을 주로 사용했고, 웹은 단순한 정보 전달 매체였습니다.

2000년대 들어 Flash, ActiveX, Java Applet 같은 기술이 부상하면서 **RIA(Rich Internet Application)** 시대가 열렸습니다. 브라우저 안에서도 데스크톱 수준의 풍부한 UI와 빠른 반응성을 구현할 수 있게 된 것입니다. 기업들은 이 기술을 앞다투어 사내 ERP, 그룹웨어, 금융 시스템에 적용했습니다.

투비소프트는 이 흐름 속에서 **Nexacro 14**를 출시하며 엔터프라이즈 RIA 시장에 진입했습니다. 이후 **Nexacro Platform**으로 발전시켰고, HTML5가 Flash를 대체하는 시대가 오면서 순수 HTML5 기반의 **Nexacro N**(이후 **V24**)으로 재탄생시켰습니다.

![RIA 시대부터 Nexacro N까지](/assets/posts/nexacro-n-what-is-nexacro-ria-history.svg)

## Nexacro N은 무엇인가

Nexacro N은 투비소프트(TOBESOFT)가 개발한 **엔터프라이즈급 웹 UI 플랫폼**입니다. 단순한 컴포넌트 라이브러리가 아니라 다음 요소를 통합한 완결된 개발 환경입니다.

- **Studio N** — 폼(화면)을 드래그&드롭으로 설계하는 IDE
- **Nexacro N Runtime** — 브라우저 안에서 동작하는 HTML5 렌더링 엔진
- **Dataset** — 서버 데이터를 클라이언트에서 관리하는 인메모리 데이터 구조
- **Transaction** — 서버와 데이터를 주고받는 통신 추상화 API
- **Component Suite** — Grid, Edit, Combo, Tree 등 60개 이상의 업무용 컴포넌트

이 중 **Grid**와 **Dataset**은 Nexacro를 선택하는 핵심 이유입니다. 수만 행의 데이터를 다루는 업무 화면에서 엑셀 수준의 입력·편집 경험을 기본 제공한다는 점은 일반 웹 프레임워크와 결정적으로 다른 부분입니다.

## 3계층 구조로 이해하는 Nexacro N

Nexacro N 애플리케이션은 **클라이언트 · 통신 · 서버** 3계층으로 구성됩니다.

![Nexacro N 핵심 구조](/assets/posts/nexacro-n-what-is-nexacro-architecture.svg)

### 클라이언트 계층 — 브라우저 안의 작은 OS

```javascript
// Form 로드 시 실행되는 이벤트 핸들러 예시
function Form_onload(obj, e) {
    // Dataset에 직접 행을 추가
    var nRow = ds_employee.addRow();
    ds_employee.setColumn(nRow, "emp_nm", "홍길동");
    ds_employee.setColumn(nRow, "dept_cd", "D001");

    // Grid는 Dataset과 자동으로 동기화됨
    // (별도의 렌더링 코드 불필요)
}
```

브라우저 안의 **Nexacro N Runtime**은 HTML5와 JavaScript 위에서 동작하지만, 개발자는 Nexacro만의 컴포넌트 모델과 API를 사용합니다. Form이라는 단위 화면을 기준으로 컴포넌트를 배치하고 Script(JavaScript)로 이벤트를 처리합니다.

### 통신 계층 — transaction() 한 줄로 서버 호출

```javascript
// 서버에서 데이터를 조회하는 표준 패턴
function fn_search() {
    var sUrl    = "svc::EmpService.do";
    var sInDs   = "input=ds_search";
    var sOutDs  = "output=ds_employee";
    var sCbFn   = "fn_searchCallback";

    this.transaction("search", sUrl, sInDs, sOutDs, "", sCbFn);
}

function fn_searchCallback(sId, nErrorCd, sErrorMsg) {
    if (nErrorCd < 0) {
        alert(sErrorMsg);
        return;
    }
    // ds_employee에 서버 데이터가 자동으로 채워짐
    trace("조회 건수: " + ds_employee.rowcount);
}
```

`transaction()` 함수 하나로 Dataset을 서버에 전송하고 응답 Dataset을 수신합니다. HTTP 요청을 직접 다룰 필요가 없으며, 에러 처리도 콜백 하나에서 통합 처리합니다.

### 서버 계층 — 어댑터로 언어 선택

서버 측은 **Nexacro Adapter**를 통해 Java, .NET, Node.js 중 원하는 기술 스택을 선택할 수 있습니다. 어댑터는 클라이언트의 Dataset 프로토콜(PL 포맷)을 파싱하고 응답 Dataset을 직렬화하는 역할을 담당합니다. Spring Boot 프로젝트라면 Maven/Gradle 의존성 하나를 추가하는 것만으로 연동이 시작됩니다.

## Nexacro N이 선택받는 이유

"왜 React나 Vue 대신 Nexacro를 쓰는가?"라는 질문에는 맥락이 중요합니다.

| 관점 | 일반 웹 프레임워크 | Nexacro N |
|------|-------------------|-----------|
| **Grid** | 외부 라이브러리 조합 | 내장, 엑셀 수준 편집 |
| **데이터 동기화** | 상태관리 직접 구현 | Dataset 자동 바인딩 |
| **CRUD 패턴** | 매번 설계 | 표준 4-패턴 제공 |
| **대상 화면** | 콘텐츠·마케팅·앱 | 업무(ERP/그룹웨어/금융) |
| **개발 생산성** | 설계 자유도 높음 | 업무 화면에 최적화 |

수백 개의 업무 화면을 빠르게, 일관된 품질로 개발해야 하는 환경이라면 Nexacro N이 강점을 발휘합니다. 반대로 마케팅 페이지나 모바일 퍼스트 서비스라면 적합하지 않습니다.

## 개발 언어와 파일 포맷

Nexacro N에서 개발자가 직접 작성하는 파일은 크게 세 가지입니다.

- **`.xfdl`** — Form을 정의하는 XML 기반 파일 (Studio에서 디자인)
- **Script 블록** — `.xfdl` 안에 `<Script>` 태그로 포함된 JavaScript 코드
- **`.xcfg` / `.xadl`** — 프로젝트 설정, 서비스 URL, TypeDef 정의 파일

스크립트는 ES5 수준의 JavaScript를 기반으로 하며, Nexacro 전용 API(`this.transaction()`, `ds_xxx.addRow()` 등)를 조합해 업무 로직을 구현합니다.

```javascript
// Nexacro Script 전형적인 패턴
// Form 초기화 → 조회 호출 → 콜백에서 처리
function Form_onload(obj, e) {
    // 공통 초기화 (날짜 기본값 등)
    ds_search.setColumn(0, "search_dt",
        nexacro.getApplication().getSystemDate("YYYYMMDD"));

    fn_search();
}

function fn_search() {
    this.transaction(
        "search",
        "svc::UserService.do",
        "input=ds_search",
        "output=ds_user",
        "",
        "fn_searchCallback"
    );
}

function fn_searchCallback(sId, nErrorCd, sErrorMsg) {
    if (nErrorCd < 0) {
        alert("조회 오류: " + sErrorMsg);
        return;
    }
}
```

## 정리

Nexacro N은 RIA 시대의 유산을 계승하면서 HTML5 표준으로 재구축한 엔터프라이즈 UI 플랫폼입니다. 풍부한 컴포넌트, Dataset 기반의 데이터 흐름, `transaction()` 추상화가 삼위일체를 이루며 복잡한 업무 화면을 빠르게 개발할 수 있게 합니다. 다음 글에서는 Nexacro 14부터 Platform, N, V24까지의 구체적인 버전 진화 과정을 살펴봅니다.

---

**다음 글:** [[Nexacro N] Nexacro 14 → Platform → N · V24 진화](/posts/nexacro-n-history/)

<br>
읽어주셔서 감사합니다. 😊
