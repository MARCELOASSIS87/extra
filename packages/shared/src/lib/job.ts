/**
 * Teto de candidaturas por vaga (§16.5). Vive aqui e em nenhum outro lugar:
 * é a única fonte da regra no repositório, e é por isso que o número 3 não
 * aparece solto em fixture, rota ou tela.
 *
 * O valor não é coluna. A API devolve pronto e o cliente só lê — se o
 * multiplicador mudar, quem já tinha o número guardado ficaria com o teto
 * velho, e a vaga fecharia candidatura na hora errada.
 */
const APPLICATIONS_PER_VACANCY = 3;

export function maxApplicationsFor(vacancies: number): number {
  return vacancies * APPLICATIONS_PER_VACANCY;
}
