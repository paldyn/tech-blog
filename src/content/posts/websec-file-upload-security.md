---
title: "파일 업로드 보안: 악성 파일 업로드 방어 전략"
description: "웹쉘 업로드, MIME 타입 위조, 경로 탈출, 악성 SVG/PDF 공격과 매직 바이트 검사, 이미지 재인코딩, UUID 파일명, S3 격리 스토리지, Content-Disposition 방어를 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-11"
archiveOrder: 10
type: "knowledge"
category: "Security"
tags: ["파일업로드보안", "웹쉘", "MIME검증", "S3업로드", "이미지보안", "경로탈출"]
featured: false
draft: false
---

[지난 글](/posts/websec-input-validation-output-encoding/)에서 입력 검증과 출력 인코딩을 살펴봤다. 이번 글은 파일 업로드 기능이 만들어내는 보안 취약점과 방어 전략을 다룬다. 파일 업로드는 잘못 구현하면 원격 코드 실행(RCE)으로 이어지는 고위험 기능이다.

![파일 업로드 공격 벡터와 방어](/assets/posts/websec-file-upload-security-threats.svg)

## 공격 유형

**웹쉘 업로드**: `shell.php`를 업로드한 뒤 직접 URL로 접근해 서버 명령을 실행한다. 파일이 웹 서버 루트에 저장되고 PHP/JSP 등이 실행 가능하면 즉시 RCE가 된다.

**MIME 타입 위조**: HTTP 요청의 `Content-Type: image/jpeg`는 조작 가능하다. 확장자가 `.php`인 파일을 `image/jpeg`로 전송해 검증을 우회한다.

**악성 이미지 페이로드**: 정상 JPEG 파일에 PHP 코드를 포함시킨다(`exiftool`로 메타데이터에 주입). 일부 서버 설정에서 `image.jpg.php` 같은 이중 확장자로 실행된다.

**경로 탈출**: 파일명에 `../../../etc/cron.d/hack`을 포함시켜 시스템 파일을 덮어쓴다.

**악성 SVG/PDF**: SVG에 `<script>` 태그, PDF에 JavaScript 임베딩이 가능하다.

## 검증 레이어

![파일 업로드 보안 검증 코드](/assets/posts/websec-file-upload-security-validation.svg)

### 1. 매직 바이트 검사

Content-Type 헤더는 신뢰할 수 없다. 파일 내용 자체의 매직 바이트(파일 시그니처)로 실제 형식을 판별한다.

```python
import magic
import io
from PIL import Image

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
MAX_SIZE = 10 * 1024 * 1024  # 10MB

def validate_file(data: bytes) -> str:
    if len(data) > MAX_SIZE:
        raise ValueError("File too large")

    # 매직 바이트로 실제 MIME 타입 감지
    mime = magic.from_buffer(data, mime=True)
    if mime not in ALLOWED_MIME:
        raise ValueError(f"Unsupported file type: {mime}")

    return mime

# JPEG 매직 바이트: FF D8 FF
# PNG:  89 50 4E 47 0D 0A 1A 0A
# PDF:  25 50 44 46 2D
```

### 2. 이미지 재인코딩으로 페이로드 제거

```python
def sanitize_image(data: bytes, mime: str) -> bytes:
    img = Image.open(io.BytesIO(data))

    # EXIF 메타데이터 제거 및 재인코딩
    # 악성 페이로드가 있어도 픽셀 데이터만 남음
    output = io.BytesIO()
    fmt = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}[mime]
    img.save(output, format=fmt, exif=b"")  # EXIF 제거

    return output.getvalue()
```

### 3. 파일명 UUID 재생성 + 확장자 고정

```python
import uuid

EXT_MAP = {
    "image/jpeg": ".jpg",
    "image/png":  ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
}

def generate_safe_filename(mime: str) -> str:
    ext = EXT_MAP[mime]
    return f"{uuid.uuid4()}{ext}"

# 원본 파일명은 DB에만 저장 (표시용)
# 실제 저장 파일명은 UUID 기반
```

## S3 격리 스토리지

```python
import boto3

s3 = boto3.client("s3", region_name="ap-northeast-2")
UPLOAD_BUCKET = "my-uploads-bucket"

async def upload_file(data: bytes, original_name: str) -> str:
    mime = validate_file(data)

    # 이미지면 재인코딩
    if mime.startswith("image/"):
        data = sanitize_image(data, mime)

    safe_name = generate_safe_filename(mime)

    s3.put_object(
        Bucket=UPLOAD_BUCKET,
        Key=f"uploads/{safe_name}",
        Body=data,
        ContentType=mime,
        # 브라우저에서 직접 실행 방지 (다운로드 강제)
        ContentDisposition="attachment; filename=file",
        # 퍼블릭 읽기 차단 (Presigned URL로만 서빙)
        ACL="private",
        # 서버 측 암호화
        ServerSideEncryption="aws:kms",
    )

    # DB에는 UUID 파일명만 저장
    return safe_name
```

## Nginx에서 실행 차단

```nginx
# 업로드 디렉토리에서 PHP 실행 차단
location /uploads/ {
    # PHP 실행 완전 차단
    location ~ \.php$ {
        return 403;
    }

    # 기본: attachment으로 다운로드 강제
    add_header Content-Disposition "attachment";
    add_header X-Content-Type-Options "nosniff";

    # 허용 MIME 타입만 서빙
    types {
        image/jpeg  jpg;
        image/png   png;
        application/pdf pdf;
    }
    default_type application/octet-stream;
}
```

## SVG 파일 특수 처리

SVG는 XML이므로 `<script>` 태그, `onload` 이벤트를 포함할 수 있다. 브라우저에서 직접 렌더링하면 XSS가 된다.

```python
import defusedxml.ElementTree as ET

def sanitize_svg(svg_data: bytes) -> bytes:
    tree = ET.fromstring(svg_data)

    # 위험 요소 제거
    dangerous_tags = {
        "{http://www.w3.org/2000/svg}script",
        "{http://www.w3.org/2000/svg}use",
    }
    dangerous_attrs = {"onclick", "onload", "onerror", "onmouseover"}

    for elem in tree.iter():
        if elem.tag in dangerous_tags:
            elem.getparent().remove(elem)
        for attr in list(elem.attrib):
            if attr.lower() in dangerous_attrs:
                del elem.attrib[attr]

    return ET.tostring(tree)

# 또는 SVG를 PNG로 변환 (cairosvg)
import cairosvg
png_data = cairosvg.svg2png(bytestring=svg_data)
```

## 체크리스트

```markdown
# 파일 업로드 보안 체크리스트
- [ ] Content-Type 헤더 신뢰 금지 — magic 라이브러리로 매직 바이트 검사
- [ ] 확장자 Allowlist: jpg, png, pdf 등 명시적으로 허용
- [ ] 업로드 파일 크기 제한 (nginx client_max_body_size)
- [ ] 파일명 UUID 재생성 (원본 파일명은 DB에만)
- [ ] 업로드 경로를 웹 루트 밖에 배치 or S3 격리 버킷
- [ ] 이미지: Pillow로 재인코딩 (EXIF/페이로드 제거)
- [ ] SVG: 스크립트 제거 후 PNG 변환
- [ ] Content-Disposition: attachment 강제
- [ ] X-Content-Type-Options: nosniff 헤더
- [ ] 안티바이러스 스캔 (ClamAV) 통합 (선택)
```

---

**지난 글:** [입력 검증과 출력 인코딩: 인젝션 공격의 근본 방어](/posts/websec-input-validation-output-encoding/)

<br>
읽어주셔서 감사합니다. 😊
