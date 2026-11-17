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
10 seeds x 4 days | avg runtime 829 ms | avg couples 0.10 | avg claims 191
| Event type | Avg per run | Runs where it occurred |
|---|---|---|
| talk | 227.8 | 10/10 |
| gossip | 102.9 | 10/10 |
| relationship | 19.4 | 10/10 |
| conflict | 11.1 | 10/10 |
| social | 8.6 | 10/10 |
| rumor | 8.1 | 10/10 |
| reconcile | 6.8 | 10/10 |
| party | 5.4 | 9/10 |
| leak | 2.3 | 4/10 |
| secret | 2.0 | 8/10 |
| jealousy | 1.8 | 6/10 |
| overheard | 1.3 | 4/10 |
| mood | 0.6 | 4/10 |
| game | 0.5 | 2/10 |
| confession | 0.5 | 2/10 |
| alliance | 0.5 | 4/10 |
| crush | 0.3 | 3/10 |
| cry | 0.1 | 1/10 |

**Reading the table:**
- Everyday social life (talking, gossip, relationship changes) happens in every run.
- Conflicts and reconciliations also happen in every run, about 11 conflicts and 7 reconciliations per run on average.
- Rarer events (secret leaks, Truth or Dare confessions, alliances, crushes being discovered, crying, couples) appear in some runs and not others. They depend on each run's history, which is the intended behaviour for an unscripted simulation.

### Browser tests
- `shot.py`: **no console errors or page errors.** Screenshots are in `docs/screenshots/`.
- `llm.py` (mocked Claude, 15 s at 2×): 24 calls, **18 lines marked as Claude's, 3 invalid replies caught and retried**, 0 fallbacks, status "Claude connected", no errors.

### Behaviour checks
- **Crying and comfort:** Luna cried after a sad event, then Noah came over to comfort her ("Noah comforted Luna") and she stopped crying.
- **Knowledge integrity:** each secret was known only by agents who took part in, overheard, or were told about the conversation it came from.
- **Emergent story seen in one test run (seed 3):** Mia's crush was revealed during Truth or Dare. Ryan then found out that Mia likes him, they flirted, and on day 4 they became a couple.
- **Performance:** about 0.8 s of computation for 4 simulated days of 10 agents.

## 3. Tuning changes made during testing
| Problem found | Fix |
|---|---|
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
