---
title: "JShell로 Java 코드 즉시 실행하기"
description: "Java 9에서 도입된 JShell REPL 환경의 기본 사용법, 슬래시 명령, 자동완성, 스크립트 실행, 학습과 프로토타이핑에 활용하는 실전 팁을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-05-05"
archiveOrder: 2
type: "knowledge"
category: "Java"
tags: ["Java", "JShell", "REPL", "Java9", "대화형 실행", "프로토타이핑"]
featured: false
draft: false
---

[지난 글](/posts/java-javadoc/)에서 Javadoc으로 API 문서를 만드는 방법을 살펴봤습니다. 이번에는 같은 JDK 안에 포함된 **JShell**을 다룹니다. JShell은 Java 9에서 처음 도입된 **REPL**(Read-Eval-Print Loop) 환경으로, `.java` 파일을 만들고 컴파일하는 과정 없이 코드를 한 줄씩 입력해 즉시 결과를 확인할 수 있습니다. 새로운 API를 탐험하거나, 간단한 알고리즘을 빠르게 검증할 때 매우 유용한 도구입니다.

## JShell 시작하기

JDK 9 이상이 설치되어 있다면 터미널에서 바로 실행할 수 있습니다.

```bash
$ jshell
|  JShell 시작 -- 도움말은 /help 입력
|  Good bye

# 종료는 /exit 또는 Ctrl+D
```

프롬프트 `jshell>` 가 나타나면 Java 표현식·선언·명령을 입력하면 됩니다.

## 기본 사용법

JShell은 소스 파일과 다르게 **세미콜론을 생략**해도 되고, **클래스 안에 넣지 않아도** 됩니다. 표현식을 입력하면 결과가 `==>` 표시와 함께 즉시 출력됩니다.

```java
jshell> 1 + 2
$1 ==> 3

jshell> "Hello".toUpperCase()
$2 ==> "HELLO"

jshell> Math.PI
$3 ==> 3.141592653589793
```

`$1`, `$2` 같은 이름은 JShell이 자동으로 만드는 **임시 변수**로, 이후 표현식에서 재사용할 수 있습니다.

### 변수·메서드·클래스 선언

```java
jshell> int x = 10
x ==> 10

jshell> int square(int n) { return n * n; }
|  square 메서드 생성됨

jshell> square(x)
$1 ==> 100

jshell> record Point(int x, int y) {}
|  Point 레코드 생성됨

jshell> new Point(3, 4)
$2 ==> Point[x=3, y=4]
```

선언한 변수·메서드·타입은 세션이 끝날 때까지 유지됩니다. 변수 이름을 다시 입력해서 재선언(덮어쓰기)도 가능합니다.

### var 추론

Java 10의 `var` 키워드도 JShell에서 사용할 수 있습니다.

```java
jshell> var list = List.of("a", "b", "c")
list ==> [a, b, c]

jshell> list.stream().filter(s -> s.compareTo("b") > 0).toList()
$1 ==> [c]
```

## REPL 동작 원리

![JShell REPL 동작 원리](/assets/posts/java-jshell-repl-flow.svg)

JShell은 네 단계를 반복합니다.

1. **READ** — 프롬프트에서 한 줄(또는 여러 줄) 입력을 읽습니다.
2. **EVAL** — 입력을 스니펫(snippet)으로 파싱·컴파일해 JVM에서 실행합니다.
3. **PRINT** — 결과값과 부수 효과(출력·예외 등)를 화면에 보여줍니다.
4. **LOOP** — 다음 입력을 기다리며 처음으로 돌아갑니다.

JShell이 파싱하는 기본 단위를 **스니펫**이라고 합니다. 스니펫의 종류에는 표현식(expression), 선언(declaration), 임포트(import), 명령(statement)이 있습니다.

## 슬래시 명령

JShell에는 `/`로 시작하는 내장 명령이 있습니다. 코드가 아니라 JShell 자체를 제어하는 메타 명령입니다.

![JShell 대화형 세션과 주요 명령어](/assets/posts/java-jshell-commands.svg)

```text
/list       — 이 세션에서 입력한 스니펫 목록
/vars       — 선언된 변수 목록
/methods    — 정의된 메서드 목록
/types      — 클래스·인터페이스·열거형 목록
/imports    — 현재 활성화된 임포트 목록
/history    — 모든 입력 이력 (슬래시 명령 포함)
/edit N     — 스니펫 N번을 편집기에서 수정
/open 파일  — 파일을 읽어 줄 단위로 실행
/save 파일  — 현재 스니펫을 파일로 저장
/reset      — JShell 상태 완전 초기화
/exit       — JShell 종료
/help       — 전체 도움말
```

### 활용 예시

```java
jshell> int a = 5
a ==> 5

jshell> int b = a * 3
b ==> 15

jshell> /vars
|    int a = 5
|    int b = 15

jshell> /list
   1 : int a = 5
   2 : int b = a * 3

jshell> /edit 1
```

`/edit 1`을 입력하면 JShell 설정 편집기(기본은 간단한 스윙 에디터)에서 스니펫 1번을 수정할 수 있습니다. 외부 편집기를 사용하려면 환경변수 `EDITOR`를 설정하거나 `/set editor`로 지정합니다.

## Tab 자동완성

JShell에서 `Tab` 키를 누르면 메서드·필드·변수 이름을 자동완성합니다.

```java
jshell> "hello".
// Tab 입력
chars()       codePointAt()   codePointBefore()
codePointCount() codePoints()   compareTo() ...
```

패키지 이름, 클래스 이름, 임포트 등도 자동완성됩니다. `Tab`을 두 번 누르면 가능한 후보 목록이 모두 나타납니다.

## 다중 임포트와 스타트업 설정

JShell은 시작할 때 `java.lang.*`, `java.io.*`, `java.math.*`, `java.util.*`, `java.util.function.*`, `java.util.stream.*` 등 자주 쓰는 패키지를 기본으로 임포트합니다.

추가 임포트가 필요하면 세션 안에서 직접 선언합니다.

```java
jshell> import java.time.LocalDate

jshell> LocalDate.now()
$1 ==> 2026-05-05
```

스타트업 파일(`.jshell`) 기능을 사용하면 반복적인 임포트나 공통 설정을 자동 실행할 수 있습니다.

```bash
# 스타트업 파일 만들기
$ cat > ~/.jshell_startup << 'EOF'
import java.time.*
import java.nio.file.*
void println(Object o) { System.out.println(o); }
EOF

# 지정 파일로 JShell 시작
$ jshell ~/.jshell_startup
```

## 스크립트 파일 실행

JShell은 Java 코드를 담은 파일을 스크립트처럼 실행할 수 있습니다.

```java
// demo.jsh
int fib(int n) {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2);
}

for (int i = 0; i < 10; i++) {
    System.out.println("fib(" + i + ") = " + fib(i));
}
```

```bash
$ jshell demo.jsh
fib(0) = 0
fib(1) = 1
fib(2) = 1
...
```

`/open demo.jsh`로 실행 중인 JShell 세션 안에서 불러올 수도 있습니다.

## 클래스패스 지정

JShell을 시작할 때 `-cp` 옵션으로 외부 라이브러리를 추가하거나, 세션 안에서 `/env -class-path` 명령으로 변경할 수 있습니다.

```bash
# 외부 JAR 포함하여 시작
$ jshell --class-path lib/guava-33.0.jar

# 세션 내에서 클래스패스 추가
jshell> /env -class-path lib/guava-33.0.jar

# 추가 후 사용
jshell> import com.google.common.collect.ImmutableList
jshell> ImmutableList.of(1, 2, 3)
$1 ==> [1, 2, 3]
```

## JShell API — 프로그래밍 방식 제어

JShell은 `jdk.jshell` 모듈을 통해 Java 프로그램 안에서 JShell을 제어하는 API도 제공합니다. 커스텀 REPL 도구나 교육용 인터프리터를 만들 때 유용합니다.

```java
import jdk.jshell.JShell;
import jdk.jshell.SnippetEvent;

try (JShell shell = JShell.create()) {
    shell.eval("int x = 42;")
         .forEach(e -> System.out.println(e.status()));

    shell.eval("x * 2")
         .stream()
         .filter(e -> e.value() != null)
         .forEach(e -> System.out.println("결과: " + e.value()));
}
```

`JShell.create()` 는 독립된 JShell 인스턴스를 반환하며 `AutoCloseable`을 구현합니다. `eval()` 의 반환값인 `List<SnippetEvent>`에서 실행 결과·상태·오류 정보를 얻을 수 있습니다.

## 실전 활용 팁

**API 탐색** — 처음 보는 라이브러리의 메서드를 알아볼 때 JShell과 Tab 자동완성을 함께 쓰면 Javadoc을 열지 않아도 빠르게 파악할 수 있습니다.

**알고리즘 검증** — 재귀·스트림 파이프라인을 즉시 실행해보고 결과를 확인한 뒤 실제 코드에 옮기면 시행착오를 줄일 수 있습니다.

**정규식 테스트** — `"문자열".matches("패턴")`처럼 정규식 동작을 바로 확인할 수 있습니다.

**날짜·시간 계산** — `LocalDate.now().plusDays(30)` 등 날짜 연산을 대화형으로 검증할 수 있습니다.

JShell은 프로덕션 코드를 작성하는 IDE와 병행해 쓰는 보조 도구로 가장 효과적입니다. 빠른 실험과 검증이 필요한 순간마다 꺼내 쓰면, 개발 리듬을 끊지 않고도 불확실한 부분을 빠르게 해소할 수 있습니다.

---

**지난 글:** [Javadoc으로 API 문서 작성하기](/posts/java-javadoc/)

**다음 글:** [JVM 아키텍처 완전 정복](/posts/jvm-architecture/)

<br>
읽어주셔서 감사합니다. 😊
