# INDOBID — MULTI-SIGNAL FEED & RANKING ALGORITHM SPECIFICATION

**Document Version:** 2.0.0  
**Status:** Authoritative Recommendation Architecture Reference  
**Modules:** `src/modules/feed/`  

---

## 1. Algorithmic Overview & Philosophy

IndoBid is an ideas-and-perspectives discovery platform where discussions are powered by authentic dialogue, community engagement, and optional financial conviction.

To prevent pay-to-win dynamics where wealthy actors monopolize feeds ("whale dominance"), the IndoBid ranking engine implements **non-linear logarithmic scaling**, **half-life exponential freshness decay**, and a **multi-signal composite score** combining organic community reaction, conversation depth, personal affinity, and trust & safety penalties.

---

## 2. Mathematical Scoring Formula

The final discovery ranking score $S_{\text{final}}$ for any opinion is computed as:

$$S_{\text{final}} = \max\Big(0,\; (S_{\text{engagement}} + S_{\text{conversation}} + S_{\text{conviction}} + S_{\text{quality}} + S_{\text{affinity}} + S_{\text{freshness}} - S_{\text{penalty}}) \times D_{\text{recency}}\Big)$$

---

## 3. Signal Decomposition

### 3.1 Organic Engagement Signal ($S_{\text{engagement}}$ — 30% Weight)
Aggregates community validation through likes, impressions, and bookmarks using logarithmic normalization:

$$S_{\text{engagement}} = 12 \cdot \ln(1 + \text{likes}) + 2.5 \cdot \log_{10}(1 + \text{impressions}) + 8 \cdot \ln(1 + \text{bookmarks})$$

### 3.2 Conversation Depth Signal ($S_{\text{conversation}}$ — 20% Weight)
Rewards lively multi-party dialogue, distinct perspectives, and sequential debate replies:

$$S_{\text{conversation}} = 15 \cdot \ln(1 + \max(0, \text{contributions} - 1)) + \min(80,\; 10 \cdot \text{uniqueParticipants})$$

### 3.3 Financial Conviction Signal ($S_{\text{conviction}}$ — 10% Weight — Whale Dampening)
Applies logarithmic compression on verified paid backing in integer paise:

$$S_{\text{conviction}} = 10 \cdot \log_{10}\left(1 + \frac{\text{totalVerifiedPaise}}{1000}\right)$$

* **Whale Dampening Effect:**
  * Backing of ₹10 (1,000 paise) $\rightarrow \approx 3.0$ pts
  * Backing of ₹100 (10,000 paise) $\rightarrow \approx 10.4$ pts
  * Backing of ₹1,000 (100,000 paise) $\rightarrow \approx 20.0$ pts
  * Backing of ₹100,000 (10,000,000 paise) $\rightarrow \approx 40.0$ pts
  * **Result:** A 10,000x increase in capital produces only a 4x increase in conviction score, guaranteeing that authentic engagement decisively outranks unengaged high-dollar posts.

### 3.4 Content Quality Signal ($S_{\text{quality}}$ — 10% Weight)
Incentivizes well-articulated, complete thesis arguments and categorization:
* Length Bonus: $+10$ points for substantive content (between 80 and 1,500 characters).
* Discovery Tags: $+5$ points for relevant `#hashtag` metadata.

### 3.5 Personal Affinity Signal ($S_{\text{affinity}}$ — 15% Weight)
Personalizes the feed for authenticated users:
* Followed Author Bonus: $+25$ points if the reader follows the creator.
* Category Affinity Bonus: $+10$ points if the reader frequently likes or bookmarks opinions in this topic.

### 3.6 Freshness Boost & Half-Life Time Decay ($S_{\text{freshness}}$ & $D_{\text{recency}}$ — 15% Weight)
* **Cold-Start Discovery Window (36 Hours):** Newly published opinions receive up to $+35$ exploration points, tapering linearly:
  $$S_{\text{freshness}} = \max\left(0,\; 35 \cdot \left(1 - \frac{\text{ageHours}}{36}\right)\right)$$
* **Exponential Half-Life Recency Decay ($t_{1/2} = 48 \text{ Hours}$):**
  $$D_{\text{recency}} = \exp\left(\frac{-\text{inactivityHours}}{48}\right)$$

### 3.7 Trust & Safety Penalty ($S_{\text{penalty}}$)
* Each validated moderation report deducts $30$ points:
  $$S_{\text{penalty}} = 30 \cdot \text{reportCount}$$
* If reports exceed safety thresholds, the composite score drops to $0$, removing the post from public feeds regardless of financial backing.

---

## 4. Feed Modes & Delivery Constraints

IndoBid provides **3 locked discovery modes**:

1. **For You (`for_you`):**
   * Personalized composite multi-signal ranking.
   * **Author Diversity Spacing:** A sliding-window spacing constraint ensures that no single creator occupies more than **2 consecutive slots** in the feed.
2. **Trending (`trending`):**
   * Platform-wide velocity and momentum ranking tracking real-time 24-hour and 7-day contribution activity.
3. **Following (`following`):**
   * Exclusively displays verified discussions authored by creators that the current user subscribes to.

---

## 5. Architectural Isolation

Feed algorithms and signals reside exclusively in:
* `src/modules/feed/algorithms/` (`for-you.ts`, `trending.ts`, `following.ts`)
* `src/modules/feed/signals/` (`conviction.ts`, `freshness.ts`, `conversation.ts`, `engagement.ts`, `affinity.ts`, `diversity.ts`)
* `src/modules/feed/ranking/` (`ranking.service.ts`)

UI components consume feed data purely through `feedService.getFeed()` or `debateService.getDebates()`.
