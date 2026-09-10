# StudioTally Pro — PRD

## Original problem statement
Application mobile permettant d'utiliser plusieurs téléphones sur le même réseau WiFi comme systèmes de tally et pour faire du multi-cam centralisé pour OBS. Le système de tally/caméras doit aussi fonctionner en autonomie (sans OBS) et servir de système d'alarme discret : quand l'utilisateur joue sur son PC, sa femme peut l'appeler via un autre téléphone sans le déranger.

## User choices
- Connexion OBS via OBS WebSocket (v5).
- Multi-cam : flux vidéo caméra + tally (flux vidéo = build natif requis).
- Alarme configurable (son + vibration + flash).
- Mode autonome (WiFi/cloud) sans OBS.
- Thème sombre "studio/pro" (noir + rouge LIVE / vert PREVIEW / ambre brand).
- iPhone + Android.

## Architecture
- **Backend**: FastAPI + MongoDB. Sessions (code 5 car.), devices (soft-delete), ConnectionManager WebSocket. Endpoints REST `/api/sessions*` + WebSocket `/api/ws/{code}/{device_id}` (snapshot, device_list, set_state, blackout, alarm, rename, ping/pong).
- **Frontend**: Expo Router (bottom tabs), react-query, react-native-reanimated, gesture-handler, keyboard-controller, @gorhom/bottom-sheet.
  - `SessionProvider` (context): identité appareil persistée, WebSocket temps réel, liste devices, état tally, réception alarme → route `/alert`.
  - `OBSProvider` (context): client obs-websocket v5 direct (LAN), auth SHA256 via expo-crypto, scènes, program/preview/studio, tally dérivé.
  - Écrans: `(tabs)/index` Accueil+session, `(tabs)/studio` régie multicam, `(tabs)/obs` connexion OBS, `(tabs)/alarm` émetteur d'alarme; plein écran: `/tally`, `/camera`, `/alert`, `/settings`.

## User personas
- **Réalisateur/streamer** : pilote plusieurs téléphones-caméras, voit les tally.
- **Opérateur caméra** : téléphone posé sur un pied, affiche le voyant tally.
- **Proche (ex: conjointe)** : envoie une alerte discrète au téléphone près du PC.

## Implemented (2026-06)
- Création/rejoin de session par code, WebSocket temps réel (vérifié en preview).
- Régie multicam : tuiles appareils, PVW/PGM par appareil, BLACKOUT global.
- Tally plein écran (mode autonome & mode OBS), keep-awake, pulsation LIVE.
- Moniteur caméra (expo-camera) avec bordure tally + gestion permissions.
- Connexion OBS WebSocket v5 (auth), liste des scènes, assignation d'une scène.
- Alarme : destinataire (tous / appareil), messages préréglés + perso, toggles son/vibration/flash.
- Écran d'alerte entrante : fond clignotant, vibration, son (expo-audio), maintien pour arrêter.
- Réglages : nom d'appareil, valeurs d'alarme par défaut, quitter session.
- Thème sombre studio, polices Barlow Condensed + IBM Plex Sans, icônes MDI.

## Backlog
- P1: Historique des alertes / accusé de réception affiché à l'émetteur.
- P1: Réordonner/renommer les caméras depuis la régie.
- P1: Verrouillage "un seul LIVE à la fois" optionnel en régie.
- P2: Flux vidéo live téléphone → OBS (RTMP/NDI, build natif).
- P2: Programmation d'alertes / raccourcis Google Assistant → LED.
- P2: Rôles (réalisateur vs caméra) et permissions.

## Next tasks
- Recueillir retours après premier test réel sur WiFi + OBS.
