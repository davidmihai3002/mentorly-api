import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * DEMO DATA – skipped when NODE_ENV=production.
 *
 * A small, consistent world built around the end-to-end example from the user journeys (§6):
 * Ana applies to Mihai (marketing, test, monthly plan), Vlad pays per session with Ioana (IT),
 * Cristi is a sponsored beneficiary with Elena (Nordwave Software), Maria gets rejected and
 * re-applies, Andrei is a PENDING mentor and Radu a REJECTED one.
 *
 * - All demo ids look like  deXX0000-0000-4000-8000-NNNNNNNNNNNN  (XX = table code) so down()
 *   can remove exactly this data.
 * - Dates are RELATIVE to the moment the migration runs (week -1 = last week, +1 = next week,
 *   Europe/Bucharest), so "held" sessions are always in the past and "scheduled" ones in the future.
 * - Every demo user's password is  Parola123!  (bcrypt via pgcrypto). Ana signs in with Google only.
 * - Emails use the reserved example.com domain.
 */

const PATTERN = `'de__0000-0000-4000-8000-%'`;
const id = (table: number, n: number) =>
  `'de${table.toString(16).padStart(2, '0')}0000-0000-4000-8000-${String(n).padStart(12, '0')}'`;
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
const j = (o: unknown) => `${q(JSON.stringify(o))}::jsonb`;
/** Local Europe/Bucharest time: week offset from the current week, ISO weekday (1 = Monday), HH:MM. */
const ts = (week: number, day: number, hhmm: string) => `pg_temp.demo_ts(${week}, ${day}, '${hhmm}')`;
const NULL = 'NULL';

const insert = (table: string, cols: string[], rows: string[][]) =>
  `INSERT INTO ${table} (${cols.join(', ')}) VALUES\n${rows.map((r) => `  (${r.join(', ')})`).join(',\n')}`;

// ---------------------------------------------------------------- id registry
const T = {
  users: 1, files: 2, sponsors: 3, mentorships: 4, slots: 5, questions: 6, materials: 7,
  applications: 8, answers: 9, menteeQuestions: 10, enrolments: 11, subscriptions: 12,
  sessions: 13, reschedules: 14, payments: 15, payouts: 16, payoutItems: 17, groups: 18,
  members: 19, notifications: 20, emails: 21, evaluations: 22, evalScores: 23, projects: 24,
  goals: 25, reviews: 26, sponsoredApps: 27, testimonials: 28, audit: 29, credentials: 30,
  socialLinks: 31, authProviders: 32,
};

const U = {
  mihai: id(T.users, 1), ioana: id(T.users, 2), elena: id(T.users, 3), andrei: id(T.users, 4),
  radu: id(T.users, 5), ana: id(T.users, 6), vlad: id(T.users, 7), maria: id(T.users, 8),
  cristi: id(T.users, 9),
};
const F = (n: number) => id(T.files, n);
const MS = { mihai: id(T.mentorships, 1), ioana: id(T.mentorships, 2), elena: id(T.mentorships, 3), andrei: id(T.mentorships, 4) };
const Q = (n: number) => id(T.questions, n);
const A = { anaMihai: id(T.applications, 1), vladIoana: id(T.applications, 2), mariaRejected: id(T.applications, 3), mariaPending: id(T.applications, 4), cristiElena: id(T.applications, 5) };
const E = { ana: id(T.enrolments, 1), vlad: id(T.enrolments, 2), cristi: id(T.enrolments, 3) };
const SUB = id(T.subscriptions, 1);
const S = (n: number) => id(T.sessions, n);
const P = (n: number) => id(T.payments, n);
const G = (n: number) => id(T.groups, n);
const N = (n: number) => id(T.notifications, n);
const dom = (slug: string) => `(SELECT id FROM domains WHERE slug = ${q(slug)})`;

const PERIOD_START = ts(-2, 1, '10:00');
const PERIOD_END = `(${PERIOD_START} + interval '1 month')`;

export class SeedDemoData1794441610000 implements MigrationInterface {
  name = 'SeedDemoData1794441610000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      console.log('[SeedDemoData] NODE_ENV=production – demo data skipped.');
      return;
    }
    const run = (sql: string) => queryRunner.query(sql);

    await run(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
    await run(`
      CREATE FUNCTION pg_temp.demo_ts(week int, day int, hhmm text) RETURNS timestamptz
      LANGUAGE sql STABLE AS $$
        SELECT (
          date_trunc('week', now() AT TIME ZONE 'Europe/Bucharest')
          + make_interval(days => week * 7 + day - 1)
          + hhmm::time
        ) AT TIME ZONE 'Europe/Bucharest'
      $$
    `);
    await run(`
      CREATE FUNCTION pg_temp.half_month_start(d date) RETURNS date LANGUAGE sql IMMUTABLE AS $$
        SELECT CASE WHEN extract(day FROM d) <= 15 THEN date_trunc('month', d)::date
                    ELSE date_trunc('month', d)::date + 15 END
      $$
    `);
    await run(`
      CREATE FUNCTION pg_temp.half_month_end(d date) RETURNS date LANGUAGE sql IMMUTABLE AS $$
        SELECT CASE WHEN extract(day FROM d) <= 15 THEN date_trunc('month', d)::date + 14
                    ELSE (date_trunc('month', d) + interval '1 month - 1 day')::date END
      $$
    `);

    // ================================================================== files
    await run(insert('files',
      ['id', 'uploaded_by_user_id', 'storage_key', 'original_name', 'mime_type', 'size_bytes', 'visibility'],
      [
        [F(1), NULL, q('demo/credentials/mihai-popescu-cv.pdf'), q('Mihai_Popescu_CV.pdf'), q('application/pdf'), '184320', q('PRIVATE')],
        [F(2), NULL, q('demo/credentials/mihai-popescu-google-ads.pdf'), q('Google_Ads_Certificare.pdf'), q('application/pdf'), '96256', q('PRIVATE')],
        [F(3), NULL, q('demo/credentials/ioana-dumitrescu-cv.pdf'), q('CV_Ioana_Dumitrescu.pdf'), q('application/pdf'), '201728', q('PRIVATE')],
        [F(4), NULL, q('demo/credentials/elena-marin-cv.pdf'), q('Elena_Marin_CV.pdf'), q('application/pdf'), '175104', q('PRIVATE')],
        [F(5), NULL, q('demo/credentials/andrei-stan-cv.pdf'), q('Andrei_Stan_CV.pdf'), q('application/pdf'), '143360', q('PRIVATE')],
        [F(6), NULL, q('demo/credentials/radu-ionescu-cv.pdf'), q('Radu_Ionescu_CV.pdf'), q('application/pdf'), '122880', q('PRIVATE')],
        [F(7), NULL, q('demo/study/ghid-marketing-digital.pdf'), q('Ghid_marketing_digital.pdf'), q('application/pdf'), '2621440', q('PRIVATE')],
        [F(8), NULL, q('demo/sponsors/nordwave-logo.png'), q('nordwave.png'), q('image/png'), '24576', q('PUBLIC')],
        [F(9), NULL, q('demo/sponsors/carpatica-logo.png'), q('carpatica.png'), q('image/png'), '20480', q('PUBLIC')],
        [F(10), NULL, q('demo/credentials/ioana-dumitrescu-aws.pdf'), q('AWS_Developer_Associate.pdf'), q('application/pdf'), '88064', q('PRIVATE')],
        [F(11), NULL, q('demo/avatars/mihai-popescu.jpg'), q('mihai.jpg'), q('image/jpeg'), '65536', q('PUBLIC')],
      ]));

    // ================================================================== users
    const pwd = `crypt('Parola123!', gen_salt('bf', 10))`;
    await run(insert('users',
      ['id', 'email', 'password_hash', 'role', 'first_name', 'last_name', 'birth_date', 'avatar_file_id', 'terms_accepted_at', 'email_verified_at', 'last_login_at', 'created_at'],
      [
        [U.mihai, q('mihai.popescu@example.com'), pwd, q('MENTOR'), q('Mihai'), q('Popescu'), q('1988-05-12'), F(11), ts(-9, 1, '09:00'), ts(-9, 1, '09:05'), ts(0, 1, '08:30'), ts(-9, 1, '09:00')],
        [U.ioana, q('ioana.dumitrescu@example.com'), pwd, q('MENTOR'), q('Ioana'), q('Dumitrescu'), q('1991-09-03'), NULL, ts(-9, 2, '19:00'), ts(-9, 2, '19:02'), ts(0, 1, '20:10'), ts(-9, 2, '19:00')],
        [U.elena, q('elena.marin@example.com'), pwd, q('MENTOR'), q('Elena'), q('Marin'), q('1990-02-27'), NULL, ts(-8, 3, '12:00'), ts(-8, 3, '12:04'), ts(-1, 3, '17:40'), ts(-8, 3, '12:00')],
        [U.andrei, q('andrei.stan@example.com'), pwd, q('MENTOR'), q('Andrei'), q('Stan'), q('1994-12-01'), NULL, ts(-1, 4, '10:00'), ts(-1, 4, '10:03'), ts(-1, 4, '10:30'), ts(-1, 4, '10:00')],
        [U.radu, q('radu.ionescu@example.com'), pwd, q('MENTOR'), q('Radu'), q('Ionescu'), q('1985-07-19'), NULL, ts(-7, 1, '11:00'), ts(-7, 1, '11:01'), ts(-6, 2, '09:00'), ts(-7, 1, '11:00')],
        [U.ana, q('ana.georgescu@example.com'), NULL, q('MENTEE'), q('Ana'), q('Georgescu'), q('2007-03-14'), NULL, ts(-5, 1, '20:00'), ts(-5, 1, '20:00'), ts(0, 1, '21:15'), ts(-5, 1, '20:00')],
        [U.vlad, q('vlad.popa@example.com'), pwd, q('MENTEE'), q('Vlad'), q('Popa'), q('2002-07-21'), NULL, ts(-5, 1, '18:00'), ts(-5, 1, '18:03'), ts(-1, 7, '11:00'), ts(-5, 1, '18:00')],
        [U.maria, q('maria.tudor@example.com'), pwd, q('MENTEE'), q('Maria'), q('Tudor'), q('2005-01-30'), NULL, ts(-4, 7, '16:00'), NULL, ts(-1, 6, '10:00'), ts(-4, 7, '16:00')],
        [U.cristi, q('cristi.enache@example.com'), pwd, q('MENTEE'), q('Cristian'), q('Enache'), q('2004-11-02'), NULL, ts(-7, 4, '13:00'), ts(-7, 4, '13:02'), ts(-1, 3, '17:50'), ts(-7, 4, '13:00')],
      ]));
    await run(`UPDATE files SET uploaded_by_user_id = ${U.mihai} WHERE id IN (${F(1)}, ${F(2)}, ${F(7)}, ${F(11)})`);
    await run(`UPDATE files SET uploaded_by_user_id = ${U.ioana} WHERE id IN (${F(3)}, ${F(10)})`);
    await run(`UPDATE files SET uploaded_by_user_id = ${U.elena} WHERE id = ${F(4)}`);
    await run(`UPDATE files SET uploaded_by_user_id = ${U.andrei} WHERE id = ${F(5)}`);
    await run(`UPDATE files SET uploaded_by_user_id = ${U.radu} WHERE id = ${F(6)}`);

    await run(insert('user_auth_providers', ['id', 'user_id', 'provider', 'provider_user_id', 'provider_email'], [
      [id(T.authProviders, 1), U.ana, q('GOOGLE'), q('google-demo-000000000006'), q('ana.georgescu@example.com')],
    ]));

    // =============================================================== sponsors
    await run(insert('sponsors', ['id', 'name', 'slug', 'logo_file_id', 'description', 'website_url', 'position'], [
      [id(T.sponsors, 1), q('Nordwave Software'), q('nordwave-software'), F(8),
        q('Companie de software (demo) care oferă ingineri și specialiști în date ca mentori gratuiți pentru studenți.'),
        q('https://example.com/nordwave'), '1'],
      [id(T.sponsors, 2), q('Carpatica Analytics'), q('carpatica-analytics'), F(9),
        q('Firmă de consultanță în analiză de date (demo). Mentorii săi vor fi adăugați în curând.'),
        q('https://example.com/carpatica'), '2'],
    ]));

    // ======================================================== mentor_profiles
    await run(insert('mentor_profiles',
      ['user_id', 'status', 'status_reason', 'status_changed_at', 'submitted_at', 'domain_id', 'bio', 'linkedin_url', 'motivation', 'highlights', 'capacity', 'sponsor_id', 'stripe_account_id', 'stripe_account_status'],
      [
        [U.mihai, q('APPROVED'), NULL, ts(-8, 2, '11:00'), ts(-9, 1, '09:30'), dom('marketing'),
          q('Head of Growth cu 10 ani în marketing digital. Am construit echipe de performance marketing pentru e-commerce și startup-uri.'),
          q('https://www.linkedin.com/in/demo-mihai-popescu'),
          q('Vreau să le arăt tinerilor cum arată marketingul în practică, nu doar în cursuri.'),
          j({ workplaces: ['eMAG (demo)', 'Startup SaaS (demo)'], achievements: ['Campanie cu ROAS 6x pentru un magazin online'], certifications: ['Google Ads Search', 'Meta Blueprint'] }),
          '8', NULL, q('acct_demo_mihai'), q('ACTIVE')],
        [U.ioana, q('APPROVED'), NULL, ts(-8, 3, '10:00'), ts(-9, 2, '19:30'), dom('it-programare'),
          q('Senior backend engineer (Node.js, NestJS, PostgreSQL). Îmi place să ajut juniorii să treacă de primul interviu tehnic.'),
          q('https://www.linkedin.com/in/demo-ioana-dumitrescu'),
          q('Am avut un mentor la început și vreau să dau mai departe.'),
          j({ workplaces: ['Fintech (demo)', 'Agenție software (demo)'], achievements: ['Tech lead pentru o platformă cu 1M utilizatori'], certifications: ['AWS Developer Associate'] }),
          '5', NULL, q('acct_demo_ioana'), q('ACTIVE')],
        [U.elena, q('APPROVED'), NULL, ts(-7, 5, '15:00'), ts(-8, 3, '12:30'), dom('data-ai'),
          q('Data scientist la Nordwave Software. Lucrez cu modele de predicție și dashboard-uri pentru clienți din retail.'),
          q('https://www.linkedin.com/in/demo-elena-marin'),
          q('Particip la programul de mentorat al companiei mele pentru studenți.'),
          j({ workplaces: ['Nordwave Software (demo)'], achievements: ['Model de forecast folosit în 40 de magazine'], certifications: [] }),
          '3', id(T.sponsors, 1), NULL, q('NOT_CONNECTED')],
        [U.andrei, q('PENDING'), NULL, NULL, ts(-1, 4, '10:20'), dom('design-ux-ui'),
          q('Product designer, 6 ani de experiență în aplicații mobile.'),
          q('https://www.linkedin.com/in/demo-andrei-stan'),
          q('Vreau să ajut designerii juniori să își construiască un portofoliu bun.'),
          j({ workplaces: ['Agenție de design (demo)'], achievements: [], certifications: [] }),
          '4', NULL, NULL, q('NOT_CONNECTED')],
        [U.radu, q('REJECTED'), q('Profilul LinkedIn nu este actualizat (ultima experiență listată este din 2019). Actualizează-l și aplică din nou.'),
          ts(-6, 2, '10:00'), ts(-7, 1, '11:20'), dom('finante-contabilitate'),
          NULL, q('https://www.linkedin.com/in/demo-radu-ionescu'),
          q('Vreau să predau contabilitate.'), `'{}'::jsonb`, NULL, NULL, NULL, q('NOT_CONNECTED')],
      ]));

    await run(insert('mentor_credentials', ['id', 'mentor_id', 'type', 'file_id', 'title'], [
      [id(T.credentials, 1), U.mihai, q('CV'), F(1), NULL],
      [id(T.credentials, 2), U.mihai, q('CERTIFICATE'), F(2), q('Google Ads Search')],
      [id(T.credentials, 3), U.ioana, q('CV'), F(3), NULL],
      [id(T.credentials, 4), U.ioana, q('CERTIFICATE'), F(10), q('AWS Developer Associate')],
      [id(T.credentials, 5), U.elena, q('CV'), F(4), NULL],
      [id(T.credentials, 6), U.andrei, q('CV'), F(5), NULL],
      [id(T.credentials, 7), U.radu, q('CV'), F(6), NULL],
    ]));

    await run(insert('mentor_social_links', ['id', 'mentor_id', 'platform', 'url', 'position'], [
      [id(T.socialLinks, 1), U.mihai, q('LINKEDIN'), q('https://www.linkedin.com/in/demo-mihai-popescu'), '1'],
      [id(T.socialLinks, 2), U.mihai, q('INSTAGRAM'), q('https://www.instagram.com/demo.mihai.marketing'), '2'],
      [id(T.socialLinks, 3), U.ioana, q('LINKEDIN'), q('https://www.linkedin.com/in/demo-ioana-dumitrescu'), '1'],
      [id(T.socialLinks, 4), U.ioana, q('GITHUB'), q('https://github.com/demo-ioana'), '2'],
      [id(T.socialLinks, 5), U.elena, q('LINKEDIN'), q('https://www.linkedin.com/in/demo-elena-marin'), '1'],
    ]));

    // ======================================================== mentee_profiles
    await run(insert('mentee_profiles',
      ['user_id', 'domain_id', 'needs', 'studies', 'career_goals', 'onboarding_completed_at', 'free_call_used_at', 'stripe_customer_id'],
      [
        [U.ana, dom('marketing'), q('Vreau să înțeleg cum se face marketing real, nu doar teorie, și să am un portofoliu.'),
          q('Anul 1, Facultatea de Comunicare și Relații Publice'), q('Junior social media / performance marketing în 1 an.'),
          ts(-5, 1, '20:10'), ts(-4, 3, '12:00'), q('cus_demo_ana')],
        [U.vlad, dom('it-programare'), q('Am învățat singur JavaScript, dar nu știu cum arată un proiect de backend profesionist.'),
          q('Absolvent Automatică și Calculatoare'), q('Backend developer junior.'),
          ts(-5, 1, '18:10'), ts(-4, 2, '09:00'), q('cus_demo_vlad')],
        [U.maria, dom('marketing'), q('Vreau să trec din vânzări în marketing.'),
          q('Liceu, profil economic'), q('Marketing specialist.'),
          ts(-4, 7, '16:15'), NULL, NULL],
        [U.cristi, dom('data-ai'), q('Am nevoie de ghidare ca să aleg între data analysis și data engineering.'),
          q('Anul 3, Informatică Economică'), q('Data analyst junior.'),
          ts(-7, 4, '13:10'), NULL, NULL],
      ]));

    await run(insert('favourites', ['mentee_id', 'mentor_id', 'created_at'], [
      [U.ana, U.mihai, ts(-5, 1, '20:20')],
      [U.ana, U.ioana, ts(-5, 1, '20:25')],
      [U.vlad, U.ioana, ts(-5, 1, '18:20')],
      [U.vlad, U.elena, ts(-5, 1, '18:22')],
      [U.maria, U.mihai, ts(-4, 7, '16:30')],
    ]));

    // ============================================================ mentorships
    await run(insert('mentorships',
      ['id', 'mentor_id', 'description', 'conditions', 'min_knowledge', 'is_sponsored', 'per_session_price_bani', 'monthly_price_bani', 'monthly_sessions_count', 'session_duration_minutes', 'has_test', 'published_at'],
      [
        [MS.mihai, U.mihai,
          q('Mentorat practic de marketing digital: strategie de conținut, campanii plătite, analiză. Lucrăm pe proiecte reale și îți construiești portofoliul.'),
          q('Vino pregătit la fiecare ședință și lucrează 3–4 ore pe săptămână între ședințe.'),
          q('Noțiuni de bază despre social media și Excel / Google Sheets.'),
          'false', '12000', '43200', '4', '60', 'true', ts(-8, 2, '12:00')],
        [MS.ioana, U.ioana,
          q('Backend cu Node.js și NestJS: de la primul API la un proiect pe care îl poți arăta la interviu.'),
          q('Proiectele se lucrează pe GitHub, cu code review.'),
          q('JavaScript de bază (funcții, async/await).'),
          'false', '20000', NULL, NULL, '60', 'false', ts(-8, 3, '11:00')],
        [MS.elena, U.elena,
          q('Mentorat gratuit în Data Science, prin programul sponsorizat Nordwave Software.'),
          q('Disponibil doar beneficiarilor selectați ai programului sponsorizat.'),
          q('Statistică de bază și Python introductiv.'),
          'true', NULL, NULL, NULL, '60', 'false', ts(-7, 5, '16:00')],
        [MS.andrei, U.andrei,
          q('Portofoliu de product design: studii de caz, Figma, pregătire de interviu.'),
          NULL, NULL, 'false', '15000', NULL, NULL, '60', 'false', NULL],
      ]));

    await run(insert('availability_slots', ['id', 'mentor_id', 'day_of_week', 'start_time', 'end_time'], [
      [id(T.slots, 1), U.mihai, '1', q('18:00'), q('20:00')],
      [id(T.slots, 2), U.mihai, '4', q('19:00'), q('21:00')],
      [id(T.slots, 3), U.ioana, '2', q('17:00'), q('20:00')],
      [id(T.slots, 4), U.ioana, '6', q('10:00'), q('13:00')],
      [id(T.slots, 5), U.elena, '3', q('18:00'), q('20:00')],
      [id(T.slots, 6), U.andrei, '5', q('16:00'), q('18:00')],
    ]));

    await run(insert('mentorship_questions', ['id', 'mentorship_id', 'kind', 'prompt', 'position'], [
      [Q(1), MS.mihai, q('APPLICATION'), q('Ce experiență ai până acum în marketing (cursuri, proiecte, voluntariat)?'), '1'],
      [Q(2), MS.mihai, q('APPLICATION'), q('Ce obiectiv concret vrei să atingi în următoarele 3 luni?'), '2'],
      [Q(3), MS.mihai, q('APPLICATION'), q('Cât timp pe săptămână poți aloca mentoratului, în afara ședințelor?'), '3'],
      [Q(4), MS.mihai, q('TEST'), q('Explică diferența dintre reach și impresii și când ai folosi fiecare metrică.'), '1'],
      [Q(5), MS.mihai, q('TEST'), q('Propune o idee de campanie pentru o cafenea locală cu un buget de 1.000 RON pe lună.'), '2'],
      [Q(6), MS.ioana, q('APPLICATION'), q('Ce limbaje sau tehnologii ai folosit până acum?'), '1'],
      [Q(7), MS.ioana, q('APPLICATION'), q('Ai un proiect pe GitHub pe care mi-l poți arăta?'), '2'],
      [Q(8), MS.elena, q('APPLICATION'), q('De ce te interesează Data Science și ce ai încercat până acum?'), '1'],
    ]));

    await run(insert('study_materials', ['id', 'mentorship_id', 'title', 'kind', 'file_id', 'url', 'position'], [
      [id(T.materials, 1), MS.mihai, q('Ghid: bazele marketingului digital'), q('FILE'), F(7), NULL, '1'],
      [id(T.materials, 2), MS.mihai, q('Curs online: metrici de social media'), q('LINK'), NULL, q('https://example.com/curs-metrici-social-media'), '2'],
    ]));

    // =========================================================== applications
    await run(insert('applications', ['id', 'mentee_id', 'mentorship_id', 'status', 'rejection_reason', 'submitted_at', 'decided_at', 'created_at'], [
      [A.anaMihai, U.ana, MS.mihai, q('ACCEPTED'), NULL, ts(-4, 2, '12:00'), ts(-4, 3, '09:30'), ts(-4, 2, '12:00')],
      [A.vladIoana, U.vlad, MS.ioana, q('ACCEPTED'), NULL, ts(-5, 1, '20:00'), ts(-4, 2, '08:00'), ts(-5, 1, '20:00')],
      [A.mariaRejected, U.maria, MS.mihai, q('REJECTED'),
        q('Răspunsurile la test arată că încă nu ești familiarizată cu metricile de bază (reach, impresii, CTR). Parcurge materialele de studiu, încearcă să rulezi o mică campanie de test și aplică din nou.'),
        ts(-3, 1, '18:00'), ts(-3, 2, '10:00'), ts(-3, 1, '18:00')],
      [A.mariaPending, U.maria, MS.mihai, q('PENDING'), NULL, ts(-1, 5, '21:00'), NULL, ts(-1, 5, '21:00')],
      [A.cristiElena, U.cristi, MS.elena, q('ACCEPTED'), NULL, ts(-4, 3, '15:00'), ts(-4, 4, '09:00'), ts(-4, 3, '15:00')],
    ]));

    const ans = (n: number, app: string, qid: string, kind: string, text: string, answer: string, pos: number) =>
      [id(T.answers, n), app, qid, q(kind), q(text), q(answer), String(pos)];
    await run(insert('application_answers', ['id', 'application_id', 'question_id', 'question_kind', 'question_text', 'answer_text', 'position'], [
      ans(1, A.anaMihai, Q(1), 'APPLICATION', 'Ce experiență ai până acum în marketing (cursuri, proiecte, voluntariat)?', 'Am administrat paginile de Instagram ale asociației studenților și am terminat un curs online de social media.', 1),
      ans(2, A.anaMihai, Q(2), 'APPLICATION', 'Ce obiectiv concret vrei să atingi în următoarele 3 luni?', 'Să am 2 proiecte în portofoliu și să aplic la un internship de marketing.', 2),
      ans(3, A.anaMihai, Q(3), 'APPLICATION', 'Cât timp pe săptămână poți aloca mentoratului, în afara ședințelor?', 'Aproximativ 5 ore pe săptămână.', 3),
      ans(4, A.anaMihai, Q(4), 'TEST', 'Explică diferența dintre reach și impresii și când ai folosi fiecare metrică.', 'Reach = câte persoane unice au văzut conținutul; impresii = de câte ori a fost afișat. Reach pentru notorietate, impresii pentru frecvență.', 4),
      ans(5, A.anaMihai, Q(5), 'TEST', 'Propune o idee de campanie pentru o cafenea locală cu un buget de 1.000 RON pe lună.', 'Reels săptămânale cu barista + anunțuri locale pe o rază de 3 km, cu o ofertă „a doua cafea la jumătate de preț” pentru studenți.', 5),
      ans(6, A.vladIoana, Q(6), 'APPLICATION', 'Ce limbaje sau tehnologii ai folosit până acum?', 'JavaScript, puțin TypeScript, Express și MongoDB.', 1),
      ans(7, A.vladIoana, Q(7), 'APPLICATION', 'Ai un proiect pe GitHub pe care mi-l poți arăta?', 'Da, o aplicație de tip to-do cu Express: https://github.com/demo-vlad/todo-api', 2),
      ans(8, A.mariaRejected, Q(1), 'APPLICATION', 'Ce experiență ai până acum în marketing (cursuri, proiecte, voluntariat)?', 'Lucrez în vânzări de 2 ani.', 1),
      ans(9, A.mariaRejected, Q(2), 'APPLICATION', 'Ce obiectiv concret vrei să atingi în următoarele 3 luni?', 'Să mă angajez în marketing.', 2),
      ans(10, A.mariaRejected, Q(3), 'APPLICATION', 'Cât timp pe săptămână poți aloca mentoratului, în afara ședințelor?', '2 ore.', 3),
      ans(11, A.mariaRejected, Q(4), 'TEST', 'Explică diferența dintre reach și impresii și când ai folosi fiecare metrică.', 'Sunt cam același lucru.', 4),
      ans(12, A.mariaRejected, Q(5), 'TEST', 'Propune o idee de campanie pentru o cafenea locală cu un buget de 1.000 RON pe lună.', 'Flyere.', 5),
      ans(13, A.mariaPending, Q(1), 'APPLICATION', 'Ce experiență ai până acum în marketing (cursuri, proiecte, voluntariat)?', 'Am parcurs materialele recomandate și am rulat o campanie de test de 100 RON pentru magazinul unei prietene.', 1),
      ans(14, A.mariaPending, Q(2), 'APPLICATION', 'Ce obiectiv concret vrei să atingi în următoarele 3 luni?', 'Să obțin un post de junior marketing specialist.', 2),
      ans(15, A.mariaPending, Q(3), 'APPLICATION', 'Cât timp pe săptămână poți aloca mentoratului, în afara ședințelor?', '4–5 ore.', 3),
      ans(16, A.mariaPending, Q(4), 'TEST', 'Explică diferența dintre reach și impresii și când ai folosi fiecare metrică.', 'Reach numără persoanele unice, impresiile numără afișările. În campania mea am avut 2.300 reach și 5.100 impresii.', 4),
      ans(17, A.mariaPending, Q(5), 'TEST', 'Propune o idee de campanie pentru o cafenea locală cu un buget de 1.000 RON pe lună.', 'Concurs de UGC pe Instagram + anunțuri locale cu ofertă de dimineață.', 5),
      ans(18, A.cristiElena, Q(8), 'APPLICATION', 'De ce te interesează Data Science și ce ai încercat până acum?', 'Mi-au plăcut proiectele de statistică de la facultate; am făcut un notebook de analiză pe date publice despre transport.', 1),
    ]));

    await run(insert('application_mentee_questions', ['id', 'application_id', 'position', 'question_text', 'mentor_answer', 'answered_at'], [
      [id(T.menteeQuestions, 1), A.anaMihai, '1', q('Lucrăm și pe TikTok sau doar pe Meta?'), q('Pe ambele – alegem în funcție de proiectul tău.'), ts(-4, 3, '09:20')],
      [id(T.menteeQuestions, 2), A.anaMihai, '2', q('Pot aduce un proiect al meu (pagina asociației)?'), q('Da, e chiar ideal ca prim proiect.'), ts(-4, 3, '09:25')],
      [id(T.menteeQuestions, 3), A.mariaPending, '1', q('Mă pot pregăti pentru un interviu în paralel cu mentoratul?'), NULL, NULL],
    ]));

    // ============================================== enrolments & subscription
    await run(insert('enrolments', ['id', 'mentee_id', 'mentorship_id', 'application_id', 'plan', 'status', 'started_at', 'created_at'], [
      [E.ana, U.ana, MS.mihai, A.anaMihai, q('MONTHLY'), q('ACTIVE'), PERIOD_START, PERIOD_START],
      [E.vlad, U.vlad, MS.ioana, A.vladIoana, q('PER_SESSION'), q('ACTIVE'), ts(-2, 5, '20:05'), ts(-2, 5, '20:00')],
      [E.cristi, U.cristi, MS.elena, A.cristiElena, q('SPONSORED'), q('ACTIVE'), ts(-3, 2, '10:00'), ts(-3, 2, '10:00')],
    ]));

    await run(insert('subscriptions', ['id', 'enrolment_id', 'stripe_subscription_id', 'status', 'price_bani', 'sessions_per_period', 'current_period_start', 'current_period_end', 'created_at'], [
      [SUB, E.ana, q('sub_demo_ana_mihai'), q('ACTIVE'), '43200', '4', PERIOD_START, PERIOD_END, PERIOD_START],
    ]));

    // =============================================================== sessions
    const sess = (n: number, type: string, status: string, mentor: string, mentee: string, enrolment: string, application: string,
      start: string, end: string, subscription = false, bookedAt: string = NULL) => [
      S(n), q(type), q(status), mentor, mentee, enrolment, application, start, end,
      subscription ? SUB : NULL, subscription ? PERIOD_START : NULL,
      q(`https://meet.google.com/demo-${String(n).padStart(3, '0')}-mtly`), q(`demo_gcal_event_${n}`), q('OK'),
      status === 'HELD' ? `(${end} + interval '5 minutes')` : NULL,
      bookedAt,
    ];
    await run(insert('sessions',
      ['id', 'type', 'status', 'mentor_id', 'mentee_id', 'enrolment_id', 'application_id', 'starts_at', 'ends_at', 'subscription_id', 'billing_period_start', 'meet_url', 'google_event_id', 'meet_sync_status', 'held_at', 'created_at'],
      [
        // Ana & Mihai: free call, then monthly plan (3 of 4 sessions used in the current cycle)
        sess(1, 'FREE_CALL', 'HELD', U.mihai, U.ana, NULL, A.anaMihai, ts(-3, 4, '19:00'), ts(-3, 4, '20:00'), false, ts(-4, 3, '12:00')),
        sess(2, 'PAID', 'HELD', U.mihai, U.ana, E.ana, NULL, ts(-2, 1, '18:00'), ts(-2, 1, '19:00'), true, ts(-2, 1, '10:05')),
        sess(3, 'PAID', 'HELD', U.mihai, U.ana, E.ana, NULL, ts(-1, 4, '19:00'), ts(-1, 4, '20:00'), true, ts(-2, 1, '10:06')),
        sess(4, 'PAID', 'SCHEDULED', U.mihai, U.ana, E.ana, NULL, ts(1, 1, '18:00'), ts(1, 1, '19:00'), true, ts(-1, 4, '20:30')),
        // Vlad & Ioana: free call, then pay per session
        sess(5, 'FREE_CALL', 'HELD', U.ioana, U.vlad, NULL, A.vladIoana, ts(-3, 2, '17:00'), ts(-3, 2, '18:00'), false, ts(-4, 2, '09:00')),
        sess(6, 'PAID', 'HELD', U.ioana, U.vlad, E.vlad, NULL, ts(-1, 6, '10:00'), ts(-1, 6, '11:00'), false, ts(-2, 5, '20:00')),
        sess(7, 'PAID', 'SCHEDULED', U.ioana, U.vlad, E.vlad, NULL, ts(1, 2, '17:00'), ts(1, 2, '18:00'), false, ts(-1, 7, '11:00')),
        // Cristi & Elena: sponsored, no payments
        sess(8, 'SPONSORED', 'HELD', U.elena, U.cristi, E.cristi, NULL, ts(-2, 3, '18:00'), ts(-2, 3, '19:00'), false, ts(-3, 2, '10:10')),
        sess(9, 'SPONSORED', 'HELD', U.elena, U.cristi, E.cristi, NULL, ts(-1, 3, '18:00'), ts(-1, 3, '19:00'), false, ts(-2, 3, '19:10')),
        sess(10, 'SPONSORED', 'SCHEDULED', U.elena, U.cristi, E.cristi, NULL, ts(1, 3, '18:00'), ts(1, 3, '19:00'), false, ts(-1, 3, '19:10')),
      ]));

    await run(insert('session_reschedules', ['id', 'session_id', 'rescheduled_by_user_id', 'old_starts_at', 'old_ends_at', 'new_starts_at', 'new_ends_at', 'reason', 'created_at'], [
      [id(T.reschedules, 1), S(3), U.mihai, ts(-1, 1, '18:00'), ts(-1, 1, '19:00'), ts(-1, 4, '19:00'), ts(-1, 4, '20:00'),
        q('Prezentare la client luni seara – ne-am înțeles în grupul privat să mutăm pe joi.'), ts(-2, 5, '12:00')],
    ]));

    // reminders (24 h + 1 h) for both participants of every upcoming demo session
    await run(`
      INSERT INTO session_reminders (session_id, user_id, offset_minutes, send_at)
      SELECT s.id, p.user_id, o.minutes, s.starts_at - make_interval(mins => o.minutes)
      FROM sessions s
      CROSS JOIN LATERAL (VALUES (s.mentor_id), (s.mentee_id)) AS p(user_id)
      CROSS JOIN (VALUES (1440), (60)) AS o(minutes)
      WHERE s.status = 'SCHEDULED' AND s.id::text LIKE ${PATTERN}
    `);

    // ======================================================= payments & payouts
    await run(insert('payments',
      ['id', 'mentee_id', 'mentor_id', 'enrolment_id', 'kind', 'session_id', 'subscription_id', 'period_start', 'period_end', 'amount_bani', 'commission_rate', 'commission_bani', 'status', 'stripe_payment_intent_id', 'stripe_invoice_id', 'paid_at', 'created_at'],
      [
        [P(1), U.ana, U.mihai, E.ana, q('SUBSCRIPTION_INVOICE'), NULL, SUB, PERIOD_START, PERIOD_END, '43200', '0.1500', '6480', q('SUCCEEDED'), NULL, q('in_demo_ana_mihai_1'), PERIOD_START, PERIOD_START],
        [P(2), U.vlad, U.ioana, E.vlad, q('SESSION'), S(6), NULL, NULL, NULL, '20000', '0.1500', '3000', q('SUCCEEDED'), q('pi_demo_vlad_1'), NULL, ts(-2, 5, '20:05'), ts(-2, 5, '20:00')],
        [P(3), U.vlad, U.ioana, E.vlad, q('SESSION'), S(7), NULL, NULL, NULL, '20000', '0.1500', '3000', q('SUCCEEDED'), q('pi_demo_vlad_2'), NULL, ts(-1, 7, '11:05'), ts(-1, 7, '11:00')],
      ]));

    // One payout for Mihai covering the half-month of Ana's first paid session.
    // Paid if that half-month is already over, otherwise still pending.
    await run(`
      WITH p AS (
        SELECT pg_temp.half_month_start((${ts(-2, 1, '18:00')} AT TIME ZONE 'Europe/Bucharest')::date) AS ps,
               pg_temp.half_month_end((${ts(-2, 1, '18:00')} AT TIME ZONE 'Europe/Bucharest')::date)   AS pe
      )
      INSERT INTO payouts (id, mentor_id, period_start, period_end, gross_bani, commission_bani, net_bani, status, stripe_transfer_id, paid_at)
      SELECT ${id(T.payouts, 1)}, ${U.mihai}, ps, pe, 10800, 1620, 9180,
             CASE WHEN pe < current_date THEN 'PAID' ELSE 'PENDING' END,
             CASE WHEN pe < current_date THEN 'tr_demo_mihai_1' END,
             CASE WHEN pe < current_date THEN ((pe + 1) + time '12:00') AT TIME ZONE 'Europe/Bucharest' END
      FROM p
    `);
    await run(insert('payout_items', ['id', 'payout_id', 'session_id', 'payment_id', 'gross_bani', 'commission_bani', 'net_bani'], [
      [id(T.payoutItems, 1), id(T.payouts, 1), S(2), P(1), '10800', '1620', '9180'],
    ]));

    await run(insert('stripe_webhook_events', ['id', 'type', 'payload', 'received_at', 'processed_at'], [
      [q('evt_demo_0001'), q('invoice.paid'), j({ id: 'evt_demo_0001', type: 'invoice.paid', data: { object: { id: 'in_demo_ana_mihai_1', subscription: 'sub_demo_ana_mihai', amount_paid: 43200, currency: 'ron' } } }), PERIOD_START, PERIOD_START],
      [q('evt_demo_0002'), q('payment_intent.succeeded'), j({ id: 'evt_demo_0002', type: 'payment_intent.succeeded', data: { object: { id: 'pi_demo_vlad_1', amount: 20000, currency: 'ron' } } }), ts(-2, 5, '20:05'), ts(-2, 5, '20:05')],
    ]));

    // ===================================================== messaging groups
    const grp = (n: number, type: 'PRIVATE' | 'COHORT', enrolment: string, mentor: string, created: string) =>
      [G(n), q('TELEGRAM'), q(type), enrolment, mentor, q(`demo-tg-${1000 + n}`), q(`https://t.me/+demoMentorly${1000 + n}`), q('OK'), created];
    await run(insert('messaging_groups', ['id', 'provider', 'type', 'enrolment_id', 'mentor_id', 'external_id', 'invite_url', 'sync_status', 'created_at'], [
      grp(1, 'PRIVATE', E.ana, NULL, PERIOD_START),
      grp(2, 'COHORT', NULL, U.mihai, PERIOD_START),
      grp(3, 'PRIVATE', E.vlad, NULL, ts(-2, 5, '20:06')),
      grp(4, 'COHORT', NULL, U.ioana, ts(-2, 5, '20:06')),
      grp(5, 'PRIVATE', E.cristi, NULL, ts(-3, 2, '10:01')),
      grp(6, 'COHORT', NULL, U.elena, ts(-3, 2, '10:01')),
    ]));
    const mem = (n: number, group: string, user: string, role: string, invited: string) =>
      [id(T.members, n), group, user, q(role), invited, `(${invited} + interval '10 minutes')`];
    await run(insert('messaging_group_members', ['id', 'group_id', 'user_id', 'role', 'invited_at', 'joined_at'], [
      mem(1, G(1), U.mihai, 'OWNER', PERIOD_START), mem(2, G(1), U.ana, 'MEMBER', PERIOD_START),
      mem(3, G(2), U.mihai, 'OWNER', PERIOD_START), mem(4, G(2), U.ana, 'MEMBER', PERIOD_START),
      mem(5, G(3), U.ioana, 'OWNER', ts(-2, 5, '20:06')), mem(6, G(3), U.vlad, 'MEMBER', ts(-2, 5, '20:06')),
      mem(7, G(4), U.ioana, 'OWNER', ts(-2, 5, '20:06')), mem(8, G(4), U.vlad, 'MEMBER', ts(-2, 5, '20:06')),
      mem(9, G(5), U.elena, 'OWNER', ts(-3, 2, '10:01')), mem(10, G(5), U.cristi, 'MEMBER', ts(-3, 2, '10:01')),
      mem(11, G(6), U.elena, 'OWNER', ts(-3, 2, '10:01')), mem(12, G(6), U.cristi, 'MEMBER', ts(-3, 2, '10:01')),
    ]));

    // ========================================================== progress
    await run(insert('evaluations', ['id', 'enrolment_id', 'overall_score', 'scale_max', 'explanation', 'next_steps', 'created_at'], [
      [id(T.evaluations, 1), E.ana, '7.5', '10',
        q('Ai progresat mult la strategia de conținut: calendarul tău editorial este coerent și are obiective clare. Analiza rezultatelor este încă la nivel de „like-uri” – trebuie să legi metricile de obiectivele de business.'),
        q('1) Configurează un raport săptămânal cu reach, CTR și conversii. 2) Rescrie 3 postări folosind formula problemă–soluție. 3) Citește capitolul despre atribuire din ghid.'),
        ts(-1, 5, '10:00')],
      [id(T.evaluations, 2), E.cristi, '8.0', '10',
        q('Înțelegi bine statistica descriptivă și ai un notebook curat. Mai ai de lucrat la vizualizări pentru un public non-tehnic.'),
        q('Refă graficele din proiect cu titluri care spun concluzia; încearcă un dashboard simplu în Looker Studio.'),
        ts(-1, 4, '09:00')],
    ]));
    await run(insert('evaluation_scores', ['id', 'evaluation_id', 'criterion', 'score', 'comment', 'position'], [
      [id(T.evalScores, 1), id(T.evaluations, 1), q('Strategie de conținut'), '8.5', q('Calendar editorial foarte bun.'), '1'],
      [id(T.evalScores, 2), id(T.evaluations, 1), q('Analiză și metrici'), '6.0', q('Legătura cu obiectivele lipsește.'), '2'],
      [id(T.evalScores, 3), id(T.evaluations, 1), q('Copywriting'), '8.0', NULL, '3'],
    ]));

    await run(insert('projects', ['id', 'enrolment_id', 'title', 'description', 'due_at', 'status', 'submission_url', 'submitted_at', 'feedback', 'reviewed_at', 'created_at'], [
      [id(T.projects, 1), E.ana, q('Audit de Instagram pentru o cafenea'),
        q('Analizează ultimele 30 de postări ale unei cafenele locale: ce funcționează, ce nu, 5 recomandări concrete.'),
        ts(-1, 3, '23:59'), q('REVIEWED'), q('https://docs.google.com/document/d/demo-ana-audit'), ts(-1, 2, '21:00'),
        q('Structură foarte bună și recomandări aplicabile. Data viitoare susține fiecare recomandare cu o cifră din analiză.'),
        ts(-1, 4, '18:30'), ts(-2, 1, '19:05')],
      [id(T.projects, 2), E.ana, q('Calendar editorial pe o lună'),
        q('Construiește un calendar editorial pe 4 săptămâni pentru pagina asociației, cu obiectiv și metrică pentru fiecare postare.'),
        ts(2, 5, '23:59'), q('IN_PROGRESS'), NULL, NULL, NULL, NULL, ts(-1, 4, '20:05')],
      [id(T.projects, 3), E.vlad, q('API REST cu NestJS'),
        q('Un API CRUD pentru task-uri cu NestJS, validare DTO, PostgreSQL și teste e2e.'),
        ts(1, 1, '23:59'), q('SUBMITTED'), q('https://github.com/demo-vlad/nest-tasks-api'), ts(-1, 7, '22:00'), NULL, NULL, ts(-1, 6, '11:05')],
      [id(T.projects, 4), E.cristi, q('Analiză exploratorie: transport public'),
        q('Analizează setul de date despre punctualitatea transportului public și prezintă 3 concluzii.'),
        NULL, q('IN_PROGRESS'), NULL, NULL, NULL, NULL, ts(-1, 3, '19:05')],
    ]));

    await run(insert('goals', ['id', 'enrolment_id', 'text', 'created_by_user_id', 'completed_at', 'completed_by_user_id', 'position'], [
      [id(T.goals, 1), E.ana, q('Să îmi refac CV-ul pentru un post de junior marketing'), U.mihai, ts(-1, 6, '12:00'), U.ana, '1'],
      [id(T.goals, 2), E.ana, q('Să rulez o campanie de test cu un buget de 200 RON'), U.mihai, NULL, NULL, '2'],
      [id(T.goals, 3), E.ana, q('Să aplic la 3 internshipuri de marketing'), U.ana, NULL, NULL, '3'],
      [id(T.goals, 4), E.vlad, q('Primul proiect NestJS publicat pe GitHub'), U.ioana, ts(-1, 7, '22:00'), U.ioana, '1'],
      [id(T.goals, 5), E.cristi, q('Să aleg între data analysis și data engineering'), U.cristi, NULL, NULL, '1'],
    ]));

    // ===================================================== ratings & reviews
    await run(insert('session_ratings', ['session_id', 'mentee_id', 'mentor_id', 'stars', 'created_at'], [
      [S(2), U.ana, U.mihai, '5', ts(-2, 1, '19:30')],
      [S(3), U.ana, U.mihai, '5', ts(-1, 4, '20:30')],
      [S(6), U.vlad, U.ioana, '4', ts(-1, 6, '12:00')],
      [S(8), U.cristi, U.elena, '5', ts(-2, 3, '19:20')],
      [S(9), U.cristi, U.elena, '4', ts(-1, 3, '19:20')],
    ]));

    const review = (n: number, enrolment: string, mentee: string, mentor: string, stars: number[], texts: string[], created: string) => [
      id(T.reviews, n), enrolment, mentee, mentor,
      String(stars[0]), q(texts[0]), String(stars[1]), q(texts[1]), String(stars[2]), q(texts[2]), String(stars[3]), q(texts[3]), created,
    ];
    await run(insert('reviews',
      ['id', 'enrolment_id', 'mentee_id', 'mentor_id', 'communication_stars', 'communication_text', 'expertise_stars', 'expertise_text', 'punctuality_stars', 'punctuality_text', 'impact_stars', 'impact_text', 'created_at'],
      [
        review(1, E.ana, U.ana, U.mihai, [5, 5, 4, 5], [
          'Explică foarte clar și răspunde repede în grupul privat.',
          'Are exemple reale din campaniile lui pentru orice întrebare.',
          'A mutat o ședință, dar a anunțat din timp și am găsit imediat altă oră.',
          'După o lună am primul proiect serios în portofoliu.',
        ], ts(-1, 7, '18:00')),
        review(2, E.vlad, U.vlad, U.ioana, [4, 5, 4, 4], [
          'Feedback direct și concret pe cod, uneori răspunde mai târziu seara.',
          'Știe foarte bine NestJS și arhitectura de backend.',
          'Ședințele încep la fix și sunt bine pregătite.',
          'Am înțeles în sfârșit cum se structurează un proiect real.',
        ], ts(-1, 7, '12:00')),
        review(3, E.cristi, U.cristi, U.elena, [5, 5, 5, 4], [
          'Foarte răbdătoare și clară, chiar și cu întrebările de bază.',
          'Lucrează zilnic cu date reale și se vede.',
          'Mereu la timp, cu agenda pregătită.',
          'M-a ajutat să îmi aleg direcția; încă lucrez la proiect.',
        ], ts(-1, 3, '20:00')),
      ]));

    // cached aggregates for every demo mentor (NULL averages = "new" mentor)
    await run(`
      INSERT INTO mentor_rating_stats (
        mentor_id, review_count, avg_overall, avg_communication, avg_expertise, avg_punctuality, avg_impact,
        session_rating_count, avg_session_stars)
      SELECT mp.user_id,
             (SELECT count(*) FROM reviews r WHERE r.mentor_id = mp.user_id),
             (SELECT round(avg(r.overall_score), 2) FROM reviews r WHERE r.mentor_id = mp.user_id),
             (SELECT round(avg(r.communication_stars), 2) FROM reviews r WHERE r.mentor_id = mp.user_id),
             (SELECT round(avg(r.expertise_stars), 2) FROM reviews r WHERE r.mentor_id = mp.user_id),
             (SELECT round(avg(r.punctuality_stars), 2) FROM reviews r WHERE r.mentor_id = mp.user_id),
             (SELECT round(avg(r.impact_stars), 2) FROM reviews r WHERE r.mentor_id = mp.user_id),
             (SELECT count(*) FROM session_ratings sr WHERE sr.mentor_id = mp.user_id),
             (SELECT round(avg(sr.stars), 2) FROM session_ratings sr WHERE sr.mentor_id = mp.user_id)
      FROM mentor_profiles mp
      WHERE mp.user_id::text LIKE ${PATTERN}
    `);

    // ================================================== sponsored program
    await run(insert('sponsored_program_applications', ['id', 'mentee_id', 'answers', 'status', 'decided_at', 'decision_note', 'created_at'], [
      [id(T.sponsoredApps, 1), U.cristi, j({ motivatie: 'Nu îmi permit acum un mentorat plătit, dar vreau să intru în data.', situatie: 'Student, anul 3', domeniu_dorit: 'data-ai' }),
        q('SELECTED'), ts(-5, 5, '11:00'), q('Motivație clară, domeniu acoperit de Nordwave.'), ts(-7, 4, '13:30')],
      [id(T.sponsoredApps, 2), U.maria, j({ motivatie: 'Vreau să mă reprofilez din vânzări în marketing.', situatie: 'Angajată, venit redus', domeniu_dorit: 'marketing' }),
        q('IN_REVIEW'), NULL, NULL, ts(-1, 6, '10:30')],
    ]));

    // ======================================================== notifications
    const notif = (n: number, user: string, type: string, title: string, body: string, link: string, entityType: string, entityId: string, created: string, read: boolean) =>
      [N(n), user, q(type), q(title), q(body), q(link), q(entityType), entityId, created, read ? `(${created} + interval '2 hours')` : NULL];
    await run(insert('notifications', ['id', 'user_id', 'type', 'title', 'body', 'link_path', 'entity_type', 'entity_id', 'created_at', 'read_at'], [
      notif(1, U.ana, 'APPLICATION_ACCEPTED', 'Mihai ți-a acceptat aplicarea', 'Poți programa callul introductiv gratuit.', `/aplicari/${A.anaMihai.slice(1, -1)}`, 'application', A.anaMihai, ts(-4, 3, '09:30'), true),
      notif(2, U.ana, 'ENROLMENT_CONFIRMED', 'Înrolare confirmată', 'Abonamentul lunar este activ. Linkurile de grup sunt gata.', `/mentorate/${E.ana.slice(1, -1)}`, 'enrolment', E.ana, PERIOD_START, true),
      notif(3, U.ana, 'SESSION_RESCHEDULED', 'Ședință reprogramată', 'Mihai a mutat ședința de luni pe joi, ora 19:00.', `/sedinte/${S(3).slice(1, -1)}`, 'session', S(3), ts(-2, 5, '12:00'), true),
      notif(4, U.ana, 'EVALUATION_CREATED', 'Evaluare nouă de la Mihai', 'Vezi nota și pașii următori.', `/mentorate/${E.ana.slice(1, -1)}/progres`, 'evaluation', id(T.evaluations, 1), ts(-1, 5, '10:00'), false),
      notif(5, U.ana, 'PROJECT_FEEDBACK', 'Feedback la proiect', 'Mihai a lăsat feedback la „Audit de Instagram pentru o cafenea”.', `/proiecte/${id(T.projects, 1).slice(1, -1)}`, 'project', id(T.projects, 1), ts(-1, 4, '18:30'), false),
      notif(6, U.mihai, 'APPLICATION_RECEIVED', 'Aplicare nouă de la Maria Tudor', 'Maria a aplicat din nou la mentoratul tău.', `/aplicari/${A.mariaPending.slice(1, -1)}`, 'application', A.mariaPending, ts(-1, 5, '21:00'), false),
      notif(7, U.mihai, 'PROJECT_SUBMITTED', 'Proiect trimis', 'Ana a trimis „Audit de Instagram pentru o cafenea”.', `/proiecte/${id(T.projects, 1).slice(1, -1)}`, 'project', id(T.projects, 1), ts(-1, 2, '21:00'), true),
      notif(8, U.vlad, 'RATING_REQUESTED', 'Cum a fost ședința cu Ioana?', 'Dă o notă rapidă ședinței de sâmbătă.', `/sedinte/${S(6).slice(1, -1)}`, 'session', S(6), ts(-1, 6, '11:05'), true),
      notif(9, U.maria, 'APPLICATION_REJECTED', 'Răspuns la aplicarea ta', 'Mihai ți-a explicat ce să îmbunătățești. Poți aplica din nou oricând.', `/aplicari/${A.mariaRejected.slice(1, -1)}`, 'application', A.mariaRejected, ts(-3, 2, '10:00'), true),
      notif(10, U.radu, 'MENTOR_REJECTED', 'Rezultatul verificării contului', 'Aplicarea ta de mentor nu a fost aprobată. Vezi motivul în email.', '/mentor/cont', 'mentor_profile', U.radu, ts(-6, 2, '10:00'), true),
      notif(11, U.cristi, 'SPONSORED_PROGRAM_DECIDED', 'Ai fost selectat în programul sponsorizat', 'Poți aplica acum la mentorii sponsorizați.', '/program-sponsorizat', 'sponsored_program_application', id(T.sponsoredApps, 1), ts(-5, 5, '11:00'), true),
    ]));

    await run(insert('email_outbox', ['id', 'user_id', 'notification_id', 'to_email', 'template', 'payload', 'status', 'attempts', 'send_after', 'sent_at', 'provider_message_id', 'created_at'], [
      [id(T.emails, 1), U.ana, N(1), q('ana.georgescu@example.com'), q('application_accepted'), j({ mentorName: 'Mihai Popescu' }), q('SENT'), '1', ts(-4, 3, '09:30'), ts(-4, 3, '09:31'), q('demo-msg-0001'), ts(-4, 3, '09:30')],
      [id(T.emails, 2), U.maria, N(9), q('maria.tudor@example.com'), q('application_rejected'), j({ mentorName: 'Mihai Popescu' }), q('SENT'), '1', ts(-3, 2, '10:00'), ts(-3, 2, '10:01'), q('demo-msg-0002'), ts(-3, 2, '10:00')],
      [id(T.emails, 3), U.radu, N(10), q('radu.ionescu@example.com'), q('mentor_rejected'), j({ reason: 'Profilul LinkedIn nu este actualizat.' }), q('SENT'), '1', ts(-6, 2, '10:00'), ts(-6, 2, '10:00'), q('demo-msg-0003'), ts(-6, 2, '10:00')],
      [id(T.emails, 4), U.ana, N(4), q('ana.georgescu@example.com'), q('evaluation_created'), j({ mentorName: 'Mihai Popescu' }), q('FAILED'), '3', ts(-1, 5, '10:00'), NULL, NULL, ts(-1, 5, '10:00')],
    ]));
    await run(`UPDATE email_outbox SET last_error = 'SMTP 421: service not available (demo)' WHERE id = ${id(T.emails, 4)}`);

    // ======================================================= testimonials
    await run(insert('platform_testimonials', ['id', 'author_name', 'author_role', 'quote', 'rating', 'position'], [
      [id(T.testimonials, 1), q('Exemplu – Ana G.'), q('Cursantă, Marketing (date demo)'), q('Text demonstrativ pentru secțiunea de recenzii – înlocuiți cu o recenzie reală.'), '5', '1'],
      [id(T.testimonials, 2), q('Exemplu – Vlad P.'), q('Cursant, IT (date demo)'), q('Text demonstrativ pentru secțiunea de recenzii – înlocuiți cu o recenzie reală.'), '5', '2'],
      [id(T.testimonials, 3), q('Exemplu – Ioana D.'), q('Mentoră, IT (date demo)'), q('Text demonstrativ pentru secțiunea de recenzii – înlocuiți cu o recenzie reală.'), NULL, '3'],
    ]));

    // ========================================================= admin audit
    await run(insert('admin_audit_log', ['id', 'actor', 'action', 'entity_type', 'entity_id', 'before', 'after', 'note', 'created_at'], [
      [id(T.audit, 1), q('admin@example.com'), q('MENTOR_APPROVED'), q('mentor_profile'), U.mihai, j({ status: 'PENDING' }), j({ status: 'APPROVED' }), q('LinkedIn actualizat, CV și certificat verificate.'), ts(-8, 2, '11:00')],
      [id(T.audit, 2), q('admin@example.com'), q('MENTOR_APPROVED'), q('mentor_profile'), U.ioana, j({ status: 'PENDING' }), j({ status: 'APPROVED' }), NULL, ts(-8, 3, '10:00')],
      [id(T.audit, 3), q('admin@example.com'), q('MENTOR_REJECTED'), q('mentor_profile'), U.radu, j({ status: 'PENDING' }), j({ status: 'REJECTED' }), q('LinkedIn neactualizat din 2019.'), ts(-6, 2, '10:00')],
      [id(T.audit, 4), q('admin@example.com'), q('SPONSOR_LINKED'), q('mentor_profile'), U.elena, j({ sponsor_id: null }), j({ sponsor_slug: 'nordwave-software' }), NULL, ts(-7, 5, '14:55')],
      [id(T.audit, 5), q('admin@example.com'), q('MENTOR_APPROVED'), q('mentor_profile'), U.elena, j({ status: 'PENDING' }), j({ status: 'APPROVED' }), q('Angajată Nordwave, confirmat de companie.'), ts(-7, 5, '15:00')],
      [id(T.audit, 6), q('admin@example.com'), q('BENEFICIARY_SELECTED'), q('sponsored_program_application'), id(T.sponsoredApps, 1), j({ status: 'IN_REVIEW' }), j({ status: 'SELECTED' }), NULL, ts(-5, 5, '11:00')],
    ]));

    await run(`DROP FUNCTION pg_temp.demo_ts(int, int, text)`);
    await run(`DROP FUNCTION pg_temp.half_month_start(date)`);
    await run(`DROP FUNCTION pg_temp.half_month_end(date)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const del = (table: string, column = 'id') =>
      queryRunner.query(`DELETE FROM ${table} WHERE ${column}::text LIKE ${PATTERN}`);

    await del('admin_audit_log');
    await del('platform_testimonials');
    await del('email_outbox');
    await del('notifications');
    await del('sponsored_program_applications');
    await del('mentor_rating_stats', 'mentor_id');
    await del('reviews');
    await del('session_ratings', 'session_id');
    await del('goals');
    await del('projects');
    await del('evaluation_scores');
    await del('evaluations');
    await del('messaging_group_members');
    await del('messaging_groups');
    await queryRunner.query(`DELETE FROM stripe_webhook_events WHERE id LIKE 'evt_demo_%'`);
    await del('payout_items');
    await del('payouts');
    await del('payments');
    await del('session_reminders', 'session_id');
    await del('session_reschedules');
    await del('sessions');
    await del('subscriptions');
    await del('enrolments');
    await del('application_mentee_questions');
    await del('application_answers');
    await del('applications');
    await del('study_materials');
    await del('mentorship_questions');
    await del('availability_slots');
    await del('mentorships');
    await del('favourites', 'mentee_id');
    await del('mentee_profiles', 'user_id');
    await del('mentor_social_links');
    await del('mentor_credentials');
    await del('mentor_profiles', 'user_id');
    await del('user_auth_providers');
    await del('users');
    await del('sponsors');
    await del('files');
  }
}
