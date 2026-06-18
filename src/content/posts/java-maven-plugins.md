---
title: "Maven 플러그인 — 빌드를 확장하는 법"
description: "Maven의 모든 기능은 플러그인으로 구현됩니다. 플러그인이란 무엇이고 Goal·Phase와 어떻게 연결되는지, pom.xml에서 어떻게 설정하는지, 그리고 실무에서 자주 쓰는 플러그인들을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-19"
archiveOrder: 9
type: "knowledge"
category: "Java"
tags: ["Java", "Maven", "빌드", "플러그인", "pom.xml"]
featured: false
draft: false
---

[지난 글](/posts/java-maven-lifecycle/)에서 Maven 라이프사이클의 단계(phase)들이 어떻게 이어지는지 살펴봤습니다. 그런데 각 단계에서 실제로 일어나는 일 — 소스를 컴파일하고, 테스트를 실행하고, JAR를 만드는 것 — 은 누가 담당할까요? 바로 **플러그인(Plugin)** 입니다. Maven 자체는 라이프사이클이라는 뼈대만 제공하고, 살을 붙이는 것은 모두 플러그인의 몫입니다.

## 플러그인이란 무엇인가

Maven 플러그인은 **Goal의 모음**입니다. Goal은 Maven이 실행할 수 있는 가장 작은 단위의 작업입니다. 예를 들어 `maven-compiler-plugin`에는 `compile`(메인 소스 컴파일)과 `testCompile`(테스트 소스 컴파일)이라는 두 Goal이 있습니다.

플러그인은 크게 두 종류로 나뉩니다.

- **Build Plugin**: 라이프사이클의 특정 phase에 바인딩되어 `mvn package` 같은 명령으로 자동 실행됩니다.
- **Reporting Plugin**: `mvn site` 실행 시 보고서(JavaDoc, 테스트 결과 등)를 생성합니다.

![Maven 플러그인 구조](/assets/posts/java-maven-plugins-overview.svg)

## 핵심 내장 플러그인

Maven은 빌드를 동작시키기 위해 여러 플러그인을 기본으로 사용합니다. 가장 중요한 것들만 추려 보면 다음과 같습니다.

| 플러그인 | 주요 Goal | 역할 |
|---|---|---|
| `maven-compiler-plugin` | `compile`, `testCompile` | Java 소스 컴파일 |
| `maven-surefire-plugin` | `test` | JUnit/TestNG 단위 테스트 실행 |
| `maven-jar-plugin` | `jar` | JAR 아티팩트 생성 |
| `maven-install-plugin` | `install` | 로컬 저장소에 설치 |
| `maven-deploy-plugin` | `deploy` | 원격 저장소에 배포 |
| `maven-resources-plugin` | `resources` | 리소스 파일 복사 |

이 플러그인들은 `groupId`가 `org.apache.maven.plugins`이기 때문에 pom.xml에서 `groupId`를 생략해도 됩니다. Maven이 자동으로 찾아 줍니다.

## 실무에서 자주 쓰는 플러그인

기본 플러그인 외에도 실제 프로젝트에서 자주 추가하는 플러그인들이 있습니다.

**maven-shade-plugin / maven-assembly-plugin**  
의존성을 모두 포함한 실행 가능한 Fat JAR(Uber JAR)을 만들 때 씁니다. `shade`는 클래스 재배치(relocation)로 클래스 충돌을 방지할 수 있어 라이브러리 배포에 유리하고, `assembly`는 더 유연한 패키징 설정을 제공합니다.

**maven-failsafe-plugin**  
통합 테스트(Integration Test)를 위한 플러그인입니다. `surefire`가 단위 테스트용이라면 `failsafe`는 `integration-test` phase에 바인딩되어 애플리케이션이 실행 중인 상태에서 테스트를 돌립니다. 테스트가 실패해도 `post-integration-test` phase의 리소스 정리가 먼저 실행된다는 점이 차이입니다.

**exec-maven-plugin**  
`mvn exec:java` 명령으로 `main()` 메서드를 직접 실행할 수 있습니다. IDE 없이 빠르게 실행 결과를 확인할 때 편리합니다.

**versions-maven-plugin**  
`mvn versions:display-dependency-updates`로 의존성 버전 업데이트 현황을 확인하고, `mvn versions:set -DnewVersion=2.0.0`으로 프로젝트 버전을 일괄 변경할 수 있습니다.

**maven-enforcer-plugin**  
빌드 환경에 대한 규칙을 강제합니다. "Java 17 미만에서는 빌드 실패", "특정 의존성 버전 사용 금지" 같은 정책을 pom.xml에 선언해 팀 전체에 일관된 환경을 보장할 수 있습니다.

**spring-boot-maven-plugin**  
Spring Boot 프로젝트에서 사용하는 플러그인으로, 실행 가능한 JAR/WAR를 만들고 `mvn spring-boot:run`으로 애플리케이션을 직접 구동할 수 있습니다.

## pom.xml에서 플러그인 설정하기

플러그인을 설정하려면 `<build><plugins>` 블록 안에 선언합니다. 구조는 의존성 선언과 비슷하게 좌표(groupId·artifactId·version)로 식별합니다.

```xml
<build>
  <plugins>
    <plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-compiler-plugin</artifactId>
      <version>3.13.0</version>
      <configuration>
        <release>17</release>
      </configuration>
    </plugin>

    <plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-shade-plugin</artifactId>
      <version>3.5.0</version>
      <executions>
        <execution>
          <phase>package</phase>
          <goals>
            <goal>shade</goal>
          </goals>
          <configuration>
            <createDependencyReducedPom>false</createDependencyReducedPom>
          </configuration>
        </execution>
      </executions>
    </plugin>
  </plugins>
</build>
```

설정의 핵심 구조는 세 가지입니다.

1. **좌표**: `groupId + artifactId + version`으로 플러그인을 특정합니다.
2. **`<executions>`**: 어떤 Goal을 어느 `<phase>`에 바인딩할지 선언합니다. 하나의 플러그인에 여러 execution을 선언할 수 있습니다.
3. **`<configuration>`**: 플러그인별 파라미터를 설정합니다. execution 안에 두면 해당 실행에만, 밖에 두면 전역으로 적용됩니다.

![pom.xml 플러그인 설정 구조](/assets/posts/java-maven-plugins-config.svg)

## Goal을 직접 실행하기

플러그인의 Goal은 라이프사이클을 통하지 않고 직접 실행할 수도 있습니다. 형식은 `mvn 플러그인이름:goal이름`입니다.

```bash
# compiler 플러그인의 compile goal만 실행
mvn compiler:compile

# shade 플러그인의 shade goal만 실행
mvn shade:shade

# exec 플러그인으로 main 클래스 실행
mvn exec:java -Dexec.mainClass=com.example.App

# versions 플러그인으로 업데이트 가능한 의존성 확인
mvn versions:display-dependency-updates
```

`org.apache.maven.plugins` groupId를 가진 플러그인은 짧은 이름(`compiler`, `surefire` 등)으로 지정할 수 있습니다. 다른 groupId의 플러그인은 전체 플러그인 prefix나 groupId를 명시해야 합니다.

## 플러그인 관리: pluginManagement

멀티 모듈 프로젝트에서는 `<pluginManagement>` 블록을 부모 pom에 선언해 버전을 일원화합니다. `pluginManagement`에 선언된 플러그인은 버전·설정만 정의하고, 실제 활성화는 자식 pom의 `<plugins>` 블록에서 선언할 때 일어납니다. 의존성의 `<dependencyManagement>`와 정확히 같은 패턴입니다.

```xml
<!-- 부모 pom.xml -->
<build>
  <pluginManagement>
    <plugins>
      <plugin>
        <artifactId>maven-compiler-plugin</artifactId>
        <version>3.13.0</version>
        <configuration>
          <release>17</release>
        </configuration>
      </plugin>
    </plugins>
  </pluginManagement>
</build>
```

## 정리

Maven의 모든 실제 작업은 플러그인이 수행합니다. 플러그인은 Goal의 모음이고, Goal은 execution을 통해 라이프사이클의 특정 phase에 바인딩됩니다. 이 구조를 이해하면 "mvn package가 왜 컴파일→테스트→패키징 순서로 진행되는가"를 완전히 설명할 수 있습니다. 다음 글에서는 Maven과 다른 철학으로 접근하는 Gradle을 살펴봅니다.

---

**지난 글:** [Maven 라이프사이클 — 빌드 단계 완전 이해](/posts/java-maven-lifecycle/)

**다음 글:** [Gradle 입문 — 유연한 빌드 자동화](/posts/java-build-gradle/)

<br>
읽어주셔서 감사합니다. 😊
