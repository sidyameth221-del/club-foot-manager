-- Seed competency framework with default competencies and levels
-- This populates the 6 competency categories with competencies and validation levels
-- Run this AFTER setting up your club in the application

-- Get the club ID - replace 'soissons-ifc' with your club slug if different
-- Then copy the ID and update the seed data below

-- First, let's define the competency data for a specific club
-- You'll need to replace 'YOUR_CLUB_ID_HERE' with the actual club UUID

with target_club as (
  select id from public.clubs where slug = 'soissons-ifc' limit 1
)
insert into public.competency_framework (club_id, category, competency_name, level_rank, level_name, level_description)
select 
  tc.id,
  category,
  competency_name,
  level_rank,
  level_name,
  level_description
from target_club tc,
(values
  -- TECHNIQUE
  ('Technique', 'Conduite de balle', 1, 'Decouverte', 'Conduit le ballon lentement avec controle irregulier.'),
  ('Technique', 'Conduite de balle', 2, 'En progression', 'Garde le controle en mouvement avec peu de pertes.'),
  ('Technique', 'Conduite de balle', 3, 'Maitrise', 'Alterne rythmes et directions avec ballon proche du pied.'),
  ('Technique', 'Conduite de balle', 4, 'Reference', 'Conduit vite, protege et elimine sous pression reelle.'),
  
  ('Technique', 'Passe sous pression', 1, 'Decouverte', 'Passe reussie sans adversaire proche.'),
  ('Technique', 'Passe sous pression', 2, 'En progression', 'Trouve un partenaire avec opposition moderee.'),
  ('Technique', 'Passe sous pression', 3, 'Maitrise', 'Choisit la bonne passe dans un espace reduit.'),
  ('Technique', 'Passe sous pression', 4, 'Reference', 'Enchaine passe juste et rapide sous pressing intense.'),

  -- MENTAL
  ('Mental', 'Concentration', 1, 'Decouverte', 'Perd vite le fil de la consigne en seance.'),
  ('Mental', 'Concentration', 2, 'En progression', 'Reste concentre sur des sequences courtes.'),
  ('Mental', 'Concentration', 3, 'Maitrise', 'Maintient son attention meme apres une erreur.'),
  ('Mental', 'Concentration', 4, 'Reference', 'Concentration stable du debut a la fin.'),

  ('Mental', 'Gestion emotionnelle', 1, 'Decouverte', 'Reagit fortement a la frustration.'),
  ('Mental', 'Gestion emotionnelle', 2, 'En progression', 'Retrouve son calme avec accompagnement.'),
  ('Mental', 'Gestion emotionnelle', 3, 'Maitrise', 'Controle ses reactions dans les temps faibles.'),
  ('Mental', 'Gestion emotionnelle', 4, 'Reference', 'Reste lucide et positif dans les moments critiques.'),

  -- TACTIQUE
  ('Tactique', 'Placement defensif', 1, 'Decouverte', 'Repere tardivement sa zone et son role.'),
  ('Tactique', 'Placement defensif', 2, 'En progression', 'Occupe globalement la bonne zone.'),
  ('Tactique', 'Placement defensif', 3, 'Maitrise', 'Ajuste son placement selon ballon et partenaires.'),
  ('Tactique', 'Placement defensif', 4, 'Reference', 'Anticipe et ferme les espaces avant le danger.'),

  ('Tactique', 'Lecture des transitions', 1, 'Decouverte', 'Reagit tard aux pertes et recuperations.'),
  ('Tactique', 'Lecture des transitions', 2, 'En progression', 'Declenche un replacement simple.'),
  ('Tactique', 'Lecture des transitions', 3, 'Maitrise', 'Fait le bon choix en transition offensive/defensive.'),
  ('Tactique', 'Lecture des transitions', 4, 'Reference', 'Influence positivement la transition de toute l equipe.'),

  -- PHYSIQUE
  ('Physique', 'VMA / capacite aerobie', 1, 'Decouverte', 'Difficulte a tenir les blocs d effort.'),
  ('Physique', 'VMA / capacite aerobie', 2, 'En progression', 'Tient l intensite sur des sequences limitees.'),
  ('Physique', 'VMA / capacite aerobie', 3, 'Maitrise', 'Repete les courses avec recuperation correcte.'),
  ('Physique', 'VMA / capacite aerobie', 4, 'Reference', 'Maintient haute intensite sur toute la seance.'),

  ('Physique', 'Sprint 20m', 1, 'Decouverte', 'Depart et acceleration encore lents.'),
  ('Physique', 'Sprint 20m', 2, 'En progression', 'Acceleration correcte sur les premiers metres.'),
  ('Physique', 'Sprint 20m', 3, 'Maitrise', 'Bonne frequence et vitesse terminale stable.'),
  ('Physique', 'Sprint 20m', 4, 'Reference', 'Sprint explosif et reproductible en serie.'),

  -- PERCEPTIF
  ('Perceptif', 'Vision peripherique', 1, 'Decouverte', 'Observe surtout le ballon, peu l environnement.'),
  ('Perceptif', 'Vision peripherique', 2, 'En progression', 'Identifie quelques options autour de lui.'),
  ('Perceptif', 'Vision peripherique', 3, 'Maitrise', 'Scanne frequemment avant de recevoir.'),
  ('Perceptif', 'Vision peripherique', 4, 'Reference', 'Utilise infos peripheriques pour devancer le jeu.'),

  ('Perceptif', 'Orientation du corps', 1, 'Decouverte', 'Orientation fermee, options de jeu limitees.'),
  ('Perceptif', 'Orientation du corps', 2, 'En progression', 'Ouvre son corps dans des situations simples.'),
  ('Perceptif', 'Orientation du corps', 3, 'Maitrise', 'Oriente son controle selon la pression.'),
  ('Perceptif', 'Orientation du corps', 4, 'Reference', 'Orientation optimale et constante avant reception.'),

  -- COGNITIF
  ('Cognitif', 'Vitesse de decision', 1, 'Decouverte', 'Hesite souvent avant de choisir.'),
  ('Cognitif', 'Vitesse de decision', 2, 'En progression', 'Prend des decisions simples avec delai reduit.'),
  ('Cognitif', 'Vitesse de decision', 3, 'Maitrise', 'Choisit vite et juste dans des contextes variables.'),
  ('Cognitif', 'Vitesse de decision', 4, 'Reference', 'Decision immediate et pertinente sous forte pression.'),

  ('Cognitif', 'Memoire tactique', 1, 'Decouverte', 'Retient partiellement les principes collectifs.'),
  ('Cognitif', 'Memoire tactique', 2, 'En progression', 'Applique les consignes recurrentes.'),
  ('Cognitif', 'Memoire tactique', 3, 'Maitrise', 'Transfere les schemas vus a l entrainement.'),
  ('Cognitif', 'Memoire tactique', 4, 'Reference', 'Mobilise automatiquement les reperes tactiques.')
) as data(category, competency_name, level_rank, level_name, level_description)
on conflict (club_id, category, competency_name, level_rank) do nothing;
