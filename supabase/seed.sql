-- seed.sql — le catalogue de démonstration, tel qu'il vit aujourd'hui dans
-- src/features/shop/model/catalog.ts.
--
-- Joué automatiquement par `supabase db reset`. Une base vide donne une app
-- vide : sans ces lignes, brancher le back-end ferait disparaître tout ce que
-- la démo montre.
--
-- Deux conversions par rapport au catalogue local, imposées par le schéma 0005 :
--   • les prix passent en CENTIMES (un flottant sur de la monnaie finit par
--     afficher 24.900000000000002 ou perdre un centime à l'arrondi) ;
--   • `endsInSeconds` devient un INSTANT `ends_at`. Une durée figée dans la base
--     serait déjà périmée à la première lecture ; on la rejoue depuis now() pour
--     que les comptes à rebours repartent à chaque reset.
--
-- Idempotent : `on conflict do update` permet de rejouer le fichier sans
-- dupliquer ni casser les commandes qui référencent déjà ces offres.

insert into public.merchants (id, name, area, lat, lng, rating, halal, emoji) values
  ('m_hammamet', 'Maison Hammamet',           'Empalot',       43.5766, 1.4358, 5.0, true,  '🥩'),
  ('m_petit',    'Le Petit Toulousain',       'Carmes',        43.5968, 1.4445, 4.8, false, '🍽️'),
  ('m_stcyp',    'Boulangerie Saint-Cyprien', 'Saint-Cyprien', 43.5985, 1.4300, 4.7, false, '🥐'),
  ('m_carmes',   'Primeur des Carmes',        'Carmes',        43.5952, 1.4425, 4.9, false, '🥬'),
  ('m_napoli',   'Pizzeria Napoli',           'Wilson',        43.6053, 1.4478, 4.6, false, '🍕'),
  ('m_xavier',   'Fromagerie Xavier',         'Capitole',      43.6043, 1.4437, 4.9, false, '🧀'),
  ('m_jeanne',   'Épicerie Bio Jeanne',       'Minimes',       43.6182, 1.4365, 4.8, false, '🍎'),
  ('m_racines',  'Café Racines',              'Saint-Aubin',   43.6063, 1.4530, 4.8, false, '🥗')
on conflict (id) do update set
  name = excluded.name, area = excluded.area,
  lat = excluded.lat, lng = excluded.lng,
  rating = excluded.rating, halal = excluded.halal, emoji = excluded.emoji;

insert into public.deals (
  id, merchant_id, title, category, price_cents, old_price_cents, unit,
  description, perk, origin, rating, stock_total, stock_left, ends_at
) values
  ('d_cote', 'm_hammamet', 'Côte de bœuf maturée', 'courses', 2490, 3490,
   'la pièce · 1,2–1,6 kg', 'Viande fraîche, découpe du jour. Halal, origine France.',
   '50 % sur le 2ᵉ', 'Origine France', 5.0, 50, 25, now() + interval '285 seconds'),

  ('d_cassoulet', 'm_petit', 'Cassoulet maison · 2 pers.', 'restos', 1290, 1900,
   'la portion', 'Le vrai, mijoté 12 h au confit. À emporter bien chaud.',
   'Dernières parts', null, 4.8, 20, 6, now() + interval '1800 seconds'),

  ('d_viennoiseries', 'm_stcyp', 'Panier viennoiseries', 'artisans', 450, 1100,
   'le panier de 6', 'Invendus du jour, encore tièdes. Geste anti-gaspi.',
   'Anti-gaspi', null, 4.7, 15, 4, now() + interval '900 seconds'),

  ('d_legumes', 'm_carmes', 'Panier de légumes de saison', 'courses', 690, 1200,
   'le panier · 3 kg', 'Producteurs du Sud-Ouest, cueilli ce matin.',
   null, 'Sud-Ouest', 4.9, 30, 12, now() + interval '3600 seconds'),

  ('d_pizza', 'm_napoli', 'Pizza Margherita', 'restos', 690, 1190,
   'la pizza', 'Pâte maturée 48 h, mozzarella fior di latte.',
   '2 = 1 boisson', null, 4.6, 40, 18, now() + interval '1200 seconds'),

  ('d_fromage', 'm_xavier', 'Plateau de fromages', 'artisans', 1200, 1800,
   'le plateau', 'Sélection de l’affineur : 5 fromages fermiers.',
   null, null, 4.9, 12, 3, now() + interval '2400 seconds'),

  ('d_fruits', 'm_jeanne', 'Corbeille de fruits bio', 'courses', 590, 1000,
   'la corbeille · 2 kg', 'Bio et de saison : pommes, poires, agrumes.',
   null, null, 4.8, 22, 7, now() + interval '5400 seconds'),

  ('d_brunch', 'm_racines', 'Brunch box complète', 'restos', 1000, 1600,
   'la box', 'Œufs, avocat, granola et jus pressé.',
   null, null, 4.8, 16, 8, now() + interval '1500 seconds')
on conflict (id) do update set
  merchant_id = excluded.merchant_id, title = excluded.title,
  category = excluded.category, price_cents = excluded.price_cents,
  old_price_cents = excluded.old_price_cents, unit = excluded.unit,
  description = excluded.description, perk = excluded.perk, origin = excluded.origin,
  rating = excluded.rating, stock_total = excluded.stock_total,
  -- Le stock restant est remis à sa valeur de démo : un reset doit rejouer la
  -- même vitrine, pas hériter des achats de la session précédente.
  stock_left = excluded.stock_left, ends_at = excluded.ends_at;
