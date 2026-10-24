# Competitor Teardown

Hands-on notes from testing. The bar to beat: typing the hand into Notepad. Target: a full hand in 10–15 seconds.

## Fastroll — tested 2026-10-23

**Verdict:** Deleted. Slower than Notepad. Too much I don't need, hard to enter hands, hard to get data out.

- Liked: hero fixed at the bottom; single big blind ante toggle; action buttons on every seat; Raise opens sizing straight away; sizes follow the blind level; 000/K toggle.
- Disliked: account required; upsell clutter; SB 600 doesn't auto-fill BB 1,200; three ways to place the button; odd default stacks and a hard-to-find "adjust all stacks"; unintuitive card picker; equity tools; hard to export.

## HandRecorder — tested 2026-10-23

**Verdict:** Deleted. Never got as far as logging a hand.

- Disliked: can't start a tournament session without price, pool entry and rake; confusing structure presets ("T20K 30 min"); asks for starting position; upsells.

## Pokerscope — tested 2026-10-23

**Verdict:** Best of the three, but still not a pure hand tracker. Lots of extra features, and missing a few things we need.

- Liked:
  - No login.
  - Typing 1,000 fills in 1,000/2,000 + 2,000 ante.
  - Drag the dealer button onto a seat.
  - Flow goes straight to hero's cards after the button.
  - Slider for raise sizes.
  - Tap a seat to change an action you misremembered.
  - Scroll between streets and actions to edit them.
- Disliked:
  - Home screen tutorial.
  - Asks which seat hero is in.
  - Can't empty a single seat; you have to switch the whole table between 8-max and 7-max.
  - Card picker takes two taps (suit, then rank) and scrolls.
  - Typed bet amounts don't work (can't enter 4.2k), so you're forced to use the slider.
  - Low contrast between states.
  - Table graphic too big.
  - Street/action scroller too small and hard to find.

## Design ideas from testing

Things you liked or proposed, worth carrying into our design:

1. **Empty seats, not table size.** Tap a seat to grey it out (on a walk, not seated yet). It stays there until someone sits. The table max never changes.
2. **One-tap card grid.** All 52 cards at once: 4 rows (one per suit) × 13 ranks. One tap per card, no scrolling.
3. **Bet entry that fits the stakes.** Slider *and* a number pad that both work. Units scale with the level (hundreds early, then K, then hundreds of K deep in a tournament). Typing 4.2k must work. Test whether typing or sliding is faster.
4. **Fix mistakes in place.** Tap any recorded action to change it, and drag an action to a different seat if it went to the wrong player.
5. **Blinds auto-fill.** Small blind sets the big blind (and ante); only ask when it's ambiguous.
6. **Drag the button** onto its seat.
7. **Hero fixed at the bottom.**
8. **Big, obvious street/action scroller** for jumping back to edit.
9. **Compact table** with strong contrast between active, folded and empty seats.
10. **No login, no tutorial, nothing required before the first hand.**
11. **Easy plain-text export.**
