---
title: "애너테이션 프로세싱 — 컴파일 시점에 코드 읽고 생성하기"
description: "애너테이션 프로세싱(APT)은 컴파일 중에 애너테이션을 읽어 새 소스를 생성하거나 규칙을 검증하는 메커니즘입니다. 라운드 기반 처리 모델, AbstractProcessor와 Filer·Messager, 그리고 Lombok·Dagger 같은 도구가 이를 어떻게 활용하는지 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-18"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "애너테이션", "애너테이션 프로세싱", "APT", "컴파일러"]
featured: false
draft: false
---

[지난 글](/posts/java-custom-annotations/)에서 만든 벤치마크 러너는 런타임 리플렉션으로 애너테이션을 읽었습니다. 동작하긴 하지만 두 가지 비용이 있습니다 — 실행 시점에 리플렉션 오버헤드가 생기고, 잘못된 사용(예: 매개변수가 있는 메서드에 `@Benchmark`)을 미리 막을 수 없습니다. **컴파일 시점에** 애너테이션을 읽으면 이 두 문제를 모두 해결할 수 있습니다. Lombok이 `@Getter`로 메서드를 만들어 내고, Dagger가 의존성 그래프를 코드로 생성하며, MapStruct가 매퍼를 짜 주는 것 — 전부 애너테이션 프로세싱(Annotation Processing, APT)입니다.

## javac 안에서 도는 플러그인

애너테이션 프로세서는 별도 프로그램이 아니라 **`javac` 컴파일 과정에 끼어드는 플러그인**입니다. 컴파일러는 소스를 파싱한 뒤, 발견한 애너테이션을 처리할 수 있는 프로세서들을 호출합니다. 프로세서가 새 소스 파일을 만들어 내면 컴파일러는 그 파일도 다시 스캔합니다. 이렇게 더 생성할 것이 없을 때까지 반복하는 구조를 **라운드(round)** 라고 부릅니다.

![애너테이션 프로세싱 컴파일 라운드](/assets/posts/java-annotation-processing-rounds.svg)

라운드 모델의 핵심은 "생성된 코드가 또 애너테이션을 가질 수 있다"는 점입니다. 1라운드에서 만든 클래스에 다시 애너테이션이 붙어 있으면, 2라운드에서 그것을 처리할 프로세서가 또 돌 수 있습니다. 마지막 라운드(`processingOver()`가 `true`)에는 더 이상 새 소스를 만들면 안 됩니다.

## AbstractProcessor 구현하기

프로세서는 `javax.annotation.processing.Processor` 인터페이스를 구현해야 하지만, 보통 편의 클래스인 `AbstractProcessor`를 상속합니다. 처리 대상과 지원하는 자바 버전을 애너테이션으로 선언하고, `process` 메서드만 채우면 됩니다.

```java
@SupportedAnnotationTypes("com.example.Benchmark")
@SupportedSourceVersion(SourceVersion.RELEASE_17)
public class BenchmarkProcessor extends AbstractProcessor {

    @Override
    public boolean process(Set<? extends TypeElement> annotations,
                           RoundEnvironment roundEnv) {
        for (Element e : roundEnv.getElementsAnnotatedWith(Benchmark.class)) {
            ExecutableElement method = (ExecutableElement) e;
            // 규칙 검증, 코드 생성 등
        }
        return true;   // 이 애너테이션을 내가 처리했음
    }
}
```

`process`가 `true`를 반환하면 "이 애너테이션들은 내가 소비했으니 다른 프로세서에 넘기지 말라"는 뜻입니다. `roundEnv.getElementsAnnotatedWith(...)`로 이번 라운드에서 해당 애너테이션이 붙은 요소들을 가져옵니다. 여기서 다루는 것은 런타임 `Method` 객체가 아니라 컴파일러의 추상 모델인 `Element`라는 점이 중요합니다.

## Filer·Messager·Elements — 프로세서의 도구

프로세서가 컴파일러와 안전하게 상호작용하도록 `ProcessingEnvironment`가 세 가지 핵심 도구를 제공합니다.

![Processor의 도구들](/assets/posts/java-annotation-processing-lifecycle.svg)

- **Filer**: 새 소스나 리소스 파일을 생성합니다. `new File(...)`로 직접 쓰면 안 됩니다. Filer를 통해야 컴파일러가 생성물을 인지하고 다음 라운드에 포함시킵니다.
- **Messager**: 에러·경고 메시지를 냅니다. `Diagnostic.Kind.ERROR`로 메시지를 내면 빌드가 실패합니다. 잘못된 사용을 **컴파일 단계에서** 막는 수단입니다.
- **Elements / Types**: 요소의 이름, 상위 타입, 패키지 등을 조회하는 유틸리티입니다.

규칙 검증 예시를 보겠습니다. `@Benchmark`는 매개변수가 없는 메서드에만 의미가 있으므로, 그렇지 않으면 컴파일을 실패시킵니다.

```java
ExecutableElement method = (ExecutableElement) e;
if (!method.getParameters().isEmpty()) {
    processingEnv.getMessager().printMessage(
        Diagnostic.Kind.ERROR,
        "@Benchmark는 매개변수 없는 메서드에만 붙일 수 있습니다",
        method);   // 에러 위치로 이 요소를 가리킴
}
```

## 등록과 실전 활용

프로세서는 `META-INF/services/javax.annotation.processing.Processor` 파일에 클래스 이름을 적어 등록합니다. 구글의 `@AutoService`를 쓰면 이 파일을 자동 생성해 주고, 코드 생성에는 보통 JavaPoet 같은 라이브러리를 함께 씁니다.

```text
# META-INF/services/javax.annotation.processing.Processor
com.example.BenchmarkProcessor
```

런타임 리플렉션과 비교하면 차이가 분명합니다. 리플렉션은 **실행 시점**에 동작해 유연하지만 비용과 위험이 런타임으로 미뤄집니다. 애너테이션 프로세싱은 **컴파일 시점**에 끝나므로 생성된 코드는 일반 코드와 똑같이 빠르고, 규칙 위반은 빌드에서 즉시 잡힙니다. Lombok·Dagger·MapStruct가 모두 후자를 택한 이유입니다.

## 정리

애너테이션 프로세싱은 "컴파일러를 확장하는" 메커니즘입니다. 라운드 기반으로 애너테이션을 읽고, Filer로 코드를 생성하며, Messager로 규칙을 강제합니다. 직접 프로세서를 작성할 일은 흔치 않지만, 우리가 매일 쓰는 라이브러리들이 이 위에 서 있다는 사실을 알면 그 동작이 더 이상 마법처럼 보이지 않습니다. 애너테이션 편은 여기서 마무리하고, 다음 글부터는 JVM이 우리 코드를 어떻게 더 빠르게 만드는지 — JIT 컴파일 튜닝의 세계로 넘어갑니다.

---

**지난 글:** [커스텀 애너테이션 만들기 — @interface로 직접 선언하기](/posts/java-custom-annotations/)

**다음 글:** [JIT 컴파일 튜닝 — 임계값과 컴파일러 제어](/posts/java-jit-tuning/)

<br>
읽어주셔서 감사합니다. 😊
