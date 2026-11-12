# 100 years of Western fashion trends

The dataset behind Day 9: about 400 Western fashion trends from the 1920s to today, when each was in style, when it came back, and the evidence for it from books, museums and catwalks. It's high fashion as much as street style: what was in, not what everyone wore.

Everything ends up in one static file, `public/nerds-of-fashion/fashion.json`, which the site serves as is. There's no backend.

## What's in the file

- `meta`: title, years covered, region names, sources with licences and credits, and caveats.
- `trends`: one entry per trend with its name, aliases, category, gender, regions, periods, a short description and up to three Wikipedia quotes. Each also has its Ngram curves (aligned to `series.ngramYears`), sparse yearly `counts` from the V&A, the Met and Vogue Runway where `mappings.json` links it to them, and up to six V&A objects with images as `examples`.
- `revivals`: when a trend (or a whole era, when `trend` is null) came back, with the quote that says so.
- `series`: totals to normalise against: V&A and Met objects per decade, and runway looks per year.
- `colours`: Pantone's Colours of the Year, and colour words found in V&A descriptions per decade.

Years are integers. Regions are `UK`, `US`, `FR`, `IT` or `global`.

## Sources

| Source | What it gives | Licence | Credit |
| --- | --- | --- | --- |
| Wikipedia | Trends, dates, regions, quotes and revivals from the decade in fashion and subculture articles | CC BY-SA 4.0 | Wikipedia contributors |
| Google Books Ngram | How often each trend's phrases appear in British and American books, 1920 to 2022 | CC BY 3.0 | Google Books Ngram Viewer |
| V&A | About 6,500 womenswear objects with type, designer, place, materials, colours and images | Data free to reuse, images non-commercial with credit | © Victoria and Albert Museum, London |
| The Met | About 18,000 Costume Institute objects counted by name and year | CC0 | The Metropolitan Museum of Art Open Access |
| Vogue Runway | Share of catwalk looks with each auto tag, 1988 onwards | None stated, so only counts are kept | Vogue Runway, via the ROSCOSMOS dataset on Hugging Face, tags by AWS Rekognition |
| Pantone | Colour of the Year since 2000 | CC BY-SA 4.0 (via Wikipedia) | Pantone |

## Folders

- `scripts/`: one script per step. Node with no dependencies, plus one Python script run through `uv`.
- `parts/`: one pretty-printed JSON file per source. Committed, so any step can be rerun or edited by hand.
- `raw/`: downloads and caches. Gitignored, and about half a gigabyte once everything has run.
- `mappings.json`: which museum objects and runway tags count as evidence of each trend.

## Rebuilding

Run these from the repo root, in order. Each step caches what it downloads in `raw/`, so a rerun only fetches what's missing.

```sh
node datasets/fashion/scripts/fetch-wikipedia.mjs "1920s in Western fashion" "1930s in Western fashion" "1940s in Western fashion" "1950s in Western fashion" "1960s in fashion" "1970s in fashion" "1980s in fashion" "1990s in fashion" "2000s in fashion" "2010s in fashion" "2020s in fashion" "Athleisure" "Britpop" "Cottagecore" "Disco" "Flapper" "Glam rock" "Goth subculture" "Grunge fashion" "Hippie" "Indie sleaze" "Mod (subculture)" "New Romantic" "Normcore" "Preppy" "Punk fashion" "Rave" "Skinhead" "Teddy Boy" "Y2K aesthetic"
node datasets/fashion/scripts/build-wiki-1920s-1950s.mjs
node datasets/fashion/scripts/build-wiki-1960s-1980s.mjs
node datasets/fashion/scripts/build-wiki-1990s-2020s.mjs
node datasets/fashion/scripts/normalise-trends.mjs
node datasets/fashion/scripts/fetch-ngram.mjs
node datasets/fashion/scripts/fetch-vam.mjs
node datasets/fashion/scripts/reduce-met.mjs
uv run --with duckdb python -I datasets/fashion/scripts/reduce-runway.py
node datasets/fashion/scripts/fetch-pantone.mjs
node datasets/fashion/scripts/assemble.mjs
```

The three `build-wiki` scripts turn hand-written extractions (the `.spec.txt` files and the table inside `build-wiki-1960s-1980s.mjs`) into rows, copying each quote word for word from the cached article. `normalise-trends.mjs` merges those rows into canonical trends and revivals using the trend table inside it. `fetch-vam.mjs --offline` rebuilds the V&A part from the cache without any requests.

`assemble.mjs` is deterministic: the same parts and mappings give the same bytes. It prints a warning for any mapping that points at a type, name or tag that doesn't exist, and for any part that's missing.

## Extending it

- **Link a trend to museum or runway evidence:** add or edit its entry in `mappings.json`, then run `assemble.mjs`. The `about` block at the top explains the rule format. Keep it conservative: map a type only when it clearly is the trend.
- **Add or change a trend:** edit the trend table in `normalise-trends.mjs` (or the extraction it reads), rerun it, then `fetch-ngram.mjs` for any new phrases, then `assemble.mjs`.
- **Add a source:** write a script that saves a new file in `parts/`, then teach `assemble.mjs` to read it and add it to `meta.sources`.

## Caveats

- It's mostly high fashion from books, encyclopaedias and museums, not what everyone wore.
- Museums collect couture, famous names and whatever survived. Their counts show what got collected, not what was popular, and they thin out after 2000.
- Books trail clothes, so Ngram curves often peak years after a look was in the shops. Some phrases also mean other things (Paisley the town, Cardigan the earl), so compare the shape of a curve, not its height. The newest micro trends have no curve at all.
- Runway counts start in 1988 and are thin before 2000. They're auto tags, and the tagging changed over the years too. Years with fewer than 100 looks are left out.
- Museum dates pile up on round years, because an object dated to a decade gets its first year. Group by decade before reading much into a single year.
- A few periods and revival originals start before 1920, so clamp them to the timeline.
- The scope is Western: the UK, the US, France and Italy, plus looks not tied to one place.
