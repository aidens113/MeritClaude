---
name: model-sees-whole-page
scope: family
description: On FluxIQ, the model gets a compact view of every visible-text or interactive element plus a search over the rest; no caps or ranking, and never raw element JSON.
origin: FluxIQWebExtension and FluxIQ Core, 2026-09-30 (revised the same night)
---

# The model sees the whole page, compactly

Aiden first ordered: "Remove ANY AND ALL LIMITS ON THE NUMBER OF ELEMENTS PASSED TO MODEL. DO NOT HIDE INFORMATION OR USE
ANY RANKING ALGORITHM." It was implemented as raw JSON of every element with every attribute and a pixel box: 340 KB,
113k tokens, for one results page. He rejected that: "ITS NOT SUPPOSED TO FEED IN THE ENTIRE PAGE JUST RAW", "theres
literally no fucking reason it should be 500kb". He then gave the design: give the model "elements that have visible
text/buttons/etc with the least possible data in terms of format", and let it "search the page for certain things by
visible or any other text (id, class, name, etc)".

He approved this format ("looks perfect. Its very small"):

- a header naming the page, its URL, the viewport, and any covering layers;
- region lines such as `[main]`, and `- i/n` markers for repeated items;
- one line per visible element that has its own words or is a control: `<handle> <kind> "<words>" <state>`, with links
  on a short base URL;
- `find_on_page`, matching any text or attribute, hidden elements included, with results paged explicitly;
- `describe`, for one element's full detail.

Words are never repeated: a title already shown as the link does not appear again as the heading or the image's alt text.
Most pages cost 1k-2.5k tokens, and a dense results page about 7k.

There are still no element caps, top-N, ranking, or silent truncation among the qualifying elements; search keeps
everything else reachable. Secret screening and the per-build spend ceiling stay. Every path that shows the model an
element uses the compact form, never attribute or box JSON: page looks, refusals, failure evidence, recovery, and
earlier pages in the history.

Why: the model needs complete information, but at a size it can read and afford. A raw dump wastes tokens and money,
overflows the context window as history accumulates, and hides the signal in noise. Measure the bytes per page whenever
this area changes; a page in the hundreds of kilobytes is a defect.
