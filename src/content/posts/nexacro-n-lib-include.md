---
title: "[Nexacro N] 공통 라이브러리 include 방법"
description: "Nexacro N에서 공통 라이브러리 .xjs 파일을 TypeDefinition에 전역으로 포함하는 방법과 폼별 include 방식의 차이, 로딩 순서 제어법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-14"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "TypeDefinition", "include", "라이브러리포함", "xjs", "전역함수"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-common-library/)에서 공통 라이브러리의 전체 구조와 파일 구성 원칙을 다루었다. 이번 글에서는 작성한 `.xjs` 라이브러리 파일을 **어떻게 프로젝트에 포함시키는지** 구체적인 방법을 살펴본다. Nexacro N에서 전역 함수가 "그냥 동작하는" 이유는 TypeDefinition이 앱 시작 시 라이브러리를 전역 스코프에 로드하기 때문이다.

## TypeDefinition.xml의 역할

Nexacro N 프로젝트에는 `TypeDefinition.xml`(또는 프로젝트 설정에 따라 다른 이름)이 존재한다. 이 파일은 프레임워크가 애플리케이션을 초기화할 때 가장 먼저 읽는 설정 파일이며, `<Includes>` 섹션에 등록된 `.xjs` 파일들을 전역 스코프에 로드한다.

```xml
<!-- TypeDefinition.xml -->
<TypeDefinition>
  <Includes>
    <FileRef path="common/gfn_common.xjs"/>
    <FileRef path="common/gfn_string.xjs"/>
    <FileRef path="common/gfn_date.xjs"/>
    <FileRef path="common/gfn_number.xjs"/>
    <FileRef path="common/gfn_validate.xjs"/>
    <FileRef path="common/gfn_transaction.xjs"/>
    <FileRef path="common/CommonVariables.xjs"/>
  </Includes>
</TypeDefinition>
```

`<FileRef path="...">` 에 지정된 경로는 Nexacro 프로젝트 루트를 기준으로 한 상대 경로다. 이 파일들은 앱 시작 시 **순서대로** 로드되므로, 의존 관계가 있는 파일은 의존되는 파일보다 뒤에 넣어야 한다.

![TypeDefinition 기반 라이브러리 포함 구조](/assets/posts/nexacro-n-lib-include-typedef.svg)

## include 방식 비교

Nexacro N에서 `.xjs` 파일을 포함하는 방법은 두 가지다. TypeDefinition 전역 include와 폼 스크립트 내 `include` 구문이다.

![라이브러리 include 방법 비교](/assets/posts/nexacro-n-lib-include-code.svg)

공통 라이브러리는 **TypeDefinition 전역 include**를 사용해야 한다. 모든 폼에서 동일하게 접근 가능하고, 라이브러리를 추가하거나 변경할 때 한 파일(TypeDefinition)만 수정하면 된다.

## 로딩 순서 주의사항

`gfn_validate.xjs`가 `gfn_common.xjs`의 `gfn_isNull` 함수를 사용한다면, `gfn_common.xjs`가 먼저 로드되어야 한다.

```xml
<!-- 올바른 순서 -->
<FileRef path="common/gfn_common.xjs"/>   <!-- gfn_isNull 정의 -->
<FileRef path="common/gfn_validate.xjs"/> <!-- gfn_isNull 사용 -->

<!-- 잘못된 순서 — 런타임 오류 발생 -->
<FileRef path="common/gfn_validate.xjs"/> <!-- gfn_isNull 아직 없음 -->
<FileRef path="common/gfn_common.xjs"/>
```

의존 관계가 복잡해지면 각 파일이 다른 파일에 의존하지 않도록 독립적인 순수 함수만 포함하도록 설계를 개선하는 것이 근본적인 해결책이다.

## Studio에서 TypeDefinition 편집하기

Nexacro Studio에서 TypeDefinition.xml을 직접 텍스트로 편집하거나, 프로젝트 설정 화면에서 GUI로 파일을 추가할 수 있다.

```
Project Explorer → [프로젝트명] → TypeDefinition.xml 더블클릭
→ Includes 탭 → Add FileRef 버튼
```

파일 경로를 잘못 입력하면 앱 시작 시 콘솔에 "File not found" 오류가 발생하므로, 경로 철자를 신중하게 확인해야 한다.

## 라이브러리 파일 수정 후 반영

개발 중에 `.xjs` 파일을 수정하면 Nexacro Studio에서 F5(새로 고침)를 실행하거나 애플리케이션을 재시작해야 변경이 반영된다. 런타임 캐시가 남아 있으면 이전 버전의 함수가 실행될 수 있어 디버깅이 어려워지므로, 의심될 때는 브라우저 캐시도 비워야 한다.

```javascript
// 디버깅용: 전역 함수 로드 확인
// 브라우저 콘솔 또는 Nexacro 디버거에서 실행
typeof gfn_isNull; // "function" 이면 정상 로드
typeof gfn_trim;   // "undefined" 이면 해당 파일 누락
```

## TypeDefinition 분리 전략

대형 프로젝트에서는 TypeDefinition을 여러 파일로 분리하고 모듈별로 관리하는 경우도 있다. 공통 라이브러리용 TypeDef와 프레임워크 컴포넌트용 TypeDef를 분리하면 파일이 명확해지고, 모듈별 로드/언로드 제어가 가능해진다.

```xml
<!-- 공통 라이브러리 전용 TypeDef -->
<TypeDefinition id="CommonLib">
  <Includes>
    <FileRef path="common/gfn_common.xjs"/>
    <FileRef path="common/CommonVariables.xjs"/>
  </Includes>
</TypeDefinition>
```

분리 여부는 프로젝트 규모와 팀 관례에 따라 결정한다. 소규모 프로젝트에서는 단일 TypeDefinition이 더 관리하기 쉽다.

---

**지난 글:** [[Nexacro N] 공통 라이브러리 설계 개요](/posts/nexacro-n-common-library/)

**다음 글:** [[Nexacro N] 전역 함수(gfn) 설계와 활용](/posts/nexacro-n-global-functions/)

<br>
읽어주셔서 감사합니다. 😊
