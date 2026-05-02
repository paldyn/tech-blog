---
title: "[Nexacro N] Tree — 트리 컴포넌트 완전 정복"
description: "Nexacro N Tree 컴포넌트의 계층 Dataset 구조, treeInfo 속성 설정, onnodeclick 이벤트, expandAll/collapseAll, 동적 노드 추가 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 6
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "tree", "treeinfo", "onnodeclick", "계층구조", "expandall"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-tab-control/)에서 TabControl로 화면을 탭으로 나누는 방법을 살펴봤습니다. 이번에는 조직도, 메뉴 구조, 카테고리 계층 같은 **계층형 데이터**를 표현하는 `Tree` 컴포넌트를 다룹니다.

## Tree 컴포넌트 개요

`Tree`는 부모-자식 관계의 계층 구조를 펼침/접힘 형태로 표시하는 컴포넌트입니다. Dataset과 `treeInfo` 속성을 연결하면 자동으로 계층 구조를 빌드합니다.

![Tree 구조와 Dataset 매핑](/assets/posts/nexacro-n-tree-structure.svg)

## Dataset 설계 — parent_id 방식

Tree에 연결하는 Dataset은 `node_id`와 `parent_id` 컬럼으로 계층을 표현합니다.

| 컬럼 | 역할 |
|---|---|
| `node_id` | 현재 노드의 고유 ID |
| `parent_id` | 부모 노드의 ID (루트는 null 또는 빈 문자열) |
| `node_text` | 트리에 표시될 텍스트 |
| `level` | 깊이 (선택사항, 정렬용) |

루트 노드는 `parent_id`가 없거나 null인 행입니다. 서버에서 데이터를 계층 순서대로 정렬해 전달하면 Nexacro가 자동으로 부모-자식 관계를 구성합니다.

## XML 설정

```xml
<Tree id="tre_org"
  left="10" top="10" width="250" height="400"
  bindingInfo="ds_tree"
  treeInfo="idcol:node_id;pidcol:parent_id;textcol:node_text;"/>
```

`treeInfo` 속성의 세미콜론 구분 키-값:

| 키 | 설명 |
|---|---|
| `idcol` | node_id 역할을 하는 컬럼명 |
| `pidcol` | parent_id 역할을 하는 컬럼명 |
| `textcol` | 화면에 표시될 텍스트 컬럼명 |

## onnodeclick 이벤트

```javascript
function tre_org_onnodeclick(obj, e) {
  var nodeId = e.node.getDataValue("node_id");
  var level  = e.node.level;

  // 리프 노드(자식이 없는 최하위)만 처리
  if (e.node.childcount == 0) {
    this.fn_loadDept(nodeId);
  }
}
```

`e.node`는 클릭된 Node 객체입니다. `getDataValue(컬럼명)`으로 해당 행의 데이터를 꺼낼 수 있습니다. `childcount`로 자식 노드 수를 확인해 리프 노드와 중간 노드를 구분합니다.

![Tree 코드 패턴](/assets/posts/nexacro-n-tree-code.svg)

## 펼치기·접기 제어

```javascript
// 전체 펼치기
this.tre_org.expandAll();

// 전체 접기
this.tre_org.collapseAll();

// 특정 노드 펼치기
this.tre_org.expandNode(this.tre_org.getRootNode().getChildNode(0));
```

`expandAll()`은 모든 노드를 펼치고, `collapseAll()`은 루트 자식까지만 남기고 모두 접습니다. 데이터가 많으면 `expandAll()` 호출 시 렌더링이 느릴 수 있으므로 주의합니다.

## 선택 노드 변경

프로그래밍으로 특정 노드를 선택 상태로 만들 때는 `selectNode()`를 사용합니다.

```javascript
function fn_selectNodeById(targetId) {
  var rootNode = this.tre_org.getRootNode();
  fn_findAndSelect(rootNode, targetId);
}

function fn_findAndSelect(node, targetId) {
  for (var i = 0; i < node.childcount; i++) {
    var child = node.getChildNode(i);
    if (child.getDataValue("node_id") == targetId) {
      this.tre_org.selectNode(child);
      return;
    }
    if (child.childcount > 0) {
      fn_findAndSelect(child, targetId);
    }
  }
}
```

재귀 탐색으로 특정 ID를 가진 노드를 찾아 선택합니다.

## 아이콘 적용

`imagecolumn` 속성으로 노드별 아이콘을 지정할 수 있습니다.

```xml
<Tree id="tre_org"
  treeInfo="idcol:node_id;pidcol:parent_id;
            textcol:node_text;imagecol:icon_path;"/>
```

Dataset에 `icon_path` 컬럼을 추가하고 이미지 경로를 넣으면 각 노드 앞에 아이콘이 표시됩니다.

## 트리 새로고침

Dataset 데이터가 바뀌면 Tree를 갱신해야 할 때 `refresh()`를 호출합니다.

```javascript
function fn_reloadTree() {
  this.ds_tree.clearData();
  this.transaction(
    "loadTree", "SVC:getOrgTree",
    "", "out:ds_tree",
    "", "fn_treeCallback"
  );
}

function fn_treeCallback(sId, nEC, sEM) {
  if (nEC == 0) {
    // ds_tree 갱신 → Tree 자동 갱신
  }
}
```

`bindingInfo`로 연결된 Dataset이 갱신되면 Tree 컴포넌트도 자동으로 다시 빌드됩니다.

## 정리

`Tree`는 계층 Dataset과 `treeInfo` 속성 연결만으로 복잡한 트리 구조를 자동 빌드합니다. `onnodeclick` 이벤트에서 `childcount`로 리프 노드를 구분하고, `getDataValue()`로 노드 데이터를 읽어 연계 조회를 구현합니다. 조직도·분류 체계·메뉴 구성 등 계층 탐색 UI에 폭넓게 활용할 수 있습니다.

---

**지난 글:** [Nexacro N TabControl — 탭 컨테이너 완전 정복](/posts/nexacro-n-tab-control/)

**다음 글:** [Nexacro N Menu · Navigation — 메뉴 네비게이션 구현](/posts/nexacro-n-menu-navigation/)

<br>
읽어주셔서 감사합니다. 😊
