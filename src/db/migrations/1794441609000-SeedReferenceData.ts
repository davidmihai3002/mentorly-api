import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reference data needed in every environment (production included):
 *  - domains (starting list – the final list is still an open question, US-022)
 *  - FAQ (draft copy in Romanian, covering the rules the docs say the FAQ must explain)
 *
 * Sponsors and platform testimonials are real-world content the team adds by hand,
 * so they are NOT seeded here – demo versions live in the SeedDemoData migration.
 */

const q = (s: string) => `'${s.replace(/'/g, "''")}'`;

const DOMAINS: Array<[slug: string, name: string]> = [
  ['cariera-cv-interviuri', 'Carieră, CV și interviuri'],
  ['marketing', 'Marketing'],
  ['it-programare', 'IT și programare'],
  ['data-ai', 'Data Science și AI'],
  ['design-ux-ui', 'Design (UX/UI, grafic)'],
  ['business-antreprenoriat', 'Business și antreprenoriat'],
  ['finante-contabilitate', 'Finanțe și contabilitate'],
  ['vanzari', 'Vânzări'],
  ['resurse-umane', 'Resurse umane'],
  ['management-proiecte', 'Management de proiect'],
  ['comunicare-pr', 'Comunicare și PR'],
  ['inginerie', 'Inginerie'],
  ['drept', 'Drept'],
  ['sanatate', 'Sănătate'],
];

type Faq = [category: 'PLATFORM' | 'MENTORSHIP_PROCESS' | 'BECOME_MENTOR' | 'PAYMENTS', question: string, answer: string];

const FAQ: Faq[] = [
  // ---------------------------------------------------------------- PLATFORM
  ['PLATFORM', 'Ce este Mentorly?',
    'Mentorly conectează tinerii și oamenii aflați la început de drum cu profesioniști verificați, care îi ghidează pe baza experienței lor reale: intrarea pe piața muncii, CV-ul, alegerea și construirea unei cariere.'],
  ['PLATFORM', 'Prin ce diferă mentoratul de meditații?',
    'Meditațiile predau o materie. Mentoratul te ghidează în dezvoltarea ta și în carieră, pornind de la experiența practică a mentorului: ce să înveți, cum să aplici, ce greșeli să eviți.'],
  ['PLATFORM', 'Care este vârsta minimă?',
    'Trebuie să ai cel puțin **16 ani** ca să îți faci cont. Nu este nevoie de acordul părinților.'],
  ['PLATFORM', 'Există chat în aplicație?',
    'Nu. După înrolare, platforma creează automat un **grup privat** cu mentorul tău și te adaugă în **grupul cohortei** mentorului, într-o aplicație de mesagerie externă. Intri cu butonul „Intră în grup”.'],
  ['PLATFORM', 'Cum iau legătura cu echipa Mentorly?',
    'Pentru neprezentări, dispute sau probleme cu plățile, scrie-ne la adresa de suport afișată în subsolul site-ului.'],

  // ------------------------------------------------------ MENTORSHIP_PROCESS
  ['MENTORSHIP_PROCESS', 'Cum aplic la un mentor?',
    'Deschide profilul mentorului, citește condițiile și minimul de cunoștințe cerut, apoi apasă **Aplică**. Răspunzi la cel mult 3 întrebări ale mentorului, îi poți pune până la 3 întrebări proprii și, dacă mentoratul are test, completezi testul.'],
  ['MENTORSHIP_PROCESS', 'Ce înseamnă badge-ul „Test”?',
    'Mentorul a atașat un test cu răspuns liber, bazat pe materialele lui de studiu. Poți citi materialele înainte să aplici. Mentorul citește răspunsurile și decide; nu există notare automată.'],
  ['MENTORSHIP_PROCESS', 'Ce se întâmplă dacă aplicarea mea este respinsă?',
    'Mentorul îți scrie obligatoriu ce ar trebui să îmbunătățești. Poți aplica din nou oricând, la același mentor sau la altcineva, fără perioadă de așteptare.'],
  ['MENTORSHIP_PROCESS', 'Ce este callul introductiv gratuit?',
    'După ce mentorul te acceptă, poți programa un call gratuit ca să vedeți dacă vă potriviți. Ai **un singur call gratuit pe cont, în total** – nu câte unul pentru fiecare mentor. Odată programat, este considerat folosit.'],
  ['MENTORSHIP_PROCESS', 'Pot anula o ședință?',
    'Nu. Ședințele **nu se anulează, doar se reprogramează**. Oricare dintre voi poate muta ședința oricând, într-un alt interval liber. Ideal, vă înțelegeți mai întâi în grupul privat.'],
  ['MENTORSHIP_PROCESS', 'Pot lucra cu mai mulți mentori în același timp?',
    'Da. Poți aplica și poți fi înrolat la mai mulți mentori simultan; dashboard-ul îți grupează ședințele și progresul pe fiecare mentorat.'],

  // --------------------------------------------------------------- PAYMENTS
  ['PAYMENTS', 'Cum plătesc un mentorat?',
    'Cu cardul, în RON, prin Stripe. În funcție de ce oferă mentorul, plătești **per ședință** (la programare) sau printr-un **abonament lunar** cu un număr fix de ședințe și, de obicei, un preț redus.'],
  ['PAYMENTS', 'Când primește mentorul banii?',
    'Platforma reține plata până după ședință. Mentorii sunt plătiți de două ori pe lună pentru ședințele ținute.'],
  ['PAYMENTS', 'Ce se întâmplă cu ședințele nefolosite din abonament?',
    'Ședințele nefolosite **expiră** la sfârșitul lunii de abonament. Abonamentul se reînnoiește automat; dacă îl anulezi, se oprește doar următoarea reînnoire, iar luna curentă rămâne utilizabilă.'],
  ['PAYMENTS', 'Există mentorate gratuite?',
    'Da, prin **programul sponsorizat**: companii partenere oferă angajați ca mentori. Aplici separat la program, iar echipa Mentorly selectează beneficiarii.'],

  // ---------------------------------------------------------- BECOME_MENTOR
  ['BECOME_MENTOR', 'Cum devin mentor?',
    'Te înregistrezi ca mentor și trimiți o aplicare cu profilul LinkedIn (**obligatoriu și actualizat**), CV-ul, certificatele sau diplomele și o scurtă motivație. Nu există interviu.'],
  ['BECOME_MENTOR', 'Cum sunt verificați mentorii?',
    'Echipa verifică manual fiecare aplicare: identitatea, experiența declarată și documentele. Primești rezultatul pe email.'],
  ['BECOME_MENTOR', 'Îmi stabilesc singur prețul?',
    'Da. Alegi dacă oferi mentoratul per ședință, lunar sau ambele, iar platforma îți poate sugera un interval de preț în funcție de experiență.'],
  ['BECOME_MENTOR', 'Cum și când sunt plătit?',
    'De două ori pe lună, pentru ședințele ținute în perioadă, minus comisionul platformei, prin Stripe Connect. Trebuie să îți configurezi contul de plăți înainte de a primi înrolări plătite.'],
];

export class SeedReferenceData1794441609000 implements MigrationInterface {
  name = 'SeedReferenceData1794441609000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO domains (slug, name, position) VALUES
      ${DOMAINS.map(([slug, name], i) => `(${q(slug)}, ${q(name)}, ${i + 1})`).join(',\n      ')}
      ON CONFLICT (slug) DO NOTHING
    `);

    const positions: Record<string, number> = {};
    await queryRunner.query(`
      INSERT INTO faq_items (category, question, answer, position) VALUES
      ${FAQ.map(([cat, question, answer]) => {
        positions[cat] = (positions[cat] ?? 0) + 1;
        return `(${q(cat)}, ${q(question)}, ${q(answer)}, ${positions[cat]})`;
      }).join(',\n      ')}
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM faq_items WHERE question IN (${FAQ.map(([, question]) => q(question)).join(', ')})
    `);
    await queryRunner.query(`
      DELETE FROM domains WHERE slug IN (${DOMAINS.map(([slug]) => q(slug)).join(', ')})
    `);
  }
}
