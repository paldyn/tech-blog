---
title: "[Nexacro N] 권한 체크"
description: "Nexacro N 애플리케이션에서 메뉴 접근 권한, 버튼 CRUD 권한, 액션 직전 재검증, 서버 최종 검증까지 4단계 권한 체크 패턴을 설명합니다. ds_permission Dataset 기반 버튼 제어 코드를 실무 예제로 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-17"
archiveOrder: 7
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "권한체크", "CRUD권한", "메뉴권한", "보안", "ds_permission"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-session-timeout/)에서 세션 타임아웃 처리를 살펴보았다. 이번에는 사용자 역할에 따라 메뉴 접근과 버튼 동작을 제어하는 권한 체크 패턴을 다룬다. 클라이언트 권한 제어는 UX를 위한 것이고, 진짜 보안은 서버에서 담당한다는 원칙을 항상 명심해야 한다.

## 권한 체크 4단계

권한 체크는 층위를 나눠서 적용한다. 각 층이 역할이 다르기 때문에 하나만으로는 불완전하다.

![권한 체크 레이어](/assets/posts/nexacro-n-permission-check-layers.svg)

## 권한 Dataset 설계

로그인 직후 권한 Dataset을 로드한다. `SCRN_ID`(화면 ID)별로 CRUD 권한 여부를 저장한다.

```nexacro
// ds_perm 컬럼 구조
// SCRN_ID  | CAN_READ | CAN_CREATE | CAN_UPDATE | CAN_DELETE
// SCR001   |    Y     |     Y      |     Y      |     N
// SCR002   |    Y     |     N      |     N      |     N

// 로그인 콜백에서 권한 Dataset 조회
function fn_loginCallback(sId, nErrorCode, sErrorMsg) {
    if (nErrorCode < 0 || ds_userInfo.rowcount === 0) {
        alert("로그인 실패"); return;
    }
    // 권한 Dataset 별도 조회
    this.transaction(
        "svcPerm",
        "/api/user/permissions",
        "",
        "out:ds_perm=PERM_LIST",
        "",
        "fn_permCallback"
    );
}

function fn_permCallback(sId, nErrorCode, sErrorMsg) {
    if (nErrorCode >= 0) {
        // application 전역 Dataset으로 승격
        application.ds_perm.copyData(ds_perm);
        application.mainframe.changeForm("FrmMain::main/FrmMain.xfdl");
    }
}
```

권한 Dataset을 `application` 레벨로 승격해 두면 모든 화면에서 재조회 없이 바로 사용할 수 있다.

## 버튼 권한 적용

각 폼의 `Form_onload`에서 `fn_applyPermission()`을 호출해 현재 화면의 권한에 맞게 버튼 상태를 설정한다.

![버튼 권한 적용 패턴](/assets/posts/nexacro-n-permission-check-code.svg)

```nexacro
function fn_applyPermission() {
    var row = application.ds_perm.findRow("SCRN_ID", "SCR_ORDER_LIST");
    if (row < 0) {
        // 접근 권한 없음 → 강제 이동
        alert("접근 권한이 없습니다.");
        application.mainframe.changeForm("FrmMain::main/FrmMain.xfdl");
        return;
    }

    var canR = application.ds_perm.getColumn(row, "CAN_READ")   === "Y";
    var canC = application.ds_perm.getColumn(row, "CAN_CREATE") === "Y";
    var canU = application.ds_perm.getColumn(row, "CAN_UPDATE") === "Y";
    var canD = application.ds_perm.getColumn(row, "CAN_DELETE") === "Y";

    btn_search.set_enable(canR);
    btn_new.set_visible(canC);
    btn_save.set_visible(canC || canU);
    btn_delete.set_visible(canD);
}
```

`set_visible(false)`은 버튼을 완전히 숨기고, `set_enable(false)`는 보이지만 클릭할 수 없게 한다. 삭제처럼 위험한 기능은 `visible`, 조회는 `enable`로 제어하는 것이 일반적이다.

## 액션 직전 재검증

버튼이 숨겨져 있어도 스크립트로 직접 함수를 호출하는 경우를 방어하기 위해, 저장·삭제 실행 직전 권한을 재확인한다.

```nexacro
function fn_checkPermission(permType) {
    var colName = {
        "R": "CAN_READ",
        "C": "CAN_CREATE",
        "U": "CAN_UPDATE",
        "D": "CAN_DELETE"
    }[permType];

    var row = application.ds_perm.findRow("SCRN_ID", application.gv_scrnId);
    if (row < 0) return false;
    return application.ds_perm.getColumn(row, colName) === "Y";
}

function btn_delete_onclick(obj, e) {
    if (!fn_checkPermission("D")) {
        alert("삭제 권한이 없습니다.");
        return;
    }
    // 삭제 로직 진행
    fn_delete();
}
```

`fn_checkPermission()`을 공통 라이브러리에 정의해 두면 모든 화면에서 일관되게 사용할 수 있다.

## 그리드 컬럼 편집 권한

그리드에서 수정 권한이 없는 사용자는 셀을 편집하지 못하도록 설정한다.

```nexacro
function fn_applyGridPermission(canU) {
    // 수정 권한 없으면 그리드 전체 읽기 전용
    grd_list.set_editable(!canU);

    // 특정 컬럼만 편집 가능 제어
    if (!canU) {
        grd_list.setCellProperty("body", 2, "edittype", "none");
        grd_list.setCellProperty("body", 3, "edittype", "none");
    }
}
```

## 서버 측 권한 검증 (필수)

클라이언트에서 버튼을 숨겼다고 해서 API 호출 자체가 막히지는 않는다. 브라우저 개발자 도구나 프록시로 API를 직접 호출할 수 있으므로, 서버에서 반드시 재검증해야 한다.

```java
// Spring Security AOP 예시
@PreAuthorize("hasPermission(#scrnId, 'DELETE')")
@DeleteMapping("/api/orders/{id}")
public ResponseEntity<?> deleteOrder(@PathVariable Long id, 
                                      @RequestParam String scrnId) {
    orderService.delete(id);
    return ResponseEntity.ok().build();
}
```

클라이언트 권한 체크는 사용자 경험을 위한 것이고, 서버 권한 검증이 실제 보안이다. 두 가지를 항상 병행해야 한다.

---

**지난 글:** [세션 타임아웃 처리](/posts/nexacro-n-session-timeout/)

**다음 글:** [SSO 연동](/posts/nexacro-n-sso-integration/)

<br>
읽어주셔서 감사합니다. 😊
