---
title: "[Nexacro N] ImageViewer · Picture — 이미지 표시 컴포넌트 완전 정복"
description: "Nexacro N의 ImageViewer와 Picture 컴포넌트 차이점, stretch 옵션, 런타임 URL 교체, Dataset 바인딩, 실무 이미지 뷰어 구현 패턴을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-02"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "imageviewer", "picture", "이미지", "stretch", "set_url", "바인딩"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-static/)에서 Static 컴포넌트로 텍스트를 표시하는 방법을 살펴봤습니다. 이번에는 이미지를 화면에 출력하는 두 컴포넌트 `ImageViewer`와 `Picture`를 다룹니다. 둘 다 이미지를 보여주지만 설계 목적이 달라 적재적소에 사용해야 합니다.

## ImageViewer vs Picture — 무엇이 다른가

`ImageViewer`는 **런타임에 URL이 바뀌는 동적 이미지**를 위한 컴포넌트입니다. 직원 프로필 사진처럼 조회 결과에 따라 매번 다른 이미지를 보여야 할 때 사용합니다. 스크롤바 지원도 내장되어 있어 원본 크기 이미지를 탐색하는 데도 적합합니다.

`Picture`는 **디자인 리소스나 상태 아이콘**처럼 미리 정의된 이미지를 전환하는 컴포넌트입니다. `imageInfo` 속성에 상태별 이미지를 매핑해두고 `index`를 바꿔 상태를 표현합니다. 버튼 아이콘, 상태 표시 아이콘, 로고 등에 어울립니다.

![ImageViewer vs Picture 비교](/assets/posts/nexacro-n-imageviewer-picture-overview.svg)

## ImageViewer 기본 사용법

Studio에서 `ImageViewer` 컴포넌트를 폼에 배치하면 다음과 같은 XML이 생성됩니다.

```xml
<ImageViewer id="imgv_photo"
  left="20" top="20" width="200" height="200"
  url=""
  stretch="fit"
  scrollbars="autoboth"/>
```

`url` 속성에 이미지 경로를 넣으면 바로 표시됩니다. 경로는 절대 URL(http://...) 또는 프로젝트 내부 상대 경로 모두 지원합니다.

### stretch 옵션

이미지가 컴포넌트 영역과 크기가 다를 때 어떻게 맞출지 지정합니다.

| 값 | 동작 |
|---|---|
| `fit` | 비율 유지, 영역 안에 맞춤 (빈 공간 발생 가능) |
| `fill` | 영역을 완전히 채움 (비율 무시) |
| `none` | 원본 크기 그대로 (스크롤 필요할 수 있음) |
| `auto` | 이미지가 영역보다 크면 `fit` 적용, 작으면 원본 크기 |

프로필 사진처럼 비율이 중요한 경우 `fit`, 배경 채우기는 `fill`, 상세 이미지 확인은 `none + scrollbars`가 실무 표준입니다.

## 런타임 URL 교체

그리드나 목록에서 행을 선택하면 이미지를 교체하는 패턴이 가장 흔합니다. `set_url()` 메서드를 사용합니다.

```javascript
function grd_emp_oncellclick(obj, e) {
  var row = e.row;
  var url = this.ds_empPhoto.getColumn(row, "photo_url");
  this.imgv_photo.set_url(url);
}
```

Dataset의 `photo_url` 컬럼에 이미지 경로가 저장되어 있다고 가정한 예입니다. 행 클릭 이벤트에서 해당 행의 URL을 꺼내 `set_url()`로 전달합니다.

### 이미지 로드 완료 이벤트

이미지가 로드된 뒤 후처리가 필요하다면 `onloadcomplete` 이벤트를 사용합니다.

```javascript
function imgv_photo_onloadcomplete(obj, e) {
  // 이미지 로드 성공 처리
  this.sta_imgStatus.set_text("이미지 로드 완료");
}
```

네트워크 이미지라면 로딩 중 상태 표시를 이 이벤트로 제어하면 됩니다.

## Dataset 바인딩으로 이미지 목록 구현

썸네일 목록처럼 여러 이미지를 반복 출력할 때는 `bindingInfo`로 Dataset과 연결합니다.

```xml
<ImageViewer id="imgv_thumb"
  bindingInfo="ds_product:thumb_url"
  stretch="auto"
  width="120" height="120"/>
```

`bindingInfo` 형식은 `{데이터셋ID}:{컬럼명}`입니다. Dataset의 현재 행이 바뀌면 이미지도 자동으로 갱신됩니다.

![ImageViewer 동적 바인딩 패턴](/assets/posts/nexacro-n-imageviewer-picture-binding.svg)

## Picture 컴포넌트 — 상태 이미지 관리

`Picture`는 `imageInfo` 속성에 여러 이미지를 등록하고, `index`로 현재 표시할 이미지를 선택하는 구조입니다.

```xml
<Picture id="pic_status"
  left="300" top="20" width="32" height="32"
  imageInfo="images/ok.png;images/warn.png;images/error.png"
  index="0"/>
```

세미콜론으로 이미지 경로를 구분합니다. `index="0"`이면 첫 번째(`ok.png`), `index="1"`이면 두 번째(`warn.png`)가 표시됩니다.

### 런타임 상태 전환

```javascript
function fn_updateStatus(statusCode) {
  // statusCode: 0=정상, 1=경고, 2=오류
  this.pic_status.set_index(statusCode);
}
```

조건에 따라 `set_index()`만 호출하면 이미지가 바뀝니다. 조건별 분기 로직 없이 인덱스 매핑만으로 상태를 표현할 수 있어 코드가 간결해집니다.

## 실무 패턴 — 이미지 없음 처리

서버에 이미지가 없거나 URL이 빈 문자열일 때 기본 이미지를 보여주는 방법입니다.

```javascript
function fn_loadPhoto(photoUrl) {
  var url = photoUrl || "images/no_photo.png";
  this.imgv_photo.set_url(url);
}
```

빈 URL이 들어오면 기본 이미지 경로로 대체합니다. ImageViewer는 빈 URL을 넘기면 이미지 영역이 공백으로 남기 때문에 이런 방어 코드가 필요합니다.

## 정리

`ImageViewer`는 런타임에 URL이 바뀌는 동적 이미지, `Picture`는 미리 정의된 상태 아이콘에 사용합니다. `stretch` 옵션으로 이미지 맞춤 방식을 제어하고, `set_url()` / `set_index()`로 런타임 교체를 처리합니다. Dataset과의 바인딩을 활용하면 목록 연동 이미지 뷰어도 간단하게 구현할 수 있습니다.

---

**지난 글:** [Nexacro N Static — 텍스트 레이블 컴포넌트의 모든 활용법](/posts/nexacro-n-static/)

**다음 글:** [Nexacro N ProgressBar — 진행 상태 시각화 컴포넌트](/posts/nexacro-n-progressbar/)

<br>
읽어주셔서 감사합니다. 😊
