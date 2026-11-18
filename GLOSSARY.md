# Glossary

**Teacher**: The person using the site. Each teacher's data is private to them unless they export it.

**Roster**: A named, saved list of Students together with its Rules (e.g. "Period 2"). A Teacher can keep several.

**Student**: A person on a Roster.

**Present / Absent**: A Student's attendance for the current Shuffle. Absent Students are left out of Groups but stay on the Roster, and their Rules are kept.

**Group**: A set of Present Students produced by a Shuffle.

**Target size**: The Group size the Teacher asks for. The Present Students are split into Groups of that size, with **Leftovers** absorbed by adjusting some Groups' sizes.
_Avoid_: "group count" (the number of Groups follows from the Target size, not the other way round)

**Split**: The list of Group sizes derived from the Target size and the Present count (e.g. 25 Present at Target size 2 → 12×2 + 1×3). The Teacher may edit it.

**Rule**: A strict constraint on a Roster. Rules are never broken by a Shuffle. There are two kinds:
- **Apart rule**: two Students who must never share a Group.
- **Cluster**: a named set of Students who must all share one Group.

**Conflict**: When the Rules, the Split and the Present Students cannot all be satisfied together. Reported to the Teacher; no Groups are produced.

**Shuffle**: Randomly producing Groups that satisfy every Rule. **Reshuffle** repeats it, keeping Locked Groups.

**Lock**: Pinning a Group so a Reshuffle leaves it unchanged.

**Manual move**: The Teacher dragging a Student from one Group to another after a Shuffle.

**Export / Import**: Saving a Roster to a file and loading it back, for backup or for handing it to another Teacher.
