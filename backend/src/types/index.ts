// ─── Profil utilisateur public ────────────────────────────────
// Champs retournés par l'API — ne contient JAMAIS pin_hash / password_hash

export interface UserPublic {
  id:                 string;
  firstName:          string;
  lastName:           string;
  email:              string;
  phone:              string | null;
  address:            string | null;
  birthDate:          string | null;
  age:                number | null;
  role:               'parent' | 'child' | 'solo';
  parentType:         'papa' | 'maman' | 'beau-pere' | 'belle-mere' | null;
  status:             'separated' | 'divorced' | null;
  childrenCount:      number;
  language:           string;
  themeId:            string;
  calendarColor:      string;
  calendarColorText:  string;
  emailVerified:      boolean;
  onboardingCompleted: boolean;
  createdAt:          string;
  updatedAt:          string;
}

// ─── Ligne brute retournée par PostgreSQL ─────────────────────
// (snake_case, inclut les champs sensibles — usage interne uniquement)
export interface UserRow {
  id:                   string;
  first_name:           string;
  last_name:            string;
  email:                string;
  phone:                string | null;
  address:              string | null;
  birth_date:           string | null;
  age:                  number | null;  // calculé depuis birth_date, pas en DB
  role:                 string;
  parent_type:          string | null;
  status:               string | null;
  children_count:       number;
  pin_hash:             string;
  password_hash:        string | null;
  push_token:           string | null;
  onboarding_completed: boolean;
  language:             string;
  theme_id:             string;
  calendar_color:       string;
  calendar_color_text:  string;
  email_verified:       boolean;
  created_at:           string;
  updated_at:           string;
}

/** Convertit une ligne DB en objet public (sans champs sensibles). */
export function toPublicUser(row: UserRow): UserPublic {
  return {
    id:                  row.id,
    firstName:           row.first_name,
    lastName:            row.last_name,
    email:               row.email,
    phone:               row.phone,
    address:             row.address,
    birthDate:           row.birth_date,
    age:                 row.birth_date
                            ? Math.floor((Date.now() - new Date(row.birth_date).getTime()) / 31557600000)
                            : null,
    role:                row.role as UserPublic['role'],
    parentType:          row.parent_type as UserPublic['parentType'],
    status:              row.status as UserPublic['status'],
    childrenCount:       row.children_count,
    language:            row.language,
    themeId:             row.theme_id,
    calendarColor:       row.calendar_color,
    calendarColorText:   row.calendar_color_text,
    emailVerified:       row.email_verified,
    onboardingCompleted: row.onboarding_completed,
    createdAt:           row.created_at,
    updatedAt:           row.updated_at,
  };
}
