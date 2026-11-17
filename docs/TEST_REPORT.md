# Test Report

**Date:** 2026-11-17 · **Code:** `src/` (about 2,300 lines of JavaScript) · **Environment:** Node.js (headless simulation) and Playwright + Chromium (browser)

## 1. Methods
| Test | File | What it checks |
|---|---|---|
| Headless simulation | `tests/run.js` | Runs the core engine (`01`–`08`) for N simulated days from a fixed seed. Prints event counts, a histogram of conversation intents, how far each secret has spread, sample transcripts and the final state of every agent. |
| Multi-seed statistics | `tests/stats.js` | 10 seeds × 4 simulated days. Shows how often each kind of emergent event happens across runs. |
| Peak emotions | `tests/emo.js` | The highest sadness, anger, embarrassment and jealousy each agent reaches. Used to tune the crying threshold. |
| Crying & comfort | `tests/cry2.js` | Makes Luna sad and checks that she starts crying and that a housemate comes over to comfort her. |
| Secret tracing | `tests/dbg.js` | Traces how one secret (Mia's crush) moves from head to head, including where each agent heard it. |
| Browser smoke test | `tests/shot.py` | Loads the built app, runs it at 5×, follows an agent, opens every tab, starts a party, takes screenshots and fails on any JavaScript error. |
| LLM path | `tests/llm.py` | Replaces `claude.use('sample')` with a mock that answers after 250 ms and returns invalid text on every 7th call. Checks that lines come back marked as Claude's, that invalid replies are retried, and that there are no errors. |

## 2. Results

### Multi-seed statistics (offline dialogue engine)
10 seeds x 4 days | avg runtime 820 ms | avg couples 0.10 | avg claims 210
| Event type | Avg per run | Runs where it occurred |
|---|---|---|
| talk | 210.4 | 10/10 |
| gossip | 103.7 | 10/10 |
| relationship | 22.1 | 10/10 |
| social | 20.4 | 10/10 |
| conflict | 10.3 | 10/10 |
| rumor | 10.2 | 10/10 |
| reconcile | 7.4 | 10/10 |
| party | 5.3 | 9/10 |
| jealousy | 4.1 | 9/10 |
| secret | 2.1 | 9/10 |
| mood | 1.4 | 7/10 |
| overheard | 0.7 | 4/10 |
| leak | 0.5 | 3/10 |
| cry | 0.4 | 2/10 |
| comfort | 0.3 | 2/10 |
| game | 0.3 | 2/10 |
| alliance | 0.2 | 2/10 |
| romance | 0.1 | 1/10 |
| crush | 0.1 | 1/10 |

**Reading the table:**
- Everyday social life (talking, gossip, relationship changes) happens in every run.
- Conflicts and reconciliations also happen in every run, see the table for the averages.
- Rarer events (secret leaks, Truth or Dare confessions, alliances, crushes being discovered, crying, couples) appear in some runs and not others. They depend on each run's history, which is the intended behaviour for an unscripted simulation.

### Browser tests
- `shot.py`: **no console errors or page errors.** Images are in `docs/images/`.
- `llm.py` (mocked Claude, 15 s at 2×): 17 calls, **14 lines marked as Claude's, 1 invalid reply caught and retried**, 0 fallbacks, status "Claude connected", no errors.

### Behaviour checks
- **Crying and comfort:** Luna cried after a sad event, then Noah came over to comfort her ("Noah comforted Luna") and she stopped crying.
- **Knowledge integrity:** each secret was known only by agents who took part in, overheard, or were told about the conversation it came from.
- **Emergent story seen in one test run (seed 3):** Mia's crush was revealed during Truth or Dare. Ryan then found out that Mia likes him, they flirted, and on day 4 they became a couple.
- **Performance:** about 0.8 s of computation for 4 simulated days of 10 agents.

## 3. Tuning changes made during testing
| Problem found | Fix |
|---|---|
| Confrontation lines quoted the whole rumor ("I heard about saying 'Zara said…' behind my back") | The cause of a confrontation is now written naturally ("what you said about me behind my back") |
| Max's own jokes were spreading as gossip, and Mia kept re-sending the same exaggerated rumor | Agents can't gossip about claims they started themselves. Each rumor is exaggerated at most once per agent. |
| Secrets leaked too fast (even discreet Ethan spread them) | The gossip score is now scaled by the gossip trait, with a much bigger penalty for discretion and for promises made. |
| Too little drama (no confiding, no games) | Added a confide path based on trust, a "tell" urge after learning juicy news, and spontaneous Truth or Dare at parties. |
| Crying stopped the moment it started | Added hysteresis: crying starts at `cryThr` and stops 14 points below it. |
| Nobody came to comfort someone crying in their room | Agents now notice crying from the same room, from nearby, from gossip, or from a close friend's absence. |
| Too many Truth or Dare confessions | A higher bravery threshold, and more dares. |
| A party started in the morning ended immediately | The early-morning cutoff now applies only to parties that started at night. Every party now ends after at most 5 hours. |
| The party crashed when the host evaluated their own invitation | Guard for host === self. |

## 4. Known limitations
- The tests use the offline dialogue engine and a mocked Claude. Real Claude output depends on the model.
- The `tests/*.py` scripts expect a Chromium installed through `playwright install chromium`.
- No unit tests for individual formulas. Behaviour is checked statistically and through scenarios.
