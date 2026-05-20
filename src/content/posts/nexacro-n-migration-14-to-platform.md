---
title: "[Nexacro N] Nexacro 14에서 Platform으로 마이그레이션"
description: "Nexacro 14(ActiveX 기반)에서 Nexacro Platform(HTML5 기반)으로 마이그레이션하는 방법을 단계별로 설명합니다. 프로젝트 구조 변환, 서비스 URL 재설정, 컴포넌트 호환성 점검, 브라우저 호환성 대응까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 7
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "마이그레이션", "nexacro14", "ActiveX", "HTML5", "레거시전환"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-hotfix-deploy/)에서 긴급 장애 상황의 핫픽스 배포 전략을 살펴보았다. 배포와 운영 전략이 갖춰졌다면 이제 시리즈의 후반부 주제인 마이그레이션으로 넘어간다. 국내에는 아직도 많은 기업이 Nexacro 14(ActiveX 기반)로 구축된 레거시 시스템을 운영하고 있다. Internet Explorer 지원 종료와 ActiveX 제거 정책으로 인해 마이그레이션이 선택이 아닌 필수가 되었다. Nexacro 14에서 Nexacro Platform으로의 전환은 기반 기술이 크게 달라지므로 체계적인 접근이 필요하다.

## Nexacro 14와 Platform의 차이

Nexacro 14는 ActiveX 플러그인을 통해 IE에서 동작했다. HTML이나 JavaScript 없이 독자적인 런타임이 브라우저 안에서 실행되는 방식이다. Nexacro Platform은 HTML5와 JavaScript 기반으로 완전히 재설계되어 IE 외의 브라우저에서도 동작한다.

![마이그레이션 경로 다이어그램](/assets/posts/nexacro-n-migration-14-to-platform-path.svg)

**주요 차이점**:

| 항목 | Nexacro 14 | Nexacro Platform |
|---|---|---|
| 실행 방식 | ActiveX 플러그인 | HTML5 + JS 런타임 |
| 지원 브라우저 | IE 전용 | Chrome, Edge, Firefox |
| 프로젝트 파일 | .xprj | TypeDef.xml |
| 폼 파일 | .xfdl (동일) | .xfdl (동일) |
| 서비스 설정 | .xprj 내부 | TypeDef.xml ServiceInfo |
| 설치 방식 | 클라이언트 설치 | 서버 배포 (설치 불필요) |

폼 파일(.xfdl) 자체는 대부분 그대로 사용할 수 있다. 가장 큰 변화는 프로젝트 구조와 서비스 설정 방식이다.

## 마이그레이션 단계

### 1단계: 현황 파악

마이그레이션 전에 기존 시스템의 규모와 복잡도를 파악한다.

```bash
# 폼 파일 수 집계
find . -name "*.xfdl" | wc -l

# 스크립트 파일 수
find . -name "*.js" | wc -l

# Nexacro 14 전용 API 사용 여부 검색
grep -rn "nexacro14" . --include="*.xfdl"
grep -rn "ActiveX" . --include="*.xfdl"
grep -rn "getActivexObject" . --include="*.xfdl"
```

ActiveX 직접 호출(Excel 자동화, 프린터 직접 제어 등)이 있다면 별도 대체 방안이 필요하다.

### 2단계: Nexacro Studio 업그레이드

Nexacro Platform용 Nexacro Studio를 설치하고 기존 .xprj 프로젝트를 열면 마이그레이션 도우미가 실행된다.

1. Nexacro Studio Platform 버전 설치
2. 기존 .xprj 파일 열기
3. 마이그레이션 도우미 "Platform으로 변환" 실행
4. TypeDef.xml 생성 확인

자동 변환 후 수동으로 검토해야 할 항목이 남는다.

### 3단계: 서비스 URL 재설정

가장 중요한 변경 사항이다. Nexacro 14의 .xprj에 있던 서비스 설정이 TypeDef.xml로 이동한다.

![주요 변경 코드 패턴](/assets/posts/nexacro-n-migration-14-to-platform-code.svg)

```xml
<!-- BEFORE: Nexacro 14 .xprj 방식 -->
<ProjectInfo>
  <ServiceInfo>
    <Service id="SVC_ORD"
      url="http://oldserver/nexacro/"
      protocol="NexaProtocol14"/>
    <Service id="SVC_USR"
      url="http://oldserver/user/"
      protocol="NexaProtocol14"/>
  </ServiceInfo>
</ProjectInfo>
```

```xml
<!-- AFTER: Nexacro Platform TypeDef.xml 방식 -->
<TypeDefinition>
  <Environments>
    <Environment id="default">
      <Variable id="SERVER_URL"
        value="https://newserver.example.com"/>
    </Environment>
  </Environments>
  <ServiceInfo>
    <Service id="SVC_ORD"
      url="%SERVER_URL%/nexacro/"
      protocol="NexaProtocol"
      timeout="30000"/>
    <Service id="SVC_USR"
      url="%SERVER_URL%/user/"
      protocol="NexaProtocol"
      timeout="30000"/>
  </ServiceInfo>
</TypeDefinition>
```

`NexaProtocol14`는 `NexaProtocol`로 변경하고, URL도 새 서버 주소로 업데이트한다.

### 4단계: 폼 파일 호환성 점검

대부분의 폼 파일은 그대로 동작하지만 다음 항목을 점검한다.

```javascript
// 호환성 점검 스크립트 (Node.js)
const fs   = require("fs");
const path = require("path");
const glob = require("glob");

// Nexacro 14 전용 API 패턴
const INCOMPATIBLE_PATTERNS = [
  { pattern: /getActivexObject/g,  msg: "ActiveX 직접 호출" },
  { pattern: /createActivex/g,     msg: "ActiveX 생성" },
  { pattern: /WshShell/g,          msg: "Shell 호출" },
  { pattern: /FileSystemObject/g,  msg: "파일 시스템 직접 접근" },
  { pattern: /nexacro14\./g,       msg: "nexacro14 전용 API" },
];

const xfdlFiles = glob.sync("**/*.xfdl");
let totalIssues = 0;

xfdlFiles.forEach(file => {
  const content = fs.readFileSync(file, "utf8");
  INCOMPATIBLE_PATTERNS.forEach(({ pattern, msg }) => {
    const matches = content.match(pattern);
    if (matches) {
      console.log(`[이슈] ${file}: ${msg} (${matches.length}건)`);
      totalIssues += matches.length;
    }
  });
});

console.log(`\n총 이슈: ${totalIssues}건`);
```

### 5단계: 서버 어댑터 확인

서버사이드 어댑터도 Platform 호환 버전으로 교체해야 한다. Nexacro 14용 어댑터와 Platform용 어댑터는 다르다.

```java
// Spring Boot 기준 어댑터 교체 예시

// BEFORE: Nexacro 14 어댑터
import com.nexacro14.xapi.data.*;
import com.nexacro14.xapi.tx.*;

// AFTER: Nexacro Platform 어댑터
import com.nexacro.xapi.data.*;
import com.nexacro.xapi.tx.*;
```

패키지명이 바뀌므로 서버 코드 전체에서 import 경로를 변경해야 한다. Maven/Gradle 의존성도 Platform 버전으로 변경한다.

## 마이그레이션 체크리스트

```
Nexacro 14 → Platform 마이그레이션 체크리스트

프로젝트 구조
□ .xprj → TypeDef.xml 변환 완료
□ 서비스 URL TypeDef.xml에 재설정
□ 환경별 TypeDef 파일 분리

폼 호환성
□ ActiveX 직접 호출 코드 제거/대체
□ Nexacro 14 전용 API 교체
□ 파일 시스템 직접 접근 코드 제거

서버사이드
□ 어댑터 jar 파일 Platform 버전으로 교체
□ import 경로 변경
□ API 응답 포맷 호환성 확인

테스트
□ 핵심 화면 전체 동작 확인
□ 조회/저장/삭제 트랜잭션 검증
□ 팝업 동작 확인
□ 엑셀 내보내기 (ActiveX 없이)
□ 파일 업/다운로드

배포
□ Chrome/Edge 브라우저 테스트 완료
□ 구 IE 접속 차단 또는 안내 페이지 설정
□ SSL/HTTPS 적용 확인
```

## 자주 발생하는 문제

**1. 엑셀 자동화**: Nexacro 14에서는 ActiveX로 Excel을 직접 조작했다. Platform에서는 서버사이드 엑셀 라이브러리(Apache POI 등) 또는 Grid의 내장 엑셀 내보내기 기능을 사용한다.

**2. 프린터 직접 제어**: ActiveX로 프린터에 직접 접근하던 코드는 Nexacro Platform의 Print 컴포넌트나 서버사이드 PDF 생성으로 대체한다.

**3. 로컬 파일 접근**: ActiveX를 통한 로컬 파일 읽기/쓰기는 보안상 허용되지 않는다. 파일 업로드/다운로드 방식으로 전환한다.

## 정리

Nexacro 14에서 Platform으로의 마이그레이션은 폼 파일의 대부분은 재사용하면서, 프로젝트 구조와 서버 어댑터를 교체하는 작업이다. ActiveX 의존 기능을 대체하는 것이 가장 큰 과제다. 단계별 점검 목록을 따르고, 화면 수가 많다면 우선순위가 높은 핵심 화면부터 마이그레이션해 검증한 뒤 나머지를 확장하는 방식이 안전하다.

---

**지난 글:** [\[Nexacro N\] 핫픽스 배포 전략](/posts/nexacro-n-hotfix-deploy/)

**다음 글:** [\[Nexacro N\] Nexacro Platform에서 N으로 마이그레이션](/posts/nexacro-n-migration-platform-to-n/)

<br>
읽어주셔서 감사합니다. 😊
