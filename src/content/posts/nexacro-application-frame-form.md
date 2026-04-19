---
title: "화면 기본 단위 이해하기: Application · Frame · Form"
description: "넥사크로 구조를 Application, Frame, Form 단위로 나눠서 역할과 책임을 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-19"
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "application", "frame", "form", "architecture"]
featured: false
draft: false
---

넥사크로를 처음 잡으면 화면부터 만들고 싶어집니다.
그런데 구조를 모르고 `Form`만 늘리기 시작하면, 나중에 공통 기능과 화면 책임이 엉켜 유지보수가 급격히 어려워집니다.

이번 글은 넥사크로의 기본 단위인 **Application · Frame · Form**을 한 번에 정리하고,
실무에서 어디까지를 각 단위의 책임으로 둘지 기준을 잡는 데 집중합니다.

![Application · Frame · Form 구조](/assets/posts/nexacro-app-frame-form.svg)

---

## 핵심 한 줄 요약

> Application은 "전역", Frame은 "배치", Form은 "업무 화면"을 담당한다.

---

## 1) Application: 앱의 전역 컨텍스트

`Application`은 넥사크로 앱 전체의 시작점입니다.
서비스 URL, 공통 라이브러리, 환경 설정처럼 **모든 화면이 공유해야 하는 전역 자원**을 다룹니다.

주요 역할:
- 서비스 그룹/URL 등록
- 전역 변수, 공통 초기화
- 공통 스크립트/함수 로드
- 앱 시작 시 기본 프레임 구성

실무 팁:
- 화면별 로직을 `Application`에 넣지 않습니다.
- 전역에는 "규칙"만 두고, 실제 업무 처리 코드는 `Form`으로 내립니다.

---

## 2) Frame: 화면 배치와 컨테이너

`Frame`은 실제 업무 데이터를 처리하기보다,
화면을 **어떻게 배치하고 어떤 화면을 담을지**를 관리하는 컨테이너입니다.

자주 보는 구성:
- `MainFrame`: 앱 전체의 최상위 프레임
- `VFrameSet` / `HFrameSet`: 좌우/상하 레이아웃 분할
- `ChildFrame`: 개별 화면(Form)을 담는 단위, 팝업에도 사용

실무 팁:
- 메뉴/헤더/콘텐츠 영역 분리는 `Frame`에서 끝냅니다.
- 특정 업무 데이터의 조회/저장은 `Frame`이 아니라 `Form`이 담당해야 합니다.

---

## 3) Form: 실제 업무 로직이 실행되는 화면

`Form`은 사용자가 직접 만나는 업무 화면입니다.
컴포넌트, 이벤트, `Dataset`, `transaction()`이 모두 여기서 맞물려 동작합니다.

주요 역할:
- 조회/저장/삭제 이벤트 처리
- `Dataset` 바인딩 및 검증
- 공통 함수 호출과 콜백 처리
- 사용자 인터랙션(UI state) 제어

실무 팁:
- 하나의 `Form`이 너무 많은 책임을 가지면 분리합니다.
- "검색 영역/목록/상세"가 복잡해지면 탭 또는 서브폼으로 나누는 편이 안전합니다.

---

## 코드로 보는 책임 분리 예시

아래 예시는 `Application`에서 공통 초기화, `Form`에서 실제 조회를 수행하는 기본 패턴입니다.

```javascript
// Application 공통 초기화 (예시)
this.gfnInitApplication = function () {
  this.gvApiBaseUrl = "https://api.example.com";
  this.gvUserId = "";
};

// Form onload
this.form_onload = function () {
  this.gfnInitForm();
  this.fnSearch(); // 실제 업무 조회는 Form에서 실행
};

// Form 조회
this.fnSearch = function () {
  this.transaction(
    "searchOrders",
    "/orders/list.do",
    "in_ds=dsSearch",
    "out_ds=dsOrders",
    "",
    "fnCallback"
  );
};
```

핵심은 단순합니다.
- 전역 설정은 `Application`
- 레이아웃/컨테이너는 `Frame`
- 사용자 업무 흐름은 `Form`

이 분리만 지켜도 코드 리뷰와 장애 대응이 훨씬 쉬워집니다.

---

## 팀 개발에서 많이 생기는 실수

1. `Frame`에 업무 로직을 넣는 경우  
2. `Application` 전역 변수로 화면 상태까지 관리하는 경우  
3. `Form` 하나에 검색/상세/팝업 로직을 모두 몰아넣는 경우  

이 세 가지는 초기에 빠르게 만들 때는 편해 보이지만,
운영 단계에서 가장 큰 유지보수 비용으로 돌아옵니다.

---

## 정리

- `Application`: 전역 설정과 공통 초기화
- `Frame`: 레이아웃과 화면 컨테이너
- `Form`: 실제 업무 로직 처리

넥사크로 프로젝트에서 구조가 깔끔한 팀은 보통 이 경계를 잘 지킵니다.
다음 글에서는 `Dataset`을 중심으로, 화면과 데이터가 실제로 어떻게 연결되는지 풀어보겠습니다.

---

**다음 글:** Dataset 기본기 — 컬럼, RowType, 바인딩 이해하기

<br>
읽어주셔서 감사합니다. 😊
