# Algorithms & Methods

The values below match the code in `src/`. All emotions, needs and relationship fields range from 0 to 100.

## 1. A* pathfinding (`findPath`, 01_core.js)
- **Grid:** 8-connected. A diagonal step is allowed only if both side tiles it passes between are walkable, so agents never cut corners through walls.
- **Costs:** a straight step costs 1 and a diagonal step costs 1.414.
- **Heuristic:** octile distance, `max(dx,dy) + 0.414·min(dx,dy)`, which never overestimates.
- **Open list:** a binary min-heap. Scores are stored in typed arrays (`Float32Array`, `Int32Array`, `Uint8Array`) for speed.
- **Blocked targets:** if the target tile is blocked, the search goes to the nearest walkable tile within a radius of 6 instead.
- **Approaching a person:** the agent re-plans its path every 1.2 simulated minutes toward the best free tile next to its target.

## 2. Seeded RNG
Xorshift32 (`seedRandom`), so headless runs can be reproduced exactly from a seed.

## 3. Utility-based decision making (`decide`, 05_decide.js)
Each option gets a score, and one option is drawn from a **softmax**:

```
P(option i) = exp((score_i − max) / T) / Σ exp((score_j − max) / T)
T = 6 + impulsivity·0.08 (+5 if contrarian > 70)
```

Impulsive characters (Zara, Ivy) choose less predictably, but their choices still follow their own logic. An inertia penalty of −8 applies to repeating the previous choice.

Example scoring terms:
| Option | Score |
|---|---|
| sleep | (100−energy)·0.8 + 60·[bedtime] − extraversion·0.3·[party] + 50·[energy<12] − 12 |
| eat | (100−hunger)·1.05 + 18·[mealtime] + 25·[pizza] − 22 |
| solitude | (100−privacy)·0.65·(0.5+introversion/100) + stress·0.45 + 14·[sad] + 12·[embarrassed] − 14 |
| socialize(b) | (100−social)·0.55·(0.4+E/100) + friendship·0.22 + attraction·0.2 − resentment·0.5 − distance penalty |
| intention (confront, apologize, comfort…) | urgency − distance + emotion and personality modifiers |

The social **purpose** (chat, gossip, flirt, confide, ask_about, ally, joke or comfort) is chosen from relationship thresholds, personality traits and what the agent knows.

## 4. Emotion engine (`feel`, `decayEmotions`, 03_engine.js)
Changes are scaled by personality before they are applied:
```
negative emotions (sadness, anger, fear, jealousy, embarrassment, loneliness, stress), increase × (0.55 + neuroticism/110)
positive emotions, increase × (0.75 + extraversion/300)
anger additionally × (0.5 + temper/100)
```
Each tick, every emotion decays toward the agent's baseline:
```
e += (baseline − e) · k·dt,   k = 0.0018 + (100−neuroticism)/100 · 0.0042
```
Sensitive characters recover more slowly. The lasting consequences of an event are carried by relationships and memories, which do not decay this way.

**Crying (`cryThr`)** is triggered only by an event: a single sadness increase of at least 8 that pushes sadness to at least `68 − neuroticism·0.35`. Crying stops once sadness falls 14 points below that threshold (hysteresis), or sooner if someone comforts them. Luna, for example, starts crying at about 38 sadness, while Sophia needs about 58.

## 5. Relationship engine (`relChange`)
- Relationships are one-directional: `a.rel[b] ≠ b.rel[a]`.
- Every change is clamped to 0–100 and adds 0.5 familiarity.
- The cause is stored in `sharedHistory` (the newest 14 entries are kept) and in a global `relLog` of 500 entries. A total change of 12 or more creates a visible event.
- Ivy's changes are multiplied by 1.4, because she switches sides when her goals change.
- **Labels:** Partner, Enemy (resentment > 65), Crush (attraction > 58), Rival (resentment > 42 and respect > 45), Distrusts (trust < 25), Close friend, Friend, Annoyed, Housemate.

## 6. Gossip and knowledge propagation (`learnClaim`, `pickGossipFor`, `distortClaim`)
- **Confidence on receipt:** `(0.35 + trust(listener→source)/160) × hearing clarity`. Hearing the same thing again raises confidence by `conf·0.3`.
- **Choosing what to gossip:**
```
s = juicy·6·confidence·(0.25 + gossip/100) − friendship(about)·0.2 + resentment(about)·0.35
if secret:              s −= discretion·0.45
if told in confidence:  s −= discretion·0.6 + trust(owner)·0.3
old news (>10h):        s −= 10
```
  The agent skips claims about the people it is talking to, claims its listeners already heard from it, and claims it started itself.
- **Urge to pass it on:** learning a juicy claim (juiciness 6 or more) gives gossip-prone agents a `tell` intention aimed at their most trusted friend. Its urgency is `gossip·0.55 + juicy·3 − restraint`.
- **Rumor distortion:** characters who exaggerate (Mia) may retell a claim as a new **variant claim** `{parent, truth:false, juicy+2}`, for example "Luna likes Alex" becomes "Luna is completely obsessed with Alex". The original and the variant can then coexist in different heads, so people hold contradictory beliefs.
- **Leak discovery and betrayal (`discoverLeak`):** when a secret's owner learns that someone else knows it:
  - If the knower is someone the owner confided in, the blame is certain.
  - Otherwise, if the knower names their source and that source is a confidant, the blame is also certain.
  - Otherwise the owner suspects the confidant they trust least. This means an innocent confidant can be **wrongly accused**, for example when the secret actually escaped through overhearing.
  - The blamed person loses trust (−38 if certain, −24 if suspected) and gains resentment, and the owner gains a `confront` intention.

## 7. Spatial hearing (`hearClarity`, 04_life.js)
```
base range: whisper 2.4 · normal 6 · loud 12 tiles
range = base × (1 − roomNoise·0.6)      (party hall 0.55, adjacent rooms 0.25, storm outdoors 0.4)
same room:      clarity = 1 − (d/range)·0.55   if d ≤ range
other room:     whispers never pass; needs an OPEN door between rooms;
                path d = |listener→door| + |door→speaker|, range×0.55, clarity 0.15–0.6
sleeping:       only loud voices within 4 tiles (clarity 0.3)
```
Overheard facts are stored with lower confidence and marked `overheard`. Reading a conversation in the observer UI never passes information to any agent.

## 8. Conversation manager (06_conv.js)
- **Size:** 2–5 participants. Several conversations can run in different rooms at the same time.
- **Acceptance (`requestConversation`):** an invitation is accepted when the score below beats a random threshold.
```
acc = 45 + (100−social)·0.3 + friendship·0.35 + attraction·0.2 − resentment·0.55 − stress·0.15 − busy + (E−50)·0.3
     + comfort/confront/apology modifiers;  accept if acc ≥ 30 + rand·25
```
- **Speaker selection:**
  - The person addressed in the previous line answers 85% of the time.
  - Otherwise the next speaker is a weighted pick by `extraversion·0.5 + anger·0.3 + excitement·0.2`.
  - Mediators and interrupters get priority.
- **Ending:** a conversation ends on a `leave` intent, on the model's `endConversation`, when it reaches its turn limit (4–7 plus extraversion/25, with bonuses for games and confrontations), or after 25 idle minutes.
- **Tone:** each hostile line lowers the tone (an insult counts double) and each warm line raises it. At tone −2 or below:
  - Bystanders react: conflict-avoidant people leave the room, highly empathetic people come to mediate, and friends of the person being attacked come to defend them.
  - Agents who storm off avoid the others for 40–120 minutes.

## 9. Turn planning (`planTurn`, 07_dialogue.js)
1. **Opening move:** the conversation's purpose sets the first line.
2. **Reaction table:** the speaker responds to the previous intent. For example:
   - `ask_about` leads to a reveal-or-keep decision: `(100−discretion)·0.55 + trust(asker)·0.3 + gossip·0.3 − friendship(owner)·0.45 − promise penalty + noise`.
   - `confront` leads to apologize, deflect or insult if the speaker is guilty, and to deny if they are innocent.
   - `apologize` leads to forgiveness if `agreeableness·0.5 + friendship·0.3 − resentment·0.6 + rand·30 > 22`.
   - `flirt` gets a flirt back when attraction is above 45, and a confession after two or more flirts when attraction is above 72 and trust above 45.
   - `confess` is accepted when attraction is above 55 and the speaker has no partner, which forms a couple.
3. **Free choice:** otherwise a weighted pick among chat, gossip, joke, compliment, flirt, confide, complain (which creates a "said behind their back" claim), ask_about, invite and leave.

## 10. Party system
- Only certain characters (Alex, Zara, Max, Ivy, Mia) can host, in the evening, when there has been no party for 5 hours.
- An invite goes out, and each agent re-evaluates at its own random delay of 0.5–8 minutes:
```
score = E·0.55 + excitement·0.25 + (100−fun)·0.25 − (100−energy)·0.45 − stress·0.2 − sadness·0.2
      + (friendship(host)−45)·0.35 − resentment(host)·0.4 ± crush/enemy present ± bedtime
```
- **Ending:** when fewer than 2 people stay in the hall for 18 minutes, after 3 AM, after 5 hours, or during a power outage.
- If 3 or fewer people turned up, the host feels sad and embarrassed.
- Trash appears while people eat and dance, and conscientious agents decide to clean up.

## 11. LLM request handling (08_llm.js)
- **Queue:** a FIFO queue processed by a pump that runs up to `maxConcurrent` requests at once (default 2), each with an `AbortController` timeout.
- **Backoff:** after a rate limit, the wait is `min(60s, 2.5s·2^failures)`. After other errors it is `min(30s, 1s·2^failures)`.
- **Budget:** a daily cap on calls (default 300) and on estimated tokens (`chars/4`). When the cap is reached, or the queue is full (5), the turn goes to the offline engine so the simulation never stalls.
- **Validation:** extract the first `{…}` block, then `JSON.parse` (with a pass that repairs trailing commas and curly quotes), then check against the schema:
  - Required fields, and lengths clamped to their limits.
  - Enums for intent, volume and emotion, with defaults.
  - Arrays filtered by type.
  - Nested schemas for `newClaim`.
  - **Up to 2 attempts** (the second includes the error message), then the offline engine's line is used.

## 12. Rendering (09_render.js)
- The static house is drawn once to an offscreen canvas at 1.5× scale. Moving things are drawn each frame: party lights, the TV, the pool, the fire, trash, snacks, doors, and night, rain or outage effects.
- Characters are sorted by y-coordinate so nearer ones overlap farther ones. Their positions are smoothed with linear interpolation.
- Each character's pose follows their activity: walking, sitting, lying in bed, dancing, pacing, or a comforting arm.
- Faces are drawn procedurally and change with expression: happy, sad, crying (animated tears), angry (steam), nervous (sweat), laughing, flirty (hearts), shocked or asleep.
- Speech bubbles are drawn in screen space with greedy overlap avoidance. Whispers get a dashed border and shouts a red one.
