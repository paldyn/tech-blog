---
title: "[Nexacro N] 파일 트랜잭션: fileupload()와 filedownload() 완전 가이드"
description: "Nexacro N에서 파일 업로드·다운로드를 처리하는 fileupload(), filedownload() API의 파라미터 구조, 콜백 패턴, 서버 연동 방법을 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-12"
archiveOrder: 1
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "fileupload", "filedownload", "파일업로드", "파일다운로드", "트랜잭션"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-transaction-headers/)에서 트랜잭션에 커스텀 HTTP 헤더를 추가하는 방법을 살펴봤다. 일반 데이터 통신과 달리 파일을 주고받을 때는 `transaction()` 대신 전용 API인 `fileupload()`와 `filedownload()`를 사용해야 한다. 이 글에서는 두 함수의 파라미터 구조와 콜백 처리, 서버 연동 패턴을 상세히 설명한다.

## 파일 트랜잭션이란

Nexacro N에서 일반 데이터는 `transaction()`으로 주고받지만, 파일은 HTTP Multipart 요청(업로드) 또는 Binary Stream 응답(다운로드)이 필요하다. 이를 위해 `Application` 오브젝트에 `fileupload()`와 `filedownload()` 메서드가 제공된다.

두 함수 모두 비동기 방식으로 동작하며, 처리 완료 후 콜백 함수가 호출된다. 아래 다이어그램은 전체 흐름을 보여준다.

![파일 트랜잭션 흐름](/assets/posts/nexacro-n-file-transaction-flow.svg)

## fileupload() 파라미터

```
fileupload(svcID, ctrlID, dsID, arg1, arg2, callbackFn)
```

| 파라미터 | 설명 |
|----------|------|
| `svcID` | TypeDefinition에 등록된 서비스 ID (`"FileSvc::upload.do"`) |
| `ctrlID` | FileUpload 컴포넌트의 ID |
| `dsID` | 서버 응답을 받을 Dataset 이름 |
| `arg1` | 추가 파라미터 문자열 (없으면 `""`) |
| `arg2` | 예약 파라미터 (보통 `""`) |
| `callbackFn` | 완료 콜백 함수 이름 (문자열) |

`ctrlID`에는 `FileUpload` 컴포넌트의 ID를 그대로 넘긴다. 복수 파일을 담을 때도 컴포넌트가 내부적으로 배열을 관리하므로 개별 파일마다 별도 호출할 필요가 없다.

## filedownload() 파라미터

```
filedownload(svcID, fileURL, arg, callbackFn)
```

| 파라미터 | 설명 |
|----------|------|
| `svcID` | TypeDefinition에 등록된 서비스 ID |
| `fileURL` | 다운로드할 서버 경로 또는 식별자 |
| `arg` | 쿼리 파라미터 문자열 |
| `callbackFn` | 완료 콜백 함수 이름 |

브라우저 환경에서는 다운로드 완료 시 OS의 기본 저장 대화상자가 뜨거나, Content-Disposition 헤더에 따라 자동 저장된다.

## 코드 예시

![fileupload · filedownload 코드 예시](/assets/posts/nexacro-n-file-transaction-code.svg)

아래는 실제 폼 스크립트에서 사용하는 전형적인 패턴이다.

```javascript
// 업로드 실행
function btn_upload_onclick(obj, e) {
  if (this.FileUpload00.value == "") {
    alert("파일을 선택하세요.");
    return;
  }
  this.fileupload(
    "FileSvc::upload.do",
    "FileUpload00",
    "ds_uploadResult",
    "",
    "",
    "fn_uploadCb"
  );
}

// 업로드 콜백
function fn_uploadCb(svcID, errCode, errMsg) {
  if (errCode != 0) {
    alert("업로드 실패: " + errMsg);
    return;
  }
  alert("업로드 완료: " + this.ds_uploadResult.getColumn(0, "FILE_PATH"));
}

// 다운로드 실행
function btn_download_onclick(obj, e) {
  var filePath = this.ds_fileList.getColumn(
    this.Grid00.currentrow, "FILE_PATH"
  );
  this.filedownload(
    "FileSvc::download.do",
    filePath,
    "",
    "fn_downloadCb"
  );
}

// 다운로드 콜백
function fn_downloadCb(svcID, errCode, errMsg) {
  if (errCode != 0) {
    alert("다운로드 실패: " + errMsg);
  }
}
```

## TypeDefinition 서비스 등록

파일 업로드·다운로드를 위한 서비스는 일반 서비스와 동일하게 TypeDefinition에 등록한다. 단, 업로드 서비스의 URL은 Multipart를 처리할 수 있는 엔드포인트여야 한다.

```xml
<!-- TypeDefinition.xadl -->
<TypeDefinition>
  <Services>
    <Service id="FileSvc" url="%ServiceURL%/file"/>
  </Services>
</TypeDefinition>
```

실제 URL은 `Environment.xml`의 `%ServiceURL%` 변수로 관리한다.

## 서버 사이드 처리

Spring Boot 기준으로 업로드는 `@RequestParam MultipartFile file`로 받는다. 다운로드는 `Resource`를 `ResponseEntity`에 담아 반환하고 `Content-Disposition: attachment` 헤더를 설정해야 브라우저 저장이 정상 동작한다.

```java
// Spring Boot 업로드 예시
@PostMapping("/upload.do")
public ResponseEntity<String> upload(
    @RequestParam("file") MultipartFile file) {
  // 파일 저장 처리...
  return ResponseEntity.ok("{\"RESULT\":\"OK\"}");
}
```

Nexacro 어댑터를 사용하는 환경에서는 어댑터의 파일 업로드 전용 핸들러를 이용하면 Dataset 응답 포맷을 자동으로 맞출 수 있다.

## 주의 사항

- `FileUpload` 컴포넌트는 HTML5 런타임에서 `<input type="file">`로 렌더링되므로, 허용 파일 유형(`acceptFilter`)을 반드시 서버에서도 검증해야 한다.
- 업로드 크기 제한은 서버(예: Spring의 `spring.servlet.multipart.max-file-size`)와 Nexacro 서비스 설정 양쪽에서 관리한다.
- 다운로드 시 CORS 환경이라면 서버 응답 헤더에 `Access-Control-Expose-Headers: Content-Disposition`을 추가해야 파일명이 정상적으로 전달된다.

---

**지난 글:** [트랜잭션 커스텀 HTTP 헤더 추가](/posts/nexacro-n-transaction-headers/)

**다음 글:** [트랜잭션 캐시 비활성화 전략](/posts/nexacro-n-cache-disable/)

<br>
읽어주셔서 감사합니다. 😊
