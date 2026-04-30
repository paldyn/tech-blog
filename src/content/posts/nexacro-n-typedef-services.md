---
title: "[Nexacro N] TypeDef.xml과 Service.xml — 컴포넌트 등록과 서비스 URL 관리"
description: "Nexacro N 프로젝트에서 TypeDefinition.xml로 컴포넌트 타입을 등록하고 Service.xml로 서버 서비스 URL을 체계적으로 관리하는 방법을 실전 예시와 함께 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 7
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "TypeDefinition.xml", "Service.xml", "컴포넌트등록", "서비스URL", "transaction"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-environment-xml/)에서 `Environment.xml`의 서버 URL·프로토콜·세션 설정을 다뤘습니다. 같은 프로젝트 폴더에 나란히 존재하는 `TypeDefinition.xml`과 `Service.xml`은 그보다 훨씬 자주 손대야 하는 파일입니다. 전자는 *어떤 컴포넌트를 쓸 수 있는지*, 후자는 *서버 어디로 데이터를 보낼지*를 결정합니다. 두 파일을 잘 이해해 두면 새 화면을 만들 때마다 "컴포넌트가 왜 팔레트에 없지?" "URL이 왜 404가 뜨지?" 같은 문제를 단번에 해결할 수 있습니다.

## TypeDefinition.xml — 컴포넌트 타입 레지스트리

`TypeDefinition.xml`은 Nexacro Studio가 프로젝트를 열 때, 그리고 런타임이 폼을 로드할 때 참조하는 **컴포넌트 타입 목록**입니다. 이 파일에 등록된 라이브러리와 컴포넌트만 Studio 컴포넌트 팔레트에 나타나고, 스크립트에서 `new nexacro.Button()` 형태로 생성할 수 있습니다.

파일은 프로젝트 루트의 `TypeDefinition.xml`이며, Studio N에서는 Project 탭 > TypeDefinition 항목을 더블클릭하면 GUI 편집기가 열립니다.

![TypeDefinition.xml 구조와 등록 결과](/assets/posts/nexacro-n-typedef-services-structure.svg)

### TypeLibrary — 기본 컴포넌트 라이브러리 등록

`<TypeLibrary>` 요소는 Nexacro가 제공하는 빌트인 컴포넌트 라이브러리 전체를 한 줄에 등록합니다. 대부분의 프로젝트에서는 아래 한 줄이면 Button, Edit, Grid, Dataset, Combo 등 수십 가지 기본 컴포넌트를 모두 사용할 수 있습니다.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<TypeDefinition version="2.0">

  <!-- Nexacro N 기본 컴포넌트 라이브러리 전체 등록 -->
  <TypeLibrary id="nexacro"
    src="nexacro17/nexacro17lib" />

</TypeDefinition>
```

`src` 속성은 라이브러리 파일의 상대 경로입니다. 런타임은 `Environment.xml`의 `formurl`을 기준으로 이 경로를 해석합니다. Nexacro N 버전에 따라 `nexacro17`, `nexacro24` 등으로 달라지니, 프레임워크 버전을 올릴 때 반드시 확인해야 합니다.

### UserComponent — 커스텀 컴포넌트 등록

프로젝트 전용으로 만든 커스텀 컴포넌트는 `<UserComponent>` 요소로 개별 등록합니다. 등록하지 않으면 Studio 팔레트에 나타나지 않고, 다른 폼에서 해당 컴포넌트를 포함한 폼을 Include하면 로드 오류가 발생합니다.

```xml
<TypeDefinition version="2.0">
  <TypeLibrary id="nexacro"
    src="nexacro17/nexacro17lib" />

  <!-- 커스텀 DatePicker 컴포넌트 등록 -->
  <UserComponent
    id="MyDatePicker"
    classname="MyDatePicker"
    src="comp/MyDatePicker" />

  <!-- 공통 팝업 그리드 컴포넌트 -->
  <UserComponent
    id="SearchPopupGrid"
    classname="SearchPopupGrid"
    src="comp/SearchPopupGrid" />
</TypeDefinition>
```

`src`는 `.xfdl` 파일 경로에서 확장자를 제외한 값입니다. `classname`은 스크립트에서 `new MyDatePicker()` 형태로 참조할 때 사용하는 클래스 이름이므로, 컴포넌트 파일 내부에 선언된 이름과 정확히 일치해야 합니다.

### TypeDefinition.xml 편집 시 주의사항

- **Studio 재시작 없이 적용**: GUI 편집기로 저장하면 즉시 팔레트에 반영됩니다. XML을 직접 수정했다면 Studio를 재시작해야 할 수 있습니다.
- **중복 id 금지**: 같은 `id`가 두 번 선언되면 런타임 로드 오류가 발생합니다.
- **경로 대소문자**: Windows에서 개발하고 Linux 서버에 배포하는 경우, `src` 경로의 대소문자가 정확히 일치해야 합니다.

## Service.xml — 서비스 URL 레지스트리

`Service.xml`(또는 프로젝트에 따라 `Services.xml`)은 `transaction()` 호출 시 사용할 **서버 서비스 URL을 id로 관리**하는 파일입니다. URL을 소스 곳곳에 하드코딩하는 대신 여기에 모아두면, 서버 주소가 바뀌었을 때 이 파일 하나만 수정하면 됩니다.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Services>
  <Service id="getUserList"
    url="/api/user/list" />

  <Service id="saveUser"
    url="/api/user/save" />

  <Service id="deleteUser"
    url="/api/user/delete" />
</Services>
```

`url`이 `/`로 시작하는 상대 경로이면 `Environment.xml`의 `baseurl`과 합쳐져 최종 요청 주소가 됩니다. 절대 경로(`https://...`)를 쓰면 `baseurl`을 무시합니다.

### Service.xml → transaction() 연동

![Service.xml과 transaction() 연동 흐름](/assets/posts/nexacro-n-typedef-services-flow.svg)

폼 스크립트에서 `transaction()`을 호출할 때 두 번째 인자에 Service.xml의 `id`를 넣으면, 런타임이 해당 id에 등록된 URL을 찾아 HTTP 요청을 보냅니다.

```javascript
// 사용자 목록 조회
this.transaction(
    "txGetUserList",   // ① 트랜잭션 식별자
    "getUserList",     // ② Service.xml id → URL 자동 조회
    "",                // ③ 폼 변수 (FV)
    "ds_list=result",  // ④ 출력 Dataset 매핑
    "",                // ⑤ 추가 인자 (args)
    "fn_onGetUserList" // ⑥ 콜백 함수명
);
```

콜백 함수는 트랜잭션 완료 후 자동으로 호출되며, 세 번째 파라미터(`nErrorCode`)가 0 이상이면 성공, 음수이면 오류입니다.

```javascript
function fn_onGetUserList(sId, nErrorCode, sErrorMsg) {
    if (nErrorCode < 0) {
        nexacro.alert("조회 오류: " + sErrorMsg);
        return;
    }
    // ds_list에 데이터가 채워진 상태
}
```

### 환경별 서비스 URL 분리 패턴

개발·스테이징·운영 서버가 다를 때, Service.xml은 상대 경로만 보관하고 `baseurl`을 Environment.xml에서 환경별로 교체하는 패턴이 가장 간단합니다.

```xml
<!-- dev.Environment.xml -->
<Service baseurl="https://dev-api.example.com" ... />

<!-- prod.Environment.xml -->
<Service baseurl="https://api.example.com" ... />
```

빌드 스크립트에서 배포 환경에 맞는 `Environment.xml`을 복사하면 Service.xml을 건드리지 않고도 서버를 전환할 수 있습니다. 이 빌드·배포 과정은 다음 글에서 자세히 다룹니다.

## TypeDefinition.xml과 Service.xml의 차이 요약

| 항목 | TypeDefinition.xml | Service.xml |
|------|-------------------|-------------|
| 역할 | 컴포넌트 타입 등록 | 서버 URL 관리 |
| 참조 시점 | Studio 오픈 / 폼 로드 | transaction() 호출 |
| 주요 요소 | `TypeLibrary`, `UserComponent` | `Service` |
| 자주 수정 | 새 컴포넌트 도입 시 | API 경로 추가·변경 시 |

두 파일 모두 XML이지만 역할이 완전히 다릅니다. 혼동하지 않도록 프로젝트 초기에 구조를 파악해 두면, 이후 화면 개발과 서버 연동이 훨씬 수월해집니다.

---

**지난 글:** [Environment.xml 완전 해부 — 서버 연결·프로토콜·인코딩 설정](/posts/nexacro-n-environment-xml/)

**다음 글:** [빌드와 배포 — Nexacro Studio로 빌드하고 웹 서버에 올리기](/posts/nexacro-n-build-distribute/)

<br>
읽어주셔서 감사합니다. 😊
