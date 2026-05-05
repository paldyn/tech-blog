---
title: "PROJECT_CODE 한 컬럼의 무게 — 멀티테넌시 도입기"
description: "단일 프로젝트 모델로 운영하던 백엔드 4개 + 프론트 1개에 멀티 프로젝트 격리를 도입한 회고. 한 컬럼이 마이그레이션, MyBatis XML, Hibernate @Filter, composite PK, JWT claim, frontend 인터셉터까지 어떻게 번지는지."
author: "PALDYN Team"
pubDate: "2026-05-01"
archiveOrder: 1
type: "record"
category: "Backend"
tags: ["multi-tenancy", "spring-boot", "mybatis", "hibernate", "jwt", "migration"]
featured: false
draft: false
---

처음에는 컬럼 하나 추가하면 끝나는 일이라 생각했다. `ALTER TABLE ... ADD
COLUMN project_code` 한 줄이면 데이터를 가를 수 있다고. 결과적으로 그
한 줄은 백엔드 4개와 프론트엔드 1개, 그리고 운영 환경의 마이그레이션
순서와 JWT 토큰 형식까지 손보게 만들었다.

---

## 상황 / 배경

- self-hosted 형태로 배포되는 한 백엔드 시스템. 한 서버 안에 도메인이
  다른 모듈 (가칭 도메인 A / B / C) 이 함께 동작
- 백엔드는 4개 Spring Boot 서비스로 분리 — **인증 / 도메인 A / B / C
  서비스**. 각각 별도 PostgreSQL DB
- 프론트엔드는 React + Electron 1개
- 인증 서비스에 프로젝트 카탈로그 테이블이 초기 마이그레이션부터 있었지만,
  실제로는 부트스트랩 1 row 만 들어 있는 채로 코드에서 거의 안 썼다.
  사실상 **"한 서버 = 한 프로젝트"** 모델

요구사항 자체는 명확했다. **한 사용자가 두 개 이상의 프로젝트를 같은
시스템에서 따로따로 관리할 수 있어야 한다**. 사용자별로 어떤 프로젝트를
볼 수 있는지 admin 이 통제할 수 있어야 한다.

---

## 무엇이 문제였나

먼저 현재 상태부터 정리했다.

```text
인증 서비스
  - 프로젝트 카탈로그 (1 row only, 부트스트랩)
  - 사용자-프로젝트 매핑 (테이블만 존재, 코드에서 미사용)
  - role: USER / ADMIN / SUPER_ADMIN — 단순 3단

도메인 A 서비스 (MyBatis)
  - 도메인 테이블 6개
  - MyBatis XML mapper 4개 (PG 2 + SQLite mirror 2)
  - 약 38개 쿼리

도메인 B 서비스 (JPA)
  - 도메인 테이블 9개 (작업 단위 / 다이어그램 / 객체 / 속성 / 관계 ...)
  - JPA + Spring Data JPA repository

도메인 C 서비스 (JPA)
  - 도메인 테이블 2개 (사용자별 상태)
  - JPA, PK 가 user_id 단독
```

3 + 1 + 2 가지 다른 패턴 (MyBatis / JPA / composite PK 후보) 이 한 시스템
안에 같이 살고 있다.

처음에 자연스럽게 떠오른 첫 옵션은 **단순한 admin UI 만 정교화** 하는 것
이었다. 사용자별 active/disable 강화, role 관리 UI 정도. 하지만 그건
멀티 프로젝트 모델을 도입하지 않는 안이고 — 결국 다음 분기에 또 같은
이야기가 나올 수밖에 없다.

진짜 옵션 비교는 이렇게 정리됐다.

```
A. 단일 프로젝트 + 사용자 active/disable 강화
   → 멀티 프로젝트 안 함. 1 PR 분량.
   → 멀티 운영 시작하면 되돌리기 힘듦.

B. 멀티 프로젝트 + 진짜 데이터 격리
   → 모든 도메인 테이블에 project_code, 모든 쿼리에 WHERE.
   → 백엔드 4개 + frontend, 며칠 분량.

C. 멀티 프로젝트 "메뉴 그룹" 만 (격리 없음)
   → 사용자 메뉴는 필터되지만 데이터는 공용.
   → 보안 약함. motivated attacker 가 헤더 위조 시 우회 가능.
```

A 는 보수적, C 는 위험. **B 를 골랐다**. 그리고 그 결정이 한 줄이 아니라
세 단계 (Phase) 의 작업이 필요하다는 사실을 받아들이는 데서 진짜
설계가 시작됐다.

---

## 어떻게 해결했나

### 단계 분할

한 PR 로는 못 끝낸다. 단계별로 나눠 머지해야 한다.

![멀티테넌시 도입 — 3단계 Phase 로드맵](/assets/posts/multi-tenant-phase-roadmap.svg)

```
Phase 1 — 인증 서비스 만:
  · 프로젝트 CRUD + 멤버 grant API
  · /auth/projects 가 사용자가 grant 받은 활성 프로젝트만 반환
  · admin UI 에 "프로젝트 관리" 탭

Phase 2 — 백엔드 데이터 격리:
  2.1 인증 서비스의 JWT 에 grants claim 추가
  2.2 도메인 A 격리 (MyBatis)
  2.3 도메인 B 격리 (Hibernate)
  2.4 도메인 C 격리 (composite PK)

Phase 3 — frontend:
  · axios 인터셉터가 X-Tenant-Project 헤더 자동 첨부
  · 사이드바의 프로젝트 스위처 드롭다운
```

각 단계는 독립적으로 배포 가능해야 한다. Phase 2 가 운영에 들어가도
Phase 3 (프론트) 가 미배포면 헤더 없이 호출이 오는데, 이때
**default project code fallback** 으로 단일 프로젝트 환경에서는 이전과
완전히 동일하게 작동하도록 만들었다. 이게 backward compat 의 핵심
설계.

### Phase 1 — 인증 모델에서 grants 활성화

초기 스키마부터 만들어 두고 안 쓰던 사용자-프로젝트 매핑 테이블을
본격 활용했다. 현재 `BaseEntity` 호환을 위해 audit 컬럼을 새 마이그레이션
으로 추가하고, 기존 ACTIVE 사용자 → 활성 프로젝트 전체에 자동 grant
백필 했다. 단일 프로젝트 운영 중이던 곳은 이 backfill 후에도 변화 0.

권한 레이아웃은 단순하게:

- **SUPER_ADMIN** — 프로젝트 라이프사이클 (생성/수정/비활성화) 독점.
  멤버 grant 도 무관하게 모든 프로젝트 접근.
- **ADMIN** — 본인이 멤버인 프로젝트 안에서 다른 사용자 grant 가능.
  프로젝트 생성/삭제는 ✗.
- **/auth/projects** 호출 시 SUPER_ADMIN 은 모든 활성 프로젝트, 일반
  사용자는 본인이 grant 받은 활성 프로젝트만 응답.

서비스 레이어에서 핵심은 마지막 활성 프로젝트 보호:

```java
private boolean isLastEnabledProject(ProjectEntity project) {
    if (!project.isEnabled()) return false;
    long enabledCount = projectRepository.findAllByEnabledTrueOrderByIdAsc().size();
    return enabledCount <= 1;
}
```

운영자가 실수로 마지막 프로젝트를 비활성화해 자기 자신을 시스템 밖으로
가두는 일을 막는다.

### Phase 2.1 — JWT 에 grants claim

다른 백엔드 서비스들이 매 요청마다 인증 서비스에 다시 물어보는 건
latency × 2 라 비효율. 대신 access token 발급 시 사용자의 grants 를
JWT 에 박아 보낸다.

```java
JwtClaimsSet claims = JwtClaimsSet.builder()
    ...
    .claim("roles", roles)
    .claim("projects", grants.codes())                  // List<String>
    .claim("project_access", grants.access())           // Map<code, READ|WRITE>
    .build();
```

trade-off 가 명확하다. **grant 변경이 access token TTL (기본 15분) 만큼
지연 반영**된다. 즉시 회수가 필요하면 시스템 설정에서 TTL 줄이거나
사용자 강제 로그아웃 (refresh token revoke).

각 백엔드 서비스의 `JwtClaimAuthenticationConverter` 가 이 두 claim 을
읽어 `PROJECT_<code>` / `PROJECT_<code>_<level>` Spring Security
authority 로 변환한다.

### Phase 2.2 — MyBatis 의 정직한 작업 (도메인 A)

JPA 의 `@Filter` 같은 자동 격리가 없다. **38개 쿼리를 일일이 수정**한다.
모든 SELECT 의 WHERE 절에 `AND PROJECT_CODE = #{PROJECT_CODE}`, 모든
INSERT 의 컬럼/values 에 `PROJECT_CODE`, JOIN 의 ON 절에도 양쪽
PROJECT_CODE 일치 조건. 빠뜨리면 곧바로 데이터 누수.

```xml
<select id="findByName" resultType="...DomainObject">
    SELECT ...
      FROM TABLE_A A
      LEFT JOIN TABLE_B B
        ON B.PROJECT_CODE = A.PROJECT_CODE   <!-- JOIN 도 격리 -->
       AND A.TYPE_CD = B.CD_ID
     WHERE A.PROJECT_CODE = #{PROJECT_CODE}
       <if test="NM != null and NM != ''">
            AND A.NAME LIKE '%' || #{NM} || '%'
       </if>
     ORDER BY A.NAME
</select>
```

`ProjectContextHolder` (ThreadLocal) 가 요청 단위 project_code 를 보관
한다. `ProjectAuthorizationFilter` 가 X-Tenant-Project 헤더에서 코드를
추출하고, JWT 의 `PROJECT_<code>` authority 와 매칭 — SUPER_ADMIN 또는
grant 보유자만 통과한 후 set, 응답 종료 시 clear. 서비스 레이어가
`ProjectContextHolder.get()` 으로 가져와 mapper 에 인자로 전달한다.

### Phase 2.3 — Hibernate 의 선언적 격리 (도메인 B)

JPA 기반이라 똑같이 명시적으로 가면 9개 entity × 수십 개 repository
메서드를 다 손봐야 한다. 대신 **Hibernate `@Filter`** 한 번에:

```java
@MappedSuperclass
@FilterDef(name = "projectFilter",
           parameters = @ParamDef(name = "projectCode", type = String.class))
@Filter(name = "projectFilter", condition = "project_code = :projectCode")
@EntityListeners(ProjectCodeAutoFill.class)
public abstract class BaseAuditEntity {
    @Column(name = "project_code", nullable = false, length = 100)
    private String projectCode;
    ...
}
```

`BaseAuditEntity` 를 상속하는 entity 는 자동 적용. 안 쓰는 entity 들에는
직접 `@Filter` 어노테이션을 걸었다.

요청 단위로 filter 를 활성화하는 건 service AOP 로 처리:

```java
@Aspect @Component
public class ProjectFilterAspect {
    @PersistenceContext private EntityManager entityManager;

    @Before("execution(* com.example..service..*(..))")
    public void enableProjectFilter(JoinPoint jp) {
        String code = ProjectContextHolder.getOrNull();
        if (code == null) return;
        Session session = entityManager.unwrap(Session.class);
        if (session.getEnabledFilter("projectFilter") == null) {
            session.enableFilter("projectFilter").setParameter("projectCode", code);
        }
    }
}
```

INSERT 시점은 `ProjectCodeAutoFill` listener 가 `@PrePersist` 에서
projectCode 자동 충전. service 가 깜빡 잊어도 안전망.

### Phase 2.4 — composite PK 라는 구조 변경 (도메인 C)

다른 두 서비스와 다르게 이 서비스의 두 테이블은 **PK 자체가 user_id
단독**. 멀티 프로젝트 운영 시 같은 사용자가 두 프로젝트에서 별도 상태
를 가져야 하니 PK 를 `(project_code, user_id)` 로 확장해야 한다.

```sql
ALTER TABLE user_state ADD COLUMN project_code ...;
ALTER TABLE user_state DROP CONSTRAINT user_state_pkey;
ALTER TABLE user_state ADD PRIMARY KEY (project_code, user_id);
```

JPA 에선 `@IdClass(UserProjectKey.class)` 로 표현. repository 의
ID 타입도 String → UserProjectKey 로 바뀌고, service 에서
`repository.findById(new UserProjectKey(currentProject, userId))` 패턴으로 호출.

```
4 서비스 × 4가지 격리 패턴
─────────────────────────
인증 서비스       → JWT claim (grant 정보 자체)
도메인 A          → MyBatis 명시 (38 쿼리 손작업)
도메인 B          → Hibernate @Filter (선언, AOP 자동 활성화)
도메인 C          → composite PK 구조 변경
```

같은 문제 — 데이터 격리 — 에 4가지 답이 있다. 어느 쪽도 만능 아니고,
원래 시스템의 모양이 답을 정한다.

![같은 격리 문제, 4가지 답 — MyBatis / Hibernate @Filter / composite PK / JWT claim](/assets/posts/multi-tenant-isolation-patterns.svg)

### Phase 3 — frontend

axios 인터셉터에 한 줄.

```js
const projectHeader = () => {
  const code = uds.getState().projectCode;
  return code ? { "X-Tenant-Project": code } : {};
};

// 3개 axios 인스턴스의 request interceptor 에서
Object.assign(config.headers, projectHeader());
```

`projectCode` 미설정 시 헤더 안 보냄 → 백엔드 default fallback. 사이드바
상단에 `ProjectSwitcher` 드롭다운을 넣어 본인이 grant 받은 프로젝트만
목록에 보여주고, 선택 시 store 갱신 + 페이지 reload (진행 중인 데이터
캐시 한 번에 무효화).

---

## 결과

| 항목 | 이전 | 이후 |
|---|---|---|
| 데이터 격리 단위 | 한 서버 = 한 프로젝트 | 한 서버 = N 프로젝트 |
| 사용자-프로젝트 매핑 활용 | 미사용 (테이블만 존재) | 본격 사용 |
| 도메인 테이블의 project_code | 없음 | 17개 테이블 모두 |
| MyBatis 쿼리 격리 | - | 38 쿼리 |
| Hibernate @Filter 적용 entity | - | 9개 |
| 새 통합 테스트 (격리 시나리오) | - | 4개 서비스 합쳐 24 개 |
| 단일 프로젝트 운영 환경 영향 | - | **변화 없음** (default fallback) |

**검증** — 4개 서비스 띄우고 단일 프로젝트 운영자 입장에서 평소처럼
사용. 헤더 없이 모든 호출이 default 코드로 자동 처리. 신규 INSERT 도
default 프로젝트로 들어감. 기존 사용자 입장에서 변화 없음.

curl 로 멀티 프로젝트 시나리오:

```bash
# alpha 프로젝트로 객체 추가
curl -X POST -H "X-Tenant-Project: alpha" ... /api/v1/...

# 다른 프로젝트 헤더로 검색 → alpha 데이터 안 보임
curl -H "X-Tenant-Project: bootstrap" ... /api/v1/...
# 빈 배열

# grant 없는 프로젝트 → 403
curl -H "X-Tenant-Project: nonexistent" ...
# {"code":"PROJECT_403","message":"이 프로젝트에 접근 권한이 없습니다."}
```

---

## 운영 검증에서 발견된 갭들

도입 검증을 지나가면서 세 가지 작은 사고 / 갭이 드러났다. 본 작업 자체
가 깨진 건 아니지만, "테스트는 다 통과했는데 운영에선 막히는" 종류의
문제들.

1. **CORS preflight 의 allowedHeaders 누락**
   ```
   Request header field x-tenant-project is not allowed by
   Access-Control-Allow-Headers in preflight response
   ```
   4개 서비스 모두 SecurityConfig 의 CorsConfiguration 에 새 헤더
   추가 누락. 통합 테스트는 CORS 검사 안 하고 통과.

2. **마이그레이션의 부분 적용**
   첫 시도가 어딘가에서 실패한 후 재실행 시 `column "project_code" of
   relation "..." already exists` 에러로 무한 실패. 다수의 ALTER 중
   일부가 commit 된 채 멈춘 상태였다. 모든 ALTER 에 `IF NOT EXISTS`
   추가해 idempotent 하게 만들어 해결. (이 사건은 별도 글로 정리)

3. **stale JWT 의 자동 logout 누락**
   기존 마이그레이션이 모든 refresh token 을 revoke 한 시점 + JWT
   claim 변경 후, 옛 세션을 가진 사용자가 백엔드 호출 시 401 만 받고
   자동 로그인 페이지 이동이 안 됐다. `resetAuthState` 가 zustand store
   reset 만 하고 sessionStorage 키 명시 삭제 안 하던 것 + axios
   interceptor 의 retry 후 다시 401 시 redirect 누락 두 군데 fix.

세 갭 모두 통합 테스트가 잡지 못하는 영역이었고, 손으로 운영 흐름을
한 번 따라가본 후에야 드러났다. 이런 검증은 사람이 한 번 해보는 것
외에는 잡을 방법이 없다.

---

## 앞으로 어떻게 할 것인가

- **Phase 별 backward compat 의 default 값** 은 다음 멀티테넌시 작업
  에서도 그대로 가져갈 패턴. 새 컬럼 / 새 헤더는 항상 "옛날 클라이언트
  가 안 보내도 동작하는" 기본값 fallback 을 가져야 단계 배포 가능.
- **JWT claim 형식 변경 시 운영 배포 가이드** 추가 — refresh token
  revoke 가 따라오면 모든 사용자가 강제 재로그인. 다음 release notes
  에 명시.
- **MyBatis 쪽 격리 검증** 은 통합 테스트로 핵심 시나리오만 덮었지만,
  운영에서 새 쿼리 추가 시 `PROJECT_CODE` 필터 누락이 발생할 수 있음.
  PR 리뷰 체크리스트에 추가하고, 향후 시간 나면 MyBatis interceptor 로
  자동 검증 도구를 도입하거나 native query scan linter 를 만드는 것도
  고려.
- **데이터 격리 enforcement 의 access_level (READ/WRITE) 분리** 는
  현재 application 레벨에서 enforcement 가 없다. SUPER_ADMIN 우회만
  검증되고, READ 권한자가 mutation 호출했을 때 백엔드가 거부하는 로직
  은 다음 todo 로 남겨둠.

---

## 회고 한 줄

> 한 컬럼을 추가하는 일이 진짜로 한 컬럼에서 끝나는 건 거의 없다.
> 테이블, 쿼리, JOIN, PK, JWT, 헤더, axios, 캐시 무효화까지 — 격리는
> 데이터 모델의 결정이 아니라 시스템의 architecture 결정이다.

<br>
읽어주셔서 감사합니다. 😊
