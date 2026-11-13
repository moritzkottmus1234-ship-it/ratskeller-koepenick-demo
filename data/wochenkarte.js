/* =====================================================================
   MITTAGSTISCH / WOCHENKARTE  – jede Woche hier austauschen
   Dienstag bis Freitag, 12–16 Uhr · nur in begrenzter Stückzahl

   Pro Gericht:
     name:         Name des Gerichts
     beschreibung: Beilagen / Details (darf leer sein: "")
     preis:        z. B. "12,50 €"
     tags:         [] oder ["vegetarisch"] / ["vegan"] / ["fisch"]
   ===================================================================== */
window.RK_WOCHENKARTE = {

  // TODO: Gültigkeitszeitraum eintragen, z. B. "17.–20. November 2026" (leer lassen = wird nicht angezeigt)
  gueltig: "",

  gerichte: [
    { name: "Gebratenes Rotbarschfilet", beschreibung: "Schwenkkartoffeln, Senfsauce", preis: "15,50 €", tags: ["fisch"] },
    { name: "Gebratene Spätzle", beschreibung: "Pilze, Parmesanschaum", preis: "12,50 €", tags: ["vegetarisch"] },
    { name: "Kürbiscremesuppe mit Kernöl", beschreibung: "", preis: "5,50 €", tags: [] },
    { name: "Thüringer Bratwurst vom Grill", beschreibung: "Krautsalat, Kartoffelpüree, Röstzwiebeln, Zwiebel-Bier-Jus", preis: "12,50 €", tags: [] },
    { name: "Fisch-Variation", beschreibung: "frische Pasta, Bärlauchpesto, Nüsslisalat, mariniertes Gemüse", preis: "13,50 €", tags: ["fisch"] }
  ]
};
