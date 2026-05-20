---
title: "[Nexacro N] 빌드 옵션과 배포 설정"
description: "Nexacro N 프로젝트의 빌드 옵션 구조와 배포 설정 방법을 설명합니다. TypeDef.xml 빌드 설정, 리소스 번들링 옵션, 소스맵 제어, 디버그 모드 설정, 환경별 배포 파이프라인 구성까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "빌드", "배포", "TypeDef", "빌드옵션", "CI/CD"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-regression-tools/)에서 회귀 테스트를 CI 파이프라인에 연동하는 방법을 살펴보았다. CI가 구축되었다면 그 다음은 빌드와 배포 설정이다. Nexacro N 프로젝트는 Nexacro Studio의 빌드 기능과 TypeDef.xml의 설정이 배포 산출물을 결정한다. 빌드 옵션을 제대로 이해하면 개발 환경에서는 빠른 피드백을, 운영 환경에서는 최적화된 산출물을 만들 수 있다.

## 빌드 시스템 개요

Nexacro N의 빌드는 크게 두 단계로 나뉜다. 첫째, **Studio 빌드**: `.xfdl` 폼 파일과 스크립트를 웹 배포 가능한 형태로 변환한다. 둘째, **서비스 설정 반영**: TypeDef.xml에 정의된 서비스 URL, 변수, 리소스 경로를 배포 환경에 맞게 적용한다.

![빌드 옵션 구조](/assets/posts/nexacro-n-build-options-structure.svg)

빌드 산출물은 보통 다음 구조를 갖는다:

```
dist/
├── TypeDef.xml          # 서비스 설정
├── index.html           # 앱 진입점
├── nexacro.js           # Nexacro 런타임 번들
├── nexacro.css          # Nexacro 스타일 번들
├── app/
│   ├── main.js          # 앱 스크립트 번들
│   └── forms/           # 폼 파일들
├── common/
│   └── common.js        # 공통 라이브러리
└── assets/
    └── images/          # 이미지 리소스
```

## TypeDef.xml 빌드 설정

TypeDef.xml은 Nexacro N 프로젝트의 핵심 설정 파일이다. 서비스 URL, 리소스 경로, 런타임 옵션이 모두 여기에 정의된다.

```xml
<!-- TypeDef.xml — 프로젝트 루트 설정 -->
<TypeDefinition>

  <!-- 환경 변수 정의 -->
  <Environments>
    <Environment id="default">
      <Variable id="SERVER_URL"
        value="https://api.example.com"/>
      <Variable id="DEBUG_MODE"
        value="false"/>
      <Variable id="LOG_LEVEL"
        value="ERROR"/>
      <Variable id="CACHE_TTL"
        value="3600"/>
    </Environment>
  </Environments>

  <!-- 서비스 정의 -->
  <ServiceInfo>
    <Service id="SVC"
      url="%SERVER_URL%/nexacro/"
      protocol="NexaProtocol"
      timeout="30000"
      loadwaittype="0"/>
  </ServiceInfo>

  <!-- 폼 리소스 정의 -->
  <Forms>
    <Form id="frmMain"
      src="app/forms/main.xfdl"/>
    <Form id="frmOrder"
      src="app/forms/order.xfdl"/>
  </Forms>

</TypeDefinition>
```

`%SERVER_URL%` 같은 변수 치환 구문을 활용하면 환경별 설정 파일을 분리할 수 있다.

## 환경별 빌드 설정

![환경별 빌드 설정 코드](/assets/posts/nexacro-n-build-options-config.svg)

개발, 스테이징, 운영 환경마다 다른 TypeDef.xml을 유지한다. 공통 설정은 `TypeDef_common.xml`에, 환경별 차이만 각 환경 파일에 둔다.

```xml
<!-- TypeDef_dev.xml — 개발 환경 -->
<TypeDefinition>
  <Environments>
    <Environment id="dev">
      <Variable id="SERVER_URL"
        value="http://localhost:8080"/>
      <Variable id="DEBUG_MODE"
        value="true"/>
      <Variable id="LOG_LEVEL"
        value="DEBUG"/>
      <Variable id="CACHE_TTL"
        value="0"/>
    </Environment>
  </Environments>
  <!-- 서비스, 폼 설정은 common과 동일 -->
</TypeDefinition>
```

```xml
<!-- TypeDef_prod.xml — 운영 환경 -->
<TypeDefinition>
  <Environments>
    <Environment id="prod">
      <Variable id="SERVER_URL"
        value="https://api.example.com"/>
      <Variable id="DEBUG_MODE"
        value="false"/>
      <Variable id="LOG_LEVEL"
        value="ERROR"/>
      <Variable id="CACHE_TTL"
        value="3600"/>
    </Environment>
  </Environments>
</TypeDefinition>
```

## 디버그 모드와 소스맵

개발 환경에서는 디버그 모드를 활성화해 오류 추적을 쉽게 한다.

```javascript
// application.js — 앱 초기화 시 디버그 모드 설정 읽기

function Application_onload(obj, e) {
  var sDebugMode = gv_app_debugMode;  // TypeDef 변수

  if (sDebugMode === "true") {
    // 디버그 모드: 상세 로깅 활성화
    nexacro.setDebugMode(true);
    trace("[APP] 디버그 모드 활성화");
  } else {
    // 운영 모드: 최소 로깅
    nexacro.setDebugMode(false);
  }
}
```

소스맵은 빌드 설정에서 제어한다. 운영 환경에서는 소스맵을 배포하지 않는 것이 일반적이다.

```bash
# build.sh — 환경별 빌드 스크립트

ENV=${1:-dev}

if [ "$ENV" = "prod" ]; then
  # 운영: 소스맵 없음, 코드 압축
  BUILD_FLAGS="--no-sourcemap --minify"
else
  # 개발: 소스맵 포함, 압축 없음
  BUILD_FLAGS="--sourcemap --no-minify"
fi

nexacro-studio build $BUILD_FLAGS \
  --config "TypeDef_${ENV}.xml" \
  --output "dist/"
```

## 리소스 번들링 전략

Nexacro N은 JS, CSS, 이미지를 번들링해 HTTP 요청 수를 줄인다. 번들링 전략은 로드 성능에 직접 영향을 준다.

```xml
<!-- TypeDef.xml — 번들링 설정 -->
<ResourceInfo>

  <!-- JS 번들: 폼별 지연 로딩 -->
  <Script id="common"
    src="common/common.js"
    load="eager"/>     <!-- 즉시 로드 -->

  <Script id="app-main"
    src="app/main.js"
    load="eager"/>

  <Script id="app-order"
    src="app/order.js"
    load="lazy"/>      <!-- 필요 시 로드 -->

  <!-- CSS 번들 -->
  <Style id="nexacro-base"
    src="nexacro.css"
    load="eager"/>

  <Style id="app-theme"
    src="app/theme.css"
    load="eager"/>

</ResourceInfo>
```

자주 사용하는 공통 리소스는 `eager`로, 특정 메뉴에서만 사용하는 리소스는 `lazy`로 설정한다. 초기 로딩 시간과 필요 시 로딩 지연 사이의 균형을 잡는다.

## 배포 파이프라인 구성

빌드부터 배포까지의 파이프라인을 자동화한다.

```bash
#!/bin/bash
# pipeline.sh — 배포 파이프라인

set -e

ENV=${1:-dev}
VERSION=$(git rev-parse --short HEAD)

echo "=== 빌드 시작: ENV=$ENV, VERSION=$VERSION ==="

# 1. 의존성 설치
npm ci

# 2. 회귀 테스트
npm test

# 3. 환경별 TypeDef 선택
cp "config/TypeDef_${ENV}.xml" "TypeDef.xml"
sed -i "s|%VERSION%|${VERSION}|g" TypeDef.xml

# 4. 빌드
if [ "$ENV" = "prod" ]; then
  npm run build:prod
else
  npm run build:dev
fi

# 5. 빌드 결과물 검증
node scripts/verify-build.js

# 6. 배포
rsync -av --delete dist/ \
  "${DEPLOY_HOST}:/deploy/${ENV}/" \
  --exclude "*.map"   # 운영에 소스맵 제외

# 7. 헬스체크
sleep 5
curl -f "http://${DEPLOY_HOST}/health" \
  || (echo "헬스체크 실패 — 롤백 검토" && exit 1)

echo "=== 배포 완료: $ENV ($VERSION) ==="
```

## 배포 체크리스트

빌드 산출물을 배포하기 전 확인 사항:

```
배포 전 체크리스트
─────────────────────────────────────
□ TypeDef.xml 서비스 URL 환경 일치
□ DEBUG_MODE=false (운영)
□ LOG_LEVEL=ERROR (운영)
□ 소스맵 파일 제외 확인
□ 빌드 결과물 크기 정상 범위
□ 회귀 테스트 전부 통과
□ 스테이징 스모크 테스트 완료
□ 이전 버전 백업 완료
□ 롤백 절차 확인
─────────────────────────────────────
```

이 체크리스트를 배포 스크립트 내에 주석으로 포함시키거나, Confluence 배포 런북으로 관리하면 실수를 줄일 수 있다.

## 정리

Nexacro N의 빌드 설정은 TypeDef.xml이 중심이다. 환경 변수를 활용한 설정 분리, 디버그 모드 제어, 리소스 번들링 전략, 배포 파이프라인 자동화를 조합하면 개발 효율과 운영 안정성을 동시에 높일 수 있다. 빌드 스크립트를 팀이 공유 가능한 형태로 관리하고, 매 배포마다 동일한 절차를 따르는 것이 장기적으로 가장 안전한 접근이다.

---

**지난 글:** [\[Nexacro N\] 회귀 테스트 도구와 자동화 전략](/posts/nexacro-n-regression-tools/)

**다음 글:** [\[Nexacro N\] 환경별 설정 분리 전략](/posts/nexacro-n-env-config-split/)

<br>
읽어주셔서 감사합니다. 😊
