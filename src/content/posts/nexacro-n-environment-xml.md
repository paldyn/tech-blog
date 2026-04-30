---
title: "[Nexacro N] Environment.xml 완전 해부 — 서버 연결·프로토콜·인코딩 설정"
description: "Nexacro N 프로젝트의 Environment.xml 파일 구조와 Properties, Service, Protocol, Session 설정 블록의 역할을 실전 예시와 함께 상세히 설명합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 6
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "Environment.xml", "서버설정", "프로토콜", "인코딩", "세션"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-project-structure/)에서 Nexacro N 프로젝트의 전체 파일 구조를 살펴봤습니다. 그 중에서 `Environment.xml`은 가장 처음으로 손대야 하는 파일이자, 잘못 건드리면 앱 전체가 멈추는 민감한 설정 파일입니다. 서버 주소, 통신 프로토콜, 인코딩, 세션 타임아웃까지 운영 환경의 핵심 변수가 모두 이 파일 안에 담겨 있습니다. 이번 글에서는 `Environment.xml`의 모든 설정 블록을 실전 예시와 함께 낱낱이 해부합니다.

## Environment.xml 이란

`Environment.xml`은 Nexacro N 앱이 기동될 때 **런타임이 가장 먼저 읽는 설정 파일**입니다. 여기에 정의된 값들은 앱 실행 내내 유효하며, 스크립트로는 `nexacro.getEnvironment()` 객체를 통해 일부 값을 읽거나 변경할 수 있습니다.

![Environment.xml 구조와 주요 설정 블록](/assets/posts/nexacro-n-environment-xml-structure.svg)

파일은 크게 5개 블록으로 구성됩니다.

| 블록 | 역할 |
|------|------|
| `<Properties>` | 앱 기본 속성 (인코딩, 스타일, 테마) |
| `<Service>` | 서버 접속 URL (baseurl, formurl, imageurl) |
| `<Protocol>` | 통신 프로토콜 및 압축 설정 |
| `<Session>` | 세션 타임아웃·알림 설정 |
| `<FileUpload>` | 파일 업로드/다운로드 경로 설정 |

## Properties 블록 — 인코딩과 테마

```xml
<Properties
  encoding="utf-8"
  charsettype="utf-8"
  loadstyle="default"
  theme="white"
  enableshortcut="true"
/>
```

`encoding`은 HTTP 요청/응답 시 사용할 문자 인코딩, `charsettype`은 데이터셋 처리에 사용할 인코딩입니다. 대부분의 신규 프로젝트는 둘 다 `utf-8`로 통일하지만, 오래된 레거시 시스템과 연동할 때는 서버 설정에 맞춰 `euc-kr`로 변경해야 합니다.

`loadstyle`은 앱 기동 시 자동으로 로드할 StyleSheet 파일 이름이며, `theme`는 기본 테마를 지정합니다. 이 두 값은 Studio N의 Style 탭에서도 변경 가능합니다.

## Service 블록 — 서버 URL 분리 전략

```xml
<Service
  baseurl="https://api.myapp.com"
  formurl="https://cdn.myapp.com/forms"
  imageurl="https://cdn.myapp.com/images"
/>
```

세 URL의 역할을 명확히 이해하는 것이 중요합니다.

- **`baseurl`**: `transaction()` 호출 시 서비스 URL 앞에 자동으로 붙는 기본 경로입니다. `Service.xml`에 등록된 URL이 상대 경로이면 `baseurl + 상대경로`가 최종 요청 주소가 됩니다.
- **`formurl`**: `.xfdl` 파일을 다운로드하는 서버 주소입니다. API 서버와 Form 파일 서버를 분리(CDN 활용)할 때 `baseurl`과 다른 호스트를 지정합니다.
- **`imageurl`**: 이미지 리소스를 로드하는 서버 주소입니다.

실무에서는 개발/스테이징/운영 환경별로 별도 `Environment.xml`을 두고 빌드 시 교체하는 방식을 사용합니다.

```
config/
├── Environment.dev.xml      ← 로컬 개발
├── Environment.stage.xml    ← 스테이징 서버
└── Environment.prod.xml     ← 운영 서버
```

빌드 스크립트에서 `DEPLOY_ENV` 변수를 읽어 적절한 파일을 `Environment.xml`로 복사한 뒤 빌드합니다.

## Protocol 블록 — 통신 방식 선택

![Environment.xml 실전 설정 예시](/assets/posts/nexacro-n-environment-xml-code.svg)

```xml
<Protocol
  type="HTTPProtocol"
  encoding="utf-8"
  compress="true"
  ssl="true"
/>
```

`type` 속성에는 두 가지 선택지가 있습니다.

**`HTTPProtocol`** — 표준 HTTP/HTTPS 방식. 서버에 Nexacro 전용 어댑터 없이도 JSON, XML 등 일반 REST API와 통신할 수 있습니다. 신규 프로젝트 기본값으로 권장합니다.

**`PLProtocol`** — Nexacro 전용 바이너리 프로토콜. 데이터 전송량이 많은 기업 시스템에서 압축 효율이 높습니다. 단, 서버 측에 Nexacro 어댑터(Java, .NET 등)가 반드시 설치되어야 합니다.

`compress="true"`로 설정하면 요청/응답 데이터를 gzip으로 압축해 네트워크 트래픽을 줄일 수 있습니다. 대량 데이터를 다루는 그리드 화면에서 체감 성능 차이가 납니다.

## Session 블록 — 세션 타임아웃 제어

```xml
<Session
  timeout="1800"
  alerttype="msgbox"
  alertmessage="세션이 만료되었습니다. 다시 로그인하세요."
  keepalive="true"
  keepaliveurl="/session/keepalive.do"
  keepaliveinterval="600"
/>
```

`timeout`은 초 단위이며 `1800`은 30분입니다. `0`으로 설정하면 타임아웃 없이 동작합니다.

`alerttype`은 세션 만료 시 알림 방식입니다.

- `msgbox`: 팝업 메시지박스 표시
- `none`: 알림 없이 처리 (커스텀 이벤트 핸들러 연동 시 사용)

`keepalive`는 사용자가 오래 화면을 열어두더라도 서버 세션이 끊기지 않도록 주기적으로 ping 요청을 보내는 기능입니다. `keepaliveinterval`은 초 단위 간격입니다.

## FileUpload 블록 — 파일 처리 설정

```xml
<FileUpload
  uploadurl="/file/upload.do"
  downloadurl="/file/download.do"
  maxfilesize="10240"
  maxfilecount="5"
  encoding="utf-8"
/>
```

`maxfilesize`는 KB 단위이며, 위 예시는 10MB 제한입니다. 서버의 파일 크기 제한(nginx `client_max_body_size`, Tomcat `maxPostSize` 등)과 반드시 일치시켜야 합니다. 클라이언트와 서버 제한이 다르면 서버에서 거부된 요청이 Nexacro 에러 코드 없이 응답하지 않는 문제가 생깁니다.

## Script에서 환경 설정 읽기

런타임에 설정 값을 읽어야 할 때는 `nexacro.getEnvironment()`를 사용합니다.

```javascript
function fn_getServerUrl() {
  var oEnv    = nexacro.getEnvironment();
  var sBaseUrl = oEnv.service.baseurl;
  return sBaseUrl;
}

// 세션 타임아웃 값 동적 변경
function fn_extendSession() {
  var oEnv = nexacro.getEnvironment();
  oEnv.session.timeout = 3600; // 1시간으로 연장
}
```

단, `session.timeout`처럼 일부 값은 런타임 변경이 가능하지만, `service.baseurl`이나 `protocol.type` 같은 핵심 항목은 앱 재기동 없이는 반영되지 않습니다.

## 환경별 배포 실전 패턴

CI/CD 파이프라인에서 환경별 Environment.xml을 자동으로 교체하는 간단한 예시입니다.

```bash
#!/bin/bash
# build.sh
DEPLOY_ENV=${1:-dev}  # 인자로 dev / stage / prod

cp "config/Environment.${DEPLOY_ENV}.xml" \
   "src/Environment.xml"

# Nexacro 빌드 실행
./nexacro-build.sh --output dist/
```

이 방식을 사용하면 소스 코드에 서버 주소를 하드코딩하지 않고도 환경별 배포가 가능합니다. `config/` 폴더는 Git에 포함하되, 민감한 운영 환경 URL이 있다면 Vault나 AWS Secrets Manager에서 빌드 시 주입받는 방식을 고려하세요.

---

**지난 글:** [[Nexacro N] 프로젝트 구조 완전 해부 — 파일·폴더 역할 총정리](/posts/nexacro-n-project-structure/)

**다음 글:** [[Nexacro N] TypeDef.xadl과 서비스 정의 — 컴포넌트 등록과 URL 매핑 완전 정복](/posts/nexacro-n-typedef-services/)

<br>
읽어주셔서 감사합니다. 😊
