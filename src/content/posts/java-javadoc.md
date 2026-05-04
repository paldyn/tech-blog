---
title: "Javadoc으로 API 문서 작성하기"
description: "Javadoc 주석 작성 규칙, @param·@return·@throws 등 핵심 블록 태그, javadoc 명령 실행 방법, Gradle·Maven 연동까지 실전 중심으로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "Javadoc", "API 문서", "javadoc 명령", "@param", "@return", "Gradle", "Maven"]
featured: false
draft: false
---

[지난 글](/posts/java-classpath-modulepath/)에서 클래스패스와 모듈패스를 살펴봤습니다. 이번에는 JDK에 기본 내장된 문서 생성 도구 **Javadoc**을 다룹니다. 코드를 잘 짜는 것만큼이나 중요한 것이 API를 올바르게 문서화하는 일입니다. Javadoc은 소스 파일의 주석을 파싱해 HTML 형태의 API 레퍼런스를 자동으로 만들어 줍니다. Spring, Guava, JUnit 등 널리 쓰이는 라이브러리가 모두 Javadoc으로 문서를 제공하는 이유도 바로 여기에 있습니다.

## Javadoc 주석 기본 구조

Javadoc 주석은 `/**`으로 시작해 `*/`로 끝나는 블록 주석입니다. 일반 `/*`과 다르게 별표가 두 개입니다.

```java
/**
 * 두 정수의 합을 반환합니다.
 *
 * <p>두 값을 더한 결과가 {@code int} 범위를 벗어나면
 * {@link Math#addExact(int, int)} 를 대신 사용하세요.
 *
 * @param a 첫 번째 피연산자
 * @param b 두 번째 피연산자
 * @return a와 b의 합
 * @throws ArithmeticException 오버플로우 발생 시
 * @since 1.0
 * @see Math#addExact(int, int)
 */
public int add(int a, int b) {
    return a + b;
}
```

첫 문장은 **요약문(summary sentence)**으로, javadoc이 클래스·메서드 목록 옆에 표시하는 짧은 설명에 사용됩니다. 마침표로 끝나야 하고, 한 줄로 작성하는 것이 관례입니다.

`{@code ...}`는 인라인 코드를 HTML `<code>` 태그로 감쌉니다. `{@link ClassName#method}`는 하이퍼링크로 연결되는 참조를 만듭니다. `<p>`는 단락을 나눌 때 씁니다.

## 핵심 블록 태그

![Javadoc 주석 구조와 블록 태그](/assets/posts/java-javadoc-comment-structure.svg)

### 메서드 태그

| 태그 | 용도 |
|------|------|
| `@param 이름 설명` | 파라미터 하나당 하나씩 작성합니다. 제네릭 타입은 `@param <T>` 형식입니다. |
| `@return 설명` | 반환 타입이 `void`가 아닐 때 사용합니다. |
| `@throws 예외클래스 설명` | checked·unchecked 예외 모두 문서화할 수 있으며 `@exception`과 동의어입니다. |

```java
/**
 * 리스트에서 인덱스로 요소를 가져옵니다.
 *
 * @param <E>   요소 타입
 * @param list  원본 리스트 (null 불가)
 * @param index 0부터 시작하는 인덱스
 * @return 해당 인덱스의 요소
 * @throws IndexOutOfBoundsException 인덱스가 범위를 벗어날 때
 * @throws NullPointerException list가 null일 때
 */
public static <E> E get(List<E> list, int index) {
    return list.get(index);
}
```

### 클래스·인터페이스 태그

| 태그 | 용도 |
|------|------|
| `@author 이름` | 작성자. `-author` 옵션을 줄 때만 HTML에 출력됩니다. |
| `@version 버전` | 버전 정보. `-version` 옵션 필요. |
| `@since 버전` | API가 처음 추가된 버전을 명시합니다. |

### 범용 태그

| 태그 | 용도 |
|------|------|
| `@see 참조` | 클래스, 메서드, URL, 일반 텍스트를 참조 섹션에 추가합니다. |
| `@deprecated 이유와 대안` | 사용 중단 API임을 선언합니다. 항상 `@Deprecated` 어노테이션과 함께 써야 합니다. |

```java
/**
 * @deprecated {@link #calculateNewValue()} 를 사용하세요.
 */
@Deprecated(since = "2.0", forRemoval = true)
public int calculateValue() { ... }
```

## 인라인 태그

블록 태그와 달리 인라인 태그는 설명문 중간에 삽입됩니다.

```java
/**
 * {@code null}을 허용하지 않습니다.
 * 자세한 내용은 {@link #validate(Object)} 를 참고하세요.
 * 값이 없으면 {@literal <empty>}를 반환합니다.
 */
```

| 인라인 태그 | 역할 |
|------------|------|
| `{@code 텍스트}` | HTML 이스케이프 + `<code>` 태그 |
| `{@link 참조}` | 하이퍼링크 참조 |
| `{@linkplain 참조}` | 일반 폰트 하이퍼링크 |
| `{@literal 텍스트}` | `<`, `>` 등을 이스케이프 |
| `{@value 상수}` | 상수 값을 삽입 |

## javadoc 명령 실행

JDK `bin/` 디렉터리에 있는 `javadoc` 명령으로 HTML 문서를 생성합니다.

![javadoc 명령으로 API 문서 생성하기](/assets/posts/java-javadoc-generate.svg)

```bash
# 패키지 전체 문서화
javadoc -d docs \
        -sourcepath src/main/java \
        -subpackages com.example \
        -encoding UTF-8 \
        -charset UTF-8 \
        -docencoding UTF-8

# 개별 파일 문서화
javadoc -d docs src/main/java/com/example/Calculator.java

# 비공개 멤버까지 포함
javadoc -d docs -private -sourcepath src/main/java -subpackages com.example

# 작성자·버전 정보 포함
javadoc -d docs -author -version -sourcepath src/main/java -subpackages com.example
```

주요 옵션은 다음과 같습니다.

| 옵션 | 설명 |
|------|------|
| `-d 디렉터리` | 출력 디렉터리 지정 |
| `-sourcepath 경로` | 소스 루트 경로 (콜론으로 여러 개 지정) |
| `-subpackages 패키지` | 하위 패키지를 재귀적으로 포함 |
| `-link URL` | 외부 Javadoc(JDK 등)에 하이퍼링크 |
| `-encoding 인코딩` | 소스 파일 인코딩 (보통 UTF-8) |
| `-private` | private 멤버까지 문서화 |
| `-Xdoclint:all` | 문서 주석 문법 오류 검사 강화 |

### -link로 JDK API 연결

```bash
javadoc -d docs \
  -sourcepath src/main/java \
  -subpackages com.example \
  -link https://docs.oracle.com/en/java/javase/21/docs/api
```

`-link`를 추가하면 `java.util.List`, `java.lang.String` 같은 JDK 타입이 클릭 가능한 링크로 생성됩니다.

## Gradle 및 Maven 연동

직접 명령을 입력하지 않고 빌드 도구에서 자동 생성하는 방법입니다.

**Gradle**:

```groovy
// build.gradle
javadoc {
    options {
        encoding = 'UTF-8'
        charSet  = 'UTF-8'
        links    = ['https://docs.oracle.com/en/java/javase/21/docs/api']
        addBooleanOption('author', true)
    }
}
```

```bash
./gradlew javadoc
# 결과: build/docs/javadoc/index.html
```

**Maven**:

```xml
<!-- pom.xml -->
<plugin>
  <artifactId>maven-javadoc-plugin</artifactId>
  <version>3.7.0</version>
  <configuration>
    <encoding>UTF-8</encoding>
    <links>
      <link>https://docs.oracle.com/en/java/javase/21/docs/api</link>
    </links>
  </configuration>
</plugin>
```

```bash
mvn javadoc:javadoc
# 결과: target/site/apidocs/index.html
```

## doclint — 주석 품질 검사

Java 8부터 javadoc은 주석 오류를 경고(또는 오류)로 보고하는 **doclint** 기능을 내장합니다.

```bash
# 모든 검사 항목 활성화
javadoc -Xdoclint:all -d docs -sourcepath src ...

# 특정 항목만 비활성화 (예: html 검사 제외)
javadoc -Xdoclint:all,-html -d docs ...
```

doclint는 `@param`이 누락된 파라미터, 존재하지 않는 `{@link}` 대상, 잘못된 HTML 태그 등을 검사합니다. Gradle/Maven에서 빌드 시 자동으로 실행되므로, 처음부터 doclint를 켜두면 문서 품질을 꾸준히 관리할 수 있습니다.

## 실전 작성 지침

코드를 작성하면서 지키면 좋은 원칙 몇 가지를 정리합니다.

**요약문은 능동태, 3인칭으로** — "반환합니다"가 아니라 "반환하는 값"이 아닌 동사 위주의 설명이 검색·인텔리세이스에서 더 명확하게 보입니다. 예: `Returns the size of this list.`

**@param과 파라미터 수를 맞출 것** — doclint가 불일치를 잡아주지만, 리뷰 단계에서 먼저 확인하는 습관이 더 중요합니다.

**구현 세부사항이 아닌 계약(contract)을 기술할 것** — "ArrayList를 사용해 내부적으로 저장합니다"가 아니라 "삽입 순서를 보장합니다"처럼 외부에서 관찰 가능한 동작을 씁니다.

**null 허용 여부를 명시할 것** — 파라미터와 반환값에 null이 가능한지를 `@param`이나 `@return` 설명 안에 명확히 씁니다. `@NonNull`, `@Nullable` 어노테이션과 함께 쓰면 더 효과적입니다.

```java
/**
 * 이름으로 사용자를 조회합니다.
 *
 * @param name 사용자 이름 (null 불가, 빈 문자열 불가)
 * @return 조회된 사용자, 없으면 {@code null}
 */
public @Nullable User findByName(@NonNull String name) { ... }
```

## 정리

Javadoc은 코드와 문서를 같은 파일 안에 유지하게 해주는 강력한 도구입니다. 요약문 → 상세 설명 → 블록 태그 순서로 구조화된 주석을 작성하고, doclint로 품질을 점검하며, Gradle·Maven 태스크로 CI 파이프라인에 통합하는 것이 실전에서 검증된 흐름입니다.

---

**지난 글:** [클래스패스와 모듈패스](/posts/java-classpath-modulepath/)

**다음 글:** [JShell로 Java 코드 즉시 실행하기](/posts/java-jshell/)

<br>
읽어주셔서 감사합니다. 😊
