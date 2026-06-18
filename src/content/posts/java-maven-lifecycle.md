---
title: "Maven 라이프사이클 — 빌드 단계 완전 이해"
description: "Maven의 3대 빌드 라이프사이클(clean, default, site)과 default 라이프사이클의 주요 페이즈 흐름, 페이즈와 플러그인 골의 관계, 패키징 타입에 따른 기본 바인딩, 페이즈와 골의 실행 방식 차이를 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-19"
archiveOrder: 8
type: "knowledge"
category: "Java"
tags: ["Java", "Maven", "빌드 라이프사이클", "플러그인", "빌드 도구"]
featured: false
draft: false
---

[지난 글](/posts/java-build-maven/)에서 Maven의 기본 개념과 `pom.xml` 구조, 표준 디렉토리 레이아웃을 살펴봤습니다. `mvn package`를 실행하면 컴파일과 테스트가 먼저 실행된다고 언급했는데, 왜 그런지를 설명하는 것이 바로 **Maven 라이프사이클**입니다.

## 라이프사이클이란

Maven은 빌드 과정 전체를 **라이프사이클(lifecycle)** 이라는 개념으로 정의합니다. 라이프사이클은 순서가 정해진 **페이즈(phase)** 들의 연속입니다. `mvn`에 페이즈 이름을 지정하면, 그 페이즈에 도달하기까지의 **모든 이전 페이즈가 순서대로 실행**됩니다. 이것이 Maven의 누적 실행 원칙입니다.

Maven에는 목적이 다른 세 가지 내장 라이프사이클이 있습니다.

![Maven 3대 빌드 라이프사이클](/assets/posts/java-maven-lifecycle-overview.svg)

## 세 가지 라이프사이클

### clean 라이프사이클

이전 빌드 결과물을 삭제하는 용도입니다. 페이즈는 `pre-clean` → `clean` → `post-clean` 세 단계뿐이며, `mvn clean`을 실행하면 `target/` 디렉토리가 삭제됩니다. 새로운 빌드 전에 항상 실행하는 것이 좋습니다.

### site 라이프사이클

프로젝트 문서 사이트를 생성하는 용도입니다. `mvn site`를 실행하면 Javadoc, 의존성 보고서, 테스트 커버리지 리포트 등이 HTML로 생성됩니다. 일반 개발 과정에서는 자주 쓰이지 않지만, CI 파이프라인에서 문서 자동화에 활용합니다.

### default 라이프사이클

실제 코드를 컴파일하고, 테스트하고, 패키지를 만들고, 배포하는 **핵심 라이프사이클**입니다. 가장 많은 페이즈를 포함합니다.

## default 라이프사이클 — 주요 페이즈

default 라이프사이클에는 수십 개의 페이즈가 있지만, 실제로 자주 접하는 핵심 페이즈는 다음 여섯 개입니다.

| 페이즈 | 설명 |
|---|---|
| `validate` | `pom.xml`이 올바른지, 필요한 정보가 모두 있는지 검증 |
| `compile` | `src/main/java` 소스 코드를 바이트코드로 컴파일 |
| `test` | `src/test/java`의 단위 테스트를 실행 (실패하면 빌드 중단) |
| `package` | 컴파일된 코드를 JAR 또는 WAR로 패키징 |
| `verify` | 통합 테스트 등 추가 품질 검사 실행 |
| `install` | 패키지를 로컬 저장소(`~/.m2`)에 설치 |
| `deploy` | 패키지를 원격 저장소에 업로드 (CI/CD 환경) |

이 페이즈들은 위에서 아래 방향으로 누적 실행됩니다. `mvn install`을 실행하면 `validate`부터 `install`까지 모두 실행됩니다.

```bash
# validate + compile + test + package + verify + install 순으로 실행
mvn install

# 테스트 건너뛰기 (빠른 빌드, 권장하지 않음)
mvn package -DskipTests
```

## 페이즈와 플러그인 골의 관계

페이즈 자체는 추상적인 단계 이름입니다. 실제 작업은 **플러그인 골(plugin goal)** 이 수행합니다. 페이즈에 골이 **바인딩(binding)** 되어 있어서, 페이즈가 실행될 때 연결된 골이 함께 실행됩니다.

골의 표기 형식은 `플러그인이름:골이름`입니다. 예를 들어 `compile` 페이즈에는 `maven-compiler-plugin:compile` 골이 기본으로 바인딩되어 있습니다.

```xml
<!-- 플러그인 설정 예시 (pom.xml) -->
<build>
  <plugins>
    <plugin>
      <groupId>org.apache.maven.plugins</groupId>
      <artifactId>maven-compiler-plugin</artifactId>
      <version>3.12.1</version>
      <configuration>
        <source>21</source>
        <target>21</target>
      </configuration>
    </plugin>
  </plugins>
</build>
```

## 패키징 타입에 따른 기본 바인딩

`pom.xml`의 `<packaging>` 값에 따라 각 페이즈에 바인딩되는 골이 달라집니다.

| 패키징 | package 페이즈에 바인딩된 골 |
|---|---|
| `jar` (기본) | `maven-jar-plugin:jar` |
| `war` | `maven-war-plugin:war` |
| `pom` | 없음 (멀티모듈 부모 pom에서 사용) |

예를 들어 `<packaging>war</packaging>`로 선언하면, `mvn package` 실행 시 WAR 파일이 생성됩니다. 별도 플러그인 설정 없이 패키징 타입 선언만으로 동작이 바뀌는 것도 Convention over Configuration의 실현입니다.

## 페이즈 vs 골 직접 실행

`mvn`에 지정하는 인수는 두 가지 형태 중 하나입니다.

![페이즈 vs 골 — mvn 실행 방식의 두 가지 형태](/assets/posts/java-maven-lifecycle-goals.svg)

**페이즈 지정**: `mvn compile`, `mvn package`처럼 페이즈 이름을 쓰면 해당 페이즈까지 모든 이전 페이즈가 누적 실행됩니다.

**골 직접 지정**: `mvn dependency:tree`, `mvn versions:display-updates`처럼 `플러그인:골` 형식으로 쓰면 라이프사이클과 무관하게 해당 골만 단독 실행됩니다. 이전 페이즈가 실행되지 않으므로, 컴파일 결과물이 없는 상태에서도 의존성 트리 확인 등은 가능합니다.

여러 페이즈와 골을 한 명령에 이어서 쓸 수도 있습니다.

```bash
# clean 라이프사이클 실행 후 default 라이프사이클의 package 페이즈 실행
mvn clean package

# 골을 직접 지정: 의존성 트리만 출력
mvn dependency:tree

# 업그레이드 가능한 의존성 버전 확인
mvn versions:display-updates

# 통합 테스트 포함 전체 빌드 후 로컬 설치
mvn clean install
```

## 실무에서 자주 쓰는 패턴

**개발 중 빠른 빌드**: `mvn compile`은 컴파일만, `mvn test`는 테스트까지만 실행하므로 전체 패키징 없이 빠르게 확인할 수 있습니다.

**배포 전 풀 빌드**: `mvn clean install`이 표준입니다. 이전 결과를 지우고 처음부터 다시 빌드하여 재현성을 보장합니다.

**특정 테스트만 실행**: 골 직접 실행 방식을 활용합니다.

```bash
# 특정 테스트 클래스만 실행
mvn test -Dtest=MyServiceTest

# 특정 테스트 메서드만 실행
mvn test -Dtest=MyServiceTest#testSomething

# 의존성 분석 (라이프사이클 무관)
mvn dependency:analyze
```

## 정리

Maven 라이프사이클은 `clean`, `default`, `site` 세 가지입니다. 실무에서 핵심은 `default` 라이프사이클이며, `validate → compile → test → package → verify → install → deploy` 순서로 페이즈가 정의됩니다. 페이즈를 지정하면 이전 페이즈가 모두 누적 실행되고, `플러그인:골` 형식으로 직접 지정하면 해당 골만 단독 실행됩니다. 각 페이즈에 어떤 골이 바인딩되는지는 `<packaging>` 타입에 따라 달라집니다. 이 원리를 이해하면 Maven의 동작이 예측 가능해지고, 플러그인으로 빌드를 확장하는 것도 수월해집니다.

---

**지난 글:** [Maven 입문 — 자바 빌드 도구의 표준](/posts/java-build-maven/)

**다음 글:** [Maven 플러그인 — 빌드를 확장하는 법](/posts/java-maven-plugins/)

<br>
읽어주셔서 감사합니다. 😊
