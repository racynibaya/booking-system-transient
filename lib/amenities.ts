// Curated amenities for the property form's toggle chips, bucketed into the categories operators
// scan by. The DB column (properties.amenities) stays a free jsonb string[] — this only drives the
// operator picker and its grouping; the public page renders a flat list. Each label is worded to
// match a keyword in the public ICON_RULES (components/public/amenities-section.tsx) so curated
// picks always resolve a correct icon. Operators can still add anything else via the "Other" field
// (those fall back to a neutral check icon on the public page).
export const AMENITY_GROUPS = [
  {
    label: "Essentials",
    items: ["WiFi", "Parking", "Hot shower", "Backup generator", "Fresh towels", "Laundry"],
  },
  {
    label: "Comfort",
    items: ["Air conditioning", "Electric fan", "Cable TV", "Pet friendly"],
  },
  {
    label: "Kitchen & food",
    items: ["Kitchen", "Refrigerator", "Coffee maker", "Free breakfast"],
  },
  {
    label: "Outdoors & beach",
    items: ["Swimming pool", "Beach access", "Balcony / view", "Surfboard rental"],
  },
] as const;

// Flat list of every curated label — used to tell curated picks apart from operator "Other" entries.
export const AMENITY_OPTIONS: readonly string[] = AMENITY_GROUPS.flatMap((g) => g.items);
