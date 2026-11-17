# A Levy's `due` graph must read a tally the Scenario supplies

Status: accepted

ADR 0002 made the Levy graph a public, versioned API, and ADR 0009 kept `Scenario.schemaVersion`
at 4 because both of its additions only widened what `check()` accepts. `check()` guarded two
ends of the Tally label join: a label on a Flow or an Account with no Levy (`LEVY_REQUIRED`), and
a Carry-in tally no Measure reads (`UNKNOWN_TALLY_LABEL`). The two directions that decide whether
a Levy can owe anything were unguarded. A salary income Flow with no `label` beside a Levy that
sums `salary` gave `due: 0`, `settled: true` and `check() === []`: the graph read a label nothing
supplied, every total it computed was 0, and the Projection reported a settled zero instead of a
plan missing its labels. For a Thai filer the answer is not "you owe nothing"; it is "the plan
never said what to tax". The CLI's own writer refuses unlabelled income, so the exposed path is a
restored, hand-edited or other-tool-authored document, which cli ADR-0024 validates with
`check()` alone.

## Decision

- **The rule.** For each Levy, walk the Measures reachable from `due` over the reference keys
  `a`, `b`, `of`, `then` and `else` (first declaration of an id winning, as the graph check
  indexes them), collect the `(label, basis)` pairs its `tally` Measures read, and report
  `UNSUPPLIED_TALLY_LABEL` at `scenario.levies[i]` when that set is non-empty and no pair in it
  is supplied by the Scenario. One problem per Levy: the predicate is existential, so every
  Measure in an unsupplied graph shares one root cause.
- **Supply is what the engine tallies.** An income Flow's `label` supplies `gross`, a
  contribution Flow's `label` supplies `funded`, an asset Account's `returnLabel` supplies
  `returns` and its `gainLabel` supplies `gains`. Flow and Account labels count for every Levy,
  because the engine tallies them into every one; a Carry-in record counts only for its own
  Levy, and only when its period start is strictly before `timeline.start`, because the engine
  ignores a record for a period that starts at or after the start. The rule therefore reads the
  Timeline start as well as the Scenario, like the Carry-in requirement check.
- **Existential, not universal.** Only a Levy that reads tallies and receives none is refused. A
  graph that reads one supplied label and one optional one stays valid: an RMF allowance on a
  `funded` tally that a saver without RMF savings does not supply, a care credit for a filer with
  no care expense, a rental-income class a filer does not have. Requiring every pair would refuse
  exactly the Scenarios the label model exists for, and GLOSSARY.md's meaning of the label is
  narrower than that: a label no Flow or Account carries is a tally of zero, which is how
  sheltering and absence are expressed.
- **The `due` closure, not every `tally` Measure.** A Levy may declare a tally for the period
  report while its `due` is a `const` 0; only a label the amount owed depends on can make the
  answer silently wrong.
- **A new code.** `UNSUPPLIED_TALLY_LABEL` joins the closed vocabulary.
  `UNKNOWN_TALLY_LABEL` keeps its meaning of "supplied but never read" at a Carry-in path; one
  code carrying two opposite directions would make a caller's message lookup ambiguous.
- **`Scenario.schemaVersion` stays 4.** No key is added or removed, and every Scenario the rule
  accepts keeps exactly its numbers and its meaning. The narrowing changes the outcome only for
  Scenarios whose answer was already wrong. This is ADR 0009's precedent read from the other
  side: a change that cannot alter a correct Scenario's numbers does not move the version.
- **Silent on input it cannot read.** A missing `due`, a `measures` value that is not an array,
  an unknown reference or an invalid op is reported by the existing shape and graph checks; the
  new rule emits nothing rather than stacking a second problem on a graph it cannot walk. The
  walk uses index access and a visited set, so a `MEASURE_CYCLE` cannot loop and an array whose
  iteration methods lie cannot throw.

## Considered options

- **Require every `(label, basis)` pair the graph reads.** Rejected: it refuses a filer who
  legitimately has no rental income, no RMF savings or no care expense, which the Idea explicitly
  rules out and which the Thai and US shaped Levies need.
- **Require any labelled Flow anywhere in the Scenario.** Rejected: with several Levies, one
  supplied Levy does not make another one's graph live.
- **Reuse `UNKNOWN_TALLY_LABEL`.** Rejected: opposite direction, and a caller matching on the
  code would have to disambiguate by path.
- **Emit one problem per unsupplied `tally` Measure.** Rejected: when nothing is supplied every
  Measure in the graph is unsupplied, so the output repeats one cause; `MISSING_CARRY_IN` already
  reports at Levy level.
- **Count every Carry-in record as supply whatever its period.** Rejected: the engine ignores a
  record for a period that starts at or after `timeline.start`, so counting it would let a graph
  with no live supply through.
- **Check `cappedPrepayment` labels too.** Not this rule: the cap reads the Flow's own label's
  period-to-date gross, so that label is not a no-op, and the shape is documented and tested as
  accepted.
- **Bump `Scenario.schemaVersion` to 5.** Rejected: nothing in the data shape changes, and a bump
  would make every caller migrate to learn one rule.

## Consequences

- A Scenario whose Levy graph read no supplied tally now fails `check()` with
  `UNSUPPLIED_TALLY_LABEL` at that Levy, and `project()` returns the problems instead of a
  Projection: the silent settled zero is gone.
- A stored document written under an older pin can carry such a graph. cli ADR-0024 restores it
  through `check()` alone, so a restore may now report the problem and need one `label` added.
- No projected number changes for any Scenario that validates, so the recorded parity hashes stay
  valid and no `parity:update` is needed.
- The check-test fixtures gain a supplied tally by default, and a test that builds its own Flows
  under a Levy labels the Flow it tallies. The rule's own cases cover both directions of the join
  and every legitimate shape above.
- A label that only a `cappedPrepayment` reads, and a `tally` Measure no `due` graph reads, remain
  accepted. A lint for either is a separate decision.
