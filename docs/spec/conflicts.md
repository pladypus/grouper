# Conflicts (#4)

When a Shuffle hits a Conflict, no Groups change. The board shows a red notice:

- **A plain sentence first.** Quick checks and the [Shuffle rules](shuffle-rules.md) checks produce their own sentence:
  - `chain-too-big`: "Ana, Dee and Eli are joined by Good pairs, so they need a group of 3, but the number in each group is 2."
  - `apart-clique`: "These 11 students must all be kept apart, but there are only 10 groups: Ana, Ben, …"
  - chain cut by a Lock, lone Leftover: as in [Shuffle rules](shuffle-rules.md).
  - found by search: "No way to make 2 groups of 4 and 3 groups of 5 keeps every pair."
- **"Show the Rules involved"** expander listing the clashing Pairs (for a quick check, the Pairs behind it: the chain's Good pairs, the clique's Keep apart pairs). Each Pair links into the Pairs drawer with that Pair highlighted, to edit or delete.
- No "ignore for this Shuffle", no Rule on/off switch.
