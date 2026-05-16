---
title: "[Nexacro N] 파일 업로드·다운로드"
description: "Nexacro N의 FileUpload 컴포넌트와 nexacro.FileDownload() 함수를 활용해 파일을 서버에 전송하고 다운로드하는 기본 패턴, 이벤트 처리, 오류 대응 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 4
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "파일업로드", "파일다운로드", "FileUpload", "FileDownload"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-page-navigation/)에서 페이지 내비게이션 패턴을 비교했다. 업무 시스템에서 빠질 수 없는 기능이 파일 업로드와 다운로드다. 첨부 파일 등록, 보고서 다운로드, 엑셀 업로드 등 파일 처리 시나리오는 거의 모든 업무 시스템에 존재한다. Nexacro N은 `FileUpload` 컴포넌트와 `nexacro.FileDownload()` 함수로 이 두 기능을 지원한다.

## 파일 업로드 컴포넌트

Nexacro N의 `FileUpload` 컴포넌트는 파일 선택 UI와 서버 전송 기능을 제공한다. Studio에서 Form에 컴포넌트를 추가하거나 스크립트로 생성할 수 있다.

주요 속성:

| 속성 | 설명 |
|------|------|
| `uploadURL` | 파일을 수신할 서버 URL |
| `multiple` | 다중 파일 선택 허용 여부 |
| `filter` | 허용 확장자 필터 (예: `"*.jpg;*.png"`) |
| `maxfilesize` | 파일당 최대 크기 (byte 단위) |

![파일 업로드·다운로드 흐름](/assets/posts/nexacro-n-file-upload-download-flow.svg)

## 업로드 기본 구현

파일 선택 → `upload()` 호출 → 완료 콜백이 기본 패턴이다.

```javascript
// 업로드 버튼 클릭
function btn_upload_onclick(obj, e) {
    if (this.fileUpload.getFileCount() == 0) {
        this.gfn_alert("파일을 선택해 주세요.");
        return;
    }
    this.fileUpload.uploadURL = "/upload/file";
    this.fileUpload.upload();
}

// 업로드 완료 이벤트
function fileUpload_onuploadcompleted(obj, e) {
    if (e.errcode == 0) {
        this.gfn_alert("업로드가 완료되었습니다.");
        this.fn_search();
    } else {
        this.gfn_alert("업로드 실패: " + e.errmsg);
    }
}
```

`e.errcode == 0`이 성공이고, `e.errmsg`에 오류 메시지가 담긴다. 업로드가 완료된 후 목록을 갱신하는 `fn_search()` 호출이 일반적인 패턴이다.

![업로드 / 다운로드 핵심 코드](/assets/posts/nexacro-n-file-upload-download-code.svg)

## 업로드 진행 이벤트

파일 크기가 클 경우 진행률 표시가 필요하다. `onprogress` 이벤트에서 진행률을 받을 수 있다.

```javascript
function fileUpload_onprogress(obj, e) {
    // e.loaded: 전송된 바이트, e.total: 전체 바이트
    var nPct = Math.round((e.loaded / e.total) * 100);
    this.pgbUpload.value = nPct;
    this.stcProgress.text = nPct + "% 업로드 중...";
}
```

`ProgressBar` 컴포넌트(`pgbUpload`)의 `value` 속성에 퍼센트를 설정하면 진행률 바를 표시할 수 있다.

## 파일 다운로드

파일 다운로드는 `nexacro.FileDownload()` 전역 함수를 사용한다.

```javascript
function btn_download_onclick(obj, e) {
    var sFileId = this.dsFileList.getColumn(
        this.dsFileList.rowposition, "FILE_ID"
    );
    if (!sFileId) {
        this.gfn_alert("다운로드할 파일을 선택하세요.");
        return;
    }
    nexacro.FileDownload("/download/file?fileId=" + sFileId);
}
```

`nexacro.FileDownload(url)`를 호출하면 브라우저의 파일 다운로드 다이얼로그가 열린다. URL에 인증 토큰이나 파일 ID를 Query String으로 포함시켜 서버에서 파일을 반환하도록 구성한다.

## 다운로드 완료 콜백

다운로드 완료 후 처리가 필요하다면 두 번째 인자로 콜백 함수명을 전달한다.

```javascript
nexacro.FileDownload("/download/file?fileId=" + sFileId,
    "fn_downloadCallback");

function fn_downloadCallback(errcode, errmsg) {
    if (errcode != 0) {
        this.gfn_alert("다운로드 실패: " + errmsg);
    }
}
```

## 파일 확장자 제한

업로드 허용 확장자를 `filter` 속성으로 제한하고, 서버에서도 반드시 확장자를 검증해야 한다.

```javascript
// 업로드 전 클라이언트 측 검증
function btn_upload_onclick(obj, e) {
    var sName = this.fileUpload.getFileName(0);
    var sExt  = sName.substring(sName.lastIndexOf(".") + 1).toLowerCase();
    var aAllowed = ["pdf", "xlsx", "docx", "png", "jpg"];
    if (aAllowed.indexOf(sExt) < 0) {
        this.gfn_alert("허용되지 않는 파일 형식입니다.");
        return;
    }
    this.fileUpload.upload();
}
```

클라이언트 측 검증은 UX용이고, 보안 검증은 서버에서 수행해야 한다.

## 정리

Nexacro N의 파일 처리는 `FileUpload` 컴포넌트로 업로드, `nexacro.FileDownload()`로 다운로드를 수행한다. 업로드는 `onuploadcompleted` 이벤트로 결과를 처리하고, 다운로드는 서버 URL에 파일 식별자를 전달하는 구조다. 다중 파일 업로드와 진행률 표시는 다음 글에서 이어서 다룬다.

---

**지난 글:** [페이지 내비게이션](/posts/nexacro-n-page-navigation/)

**다음 글:** [다중 파일 업로드](/posts/nexacro-n-multi-file-upload/)

<br>
읽어주셔서 감사합니다. 😊
