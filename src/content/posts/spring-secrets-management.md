---
title: "Spring Boot 시크릿 관리: 환경변수부터 AWS Secrets Manager와 Vault까지"
description: "Spring Boot 애플리케이션에서 DB 비밀번호, API 키 등 민감 정보를 안전하게 관리하는 방법을 단계별로 설명합니다. 환경변수, AWS Secrets Manager, Spring Cloud Vault를 실전 코드와 함께 다룹니다."
author: "PALDYN Team"
pubDate: "2026-06-01"
archiveOrder: 3
type: "knowledge"
category: "Spring"
tags: ["Spring Boot", "시크릿관리", "AWS Secrets Manager", "Vault", "보안", "환경변수"]
featured: false
draft: false
---

[지난 글](/posts/spring-cicd-pipeline/)에서 GitHub Actions 기반 CI/CD 파이프라인을 구성하는 방법을 살펴봤다. 파이프라인이 자동으로 배포를 수행하려면 DB 비밀번호, API 키, JWT 시크릿 같은 민감 정보를 안전하게 다뤄야 한다. 이번 글에서는 단순 환경변수부터 전용 시크릿 관리 서비스까지, 환경에 맞는 방법을 선택하는 기준과 실전 구현을 다룬다.

## 하드코딩은 절대 안 된다

가장 흔한 실수는 `application.yml`이나 코드에 비밀번호를 직접 쓰는 것이다.

```yaml
# 절대 금지
spring:
  datasource:
    password: my-secret-password-123  # Git 히스토리에 영구 노출
```

Git에 한번 커밋하면 나중에 파일에서 지워도 `git log`로 복원할 수 있다. 시크릿이 노출됐다면 즉시 변경하는 것이 유일한 대처법이다.

## 환경변수: 최소한의 기본

12-Factor App 방법론에서는 설정과 코드를 분리하기 위해 환경변수를 사용한다. Spring Boot는 `${VAR_NAME}` 표기로 환경변수를 바로 참조한다.

```yaml
# application.yml
spring:
  datasource:
    url: ${DB_URL}
    username: ${DB_USER}
    password: ${DB_PASS}
  # 개발 환경용 기본값 제공
  # url: ${DB_URL:jdbc:h2:mem:dev}
```

콜론 뒤는 기본값이다. `DB_URL`이 설정돼 있지 않으면 `jdbc:h2:mem:dev`를 사용한다.

Docker에서는 `-e` 옵션이나 `--env-file`로 환경변수를 주입한다.

```bash
docker run \
  -e DB_URL=jdbc:postgresql://db:5432/mydb \
  -e DB_USER=appuser \
  -e DB_PASS=secret \
  myapp:latest

# 또는 .env 파일 사용 (Git 제외)
docker run --env-file .env myapp:latest
```

`.env` 파일은 반드시 `.gitignore`에 추가한다.

![시크릿 관리 방식 비교](/assets/posts/spring-secrets-management-flow.svg)

## AWS Secrets Manager: 클라우드 프로덕션 표준

환경변수는 편리하지만 로테이션(주기적 변경)이 번거롭고 감사 로그가 없다. AWS에서 운영한다면 Secrets Manager를 사용하는 것이 현재 표준이다.

### 의존성 추가

```groovy
// build.gradle
dependencies {
    implementation 'io.awspring.cloud:spring-cloud-aws-secrets-manager:3.1.1'
}
```

### 설정

```yaml
# application.yml
spring:
  config:
    import: "aws-secretsmanager:/prod/myapp"

# /prod/myapp 에 저장된 JSON이 Spring 프로퍼티로 자동 매핑
# {"db.url": "jdbc:postgresql://...", "db.password": "..."}
```

AWS Secrets Manager에서 `/prod/myapp` 경로로 JSON 시크릿을 생성하면, 애플리케이션 기동 시 자동으로 불러와 `spring.datasource.url` 등의 프로퍼티로 바인딩된다.

### IAM 권한 (최소 권한 원칙)

ECS Task Role에 다음 권한만 부여한다. 특정 시크릿 ARN만 허용하는 것이 중요하다.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "secretsmanager:GetSecretValue",
      "secretsmanager:DescribeSecret"
    ],
    "Resource": "arn:aws:secretsmanager:ap-northeast-2:123456789:secret:prod/myapp-*"
  }]
}
```

## HashiCorp Vault: 온프레미스·멀티클라우드 선택

AWS에 종속되지 않거나 온프레미스 환경이라면 HashiCorp Vault가 강력한 대안이다. 동적 시크릿(요청할 때마다 임시 DB 계정 생성·TTL 만료 후 자동 삭제)이 Vault의 핵심 강점이다.

![HashiCorp Vault 통합 흐름](/assets/posts/spring-secrets-management-vault.svg)

### Spring Cloud Vault 설정

```groovy
implementation 'org.springframework.cloud:spring-cloud-starter-vault-config'
```

```yaml
# bootstrap.yml
spring:
  cloud:
    vault:
      host: vault.internal
      port: 8200
      scheme: https
      authentication: APPROLE
      app-role:
        role-id: ${VAULT_ROLE_ID}
        secret-id: ${VAULT_SECRET_ID}
      kv:
        enabled: true
        backend: secret
        default-context: myapp
```

### 재시작 없이 시크릿 갱신

Vault의 동적 시크릿이나 AWS Secrets Manager의 로테이션 후 재시작 없이 새 값을 적용하고 싶다면 `@RefreshScope`와 Actuator를 조합한다.

```java
@RefreshScope
@Component
public class ExternalApiClient {

    @Value("${api.key}")
    private String apiKey;

    public String call(String endpoint) {
        return restClient.get()
            .uri(endpoint)
            .header("X-API-Key", apiKey)
            .retrieve()
            .body(String.class);
    }
}
```

`POST /actuator/refresh`를 호출하면 `@RefreshScope` 빈만 재생성하면서 새 프로퍼티 값을 반영한다. 애플리케이션 재시작이 필요 없다.

## 로컬 개발: Spring Boot 테스트 프로퍼티 파일

로컬에서는 실제 Secrets Manager에 접근하기 어려울 수 있다. `application-local.yml`을 Git 제외 파일로 관리하는 것이 깔끔하다.

```yaml
# application-local.yml (gitignore에 추가)
spring:
  datasource:
    url: jdbc:h2:mem:testdb
    username: sa
    password:
  config:
    import: ""    # Secrets Manager import 비활성화
```

```bash
# 로컬 실행 시 프로파일 지정
./gradlew bootRun --args='--spring.profiles.active=local'
```

`spring.config.import`를 빈 문자열로 덮어쓰면 Secrets Manager 연결을 시도하지 않는다.

## 시크릿 관리 방식 비교

| 방식 | 로테이션 | 감사 로그 | 복잡도 | 적합한 환경 |
|---|---|---|---|---|
| 환경변수 | 수동 | 없음 | 낮음 | 소규모·개발 |
| AWS Secrets Manager | 자동 | CloudTrail | 중간 | AWS 프로덕션 |
| HashiCorp Vault | 동적 생성 | 상세 | 높음 | 멀티클라우드·온프레미스 |
| Kubernetes Secrets | 수동 | 제한적 | 중간 | K8s 환경 |

환경 규모와 컴플라이언스 요건에 따라 선택한다. AWS에서 운영한다면 Secrets Manager가, 복잡한 인프라나 감사 요건이 엄격한 환경에서는 Vault가 적합하다.

---

**지난 글:** [Spring Boot CI/CD 파이프라인](/posts/spring-cicd-pipeline/)

**다음 글:** [Spring Cloud: 모놀리스에서 마이크로서비스로](/posts/spring-cloud-monolith-vs-msa/)

<br>
읽어주셔서 감사합니다. 😊
