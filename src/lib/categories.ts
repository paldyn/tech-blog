export interface CategorizedPost {
  data: { category: string; subcategory?: string; pubDate: Date };
}

export interface CategoryGroup<T> {
  name: string;
  slug: string;
  count: number;
  latest: Date;
  posts: T[];
  children: CategoryGroup<T>[];
}

export function categorySlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^\p{Letter}\p{Number}-]+/gu, '');
}

export function categoryLabelFor(post: CategorizedPost): string {
  const { category, subcategory } = post.data;
  return subcategory ? `${category} / ${subcategory}` : category;
}

/** Parent counts include descendants; posts belong to exactly one list. */
export function buildCategoryTree<T extends CategorizedPost>(posts: T[]): CategoryGroup<T>[] {
  const parents = new Map<string, CategoryGroup<T>>();
  const children = new Map<string, Map<string, CategoryGroup<T>>>();
  const makeGroup = (name: string, date: Date): CategoryGroup<T> => ({
    name, slug: categorySlug(name), count: 0, latest: date, posts: [], children: [],
  });

  for (const post of posts) {
    const { category, subcategory, pubDate } = post.data;
    let parent = parents.get(category);
    if (!parent) {
      parent = makeGroup(category, pubDate);
      parents.set(category, parent);
    }
    parent.count += 1;
    if (pubDate > parent.latest) parent.latest = pubDate;
    if (!subcategory) {
      parent.posts.push(post);
      continue;
    }

    let siblings = children.get(category);
    if (!siblings) {
      siblings = new Map();
      children.set(category, siblings);
    }
    let child = siblings.get(subcategory);
    if (!child) {
      child = makeGroup(subcategory, pubDate);
      siblings.set(subcategory, child);
      parent.children.push(child);
    }
    child.posts.push(post);
    child.count += 1;
    if (pubDate > child.latest) child.latest = pubDate;
  }

  const compare = (a: CategoryGroup<T>, b: CategoryGroup<T>) =>
    b.count - a.count || b.latest.getTime() - a.latest.getTime() || a.name.localeCompare(b.name);
  for (const parent of parents.values()) parent.children.sort(compare);
  return Array.from(parents.values()).sort(compare);
}
