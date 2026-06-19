// Curated amenities for the property form's toggle chips. The DB column (properties.amenities)
// stays a free jsonb string[] — this only drives the operator picker. Each label is worded to
// match a keyword in the public ICON_RULES (components/public/amenities-section.tsx) so curated
// picks always resolve a correct icon. Operators can still add anything else via the "Other" field
// (those fall back to a neutral check icon on the public page).
export const AMENITY_OPTIONS = [
  "WiFi",
  "Parking",
  "Hot shower",
  "Air conditioning",
  "Electric fan",
  "Kitchen",
  "Free breakfast",
  "Coffee maker",
  "Cable TV",
  "Refrigerator",
  "Laundry",
  "Pet friendly",
  "Backup generator",
  "Balcony / view",
  "Beach access",
  "Swimming pool",
  "Surfboard rental",
  "Fresh towels",
] as const;
