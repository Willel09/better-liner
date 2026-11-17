# Echo

En musikspelare för Windows och Mac: Tauri (Rust) + React/TypeScript, Liquid Glass-design och AI-funktioner via valfri AI-leverantör.

## Så fungerar den

1. **YouTube Music, ingen nyckel:** klicka på *YouTube Music* i sidomenyn och logga in med ditt Google-konto. Den riktiga music.youtube.com öppnas i ett Echo-fönster. Det som spelas där syns i Echos spelarfält, Spelas nu (med lyrics), statistiken, miniplayern och Discord, och Echos knappar styr det.
2. **Bara omslag, ingen video.** Allt från YouTube spelas i YouTube Music-fönstret, som kan ligga minimerat. Echo visar album- och låtomslag, och Echos kö, Smart Shuffle, Smart Radio och AI-listor bestämmer vad som spelas.
3. **Valfritt: YouTube Data API-nyckel.** Med en nyckel kan Echo själv hitta låtarna på YouTube, så att importerade spellistor och AI-förslag spelas automatiskt. Utan nyckel öppnas sökningen i YouTube Music och du klickar själv på låten.
4. **Lyrics** hämtas från LRCLIB, rad- och ordsynkade.
5. **Importera** spellistor från Spotify och Deezer via länk, eller från Apple Music, SoundCloud m.fl. genom att klistra in låtlistan som text. Låtarna sparas som titel + artist och matchas mot YouTube först när de ska spelas, så en import kostar ingen API-kvot.
6. **Lokala filer** spelas där de ligger. Rust räknar ut exakt BPM och ljudstyrka från ljudet.

**Ingenting laddas ner.** All musik strömmas. Lokalt sparas bara metadata (bibliotek, statistik, cache för sökträffar och AI-svar), vilket blir några MB.

## Funktioner

- **Smart Shuffle:** samma artist kommer inte tillbaka för tätt, inga dubbletter, nyss spelade låtar hamnar sist, och lägen för genre, stämning och tempo.
- **Crossfade:** 0–12 s med en övergångskurva utan volymhål, mellan lokala filer. Hoppas över mellan låtar på samma album. Automatisk volymanpassning för lokala filer.
- **Miniplayer:** eget fönster som alltid ligger överst, med omslag, titel och kontroller.
- **AI, valfri leverantör:** OpenAI, Anthropic (Claude), Google Gemini, Mistral, DeepSeek, Groq, OpenRouter, xAI, Together, lokala modeller via Ollama eller LM Studio, eller vilken OpenAI-kompatibel adress som helst. *Hämta modeller* listar leverantörens modeller. Funktioner: spellistebyggare, stämning, genre och BPM, liknande låtar, upptäckter, AI DJ (jämna övergångar i tempo och energi, med valfri uppläsning), lyssningsassistent, Smart Radio och Music DNA.
- **Sidor:** Hem, Upptäck, Bibliotek, Spellistor (vanliga, smarta och AI-skapade), Artister, Album, Spelas nu, AI Studio, Statistik och Inställningar.
- **Spotify-liknande extrafunktioner:** insomningstimer, equalizer (lokala filer), "Dölj låt", "Spela inte artisten", privat lyssning, Daily Mix och stämningsmixar, sortering och filter, Discord-status.

## Installera

Ladda ner från [Releases](https://github.com/Willel09/better-liner/releases/latest):

| System | Fil |
|---|---|
| Windows | `Echo_x.y.z_x64-setup.exe` (eller `.msi`) |
| macOS (Apple Silicon + Intel) | `Echo_x.y.z_universal.dmg`. Dra Echo till Program. |

Appen är inte kodsignerad (det kräver betalda certifikat från Apple och Microsoft), så första gången:
- **macOS:** högerklicka på Echo i Program → Öppna → Öppna. Säger macOS att appen är "skadad", kör `xattr -cr /Applications/Echo.app` i Terminal.
- **Windows:** klicka *Mer information → Kör ändå* i SmartScreen-rutan.

Därefter uppdaterar du via **Inställningar → Om Echo → Sök efter uppdatering**.

## Bygga själv

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
- **AI:** välj leverantör, klistra in nyckeln och tryck *Hämta modeller*. Lokala modeller (Ollama, LM Studio) behöver ingen nyckel.
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

## Releaser och uppdateringar

- Höj `version` i `src-tauri/tauri.conf.json` och pusha, pusha en tagg (`v0.4.0`) eller kör **Release** under fliken Actions. GitHub bygger Mac (universal) och Windows och lägger filerna i Releases.
- I appen: **Inställningar → Om Echo → Sök efter uppdatering** laddar ner den nya versionen och startar om appen.
- För att uppdateringsknappen ska fungera:
  1. Lägg den privata signeringsnyckeln som repo-hemligheten `TAURI_SIGNING_PRIVATE_KEY`. Den publika nyckeln finns redan i `src-tauri/tauri.conf.json`.
