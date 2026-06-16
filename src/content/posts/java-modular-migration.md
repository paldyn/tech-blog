---
title: "모듈 마이그레이션 — classpath에서 module path로"
description: "기존 classpath 기반 애플리케이션을 JPMS 모듈로 점진 이행하는 방법을 정리합니다. unnamed module, automatic module, explicit module의 3단계 사다리와 상향식·하향식 전략, 그리고 실무에서 만나는 함정을 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-17"
archiveOrder: 3
type: "knowledge"
category: "Java"
tags: ["Java", "모듈", "마이그레이션", "JPMS", "automatic module", "classpath"]
featured: false
draft: false
---

[지난 글](/posts/java-jmod/)에서 JMOD 패키징까지 보면서 모듈 시스템의 도구들을 훑었습니다. 그런데 현실의 코드 대부분은 자바 8 시절의 classpath 위에서 돌아갑니다. 수백 개의 의존 JAR 중 상당수는 아직 `module-info.java`가 없습니다. 이런 프로젝트를 한 번에 모듈로 갈아엎는 것은 비현실적입니다. 다행히 JPMS는 **점진적 이행**을 전제로 설계됐습니다. 이번 글은 기존 애플리케이션을 classpath에서 module path로 단계별로 옮기는 전략과, 그 과정에서 만나는 핵심 개념을 정리합니다.

## 세 단계 사다리

마이그레이션을 이해하는 가장 좋은 틀은 "사다리"입니다. 어떤 코드든 다음 세 상태 중 하나에 있고, 한 칸씩 위로 올라갑니다.

![unnamed module, automatic module, explicit module의 3단계](/assets/posts/java-modular-migration-ladder.svg)

- **unnamed module(이름 없는 모듈)** — classpath에 올라간 모든 코드가 들어가는, 모듈 시스템의 출발점입니다. 자바 9 이상에서 기존 앱을 그냥 실행하면 여기에 해당합니다. 모든 패키지가 열려 있고 서로 자유롭게 접근합니다.
- **automatic module(자동 모듈)** — `module-info.java`가 **없는** JAR를 classpath가 아니라 **module path**에 올리면, 자바가 자동으로 모듈로 취급합니다. 이름은 파일명에서 유도되고, 모든 패키지를 `exports`하며 모든 모듈을 `requires`합니다.
- **explicit module(명시적 모듈)** — `module-info.java`를 작성해 `requires`/`exports`를 직접 선언한 진짜 모듈입니다. 최종 목표 지점입니다.

핵심은 이 사다리를 **한 번에 다 오를 필요가 없다**는 것입니다. 일부 JAR는 explicit, 일부는 automatic, 일부는 여전히 classpath의 unnamed module로 둔 채 함께 돌릴 수 있습니다.

## automatic module — 다리 역할

automatic module은 마이그레이션에서 가장 중요한 다리입니다. 내가 만든 모듈은 `requires`로 이름을 적어야 하는데, 의존 라이브러리에 아직 `module-info`가 없다면 그 이름을 어떻게 적을까요? 답이 automatic module입니다.

```text
gson-2.10.1.jar  →  module path에 올리면
                 →  자동 모듈명: com.google.gson  (파일명에서 유도)
                 →  내 module-info에서:  requires com.google.gson;
```

자동 모듈명은 두 방식으로 결정됩니다. JAR의 `MANIFEST.MF`에 `Automatic-Module-Name` 헤더가 있으면 그 값을, 없으면 파일명에서 버전을 떼고 정규화한 이름을 씁니다. 후자는 라이브러리가 파일명을 바꾸면 모듈명도 바뀔 수 있어 불안정하므로, 라이브러리 저자들은 `Automatic-Module-Name`을 manifest에 박아 두는 것이 권장됩니다.

## 상향식과 하향식

실제 마이그레이션 순서는 두 가지 전략이 있습니다.

![상향식과 하향식 마이그레이션 전략 비교](/assets/posts/java-modular-migration-strategy.svg)

**상향식(bottom-up)** 은 의존이 가장 적은 최하위 라이브러리부터 모듈화합니다. 모든 의존 라이브러리가 이미 진짜 모듈이거나 내가 통제할 수 있을 때 깔끔합니다. 하지만 외부 라이브러리가 아직 모듈이 아니면 막힙니다.

**하향식(top-down)** 은 반대로 내 애플리케이션(최상위)부터 `module-info.java`를 작성하고, 아직 모듈이 아닌 하위 라이브러리는 automatic module로 참조합니다. 외부 의존을 통제할 수 없는 현실에서 더 실용적입니다. 대부분의 실무 마이그레이션은 하향식으로 진행됩니다.

## 점진 실행 — module path와 classpath 동시 사용

마이그레이션 도중에는 module path와 classpath를 **함께** 쓰게 됩니다. 명시적 모듈과 자동 모듈은 module path에, 아직 손대지 않은 의존은 classpath에 둡니다.

```bash
java \
  --module-path mods \
  --add-modules com.app \
  --class-path "legacy/*" \
  --module com.app/com.app.Main
```

여기서 핵심 규칙이 하나 있습니다. **명시적 모듈은 classpath의 unnamed module을 `requires`할 수 없습니다.** 명시적 모듈에서 참조하려는 코드는 적어도 automatic module 단계까지는 올라와 module path에 있어야 합니다. 그래서 하향식 진행 시, 내 모듈이 의존하는 라이브러리는 module path로 옮겨 automatic module로 만들어 둡니다.

## 자주 만나는 함정

마이그레이션 중 가장 흔히 부딪히는 문제는 **강한 캡슐화**입니다. 자바 9부터 JDK 내부 패키지(`sun.*`, 일부 `com.sun.*`)에 대한 리플렉션 접근이 막혀, 기존에 잘 돌던 라이브러리가 `InaccessibleObjectException`을 던질 수 있습니다.

```bash
# 임시 우회 — 특정 모듈의 패키지를 강제로 연다
java --add-opens java.base/java.lang=ALL-UNNAMED ...

# 빠진 자바 EE 모듈 등을 강제로 추가
java --add-modules ALL-SYSTEM ...
```

`--add-opens`와 `--add-exports`는 어디까지나 **임시 처방**입니다. 근본 해결은 그 내부 API에 의존하지 않는 버전으로 라이브러리를 올리는 것입니다. `jdeps` 도구로 어떤 코드가 어떤 내부 API에 의존하는지 먼저 진단한 뒤, 우회와 교체를 결정하는 것이 정석입니다.

## 정리

- 마이그레이션은 **unnamed → automatic → explicit** 3단계 사다리를 한 칸씩 오르는 과정이며, 한 번에 다 바꿀 필요가 없다.
- `module-info` 없는 JAR를 module path에 올리면 **automatic module**이 되어, 내 모듈에서 `requires`로 참조할 수 있는 다리가 된다.
- 자동 모듈명은 `Automatic-Module-Name` manifest 헤더가 우선, 없으면 파일명에서 유도된다(불안정).
- 현실에서는 보통 **하향식**으로, 내 앱부터 모듈화하고 하위 의존은 automatic module로 둔다.
- module path와 classpath를 함께 쓸 수 있지만, **명시적 모듈은 classpath의 unnamed module을 requires할 수 없다.**
- 강한 캡슐화로 인한 접근 오류는 `--add-opens`/`--add-exports`로 임시 우회하되, `jdeps`로 진단해 근본적으로는 의존을 걷어 내는 것이 정석이다.

---

**지난 글:** [jmod — 모듈 패키징 포맷과 jmod 도구](/posts/java-jmod/)

**다음 글:** [리플렉션 기초 — 런타임에 타입을 들여다보기](/posts/java-reflection-basics/)

<br>
읽어주셔서 감사합니다. 😊
