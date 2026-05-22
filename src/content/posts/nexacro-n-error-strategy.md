---
title: "[Nexacro N] 에러 전략"
description: "Nexacro N 프로젝트에서 일관된 에러 처리 전략을 수립하는 방법을 설명합니다. 트랜잭션 에러 코드 분류, 공통 에러 핸들러 설계, 사용자 피드백 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-22"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "에러처리", "에러전략", "예외처리", "트랜잭션", "공통함수", "errCode"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-screen-responsibility/)에서 화면 책임 설계 원칙을 살펴보았다. 책임이 분리된 구조에서 가장 먼저 공통화해야 할 것이 바로 **에러 처리 전략**이다. 에러 처리가 화면마다 제각각이면, 사용자는 일관성 없는 메시지를 보게 되고 운영팀은 장애 원인을 파악하기 어려워진다.

## 에러 처리 흐름 이해

Nexacro N의 트랜잭션 콜백은 `svcId`, `errCode`, `errMsg` 세 인자를 전달한다. 이 세 값을 기반으로 에러 유형을 분류하고, 적절한 처리를 수행한다.

![에러 처리 흐름](/assets/posts/nexacro-n-error-strategy-flow.svg)

`errCode`가 `0`이면 정상 응답이다. `0`이 아닌 경우 에러인데, 그 성격에 따라 처리 방식이 달라진다.

## 에러 코드 분류 체계

프로젝트마다 서버 에러 코드 체계가 다르지만, 일반적으로 다음과 같이 분류한다.

| errCode | 의미 | 처리 방식 |
|---------|------|-----------|
| 0 | 정상 | 비즈니스 로직 계속 실행 |
| -1 | 네트워크 오류 | "서버 연결 실패" 안내 |
| 9999 | 세션 만료 | 로그인 화면으로 이동 |
| 1xxx | 비즈니스 경고 | Alert 표시, 재입력 유도 |
| 5xxx | 서버 내부 오류 | 운영 로그 전송 후 안내 |

이 분류를 코드에 하드코딩하면 유지보수가 어려워지므로, 공통 상수 파일에 정의해두는 것이 좋다.

```javascript
// gfn_const.xjs
var ERR_NETWORK      = -1;
var ERR_SESSION_EXP  = 9999;
var ERR_BUSI_PREFIX  = 1000;
var ERR_SERVER_PREFIX = 5000;
```

## 공통 에러 핸들러 설계

모든 트랜잭션 콜백에서 공통 에러 핸들러를 호출하면 중복 코드를 제거할 수 있다.

![공통 에러 핸들러 구현](/assets/posts/nexacro-n-error-strategy-code.svg)

각 화면의 콜백은 에러 처리를 위임하고, 정상 케이스 로직에만 집중할 수 있다.

```javascript
// 개별 화면 콜백 — 공통 핸들러에 위임
function fn_searchCb(svcId, errCode, errMsg) {
    if (fnDefaultCallback(svcId, errCode, errMsg)) return;

    // 여기는 errCode == 0인 경우만 실행
    grd_result.setRedraw(true);
    lbl_rowCount.set_text("총 " + dsResult.rowcount + "건");
}
```

`fnDefaultCallback`이 `true`를 반환하면(에러 처리 완료) 개별 콜백은 즉시 반환한다. `false`를 반환하면 정상 처리를 계속한다.

## 사용자 피드백 패턴

에러 발생 시 사용자에게 어떤 메시지를 어떻게 보여줄지도 일관성이 중요하다.

**알림창(Alert)**: 간단한 정보 전달. 확인 버튼 하나.

```javascript
gfn_alert("입력한 날짜 형식이 올바르지 않습니다.");
```

**확인창(Confirm)**: 중요한 작업 전 사용자 동의 요청.

```javascript
gfn_confirm("선택한 10건을 삭제하시겠습니까?", "fn_deleteConfirmCb");
```

**인라인 표시**: Grid 셀 또는 입력 필드 옆에 직접 표시. 유효성 검증 오류에 적합.

```javascript
edt_email.set_tooltiptext("이메일 형식이 올바르지 않습니다.");
edt_email.set_tooltiptype("balloon");
```

## 로그 전송 패턴

심각한 에러는 사용자 화면에 표시하는 것 외에, 서버로 로그를 전송해 운영팀이 인지할 수 있도록 해야 한다.

```javascript
function gfn_logError(svcId, errCode, errMsg) {
    // 로그 Dataset 구성
    dsErrLog.clearData();
    dsErrLog.addRow();
    dsErrLog.setColumn(0, "svcId",    svcId);
    dsErrLog.setColumn(0, "errCode",  errCode);
    dsErrLog.setColumn(0, "errMsg",   errMsg);
    dsErrLog.setColumn(0, "userId",   g_userId);
    dsErrLog.setColumn(0, "formId",   this.name);
    dsErrLog.setColumn(0, "logTime",  gfn_getSysDate());

    // 비동기 로그 전송 (응답 콜백 불필요)
    this.transaction(
        "errLog",
        "/api/common/logError",
        "dsInput=dsErrLog",
        "", "", ""
    );
}
```

## 에러 전략 체크리스트

에러 처리 전략을 팀 내에서 공유하기 전에 다음 항목을 점검한다.

- [ ] 공통 에러 핸들러 함수가 정의되어 있는가?
- [ ] errCode 분류 기준이 문서화되어 있는가?
- [ ] 세션 만료 시 자동 로그인 이동이 구현되어 있는가?
- [ ] 운영 환경 에러 로그 전송이 활성화되어 있는가?
- [ ] 사용자 메시지 톤이 일관적인가? (기술적 메시지 노출 금지)

---

**지난 글:** [화면 책임 설계](/posts/nexacro-n-screen-responsibility/)

**다음 글:** [로깅 표준](/posts/nexacro-n-logging-standard/)

<br>
읽어주셔서 감사합니다. 😊
