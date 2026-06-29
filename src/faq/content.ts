// Authored Help content. This is the SEED source — it's loaded into the faq_* DB tables on `npm run seed`,
// and the app serves/searches from the DB at runtime (so content is editable without a redeploy).
// Topics + questions mirror Swish's in-app Help.

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

export const faqSeed: FaqCategory[] = [
  {
    id: 'delivery',
    title: 'Ordering and Delivery',
    articles: [
      { id: 'how-10-min', question: 'How does 10 minute delivery work?', answer: 'We cook from neighbourhood kitchens just minutes from you and dispatch the moment your food is ready, so most orders arrive in about 10 minutes.', tags: ['10 min', 'how', 'fast', 'delivery'] },
      { id: 'late', question: 'What happens if my order is late?', answer: "We track every order against the 10-minute promise. If it runs late we usually reach out first, and if tracking is stuck we make it right with a credit — just ask in chat for a live update.", tags: ['late', 'delay', 'stuck'] },
      { id: 'track', question: 'Can I track my delivery in real time?', answer: 'Yes — open the order to see live status and ETA. If the ETA ever looks off, message us and we’ll check with the rider directly.', tags: ['track', 'real time', 'where'] },
      { id: 'kitchen-unserviceable', question: "Why can't I place orders? [Kitchen unserviceable]", answer: 'The kitchen nearest you may be briefly closed or at capacity. It usually clears quickly — try again shortly, or tell us your area in chat.', tags: ['unserviceable', 'kitchen', 'closed'] },
      { id: 'another-order', question: "Why can't I place another order?", answer: 'We allow one active order at a time so we can keep the 10-minute promise. Once your current order is delivered, you can order again.', tags: ['another order', 'one order'] },
      { id: 'night', question: 'Do you deliver at night?', answer: 'Hours vary by neighbourhood. Open the app to see whether your nearest kitchen is currently serving.', tags: ['night', 'hours', 'timing'] },
      { id: 'area-not-serviceable', question: 'Why is my area not serviceable?', answer: "We're live in select neighbourhoods and expanding fast. Tell us your area in chat and we'll note your interest for when we launch there.", tags: ['area', 'serviceable', 'not serviceable'] },
    ],
  },
  {
    id: 'payments',
    title: 'Payments, Refunds and Coupons',
    articles: [
      { id: 'refunds-processed', question: 'How are refunds processed?', answer: "If something's wrong we sort it on the spot — instant Swish credit, or a refund to your original payment method (card/UPI) within 3–5 business days.", tags: ['refund', 'processed', 'how'] },
      { id: 'refund-not-received', question: 'Why have I not received a refund yet?', answer: 'Swish credit is instant; card/UPI refunds take 3–5 business days to appear. If it’s been longer, share the order in chat and we’ll chase it.', tags: ['refund', 'not received', 'pending'] },
      { id: 'deducted-failed', question: 'Why was my payment deducted, but the order failed?', answer: "That's usually a temporary hold that drops off on its own. If it doesn't, message us with the order details and we'll get it reversed.", tags: ['deducted', 'failed', 'charged'] },
      { id: 'apply-coupon', question: 'How do I apply a coupon or referral code?', answer: "Add it in the 'Apply coupon' field at checkout. Referral credit applies automatically once it's in your balance.", tags: ['coupon', 'referral', 'code', 'apply'] },
      { id: 'multiple-coupons', question: 'Can I use multiple coupons?', answer: 'One coupon per order, but you can combine a coupon with your Swish credit.', tags: ['multiple coupons', 'coupon'] },
    ],
  },
  {
    id: 'changes',
    title: 'Order Changes and Customization',
    articles: [
      { id: 'modify', question: 'How do I modify my order?', answer: "Because we start cooking within seconds, orders can't be edited once placed. If something's wrong, tell us in chat and we'll fix it.", tags: ['modify', 'change', 'edit'] },
      { id: 'customize', question: 'Can I customize my order (extra cheese, less spice, etc.)?', answer: 'Where the kitchen supports it, you’ll see customization options on the item before you add it to your cart.', tags: ['customize', 'extra', 'less spice'] },
    ],
  },
  {
    id: 'account',
    title: 'Account and Profile',
    articles: [
      { id: 'delete-account', question: 'How can I delete or reactivate my account?', answer: 'Go to Profile → Account settings, or ask us in chat and we’ll help you delete or reactivate it.', tags: ['delete', 'reactivate', 'account'] },
      { id: 'update-address', question: 'How do I update my address?', answer: 'Add or edit addresses in Profile → Addresses. Set the right one before checkout so we route to the nearest kitchen.', tags: ['address', 'update'] },
      { id: 'past-orders', question: 'Where can I see my past orders?', answer: 'Open Order History from your profile (or the Recent orders card here) to see every order and reorder in a tap.', tags: ['past orders', 'history'] },
      { id: 'refer', question: 'How can I refer a friend?', answer: "Share your code from Profile → Refer & earn. When your friend's first order is delivered, you both get ₹50 in Swish credit.", tags: ['refer', 'referral', 'friend', 'invite'] },
    ],
  },
  {
    id: 'support',
    title: 'Support and Safety',
    articles: [
      { id: 'contact-support', question: 'How do I contact customer support?', answer: "Right here — start a chat any time and we'll resolve it fast, or bring in a teammate if it needs a human.", tags: ['contact', 'support', 'help'] },
      { id: 'report-rider', question: 'How do I report a rider for misconduct?', answer: 'Tell us in chat with the order details. Rider conduct reports go straight to our safety team and are handled confidentially.', tags: ['report', 'rider', 'misconduct'] },
      { id: 'safety', question: 'What safety measures do you follow?', answer: 'Our kitchens follow strict hygiene standards and riders are background-verified. Anything that feels off, report it in chat and we’ll act.', tags: ['safety', 'hygiene', 'measures'] },
    ],
  },
];
