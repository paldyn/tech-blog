---
title: "[Nexacro N] Nexacro Studio N UI 완전 투어"
description: "Nexacro Studio N의 주요 패널 구성과 역할, 폼 편집기·속성 창·출력 창·툴박스 사용법을 단계별로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "studio", "IDE", "폼편집기", "속성창", "툴박스"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-studio-install/)에서 Nexacro Studio N 설치와 첫 프로젝트 생성까지 진행했습니다. Studio를 처음 열었을 때 어디서 무엇을 해야 하는지 막막하다는 분이 많습니다. 이번 글은 Studio N의 각 패널이 무슨 역할을 하는지, 그리고 실제 개발 흐름에서 어떻게 활용하는지를 순서대로 살펴봅니다.

## 전체 화면 구성 한눈에 보기

Studio N을 처음 열면 크게 다섯 영역으로 나뉩니다.

![Nexacro Studio N 주요 영역 구성](/assets/posts/nexacro-n-studio-ui-tour-layout.svg)

| 영역 | 위치 | 역할 |
|---|---|---|
| 메뉴 바 | 최상단 | 파일·빌드·실행 등 전체 기능 접근 |
| 툴 바 | 메뉴 바 아래 | 자주 쓰는 기능 아이콘 모음 |
| 프로젝트 탐색기 | 좌측 | 프로젝트 내 파일·폴더 트리 |
| 폼 편집기 | 중앙(대형) | 화면 설계 + 스크립트 작성 공간 |
| 속성 창 | 우측 | 선택 컴포넌트 속성 편집 |
| 출력 창 | 하단 좌 | 실행 로그·오류·디버그 메시지 |
| 컴포넌트 도구 상자 | 하단 우 | 폼에 추가할 컴포넌트 목록 |

패널 배치는 드래그로 변경하거나 [View] 메뉴에서 숨길 수 있습니다. 처음에는 기본 배치를 그대로 쓰는 것이 학습에 유리합니다.

## 프로젝트 탐색기 (Project Explorer)

좌측 패널입니다. 프로젝트를 구성하는 모든 파일이 트리 형태로 나타납니다. 파일을 더블클릭하면 폼 편집기에서 열립니다.

중요한 파일 유형은 세 가지입니다.

- **`.xfdl`**: 폼 파일. Nexacro의 화면 단위입니다. XML 기반 구조로 레이아웃과 스크립트가 함께 저장됩니다.
- **`NexacroCfg.xml`**: 환경 설정 파일. 서비스 URL, TypeDef 경로 등 앱 전반의 설정이 담겨 있습니다.
- **`.css`**: 스타일 파일. 컴포넌트의 시각적 속성을 일괄 관리합니다.

프로젝트 탐색기에서 파일을 우클릭하면 파일 추가·삭제·이름 변경 등의 컨텍스트 메뉴가 나타납니다. 폴더 구조는 자유롭게 구성할 수 있지만, 관례적으로 `frame/`, `form/`, `css/`, `TypeDef/` 구분을 따릅니다.

## 폼 편집기 (Form Editor) — 핵심 작업 공간

중앙의 대형 패널이 폼 편집기입니다. 탭으로 **Design · Script · Preview** 세 가지 뷰를 전환합니다.

### Design 탭

컴포넌트를 배치하는 WYSIWYG 캔버스입니다. Toolbox에서 컴포넌트를 캔버스로 드래그하거나, 캔버스에서 이미 배치된 컴포넌트를 클릭해 선택한 뒤 Properties에서 속성을 변경합니다.

캔버스 안에서 자주 쓰는 조작입니다.

```text
선택      : 클릭
다중선택  : Ctrl + 클릭, 또는 빈 공간 드래그
이동      : 선택 후 드래그, 또는 방향키
크기변경  : 선택 후 핸들 드래그
복사/붙여넣기 : Ctrl+C / Ctrl+V
삭제      : Delete
```

컴포넌트를 선택하면 캔버스 상단에 컴포넌트 이름과 위치(left, top), 크기(width, height)가 실시간으로 표시됩니다.

### Script 탭

폼의 이벤트 핸들러와 함수를 작성하는 JavaScript 편집기입니다. 문법 강조(Syntax Highlighting)와 자동 완성(IntelliSense)을 지원합니다.

```javascript
// 폼 로드 시 자동 호출되는 이벤트 핸들러
function SampleForm_onload(obj, e)
{
    this.fn_search();
}

// 조회 트랜잭션 함수
function fn_search()
{
    this.transaction(
        "search",
        "/service/getSampleList.do",
        "in_param=ds_param",
        "ds_list=output_ds",
        "",
        "fn_searchCallback"
    );
}

function fn_searchCallback(sId, nErrorCode, sErrorMsg)
{
    if (nErrorCode < 0) {
        alert(sErrorMsg);
        return;
    }
}
```

이벤트 핸들러 이름은 `{폼ID}_{이벤트명}` 또는 `{컴포넌트ID}_{이벤트명}` 형식을 따릅니다. Design 탭에서 컴포넌트를 더블클릭하면 해당 컴포넌트의 기본 이벤트 핸들러가 Script 탭에 자동으로 생성됩니다.

### Preview 탭

스크립트 실행 없이 폼의 레이아웃만 미리 봅니다. 실제 데이터나 이벤트는 동작하지 않으므로 UI 배치 확인 용도로만 씁니다. F5(Test Run)로 실제 실행을 확인하는 것이 더 정확합니다.

## 속성 창 (Properties)

우측 패널로, 선택한 컴포넌트의 속성을 편집합니다. 속성은 **일반(General)**, **스타일(Style)**, **이벤트(Event)** 탭으로 분류됩니다.

**일반 탭**에서 자주 편집하는 속성입니다.

| 속성 | 설명 | 예시 |
|---|---|---|
| `name` | 스크립트에서 참조할 컴포넌트 ID | `btn_search` |
| `left`, `top` | 폼 내 좌표 (px) | `20`, `50` |
| `width`, `height` | 크기 (px) | `120`, `32` |
| `text` | 표시 텍스트 | `"조회"` |
| `visible` | 표시 여부 | `true` / `false` |
| `enable` | 활성화 여부 | `true` / `false` |
| `taborder` | Tab 키 이동 순서 | `1` |

속성 창에서 값을 수정하면 캔버스와 `.xfdl` 소스에 즉시 반영됩니다. 스크립트에서 런타임 중에 값을 바꾸려면 `this.btn_search.enable = false;`처럼 직접 접근합니다.

**이벤트 탭**에서는 어떤 이벤트에 어떤 핸들러 함수를 연결할지 설정합니다. 값 칸을 더블클릭하면 Script 탭으로 이동해 핸들러 함수가 자동 생성됩니다.

## 컴포넌트 도구 상자 (Toolbox)

하단 우측 패널(또는 [View] → [Toolbox])에 위치합니다. 폼에 배치할 수 있는 모든 컴포넌트가 카테고리별로 나열됩니다.

주요 카테고리입니다.

- **입력**: Edit, MaskEdit, Calendar, Spin, CheckBox, RadioButton
- **표시**: Static, Image, ProgressBar, Plot
- **선택**: Combo, Select, ListBox
- **데이터**: Grid, Tree
- **버튼**: Button, ToggleButton, ImageButton
- **컨테이너**: Div, Tab, GroupBox
- **팝업**: PopupDiv, Tooltip

컴포넌트를 캔버스에 드래그하면 기본 크기로 배치됩니다. 배치 후 Properties에서 `name`을 가장 먼저 의미 있는 이름으로 변경하는 것이 좋습니다. `name`을 바꾸지 않으면 `Button00`, `Button01`처럼 자동 부여된 이름이 스크립트 전체에 퍼져 나중에 수정이 어렵습니다.

## 출력 창 (Output)과 오류 창

하단 좌측 패널입니다. Test Run 중 발생하는 로그와 오류 메시지가 여기에 출력됩니다.

```text
[INFO]  Application started: MyProject v1.0
[DEBUG] SampleForm_onload called
[INFO]  transaction: search → /service/getSampleList.do
[INFO]  fn_searchCallback: rowCount=42
[ERROR] TypeError: Cannot read property 'length' of undefined
          at fn_validate (SampleForm.xfdl:47)
```

오류 메시지에는 파일명과 줄 번호가 포함되므로 클릭하면 Script 탭에서 해당 줄로 이동합니다. `nexacro.trace()` 함수를 스크립트에서 호출하면 원하는 시점에 출력 창에 메시지를 찍을 수 있습니다.

```javascript
// 디버그용 로그 출력
nexacro.trace("현재 Dataset 행 수: " + this.ds_list.rowcount);
```

## 형식 편집기 (Format Editor)

Grid 컴포넌트를 선택한 상태에서 속성 창의 [Format] 속성 옆 버튼을 클릭하면 형식 편집기(Format Editor)가 열립니다. Grid의 컬럼 구성, 헤더, 셀 타입, 너비 등을 GUI로 설정하는 전용 대화 상자입니다. Grid 관련 글에서 자세히 다루겠지만, 위치만 미리 파악해 두면 됩니다.

## 설계 → 개발 → 실행 워크플로

실제 개발 사이클은 네 단계를 반복합니다.

![Studio N 설계·개발·실행 워크플로](/assets/posts/nexacro-n-studio-ui-tour-workflow.svg)

1. **Design 탭**: 컴포넌트 배치, Properties에서 속성 설정
2. **Script 탭**: 이벤트 핸들러 및 비즈니스 로직 작성
3. **Test Run(F5)**: 내장 런타임으로 즉시 실행, 출력 창에서 로그 확인
4. **Build**: 검증이 끝나면 프로젝트 빌드 후 웹 서버 배포

Test Run 중 오류가 생기면 출력 창의 링크를 클릭해 Script 탭으로 이동해 수정하고 다시 F5로 실행합니다. 이 순환이 Nexacro 개발의 기본 리듬입니다.

## 패널 레이아웃 커스터마이징

각 패널은 제목 표시줄을 드래그해 도킹(Docking) 위치를 바꾸거나 플로팅(Floating) 상태로 띄울 수 있습니다. 모니터가 두 대인 환경에서는 속성 창과 출력 창을 보조 모니터로 옮겨 폼 편집기를 넓게 쓰는 방식이 생산성에 유리합니다.

레이아웃을 기본값으로 되돌리려면 [Window] → [Reset Window Layout]을 클릭합니다.

---

**지난 글:** [Nexacro Studio N 설치와 환경 구성](/posts/nexacro-n-studio-install/)

**다음 글:** [Nexacro Studio N 단축키 완전 정복](/posts/nexacro-n-studio-shortcuts/)

<br>
읽어주셔서 감사합니다. 😊
