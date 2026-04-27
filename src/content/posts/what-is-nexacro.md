---
title: "넥사크로란 무엇인가"
description: "넥사크로를 처음 접하는 팀을 위해 구조, 핵심 개념, 실무 활용 포인트를 한 번에 정리합니다."
author: "PALDYN Team"
pubDate: "2026-04-19"
archiveOrder: 3
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "basics", "dataset", "transaction", "enterprise-ui"]
featured: false
draft: false
---

사내 시스템을 처음 구축하거나 유지보수를 맡으면 자주 만나는 질문이 있습니다.
"넥사크로는 그냥 UI 툴인가요, 아니면 프레임워크인가요?"

짧게 답하면, 넥사크로는 **업무용 애플리케이션을 빠르게 구축하기 위한 통합 플랫폼**입니다.
화면 컴포넌트만 제공하는 도구가 아니라, 데이터 처리와 서버 연동까지 하나의 흐름으로 묶어줍니다.

![넥사크로 런타임 개요](/assets/posts/nexacro-overview.svg)

---

## 핵심 한 줄 요약

> 넥사크로는 UI, 데이터셋, 트랜잭션을 표준화해 엔터프라이즈 업무 화면을 빠르게 구현하도록 돕는 플랫폼이다.

---

## 넥사크로를 구성하는 3가지 축

![넥사크로의 3가지 축: 화면 · 데이터 · 서버 연동](/assets/posts/nexacro-three-axes.svg)

### 1) 화면(Form + 컴포넌트)
- `Form` 안에 `Button`, `Edit`, `Grid`, `Combo` 같은 컴포넌트를 배치합니다.
- 이벤트(`onload`, `onclick`, `onchanged`)로 사용자 상호작용을 처리합니다.
- 업무 화면을 빠르게 조립할 수 있습니다.

### 2) 데이터(Dataset)
- 화면 컴포넌트와 데이터를 바인딩해, 값이 자동으로 동기화됩니다.
- 행 상태(신규/수정/삭제)를 추적해 변경 데이터를 명확히 다룰 수 있습니다.
- 정렬/필터/집계 같은 처리를 프론트에서 일관되게 수행합니다.

### 3) 서버 연동(Transaction)
- `transaction()`으로 요청 URL, in/out Dataset, 인자값을 한 번에 정의합니다.
- 성공/실패 콜백 패턴이 공통화되어, 팀 단위 개발 시 코드 스타일을 맞추기 쉽습니다.
- 백엔드와 데이터 계약(컬럼명/형식/코드)만 정리되면 화면 생산성이 높아집니다.

---

## "툴"이 아니라 "운영 가능한 구조"인 이유

넥사크로가 실무에서 오래 쓰이는 이유는 단순합니다.
업무 시스템에서 중요한 것은 "예쁜 화면"보다 **일관된 운영 구조**이기 때문입니다.

- 공통 함수(`gfn_`) 기반 에러 처리와 메시지 표준화
- 공통 팝업, 권한 체크, 입력 검증 규칙 재사용
- 다수 화면에서 동일한 데이터 처리 패턴 유지

즉, 개발자가 바뀌어도 운영 방식이 크게 흔들리지 않습니다.

---

## 간단 예제로 보는 기본 흐름

아래는 조회 버튼 클릭 시 서버에서 목록을 가져오는 가장 기본적인 패턴입니다.

```javascript
this.fnSearch = function () {
  // 검색 조건 세팅
  this.dsSearch.clearData();
  const row = this.dsSearch.addRow();
  this.dsSearch.setColumn(row, "keyword", this.edtKeyword.value);

  // 서버 트랜잭션 호출
  this.transaction(
    "searchUsers",                          // service id
    "/api/users/search.do",                // url
    "in_ds=dsSearch",                      // in dataset
    "out_ds=dsUsers",                      // out dataset
    "",                                    // args
    "fnCallback"                           // callback
  );
};

this.fnCallback = function (svcId, errorCode, errorMsg) {
  if (errorCode < 0) {
    this.alert("조회 실패: " + errorMsg);
    return;
  }

  this.staCount.set_text("총 " + this.dsUsers.rowcount + "건");
};
```

핵심은 이겁니다.
- `Form` 이벤트에서 액션 시작
- `Dataset`으로 입력/출력 데이터 표준화
- `transaction` 콜백에서 결과 처리

이 구조가 반복되면서 팀의 개발 속도와 유지보수성이 동시에 올라갑니다.

---

## 도입 전에 꼭 확인할 체크포인트

1. 공통 규약부터 정하기: 네이밍, 에러코드, 콜백 처리 방식  
2. 데이터 계약 먼저 맞추기: 컬럼명/타입/필수값 정의  
3. 화면 단위 책임 분리: 조회, 편집, 저장 흐름을 섞지 않기  
4. 성능 기준 정의: Grid 대용량 처리 기준과 페이징 전략  
5. 운영 기준 포함하기: 로그, 장애 대응, 배포 절차

---

## 정리

- 넥사크로는 컴포넌트 툴이 아니라 **업무 시스템 개발 플랫폼**에 가깝습니다.
- 강점은 화면/데이터/연동의 표준화입니다.
- 팀 개발 관점에서 일관성 있는 코드와 운영 구조를 만들기 좋습니다.

다음 글에서는 실제 개발에 들어가기 전에 꼭 알아야 할
**Application, Frame, Form의 관계와 역할**을 정리해보겠습니다.

---

**다음 글:** [화면 기본 단위 이해하기: Application · Frame · Form](/posts/nexacro-application-frame-form/)

<br>
읽어주셔서 감사합니다. 😊
