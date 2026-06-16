---
title: "jmod — 모듈 패키징 포맷과 jmod 도구"
description: "JMOD는 JAR가 담지 못하는 네이티브 라이브러리와 명령까지 포함하는 모듈 패키징 포맷입니다. JAR와의 차이, jmod 도구로 생성·조회하는 법, 그리고 jlink 입력으로서의 역할을 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-17"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "jmod", "모듈", "패키징", "JPMS", "jlink"]
featured: false
draft: false
---

[지난 글](/posts/java-jlink/)에서 jlink로 맞춤형 런타임 이미지를 만들 때, 입력으로 `$JAVA_HOME/jmods` 디렉터리를 줬습니다. 그 안에는 `java.base.jmod`, `java.sql.jmod` 같은 파일들이 들어 있습니다. JDK 자신의 모듈은 JAR가 아니라 **JMOD**라는 포맷으로 배포됩니다. 왜 또 다른 포맷이 필요할까요? JAR가 담지 못하는 것을 담기 위해서입니다. 이번 글은 JMOD가 무엇이고, `jmod` 도구로 어떻게 다루는지, JAR와는 어떻게 다른지를 정리합니다.

## JAR가 담지 못하는 것

modular JAR는 `.class` 파일, 리소스, 그리고 `module-info.class`를 담습니다. 대부분의 자바 라이브러리에는 이걸로 충분합니다. 하지만 JDK 자신이나 일부 라이브러리는 자바 클래스만으로 이뤄지지 않습니다. JIT 컴파일러, 네이티브 메모리 관리, OS 호출 같은 부분은 C로 작성된 **네이티브 라이브러리**(`.so`, `.dll`, `.dylib`)와 네이티브 **실행 명령**으로 구현됩니다.

JAR 포맷에는 이런 네이티브 파일을 위한 표준 자리가 없습니다. 그래서 JDK는 자바 코드와 네이티브 코드를 한 단위로 묶을 수 있는 새 포맷, JMOD를 만들었습니다.

![JAR와 JMOD가 담을 수 있는 내용의 차이](/assets/posts/java-jmod-vs-jar.svg)

## JMOD의 결정적 제약 — 런타임에 직접 못 쓴다

여기서 가장 중요한 점이 있습니다. **JMOD는 컴파일과 링크(jlink) 시점에만 쓰는 포맷입니다.** 런타임 모듈 경로에 JMOD를 직접 올려 실행할 수는 없습니다.

정리하면 이렇게 나뉩니다.

- **modular JAR** — 컴파일·링크·실행 모든 시점에 쓸 수 있는 범용 포맷.
- **JMOD** — 네이티브 코드까지 담을 수 있지만, 컴파일·jlink 입력 전용. 실행에는 못 쓴다.

그래서 일반적인 라이브러리/애플리케이션은 여전히 modular JAR로 배포합니다. JMOD는 "네이티브 코드가 섞여 있고, 최종적으로 jlink로 런타임 이미지에 구워 넣을 모듈"에 주로 쓰입니다. JDK 모듈이 대표적인 예입니다.

## jmod 도구로 생성하기

JMOD 파일은 `jmod` 명령으로 만듭니다. 가장 기본적인 `create` 형태는 다음과 같습니다.

```bash
jmod create \
  --class-path build/classes \
  --libs build/native/libs \
  --cmds build/native/bin \
  --config build/conf \
  com.app.jmod
```

각 옵션이 JMOD의 서로 다른 영역에 파일을 채웁니다.

- `--class-path` — `.class`와 리소스, `module-info.class`.
- `--libs` — 네이티브 공유 라이브러리(`.so`/`.dll`).
- `--cmds` — 네이티브 실행 명령.
- `--config` — 설정 파일.

마지막 인자 `com.app.jmod`이 생성될 파일 이름입니다. 이렇게 만든 JMOD를 jlink의 `--module-path`에 넣으면, jlink가 네이티브 부분까지 런타임 이미지에 담아 줍니다.

![jmod create로 JMOD를 만들어 jlink 입력으로 쓰는 흐름](/assets/posts/java-jmod-create-flow.svg)

## 내용 들여다보기

이미 있는 JMOD가 무엇을 담고 있는지 보려면 `jmod list`와 `jmod describe`를 씁니다.

```bash
# 안에 든 파일 목록
jmod list $JAVA_HOME/jmods/java.base.jmod

# 모듈 선언(requires/exports) 요약
jmod describe $JAVA_HOME/jmods/java.base.jmod
```

`jmod describe`의 출력은 `module-info.java`를 그대로 읽는 것과 비슷한 모듈 디스크립터 요약입니다. 어떤 패키지를 `exports`하고 무엇을 `requires`하는지 빠르게 확인할 수 있습니다.

## JMOD를 직접 만들 일이 있을까

대부분의 애플리케이션 개발자는 JMOD를 직접 만들 일이 거의 없습니다. 빌드 도구(Maven/Gradle)는 modular JAR를 산출물로 만들고, jlink도 modular JAR를 입력으로 받을 수 있기 때문입니다. JMOD가 꼭 필요해지는 경우는 다음과 같습니다.

```text
네이티브 라이브러리(.so/.dll)를 모듈에 함께 묶어
jlink로 런타임 이미지에 통합해야 할 때
→ 이때만 JMOD가 필요하다
```

그 외에는 modular JAR로 충분합니다. 즉 JMOD는 "있다는 사실과 JDK가 이 포맷으로 배포된다는 점, 그리고 jlink 입력으로 쓸 수 있다는 점"을 알아 두는 것이 실무적으로 중요하고, 직접 만드는 빈도는 낮은 도구입니다.

## 정리

- JMOD는 JAR가 담지 못하는 **네이티브 라이브러리·명령·설정**까지 한 모듈로 묶는 패키징 포맷이다.
- 결정적 제약: JMOD는 **컴파일·jlink 시점 전용**이고, 런타임 모듈 경로에 직접 올려 실행할 수 없다.
- JDK 자신의 모듈(`java.base.jmod` 등)이 이 포맷으로 배포되며, `$JAVA_HOME/jmods`에 들어 있다.
- `jmod create`의 `--class-path`/`--libs`/`--cmds`/`--config`로 각 영역을 채워 JMOD를 만든다.
- `jmod list`/`jmod describe`로 내용과 모듈 디스크립터를 조회한다.
- 대부분의 앱은 modular JAR로 충분하며, 네이티브 코드를 런타임 이미지에 통합할 때만 JMOD가 필요하다.

---

**지난 글:** [jlink — 모듈로 맞춤형 런타임 이미지 만들기](/posts/java-jlink/)

**다음 글:** [모듈 마이그레이션 — classpath에서 module path로](/posts/java-modular-migration/)

<br>
읽어주셔서 감사합니다. 😊
