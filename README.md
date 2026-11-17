# Lumen

En musikspelare för desktop med synkade lyrics, reaktiva visuals och ett Liquid Glass-gränssnitt. Byggd med Electron, React och Vite.

## Funktioner

- **Strömning** från Audius öppna katalog: hem med trendande låtar per genre, populära spellistor, sök (låtar, artister, album), artist- och albumsidor
- **Lokala filer**: importera mappar eller filer, med taggar och omslag via `music-metadata`
- **Bibliotek**: gillade låtar, egna spellistor (skapa, byt namn, radera, sortera med drag), sparade album, följda artister, senast spelat
- **Offline**: ladda ner låtar, album och spellistor; spelas från disk
- **Spelare**: kö med drag-sortering, spela härnäst, blanda, upprepa (alla/en), övertoning, volymutjämning
- **Lyrics** från LRCLIB: radsynk, ordsynk när det finns, klicka på en rad för att hoppa dit, justerbar förskjutning
- **Helskärmsläge** med bakgrund som pulserar med musiken (färger från omslaget, Web Audio-analys)
- **Miniplayer**: flytande fönster som alltid ligger överst
- **Systemintegration**: mediatangenter och Now Playing (Media Session), Discord-status, Touch Bar, `lumen://`-djuplänkar
- **Kortkommandon**, svenska/engelska, system/mörkt/ljust tema, sex accentfärger

## Kom igång

Kräver Node 22+ och pnpm.

```bash
pnpm install
pnpm dev        # Vite + Electron
pnpm test       # enhetstester
pnpm dist:mac   # eller dist:win / dist:linux
```

## Struktur

```
electron/   main.cjs (fönster, lokala filer, nedladdningar, overlay, Discord), preload.cjs
src/lib/    Audius-klient, LRC-parser, lyrics, i18n
src/store/  spelare, bibliotek, inställningar, router, bridge till huvudprocessen
src/components/, src/views/   UI
```

Discord-status kräver ett klient-ID från en egen app på discord.com/developers. Klistra in det under Inställningar → Discord-status.
