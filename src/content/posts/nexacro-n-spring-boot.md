---
title: "[Nexacro N] Spring Boot 연동"
description: "Nexacro N 프론트엔드와 Spring Boot 백엔드를 연동하는 방법을 설명합니다. Java 어댑터 의존성 추가, NexacroController 설정, @NexaService 서비스 클래스 작성, 트랜잭션 매핑까지 단계별로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "spring-boot", "java어댑터", "NexaService", "백엔드연동", "트랜잭션"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-adapter-overview/)에서 어댑터의 전체 역할과 종류를 살펴보았다. 이번에는 국내 기업 프로젝트에서 가장 많이 사용하는 Spring Boot와의 연동을 구체적인 코드로 설명한다.

Nexacro N의 Java 어댑터는 Spring MVC 위에서 동작한다. `@NexaService` 어노테이션으로 서비스 클래스를 선언하고, 클라이언트의 `transaction()` 호출이 해당 메서드에 자동으로 라우팅되는 구조다.

## 프로젝트 구조

![Nexacro N + Spring Boot 통합 구조](/assets/posts/nexacro-n-spring-boot-arch.svg)

Spring Boot 프로젝트에 Nexacro 어댑터를 추가하면 컨트롤러 레이어에 `NexacroController`가 등록된다. 이 컨트롤러가 모든 Nexacro 트랜잭션 요청을 받아 PL을 파싱한 뒤 해당 서비스 클래스의 메서드를 호출한다.

## 의존성 및 설정 코드

![Spring Boot 어댑터 설정 코드](/assets/posts/nexacro-n-spring-boot-code.svg)

Nexacro Java 어댑터 JAR을 로컬 Maven 저장소나 사내 Nexus에 배포한 뒤 Gradle 또는 Maven 의존성으로 추가한다.

```groovy
// build.gradle
dependencies {
    implementation "nexacro:nexacro-xapi-java:2.0"
    implementation "org.springframework.boot:spring-boot-starter-web"
    implementation "org.springframework.boot:spring-boot-starter-data-jpa"
    implementation "org.mybatis.spring.boot:mybatis-spring-boot-starter:3.0.3"
}
```

`application.yml`에 Nexacro 어댑터가 사용할 엔드포인트 URL과 인코딩을 설정한다.

```yaml
nexacro:
  service-url: /nexacro/svc
  charset: UTF-8
  debug: false
```

## 서비스 클래스 작성

서비스 클래스는 `@NexaService`와 `@Service`를 함께 선언한다. 메서드 이름이 클라이언트 `transaction()` 서비스 ID의 메서드명과 매핑된다.

```java
@NexaService
@Service
public class UserService {

    @Autowired
    private UserMapper userMapper;

    public void search(
            DataSet dsSearch,
            DataSet dsResult,
            VariableList vl) throws NexaServiceException {

        String userId = dsSearch.getStringColumn(0, "USER_ID");
        String userNm = dsSearch.getStringColumn(0, "USER_NM");

        List<Map<String, Object>> list = userMapper.selectUsers(userId, userNm);
        NexacroUtils.copyToDataSet(list, dsResult);
    }

    public void save(
            DataSet dsUser,
            DataSet dsResult,
            VariableList vl) throws NexaServiceException {

        for (int i = 0; i < dsUser.getRowCount(); i++) {
            int rowType = dsUser.getRowType(i);
            if (rowType == DataSet.ROW_TYPE_INSERTED) {
                userMapper.insertUser(NexacroUtils.rowToMap(dsUser, i));
            } else if (rowType == DataSet.ROW_TYPE_UPDATED) {
                userMapper.updateUser(NexacroUtils.rowToMap(dsUser, i));
            } else if (rowType == DataSet.ROW_TYPE_DELETED) {
                userMapper.deleteUser(dsUser.getStringColumn(i, "USER_ID"));
            }
        }
        vl.addVariable("errCode", "0");
        vl.addVariable("errMsg", "정상 처리되었습니다.");
    }
}
```

`dsUser.getRowType(i)`로 행 상태(삽입·수정·삭제)를 확인하고 각각 다른 쿼리를 실행하는 패턴이 표준이다.

## 클라이언트 transaction 호출

```nexacro
// 검색 트랜잭션
function fn_search() {
    this.transaction(
        "search",
        "SVC::UserService::search",
        "in:dsSearch",
        "out:dsResult",
        "",
        "fn_searchCallback"
    );
}

// 저장 트랜잭션 (변경된 행만 전송)
function fn_save() {
    this.transaction(
        "save",
        "SVC::UserService::save",
        "in:dsUser",
        "out:dsResult",
        "",
        "fn_saveCallback"
    );
}

function fn_searchCallback(id, errCode, errMsg) {
    if (errCode != 0) {
        alert("오류: " + errMsg);
        return;
    }
    // dsResult가 자동으로 Grid에 반영됨
}
```

`transaction()` 두 번째 인자의 형식은 `SVC::{ServiceClassName}::{methodName}`이다. 어댑터가 이 문자열을 파싱해 Spring 컨텍스트에서 해당 빈과 메서드를 찾는다.

## 오류 처리

서비스 메서드에서 예외가 발생하면 어댑터가 PL 오류 응답으로 변환해 클라이언트에 전달한다. 클라이언트 콜백의 `errCode`가 0이 아니면 오류다.

```java
public void search(DataSet dsIn, DataSet dsOut, VariableList vl)
        throws NexaServiceException {
    if (dsIn.getRowCount() == 0) {
        throw new NexaServiceException("ERR001", "검색 조건이 없습니다.");
    }
    // 정상 처리
}
```

`NexaServiceException`의 첫 번째 인자가 `errCode`, 두 번째가 `errMsg`로 클라이언트에 전달된다.

## CORS 설정

개발 중 Nexacro N Studio가 로컬에서 실행되고 Spring Boot 서버가 별도 포트에서 동작할 때 CORS 문제가 발생한다. 개발 프로파일에서만 CORS를 허용하도록 설정한다.

```java
@Configuration
@Profile("dev")
public class CorsConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/nexacro/**")
                .allowedOrigins("http://localhost:8080")
                .allowedMethods("POST");
    }
}
```

---

**지난 글:** [Nexacro N 어댑터 개요](/posts/nexacro-n-adapter-overview/)

**다음 글:** [Java 어댑터 심화](/posts/nexacro-n-java-adapter/)

<br>
읽어주셔서 감사합니다. 😊
