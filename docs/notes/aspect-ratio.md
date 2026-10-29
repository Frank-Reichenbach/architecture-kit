# Aspect ratio of rendered diagrams

**Rule of thumb:** aim for an image that is about 2:3 or 3:2 (height:width), i.e. the long side about 1.5 to
1.6 times the short side. Either orientation is fine. It's a preference, not a requirement: when the content
doesn't fit, a readable diagram beats a well-proportioned one.

## Target ratios

| Ratio (short:long) | Long ÷ short | Where it comes from |
|---|---|---|
| 1 : φ ≈ 1 : 1.618 | 1.618 | Golden ratio, φ = (1 + √5) / 2 |
| 5 : 8 | 1.600 | Consecutive Fibonacci numbers, a practical stand-in for φ |
| 8 : 13 | 1.625 | Next Fibonacci pair; ratios of neighbours converge on φ (3:5, 5:8, 8:13, …) |
| 2 : 3 | 1.500 | 35 mm photo / classic print format; close to φ and easy to reason about |
| 1 : √2 | 1.414 | ISO paper (A4); a little squarer, still pleasant |
| 9 : 16 | 1.778 | Screens; noticeably more stretched |

Anything from about 1.4 to 1.8 looks balanced. Much flatter (≥ 2.5, a "banner") or much taller (a "scroll")
starts to feel awkward and is harder to read on a screen.

## How strong is the evidence?

- **Fechner (1876)** ran the first experiment on rectangles. People liked the golden rectangle and its
  neighbours best, which launched the golden-ratio aesthetics claim.
- **Replications are mixed.** Lalo (1908) reproduced the peak, but 27 % of participants liked the extremes best.
  Godkewitsch (1974) and Piehl (1976) argued that the effect is an artifact of the stimulus range and how
  preference was measured. Boselie (1992) found no greater preference for φ than for 1.5:1.
- **McManus et al. (2010)** found the group-level preference for the golden section to be *weak*. Individual
  preferences were strong and stable, but very different from person to person.

**Takeaway:** people tend to like moderately elongated rectangles. There's no special pull to exactly 1.618,
and 2:3, 3:2, 5:8 and φ are all equally good targets: good to know, but not always achievable.

## How `architecture-kit render` applies it

`lib/d2.mjs` renders each deployment/network view in two layouts (twins side by side vs. stacked, or both
flow directions) and keeps the one whose ratio is closest to *any* of 5:8, 2:3, 3:2, 8:5. The render log prints
the chosen layout and its height:width. If neither layout comes close, the closer one still wins; the rule never
blocks a render, and it never overrides layout rules that keep a diagram correct and readable (identical twins,
no lines through boxes).

## Sources

- Phillips, Norman et al. (2010), *Fechner's aesthetics revisited*:
  [paper (PDF)](https://www-prod01.wku.edu/psychological-sciences/labs/vision_and_haptics/downloads/phillips_norman_aesthetics2010.pdf),
  [summary](https://flipphillips.com/bloggery/fechners-aesthetics-revisited/)
- Green (1995), *All that glitters: a review of psychological research on the aesthetics of the golden section*,
  Perception 24: [journals.sagepub.com/doi/10.1068/p240937](https://journals.sagepub.com/doi/10.1068/p240937)
- Review of golden-ratio preference studies (Fechner, Witmer, Lalo, Boselie, McManus):
  [uv.es (PDF)](https://www.uv.es/revispsi/articulos2.16/5Vico.pdf)
- Golden ratio and Fibonacci approximations (5:8, 8:13) in layout practice:
  [madegooddesigns.com](https://madegooddesigns.com/golden-ratio-design/)
