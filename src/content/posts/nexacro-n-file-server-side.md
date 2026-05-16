---
title: "[Nexacro N] 파일 서버 처리"
description: "Nexacro N 파일 업로드의 서버 측 처리 방법, Spring Boot Multipart 수신, UUID 저장명 변환, DB 메타 등록, 다운로드 스트리밍 구현 패턴과 보안 체크리스트를 설명합니다."
author: "PALDYN Team"
pubDate: "2026-05-16"
archiveOrder: 7
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "파일서버", "SpringBoot", "Multipart", "UUID", "파일보안"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-file-progress/)에서 업로드 진행률 UI 구현을 살펴보았다. 클라이언트 측 구현이 완성되어도 서버가 파일을 올바르게 수신·저장하지 않으면 기능이 완성되지 않는다. 이 글은 Nexacro N이 전송하는 multipart 요청을 서버에서 수신해 안전하게 처리하는 방법을 다룬다.

## Nexacro N의 업로드 요청 형식

`FileUpload.upload()` 또는 `uploadFile()`을 호출하면 클라이언트는 `multipart/form-data` 형식의 HTTP POST 요청을 전송한다. 서버는 이 요청을 Multipart 파서로 수신한다. 파트 이름(form field명)은 `FileUpload` 컴포넌트의 `paramname` 속성으로 지정한다.

```xml
<FileUpload id="fileUpload"
    uploadURL="/upload/file"
    paramname="file"
    multiple="true"/>
```

서버에서 `@RequestParam("file") MultipartFile file`로 수신한다.

## Spring Boot 업로드 처리

Spring Boot에서 Multipart 업로드를 처리하는 Controller를 구성한다.

```java
@PostMapping("/upload/file")
public ResponseEntity<Map<String,String>> uploadFile(
        @RequestParam("file") MultipartFile file) throws Exception {

    String origName = file.getOriginalFilename();
    String ext      = getExtension(origName).toLowerCase();

    // 허용 확장자 화이트리스트 검증
    Set<String> allowed = Set.of("pdf","xlsx","docx","jpg","png");
    if (!allowed.contains(ext)) {
        throw new IllegalArgumentException("허용되지 않는 파일 형식");
    }

    // UUID 저장명 생성
    String storedName = UUID.randomUUID().toString() + "." + ext;
    Path   savePath   = Paths.get(UPLOAD_DIR, storedName);
    file.transferTo(savePath);

    // DB 메타 등록
    fileService.saveMeta(origName, storedName, file.getSize());

    return ResponseEntity.ok(Map.of(
        "fileId",    storedName,
        "origName",  origName,
        "size",      String.valueOf(file.getSize())
    ));
}
```

![파일 서버 처리 아키텍처](/assets/posts/nexacro-n-file-server-side-arch.svg)

![Spring Boot 업로드 처리 예시](/assets/posts/nexacro-n-file-server-side-code.svg)

## application.properties 설정

```properties
spring.servlet.multipart.max-file-size=50MB
spring.servlet.multipart.max-request-size=200MB
app.upload.dir=/var/filestore/uploads
```

`max-file-size`는 파일 하나, `max-request-size`는 요청 전체의 크기 제한이다. 다중 파일 업로드를 고려해 `max-request-size`를 넉넉하게 설정한다.

## DB 파일 메타 테이블

```sql
CREATE TABLE TB_FILE (
    FILE_ID     VARCHAR(36)   PRIMARY KEY,  -- UUID
    ORIG_NM     VARCHAR(255)  NOT NULL,     -- 원본 파일명
    STORED_NM   VARCHAR(40)   NOT NULL,     -- UUID 저장명
    FILE_SIZE   BIGINT        NOT NULL,
    UPLOAD_DT   TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    REF_KEY     VARCHAR(50),               -- 첨부 대상 ID (예: 게시글 ID)
    DEL_YN      CHAR(1)       DEFAULT 'N'
);
```

`FILE_ID`(UUID)가 다운로드 URL의 키가 된다. `STORED_NM`으로 실제 파일 경로를 조회한다.

## 파일 다운로드 스트리밍

저장된 파일을 서버에서 스트리밍해 브라우저로 전달한다.

```java
@GetMapping("/download/file")
public ResponseEntity<Resource> downloadFile(
        @RequestParam String fileId) throws Exception {

    FileMeta meta    = fileService.findById(fileId);
    Path     path    = Paths.get(UPLOAD_DIR, meta.getStoredNm());
    Resource resource = new FileSystemResource(path);

    String encodedName = URLEncoder.encode(
        meta.getOrigNm(), StandardCharsets.UTF_8)
        .replace("+", "%20");

    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION,
            "attachment; filename*=UTF-8''" + encodedName)
        .contentType(MediaType.APPLICATION_OCTET_STREAM)
        .body(resource);
}
```

`Content-Disposition` 헤더에 `filename*=UTF-8''` 인코딩 형식을 사용하면 한글 파일명이 깨지지 않는다.

## 보안 핵심 원칙

| 위협 | 대응 |
|------|------|
| 악성 파일 업로드 | 확장자 화이트리스트 + MIME 타입 검증 |
| 경로 탐색 | 저장 경로를 UUID로 고정, 웹 루트 외부 저장 |
| 직접 URL 접근 | UPLOAD_DIR을 웹 접근 불가 경로로 설정 |
| 대용량 공격 | `max-file-size` / `max-request-size` 제한 |
| 파일 이름 인젝션 | 원본 파일명을 직접 저장하지 않고 UUID 사용 |

저장 경로(`/var/filestore/`)를 웹 서버 루트(`/webapp/`) 밖에 두면 `http://server/uploads/uuid.pdf` 같은 직접 접근을 근본적으로 차단할 수 있다.

## Nexacro 클라이언트에서 응답 읽기

서버가 JSON을 응답하면 `onuploadcompleted` 이벤트의 `e.responsedata`로 읽을 수 있다.

```javascript
function fileUpload_onuploadcompleted(obj, e) {
    if (e.errcode == 0) {
        var oRes = JSON.parse(e.responsedata);
        var nRow = this.dsFileList.addRow();
        this.dsFileList.setColumn(nRow, "FILE_ID",   oRes.fileId);
        this.dsFileList.setColumn(nRow, "ORIG_NM",   oRes.origName);
        this.dsFileList.setColumn(nRow, "FILE_SIZE",  oRes.size);
    }
}
```

서버 응답에서 받은 `fileId`를 Dataset에 저장해두면 이후 다운로드 요청에 사용할 수 있다.

## 정리

서버 측 파일 처리의 핵심은 **확장자 화이트리스트 검증 → UUID 저장명 교체 → 웹 루트 외부 저장 → DB 메타 등록**의 순서다. 다운로드 시에는 `Content-Disposition` 헤더로 원본 파일명을 UTF-8 인코딩해 전달하면 한글 파일명 문제를 해결할 수 있다.

---

**지난 글:** [파일 업로드 진행률](/posts/nexacro-n-file-progress/)

**다음 글:** [엑셀 내보내기·가져오기](/posts/nexacro-n-excel-export-import/)

<br>
읽어주셔서 감사합니다. 😊
