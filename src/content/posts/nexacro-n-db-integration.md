---
title: "[Nexacro N] DB 연동 패턴"
description: "Nexacro N 어댑터에서 데이터베이스를 연동하는 다양한 패턴을 설명합니다. MyBatis 동적 쿼리, JPA 연동, 트랜잭션 관리, 페이징 처리, 대용량 조회 최적화까지 실제 업무 패턴을 다룹니다."
author: "PALDYN Team"
pubDate: "2026-05-21"
archiveOrder: 6
type: "knowledge"
category: "Nexacro"
tags: ["nexacro", "nexacro-n", "mybatis", "jpa", "db연동", "동적쿼리", "페이징", "트랜잭션"]
featured: false
draft: false
---

[지난 글](/posts/nexacro-n-node-adapter/)에서 Node.js 어댑터로 Nexacro N과 백엔드를 연결하는 방법을 살펴보았다. 이번에는 어댑터 서비스 레이어에서 DB를 연동하는 실제 업무 패턴을 다룬다.

Nexacro N 기업 프로젝트에서 가장 많이 사용하는 DB 연동 기술은 MyBatis다. 복잡한 동적 WHERE절과 다중 조인이 많은 업무 쿼리를 XML로 관리하는 방식이 Nexacro N의 Dataset 중심 개발 방식과 잘 어울린다.

## DB 연동 기술 비교

![DB 연동 패턴 비교](/assets/posts/nexacro-n-db-integration-patterns.svg)

MyBatis가 Nexacro N 프로젝트에 적합한 가장 큰 이유는 동적 쿼리 지원이다. 검색 조건이 입력되지 않은 경우 해당 WHERE 조건을 자동으로 제외하는 `<if>`, `<where>`, `<foreach>` 태그를 통해 수백 가지 조합의 검색 로직을 하나의 XML 블록으로 처리할 수 있다.

## MyBatis 동적 쿼리 패턴

![MyBatis Mapper 동적 쿼리](/assets/posts/nexacro-n-db-integration-code.svg)

```xml
<!-- UserMapper.xml — 복수 조건 동적 검색 -->
<select id="selectUsers" parameterType="map" resultType="map">
    SELECT u.user_id
         , u.user_nm
         , u.email
         , d.dept_nm
    FROM   users u
    LEFT JOIN dept d ON d.dept_cd = u.dept_cd
    <where>
        <if test="userId != null and userId != ''">
            AND u.user_id LIKE '%' || #{userId} || '%'
        </if>
        <if test="userNm != null and userNm != ''">
            AND u.user_nm LIKE '%' || #{userNm} || '%'
        </if>
        <if test="deptCd != null and deptCd != ''">
            AND u.dept_cd = #{deptCd}
        </if>
        <if test="useYn != null">
            AND u.use_yn = #{useYn}
        </if>
    </where>
    ORDER BY u.user_id
</select>
```

`<where>` 태그는 내부에 조건이 하나도 없으면 `WHERE` 키워드 자체를 제거한다. 또한 첫 번째 조건의 `AND`를 자동으로 제거한다.

## DataSet → Map 파라미터 변환

서비스 클래스에서 입력 DataSet을 MyBatis 파라미터 Map으로 변환한다.

```java
@NexaService
@Service
public class UserService {

    @Autowired
    private UserMapper userMapper;

    public void search(DataSet dsIn, DataSet dsOut, VariableList vl)
            throws NexaServiceException {

        // DataSet 첫 행을 Map으로 변환
        Map<String, Object> param = NexacroUtils.rowToMap(dsIn, 0);
        // param.get("USER_ID") == dsIn.getStringColumn(0, "USER_ID")

        List<Map<String, Object>> list = userMapper.selectUsers(param);
        NexacroUtils.copyToDataSet(list, dsOut);
    }
}
```

`NexacroUtils.rowToMap(dsIn, rowIdx)`은 DataSet의 컬럼명을 그대로 Map 키로 사용한다. MyBatis XML에서 `#{USER_ID}` 또는 `#{userId}` (camelCase 매핑 설정 시)로 참조한다.

## Spring @Transactional 처리

저장, 수정, 삭제가 섞인 배치 저장은 트랜잭션 범위를 명확히 지정해야 한다.

```java
@Transactional
public void save(DataSet dsUser, DataSet dsResult, VariableList vl)
        throws NexaServiceException {

    for (int i = 0; i < dsUser.getRowCount(); i++) {
        int rowType = dsUser.getRowType(i);
        Map<String, Object> row = NexacroUtils.rowToMap(dsUser, i);

        switch (rowType) {
            case DataSet.ROW_TYPE_INSERTED:
                row.put("regId", vl.getStr("SESSION_USER_ID"));
                userMapper.insertUser(row);
                break;
            case DataSet.ROW_TYPE_UPDATED:
                row.put("updId", vl.getStr("SESSION_USER_ID"));
                userMapper.updateUser(row);
                break;
            case DataSet.ROW_TYPE_DELETED:
                userMapper.deleteUser(row);
                break;
        }
    }
    vl.addVariable("errCode", "0");
    vl.addVariable("errMsg", "저장 완료");
}
```

`@Transactional`이 붙어 있으면 메서드 내에서 예외가 발생할 경우 전체 롤백이 자동으로 이루어진다.

## 페이징 처리

Oracle, PostgreSQL, MySQL은 페이징 SQL 문법이 다르다. MyBatis의 `PageHelper` 플러그인을 사용하면 DB 종류에 관계없이 통일된 페이징을 적용할 수 있다.

```java
// PageHelper 사용 (Spring Boot 의존성 추가 필요)
public void search(DataSet dsIn, DataSet dsOut, VariableList vl)
        throws NexaServiceException {

    int pageNo   = dsIn.getIntColumn(0, "PAGE_NO");
    int pageSize = dsIn.getIntColumn(0, "PAGE_SIZE");

    PageHelper.startPage(pageNo, pageSize);
    Map<String, Object> param = NexacroUtils.rowToMap(dsIn, 0);
    List<Map<String, Object>> list = userMapper.selectUsers(param);
    PageInfo<Map<String, Object>> pageInfo = new PageInfo<>(list);

    NexacroUtils.copyToDataSet(list, dsOut);
    vl.addVariable("TOTAL_CNT",   String.valueOf(pageInfo.getTotal()));
    vl.addVariable("PAGE_TOTAL",  String.valueOf(pageInfo.getPages()));
    vl.addVariable("errCode", "0");
}
```

클라이언트에서는 `this.getVariable("TOTAL_CNT")`로 전체 건수를 받아 페이지 내비게이션을 구성한다.

## 대용량 조회 최적화

Dataset 결과가 수만 건이 넘는 경우 `NexacroUtils.copyToDataSet()`으로 한 번에 변환하면 메모리 부담이 커진다. `MyBatis ResultHandler`로 스트리밍 방식으로 처리한다.

```java
public void exportLarge(DataSet dsIn, DataSet dsOut, VariableList vl) {
    userMapper.selectLargeResult(
        NexacroUtils.rowToMap(dsIn, 0),
        resultContext -> {
            Map<String, Object> row = resultContext.getResultObject();
            int r = dsOut.newRow();
            dsOut.set(r, "USER_ID", row.get("user_id"));
            dsOut.set(r, "USER_NM", row.get("user_nm"));
        }
    );
}
```

---

**지난 글:** [Node.js 어댑터](/posts/nexacro-n-node-adapter/)

**다음 글:** [SOAP과 REST 연동](/posts/nexacro-n-soap-rest/)

<br>
읽어주셔서 감사합니다. 😊
