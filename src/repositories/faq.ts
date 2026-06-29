import { asc } from 'drizzle-orm';
import { db } from '../db/client';
import { faqArticles, faqCategories } from '../db/schema';
import type { FaqArticle, FaqCategory } from '../faq/content';

export async function listFaqCategories(): Promise<FaqCategory[]> {
  const [cats, arts] = await Promise.all([
    db.select().from(faqCategories).orderBy(asc(faqCategories.sortOrder)).all(),
    db.select().from(faqArticles).orderBy(asc(faqArticles.sortOrder)).all(),
  ]);
  return cats.map((c) => ({
    id: c.id,
    title: c.title,
    articles: arts.filter((a) => a.categoryId === c.id).map((a) => ({ id: a.id, question: a.question, answer: a.answer, tags: a.tags ?? [] })),
  }));
}

// All articles, flat — used to ground the LLM knowledge answer.
export async function listFaqArticles(): Promise<FaqArticle[]> {
  const arts = await db.select().from(faqArticles).orderBy(asc(faqArticles.sortOrder)).all();
  return arts.map((a) => ({ id: a.id, question: a.question, answer: a.answer, tags: a.tags ?? [] }));
}

const lower = (s: string) => s.toLowerCase();

// Lightweight keyword scorer over the DB-backed articles; swap for embeddings if the corpus grows.
export async function searchFaq(query: string): Promise<FaqArticle | undefined> {
  const q = lower(query);
  const words = q.split(/\W+/).filter((w) => w.length > 3);
  const arts = await db.select().from(faqArticles).all();
  let best: { article: FaqArticle; score: number } | undefined;
  for (const a of arts) {
    const tags = a.tags ?? [];
    let score = 0;
    if (lower(a.question).includes(q)) score += 4;
    for (const tag of tags) if (q.includes(tag)) score += 2;
    const hay = lower(`${a.question} ${a.answer} ${tags.join(' ')}`);
    for (const w of words) if (hay.includes(w)) score += 1;
    if (score > 0 && (!best || score > best.score)) best = { article: { id: a.id, question: a.question, answer: a.answer, tags }, score };
  }
  // Require more than one incidental word overlap, so an off-topic query doesn't get a wrong article.
  return best && best.score >= 2 ? best.article : undefined;
}
