# Architecture

The Gossip House uses a **five-layer hybrid architecture**. The LLM is never called for movement or animation. It is used only for meaningful dialogue and the social choices made inside a conversation.

```
┌──────────────────────────────────────────────────────────────┐
│  Observer UI (10_ui.js)  ·  Renderer (09_render.js)           │  read-only view of state
├──────────────────────────────────────────────────────────────┤
│  Layer 5  Scheduler / sim clock  (tick, convTick, timers)     │  timing + integrity only
│  Layer 4  Persistent memory & knowledge (memories, claims)    │
│  Layer 3  LLM social reasoning (08_llm.js)                    │  dialogue + in-conversation choices
│  Layer 2  Utility decision engine (05_decide.js, 07_dialogue) │  what to do / what to say next
│  Layer 1  Deterministic simulation (01_core, 03, 04)          │  movement, needs, emotions, hearing
└──────────────────────────────────────────────────────────────┘
```

## Layer 1: Deterministic simulation
- **World:** a 60×40 tile grid made of walls, floor, furniture and outdoor lawn. There are 14 rooms and 17 doors, some of which can close. Furniture blocks tiles and offers **spots** (seats, beds, the dance floor, the DJ booth, the stove and so on). Each spot has a tile to stand on when approaching, a position where the character is drawn, and a facing direction. Only one agent can reserve a spot at a time.
- **Movement:** A* on an 8-connected grid (see ALGORITHMS.md), followed at 3.1 tiles per simulated minute.
- **Needs:** energy, hunger, social, fun, privacy and rest, plus a hidden bladder value. They drain over time and are refilled by the matching activities.
- **Emotions:** decay toward each agent's baseline every tick.
- **Doors:** recomputed every tick. A door closes when the room behind it holds someone sleeping, crying, alone, in the bathroom, or in a private conversation. It opens briefly whenever someone walks through.
- **Hearing:** a function of distance, volume, room, doors and noise.

## Layer 2: Utility decision engine
Whenever an agent becomes idle, or something urgent interrupts a low-priority activity, `decide(agent)` does four things:
1. Generates candidate options: sleep, eat, TV, hobby, stroll, solitude, cry, pace, bathroom, party, plan a party, clean up, cook, play a game, join a conversation, and social options for each of its intentions and each likely partner.
2. Scores each option from needs, emotions, personality, relationships, time of day and the state of the world.
3. Picks one with a softmax-weighted random choice, where the temperature depends on personality.
4. Stores a human-readable **reason** and the top alternatives, which the UI shows.

Inside a conversation, `planTurn()` chooses the speaker's **intent** (gossip, confront, apologize, comfort, flirt and so on) using a reaction table followed by weighted free choice.

## Layer 3: LLM social reasoning
- **Provider abstraction (`LLM` object):** provider, model tier, concurrency limit, timeout, daily call and token budgets, exponential backoff, maximum queue length and statistics.
- **Prompt per turn:** built from the speaker's personality, speech style, goals, emotions, needs, room and surroundings, their views of the other participants (with recent history), **only the facts they know** (each labelled F1…Fn with where it came from), relevant memories, the last 10 lines of the conversation, and Layer 2's suggested move. The model may pick a different move.
- **Output:** a structured JSON reply, validated by a dependency-free schema validator that works like Zod. The system retries a bounded number of times and then falls back to the offline engine.
- **Knowledge integrity:** fact IDs returned by the model are mapped back to claim IDs and filtered against what the speaker actually knows. The model can't make a character reveal something the character never learned.

## Layer 4: Memory and knowledge
- **Memories:** `{time, text, importance 1–10, involved ids, type}`. Recent memories are kept, and important ones (7 or higher) survive longer.
- **Claims:** shared pieces of information `{about, target, kind, content, secret, owner, juicy, origin, confidedTo, public, truth, parent}`.
- **Per-agent knowledge (`KnownFact`):** `{claimId, sourceAgentId, learnedAt, confidence, isSecret, permittedRecipients, own, overheard, toldTo[]}`.

## Layer 5: Scheduler
- `tick(dt)` advances the simulation clock in steps of at most 0.25 simulated minutes. The speed buttons scale the simulation clock only, so they never speed up API requests.
- Each conversation has a `busy` lock and a `nextAt` time, so only one model call per conversation is in flight and two characters never talk over each other by accident. Interrupting someone is a deliberate, modelled action.
- The scheduler never creates drama. It only coordinates timing and keeps the state consistent (one location per agent, one reserved spot per agent).

## Data flow of one conversation line
```
convTick → chooseSpeaker → planTurn (Layer 2 intent)
        → generateTurn ─┬─ Claude (prompt → JSON → validate → retry) 
                        └─ offlineTurn (templates + personality tics)
        → applyTurn: bubble → hearers (participants + spatial overhearing)
                   → claim transfer with provenance → applyEffects (emotions, relationships, events)
                   → bystander reactions (leave room / mediate / defend friend)
```
