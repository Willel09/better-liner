# Lumen

En musikspelare för desktop: Tauri (Rust) + React/TypeScript, Liquid Glass-design, AI-funktioner via Mistral eller DeepSeek.

## Så fungerar den

1. **Sök** på YouTube via det officiella YouTube Data API (din egen nyckel).
2. **Spela** via YouTubes officiella inbäddade spelare, styrd av Lumens egen spelarmotor: kö, crossfade, Smart Shuffle, miniplayer. Spelaren syns som ett videokort i sidomenyn, och stort på Spelas nu, eftersom YouTubes villkor kräver att den är synlig.
3. **Lyrics** hämtas från LRCLIB, rad- och ordsynkade.
4. **Importera** spellistor från Spotify och Deezer via länk, eller från Apple Music, SoundCloud m.fl. genom att klistra in låtlistan som text. Låtarna sparas som titel + artist och matchas mot YouTube först när de ska spelas, så en import kostar ingen API-kvot.
5. **Lokala filer** spelas där de ligger. Rust räknar ut exakt BPM och ljudstyrka från ljudet.

**Ingenting laddas ner.** All musik strömmas. Lokalt sparas bara metadata (bibliotek, statistik, cache för sökträffar och AI-svar), vilket blir några MB.

## Funktioner

- **Smart Shuffle:** samma artist kommer inte tillbaka för tätt, inga dubbletter, nyss spelade låtar hamnar sist, och lägen för genre, stämning och tempo.
- **Crossfade:** 0–12 s med en övergångskurva utan volymhål. Hoppas över mellan låtar på samma album. Automatisk volymanpassning för lokala filer.
- **Miniplayer:** eget fönster som alltid ligger överst, med omslag, titel och kontroller.
- **AI:** spellistebyggare, stämning, genre och BPM, liknande låtar, upptäckter, AI DJ (jämna övergångar i tempo och energi, med valfri uppläsning), lyssningsassistent, Smart Radio och Music DNA.
- **Sidor:** Hem, Upptäck, Bibliotek, Spellistor (vanliga, smarta och AI-skapade), Artister, Album, Spelas nu, AI Studio, Statistik och Inställningar.
- **Spotify-liknande extrafunktioner:** insomningstimer, equalizer (lokala filer), "Dölj låt", "Spela inte artisten", privat lyssning, Daily Mix och stämningsmixar, sortering och filter, Discord-status.

## Kom igång

Kräver Rust, Node 22+ och pnpm (på Linux även `libwebkit2gtk-4.1-dev`).

```bash
pnpm install
pnpm dev          # utvecklingsläge
pnpm test         # frontend-tester
pnpm test:rust    # Rust-tester
pnpm dist         # bygg installationsfil för ditt OS
```

Lägg sedan till nycklar under **Inställningar → Integrationer**:
- **YouTube Data API v3:** gratis i Google Cloud Console. Ungefär 100 nya sökningar per dag ingår.
- **AI:** en nyckel från Mistral (console.mistral.ai) eller DeepSeek (platform.deepseek.com). Fungerar också med andra OpenAI-kompatibla API:er.
- **Spotify** (valfritt, för import): Client ID och Secret från developer.spotify.com.

Nycklarna sparas i appens konfigurationsmapp och används bara av Rust-delen. Gränssnittet ser aldrig deras värden.

## Struktur

```
src-tauri/src/   config (nycklar), db (SQLite: statistik + cache), youtube (sök), ai (chat-API),
                 import (Spotify/Deezer), local (filer + taggar), analysis (BPM/ljudstyrka)
src/lib/         api-lager, matchning, Smart Shuffle, AI-funktioner, LRC-parser, YouTube-spelare
src/store/       spelarmotor (två spår för crossfade), bibliotek, inställningar
src/views/       de tio sidorna
```
