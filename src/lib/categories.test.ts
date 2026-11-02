import { describe, expect, it } from 'vitest';
import { buildCategoryTree, categoryLabelFor, categorySlug } from './categories';

function post(id: string, category: string, subcategory?: string, pubDate = '2026-11-02', archiveOrder = 1) {
  return { id, data: { category, subcategory, pubDate: new Date(pubDate), archiveOrder } };
}

describe('하위 카테고리', () => {
  it('공통 글과 벤더 글을 한 목록에만 배치하고 부모 집계에는 모두 포함한다', () => {
    const posts = [
      post('relational-model', 'SQL'),
      post('innodb-mvcc', 'SQL', 'MySQL'),
      post('postgres-vacuum', 'SQL', 'PostgreSQL'),
      post('mysql-gap-lock', 'SQL', 'MySQL'),
    ];
    const [sql] = buildCategoryTree(posts);

    expect(sql.name).toBe('SQL');
    expect(sql.count).toBe(4);
    expect(sql.posts).toEqual([posts[0]]);
    expect(sql.children.map(child => [child.name, child.count])).toEqual([
      ['MySQL', 2],
      ['PostgreSQL', 1],
    ]);

    const listed = [...sql.posts, ...sql.children.flatMap(child => child.posts)];
    expect(new Set(listed).size).toBe(posts.length);
    expect(listed).toHaveLength(posts.length);
    expect(listed).toEqual(expect.arrayContaining(posts));
  });

  it('공통 글이 없어도 상위 카테고리와 전체 글 수를 유지한다', () => {
    const [sql] = buildCategoryTree([post('query-store', 'SQL', 'SQL Server')]);

    expect(sql.name).toBe('SQL');
    expect(sql.count).toBe(1);
    expect(sql.posts).toEqual([]);
    expect(sql.children[0].posts[0].id).toBe('query-store');
  });

  it('서로 다른 부모가 같은 하위 카테고리 이름을 써도 글과 집계가 섞이지 않는다', () => {
    const sqlPost = post('mysql-index', 'SQL', 'MySQL');
    const infraPost = post('mysql-container', 'Infra', 'MySQL');
    const groups = buildCategoryTree([sqlPost, infraPost]);
    const sql = groups.find(group => group.name === 'SQL')!;
    const infra = groups.find(group => group.name === 'Infra')!;

    expect(sql.children[0].posts).toEqual([sqlPost]);
    expect(infra.children[0].posts).toEqual([infraPost]);
    expect(sql.count).toBe(1);
    expect(infra.count).toBe(1);
    expect(sql.children[0]).not.toBe(infra.children[0]);
  });

  it('입력된 발행일 및 같은 날짜의 학습 순서를 각 목록에서 보존한다', () => {
    const posts = [
      post('mysql-advanced', 'SQL', 'MySQL', '2026-11-02', 2),
      post('sql-advanced', 'SQL', undefined, '2026-11-02', 2),
      post('mysql-intro', 'SQL', 'MySQL', '2026-11-02', 1),
      post('sql-intro', 'SQL', undefined, '2026-11-02', 1),
      post('mysql-previous-day', 'SQL', 'MySQL', '2026-11-01', 10),
    ];
    const originalOrder = [...posts];
    const [sql] = buildCategoryTree(posts);

    expect(sql.posts.map(item => item.id)).toEqual(['sql-advanced', 'sql-intro']);
    expect(sql.children[0].posts.map(item => item.id)).toEqual([
      'mysql-advanced', 'mysql-intro', 'mysql-previous-day',
    ]);
    expect(posts).toEqual(originalOrder);
  });

  it('최신 날짜를 입력 순서와 관계없이 집계하고 동수일 때 최근 카테고리를 먼저 보여준다', () => {
    const groups = buildCategoryTree([
      post('old-sql', 'SQL', 'MySQL', '2026-10-01'),
      post('java-first', 'Java', undefined, '2026-10-15'),
      post('java-second', 'Java', undefined, '2026-10-20'),
      post('recent-sql', 'SQL', 'MySQL', '2026-11-02'),
    ]);

    expect(groups.map(group => group.name)).toEqual(['SQL', 'Java']);
    expect(groups[0].latest).toEqual(new Date('2026-11-02'));
    expect(groups[0].children[0].latest).toEqual(new Date('2026-11-02'));
    expect(groups[1].latest).toEqual(new Date('2026-10-20'));
  });

  it('상위·하위 이름을 라벨에 함께 표시하고 기존 카테고리 및 한글 slug를 지원한다', () => {
    expect(categoryLabelFor(post('sql', 'SQL'))).toBe('SQL');
    expect(categoryLabelFor(post('tsql', 'SQL', 'SQL Server'))).toBe('SQL / SQL Server');
    expect(categorySlug('SQL Server')).toBe('sql-server');
    expect(categorySlug('Next.js')).toBe('nextjs');
    expect(categorySlug('기록 도구')).toBe('기록-도구');

    const [sql] = buildCategoryTree([post('tsql', 'SQL', 'SQL Server')]);
    expect(sql.slug).toBe('sql');
    expect(sql.children[0].slug).toBe('sql-server');
  });

  it('글이 없으면 빈 트리를 반환한다', () => {
    expect(buildCategoryTree([])).toEqual([]);
  });
});
