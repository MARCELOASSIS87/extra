# @extra/fixtures

Uma fonte de dado falso, dois consumidores: a camada mock de `apps/web` e o
seed de desenvolvimento em `apps/api/prisma/seed.ts`. Os dois carregam
exatamente estas linhas, e é isso que deixa comparar o JSON do mock com o da
API e ver se bate.

Não mora em `apps/web` porque o seed vive em `apps/api`: a API importando do
código-fonte do front inverte a direção da dependência do monorepo, e isso
quebra quando a API vai para o contêiner — lá não existe `apps/web`.

As cidades aqui são um recorte real do banco (13 municípios), usadas pelo mock
para resolver nome e slug sem carregar as 5.571 do IBGE no bundle. O seed
**não** insere cidade nenhuma: no banco elas já existem, e ele só referencia
por id.
