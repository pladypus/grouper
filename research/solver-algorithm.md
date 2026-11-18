# Research: which algorithm produces random Groups that satisfy every Rule?

Ticket: [#2](https://github.com/pladypus/random-group-generator/issues/2). Vocabulary follows [GLOSSARY.md](../GLOSSARY.md).

## Answer

Use a **small hand-written solver**, with no library. It has four stages and runs synchronously, or in a Web Worker if we want to be safe.

1. **Preprocess.** Remove Locked Groups and their sizes from the Split. Merge overlapping Clusters into *blocks* with union-find. Turn Apart rules into edges between blocks. Then run cheap checks that find the most common Conflicts and say what caused them: an Apart pair inside a Cluster, a Cluster larger than every Group, a Cluster split by a Lock, and more mutually-Apart Students than Groups.
2. **Find one valid grouping.** Use complete randomized backtracking: assign blocks to Groups with MRV and DSatur ordering, forward checking in both directions, symmetry breaking on interchangeable empty Groups, and randomized restarts. The search is complete, so if it runs out of options, that **proves** there is a Conflict.
3. **Spread the results.** Run a few hundred steps of a Markov chain that swaps random sets of blocks between two Groups when their sizes match and no Apart rule breaks. The proposal is symmetric, so the uniform distribution over valid groupings is its stationary distribution. This removes the strong bias of plain backtracking.
4. **Explain a Conflict.** Use deletion-based minimal unsatisfiable subset (MUS) extraction over the Rules (QuickXplain-style). The Split and Locks are fixed background. This returns a set of Rules that cannot all hold together and becomes satisfiable if any one of them is removed. Show the friendly reason from the quick checks when there is one.

Measured on 40 Present Students: a Shuffle took **under 8 ms in the worst case over 12,000 random instances**, a typical Shuffle took about 0.2 ms, and an explanation took **at most about 0.7 s** for adversarially dense Rules (up to 80 Apart rules) and **at most about 3 ms** for realistic ones (up to 40).

## Problem shape

Once Clusters are merged, a Shuffle has to put *blocks* (sizes 1..k) into *Groups* with fixed capacities from the Split. Each Group must be filled exactly, and two blocks joined by an Apart rule cannot share a Group. That is a graph colouring problem (Apart rules form the graph, Groups are the colours) combined with exact bin-packing capacities. Both are NP-complete in general. At 40 Students, however, a well-pruned complete search almost never backtracks.

## Options compared

| Approach | Valid? | Proves Conflict? | Spread over valid groupings | Speed at ~40 | Verdict |
|---|---|---|---|---|---|
| **Rejection sampling** (shuffle, cut by Split, retry until valid) | yes | **no**: it can only "give up after N tries" | **exactly uniform** (each valid grouping has the same number of permutations for a fixed Split) | fine with light Rules (about 550 tries ≈ 1 ms with two 2-Clusters and 15 Apart rules); **hopeless with Clusters of 3–4**: it failed to find a grouping within 100k tries in most feasible instances of the sweep | Useful only as a reference or fast path |
| **Randomized backtracking alone** | yes | **yes** (complete) | **biased**: in small enumerated cases some groupings came up 3–6× more often than others (chi²/df 85–1100) | sub-ms | Needs a mixing step |
| **Backtracking + set-swap MCMC** (recommended) | yes | yes (via backtracking) | no measurable bias after ~200 steps (chi²/df ≈ 1, the same as exact rejection sampling) | ~0.2–0.3 ms per Shuffle at 40 Students | **Recommended** |
| **SAT / CP solver in the browser**: [`logic-solver`](https://github.com/meteor/logic-solver) (MiniSat compiled with Emscripten, MIT) or [`minizinc`](https://js.minizinc.dev/docs/stable/) (WebAssembly, MPL-2.0, runs in a worker) | yes | yes | **no random sampling.** logic-solver's README says there is "no guarantee of which solution is found" and that results are deterministic, so the spread problem remains | fast, but adds a large dependency and async WASM loading | Not worth it: it fixes neither spread nor explanation, and a generic SAT encoding of "more Students than Groups" is still a pigeonhole problem (see below) |
| **Exact uniform sampling** (count solutions, then sample) | yes | yes | exact | counting is #P-hard in general; uniform generation reduces to approximate counting (Jerrum, Valiant & Vazirani 1986) | Overkill for the need |

## Recommended algorithm in detail

The prototype is [`research/solver-algorithm/solver.mjs`](solver-algorithm/solver.mjs) (about 180 lines, no dependencies).

### 1. Preprocess (`prepare`)
- Keep only Present Students. Absent Students' Rules stay on the Roster but are ignored for this Shuffle.
- **Locks:** each Locked Group is taken out with its Students, and one matching size is removed from the Split. Apart rules involving a Locked Student are then satisfied automatically, because nobody else can join a Locked Group.
- **Clusters → blocks:** union-find merges overlapping Clusters, so `{A,B}` and `{B,C}` become one block `{A,B,C}`.
- **Apart rules → block graph edges.**
- **Quick Conflict checks.** Each one names its cause directly:
  - an Apart pair inside one (merged) Cluster;
  - a block larger than the largest free Group;
  - a Cluster partly inside a Lock, or spread across Locks;
  - an Apart pair both inside one Locked Group (possible after a Manual move);
  - the **pigeonhole check**: the exact maximum clique of the Apart graph (branch and bound, fast at this size) is larger than the number of free Groups, e.g. "these 11 Students must all be apart, but there are only 10 Groups". This check is essential, see below.

### 2. Search (`solve`, `solveWithRestarts`)
- **Variable ordering:** first the block with the fewest Groups it can still go into (MRV); ties go to the block with the most Apart edges (DSatur, Brélaz 1979), then the larger block, then a random choice.
- **Value ordering:** the candidate Groups in random order.
- **Symmetry breaking:** empty Groups of the same size are interchangeable, so only one is tried. Without this, proving "no grouping" multiplies the work by the factorial of the number of Groups.
- **Forward checking in both directions:**
  - every unplaced block must still have a Group it can go into;
  - *and* every Group with free seats must still have enough eligible Students to fill it.
  The second check matters. Without it, "one Student Apart from all 39 others, Groups of 2" ran past 5 million nodes; with it, the search needs 2 nodes.
- **Randomized restarts** with geometrically growing node budgets (start at 1000, ×1.5 each time). Backtracking run times are heavy-tailed, and rapid randomized restarts remove that tail (Gomes, Selman, Crato & Kautz 2000). We saw this directly: one dense instance ran past 2 million nodes with an unlucky random sequence and was solved in 26 nodes with a fresh one. The budget grows without bound, so the search stays complete and a Conflict is still proved, not guessed.

### 3. Spread (`mixSets`)
Repeat about 200–500 times:
1. Pick two different Groups.
2. Pick a random subset of blocks in each one (each block included with probability ½).
3. Swap the two subsets if their total sizes match and no Apart rule breaks.

The total number of blocks in the two Groups does not change, so the reverse move has the same proposal probability. The proposal is therefore symmetric, and a symmetric Metropolis chain with "reject if invalid" has the uniform distribution over the valid groupings it can reach as its stationary distribution (Hastings 1970). Swapping *sets*, not single blocks, matters. A swap of one block for one block of equal size cannot trade a 2-Student Cluster for two single Students, and in test C that chain stayed biased (chi²/df ≈ 20) even after 200 steps.

Caveat: we have not proved that this chain can reach every valid grouping from every other. Swap chains for constrained colourings can be "frozen" in theory. In every case measured, it matched the exact uniform distribution. Starting each Shuffle from a fresh randomized backtracking solution also gives several independent starting points.

### 4. Explain (`explain`)
- **Deletion filter (minimal unsatisfiable subset):** start with every Rule. For each Rule, remove it and re-solve. If the remaining Rules still conflict, leave it out for good. What is left is a minimal conflicting set: the Rules still conflict, and removing any one of them makes a valid grouping possible. This takes at most one solver call per Rule. [QuickXplain (Junker, AAAI 2004)](https://mlanthology.org/aaai/2004/junker2004aaai-quickxplain) gives the same kind of answer with divide and conquer and fewer calls, and lets us say which Rules to *prefer* to blame. For example, the most recently added Rules can be listed last so that older Rules are blamed first. Both methods are described in Marques-Silva (2010).
- **Budget:** each re-solve gets a node budget. A re-solve that runs out counts as "this Rule is needed", so the output is **always a set of Rules that genuinely conflict**, but sometimes not the smallest one. In the dense sweep this happened in about 5% of Conflicts. With realistic Rules it never happened.
- **Presentation:** a minimal set can still be large. For example, 11 mutually-Apart Students produce 55 Apart rules. Show the *structured* reason from the quick checks when one fires ("11 Students must all be apart but there are only 10 Groups"), and show the Rule list only for Conflicts found by search.

## Why not just use a SAT solver?
- **Spread is unsolved.** Solvers return an arbitrary first solution, so we would still need step 3.
- **The hard case is still hard.** The pigeonhole principle ("n+1 Students who must all be apart, n Groups") has no short resolution proofs (Haken 1985), so CDCL SAT solvers, which are resolution-based, also struggle with it. The clique check plus symmetry breaking handles it in under 1 ms.
- **Cost:** it adds a WASM or Emscripten dependency and async loading to a static app, for a problem that about 180 lines of JavaScript already solve.

## Experiment results

Node 24, single thread, on a developer laptop. Scripts are in [`research/solver-algorithm/`](solver-algorithm/).

**Random stress** (`stress.mjs`): 4,000 instances per run with 20–40 Present Students, Target sizes 2–6, 0–5 Clusters, three high-Apart "difficult" Students, and a random Lock in 30% of instances.

| Run | Feasible / Conflict | Worst Shuffle | Worst explanation | Non-minimal explanations |
|---|---|---|---|---|
| ≤40 Apart rules | 3810 / 190 | 4.4 ms | 2.7 ms | 0 |
| ≤80 Apart rules (×3 seeds) | ~3500 / ~500 | 7.9 ms | 0.52–0.70 s | 16–26 (≈5%) |

About 60% of the Conflicts were caught by the pigeonhole check before any search.

**Hand-made cases** (`cases.mjs`):

| Case | Result | Time |
|---|---|---|
| 11 mutually-Apart, 10 Groups of 4, plus 30 other Apart rules | Conflict (quick check); minimal set = the 55 clique rules | 0.4 ms; explanation 28 ms |
| Odd wheel W5 (needs 4 Groups, largest clique 3), 3 Groups | Conflict found by search; minimal set = the 10 wheel rules | 0.15 ms; 3 ms |
| 11 Clusters of 3, 10 Groups of 4 | Conflict; minimal set = 11 Clusters | 0.3 ms; 1.5 ms |
| 25 Present at Target size 2 (12×2+1×3), two Clusters of 3 | Conflict; minimal set = the 2 Clusters | <0.1 ms |
| One Student Apart from all others, Groups of 2 | Conflict; minimal set = 39 rules | 0.1 ms; 16 ms |
| 10 mutually-Apart + Clusters, 10 Groups of 4 (tight) | Groups found | 0.3 ms |

**Spread** (`uniform.mjs`): every valid grouping was enumerated exactly and 60k Shuffles were drawn. A chi²/df close to 1 means the result cannot be told apart from uniform.

| Method | A (63 valid) | B (24 valid) | C (28 valid) |
|---|---|---|---|
| Rejection sampling (exact) | 1.11 | 0.99 | 0.97 |
| Backtracking only | 166 | 1114 | 85 |
| + 200 single-block swaps | 1.14 | 0.57 | **19.5** |
| + 200 set swaps (recommended) | 0.79 | 0.53 | 0.86 |

**At 40 Students** (`scale.mjs`), the rate at which each pair of Students shares a Group was compared with exact rejection sampling over 20k Shuffles. With 100 or more set swaps, the mean difference fell to the sampling-noise floor (about 0.002, against a base rate of 0.077), at about 0.17–0.27 ms per Shuffle.

## How the algorithm handles the open edge-case decisions (not decided here)
- **Cluster larger than the Target size, or larger than every Group:** *(a)* Conflict, which is what the prototype does with the `cluster-too-big` check; *(b)* adjust the Split first so that one Group grows to fit the Cluster, then search as normal, since the solver takes any Split; *(c)* treat an oversize Cluster as a soft preference, which is outside this design because every Rule here is strict.
- **Cluster partly Absent:** only the Present members form the block, so this works as is.
- **Cluster or Apart pair cut by a Lock:** this is reported as a Conflict at the moment. The alternatives are to refuse the Lock when it is made, or to ignore the affected Rule for that Reshuffle. Both are a single branch in `prepare`.
- **Locked Group that no longer matches a Split size** (for example, someone in it became Absent): the prototype reports `lock-not-in-split`. A product decision is needed.
- **Which Rules to blame first:** QuickXplain takes a preference order. This could be "newest Rule first" or "Apart before Cluster".

## Sources
- Junker, U. *QUICKXPLAIN: Preferred Explanations and Relaxations for Over-Constrained Problems.* AAAI 2004, 167–172. https://mlanthology.org/aaai/2004/junker2004aaai-quickxplain · https://dblp.uni-trier.de/rec/conf/aaai/Junker04.html
- Marques-Silva, J. *Minimal Unsatisfiability: Models, Algorithms and Applications.* ISMVL 2010 (deletion-based and other MUS algorithms).
- Gomes, C., Selman, B., Crato, N., Kautz, H. *Heavy-Tailed Phenomena in Satisfiability and Constraint Satisfaction Problems.* J. Automated Reasoning 24 (2000) 67–100. https://www.cs.cornell.edu/gomes/pdf/2000_gomes_jar_phenomena.pdf
- Brélaz, D. *New methods to color the vertices of a graph.* CACM 22(4), 1979 (DSatur).
- Haken, A. *The intractability of resolution.* Theoretical Computer Science 39 (1985) 297–308 (pigeonhole lower bound).
- Hastings, W. K. *Monte Carlo sampling methods using Markov chains and their applications.* Biometrika 57(1), 1970.
- Jerrum, M., Valiant, L., Vazirani, V. *Random generation of combinatorial structures from a uniform distribution.* Theoretical Computer Science 43 (1986).
- Ermon, S., Gomes, C., Selman, B. *Uniform Solution Sampling Using a Constraint Solver As an Oracle.* UAI 2012. https://arxiv.org/abs/1210.4861 (heavier solver-based near-uniform sampling; not needed at our scale)
- Meteor `logic-solver` README (MiniSat via Emscripten; "no guarantee of which solution is found"; MIT). https://github.com/meteor/logic-solver
- MiniZinc JavaScript docs (WebAssembly build for browsers, worker-based). https://js.minizinc.dev/docs/stable/ · https://docs.minizinc.dev/en/2.9.4/javascript.html
