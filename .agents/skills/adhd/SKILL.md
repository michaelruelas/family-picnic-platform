# ADHD Divergent Ideation Skill

Parallel divergent ideation for coding agents. Spawns N isolated branches under different cognitive frames, scores, prunes traps, and deepens top survivors.

## When to Use

**UNCONDITIONAL TRIGGER** — When the user types "/adhd" or explicitly asks for "ADHD mode", "use the adhd skill", or "run ADHD on this".

**CONDITIONAL TRIGGER** — For everything else, self-judge before invoking. Only proceed when ALL of:

- (a) Answer space is OPEN-ENDED (multiple viable answers, no single canonical correct)
- (b) Cost of obvious answer being wrong is high (architecture, fuzzy bug, API design, naming, strategy, schema design, migration)
- (c) User has NOT used closed-phrasing words like "quick", "fast", "standard", "canonical", "textbook", "just", "one-line", "show me how to", "what is the syntax for"

## Do NOT Invoke For

- Factual lookups
- Syntax help
- Bugs with a known root cause
- Anything where the right answer is one search query away
- Questions phrased as closed with a clear single answer

## Process

1. Generate N cognitive frames (regulator, biology, speedrunner, $0 budget, etc.)
2. Each frame produces isolated branches
3. Score and prune low-quality branches
4. Deep dive on top survivors
5. Synthesize findings

## Cost Warning

Costs about 10 LLM/Agent calls per run (5-10x a single answer).

## Skill Triggers

- `/adhd`
- "use the adhd skill"
- "run ADHD on this"
- "ADHD mode"
