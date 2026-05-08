---
title: "JVM 클래스 로더 시스템"
description: "Bootstrap · Platform · Application 세 계층의 클래스 로더, 부모 위임 모델의 동작 원리, 로딩·링킹·초기화 3단계 프로세스, 그리고 커스텀 클래스 로더 구현까지 깊이 있게 살펴봅니다."
author: "PALDYN Team"
pubDate: "2026-05-06"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "JVM", "클래스 로더", "ClassLoader", "부모 위임 모델", "바이트코드", "클래스 로딩"]
featured: false
draft: false
---

[지난 글](/posts/jvm-architecture/)에서 JVM의 세 가지 서브시스템(클래스 로더, 런타임 데이터 영역, 실행 엔진)을 개괄했습니다. 이번에는 그 첫 번째 서브시스템인 **클래스 로더**를 집중적으로 해부합니다. 클래스 로더는 단순히 파일을 읽어오는 도구가 아니라, Java 플랫폼 전체의 보안과 격리를 책임지는 핵심 메커니즘입니다.

## 클래스 로더란

클래스 로더(ClassLoader)는 `.class` 파일의 바이트 스트림을 읽어 JVM 내부 메모리(Method Area)에 클래스 정보를 올리고, Heap에 `java.lang.Class` 객체를 생성하는 역할을 합니다. Java에서 클래스는 **"풀 클래스명 + 로드한 클래스 로더"** 의 조합으로 유일하게 식별됩니다. 같은 `.class` 파일이라도 서로 다른 클래스 로더가 로드했다면 JVM은 다른 클래스로 취급합니다.

## 세 계층의 클래스 로더

JVM은 계층적인 세 가지 클래스 로더를 기본으로 제공합니다.

![클래스 로더 계층 구조](/assets/posts/jvm-class-loader-hierarchy.svg)

### Bootstrap Class Loader

가장 상위에 위치하는 로더로, C++로 구현되어 있어 Java 객체로 표현되지 않습니다. `ClassLoader.getParent()`를 호출하면 `null`이 반환되는 이유가 바로 이것입니다. `java.lang.Object`, `java.util.ArrayList` 같은 `java.base` 모듈의 핵심 클래스를 담당합니다.

### Platform Class Loader

Java 8까지는 **Extension ClassLoader**라 불렸고, Java 9 이후 모듈 시스템 도입과 함께 **Platform ClassLoader**로 이름이 바뀌었습니다. `java.se` 카테고리의 플랫폼 모듈(`java.xml`, `java.logging` 등)을 로드합니다.

### Application Class Loader

흔히 System ClassLoader라고도 부릅니다. `-classpath` 또는 `--module-path`에 지정된 경로에서 우리가 작성한 애플리케이션 클래스와 서드파티 라이브러리를 로드합니다. `ClassLoader.getSystemClassLoader()`로 얻을 수 있습니다.

```java
public class ClassLoaderDemo {
    public static void main(String[] args) {
        // Application ClassLoader
        ClassLoader appCL = ClassLoaderDemo.class.getClassLoader();
        System.out.println("App: " + appCL);

        // Platform ClassLoader
        ClassLoader platCL = appCL.getParent();
        System.out.println("Platform: " + platCL);

        // Bootstrap ClassLoader → null
        ClassLoader bootCL = platCL.getParent();
        System.out.println("Bootstrap: " + bootCL); // null
    }
}
```

## 부모 위임 모델 (Parent Delegation Model)

클래스 로더의 핵심 보안 원칙입니다. `loadClass(name)` 호출이 들어오면 **먼저 부모에게 위임**하고, 부모가 찾지 못할 때만 자신이 직접 로드를 시도합니다.

```
loadClass("com.example.App") 호출
  → Application CL: "내가 직접 로드하기 전에 부모에게 먼저"
  → Platform CL: "나도 부모에게 먼저"
  → Bootstrap CL: "내 영역(java.base)에 없음 → ClassNotFoundException 반환"
  → Platform CL: "내 영역에도 없음 → ClassNotFoundException 반환"
  → Application CL: classpath에서 직접 로드 ✓
```

이 구조 덕분에 **악의적인 `java.lang.String` 클래스를 만들어 classpath에 넣어도** Bootstrap ClassLoader가 항상 먼저 로드하므로 핵심 클래스 위조가 불가능합니다.

## 클래스 로딩 3단계

클래스 로더가 처리하는 전체 과정은 세 단계로 나뉩니다.

![클래스 로딩 3단계 프로세스](/assets/posts/jvm-class-loader-phases.svg)

### 1단계: 로딩(Loading)

`.class` 파일을 찾아 바이트 스트림으로 읽어 Method Area에 저장하고, Heap에 `Class<?>` 객체를 만듭니다. `Class.forName("com.example.Foo")` 또는 `ClassLoader.loadClass("com.example.Foo")`로 명시적으로 트리거할 수 있습니다. 기본적으로 **Lazy Loading** — 실제 사용 직전까지 로딩을 미룹니다.

### 2단계: 링킹(Linking)

로딩 직후 이어지는 세 하위 단계가 있습니다.

**Verification**: 읽어들인 바이트코드가 JVM 명세를 준수하는지 검증합니다. 타입 안전성, 스택 깊이, 접근 권한 등을 검사하며, 실패하면 `VerifyError`가 발생합니다.

**Preparation**: `static` 필드에 타입별 기본값을 할당합니다. `static int count`는 `0`, `static String name`은 `null`로 초기화됩니다. 아직 실제 초기화 코드는 실행되지 않습니다.

**Resolution**: Constant Pool의 심볼릭 참조(문자열)를 실제 메모리의 직접 참조로 바꿉니다. 이 단계는 Eager(즉시) 또는 Lazy(실제 사용 시) 방식으로 처리됩니다.

### 3단계: 초기화(Initialization)

`<clinit>` 메서드를 실행합니다. 이 메서드는 컴파일러가 `static` 블록과 `static` 필드 초기화 코드를 모아 자동으로 생성합니다. JVM은 스레드 안전하게 **단 한 번만** 실행되도록 보장합니다.

```java
class DatabaseConfig {
    // Preparation 단계: url = null, maxConn = 0
    static String url;
    static int maxConn;

    // Initialization 단계: <clinit> 실행
    static {
        url = System.getenv("DB_URL");
        maxConn = Integer.parseInt(
            System.getenv().getOrDefault("DB_MAX_CONN", "10")
        );
        System.out.println("DB config initialized");
    }
}
```

초기화 트리거 조건은 `new`로 인스턴스 생성, `static` 필드 읽기/쓰기, `static` 메서드 호출, 리플렉션 사용, 서브클래스 초기화(부모 클래스 먼저), JVM 진입점(`main()`)의 6가지입니다.

## 커스텀 클래스 로더

암호화된 클래스 파일 로드, 핫 리로드(배포 없이 클래스 교체), 플러그인 격리 등의 요구사항이 있을 때 `ClassLoader`를 상속해 직접 구현합니다.

```java
public class EncryptedClassLoader extends ClassLoader {

    @Override
    protected Class<?> findClass(String name) throws ClassNotFoundException {
        byte[] encrypted = readEncryptedBytes(name);
        byte[] bytecode = decrypt(encrypted); // 복호화
        return defineClass(name, bytecode, 0, bytecode.length);
    }

    private byte[] readEncryptedBytes(String name) {
        String path = name.replace('.', '/') + ".enc";
        try (var is = getClass().getResourceAsStream(path)) {
            return is != null ? is.readAllBytes() : new byte[0];
        } catch (Exception e) {
            return new byte[0];
        }
    }

    private byte[] decrypt(byte[] data) {
        // XOR 예시 — 실제로는 AES 등 사용
        byte[] result = new byte[data.length];
        for (int i = 0; i < data.length; i++) {
            result[i] = (byte) (data[i] ^ 0x5A);
        }
        return result;
    }
}
```

`loadClass`가 아닌 **`findClass`만 오버라이드**하는 것이 핵심입니다. `loadClass`를 오버라이드하면 부모 위임 모델이 깨져 핵심 클래스 보호가 무력화될 수 있습니다.

## 클래스 로더와 메모리 누수

커스텀 클래스 로더를 사용하는 환경(OSGi, 애플리케이션 서버, 플러그인 시스템)에서 흔히 발생하는 메모리 누수 패턴이 있습니다.

```java
// ⚠ 위험: 정적 필드가 로더 참조를 붙잡음
public class PluginRegistry {
    private static final List<Object> PLUGINS = new ArrayList<>();

    public static void register(Object plugin) {
        PLUGINS.add(plugin); // plugin의 ClassLoader를 간접 참조
    }
}
```

`PluginClassLoader`가 로드한 클래스가 `PLUGINS`에 남아 있으면, 해당 로더가 GC되지 않아 Metaspace 누수로 이어집니다. 약한 참조(`WeakReference`)를 사용하거나, 언로드 시 명시적으로 목록에서 제거해야 합니다.

## 정리

| 단계 | 수행 주체 | 주요 작업 |
|---|---|---|
| Loading | ClassLoader | 바이트 스트림 읽기 + Class 객체 생성 |
| Verification | JVM | 바이트코드 안전성 검증 |
| Preparation | JVM | static 필드 기본값 설정 |
| Resolution | JVM | 심볼릭 참조 → 직접 참조 |
| Initialization | JVM | `<clinit>` 실행 (단 1회) |

부모 위임 모델은 단순한 설계 관습이 아니라 플랫폼 보안의 토대입니다. 다음 글에서는 위임 모델을 더 깊이 파고들어 **컨텍스트 클래스 로더**와 모듈 시스템이 이 원칙을 어떻게 확장하는지 살펴봅니다.

---

**지난 글:** [JVM 아키텍처 완전 해부](/posts/jvm-architecture/)

**다음 글:** [클래스 로더 위임 모델 심화](/posts/jvm-class-loader-delegation/)

<br>
읽어주셔서 감사합니다. 😊
