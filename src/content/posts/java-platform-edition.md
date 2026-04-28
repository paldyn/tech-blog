---
title: "Java 플랫폼 에디션 — SE · ME · Jakarta EE"
description: "Java SE, Java ME, Jakarta EE(구 Java EE)의 차이와 역할을 이해하고, 실무에서 어떤 에디션이 어떤 맥락에서 쓰이는지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["java", "java-se", "jakarta-ee", "java-me", "platform", "enterprise"]
featured: false
draft: false
---

[지난 글](/posts/java-history/)에서 Java가 어떤 역사적 흐름 속에서 성장해 왔는지 살펴봤습니다. Java는 단순히 하나의 언어가 아니라, 서로 다른 목적을 위해 설계된 여러 **에디션(Edition)**으로 구성된 플랫폼 생태계입니다. "Java를 배운다"고 할 때 우리가 실제로 다루는 것은 Java SE이지만, 구직 공고나 프레임워크 문서에서 Java EE, Jakarta EE, Spring Framework 같은 용어를 마주치면 혼란스러울 수 있습니다. 이 글에서는 각 에디션의 설계 목적, 범위, 현재 상태를 정리하고, 실무에서 이들이 어떻게 연결되는지 살펴봅니다.

---

## Java SE — 모든 것의 토대

**Java SE(Standard Edition)**는 Java 생태계의 핵심입니다. 언어 사양(JLS), JVM 명세, 표준 라이브러리(Java Class Library)를 포함하며, 다른 모든 에디션의 기반이 됩니다.

SE가 제공하는 주요 영역은 다음과 같습니다.

| 영역 | 대표 패키지 |
|---|---|
| 기본 언어 지원 | `java.lang`, `java.math` |
| 자료구조 | `java.util` (Collections Framework) |
| 함수형 프로그래밍 | `java.util.function`, `java.util.stream` |
| 입출력 | `java.io`, `java.nio` |
| 네트워크 | `java.net`, `java.net.http` |
| 동시성 | `java.util.concurrent` |
| 모듈 시스템 | Java 9 이후 `java.base`, `java.sql` 등 |

SE의 관리 주체는 JCP(Java Community Process)이며, OpenJDK 커뮤니티가 레퍼런스 구현을 담당합니다. Oracle, Amazon Corretto, Eclipse Temurin 등 여러 벤더가 OpenJDK 기반의 배포판을 제공합니다.

---

## Java ME — 임베디드를 위한 경량 플랫폼

**Java ME(Micro Edition)**는 피처폰, 셋톱박스, 임베디드 컨트롤러처럼 메모리와 CPU가 극도로 제한된 환경을 위해 설계되었습니다. Java SE의 서브셋을 기반으로 하며, 두 가지 주요 구성 요소로 이루어집니다.

- **CLDC(Connected Limited Device Configuration)**: 최소한의 JVM과 핵심 라이브러리 (J2ME 시대의 기반)
- **MIDP(Mobile Information Device Profile)**: 피처폰 UI·네트워크·미디어 API

2000년대 초 피처폰 시대에는 Java ME가 모바일 애플리케이션의 사실상 표준이었습니다. 하지만 2007년 iPhone, 2008년 Android의 등장으로 스마트폰 시대가 열리면서 Java ME는 빠르게 시장 지위를 잃었습니다. 현재는 일부 산업용 IoT 기기와 스마트카드(Java Card) 환경에 흔적이 남아 있을 뿐, 신규 개발에서는 거의 사용되지 않습니다.

```java
// Java ME MIDP 시대의 MIDlet 예시 (역사적 참고용)
import javax.microedition.midlet.MIDlet;
import javax.microedition.lcdui.*;

public class HelloMidlet extends MIDlet {
    public void startApp() {
        Display display = Display.getDisplay(this);
        Form form = new Form("Hello");
        form.append("Hello, Java ME!");
        display.setCurrent(form);
    }

    public void pauseApp() {}
    public void destroyApp(boolean unconditional) {}
}
```

이 코드는 피처폰에서 실행되던 MIDlet(Mobile IDlet)의 전형적인 구조입니다. `MIDlet`이 `main()` 대신 `startApp()`, `pauseApp()`, `destroyApp()`으로 생명주기를 관리한다는 점이 특징입니다.

---

## Java EE에서 Jakarta EE로 — 엔터프라이즈 표준의 이관

**Java EE(Enterprise Edition)**는 대규모 서버 사이드 애플리케이션을 위한 사양 집합입니다. 트랜잭션 관리, 의존성 주입, 영속성, 웹 계층 등 엔터프라이즈 개발에 필요한 표준 API를 정의합니다.

Java EE는 2017년 Oracle이 Eclipse 재단에 이관하기로 결정하면서 역사적인 전환점을 맞습니다. 그런데 이관 과정에서 "Java"라는 상표를 Oracle이 양도하지 않았기 때문에, Eclipse 재단은 새 이름을 고민해야 했습니다. 커뮤니티 투표를 통해 **Jakarta EE**라는 이름이 선택되었고, Java EE 8이 Jakarta EE 8로 이어졌습니다.

> Java EE → Jakarta EE: 이름만 바뀐 게 아니라 패키지도 바뀌었습니다. `javax.*` → `jakarta.*`. 마이그레이션 시 주의가 필요한 이유입니다.

### Jakarta EE 아키텍처

Jakarta EE 애플리케이션은 전통적으로 세 개의 계층으로 구성됩니다.

![Jakarta EE 애플리케이션 아키텍처](/assets/posts/java-platform-edition-jakarta-ee.svg)

**Web Tier**는 HTTP 요청을 받아 처리합니다. `@WebServlet`으로 요청을 라우팅하거나, JAX-RS의 `@Path`와 `@GET`/`@POST`로 REST API를 선언합니다.

**Business Tier**는 비즈니스 로직을 담습니다. CDI(`@Inject`)로 의존성을 주입하고, JPA(`@Entity`, `@Repository`)로 데이터를 영속화하며, JTA(`@Transactional`)로 트랜잭션 경계를 선언합니다.

**Data Tier**는 RDBMS, NoSQL, 메시지 큐, 캐시 등 실제 데이터 저장소와 통신합니다.

```java
// Jakarta EE REST 엔드포인트 예시
import jakarta.inject.Inject;
import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;

@Path("/users")
@Produces(MediaType.APPLICATION_JSON)
public class UserResource {

    @Inject
    private UserService userService;  // CDI 의존성 주입

    @GET
    @Path("/{id}")
    public User getUser(@PathParam("id") Long id) {
        return userService.findById(id);
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public User createUser(User user) {
        return userService.save(user);
    }
}
```

Java SE라면 이 로직을 직접 HTTP 서버 소켓이나 `HttpServer`로 구현해야 하지만, Jakarta EE는 표준 애노테이션만으로 웹 계층을 선언적으로 구성할 수 있게 해줍니다.

---

## 에디션 비교 한눈에

![Java 플랫폼 에디션 비교](/assets/posts/java-platform-edition-editions.svg)

세 에디션의 관계를 요약하면 다음과 같습니다.

- **Java ME** ⊂ **Java SE**: ME는 SE의 서브셋입니다. SE의 모든 API를 사용할 수 없고, 경량화된 일부만 제공합니다.
- **Java SE** ⊂ **Jakarta EE** (개념적으로): EE는 SE를 기반으로 엔터프라이즈 사양을 추가한 확장입니다. Jakarta EE 서버(WildFly, GlassFish, Payara 등)는 내부적으로 Java SE JVM 위에서 동작합니다.

---

## 실무에서는 어떻게 쓰이나

현대 Java 백엔드 개발에서는 Jakarta EE 표준보다 **Spring Framework**가 사실상의 표준으로 자리잡고 있습니다. Spring은 Jakarta EE 사양 중 일부(JPA, JTA, Servlet 등)를 활용하면서, 독자적인 DI 컨테이너와 Auto Configuration을 통해 생산성을 극적으로 높였습니다.

| 구분 | 사용 맥락 |
|---|---|
| Java SE | 모든 Java 개발의 기반. CLI 도구, 라이브러리, 게임, Kotlin 앱 포함 |
| Jakarta EE | WildFly, Payara, Open Liberty 등 EE 서버 기반 레거시·엔터프라이즈 시스템 |
| Spring Boot | Jakarta EE 사양 + 독자 생태계. 신규 Java 백엔드의 주류 |
| Java ME | 레거시 IoT·임베디드. 신규 개발에서는 거의 사용 안 함 |

따라서 Java를 처음 배울 때는 **Java SE** 개념을 확실히 잡는 것이 가장 중요합니다. 엔터프라이즈 개발에 관심이 있다면 Jakarta EE의 핵심 사양(JPA, CDI, JAX-RS)을 이해한 뒤 Spring Boot로 넘어가는 경로가 일반적입니다.

---

## 정리

Java 플랫폼은 단일 에디션이 아니라 목적에 따라 분리된 에디션의 집합입니다.

- **Java SE**: 핵심 언어와 표준 라이브러리. 모든 에디션의 토대
- **Java ME**: 제한된 환경용 경량 서브셋. 피처폰 시대 유산
- **Jakarta EE**: 엔터프라이즈 표준 사양. Oracle → Eclipse 재단 이관 후 패키지명 변경

오늘날 대부분의 개발자는 Java SE를 직접 사용하거나, Spring Boot처럼 Jakarta EE 사양을 추상화한 프레임워크를 통해 간접적으로 접합니다. 어떤 경로로 입문하든, SE의 핵심 개념을 탄탄히 이해하는 것이 장기적으로 가장 효율적인 투자입니다.

---

**지난 글:** [Java 역사 (1991 ~ 2023+)](/posts/java-history/)

**다음 글:** [Java LTS와 릴리즈 사이클](/posts/java-lts-release-cycle/)

<br>
읽어주셔서 감사합니다. 😊
