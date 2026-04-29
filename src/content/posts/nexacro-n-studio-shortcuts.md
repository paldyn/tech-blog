---
title: "[Nexacro N] Nexacro Studio N 단축키 완전 정복"
description: "Nexacro Studio N에서 생산성을 높이는 핵심 단축키를 파일·편집·디버그·Design 탭별로 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-29"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "studio", "단축키", "생산성", "디버그"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-studio-ui-tour/)에서 Nexacro Studio N의 각 패널 역할과 전체 화면 구성을 살펴봤습니다. 패널 위치를 파악했다면 그 다음 단계는 단축키 습득입니다. Studio N은 IDE로서 풍부한 키보드 단축키를 제공하며, 핵심 20여 개만 익혀도 마우스 의존도를 크게 줄일 수 있습니다.

## 단축키가 중요한 이유

Nexacro 개발의 특성상 Design 탭과 Script 탭을 수십 번씩 오가게 됩니다. 마우스로 탭을 클릭하고 파일을 저장하고 실행 버튼을 누르는 동작이 키보드 단축키로 대체되면, 하루 수백 번 반복되는 동작 시간이 눈에 띄게 줄어듭니다. 특히 `Ctrl+S → F5`(저장 후 즉시 실행) 패턴은 몸에 익히는 순간 개발 사이클이 체감상 2배 빠르게 돌아갑니다.

## 핵심 단축키 전체 맵

![Nexacro Studio N 핵심 단축키 맵](/assets/posts/nexacro-n-studio-shortcuts-keymap.svg)

세 영역으로 나눠 정리했습니다. 파일/실행, 편집/컴포넌트, 디버그/탐색 순입니다.

## 파일 · 실행 단축키

가장 자주 누르는 키 묶음입니다. 손에 익혀야 할 우선순위가 가장 높습니다.

| 단축키 | 기능 | 메모 |
|---|---|---|
| `Ctrl + S` | 현재 파일 저장 | 습관적으로 자주 |
| `Ctrl + Shift + S` | 열린 모든 파일 저장 | 빌드 전 필수 |
| `F5` | Test Run (전체 앱) | 가장 많이 씀 |
| `F6` | 현재 폼만 실행 | 빠른 UI 확인 |
| `Shift + F5` | 실행 중지 | 무한루프 발생 시 |
| `Ctrl + Shift + B` | 프로젝트 빌드 | 배포 패키지 생성 |
| `Ctrl + Z` | 실행 취소 | |
| `Ctrl + Shift + Z` | 다시 실행 | |
| `Ctrl + W` | 현재 탭 닫기 | |
| `Ctrl + Tab` | 열린 탭 전환 | |

`F6`은 `F5`(전체 앱 실행)와 달리 현재 편집 중인 폼 파일만 독립적으로 실행합니다. 레이아웃이나 간단한 스크립트를 빠르게 확인할 때 전체 앱을 로드하는 것보다 훨씬 빠릅니다.

## 편집 · Script 탭 단축키

Script 탭에서 코드를 작성할 때 필요한 단축키입니다.

| 단축키 | 기능 | 활용 팁 |
|---|---|---|
| `Ctrl + F` | 텍스트 찾기 | 함수명, 변수명 검색 |
| `Ctrl + H` | 찾기·바꾸기 | 변수명 일괄 변경 |
| `Ctrl + Shift + F` | 프로젝트 전체 검색 | 여러 폼에 걸친 심볼 찾기 |
| `Ctrl + G` | 줄 번호로 이동 | 오류 위치 즉시 이동 |
| `Ctrl + /` | 줄 주석 토글 | 블록 선택 후 일괄 적용 가능 |
| `Tab` / `Shift+Tab` | 들여쓰기 / 내어쓰기 | 여러 줄 선택 후 적용 |

`Ctrl + /`는 선택한 줄 전체를 주석/비주석으로 한 번에 전환합니다. 특정 로직을 임시로 비활성화해 테스트할 때 매우 유용합니다.

```javascript
// Ctrl+/ 로 아래 두 줄 동시에 주석 처리
// this.fn_search();
// this.fn_validate();
```

`Ctrl + Shift + F`(전체 검색)는 폼 파일이 많아졌을 때 특정 함수나 Dataset 이름이 어디서 사용되는지 빠르게 파악할 때 씁니다. 결과 창에서 항목을 클릭하면 해당 파일의 해당 줄로 바로 이동합니다.

## 디버그 단축키

오류가 발생했을 때 원인을 빠르게 찾기 위한 단축키입니다.

| 단축키 | 기능 | 설명 |
|---|---|---|
| `F9` | 디버그 모드 실행 | 중단점에서 정지 |
| `Ctrl + F8` | 현재 줄에 중단점 설정/해제 | 토글 방식 |
| `F10` | Step Over | 현재 줄 실행 후 다음 줄로 |
| `F11` | Step Into | 함수 내부로 진입 |
| `Shift + F11` | Step Out | 현재 함수에서 빠져나옴 |
| `Ctrl + D` | 중단점 목록 | 설정된 중단점 전체 확인 |

디버그 활용 패턴입니다.

```javascript
function fn_searchCallback(sId, nErrorCode, sErrorMsg)
{
    // 1. Ctrl+F8로 이 줄에 중단점 설정
    // 2. F9로 디버그 실행
    // 3. 중단점에서 정지하면 변수 패널에서 nErrorCode, sErrorMsg 값 확인
    if (nErrorCode < 0) {
        alert(sErrorMsg);
        return;
    }
    // 4. F10으로 다음 줄로 이동하며 흐름 추적
    nexacro.trace("rowcount: " + this.ds_list.rowcount);
}
```

중단점에서 실행이 멈추면 우측 패널에 현재 스코프의 변수 목록이 나타납니다. Dataset의 행 수, 특정 변수 값 등을 실시간으로 확인할 수 있습니다.

## Design 탭 전용 단축키

컴포넌트를 배치하고 정렬하는 Design 탭에서만 동작하는 단축키입니다.

| 단축키 | 기능 |
|---|---|
| `방향키` | 선택 컴포넌트 1px 이동 |
| `Shift + 방향키` | 1px 크기 변경 |
| `Ctrl + 방향키` | 10px 단위 이동 |
| `Ctrl + 드래그` | 컴포넌트 복사 |
| `Ctrl + L` | 왼쪽 정렬 |
| `Ctrl + R` | 오른쪽 정렬 |
| `Ctrl + T` | 위쪽 정렬 |
| `Ctrl + B` | 아래쪽 정렬 |
| `Ctrl + Shift + H` | 같은 너비로 맞춤 |
| `Ctrl + Shift + V` | 같은 높이로 맞춤 |
| `Ctrl + E` | 가운데 수평 정렬 |
| `Ctrl + M` | 가운데 수직 정렬 |

정렬 단축키는 여러 컴포넌트를 선택한 상태에서 기준 컴포넌트를 중심으로 정렬합니다. 마우스로 픽셀 단위 위치를 맞추는 것보다 훨씬 정확합니다.

```text
[다중 정렬 예시]
1. Ctrl + 클릭으로 Button 3개 선택
2. Ctrl + T → 세 버튼이 최상단 컴포넌트 기준 위쪽 정렬
3. Ctrl + Shift + H → 세 버튼을 같은 너비로 맞춤
```

## 단축키 활용 시나리오

실무에서 자주 만나는 세 가지 상황별 단축키 패턴입니다.

![단축키 활용 패턴 — 조회/저장/디버그](/assets/posts/nexacro-n-studio-shortcuts-tips.svg)

### 조회 화면 빠르게 만들기

1. Design 탭에서 Grid 드래그 → Properties에서 `name` 입력
2. Grid 더블클릭 → Script 탭 이동 + 이벤트 핸들러 자동 생성
3. `transaction()` 작성
4. `Ctrl + S` → `F5`

### 오류 원인 빠르게 찾기

1. `F5` 실행 → 출력 창 오류 메시지의 줄 번호 링크 클릭
2. Script 탭에서 해당 줄 이동 → `Ctrl + F8`로 중단점 설정
3. `F9` 디버그 실행 → 중단점에서 변수 값 확인
4. `F10`으로 한 줄씩 이동하며 원인 특정

### 여러 폼에서 함수 이름 바꾸기

1. `Ctrl + Shift + F`로 기존 함수명 검색 → 사용 위치 파악
2. 각 파일을 열고 `Ctrl + H`로 치환 실행
3. `Ctrl + Shift + S`로 모든 파일 일괄 저장
4. `F5`로 실행 확인

## 단축키 커스터마이징

[Tools] → [Key Binding]에서 단축키를 변경할 수 있습니다. 기존 IDE(Eclipse, IntelliJ 등)와 충돌하는 키가 있으면 여기서 재지정합니다. 단, 팀 개발 환경에서는 모두 같은 키 설정을 쓰는 것이 혼선을 줄여 줍니다.

## 자동 완성과 코드 힌트

단축키는 아니지만 함께 익혀 두면 좋은 기능입니다. Script 탭에서 `this.` 뒤에 커서를 놓으면 현재 폼에 있는 컴포넌트 목록이 자동 완성 팝업으로 나타납니다. `this.ds_` 처럼 일부만 입력해도 매칭 항목만 필터링됩니다. 이 기능 덕분에 컴포넌트 `name`을 모두 외울 필요 없이 앞 두세 글자만 입력하면 됩니다.

```javascript
// this. 입력 후 자동 완성 팝업에서 선택
this.btn_search.enable = false;
this.ds_list.cleardata();
this.grid_result.setRowPosition(0);
```

자동 완성이 동작하지 않는다면 `.xfdl` 파일을 저장하지 않은 상태이거나, 컴포넌트 `name`에 오타가 있는 경우가 대부분입니다.

---

**지난 글:** [Nexacro Studio N UI 완전 투어](/posts/nexacro-n-studio-ui-tour/)

**다음 글:** [Nexacro N 프로젝트 구조 완전 해설](/posts/nexacro-n-project-structure/)

<br>
읽어주셔서 감사합니다. 😊
