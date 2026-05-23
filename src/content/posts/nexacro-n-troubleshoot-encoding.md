---
title: "[Nexacro N] 트러블슈팅: 인코딩 문제"
description: "Nexacro N 애플리케이션에서 발생하는 한글 깨짐·인코딩 불일치 문제를 진단하고 해결하는 방법을 설명합니다. 클라이언트·서버·DB 전 구간 UTF-8 통일 방법과 자주 놓치는 설정 포인트를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-23"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "트러블슈팅", "인코딩", "UTF-8", "한글깨짐", "charset", "NLS_CHARACTERSET"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-troubleshoot-timezone/)에서 타임존 불일치 문제를 다루었다. 이번에는 Nexacro N 프로젝트에서 빈번하게 만나는 **한글 깨짐·인코딩 불일치 문제**를 살펴본다. 증상이 간단해 보여도 클라이언트·서버·DB 세 구간 중 어느 한 곳이라도 설정이 어긋나면 문제가 재현되므로, 전 구간을 체계적으로 점검하는 방법이 중요하다.

## 문제 발생 구조

인코딩 문제는 데이터 흐름의 특정 지점에서 CharSet 변환이 일어날 때 발생한다.

![인코딩 문제 발생 경로](/assets/posts/nexacro-n-troubleshoot-encoding-flow.svg)

Nexacro는 기본적으로 UTF-8을 사용한다. 그러나 서버나 DB가 EUC-KR이거나, 서블릿 컨테이너에 URIEncoding 설정이 빠진 경우, 각 구간 경계에서 한글이 깨진다.

## 증상별 원인 분류

| 증상 | 유력한 원인 구간 |
|------|---------------|
| 검색 조건(한글) 전송 후 서버에서 `???` | 서블릿 필터 `setCharacterEncoding` 미설정 |
| 조회 결과 한글이 화면에서 깨짐 | WAS 응답 Content-Type charset 불일치 |
| DB 저장 후 조회 시 깨짐 | DB NLS_CHARACTERSET 또는 JDBC 연결 설정 |
| POST는 정상인데 GET 파라미터만 깨짐 | Tomcat `URIEncoding` 미설정 |
| 빌드 결과물만 깨짐 | 빌드 옵션 charset 누락 |

## 원인 1: Nexacro 클라이언트 측 설정 누락

`TypeDefinition.xml`의 서비스 URL 설정과 애플리케이션 메타 선언이 UTF-8로 맞춰져 있어야 한다.

```xml
<!-- TypeDefinition.xml -->
<Url name="svcDefault"
     url="http://server/service"
     charset="utf-8"
     method="POST"/>
```

빌드 결과물의 HTML `<head>`에도 `<meta charset="UTF-8">` 이 있어야 한다. 빌드 설정 파일에서 누락되면 일부 브라우저에서 기본 인코딩으로 해석한다.

## 원인 2: Java 서블릿 필터 미설정

Spring Boot나 Tomcat 기반 서버에서 가장 자주 놓치는 설정이다.

```java
// Spring Boot — CharacterEncodingFilter 등록
@Bean
public FilterRegistrationBean<CharacterEncodingFilter> encodingFilter() {
    FilterRegistrationBean<CharacterEncodingFilter> bean =
        new FilterRegistrationBean<>();
    CharacterEncodingFilter filter = new CharacterEncodingFilter();
    filter.setEncoding("UTF-8");
    filter.setForceEncoding(true); // 응답도 강제 적용
    bean.setFilter(filter);
    bean.addUrlPatterns("/*");
    bean.setOrder(Ordered.HIGHEST_PRECEDENCE);
    return bean;
}
```

`forceEncoding=true` 를 빠뜨리면 응답 인코딩이 서블릿 기본값(ISO-8859-1)으로 나갈 수 있다.

## 원인 3: Tomcat URIEncoding 누락 (GET 파라미터)

GET 방식 파라미터는 요청 본문이 아닌 URL 쿼리 스트링으로 전달되므로, `CharacterEncodingFilter`가 아닌 Tomcat의 `URIEncoding` 설정이 적용된다.

```xml
<!-- conf/server.xml -->
<Connector port="8080" protocol="HTTP/1.1"
           connectionTimeout="20000"
           URIEncoding="UTF-8"
           useBodyEncodingForURI="true"
           redirectPort="8443"/>
```

Nexacro 트랜잭션은 POST를 기본으로 사용하지만, 일부 파라미터나 Custom URL 요청은 GET으로 나갈 수 있으므로 설정해두는 것이 안전하다.

## 원인 4: JDBC 연결 URL 인코딩

MySQL 등 일부 DB는 JDBC 연결 URL에 명시적인 CharSet 파라미터를 요구한다.

```properties
# MySQL
spring.datasource.url=jdbc:mysql://localhost:3306/mydb\
  ?useUnicode=true&characterEncoding=UTF-8\
  &serverTimezone=Asia/Seoul

# Oracle (JDBC URL에는 없고 NLS_LANG 환경변수 또는 JVM 옵션으로)
# -Dfile.encoding=UTF-8
# -Doracle.jdbc.defaultNChar=true
```

## 원인 5: DB 자체 CharSet 불일치

기존 EUC-KR DB에 UTF-8 데이터를 저장하거나, 컬럼별 CharSet이 혼재하는 경우 발생한다.

```sql
-- Oracle: DB 및 국가 CharSet 확인
SELECT parameter, value
FROM nls_database_parameters
WHERE parameter IN ('NLS_CHARACTERSET', 'NLS_NCHAR_CHARACTERSET');

-- 권장: AL32UTF8 (Oracle), utf8mb4 (MySQL)
```

이미 EUC-KR로 운영 중인 DB라면 마이그레이션 없이 단순 설정 변경으로는 해결이 어렵다. 신규 프로젝트는 반드시 UTF-8(Oracle은 AL32UTF8)로 시작한다.

## 설정 체크리스트 요약

![인코딩 설정 체크리스트](/assets/posts/nexacro-n-troubleshoot-encoding-fix.svg)

## 빠른 진단 방법

깨짐이 어느 구간에서 발생하는지 좁히는 순서는 다음과 같다.

```javascript
// 1. Nexacro Studio 로그 — Dataset 값 직접 확인
//    한글이 Dataset에 올바르게 들어있는가?
trace(ds_list.getColumn(0, "itemName"));

// 2. 브라우저 DevTools → Network 탭
//    요청 페이로드에서 한글이 UTF-8 퍼센트 인코딩으로 나가는지 확인
//    응답 Content-Type에 charset=UTF-8 있는지 확인

// 3. 서버 로그 — 수신 파라미터 출력
//    request.getParameter("keyword") 값이 한글로 올바른지 확인

// 4. DB 직접 조회
//    SELECT dump(컬럼명, 1016) FROM ... 로 실제 바이트 확인 (Oracle)
```

문제 구간을 식별하면 해당 설정만 수정해도 된다. 단, 한 곳을 고쳤을 때 다른 구간에서 이중 인코딩(UTF-8을 두 번 인코딩)이 발생하지 않는지 확인한다.

## 흔한 함정: 이중 인코딩

```javascript
// 잘못된 예: encodeURIComponent를 불필요하게 적용
var keyword = encodeURIComponent(ed_keyword.value);
// Nexacro가 이미 UTF-8로 전송하는데 추가 인코딩 → 서버에서 %EA%B0%80 형태로 수신

// 올바른 예: Nexacro 트랜잭션은 인코딩을 직접 다루지 않아도 됨
var keyword = ed_keyword.value; // 그대로 Dataset에 넣고 트랜잭션
```

---

**지난 글:** [트러블슈팅: 타임존 문제](/posts/nexacro-n-troubleshoot-timezone/)

**다음 글:** [트러블슈팅: 팝업 차단 문제](/posts/nexacro-n-troubleshoot-popup-blocked/)

<br>
읽어주셔서 감사합니다. 😊
