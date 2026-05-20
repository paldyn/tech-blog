---
title: "[Nexacro N] 캐시 관리 전략"
description: "Nexacro N 프로젝트에서 브라우저 캐시를 효과적으로 제어하는 방법을 설명합니다. TypeDef.xml 캐시 설정, 파일 해시 기반 캐시 무효화, 설정 파일 캐시 금지, nginx 캐시 헤더 설정, 배포 후 즉시 반영 전략까지 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-20"
archiveOrder: 5
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "캐시", "Cache-Control", "브라우저캐시", "캐시무효화", "배포"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-env-config-split/)에서 환경별 설정을 분리하는 구조를 살펴보았다. 환경 설정이 잘 분리되어 있더라도 배포 후 브라우저가 이전 파일을 캐시로 제공하면 사용자는 여전히 구 버전을 보게 된다. Nexacro N 프로젝트에서 캐시 전략은 로딩 성능과 배포 즉시 반영 사이의 균형 문제다. TypeDef.xml, JS 번들, 이미지 각각 다른 캐시 정책을 적용해야 한다.

## 캐시 문제의 실제 사례

Nexacro N 배포 후 가장 자주 겪는 캐시 문제:

- **TypeDef.xml 캐시**: 서비스 URL이 변경되었는데 브라우저가 구 TypeDef.xml을 캐시로 제공 → 연결 오류
- **폼 파일 캐시**: 화면 로직이 수정되었는데 구 버전 화면이 표시
- **공통 JS 캐시**: 공통 함수 버그를 수정했는데 적용 안 됨

반대로 과도한 캐시 금지도 문제다. 모든 파일을 `no-cache`로 설정하면 매 요청마다 서버에서 파일을 받아 로딩이 느려진다.

![캐시 관리 전략 흐름](/assets/posts/nexacro-n-cache-management-flow.svg)

## 파일 유형별 캐시 전략

| 파일 유형 | 캐시 전략 | 이유 |
|---|---|---|
| TypeDef.xml | no-store | 서비스 URL 변경이 즉시 반영되어야 함 |
| index.html | no-cache | 앱 진입점, 항상 최신 버전 |
| nexacro.js (버전 해시 포함) | 1년 (immutable) | 파일명에 해시가 있어 변경 시 자동 무효화 |
| 공통 JS (버전 해시 포함) | 1년 (immutable) | 동일 이유 |
| 이미지 | 1시간~1일 | 자주 안 바뀌지만 수정 가능 |
| 폰트 | 1년 | 거의 변경되지 않음 |

핵심 원칙: **자주 바뀌는 파일은 캐시 금지, 잘 안 바뀌는 파일은 파일명에 해시를 붙여 장기 캐시**.

## TypeDef.xml 캐시 설정

TypeDef.xml은 절대 캐시되면 안 된다. 서비스 URL이나 환경 변수가 바뀌면 즉시 반영되어야 한다.

```xml
<!-- TypeDef.xml — 캐시 설정 섹션 -->
<TypeDefinition>
  <CacheInfo>
    <!-- TypeDef 자체는 캐시 완전 금지 -->
    <Cache id="TypeDef"
      no-cache="true"
      no-store="true"/>

    <!-- 앱 진입 HTML도 캐시 금지 -->
    <Cache id="HTML"
      no-cache="true"/>

    <!-- JS 번들: 해시 포함 파일명 → 장기 캐시 -->
    <Cache id="Script"
      max-age="31536000"
      immutable="true"/>

    <!-- 이미지: 1시간 -->
    <Cache id="Image"
      max-age="3600"/>

    <!-- 폰트: 1년 -->
    <Cache id="Font"
      max-age="31536000"
      immutable="true"/>
  </CacheInfo>
</TypeDefinition>
```

## nginx 캐시 헤더 설정

서버 수준에서 HTTP Cache-Control 헤더를 정확히 설정해야 브라우저가 올바르게 캐시한다.

![캐시 제어 설정 코드](/assets/posts/nexacro-n-cache-management-code.svg)

```nginx
# /etc/nginx/conf.d/nexacro.conf

server {
  listen 80;
  server_name app.example.com;
  root /deploy/prod;

  # TypeDef.xml, index.html — 캐시 완전 금지
  location ~* \.(xml|html)$ {
    add_header Cache-Control "no-store, no-cache, must-revalidate";
    add_header Pragma "no-cache";
    expires -1;
  }

  # JS/CSS 번들 (파일명에 해시 포함 가정: nexacro.a1b2c3.js)
  location ~* \.[0-9a-f]{8}\.(js|css)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    expires 1y;
  }

  # 해시 없는 일반 JS/CSS
  location ~* \.(js|css)$ {
    add_header Cache-Control "public, max-age=3600";
    expires 1h;
  }

  # 이미지
  location ~* \.(png|jpg|gif|svg|ico|webp)$ {
    add_header Cache-Control "public, max-age=86400";
    expires 1d;
  }

  # 폰트
  location ~* \.(woff2|woff|ttf|eot)$ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    expires 1y;
  }
}
```

## 파일 해시 기반 캐시 무효화

JS 번들에 콘텐츠 해시를 붙이면 파일 내용이 바뀔 때마다 파일명이 달라진다. 브라우저는 새 파일명을 새로운 파일로 인식해 캐시를 자동으로 갱신한다.

```bash
# build.sh — 빌드 시 해시 파일명 생성

# 빌드 후 JS 파일에 콘텐츠 해시 추가
HASH=$(md5sum dist/app.js | cut -c1-8)
mv dist/app.js "dist/app.${HASH}.js"

# TypeDef.xml에서 파일 참조 업데이트
sed -i "s|app.js|app.${HASH}.js|g" dist/TypeDef.xml
sed -i "s|app.js|app.${HASH}.js|g" dist/index.html

echo "번들 해시: $HASH"
```

```javascript
// 빌드 도구가 있다면 webpack/vite 설정으로 자동화
// webpack.config.js
module.exports = {
  output: {
    filename: "[name].[contenthash:8].js",
    // → app.a1b2c3d4.js
  }
};
```

## 캐시 강제 갱신 (Cache Busting)

파일명 해시를 쓰지 않는 상황에서 배포 즉시 캐시를 무효화하는 방법:

```html
<!-- index.html — 쿼리 스트링으로 캐시 무효화 -->
<script src="app.js?v=20260520-1430"></script>
<link   href="nexacro.css?v=20260520-1430" rel="stylesheet"/>
```

```bash
# deploy.sh — 배포 버전을 타임스탬프로 주입
CACHE_VER=$(TZ='Asia/Seoul' date +%Y%m%d-%H%M)

sed -i "s|app.js|app.js?v=${CACHE_VER}|g" dist/index.html
sed -i "s|nexacro.css|nexacro.css?v=${CACHE_VER}|g" dist/index.html
```

이 방법은 간단하지만 파일 내용이 바뀌지 않아도 캐시가 무효화되므로, 내용 해시 방식보다 덜 효율적이다. 빌드 도구 없이 간단하게 캐시 문제를 해결할 때 사용한다.

## 배포 후 캐시 검증

배포 후 실제로 캐시 헤더가 의도대로 설정되었는지 확인한다.

```bash
# 캐시 헤더 확인 스크립트
check_cache() {
  URL=$1
  HEADER=$(curl -sI "$URL" | grep -i "cache-control")
  echo "$URL => $HEADER"
}

BASE="https://app.example.com"

check_cache "$BASE/TypeDef.xml"
check_cache "$BASE/index.html"
check_cache "$BASE/nexacro.a1b2c3.js"
check_cache "$BASE/assets/logo.png"
```

예상 출력:
```
TypeDef.xml => Cache-Control: no-store, no-cache, must-revalidate
index.html  => Cache-Control: no-store, no-cache, must-revalidate
nexacro.a1b2c3.js => Cache-Control: public, max-age=31536000, immutable
logo.png    => Cache-Control: public, max-age=86400
```

## 정리

Nexacro N의 캐시 전략은 파일 유형에 따라 다른 정책을 적용하는 것이 핵심이다. 설정 파일은 절대 캐시하지 않고, 번들 파일은 해시를 붙여 장기 캐시한다. nginx 설정과 빌드 스크립트를 함께 관리하면 배포 즉시 반영이 보장되면서도 불필요한 서버 요청을 최소화할 수 있다. 캐시 설정은 배포 후 반드시 헤더를 직접 확인해 의도대로 동작하는지 검증한다.

---

**지난 글:** [\[Nexacro N\] 환경별 설정 분리 전략](/posts/nexacro-n-env-config-split/)

**다음 글:** [\[Nexacro N\] 핫픽스 배포 전략](/posts/nexacro-n-hotfix-deploy/)

<br>
읽어주셔서 감사합니다. 😊
