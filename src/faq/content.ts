// Authored Help content. This is the SEED source — loaded into the faq_* DB tables on `npm run seed`,
// and the app serves/searches from the DB at runtime (so content is editable without a redeploy).
// Answers are grounded in Swish's real policies (justswish.in Terms of Service) — keep them accurate.

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
      { id: 'how-10-min', question: 'How does 10 minute delivery work?', answer: 'We cook from neighbourhood kitchens just minutes from you and dispatch the moment your food is ready, so most orders arrive in about 10 minutes. It’s an average, not a guarantee — demand, traffic or weather can add a little time.', tags: ['10 min', 'how', 'fast', 'delivery'] },
      { id: 'late', question: 'What happens if my order is late?', answer: 'Our ~10-minute target isn’t a hard guarantee — demand, traffic and weather can affect it. You’ll always see a live ETA, and if an order is running behind we usually reach out first with an update. If yours looks stuck, message us and we’ll check with the rider directly.', tags: ['late', 'delay', 'stuck'] },
      { id: 'track', question: 'Can I track my delivery in real time?', answer: 'Yes — open the order to see live status and ETA. If the ETA ever looks off, message us and we’ll check with the rider directly.', tags: ['track', 'real time', 'where'] },
      { id: 'areas', question: 'Where does Swish deliver?', answer: 'We deliver from neighbourhood kitchens across Bengaluru, reaching roughly a kilometre around each kitchen — so coverage depends on your exact address. Add it in the app to check instantly. We’re expanding fast, including to new cities.', tags: ['area', 'serviceable', 'deliver', 'where', 'city'] },
      { id: 'fees', question: 'What charges might appear on my bill?', answer: 'Alongside item prices there may be a delivery fee, and at busy times extra charges can apply — peak-hour, rain, late-night, packing, small-cart or platform fees. Everything is shown clearly at checkout before you pay.', tags: ['fee', 'charges', 'delivery fee', 'surge', 'cost'] },
      { id: 'kitchen-unserviceable', question: "Why can't I place orders? [Kitchen unserviceable]", answer: 'The kitchen nearest you may be briefly closed or at capacity. It usually clears quickly — try again shortly, or tell us your area in chat.', tags: ['unserviceable', 'kitchen', 'closed'] },
      { id: 'another-order', question: "Why can't I place another order?", answer: 'We allow one active order at a time so we can keep the 10-minute promise. Once your current order is delivered, you can order again.', tags: ['another order', 'one order'] },
      { id: 'night', question: 'Do you deliver at night?', answer: 'Hours vary by neighbourhood. Open the app to see whether your nearest kitchen is currently serving.', tags: ['night', 'hours', 'timing'] },
    ],
  },
  {
    id: 'payments',
    title: 'Payments, Refunds and Coupons',
    articles: [
      { id: 'payment-methods', question: 'Which payment methods can I use?', answer: 'Debit and credit cards, UPI/bank, and Cash on Delivery. The available options are shown at checkout.', tags: ['payment', 'methods', 'upi', 'card', 'cash', 'cod'] },
      { id: 'refunds-processed', question: 'How are refunds processed?', answer: 'If something’s wrong we’ll make it right — often as instant Swish credit. A refund to your original payment method (card/UPI) is processed within 7 business days of us verifying it, and may then take a little longer to reflect depending on your bank or payment provider.', tags: ['refund', 'processed', 'how'] },
      { id: 'refund-not-received', question: 'Why have I not received a refund yet?', answer: 'Swish credit is instant. A card/UPI refund is processed within 7 business days of us confirming it, then depends on your bank to appear. If it’s been longer, share the order in chat and we’ll chase it.', tags: ['refund', 'not received', 'pending'] },
      { id: 'deducted-failed', question: 'Why was my payment deducted, but the order failed?', answer: "That's usually a temporary hold that drops off on its own. If it doesn't, message us with the order details and we'll get it reversed.", tags: ['deducted', 'failed', 'charged'] },
      { id: 'apply-coupon', question: 'How do I apply a coupon or referral code?', answer: "Add it in the 'Apply coupon' field at checkout. Referral credit applies automatically once it's in your balance.", tags: ['coupon', 'referral', 'code', 'apply'] },
      { id: 'multiple-coupons', question: 'Can I use multiple coupons?', answer: 'One coupon per order, but you can combine a coupon with your Swish credit.', tags: ['multiple coupons', 'coupon'] },
    ],
  },
  {
    id: 'changes',
    title: 'Order Changes and Cancellation',
    articles: [
      { id: 'cancel', question: 'Can I cancel my order?', answer: 'You can cancel free of charge any time before we accept and start preparing it. Because we cook fresh and dispatch within minutes, it can’t be cancelled once the kitchen has started. If we ever have to cancel (for example an item is unavailable), you’re fully refunded.', tags: ['cancel', 'cancellation'] },
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
      { id: 'contact-support', question: 'How do I contact customer support?', answer: 'Start a chat here any time for real-time help, and we’ll bring in a teammate if it needs a human. You can also email hello@justswish.in; formal grievances are acknowledged by our Grievance Officer within 48 hours.', tags: ['contact', 'support', 'help', 'email'] },
      { id: 'wrong-damaged', question: 'What if I get the wrong item, or it arrived damaged?', answer: 'Tell us the same day via chat. If you received the wrong item, or food that was substantially damaged or spoiled on arrival, we’ll make it right. We can’t process it once the packaging has been opened or the item consumed.', tags: ['wrong', 'damaged', 'spoiled', 'return', 'quality'] },
      { id: 'report-rider', question: 'How do I report a rider for misconduct?', answer: 'Tell us in chat with the order details. Rider conduct reports go straight to our safety team and are handled confidentially.', tags: ['report', 'rider', 'misconduct'] },
      { id: 'safety', question: 'What safety measures do you follow?', answer: 'Our kitchens follow strict hygiene standards and riders are background-verified. Anything that feels off, report it in chat and we’ll act.', tags: ['safety', 'hygiene', 'measures'] },
    ],
  },
];
