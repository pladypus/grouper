# Shuffle rules (#2, #4, #5)

A Shuffle (first time) or Reshuffle (Groups exist) produces Groups that satisfy **every** Rule among Present Students, or reports a Conflict and leaves the screen's Groups unchanged.

Inputs: Present Students, the Roster's Pairs, the Target size, the Teacher's edited Split (if any), and the current Locked Groups.

1. **Locks first.**
   - Drop Absent or deleted Students from each Locked Group. If a Locked Group would be left with one Student, release that Lock and put the Student back in the pool. Toast: "Lock released: Ana would have been alone in a Locked Group."
   - Locked Groups keep their members and size exactly.
2. **Split for the rest.** The free pool is every Present Student not in a Locked Group.
   - With no Locks, use the Teacher's edited Split if there is one and it still sums to the Present count; otherwise the derived Split.
   - With Locks, re-derive the Split for the free pool from the Target size (a hand-edited Split is redone for the unlocked part).
   - A free pool of exactly 1 Student is a Conflict ("Only Ana is left outside the Locked Groups, and a group of 1 isn't allowed. Unlock a Group or mark someone else Present."). A free pool of 0 is fine.
3. **Rules across Locks.**
   - Keep apart: a free Student is never placed in a Locked Group (automatic, since Locked Groups don't change), so these always hold.
   - A chain with some Present members Locked and some free is a Conflict naming the Lock and the chain ("Ana is in Locked Group 2, but Dee, linked to Ana by a Good pair, isn't. Unlock Group 2 or delete the pair.").
   - A Rule broken *inside* or *between* Locked Groups (a flagged Group the Teacher Locked) is carried over unchanged, still flagged. It is not a Conflict. (Choice, cheap to change: the research prototype reported `apart-inside-lock`; #5's "a flagged Group can be Locked and Reshuffle carries it over unchanged" overrides it.)
4. **Solve** the free pool into the free Split with the [solver](solver.md).
5. **Result.** Locked Groups keep their place and colour (choice, cheap to change); new Groups fill the remaining positions in order. Groups are numbered by position (Group 1, Group 2 …). The out-of-date notice and any Manual-move flags on unlocked Groups clear.
