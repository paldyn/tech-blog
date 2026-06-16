---
title: "jlink — 모듈로 맞춤형 런타임 이미지 만들기"
description: "jlink는 애플리케이션이 실제로 쓰는 모듈만 골라 자체 실행 가능한 런타임 이미지를 만듭니다. 전체 JDK 없이도 돌아가는 작고 독립적인 배포본을 만드는 원리와 명령 옵션을 코드와 함께 정리합니다."
author: "PALDYN Team"
pubDate: "2026-06-17"
archiveOrder: 1
type: "knowledge"
category: "Java"
tags: ["Java", "jlink", "모듈", "런타임 이미지", "JPMS", "배포"]
featured: false
draft: false
---

[지난 글](/posts/java-services-modules/)에서 `provides`/`uses`와 `ServiceLoader`로 모듈 사이를 느슨하게 묶는 법을 봤습니다. 모듈 시스템이 주는 또 하나의 큰 선물은 **배포**에 있습니다. 자바 애플리케이션을 돌리려면 보통 대상 머신에 JDK나 JRE가 깔려 있어야 했습니다. 하지만 모듈 그래프가 있으면 "이 앱이 실제로 쓰는 모듈이 무엇인가"를 정확히 계산할 수 있고, 그것만 모아 **자체 실행 가능한 런타임 이미지**를 만들 수 있습니다. 그 도구가 `jlink`입니다. 이번 글은 jlink로 작고 독립적인 배포본을 만드는 과정을 정리합니다.

## 왜 맞춤형 런타임인가

전통적인 배포는 "JAR를 던져 주고, 대상 머신의 JRE로 실행하라"는 방식이었습니다. 문제는 두 가지입니다. 첫째, 대상 환경에 맞는 자바 버전이 깔려 있어야 합니다. 둘째, 앱이 `java.base` 정도만 쓰는데도 전체 JRE(수백 MB)를 통째로 들고 다녀야 합니다.

jlink는 이 두 문제를 한 번에 풉니다. 앱의 모듈 그래프를 분석해 **실제로 도달 가능한 모듈만** 추려 담고, 거기에 `bin/java`까지 포함한 완전한 실행 환경을 통째로 만들어 줍니다. 결과 이미지는 대상 머신에 JDK가 없어도 그 자체로 돌아갑니다.

![jlink가 모듈을 분석해 런타임 이미지를 만드는 흐름](/assets/posts/java-jlink-pipeline.svg)

핵심 전제는 **모든 의존이 모듈이어야 한다**는 점입니다. jlink는 명시적 모듈만 다룰 수 있습니다(classpath의 일반 JAR나 automatic module은 입력으로 쓸 수 없습니다). 그래서 jlink는 모듈화의 보상 같은 도구입니다 — 모듈로 만들어 두면 이런 배포가 가능해집니다.

## 기본 사용법

가장 단순한 형태는 모듈 경로와 시작 모듈, 출력 위치만 주는 것입니다.

```bash
jlink \
  --module-path mods:$JAVA_HOME/jmods \
  --add-modules com.app \
  --output dist
```

`--module-path`에는 내 모듈(`mods`)과 JDK 자신의 모듈(`$JAVA_HOME/jmods`)을 함께 줍니다. `--add-modules com.app`은 "이 모듈에서 출발하라"는 루트 지정이고, jlink는 그로부터 `requires`를 따라가며 `java.base` 같은 필요한 모듈을 자동으로 끌어옵니다. `--output dist`에 결과가 생성됩니다.

## 이미지 구조와 실행 런처

만들어진 이미지는 JDK와 똑같은 디렉터리 구조를 갖습니다. `bin/`에 `java` 실행 파일이 들어 있어, 다음처럼 직접 실행할 수 있습니다.

```bash
dist/bin/java --module com.app/com.app.Main
```

매번 모듈과 메인 클래스를 적는 게 번거롭다면 `--launcher`로 전용 실행 스크립트를 만들 수 있습니다.

![런타임 이미지 디렉터리 구조와 jlink 옵션](/assets/posts/java-jlink-image-layout.svg)

```bash
jlink \
  --module-path mods:$JAVA_HOME/jmods \
  --add-modules com.app \
  --launcher run=com.app/com.app.Main \
  --compress=2 --strip-debug \
  --output dist

dist/bin/run    # 이제 이 한 줄로 실행
```

`--launcher 이름=모듈/메인클래스` 형식입니다. 위 예에서는 `dist/bin/run`이라는 스크립트가 생겨, 사용자는 모듈 구조를 몰라도 `run` 한 줄로 앱을 띄울 수 있습니다.

## 크기를 줄이는 옵션

jlink의 진가는 이미지를 작게 만드는 데 있습니다. 자주 쓰는 옵션을 정리하면 다음과 같습니다.

```bash
jlink \
  --add-modules com.app \
  --module-path mods:$JAVA_HOME/jmods \
  --strip-debug \           # 디버그 심볼 제거
  --compress=2 \            # 리소스 압축 (zip)
  --no-header-files \       # C 헤더 제외
  --no-man-pages \          # 매뉴얼 페이지 제외
  --output dist
```

- `--strip-debug` — 클래스 파일의 디버그 정보를 떼어 냅니다. 운영 배포에서 흔히 씁니다.
- `--compress=2` — `lib/modules` 묶음을 압축합니다(자바 버전에 따라 `--compress=zip-9` 같은 새 표기를 쓰기도 합니다).
- `--no-header-files`, `--no-man-pages` — 실행에 불필요한 부속 파일을 제외합니다.

이런 옵션을 조합하면, `java.base`만 쓰는 작은 앱은 전체 JDK 대비 훨씬 작은 수십 MB 수준의 이미지로 줄어듭니다.

## 어떤 모듈이 들어갔는지 확인하기

만들어진 이미지가 실제로 어떤 모듈을 담고 있는지 확인하려면, 그 이미지의 `java`로 모듈 목록을 출력해 보면 됩니다.

```bash
dist/bin/java --list-modules
```

여기에 예상보다 많은 모듈이 보인다면, 어딘가에서 무거운 모듈(`java.desktop` 등)을 `requires`하고 있을 가능성이 큽니다. 의존을 줄이면 이미지도 함께 가벼워집니다. 반대로 `ServiceLoader`로 동적으로 찾는 제공자 모듈은 jlink가 자동으로 끌어오지 못할 수 있으니, 필요하면 `--add-modules`에 명시적으로 추가해야 합니다.

## 정리

- `jlink`는 앱의 모듈 그래프를 분석해, 실제로 쓰는 모듈만 담은 **자체 실행 가능한 런타임 이미지**를 만든다.
- 입력은 반드시 명시적 모듈이어야 한다 — classpath JAR나 automatic module은 jlink의 입력이 될 수 없다.
- `--module-path`에 내 모듈과 `$JAVA_HOME/jmods`를 함께 주고, `--add-modules`로 루트 모듈을 지정하면 의존이 자동으로 따라온다.
- `--launcher`로 실행 스크립트를 만들면 사용자는 모듈 구조를 몰라도 한 줄로 앱을 띄운다.
- `--strip-debug`, `--compress`, `--no-man-pages` 등으로 이미지 크기를 크게 줄일 수 있다.
- `--list-modules`로 결과 이미지의 모듈 구성을 점검하고, 동적으로 로드되는 제공자 모듈은 `--add-modules`로 직접 추가한다.

---

**지난 글:** [모듈 서비스 — provides/uses와 ServiceLoader](/posts/java-services-modules/)

**다음 글:** [jmod — 모듈 패키징 포맷과 jmod 도구](/posts/java-jmod/)

<br>
읽어주셔서 감사합니다. 😊
