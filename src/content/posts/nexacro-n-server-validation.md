---
title: "[Nexacro N] 서버 유효성 검사 처리"
description: "Nexacro N에서 transaction() 콜백의 errCode·errMsg를 활용해 서버 측 비즈니스 룰 검증 결과를 클라이언트에 전달하고 적절한 UX를 제공하는 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-13"
archiveOrder: 7
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "서버검증", "errCode", "errMsg", "콜백", "비즈니스룰"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-range-check/)에서 범위 검사를 구현했다. 클라이언트 검증을 모두 통과해도 서버에서 실패하는 경우가 있다. 중복 코드 체크, 외래키 제약, 재고 부족, 권한 부재 등은 DB나 비즈니스 로직을 알아야 판단할 수 있어 서버에서만 검증 가능하다. 이번에는 서버 검증 결과를 클라이언트로 전달하고 처리하는 패턴을 정리한다.

## 서버 검증의 위치

![서버 유효성 검사 흐름](/assets/posts/nexacro-n-server-validation-flow.svg)

Nexacro N의 `transaction()` 콜백은 세 번째 파라미터로 에러 코드(`nEC`)와 에러 메시지(`sEM`)를 받는다.

| 파라미터 | 의미 | 정상 값 |
|---|---|---|
| `sId` | 트랜잭션 ID | (설정한 값) |
| `nEC` | 에러 코드 (Error Code) | `0` |
| `sEM` | 에러 메시지 (Error Message) | `""` |

`nEC == 0`이면 정상, 그 외는 서버에서 오류가 발생했음을 의미한다. Nexacro 프레임워크 자체 에러는 음수(`-1`, `-2`...)이고, 애플리케이션 비즈니스 에러는 양수로 구분하는 것이 관례다.

## errCode / errMsg 패턴

서버 Adapter(Java, Node.js 등)는 처리 결과를 Nexacro 응답 형식으로 반환한다. Spring Boot Adapter 예시:

```java
// Java Spring Boot Adapter 예시
@Override
public NexacroResult execute(NexacroResult result) throws Exception {
    // 중복 체크
    if (userService.isDuplicate(userId)) {
        result.setErrorCode(1001);
        result.setErrorMsg("이미 등록된 사용자 ID입니다.");
        return result;
    }
    // 정상 처리
    userService.save(userDs);
    result.setErrorCode(0);
    return result;
}
```

`errCode`를 0으로 설정하면 클라이언트 콜백에서 `nEC == 0`으로 수신된다. 비즈니스 에러 시 의미 있는 코드와 메시지를 설정한다.

## 콜백에서 errCode 분기 처리

![errCode 분기 처리 코드](/assets/posts/nexacro-n-server-validation-code.svg)

```javascript
function fn_saveCb(sId, nEC, sEM) {
    if (nEC == 0) {
        this.ds_list.savePoint();
        this.fn_search();
        return;
    }
    // 에러 코드별 분기
    switch (nEC) {
        case -1   : alert("네트워크 오류입니다."); break;
        case 1001 : alert("이미 등록된 코드입니다."); break;
        case 2001 : alert("재고 부족: " + sEM); break;
        default   : alert(sEM || "저장 중 오류가 발생했습니다.");
    }
}
```

에러 코드가 적을 때는 `switch`로 분기하고, 많아지면 코드-메시지 매핑 객체로 관리하는 것이 좋다.

## 에러 코드 테이블 방식

에러 코드가 많아지면 `switch` 문이 길어진다. 코드-메시지 매핑 오브젝트를 공통 라이브러리에 정의하면 관리가 쉽다.

```javascript
// 공통 라이브러리
var ERROR_MSG = {
    "-1"  : "서버 연결 오류입니다.",
    "1001": "이미 등록된 코드입니다.",
    "1002": "필수 데이터가 누락되었습니다.",
    "2001": "재고가 부족합니다.",
    "3001": "권한이 없습니다. 관리자에게 문의하세요."
};

function gfn_handleServerError(nEC, sEM) {
    var msg = ERROR_MSG[String(nEC)];
    alert(msg ? msg : (sEM || "처리 중 오류가 발생했습니다. (코드: " + nEC + ")"));
}
```

```javascript
function fn_saveCb(sId, nEC, sEM) {
    if (nEC == 0) { this.ds_list.savePoint(); this.fn_search(); return; }
    gfn_handleServerError(nEC, sEM);
}
```

에러 메시지를 서버에서 직접 내려주는 경우(`sEM`이 충분히 명확한 경우)에는 `default: alert(sEM)`만으로 충분할 수 있다. 프로젝트 규약에 따라 결정한다.

## 서버 검증과 클라이언트 검증의 역할 분리

| 검증 종류 | 클라이언트 | 서버 |
|---|---|---|
| 필수값 | O (즉각 피드백) | O (최종 방어) |
| 형식 | O (정규식) | 선택적 |
| 범위 | O (빠른 차단) | 선택적 |
| 중복 코드 | X (DB 모름) | O (필수) |
| 외래키 제약 | X | O (필수) |
| 권한 체크 | X | O (필수) |
| 비즈니스 룰 | 가능한 경우 O | O (최종) |

클라이언트 검증은 UX를 위한 것이고, 서버 검증은 보안과 데이터 무결성을 위한 것이다. 클라이언트 검증을 우회할 수 있으므로 서버 검증은 반드시 유지해야 한다.

## 부분 실패 처리 — 멀티 행 저장 시

여러 행을 저장할 때 일부 행만 실패하는 경우, 서버 Adapter에서 실패한 행 정보를 응답 Dataset에 담아 클라이언트로 전달하는 패턴이 있다.

```javascript
// 서버가 실패한 행 정보를 ds_err에 담아 응답
function fn_saveCb(sId, nEC, sEM) {
    if (nEC != 0) { alert(sEM); return; }

    var errCnt = this.ds_err.getRowCount();
    if (errCnt > 0) {
        alert(errCnt + "건 처리 실패. 목록을 확인하세요.");
        // ds_err를 그리드에 바인딩해 표시
    } else {
        this.ds_list.savePoint();
        this.fn_search();
    }
}
```

이 패턴은 서버가 전체를 롤백하지 않고 성공한 행만 저장하는 구조에서 사용한다. 프로젝트 아키텍처에 맞게 선택한다.

---

**지난 글:** [[Nexacro N] 범위 검사 구현](/posts/nexacro-n-range-check/)

**다음 글:** [[Nexacro N] 그리드 유효성 검사](/posts/nexacro-n-grid-validation/)

<br>
읽어주셔서 감사합니다. 😊
