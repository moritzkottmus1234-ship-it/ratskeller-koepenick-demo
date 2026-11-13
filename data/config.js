/* =====================================================================
   RATSKELLER KÖPENICK – ZENTRALE EINSTELLUNGEN
   Diese Datei können Sie ohne Programmierkenntnisse bearbeiten.
   Nur die Werte zwischen den Anführungszeichen ändern.
   ===================================================================== */
window.RK_CONFIG = {

  /* ---------- Hinweis-Banner ganz oben (Sonderöffnungszeiten, Betriebsferien …)
     aktiv: true = Banner anzeigen, false = ausblenden                       */
  hinweis: {
    aktiv: true,
    text: "An den Feiertagen 25.12. und 26.12. haben wir ab 11 Uhr für Sie geöffnet.",
    linkText: "Jetzt reservieren",
    linkZiel: "#reservieren"
  },

  /* ---------- Sonderöffnungszeiten für einzelne Tage (Format JJJJ-MM-TT)
     Beispiele (zum Aktivieren die // am Zeilenanfang entfernen):
       { datum: "2026-12-31", geschlossen: true,  text: "Silvester geschlossen" },
       { datum: "2027-01-01", von: "14:00", bis: "22:00", text: "Neujahr ab 14 Uhr" },
     Hinweis: 25.12. und 26.12. (ab 11 Uhr) sind bereits fest hinterlegt.     */
  sonderzeiten: [
    // TODO: Betriebsferien / weitere Feiertage hier eintragen
  ],

  /* ---------- Online-Reservierung über OpenTable
     TODO: echten OpenTable-Link eintragen                                    */
  opentableLink: "#OPENTABLE-LINK",

  /* ---------- Formular-Dienst (z. B. Formspree)
     TODO: "DEINE-ID" durch die echte Formular-ID ersetzen.
     Solange "DEINE-ID" drinsteht, läuft das Formular im Demo-Modus
     (es wird NICHTS versendet, nur die Erfolgsmeldung gezeigt).              */
  formularEndpunktReservierung: "https://formspree.io/f/DEINE-ID",
  formularEndpunktFeier:        "https://formspree.io/f/DEINE-ID",

  /* ---------- Empfänger für "Per E-Mail senden" (mailto-Fallback)
     TODO: prüfen, ob Tischreservierungen an diese Adresse gehen sollen.      */
  emailReservierung: "verkauf@ratskeller-koepenick.de",
  emailFeier:        "verkauf@ratskeller-koepenick.de"
};
