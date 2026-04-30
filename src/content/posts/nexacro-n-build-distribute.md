---
title: "[Nexacro N] 빌드와 배포 — Nexacro Studio로 빌드하고 웹 서버에 올리기"
description: "Nexacro N 프로젝트의 빌드 프로세스, 빌드 옵션 설정, 결과물 구조, 그리고 Nginx·Apache 웹 서버 배포 절차를 단계별로 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 8
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "빌드", "배포", "Studio N", "Nginx", "빌드결과물", "dist"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-typedef-services/)에서 `TypeDefinition.xml`과 `Service.xml`로 컴포넌트와 서버 URL을 등록하는 방법을 살펴봤습니다. 이제 그렇게 완성한 소스를 실제 운영 서버에 올리는 단계를 다룰 차례입니다. Nexacro N의 빌드는 단순한 파일 복사가 아닙니다. Studio N이 `.xfdl` 화면 파일을 압축하고, JavaScript를 난독화·최소화하며, 설정 파일까지 정리된 배포 패키지를 만들어냅니다. 이 과정을 제대로 이해하면 개발 환경과 운영 환경을 깔끔하게 분리하면서 빠른 배포 주기를 유지할 수 있습니다.

## Nexacro N 빌드란

Nexacro N의 "빌드"는 Studio N이 제공하는 **Build 기능**을 통해 소스 파일을 배포 가능한 형태로 변환하는 과정입니다. 웹팩(Webpack) 같은 번들러와 개념은 비슷하지만, Nexacro 전용 포맷인 `.xfdl`을 처리하는 과정이 포함된다는 점이 다릅니다.

빌드 과정에서 일어나는 일:

| 작업 | 설명 |
|------|------|
| xfdl 컴파일 | XML 형식의 화면 파일을 런타임에 최적화된 형태로 변환 |
| JS Minify | 스크립트 공백·주석 제거, 변수명 단축화 |
| 리소스 복사 | 이미지, CSS, 폰트 등을 `dist/` 구조로 정리 |
| 설정 파일 복사 | `Environment.xml`, `Service.xml` 포함 |
| 경로 재조정 | 빌드 대상 경로에 맞게 URL 재작성 |

![Nexacro N 빌드 프로세스 — 소스에서 서버까지](/assets/posts/nexacro-n-build-distribute-process.svg)

## Studio N에서 빌드 설정하기

빌드 설정은 Studio N 메뉴의 **Build > Build Configuration**에서 열 수 있습니다. 프로젝트마다 여러 빌드 구성(Configuration)을 저장해두고 선택해서 실행할 수 있습니다.

주요 빌드 옵션:

```xml
<!-- .project 파일 내 빌드 설정 예시 -->
<BuildConfiguration name="production">
  <option name="outputPath" value="./dist" />
  <option name="minifyScript" value="true" />
  <option name="compressForm" value="true" />
  <option name="copyResources" value="true" />
  <option name="environmentFile"
    value="conf/prod.Environment.xml" />
</BuildConfiguration>
```

- **outputPath**: 빌드 결과물이 생성될 폴더. `./dist`가 관례이지만 CI/CD 파이프라인에 맞게 변경 가능합니다.
- **minifyScript**: `true`이면 JS 파일을 최소화합니다. 개발 빌드에서는 `false`로 두면 디버깅이 편합니다.
- **compressForm**: `.xfdl` 파일 압축 여부입니다. 파일 크기와 초기 로딩 속도에 영향을 줍니다.
- **environmentFile**: 빌드 시 사용할 `Environment.xml` 경로입니다. 개발·스테이징·운영을 다른 파일로 분리하는 핵심 옵션입니다.

## 빌드 실행 방법

Studio N에서 빌드는 세 가지 방법으로 실행합니다.

1. **메뉴**: Build > Run Build (`F8` 단축키)
2. **툴바**: Build 버튼 클릭
3. **커맨드라인** (CI/CD 통합용):

```bash
# Nexacro Studio CLI 빌드 (Studio N 설치 경로 기준)
nexacro-studio-cli build \
  --project ./MyProject.nxp \
  --config production \
  --output ./dist
```

커맨드라인 빌드는 Jenkins, GitHub Actions 같은 CI/CD 도구와 연동할 때 사용합니다. Nexacro Studio CLI 도구가 별도로 설치되어 있어야 하며, 라이선스 서버와 통신할 수 있는 환경이 필요합니다.

## 빌드 결과물 구조

빌드가 완료되면 `dist/` 폴더에 다음과 같은 구조가 생성됩니다.

![빌드 결과물 구조 — dist/ 폴더 해부](/assets/posts/nexacro-n-build-distribute-output.svg)

```
dist/
├── index.html          ← 앱 진입점 (브라우저가 처음 로드)
├── Environment.xml     ← 운영 환경 설정
├── Service.xml         ← 서비스 URL 레지스트리
├── TypeDefinition.xml  ← 컴포넌트 타입 정의
├── nexacro17/          ← Nexacro 런타임 라이브러리
│   ├── nexacro17lib.js
│   └── nexacro17lib.css
├── form/               ← 빌드된 화면 파일
│   ├── main.xfdl
│   ├── login.xfdl
│   └── popup/
├── comp/               ← 커스텀 컴포넌트
│   └── MyDatePicker.xfdl
└── res/                ← 리소스
    ├── images/
    └── css/
```

`nexacro17/` 폴더는 Nexacro 런타임 엔진 자체입니다. 용량이 크기 때문에 CDN에 올려 캐시를 활용하는 전략이 효과적입니다. 업데이트가 없는 한 브라우저 캐시에서 바로 로드되어 초기 로딩 속도가 대폭 향상됩니다.

## 환경별 빌드 분리

운영 환경마다 API 서버 주소가 다르므로, `Environment.xml`을 환경별로 분리해두는 것이 표준 패턴입니다.

```
conf/
├── dev.Environment.xml    ← 개발 서버
├── staging.Environment.xml← 스테이징
└── prod.Environment.xml   ← 운영
```

각 파일에서 `baseurl`만 다르게 설정합니다.

```xml
<!-- prod.Environment.xml -->
<Properties encoding="utf-8" />
<Service
  baseurl="https://api.myapp.com"
  formurl="https://cdn.myapp.com/forms"
  imageurl="https://cdn.myapp.com/images"
/>
```

빌드 구성에서 `environmentFile`을 `conf/prod.Environment.xml`로 지정하면, 빌드 결과물의 `Environment.xml`이 자동으로 운영 설정 값으로 교체됩니다. 개발자가 실수로 개발 서버 주소를 운영에 올리는 사고를 원천 방지할 수 있습니다.

## 웹 서버 배포 절차

`dist/` 폴더를 그대로 웹 서버 루트에 복사하면 배포가 완료됩니다. Nginx 기준 설정 예시입니다.

```nginx
server {
    listen 443 ssl;
    server_name myapp.example.com;

    root /var/www/myapp/dist;
    index index.html;

    # .xfdl 파일 MIME 타입 등록 (필수)
    types {
        application/xml xfdl xml;
        text/javascript js;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 정적 파일 캐시 (런타임 라이브러리)
    location /nexacro17/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

`.xfdl` 파일의 MIME 타입을 `application/xml` 또는 `text/xml`로 등록하지 않으면 일부 브라우저에서 파일 다운로드로 처리해 화면이 뜨지 않습니다. 이 부분이 신규 배포에서 가장 자주 발생하는 문제입니다.

## 배포 후 체크리스트

배포를 마친 뒤 반드시 확인해야 할 항목입니다.

- **index.html 접근**: 브라우저에서 앱 URL로 접근 시 화면이 정상 로드되는지
- **Environment.xml 운영값 확인**: 개발 서버 URL이 노출되지 않는지 브라우저 개발자 도구 네트워크 탭에서 확인
- **HTTPS**: 모든 요청이 HTTPS로 이루어지는지, Mixed Content 경고가 없는지
- **.xfdl MIME 타입**: 네트워크 탭에서 `.xfdl` 파일의 Content-Type이 `application/xml` 또는 `text/xml`인지
- **캐시 무효화**: 이전 버전 파일이 브라우저 캐시에서 로드되지 않는지 (강력 새로고침으로 확인)
- **API 연결**: 주요 화면에서 데이터 조회·저장이 정상 동작하는지

빌드와 배포까지 완료되면 Nexacro N 개발 환경 구축의 전 과정이 마무리됩니다. 다음 글부터는 실제 화면 개발의 핵심인 Form 타입과 화면 구성 방식을 다룹니다.

---

**지난 글:** [TypeDef.xml과 Service.xml — 컴포넌트 등록과 서비스 URL 관리](/posts/nexacro-n-typedef-services/)

**다음 글:** [Form 타입 완전 정복 — MainFrame부터 PopupForm까지](/posts/nexacro-n-form-types/)

<br>
읽어주셔서 감사합니다. 😊
