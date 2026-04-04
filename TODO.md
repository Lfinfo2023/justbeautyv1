## Paiement (Frontend)

### Pages de statut
- [ ] Créer page paiement réussi (/payment/success)
- [ ] Créer page paiement échoué (/payment/failed)
- [ ] Créer page paiement en attente (/payment/pending)

### UX
- [ ] Afficher message clair selon statut
- [ ] Ajouter bouton retour accueil
- [ ] Ajouter bouton voir commande
- [ ] Gérer refresh de page (ne pas perdre l'état)

### Sécurité
- [ ] Vérifier le statut réel via API (ne pas faire confiance à l'URL)
- [ ] Bloquer accès direct sans transaction valide

---

## Paiement (Backend)

- [ ] Endpoint GET /payment/status/:id
- [ ] Vérification du statut via Mollie (ou autre)
- [ ] Sauvegarde en base (paid, failed, pending)
- [ ] Webhook pour mise à jour automatique

## Index 

- [] Suprimer toute relation avec lovable et amelioerer le seo

---

## Phase Alpha

- [ ] Tester paiement succès
- [ ] Tester paiement échoué
- [ ] Tester fermeture navigateur pendant paiement
- [ ] Tester double paiement
- [ ] Logger tous les événements paiement