---
title: "[Nexacro N] 서비스 URL 설정과 TypeDefinition 관리"
description: "Nexacro N에서 transaction() URL을 TypeDefinition으로 관리하는 방법, environment.xml로 개발·운영 환경을 분리하는 전략, 절대 URL과 서비스명::메서드 방식의 차이를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-11"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "transaction", "TypeDefinition", "service-url", "environment", "배포설정"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-transaction/)에서 `transaction()`의 파라미터 구조를 배웠습니다. 그 중 두 번째 파라미터인 **url**을 어떻게 관리하느냐가 대규모 프로젝트에서 유지보수를 결정합니다. URL을 각 Form에 하드코딩하면 서버 주소가 바뀔 때마다 모든 파일을 수정해야 합니다. Nexacro N은 이 문제를 **TypeDefinition**과 **environment.xml**로 깔끔하게 해결합니다.

## TypeDefinition이란

TypeDefinition은 서비스 URL을 이름에 매핑해 관리하는 XML 파일입니다. `transaction()` 호출 시 URL 문자열 대신 **서비스명::메서드** 형식을 쓸 수 있게 해줍니다.

![TypeDefinition 서비스 URL 구조](/assets/posts/nexacro-n-service-url-typedef.svg)

TypeDefinition.xml의 기본 구조:

```xml
<TypeDefinition>
  <Environments>
    <Environment id="SVC_EMP"
      url="/emp/empService.do" />
    <Environment id="SVC_DEPT"
      url="/dept/deptService.do" />
    <Environment id="SVC_CODE"
      url="/common/codeService.do" />
  </Environments>
</TypeDefinition>
```

사용 방법:

```javascript
// TypeDefinition 미사용 — URL 하드코딩
this.transaction("SVC_SRCH",
    "http://api.company.com/emp/empService.do",
    ...);

// TypeDefinition 사용 — 서비스명::메서드
this.transaction("SVC_SRCH",
    "SVC_EMP::getList",
    ...);
```

`SVC_EMP::getList`에서 `SVC_EMP`는 TypeDefinition의 id, `getList`는 서버 메서드명입니다.

## environment.xml로 BaseURL 관리

TypeDefinition은 상대 URL만 갖고 있으며, 앞에 붙는 BaseURL은 **environment.xml**에서 관리합니다.

```xml
<!-- environment_dev.xml -->
<Environment>
  <BaseURL>http://dev-api.company.com:8080</BaseURL>
</Environment>
```

```xml
<!-- environment_prd.xml -->
<Environment>
  <BaseURL>https://api.company.com</BaseURL>
</Environment>
```

최종 호출 URL = BaseURL + TypeDefinition URL:
- 개발: `http://dev-api.company.com:8080/emp/empService.do`
- 운영: `https://api.company.com/emp/empService.do`

![환경별 BaseURL 분리 전략](/assets/posts/nexacro-n-service-url-env.svg)

environment.xml만 교체하면 TypeDefinition.xml과 Form 소스 코드를 전혀 건드리지 않고 환경을 전환할 수 있습니다.

## TypeDefinition.xml 위치와 로드

TypeDefinition.xml은 프로젝트 내 특정 경로에 위치하며, Application에서 로드합니다.

```xml
<!-- Application의 TypeDefinition 선언 -->
<Application TypeDefinition="TypeDefinition.xml" ...>
```

Studio에서 **프로젝트 탐색기 > TypeDefinition.xml**을 더블 클릭하면 GUI 편집기로 서비스를 추가·수정할 수 있습니다.

## 서비스 URL 설계 원칙

실무에서 서비스 URL을 설계할 때 지켜야 할 규칙입니다.

### 서비스 ID 명명 규칙

```
SVC_{도메인명}
예: SVC_EMP, SVC_DEPT, SVC_ORDER, SVC_CODE
```

도메인별로 하나의 URL을 갖도록 합니다. 한 서비스 파일에 CRUD 메서드를 모두 모아두는 것이 관리하기 편합니다.

### 상대 URL 사용

절대 URL 대신 `/` 로 시작하는 상대 URL을 사용합니다. BaseURL에 따라 자동으로 조합되기 때문입니다.

```xml
<!-- 잘못된 방식 — 절대 URL 하드코딩 -->
<Environment id="SVC_EMP" url="http://api.company.com/emp/empService.do"/>

<!-- 올바른 방식 — 상대 URL -->
<Environment id="SVC_EMP" url="/emp/empService.do"/>
```

### 개발 시 직접 URL 허용

TypeDefinition 없이 빠르게 테스트할 때는 직접 URL을 써도 됩니다. 단, 정식 개발 시에는 반드시 TypeDefinition으로 옮깁니다.

```javascript
// 프로토타이핑 시 임시 직접 URL
this.transaction("TEST",
    "http://localhost:8080/test/service.do",
    "", "dsResult=dsMain", "", "fn_testCb");
```

## 서비스 ID와 메서드 매핑

서버 메서드 이름은 서버 컨트롤러의 실제 메서드명과 일치해야 합니다.

```java
// Spring Controller
@RequestMapping("/emp/empService.do")
public void empService(NexacroRequest req, NexacroResponse res)
        throws Exception {
    String svcId = req.getParameter("svcId"); // "getList", "save" 등
    if ("getList".equals(svcId)) {
        empService.getList(req, res);
    } else if ("save".equals(svcId)) {
        empService.save(req, res);
    }
}
```

`SVC_EMP::getList` → 서버는 `svcId=getList` 파라미터를 받아 분기합니다.

## 여러 프로젝트 공통 서비스 관리

공통 코드 조회, 파일 업로드처럼 여러 서비스에서 공유하는 URL은 별도 TypeDefinition 파일로 분리할 수 있습니다.

```xml
<!-- TypeDefinition_common.xml -->
<Environments>
  <Environment id="SVC_CODE" url="/common/codeService.do"/>
  <Environment id="SVC_FILE" url="/common/fileService.do"/>
</Environments>
```

Application에서 두 파일 모두 로드:

```xml
<Application
  TypeDefinition="TypeDefinition.xml TypeDefinition_common.xml"
  ...>
```

---

**지난 글:** [트랜잭션(Transaction) 개요](/posts/nexacro-n-transaction/)

**다음 글:** [입력·출력 Dataset 매핑 심화](/posts/nexacro-n-input-output-dataset/)

<br>
읽어주셔서 감사합니다. 😊
