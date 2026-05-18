---
title: "[Nexacro N] 데이터 암호화"
description: "Nexacro N 애플리케이션에서 민감 데이터를 보호하는 암호화 전략을 설명합니다. TLS 전송 암호화, AES 필드 레벨 암호화, addServiceHeader를 활용한 키 전달, 마스킹 표시 구현 방법을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-18"
archiveOrder: 2
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "암호화", "AES", "TLS", "CryptoJS", "보안", "마스킹"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-csrf/)에서 CSRF 방어를 살펴보았다. 이번에는 Nexacro N 애플리케이션에서 민감 데이터를 보호하는 암호화 전략을 다룬다. 주민번호, 카드번호, 계좌번호 같은 개인정보는 화면 표시, 전송, 저장 각 단계에서 별도의 보호가 필요하다.

## 암호화 레이어 구조

Nexacro N 보안 설계에서 암호화는 네 레이어로 나뉜다. 클라이언트가 직접 처리하는 부분과 서버가 처리하는 부분을 명확히 구분해야 한다.

![데이터 암호화 레이어](/assets/posts/nexacro-n-data-encryption-layers.svg)

- **Layer 1 (TLS/HTTPS)**: 가장 기본. 서비스 URL을 `https://`로 고정하고 HTTP 리다이렉트를 서버에서 강제한다
- **Layer 2 (필드 레벨 암호화)**: 특정 민감 필드를 클라이언트에서 암호화한 뒤 서버로 전송
- **Layer 3 (DB 컬럼 암호화)**: 서버 영역. 애플리케이션 또는 DB 레벨 암호화
- **Layer 4 (UI 마스킹)**: 화면에서 일부만 표시 — 암호화가 아닌 표시 제한

## TLS 설정 확인

Nexacro N 앱에서 서비스 URL이 HTTP로 지정되면 전송 구간 암호화가 무력화된다. `TypeDefinition.xadl`의 서비스 URL을 반드시 HTTPS로 설정한다.

```xml
<!-- TypeDefinition.xadl -->
<TypeDefinition>
  <Environments>
    <Environment id="SERVICE_URL" value="https://api.example.com/service/"/>
    <!-- http:// 사용 금지 -->
  </Environments>
</TypeDefinition>
```

서버(Spring)에서는 HTTP 접근을 HTTPS로 강제 리다이렉트한다.

```java
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http.requiresChannel(channel ->
        channel.anyRequest().requiresSecure()
    );
    return http.build();
}
```

## 필드 레벨 AES 암호화

TLS가 전송 전체를 암호화하더라도, 로그 기록·프록시 서버·중간 시스템에서 평문이 노출될 수 있다. 민감 필드는 클라이언트에서 직접 암호화해 전송한다.

### CryptoJS 라이브러리 포함

Nexacro N 프로젝트의 공통 스크립트 경로에 CryptoJS를 추가한다.

```xml
<!-- TypeDefinition.xadl -->
<Script id="cryptojs" src="CommonLib/crypto-js.min.js"/>
```

### AES 암호화 함수

```javascript
// CommonLib/Security.xjs
function gfn_aesEncrypt(sPlain, sKey, sIv) {
  var key = CryptoJS.enc.Utf8.parse(sKey);
  var iv  = CryptoJS.enc.Utf8.parse(sIv);
  var enc = CryptoJS.AES.encrypt(sPlain, key, {
    iv        : iv,
    mode      : CryptoJS.mode.CBC,
    padding   : CryptoJS.pad.Pkcs7
  });
  return enc.toString(); // Base64 인코딩 결과
}

function gfn_aesDecrypt(sCipher, sKey, sIv) {
  var key = CryptoJS.enc.Utf8.parse(sKey);
  var iv  = CryptoJS.enc.Utf8.parse(sIv);
  var dec = CryptoJS.AES.decrypt(sCipher, key, {
    iv      : iv,
    mode    : CryptoJS.mode.CBC,
    padding : CryptoJS.pad.Pkcs7
  });
  return dec.toString(CryptoJS.enc.Utf8);
}
```

![AES 암호화 처리 흐름](/assets/posts/nexacro-n-data-encryption-aes.svg)

### 암호화 키 관리

암호화 키를 클라이언트 소스에 하드코딩하면 안 된다. 다음 두 가지 접근을 권장한다.

**방식 A: 세션별 키 교환 (권장)**

로그인 후 서버에서 세션 고유 키를 발급받아 메모리 변수에 저장한다.

```javascript
// BaseForm.xfdl — 로그인 성공 후
function fn_loginCallback(sId, nErrCode, sErrMsg) {
  if (nErrCode == 0) {
    gv_encKey = this.ds_session.getColumn(0, "ENC_KEY");
    gv_encIv  = this.ds_session.getColumn(0, "ENC_IV");
  }
}
```

**방식 B: 서버 공개키 기반 RSA 래핑**

AES 키 자체를 서버 RSA 공개키로 암호화해 전송하고, 서버가 개인키로 AES 키를 복호화한다. 전송 키가 매번 달라지는 장점이 있다.

### 데이터 전송 시 암호화 적용

```javascript
function fn_save() {
  // 민감 필드 암호화 후 Dataset에 설정
  var sPlain  = this.edt_ssn.value; // 주민번호 평문
  var sCipher = gfn_aesEncrypt(sPlain, gv_encKey, gv_encIv);
  this.ds_input.setColumn(0, "SSN_ENC", sCipher);
  this.ds_input.setColumn(0, "SSN",     ""); // 평문 비움

  this.transaction(
    "savePersonal",
    "svc://PersonalService/save",
    "ds_input=ds_input",
    "ds_output=ds_output",
    "",
    "fn_saveCallback"
  );
}
```

## UI 마스킹 처리

암호화와 별개로, 화면에서 민감 정보를 일부만 보여주는 마스킹은 UX와 보안 모두를 위한 처리다.

### MaskEdit 컴포넌트 활용

```xml
<!-- 주민번호 마스킹 입력 -->
<MaskEdit id="edt_ssn"
          mask="999999-9999999"
          maskChar="*"
          displayMask="999999-*******"/>
```

### 동적 마스킹 함수

서버에서 받은 값을 화면에 표시할 때 마스킹을 적용한다.

```javascript
function gfn_maskSsn(sSsn) {
  if (!sSsn || sSsn.length < 7) return sSsn;
  return sSsn.substring(0, 6) + "-*******";
}

function fn_searchCallback(sId, nErrCode, sErrMsg) {
  if (nErrCode == 0) {
    var rawSsn = this.ds_result.getColumn(0, "SSN_MASKED");
    this.edt_ssn.value = rawSsn; // 서버가 이미 마스킹해서 반환
  }
}
```

서버에서 마스킹 값을 반환하는 방식이 더 안전하다. 클라이언트가 전체 값을 받아 마스킹하면 개발자 도구로 원본이 노출될 수 있다.

## 개인정보 취급 체크리스트

| 항목 | 조치 |
|------|------|
| 전송 구간 | HTTPS 강제, HSTS 설정 |
| 민감 필드 | AES-256 암호화 전송 |
| 암호화 키 | 서버 발급, 소스 하드코딩 금지 |
| 화면 표시 | 서버 마스킹 후 반환 |
| 로그 | 암호화 필드 로그 마스킹 |
| DB 저장 | 컬럼 암호화 또는 토크나이제이션 |
| 콘솔 출력 | 배포 빌드에서 trace 비활성화 |

Nexacro N 자체는 암호화 기능을 내장하지 않으므로, CryptoJS 같은 표준 라이브러리를 공통 스크립트에 포함시켜 프로젝트 전체에 일관된 암호화 계층을 구성해야 한다.

---

**지난 글:** [CSRF 방어](/posts/nexacro-n-csrf/)

**다음 글:** [다국어(i18n) 개요](/posts/nexacro-n-i18n/)

<br>
읽어주셔서 감사합니다. 😊
