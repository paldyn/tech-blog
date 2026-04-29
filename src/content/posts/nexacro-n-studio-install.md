---
title: "[Nexacro N] Nexacro Studio N 설치와 환경 구성"
description: "Nexacro Studio N 다운로드부터 JDK 설치, 라이선스 활성화, 첫 프로젝트 생성과 Test Run까지 단계별로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "studio", "설치", "환경구성", "jdk"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-license-and-deployment/)에서 Nexacro N의 라이선스 체계와 세 가지 배포 방식을 정리했습니다. 라이선스를 준비했다면 이제 실제로 개발 환경을 구성할 차례입니다. 이번 글은 Nexacro Studio N을 처음 설치하는 개발자가 "환경 준비부터 첫 화면 실행까지" 막히지 않고 진행할 수 있도록 단계별로 안내합니다.

## 사전 준비: 시스템 요구 사항

Nexacro Studio N을 설치하기 전에 두 가지를 먼저 확인해야 합니다.

**OS**는 Windows 64bit를 권장합니다. macOS에서도 일부 기능이 동작하지만 공식 지원 OS는 Windows이며, 실무 현장의 거의 모든 개발 환경이 Windows입니다. 이 글도 Windows 기준으로 설명합니다.

**JDK**는 반드시 사전에 설치해야 합니다. Nexacro Studio N은 내부적으로 JVM을 사용하기 때문에 JDK 없이는 실행되지 않습니다. OpenJDK 17 LTS 또는 Oracle JDK 17 이상을 권장합니다. 설치 후 `JAVA_HOME` 환경변수 설정과 `PATH` 등록을 해 두지 않으면 Studio N 실행 시 오류가 발생하므로 반드시 확인합니다.

```powershell
# JDK 설치 확인
java -version
javac -version

# JAVA_HOME 확인 (PowerShell)
$env:JAVA_HOME
# 예시 출력: C:\Program Files\Eclipse Adoptium\jdk-17.0.11.9-hotspot
```

`javac -version`이 정상 출력되고 `JAVA_HOME`이 올바르게 잡혀 있다면 Studio N 설치를 진행할 수 있습니다.

## 설치 단계 전체 흐름

![Nexacro Studio N 설치 단계](/assets/posts/nexacro-n-studio-install-steps.svg)

다섯 단계로 요약할 수 있습니다. JDK 설치(② 단계)를 Studio N 설치 전에 완료해야 하므로 순서를 지키는 것이 중요합니다.

### ① 투비소프트 고객포털 접속 및 다운로드

투비소프트 고객포털(tobesoft.com)에 로그인한 후 [다운로드] 메뉴에서 Nexacro Studio N 설치 파일을 내려받습니다. 파일명은 버전에 따라 다르지만 `NexacroStudioN_vXX.XX_Win64.exe` 형태입니다. 파일 크기는 400~600MB 수준이며, 내부에 런타임 엔진이 포함되어 있습니다.

평가판(Trial)을 먼저 사용하고 싶다면 영업팀에 별도 문의해 평가 라이선스를 받을 수 있습니다.

### ② JDK 17+ 설치 및 환경변수 설정

OpenJDK를 선호한다면 Eclipse Temurin(Adoptium)이나 Microsoft Build of OpenJDK를 권장합니다. 모두 무료이며 LTS 지원이 안정적입니다.

설치 후 시스템 환경변수에 다음 두 가지를 등록합니다.

```text
JAVA_HOME = C:\Program Files\Eclipse Adoptium\jdk-17.0.11.9-hotspot
PATH      = %JAVA_HOME%\bin (추가)
```

환경변수 변경 후에는 CMD/PowerShell을 새로 열어 `java -version`으로 반드시 재확인합니다.

### ③ Studio N 인스톨러 실행

다운로드한 `.exe` 파일을 실행하면 설치 마법사가 시작됩니다. 주요 설정 항목입니다.

- **설치 경로**: 기본값(`C:\Tobesoft\NexacroStudioN`)을 그대로 사용하거나, 드라이브 용량이 충분한 경로로 변경합니다. 경로에 한글이나 공백이 없어야 합니다.
- **설치 컴포넌트**: 대부분 기본 체크 상태를 유지합니다. 필요 없는 언어팩(영어 외)은 해제해도 됩니다.
- **설치 완료**: Finish를 클릭하면 Studio N이 설치됩니다. 자동으로 실행 여부를 묻는 경우 라이선스 활성화 전 실행은 건너뜁니다.

### ④ 라이선스 활성화

Studio N을 처음 실행하면 라이선스 입력 화면이 나타납니다. 온라인 활성화가 기본 방식입니다.

**온라인 활성화** (인터넷 연결 환경):
1. [라이선스 활성화] 버튼 클릭
2. 투비소프트 포털 ID/PW 입력
3. 보유 라이선스 목록에서 Studio N 선택
4. 활성화 완료

**오프라인 활성화** (폐쇄망 환경):
1. 활성화 화면에서 [오프라인] 탭 선택
2. 화면에 표시된 머신 코드(Machine Code)를 복사
3. 인터넷이 되는 PC에서 고객포털에 접속해 머신 코드를 등록
4. 발급된 키 파일(`.nxl` 또는 `.lic`)을 폐쇄망 PC로 이동
5. Studio N에서 키 파일 선택 → 활성화 완료

```text
[머신 코드 예시]
A1B2-C3D4-E5F6-G7H8-I9J0-K1L2

[활성화 과정 요약]
폐쇄망 PC → 머신 코드 복사
     ↓
인터넷 PC → 포털 등록 → 키 파일 다운로드
     ↓
폐쇄망 PC → 키 파일 입력 → 활성화 완료
```

### ⑤ 첫 실행 및 프로젝트 생성 확인

활성화가 완료되면 Studio N 메인 화면이 열립니다. 아직 아무 프로젝트도 없는 상태입니다. 환경이 올바르게 구성됐는지 확인하는 가장 빠른 방법은 간단한 프로젝트를 만들어 Test Run을 해보는 것입니다.

## 첫 프로젝트 생성

![새 프로젝트 생성 절차와 구조](/assets/posts/nexacro-n-studio-install-project.svg)

메뉴 [File] → [New] → [Project]를 클릭하면 새 프로젝트 생성 마법사가 열립니다.

**프로젝트 유형 선택**: `Empty Project`를 선택합니다. Template을 사용하면 미리 구성된 구조가 생성되지만, 처음에는 Empty로 시작해 각 파일의 역할을 하나씩 이해하는 편이 좋습니다.

**프로젝트 이름·경로 설정**: 프로젝트 이름(`MyProject`처럼 영문)과 저장 경로를 지정합니다. 경로에 한글이나 공백이 있으면 런타임에서 파일을 읽지 못하는 문제가 발생할 수 있습니다.

**기본 폼 포함 여부**: "기본 Sample Form 포함" 옵션에 체크하면 `SampleForm.xfdl`이 자동으로 생성됩니다. 처음이라면 체크하는 것이 좋습니다.

**Finish** 클릭 후 IDE가 열리면 아래와 같은 프로젝트 구조가 생성됩니다.

```text
MyProject/
  |-- TypeDef/
  |   \-- nexacro_v16.td      ← 컴포넌트 타입 정의
  |-- frame/
  |   \-- MainFrame.xfdl      ← 앱 프레임 (창 구조)
  |-- form/
  |   \-- SampleForm.xfdl     ← 기본 업무 화면
  |-- css/
  |   \-- default.css         ← 기본 스타일
  \-- NexacroCfg.xml          ← 환경 설정 (서비스 URL)
```

각 파일의 역할은 이후 프로젝트 구조 편에서 자세히 다루겠습니다. 지금은 "이런 파일들이 만들어졌다"는 정도로만 파악하면 충분합니다.

## Test Run으로 첫 실행 확인

프로젝트가 생성됐으면 `SampleForm.xfdl`을 열고 상단 툴바의 **[Test Run]** 버튼(또는 `F5`)을 클릭합니다. Studio N이 내장 런타임으로 브라우저 없이 폼을 실행합니다.

빈 폼이라도 정상적으로 창이 열리면 설치와 환경 구성이 완료된 것입니다. 이 시점에서 다음 오류가 나타난다면 대부분 환경 문제입니다.

| 오류 메시지 | 원인 | 해결책 |
|---|---|---|
| `JVM not found` | JDK 미설치 또는 JAVA_HOME 미설정 | JDK 17+ 설치 후 환경변수 재설정 |
| `License not activated` | 라이선스 활성화 미완료 | 활성화 단계 재확인 |
| `Cannot read TypeDef` | 경로에 한글·공백 포함 | 경로 재설정 (영문·숫자만) |
| `service.xml not found` | NexacroCfg.xml 경로 오류 | 프로젝트 루트 경로 확인 |

설치 단계에서 가장 흔히 발생하는 것은 **JAVA_HOME 미설정**과 **경로 한글 포함** 두 가지입니다. 이 두 가지만 미리 점검해 두면 대부분 막힘 없이 첫 실행까지 완료할 수 있습니다.

## Studio N 버전 확인

설치 후 [Help] → [About Nexacro Studio N] 메뉴에서 설치된 Studio 버전을 확인할 수 있습니다. 버전 형식은 `vX.X.X.XXXX`이며, 이 버전 번호는 운영 환경에 배포하는 런타임 버전(`nexacro.js`)과 일치시키는 것이 원칙입니다. 버전 불일치는 렌더링 오류나 컴포넌트 속성 오동작의 주원인이 되므로, 운영 배포 시 반드시 확인하는 습관을 들여야 합니다.

---

**지난 글:** [Nexacro N 라이선스 체계와 배포 방식 완전 해설](/posts/nexacro-n-license-and-deployment/)

**다음 글:** [Nexacro Studio N UI 투어](/posts/nexacro-n-studio-ui-tour/)

<br>
읽어주셔서 감사합니다. 😊
