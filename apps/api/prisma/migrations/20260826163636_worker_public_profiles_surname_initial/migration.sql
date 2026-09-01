-- worker_public_profiles: a inicial vem do SOBRENOME, não do primeiro caractere.
--
-- `first_name` guarda só o primeiro nome, então `last_name` carrega todo o resto —
-- "Ana Paula Ferreira" vira first_name "Ana" e last_name "Paula Ferreira". O
-- `left(last_name, 1)` de antes devolvia a inicial do nome do MEIO ("P."), que não é o
-- sobrenome de ninguém.
--
-- Sufixo de geração sai antes da última palavra: em "João Silva Junior" o sobrenome é Silva,
-- e o que a empresa lê na lista de candidatos tem que ser "S.". O padrão casa sufixos
-- repetidos ("Silva Filho Neto") e também o caso em que o sufixo é a única palavra restante,
-- que aí deixa o sobrenome vazio.
--
-- Sobrenome vazio devolve inicial vazia: quem se cadastrou com um nome só não ganha uma
-- inicial inventada nem um ponto solto na tela.
--
-- O ponto faz parte do valor ("F.", não "F"): é assim que a camada mock de apps/web devolve,
-- e as duas precisam bater campo a campo para uma servir de conferência da outra.

CREATE OR REPLACE VIEW worker_public_profiles AS
SELECT
  w.id,
  w.first_name,
  CASE
    WHEN surname.word = '' THEN ''
    ELSE left(surname.word, 1) || '.'
  END                                      AS last_name_initial,
  c.name                                   AS city_name,
  w.neighborhood,
  w.experience,
  w.intro_video_key,
  (w.profile_completed_at IS NOT NULL)     AS has_complete_profile,
  w.created_at                             AS member_since
FROM workers w
JOIN cities c ON c.id = w.city_id
-- LATERAL para a expressão existir uma vez só. Repetida em três ramos de CASE, ela vira
-- três lugares para consertar quando a lista de sufixos crescer.
CROSS JOIN LATERAL (
  SELECT regexp_replace(
    -- 2. o que sobra depois do último espaço: a última palavra
    regexp_replace(
      -- 1. tira os sufixos de geração do fim
      w.last_name,
      '((^|\s+)(jr|j[uú]nior|neto|filho|sobrinho|segundo)\.?)+\s*$',
      '',
      'i'
    ),
    '^.*\s+',
    ''
  ) AS word
) surname
WHERE w.status <> 'self_deactivated';
