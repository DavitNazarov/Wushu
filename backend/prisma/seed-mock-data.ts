/**
 * Mock data seed for the Georgian Wushu Federation.
 * Covers clubs, coaches, admins, athletes, and a variety of past + future events.
 * Safe to run multiple times — skips seeding if the org slug already exists.
 */
import * as bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) throw new Error('DATABASE_URL is required');

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient(
  { adapter } as ConstructorParameters<typeof PrismaClient>[0],
);

export const ORG_SLUG = 'georgian-wushu-federation';
const DEFAULT_PASSWORD = 'Password123!';

// ---------------------------------------------------------------------------
// Static data tables
// ---------------------------------------------------------------------------

// Countries referenced by clubs (keyed by ISO-3166 alpha-2 code). One default
// Region (named after the country) is created per country, matching the
// Country → Region → Club hierarchy backfilled by the add_country_region migration.
const COUNTRIES: Record<string, { name: string; nameKa: string | null; code: string }> = {
  GE: { name: 'Georgia',    nameKa: 'საქართველო', code: 'GE' },
  AZ: { name: 'Azerbaijan', nameKa: null,          code: 'AZ' },
  TR: { name: 'Türkiye',    nameKa: null,          code: 'TR' },
  AM: { name: 'Armenia',    nameKa: null,          code: 'AM' },
};

const CLUBS = [
  { key: 'tbilisi',  name: 'Tbilisi Wushu Club',          nameKa: 'თბილისის ვუშუს კლუბი',   city: 'Tbilisi',  country: 'GE' },
  { key: 'kutaisi',  name: 'Kutaisi Dragon',               nameKa: 'ქუთაისის დრაკონი',        city: 'Kutaisi',  country: 'GE' },
  { key: 'batumi',   name: 'Batumi Sanda Club',            nameKa: 'ბათუმის სანდა კლუბი',     city: 'Batumi',   country: 'GE' },
  { key: 'rustavi',  name: 'Rustavi Warriors',             nameKa: 'რუსთავის მეომრები',       city: 'Rustavi',  country: 'GE' },
  { key: 'gori',     name: 'Gori Champions',               nameKa: 'გორის ჩემპიონები',        city: 'Gori',     country: 'GE' },
  { key: 'zugdidi',  name: 'Zugdidi Eagles',               nameKa: 'ზუგდიდის არწივები',       city: 'Zugdidi',  country: 'GE' },
  { key: 'telavi',   name: 'Telavi Tigers',                nameKa: 'თელავის ვეფხვები',        city: 'Telavi',   country: 'GE' },
  { key: 'poti',     name: 'Poti Sea Warriors',            nameKa: 'ფოთის ზღვის მეომრები',   city: 'Poti',     country: 'GE' },
  { key: 'baku',     name: 'Baku Wushu Club',              nameKa: null,                       city: 'Baku',     country: 'AZ' },
  { key: 'ankara',   name: 'Ankara Kung Fu',               nameKa: null,                       city: 'Ankara',   country: 'TR' },
  { key: 'yerevan',  name: 'Yerevan Dragon Club',          nameKa: null,                       city: 'Yerevan',  country: 'AM' },
];

const ADMINS = [
  { email: 'admin@geowushu.ge',          displayName: 'Giorgi Beridze'  },
  { email: 'nino.jgenti@geowushu.ge',    displayName: 'Nino Jgenti'     },
];

// coaches: clubKey links to CLUBS, nationality 'GE' = Georgian ID rules
const COACHES = [
  { email: 'davit.k@tbilisiwushu.ge',   displayName: 'Davit Kvaratskhelia',   clubKey: 'tbilisi', nationality: 'GE'  },
  { email: 'tamar.m@kutaisidragon.ge',  displayName: 'Tamar Megrelidze',      clubKey: 'kutaisi', nationality: 'GE'  },
  { email: 'zaza.g@batumisanda.ge',     displayName: 'Zaza Gogichashvili',    clubKey: 'batumi',  nationality: 'GE'  },
  { email: 'lasha.k@rustavifc.ge',      displayName: 'Lasha Kobiashvili',     clubKey: 'rustavi', nationality: 'GE'  },
  { email: 'ana.ch@gorichamp.ge',       displayName: 'Ana Chikvanaia',        clubKey: 'gori',    nationality: 'GE'  },
  { email: 'irakli.m@zugdidi.ge',       displayName: 'Irakli Mchedlishvili', clubKey: 'zugdidi', nationality: 'GE'  },
  { email: 'shalva.t@telavi.ge',        displayName: 'Shalva Tsikarishvili', clubKey: 'telavi',  nationality: 'GE'  },
  { email: 'koba.d@potiwushu.ge',       displayName: 'Koba Dgebuadze',        clubKey: 'poti',    nationality: 'GE'  },
  { email: 'orkhan.a@bakuwushu.az',     displayName: 'Orkhan Aliyev',         clubKey: 'baku',    nationality: null  },
  { email: 'mehmet.y@ankarakungfu.tr',  displayName: 'Mehmet Yilmaz',         clubKey: 'ankara',  nationality: null  },
  { email: 'armen.g@yerevandragon.am',  displayName: 'Armen Grigoryan',       clubKey: 'yerevan', nationality: null  },
];

// ---------------------------------------------------------------------------
// Athletes — 72 athletes (32 male + 20 female Georgian + 8 international + 12 youth/children)
// documentId: 11-digit numeric string for Georgian athletes; free-text for international
// sex: MALE | FEMALE
// ---------------------------------------------------------------------------
export type AthleteRow = {
  docId: string;
  firstName: string; firstNameKa: string | null;
  lastName: string;  lastNameKa: string | null;
  dob: string;          // YYYY-MM-DD
  clubKey: string;
  sex: 'MALE' | 'FEMALE';
  weightKg: number;     // actual body weight for weigh-in seeding
  categoryGroup: string; // e.g. 'adults-men-sanda'
  categoryWeightName: string; // display name, e.g. '70kg'
};

export const ATHLETES: AthleteRow[] = [
  // ── Children Boys (9-11 in 2025, born 2014-2016) ─────────────────────────
  { docId: '10000000001', firstName: 'Giorgi',   firstNameKa: 'გიორგი',   lastName: 'Maisuradze',     lastNameKa: 'მაისურაძე',     dob: '2015-03-15', clubKey: 'tbilisi',  sex: 'MALE',   weightKg: 28.5, categoryGroup: 'children-boys-sanda', categoryWeightName: '30kg'  },
  { docId: '10000000002', firstName: 'Lasha',    firstNameKa: 'ლაშა',     lastName: 'Dgebuadze',      lastNameKa: 'დგებუაძე',      dob: '2016-07-20', clubKey: 'kutaisi',  sex: 'MALE',   weightKg: 25.8, categoryGroup: 'children-boys-sanda', categoryWeightName: '27kg'  },
  { docId: '10000000003', firstName: 'Sandro',   firstNameKa: 'სანდრო',   lastName: 'Sulaberidze',    lastNameKa: 'სულაბერიძე',    dob: '2014-11-05', clubKey: 'batumi',   sex: 'MALE',   weightKg: 32.1, categoryGroup: 'children-boys-sanda', categoryWeightName: '33kg'  },
  { docId: '10000000004', firstName: 'Nika',     firstNameKa: 'ნიკა',     lastName: 'Mgebrishvili',   lastNameKa: 'მგებრიშვილი',   dob: '2015-09-12', clubKey: 'rustavi',  sex: 'MALE',   weightKg: 29.7, categoryGroup: 'children-boys-sanda', categoryWeightName: '30kg'  },
  { docId: '10000000005', firstName: 'Tornike',  firstNameKa: 'თორნიკე',  lastName: 'Lominadze',      lastNameKa: 'ლომინაძე',      dob: '2016-04-18', clubKey: 'gori',     sex: 'MALE',   weightKg: 26.4, categoryGroup: 'children-boys-sanda', categoryWeightName: '27kg'  },
  { docId: '10000000006', firstName: 'Beka',     firstNameKa: 'ბეკა',     lastName: 'Khmaladze',      lastNameKa: 'ხმალაძე',       dob: '2015-01-22', clubKey: 'zugdidi',  sex: 'MALE',   weightKg: 40.2, categoryGroup: 'children-boys-sanda', categoryWeightName: '42kg'  },
  { docId: '10000000007', firstName: 'Rati',     firstNameKa: 'რატი',     lastName: 'Gabaidze',       lastNameKa: 'გაბაიძე',       dob: '2014-08-30', clubKey: 'telavi',   sex: 'MALE',   weightKg: 36.0, categoryGroup: 'children-boys-sanda', categoryWeightName: '36kg'  },

  // ── Children Girls (9-11 in 2025, born 2014-2016) ─────────────────────────
  { docId: '10000000008', firstName: 'Nino',     firstNameKa: 'ნინო',     lastName: 'Beridze',        lastNameKa: 'ბერიძე',        dob: '2015-02-14', clubKey: 'tbilisi',  sex: 'FEMALE', weightKg: 28.9, categoryGroup: 'children-girls-sanda', categoryWeightName: '30kg'  },
  { docId: '10000000009', firstName: 'Mariami',  firstNameKa: 'მარიამი',  lastName: 'Kvaratskhelia',  lastNameKa: 'კვარაცხელია',   dob: '2016-08-11', clubKey: 'kutaisi',  sex: 'FEMALE', weightKg: 25.3, categoryGroup: 'children-girls-sanda', categoryWeightName: '27kg'  },
  { docId: '10000000010', firstName: 'Salome',   firstNameKa: 'სალომე',   lastName: 'Gogichashvili',  lastNameKa: 'გოგიჩაშვილი',   dob: '2014-06-23', clubKey: 'batumi',   sex: 'FEMALE', weightKg: 32.8, categoryGroup: 'children-girls-sanda', categoryWeightName: '33kg'  },
  { docId: '10000000011', firstName: 'Ana',      firstNameKa: 'ანა',      lastName: 'Chikhladze',     lastNameKa: 'ჩიხლაძე',       dob: '2015-11-07', clubKey: 'rustavi',  sex: 'FEMALE', weightKg: 26.1, categoryGroup: 'children-girls-sanda', categoryWeightName: '27kg'  },
  { docId: '10000000012', firstName: 'Tamar',    firstNameKa: 'თამარი',   lastName: 'Kobiashvili',    lastNameKa: 'კობიაშვილი',    dob: '2016-03-29', clubKey: 'gori',     sex: 'FEMALE', weightKg: 24.0, categoryGroup: 'children-girls-sanda', categoryWeightName: '24kg'  },
  { docId: '10000000013', firstName: 'Elene',    firstNameKa: 'ელენე',    lastName: 'Tskhovrebadze',  lastNameKa: 'ცხოვრებაძე',    dob: '2014-12-03', clubKey: 'zugdidi',  sex: 'FEMALE', weightKg: 39.5, categoryGroup: 'children-girls-sanda', categoryWeightName: '39kg'  },

  // ── Junior Boys (12-14 in 2025, born 2011-2013) ───────────────────────────
  { docId: '10000000014', firstName: 'Davit',    firstNameKa: 'დავით',    lastName: 'Khmaladze',      lastNameKa: 'ხმალაძე',       dob: '2012-02-10', clubKey: 'tbilisi',  sex: 'MALE',   weightKg: 51.5, categoryGroup: 'junior-boys-sanda', categoryWeightName: '52kg'  },
  { docId: '10000000015', firstName: 'Levan',    firstNameKa: 'ლევან',    lastName: 'Gabaidze',       lastNameKa: 'გაბაიძე',       dob: '2013-06-25', clubKey: 'kutaisi',  sex: 'MALE',   weightKg: 47.8, categoryGroup: 'junior-boys-sanda', categoryWeightName: '48kg'  },
  { docId: '10000000016', firstName: 'Bachana',  firstNameKa: 'ბაჩანა',   lastName: 'Chikhladze',     lastNameKa: 'ჩიხლაძე',       dob: '2011-08-14', clubKey: 'batumi',   sex: 'MALE',   weightKg: 55.9, categoryGroup: 'junior-boys-sanda', categoryWeightName: '56kg'  },
  { docId: '10000000017', firstName: 'Giorgi',   firstNameKa: 'გიორგი',   lastName: 'Tsikarishvili',  lastNameKa: 'წიქარიშვილი',   dob: '2012-12-03', clubKey: 'rustavi',  sex: 'MALE',   weightKg: 64.6, categoryGroup: 'junior-boys-sanda', categoryWeightName: '65kg'  },
  { docId: '10000000018', firstName: 'Irakli',   firstNameKa: 'ირაკლი',   lastName: 'Goguadze',       lastNameKa: 'გოგუაძე',       dob: '2013-04-22', clubKey: 'gori',     sex: 'MALE',   weightKg: 44.5, categoryGroup: 'junior-boys-sanda', categoryWeightName: '45kg'  },
  { docId: '10000000019', firstName: 'Zaza',     firstNameKa: 'ზაზა',     lastName: 'Kakhidze',       lastNameKa: 'კახიძე',        dob: '2011-11-17', clubKey: 'zugdidi',  sex: 'MALE',   weightKg: 59.3, categoryGroup: 'junior-boys-sanda', categoryWeightName: '60kg'  },
  { docId: '10000000020', firstName: 'Sandro',   firstNameKa: 'სანდრო',   lastName: 'Tskhovrebadze',  lastNameKa: 'ცხოვრებაძე',    dob: '2012-07-08', clubKey: 'telavi',   sex: 'MALE',   weightKg: 69.8, categoryGroup: 'junior-boys-sanda', categoryWeightName: '70kg'  },
  { docId: '10000000021', firstName: 'Nika',     firstNameKa: 'ნიკა',     lastName: 'Maisuradze',     lastNameKa: 'მაისურაძე',     dob: '2013-01-30', clubKey: 'poti',     sex: 'MALE',   weightKg: 74.5, categoryGroup: 'junior-boys-sanda', categoryWeightName: '75kg'  },
  { docId: '10000000022', firstName: 'Akaki',    firstNameKa: 'აკაკი',    lastName: 'Mgebrishvili',   lastNameKa: 'მგებრიშვილი',   dob: '2011-05-19', clubKey: 'zugdidi',  sex: 'MALE',   weightKg: 41.9, categoryGroup: 'junior-boys-sanda', categoryWeightName: '42kg'  },

  // ── Junior Girls (12-14 in 2025, born 2011-2013) ──────────────────────────
  { docId: '10000000023', firstName: 'Nino',     firstNameKa: 'ნინო',     lastName: 'Chikvanaia',     lastNameKa: 'ჩიქვანაია',     dob: '2012-05-18', clubKey: 'tbilisi',  sex: 'FEMALE', weightKg: 47.5, categoryGroup: 'junior-girls-sanda', categoryWeightName: '48kg'  },
  { docId: '10000000024', firstName: 'Mariami',  firstNameKa: 'მარიამი',  lastName: 'Mchedlishvili',  lastNameKa: 'მჭედლიშვილი',   dob: '2013-09-03', clubKey: 'kutaisi',  sex: 'FEMALE', weightKg: 51.8, categoryGroup: 'junior-girls-sanda', categoryWeightName: '52kg'  },
  { docId: '10000000025', firstName: 'Salome',   firstNameKa: 'სალომე',   lastName: 'Dgebuadze',      lastNameKa: 'დგებუაძე',      dob: '2011-12-11', clubKey: 'batumi',   sex: 'FEMALE', weightKg: 44.8, categoryGroup: 'junior-girls-sanda', categoryWeightName: '45kg'  },
  { docId: '10000000026', firstName: 'Ana',      firstNameKa: 'ანა',      lastName: 'Sulaberidze',    lastNameKa: 'სულაბერიძე',    dob: '2012-04-07', clubKey: 'rustavi',  sex: 'FEMALE', weightKg: 59.6, categoryGroup: 'junior-girls-sanda', categoryWeightName: '60kg'  },
  { docId: '10000000027', firstName: 'Tamar',    firstNameKa: 'თამარი',   lastName: 'Gabaidze',       lastNameKa: 'გაბაიძე',       dob: '2013-07-22', clubKey: 'gori',     sex: 'FEMALE', weightKg: 41.4, categoryGroup: 'junior-girls-sanda', categoryWeightName: '42kg'  },
  { docId: '10000000028', firstName: 'Ekaterine',firstNameKa: 'ეკატერინე',lastName: 'Lominadze',      lastNameKa: 'ლომინაძე',      dob: '2011-10-15', clubKey: 'zugdidi',  sex: 'FEMALE', weightKg: 55.2, categoryGroup: 'junior-girls-sanda', categoryWeightName: '56kg'  },

  // ── Youth Boys (15-17 in 2025, born 2008-2010) ───────────────────────────
  { docId: '10000000029', firstName: 'Davit',    firstNameKa: 'დავით',    lastName: 'Beridze',        lastNameKa: 'ბერიძე',        dob: '2009-03-22', clubKey: 'tbilisi',  sex: 'MALE',   weightKg: 64.7, categoryGroup: 'youth-boys-sanda', categoryWeightName: '65kg'  },
  { docId: '10000000030', firstName: 'Giorgi',   firstNameKa: 'გიორგი',   lastName: 'Kvaratskhelia',  lastNameKa: 'კვარაცხელია',   dob: '2010-08-15', clubKey: 'tbilisi',  sex: 'MALE',   weightKg: 69.3, categoryGroup: 'youth-boys-sanda', categoryWeightName: '70kg'  },
  { docId: '10000000031', firstName: 'Lasha',    firstNameKa: 'ლაშა',     lastName: 'Megrelidze',     lastNameKa: 'მეგრელიძე',     dob: '2008-12-07', clubKey: 'kutaisi',  sex: 'MALE',   weightKg: 74.9, categoryGroup: 'youth-boys-sanda', categoryWeightName: '75kg'  },
  { docId: '10000000032', firstName: 'Tornike',  firstNameKa: 'თორნიკე',  lastName: 'Gogichashvili',  lastNameKa: 'გოგიჩაშვილი',   dob: '2009-06-11', clubKey: 'batumi',   sex: 'MALE',   weightKg: 59.9, categoryGroup: 'youth-boys-sanda', categoryWeightName: '60kg'  },
  { docId: '10000000033', firstName: 'Irakli',   firstNameKa: 'ირაკლი',   lastName: 'Kobiashvili',    lastNameKa: 'კობიაშვილი',    dob: '2010-02-28', clubKey: 'rustavi',  sex: 'MALE',   weightKg: 51.6, categoryGroup: 'youth-boys-sanda', categoryWeightName: '52kg'  },
  { docId: '10000000034', firstName: 'Levan',    firstNameKa: 'ლევან',    lastName: 'Chikvanaia',     lastNameKa: 'ჩიქვანაია',     dob: '2008-09-19', clubKey: 'gori',     sex: 'MALE',   weightKg: 79.5, categoryGroup: 'youth-boys-sanda', categoryWeightName: '80kg'  },
  { docId: '10000000035', firstName: 'Sandro',   firstNameKa: 'სანდრო',   lastName: 'Mchedlishvili',  lastNameKa: 'მჭედლიშვილი',   dob: '2009-11-04', clubKey: 'zugdidi',  sex: 'MALE',   weightKg: 55.8, categoryGroup: 'youth-boys-sanda', categoryWeightName: '56kg'  },
  { docId: '10000000036', firstName: 'Bachana',  firstNameKa: 'ბაჩანა',   lastName: 'Lominadze',      lastNameKa: 'ლომინაძე',      dob: '2010-05-23', clubKey: 'telavi',   sex: 'MALE',   weightKg: 84.3, categoryGroup: 'youth-boys-sanda', categoryWeightName: '85kg'  },
  { docId: '10000000037', firstName: 'Gela',     firstNameKa: 'გელა',     lastName: 'Kakhidze',       lastNameKa: 'კახიძე',        dob: '2008-07-16', clubKey: 'poti',     sex: 'MALE',   weightKg: 89.7, categoryGroup: 'youth-boys-sanda', categoryWeightName: '90kg'  },

  // ── Youth Girls (15-17 in 2025, born 2008-2010) ───────────────────────────
  { docId: '10000000038', firstName: 'Nino',     firstNameKa: 'ნინო',     lastName: 'Chikhladze',     lastNameKa: 'ჩიხლაძე',       dob: '2009-04-30', clubKey: 'tbilisi',  sex: 'FEMALE', weightKg: 51.9, categoryGroup: 'youth-girls-sanda', categoryWeightName: '52kg'  },
  { docId: '10000000039', firstName: 'Mariami',  firstNameKa: 'მარიამი',  lastName: 'Tsikarishvili',  lastNameKa: 'წიქარიშვილი',   dob: '2010-11-14', clubKey: 'kutaisi',  sex: 'FEMALE', weightKg: 59.4, categoryGroup: 'youth-girls-sanda', categoryWeightName: '60kg'  },
  { docId: '10000000040', firstName: 'Salome',   firstNameKa: 'სალომე',   lastName: 'Goguadze',       lastNameKa: 'გოგუაძე',       dob: '2008-07-08', clubKey: 'batumi',   sex: 'FEMALE', weightKg: 47.6, categoryGroup: 'youth-girls-sanda', categoryWeightName: '48kg'  },
  { docId: '10000000041', firstName: 'Ana',      firstNameKa: 'ანა',      lastName: 'Maisuradze',     lastNameKa: 'მაისურაძე',     dob: '2009-02-25', clubKey: 'rustavi',  sex: 'FEMALE', weightKg: 55.5, categoryGroup: 'youth-girls-sanda', categoryWeightName: '56kg'  },
  { docId: '10000000042', firstName: 'Tamar',    firstNameKa: 'თამარი',   lastName: 'Tskhovrebadze',  lastNameKa: 'ცხოვრებაძე',    dob: '2010-09-17', clubKey: 'gori',     sex: 'FEMALE', weightKg: 64.8, categoryGroup: 'youth-girls-sanda', categoryWeightName: '65kg'  },
  { docId: '10000000043', firstName: 'Ekaterine',firstNameKa: 'ეკატერინე',lastName: 'Mgebrishvili',   lastNameKa: 'მგებრიშვილი',   dob: '2008-12-03', clubKey: 'zugdidi',  sex: 'FEMALE', weightKg: 69.9, categoryGroup: 'youth-girls-sanda', categoryWeightName: '70kg'  },
  { docId: '10000000044', firstName: 'Khatia',   firstNameKa: 'ხატია',    lastName: 'Sulaberidze',    lastNameKa: 'სულაბერიძე',    dob: '2009-06-08', clubKey: 'telavi',   sex: 'FEMALE', weightKg: 44.9, categoryGroup: 'youth-girls-sanda', categoryWeightName: '45kg'  },

  // ── Adult Men (18+ in 2025, born ≤2007) ──────────────────────────────────
  { docId: '10000000045', firstName: 'Giorgi',   firstNameKa: 'გიორგი',   lastName: 'Dgebuadze',      lastNameKa: 'დგებუაძე',      dob: '2004-04-12', clubKey: 'tbilisi',  sex: 'MALE',   weightKg: 69.8, categoryGroup: 'adults-men-sanda', categoryWeightName: '70kg'  },
  { docId: '10000000046', firstName: 'Davit',    firstNameKa: 'დავით',    lastName: 'Sulaberidze',    lastNameKa: 'სულაბერიძე',    dob: '2001-09-03', clubKey: 'tbilisi',  sex: 'MALE',   weightKg: 79.6, categoryGroup: 'adults-men-sanda', categoryWeightName: '80kg'  },
  { docId: '10000000047', firstName: 'Lasha',    firstNameKa: 'ლაშა',     lastName: 'Gabaidze',       lastNameKa: 'გაბაიძე',       dob: '2003-07-14', clubKey: 'kutaisi',  sex: 'MALE',   weightKg: 64.7, categoryGroup: 'adults-men-sanda', categoryWeightName: '65kg'  },
  { docId: '10000000048', firstName: 'Irakli',   firstNameKa: 'ირაკლი',   lastName: 'Khmaladze',      lastNameKa: 'ხმალაძე',       dob: '1999-11-28', clubKey: 'kutaisi',  sex: 'MALE',   weightKg: 74.5, categoryGroup: 'adults-men-sanda', categoryWeightName: '75kg'  },
  { docId: '10000000049', firstName: 'Zaza',     firstNameKa: 'ზაზა',     lastName: 'Chikhladze',     lastNameKa: 'ჩიხლაძე',       dob: '2002-03-17', clubKey: 'batumi',   sex: 'MALE',   weightKg: 89.5, categoryGroup: 'adults-men-sanda', categoryWeightName: '90kg'  },
  { docId: '10000000050', firstName: 'Tornike',  firstNameKa: 'თორნიკე',  lastName: 'Tsikarishvili',  lastNameKa: 'წიქარიშვილი',   dob: '2005-06-09', clubKey: 'batumi',   sex: 'MALE',   weightKg: 59.8, categoryGroup: 'adults-men-sanda', categoryWeightName: '60kg'  },
  { docId: '10000000051', firstName: 'Levan',    firstNameKa: 'ლევან',    lastName: 'Goguadze',       lastNameKa: 'გოგუაძე',       dob: '2000-12-25', clubKey: 'rustavi',  sex: 'MALE',   weightKg: 84.8, categoryGroup: 'adults-men-sanda', categoryWeightName: '85kg'  },
  { docId: '10000000052', firstName: 'Bachana',  firstNameKa: 'ბაჩანა',   lastName: 'Kakhidze',       lastNameKa: 'კახიძე',        dob: '2003-08-31', clubKey: 'rustavi',  sex: 'MALE',   weightKg: 69.4, categoryGroup: 'adults-men-sanda', categoryWeightName: '70kg'  },
  { docId: '10000000053', firstName: 'Nika',     firstNameKa: 'ნიკა',     lastName: 'Tskhovrebadze',  lastNameKa: 'ცხოვრებაძე',    dob: '2001-05-16', clubKey: 'gori',     sex: 'MALE',   weightKg: 55.7, categoryGroup: 'adults-men-sanda', categoryWeightName: '56kg'  },
  { docId: '10000000054', firstName: 'Sandro',   firstNameKa: 'სანდრო',   lastName: 'Maisuradze',     lastNameKa: 'მაისურაძე',     dob: '1998-10-04', clubKey: 'gori',     sex: 'MALE',   weightKg: 99.3, categoryGroup: 'adults-men-sanda', categoryWeightName: '100kg' },
  { docId: '10000000055', firstName: 'Akaki',    firstNameKa: 'აკაკი',    lastName: 'Mgebrishvili',   lastNameKa: 'მგებრიშვილი',   dob: '2006-01-22', clubKey: 'zugdidi',  sex: 'MALE',   weightKg: 47.9, categoryGroup: 'adults-men-sanda', categoryWeightName: '48kg'  },
  { docId: '10000000056', firstName: 'Davit',    firstNameKa: 'დავით',    lastName: 'Lominadze',      lastNameKa: 'ლომინაძე',      dob: '2004-03-08', clubKey: 'telavi',   sex: 'MALE',   weightKg: 51.6, categoryGroup: 'adults-men-sanda', categoryWeightName: '52kg'  },
  { docId: '10000000057', firstName: 'Gigi',     firstNameKa: 'გიგი',     lastName: 'Tsikarishvili',  lastNameKa: 'წიქარიშვილი',   dob: '2002-09-14', clubKey: 'telavi',   sex: 'MALE',   weightKg: 104.2,categoryGroup: 'adults-men-sanda', categoryWeightName: '+100kg'},
  { docId: '10000000058', firstName: 'Kote',     firstNameKa: 'კოტე',     lastName: 'Sulaberidze',    lastNameKa: 'სულაბერიძე',    dob: '1997-06-27', clubKey: 'poti',     sex: 'MALE',   weightKg: 59.9, categoryGroup: 'adults-men-sanda', categoryWeightName: '60kg'  },

  // ── Adult Women (18+ in 2025) ─────────────────────────────────────────────
  { docId: '10000000059', firstName: 'Nino',     firstNameKa: 'ნინო',     lastName: 'Mgebrishvili',   lastNameKa: 'მგებრიშვილი',   dob: '2003-06-15', clubKey: 'tbilisi',  sex: 'FEMALE', weightKg: 51.5, categoryGroup: 'adults-women-sanda', categoryWeightName: '52kg'  },
  { docId: '10000000060', firstName: 'Mariami',  firstNameKa: 'მარიამი',  lastName: 'Beridze',        lastNameKa: 'ბერიძე',        dob: '2001-03-28', clubKey: 'tbilisi',  sex: 'FEMALE', weightKg: 59.7, categoryGroup: 'adults-women-sanda', categoryWeightName: '60kg'  },
  { docId: '10000000061', firstName: 'Salome',   firstNameKa: 'სალომე',   lastName: 'Kvaratskhelia',  lastNameKa: 'კვარაცხელია',   dob: '2004-09-11', clubKey: 'kutaisi',  sex: 'FEMALE', weightKg: 47.8, categoryGroup: 'adults-women-sanda', categoryWeightName: '48kg'  },
  { docId: '10000000062', firstName: 'Ana',      firstNameKa: 'ანა',      lastName: 'Gogichashvili',  lastNameKa: 'გოგიჩაშვილი',   dob: '1999-12-22', clubKey: 'kutaisi',  sex: 'FEMALE', weightKg: 64.5, categoryGroup: 'adults-women-sanda', categoryWeightName: '65kg'  },
  { docId: '10000000063', firstName: 'Tamar',    firstNameKa: 'თამარი',   lastName: 'Mchedlishvili',  lastNameKa: 'მჭედლიშვილი',   dob: '2002-07-19', clubKey: 'batumi',   sex: 'FEMALE', weightKg: 55.3, categoryGroup: 'adults-women-sanda', categoryWeightName: '56kg'  },
  { docId: '10000000064', firstName: 'Ekaterine',firstNameKa: 'ეკატერინე',lastName: 'Kobiashvili',    lastNameKa: 'კობიაშვილი',    dob: '2005-04-03', clubKey: 'rustavi',  sex: 'FEMALE', weightKg: 69.6, categoryGroup: 'adults-women-sanda', categoryWeightName: '70kg'  },
  { docId: '10000000065', firstName: 'Nini',     firstNameKa: 'ნინი',     lastName: 'Chikvanaia',     lastNameKa: 'ჩიქვანაია',     dob: '2003-11-07', clubKey: 'gori',     sex: 'FEMALE', weightKg: 44.9, categoryGroup: 'adults-women-sanda', categoryWeightName: '45kg'  },
  { docId: '10000000066', firstName: 'Teona',    firstNameKa: 'თეონა',    lastName: 'Lominadze',      lastNameKa: 'ლომინაძე',      dob: '2000-08-24', clubKey: 'zugdidi',  sex: 'FEMALE', weightKg: 74.8, categoryGroup: 'adults-women-sanda', categoryWeightName: '75kg'  },
  { docId: '10000000067', firstName: 'Khatia',   firstNameKa: 'ხატია',    lastName: 'Dgebuadze',      lastNameKa: 'დგებუაძე',      dob: '2004-02-16', clubKey: 'telavi',   sex: 'FEMALE', weightKg: 51.8, categoryGroup: 'adults-women-sanda', categoryWeightName: '52kg'  },
  { docId: '10000000068', firstName: 'Rusudan',  firstNameKa: 'რუსუდანი', lastName: 'Sulaberidze',    lastNameKa: 'სულაბერიძე',    dob: '2001-06-30', clubKey: 'poti',     sex: 'FEMALE', weightKg: 59.6, categoryGroup: 'adults-women-sanda', categoryWeightName: '60kg'  },
  { docId: '10000000069', firstName: 'Lela',     firstNameKa: 'ლელა',     lastName: 'Goguadze',       lastNameKa: 'გოგუაძე',       dob: '1996-04-18', clubKey: 'poti',     sex: 'FEMALE', weightKg: 79.2, categoryGroup: 'adults-women-sanda', categoryWeightName: '+75kg' },

  // ── International Athletes ────────────────────────────────────────────────
  { docId: 'AZ-MM-1987',    firstName: 'Orkhan',   firstNameKa: null, lastName: 'Mammadov',   lastNameKa: null, dob: '2003-07-19', clubKey: 'baku',    sex: 'MALE',   weightKg: 69.5, categoryGroup: 'adults-men-sanda',   categoryWeightName: '70kg' },
  { docId: 'AZ-ER-2245',    firstName: 'Elchin',   firstNameKa: null, lastName: 'Rzayev',     lastNameKa: null, dob: '2001-04-25', clubKey: 'baku',    sex: 'MALE',   weightKg: 79.8, categoryGroup: 'adults-men-sanda',   categoryWeightName: '80kg' },
  { docId: 'AZ-AA-3301',    firstName: 'Aynur',    firstNameKa: null, lastName: 'Aliyeva',    lastNameKa: null, dob: '2003-04-12', clubKey: 'baku',    sex: 'FEMALE', weightKg: 51.3, categoryGroup: 'adults-women-sanda', categoryWeightName: '52kg' },
  { docId: 'TR-MY-4412',    firstName: 'Mehmet',   firstNameKa: null, lastName: 'Yildirim',   lastNameKa: null, dob: '2002-08-17', clubKey: 'ankara',  sex: 'MALE',   weightKg: 64.9, categoryGroup: 'adults-men-sanda',   categoryWeightName: '65kg' },
  { docId: 'TR-FD-5523',    firstName: 'Fatma',    firstNameKa: null, lastName: 'Demir',      lastNameKa: null, dob: '2001-09-03', clubKey: 'ankara',  sex: 'FEMALE', weightKg: 59.8, categoryGroup: 'adults-women-sanda', categoryWeightName: '60kg' },
  { docId: 'TR-EK-6634',    firstName: 'Emre',     firstNameKa: null, lastName: 'Kaya',       lastNameKa: null, dob: '2004-03-21', clubKey: 'ankara',  sex: 'MALE',   weightKg: 74.7, categoryGroup: 'adults-men-sanda',   categoryWeightName: '75kg' },
  { docId: 'AM-AG-7745',    firstName: 'Armen',    firstNameKa: null, lastName: 'Grigoryan',  lastNameKa: null, dob: '2000-11-09', clubKey: 'yerevan', sex: 'MALE',   weightKg: 84.5, categoryGroup: 'adults-men-sanda',   categoryWeightName: '85kg' },
  { docId: 'AM-NK-8856',    firstName: 'Naira',    firstNameKa: null, lastName: 'Karapetyan', lastNameKa: null, dob: '2002-06-14', clubKey: 'yerevan', sex: 'FEMALE', weightKg: 64.3, categoryGroup: 'adults-women-sanda', categoryWeightName: '65kg' },
];

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

type EventSeed = {
  name: string;
  nameKa: string;
  slug: string;
  location: string;
  lifecycle: 'REG_OPEN' | 'LOCKED' | 'WEIGHIN' | 'WEIGH_IN_COMPLETED' | 'DRAWN' | 'PUBLISHED' | 'LIVE' | 'COMPLETED';
  published: boolean;
  registrationStartDate: Date;
  registrationEndDate: Date;
  weighInStartDate: Date;
  weighInEndDate: Date;
  competitionStartDate: Date;
  competitionEndDate: Date;
  // which athletes (by docId) participate, with their registration status
  registrations: Array<{
    docId: string;
    status: 'PENDING' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';
    weighInStatus: 'NOT_WEIGHED' | 'PASSED' | 'MOVED_UP' | 'FAILED' | 'OVERRIDE_APPROVED' | 'REWEIGH_ALLOWED' | 'DISQUALIFIED';
  }>;
};

const EVENTS: EventSeed[] = [
  // ── COMPLETED EVENT: Georgian National Championship (Spring 2026) ─────────
  {
    name:     'Georgian National Wushu Championship — Spring 2026',
    nameKa:   'საქართველოს ვუშუს ეროვნული ჩემპიონატი — გაზაფხული 2026',
    slug:     'ge-national-spring-2026',
    location: 'Tbilisi Sports Palace, Tbilisi',
    lifecycle: 'COMPLETED',
    published: true,
    registrationStartDate: new Date('2026-01-15T08:00:00Z'),
    registrationEndDate:   new Date('2026-03-10T23:59:59Z'),
    weighInStartDate:      new Date('2026-03-20T08:00:00Z'),
    weighInEndDate:        new Date('2026-03-20T18:00:00Z'),
    competitionStartDate:  new Date('2026-03-21T09:00:00Z'),
    competitionEndDate:    new Date('2026-03-22T18:00:00Z'),
    registrations: [
      // Adult men
      { docId: '10000000045', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000046', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000047', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000048', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000049', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000050', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000051', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000052', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000053', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000054', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000055', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000056', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000057', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000058', status: 'APPROVED', weighInStatus: 'PASSED' },
      // Adult women
      { docId: '10000000059', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000060', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000061', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000062', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000063', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000064', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000065', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000066', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000067', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000068', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000069', status: 'APPROVED', weighInStatus: 'PASSED' },
      // Youth boys
      { docId: '10000000029', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000030', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000031', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000032', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000033', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000034', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000035', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000036', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000037', status: 'APPROVED', weighInStatus: 'PASSED' },
      // Youth girls
      { docId: '10000000038', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000039', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000040', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000041', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000042', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000043', status: 'APPROVED', weighInStatus: 'PASSED' },
      { docId: '10000000044', status: 'APPROVED', weighInStatus: 'PASSED' },
      // One withdrawn
      { docId: '10000000057', status: 'WITHDRAWN', weighInStatus: 'NOT_WEIGHED' },
    ],
  },

  // ── UPCOMING EVENT: International Tournament starting tomorrow (2026-06-01) ─
  {
    name:     'Tbilisi International Wushu Tournament — Summer 2026',
    nameKa:   'თბილისის საერთაშორისო ვუშუს ტურნირი — ზაფხული 2026',
    slug:     'tbilisi-international-summer-2026',
    location: 'Dinamo Arena Sports Complex, Tbilisi',
    lifecycle: 'REG_OPEN',
    published: true,
    registrationStartDate: new Date('2026-04-01T08:00:00Z'),
    registrationEndDate:   new Date('2026-05-31T23:59:59Z'),
    weighInStartDate:      new Date('2026-06-01T07:00:00Z'),
    weighInEndDate:        new Date('2026-06-01T11:00:00Z'),
    competitionStartDate:  new Date('2026-06-01T12:00:00Z'),
    competitionEndDate:    new Date('2026-06-03T18:00:00Z'),
    registrations: [
      // Adult men — approved Georgian competitors
      { docId: '10000000045', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000046', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000047', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000048', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000050', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000051', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000052', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000053', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000056', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000058', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      // International men — approved
      { docId: 'AZ-MM-1987',  status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: 'AZ-ER-2245',  status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: 'TR-MY-4412',  status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: 'TR-EK-6634',  status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: 'AM-AG-7745',  status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      // Adult women — approved
      { docId: '10000000059', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000060', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000061', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000063', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000064', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000066', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000068', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      // International women — approved
      { docId: 'AZ-AA-3301',  status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: 'TR-FD-5523',  status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: 'AM-NK-8856',  status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      // Youth boys — approved
      { docId: '10000000029', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000030', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000031', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000032', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      // Youth girls — approved
      { docId: '10000000038', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000039', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000040', status: 'APPROVED', weighInStatus: 'NOT_WEIGHED' },
      // Submitted, awaiting approval
      { docId: '10000000049', status: 'SUBMITTED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000054', status: 'SUBMITTED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000057', status: 'SUBMITTED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000062', status: 'SUBMITTED', weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000067', status: 'SUBMITTED', weighInStatus: 'NOT_WEIGHED' },
      // Pending coach submission
      { docId: '10000000041', status: 'PENDING',  weighInStatus: 'NOT_WEIGHED' },
      { docId: '10000000042', status: 'PENDING',  weighInStatus: 'NOT_WEIGHED' },
      // Rejected
      { docId: '10000000055', status: 'REJECTED', weighInStatus: 'NOT_WEIGHED' },
    ],
  },
];

// ---------------------------------------------------------------------------
// Seed runner
// ---------------------------------------------------------------------------

export async function runMockDataSeed() {
  // Check if org already exists — skip everything if so
  const existing = await prisma.organisation.findUnique({ where: { slug: ORG_SLUG } });
  if (existing) {
    console.log(`Mock data already seeded (org "${ORG_SLUG}" exists). Skipping.`);
    return;
  }

  console.log('Seeding Georgian Wushu Federation mock data…');

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // 1. Organisation
  const org = await prisma.organisation.create({
    data: { name: 'Georgian Wushu Federation', slug: ORG_SLUG },
  });
  console.log(`  ✓ Organisation: ${org.name}`);

  // 2. Countries + default regions (one region per country, named after it)
  const countryMap = new Map<string, string>(); // code → countryId
  const regionMap = new Map<string, string>();   // code → default regionId
  const usedCountryCodes = [...new Set(CLUBS.map((c) => c.country))];
  for (const code of usedCountryCodes) {
    const meta = COUNTRIES[code];
    if (!meta) throw new Error(`Unknown country code: ${code}`);
    const country = await prisma.country.create({
      data: { organisationId: org.id, name: meta.name, nameKa: meta.nameKa, code: meta.code },
    });
    countryMap.set(code, country.id);
    const region = await prisma.region.create({
      data: { organisationId: org.id, countryId: country.id, name: meta.name, nameKa: meta.nameKa },
    });
    regionMap.set(code, region.id);
  }
  console.log(`  ✓ Countries: ${usedCountryCodes.length}`);

  // 3. Clubs
  const clubMap = new Map<string, string>(); // key → id
  const clubGeoByKey = new Map<string, { countryId: string; regionId: string }>();
  for (const c of CLUBS) {
    const countryId = countryMap.get(c.country);
    const regionId = regionMap.get(c.country);
    if (!countryId || !regionId) throw new Error(`Geography not found for country: ${c.country}`);
    const club = await prisma.club.create({
      data: {
        organisationId: org.id,
        name: c.name,
        nameKa: c.nameKa ?? null,
        city: c.city,
        countryId,
        regionId,
      },
    });
    clubMap.set(c.key, club.id);
    clubGeoByKey.set(c.key, { countryId, regionId });
  }
  console.log(`  ✓ Clubs: ${CLUBS.length}`);

  // 4. Admin users
  for (const a of ADMINS) {
    await prisma.user.create({
      data: {
        organisationId: org.id,
        email: a.email,
        displayName: a.displayName,
        passwordHash,
        role: 'admin',
      },
    });
  }
  console.log(`  ✓ Admins: ${ADMINS.length}`);

  // 5. Coach users
  for (const c of COACHES) {
    const clubId = clubMap.get(c.clubKey);
    const geo = clubGeoByKey.get(c.clubKey);
    if (!clubId || !geo) throw new Error(`Club key not found: ${c.clubKey}`);
    await prisma.user.create({
      data: {
        organisationId: org.id,
        email: c.email,
        displayName: c.displayName,
        passwordHash,
        role: 'coach',
        clubId,
        countryId: geo.countryId,
        regionId: geo.regionId,
        nationality: c.nationality,
      },
    });
  }
  console.log(`  ✓ Coaches: ${COACHES.length}`);

  // 6. Athletes
  const athleteMap = new Map<string, string>(); // docId → athleteId
  for (const a of ATHLETES) {
    const clubId = clubMap.get(a.clubKey);
    const geo = clubGeoByKey.get(a.clubKey);
    if (!clubId || !geo) throw new Error(`Club key not found: ${a.clubKey}`);
    const athlete = await prisma.athlete.create({
      data: {
        organisationId: org.id,
        clubId,
        countryId:   geo.countryId,
        regionId:    geo.regionId,
        firstName:   a.firstName,
        firstNameKa: a.firstNameKa,
        lastName:    a.lastName,
        lastNameKa:  a.lastNameKa,
        dateOfBirth: new Date(a.dob),
        documentId:  a.docId,
        sex:         a.sex,
      },
    });
    athleteMap.set(a.docId, athlete.id);
  }
  console.log(`  ✓ Athletes: ${ATHLETES.length}`);

  // Build a quick lookup: docId → athlete row (for categoryCode)
  const athleteRowByDocId = new Map(ATHLETES.map((a) => [a.docId, a]));

  // 7. Events + registrations
  for (const ev of EVENTS) {
    const event = await prisma.event.create({
      data: {
        organisationId:       org.id,
        name:                 ev.name,
        nameKa:               ev.nameKa,
        slug:                 ev.slug,
        location:             ev.location,
        timezone:             'Asia/Tbilisi',
        lifecycle:            ev.lifecycle,
        published:            ev.published,
        registrationStartDate: ev.registrationStartDate,
        registrationEndDate:  ev.registrationEndDate,
        weighInStartDate:     ev.weighInStartDate,
        weighInEndDate:       ev.weighInEndDate,
        competitionStartDate: ev.competitionStartDate,
        competitionEndDate:   ev.competitionEndDate,
        dates: {
          range: {
            startDate: ev.competitionStartDate.toISOString().slice(0, 10),
            endDate:   ev.competitionEndDate.toISOString().slice(0, 10),
          },
          registrationDays: [ev.weighInStartDate.toISOString().slice(0, 10)],
          fightDays: (() => {
            const days: string[] = [];
            const cur = new Date(ev.competitionStartDate);
            while (cur <= ev.competitionEndDate) {
              days.push(cur.toISOString().slice(0, 10));
              cur.setDate(cur.getDate() + 1);
            }
            return days;
          })(),
        },
      },
    });

    // Deduplicate registrations (same docId can't register twice per event)
    const seen = new Set<string>();
    let regCount = 0;
    for (const r of ev.registrations) {
      if (seen.has(r.docId)) continue;
      seen.add(r.docId);

      const athleteId = athleteMap.get(r.docId);
      if (!athleteId) {
        console.warn(`    ⚠ Athlete docId ${r.docId} not found, skipping registration`);
        continue;
      }
      const athleteRow = athleteRowByDocId.get(r.docId);
      const clubId = athleteRow ? clubMap.get(athleteRow.clubKey) : undefined;
      const categoryCode = athleteRow?.categoryWeightName ?? 'Unknown';

      await prisma.registration.create({
        data: {
          organisationId: org.id,
          eventId:        event.id,
          athleteId,
          clubId:         clubId ?? null,
          categoryCode,
          status:         r.status,
          weighInStatus:  r.weighInStatus,
        },
      });
      regCount++;
    }
    console.log(`  ✓ Event "${ev.name}": ${regCount} registrations`);
  }

  console.log('\nMock data seed complete.');
  console.log(`  Login with any user at password: ${DEFAULT_PASSWORD}`);
  console.log(`  Admin: ${ADMINS[0].email}`);
}

async function main() {
  try {
    await runMockDataSeed();
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void main();
}
