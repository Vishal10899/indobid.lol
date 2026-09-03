# INDOBID — FEED ALGORITHMS & DISCOVERY SPECIFICATION

---

## 1. The 3 User-Facing Feed Modes
1. **For You (`for_you`)**: Personalized multi-signal ranking with real-time topic affinity (from last 30 likes/bookmarks) and author diversity spacing.
2. **Trending (`trending`)**: Momentum and velocity with 48-hour exponential half-life activity decay.
3. **Following (`following`)**: Strict social graph query filtered to creators the user follows.

---

## 2. Multi-Signal Macro-Pillar Weights
* **30% Meaningful Engagement**: Likes ($\times 12$), Bookmarks ($\times 8$), Impressions ($\times 2.5$)
* **20% Conversation Quality**: Replies ($\times 15$) + Participant Diversity Bonus ($\le 80$)
* **15% Freshness Discovery**: Up to $+35$ points within the 36-hour exploration window
* **15% Personal Relevance**: Followed creator ($+25$), Category affinity ($+10$)
* **10% Content Integrity**: Optimal length sweet-spot ($80 - 1500$ chars), Hashtags
* **10% Financial Conviction**: Logarithmically scaled anti-whale metric

---

## 3. Logarithmic Anti-Whale Protection
$$\text{Conviction Score} = \ln\left(1 + \frac{\text{Paise}}{1000}\right) \times 10$$
*A 100x increase in capital produces only a ~2.8x increase in score weight, preventing pay-to-win dominance.*

---

## 4. Author Diversity Feed Constraint
The feed selection loop enforces that **no single author may occupy more than 2 consecutive slots** in the user's feed stream ([`src/modules/feed/for-you/for-you.service.ts`](file:///D:/indobid.lol/src/modules/feed/for-you/for-you.service.ts)).
