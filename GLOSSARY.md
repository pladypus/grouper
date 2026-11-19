# Glossary

**Teacher**: The person using the site. Each teacher's data is private to them unless they export it.

**Roster**: A named, saved list of Students together with its Rules (e.g. "Period 2"). A Teacher can keep several.

**Student**: A person on a Roster.

**Present / Absent**: A Student's attendance for the current Shuffle. Absent Students are left out of Groups but stay on the Roster, and their Rules are kept.

**Group**: A set of Present Students produced by a Shuffle. Groups are temporary: they last only while the page is open and are not saved with the Roster. After the Roster changes, the Groups on screen stay as they are but are out of date until the next Reshuffle.

**Target size**: The Group size the Teacher asks for. The Present Students are split into Groups of that size.

**Leftovers**: The Present Students who don't divide evenly by the Target size. They join existing Groups, making some Groups bigger than the Target size, never smaller. A Group never has just one Student.
_Avoid_: "group count" (the number of Groups follows from the Target size, not the other way round)

**Split**: The list of Group sizes derived from the Target size and the Present count (e.g. 25 Present at Target size 2 → 12×2 + 1×3). The Teacher may edit it.

**Rule**: A strict constraint on a Roster. Rules are never broken by a Shuffle. There are two kinds:
- **Apart rule**: two Students who must never share a Group.
- **Cluster**: a named set of Students who must all share one Group. When some members are Absent, the Present members still share one Group. A Cluster bigger than the Target size is a Conflict.

**Conflict**: When the Rules, the Split and the Present Students cannot all be satisfied together. Reported to the Teacher; no Groups are produced.

**Shuffle**: Randomly producing Groups that satisfy every Rule. **Reshuffle** repeats it, keeping Locked Groups.

**Lock**: Pinning a Group so a Reshuffle leaves it unchanged. A Locked Group is frozen: no Manual move can go into or out of it until it is unlocked. A Student who becomes Absent drops out of a Locked Group, and the Lock is released if only one Student would remain.

**Manual move**: The Teacher swapping two Students between Groups after a Shuffle, by dragging one onto the other or by tapping one and then the other. Group sizes never change. A Manual move may break a Rule; it is allowed, and the Groups involved are flagged.
_Avoid_: "drag" (dragging is only one way to make a Manual move)

**Export / Import**: Saving a Roster to a file and loading it back, for backup or for handing it to another Teacher.
