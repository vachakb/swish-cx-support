// Single source of FAQ content — reused by the self-serve Help UI (GET /api/faq)
// and the chat faq handler (searchFaq). General knowledge only; anything needing the
// customer's live data (their referral balance, their order) routes to chat.

export interface FaqArticle {
  id: string;
  question: string;
  answer: string;
  tags: string[];
}

export interface FaqCategory {
  id: string;
  title: string;
  articles: FaqArticle[];
}

export const faqCategories: FaqCategory[] = [
  {
    id: 'delivery',
    title: 'Orders & delivery',
    articles: [
      { id: 'how-fast', question: 'How fast is Swish delivery?', answer: "We cook and deliver in about 10 minutes from our own neighbourhood kitchens. You'll see a live ETA the moment your order is on its way.", tags: ['eta', 'time', 'fast', '10 min', 'how long'] },
      { id: 'late', question: 'What if my order is late?', answer: "We watch every order against our 10-minute promise. If it runs late we'll usually reach out first — and if tracking looks stuck, we make it right with a credit. You can always ask in chat for a live update.", tags: ['late', 'delay', 'stuck', 'eta'] },
      { id: 'track', question: 'Can I track my order?', answer: 'Yes — open the order to see live status and ETA. If the ETA ever looks off, message us and we’ll check with the rider directly.', tags: ['track', 'where', 'status'] },
    ],
  },
  {
    id: 'refunds',
    title: 'Cancellations & refunds',
    articles: [
      { id: 'cancel', question: 'How do I cancel my order?', answer: "You can cancel any order that hasn't started cooking yet for a full refund. Once the kitchen has started (we cook fresh, fast) we usually can't cancel — but if anything's wrong when it arrives, we'll fix it on the spot.", tags: ['cancel', 'cancellation'] },
      { id: 'refund-time', question: 'How long do refunds take?', answer: 'Swish credit is instant. Refunds to your original payment method (card/UPI) usually land in 3–5 business days.', tags: ['refund', 'money back', 'how long'] },
      { id: 'order-problem', question: 'My order had a problem (spilled, missing, or wrong item)', answer: "We're sorry! Tell us in chat what happened — a photo helps — and we'll sort it instantly, usually with a refund or Swish credit.", tags: ['spill', 'missing', 'wrong', 'damaged', 'problem'] },
    ],
  },
  {
    id: 'referrals',
    title: 'Referrals & offers',
    articles: [
      { id: 'referral-how', question: 'How does the referral program work?', answer: "Share your code, and when a friend places their first order and it's delivered, you both get ₹50 in Swish credit — added to your balance automatically.", tags: ['referral', 'refer', 'invite', 'reward', 'how'] },
      { id: 'referral-where', question: "Where's my referral reward?", answer: "Rewards credit automatically once your friend's first order is delivered. To check your exact balance, ask in chat — we'll look it up on your account.", tags: ['referral', 'reward', 'pending', 'balance'] },
    ],
  },
  {
    id: 'serviceability',
    title: 'Areas we serve',
    articles: [
      { id: 'areas', question: 'Which areas does Swish deliver to?', answer: "We're live across several Bengaluru neighbourhoods and expanding fast. Tell us your area in chat and we'll confirm whether we deliver there yet.", tags: ['area', 'city', 'serviceable', 'deliver to'] },
      { id: 'not-live', question: "You're not in my area yet", answer: "We're growing quickly — share your area and we'll note your interest so you hear the moment we launch there.", tags: ['not serviceable', 'coming soon', 'area'] },
    ],
  },
  {
    id: 'payments',
    title: 'Payments',
    articles: [
      { id: 'methods', question: 'What payment methods can I use?', answer: 'You can pay by UPI, card, or Swish credit. Cash on delivery may be available in some areas.', tags: ['payment', 'upi', 'card', 'cod'] },
      { id: 'charged-no-order', question: "I was charged but my order didn't go through", answer: "That's usually a temporary hold that drops off on its own; if it doesn't, message us in chat with the order details and we'll get it reversed.", tags: ['charged', 'payment failed', 'double charge'] },
    ],
  },
];

const lower = (s: string) => s.toLowerCase();

// Lightweight keyword scorer — good enough for the chat fallback; swap for embeddings if the corpus grows.
export function searchFaq(query: string): FaqArticle | undefined {
  const q = lower(query);
  const words = q.split(/\W+/).filter((w) => w.length > 3);
  let best: { article: FaqArticle; score: number } | undefined;
  for (const cat of faqCategories) {
    for (const article of cat.articles) {
      let score = 0;
      if (lower(article.question).includes(q)) score += 4;
      for (const tag of article.tags) if (q.includes(tag)) score += 2;
      const hay = lower(`${article.question} ${article.answer} ${article.tags.join(' ')}`);
      for (const w of words) if (hay.includes(w)) score += 1;
      if (score > 0 && (!best || score > best.score)) best = { article, score };
    }
  }
  return best?.article;
}
