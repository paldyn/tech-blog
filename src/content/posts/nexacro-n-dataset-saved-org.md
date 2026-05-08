---
title: "[Nexacro N] Dataset savedOrg — 원본 데이터 보관"
description: "Nexacro N Dataset이 서버에서 받은 원본 값을 어떻게 savedOrg에 보관하는지, getOrgColumn·restoreColumn·resetData·acceptRow의 동작 원리와 활용 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-07"
archiveOrder: 4
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "dataset", "savedorg", "getOrgColumn", "restoreColumn", "resetData", "acceptRow"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-dataset-row-status/)에서 rowType으로 행의 변경 상태를 추적하는 법을 다뤘습니다. Dataset은 rowType과 함께 **원본 값(savedOrg)**도 내부에 보관합니다. 사용자가 값을 수정해도 원본이 사라지지 않기 때문에, 언제든 수정 전 값을 되찾거나 비교할 수 있습니다.

## savedOrg란?

`transaction()`으로 서버에서 데이터를 받으면 Dataset은 각 행의 값을 두 곳에 저장합니다.

- **current**: 현재 편집 중인 값 (화면에 표시)
- **savedOrg**: 서버에서 받았을 때의 원본 값

사용자가 `setColumn()`으로 값을 바꾸면 `current`만 변경되고 `savedOrg`는 그대로 남습니다.

![Dataset savedOrg 동작 흐름](/assets/posts/nexacro-n-dataset-saved-org-flow.svg)

## getOrgColumn — 원본 값 읽기

```javascript
// 현재 값과 원본 값 동시 조회
var orgVal = ds.getOrgColumn(i, "DEPT_NM"); // savedOrg 값
var curVal = ds.getColumn(i, "DEPT_NM");    // current 값

trace("원본: " + orgVal); // "개발팀"
trace("현재: " + curVal); // "개발1팀" (수정 후)
```

## restoreColumn — 특정 셀 원본 복원

개별 셀을 원본으로 되돌립니다. 행 전체가 아니라 **컬럼 단위로 취소**할 때 사용합니다.

```javascript
// 특정 행의 DEPT_NM 컬럼만 원본으로
ds.restoreColumn(i, "DEPT_NM");

// 복원 후 rowType도 자동 재계산
// 다른 컬럼도 원본과 같다면 rowType → NORMAL
```

## resetData — 전체 행 원본 복원

Dataset 전체를 `savedOrg` 기준으로 되돌립니다. 사용자가 **"취소"** 버튼을 눌렀을 때 가장 많이 씁니다.

```javascript
function btn_cancel_onclick(obj, e) {
    // 변경된 모든 행·컬럼을 원본으로 복원
    this.dsSave.resetData();
    // rowType이 모두 NORMAL로 바뀌고
    // INSERT 행은 제거, DELETE 행은 복원됨
}
```

![savedOrg 활용 패턴 코드](/assets/posts/nexacro-n-dataset-saved-org-code.svg)

## acceptRow — 수동 커밋

서버 저장 없이 현재 값을 새로운 원본으로 확정할 때 씁니다. `savedOrg`를 현재 값으로 덮어쓰고 rowType을 NORMAL로 변경합니다.

```javascript
// 특정 행만 수동 커밋 (rowType → NORMAL)
ds.acceptRow(i);

// 전체 행 커밋
for (var r = 0; r < ds.rowcount; r++) {
    ds.acceptRow(r);
}
```

주로 클라이언트 단에서 스텝별 처리 후 중간 상태를 확정해야 할 때 씁니다.

## 변경 감지 패턴

savedOrg를 이용해 화면이 열린 후 변경이 있는지 확인하는 패턴입니다.

```javascript
function fn_hasChanges() {
    for (var i = 0; i < ds.rowcount; i++) {
        if (ds.getRowType(i) != Dataset.ROWTYPE.NORMAL) {
            return true;
        }
    }
    return false;
}

// 페이지 이동 전 미저장 경고
function btn_move_onclick(obj, e) {
    if (fn_hasChanges()) {
        if (!confirm("저장하지 않은 변경이 있습니다.")) return;
    }
    this.gfn_movePage("nextPage");
}
```

## savedOrg 저장 시점 정리

| 시점 | savedOrg 갱신 |
|------|--------------|
| `transaction()` 성공 콜백 | 전체 행 갱신 |
| `loadXML()` 호출 | 전체 행 갱신 |
| `acceptRow(i)` 호출 | 해당 행만 갱신 |
| `setColumn()` 호출 | **갱신 없음** (current만 변경) |
| `resetData()` 호출 | **역방향** — savedOrg로 current 덮어씀 |

---

**지난 글:** [[Nexacro N] Dataset rowType — 행 상태 추적](/posts/nexacro-n-dataset-row-status/)

**다음 글:** [[Nexacro N] Dataset 행 추가·수정·삭제](/posts/nexacro-n-dataset-add-update-delete/)

<br>
읽어주셔서 감사합니다. 😊
