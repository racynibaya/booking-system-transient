// Curated San Juan, La Union areas/surf spots for the property form's area select.
// The DB column stays free `text`; this just drives the dropdown options.
export const SAN_JUAN_AREAS = [
  "Urbiztondo",
  "Monaliza",
  "Kahuna",
  "Sebay",
  "Bractan",
  "Carille",
  "Mona Liza",
  "Bacnotan",
] as const;

export type SanJuanArea = (typeof SAN_JUAN_AREAS)[number];
