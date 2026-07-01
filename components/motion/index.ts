// Shared scroll primitives — CSS-driven (IntersectionObserver toggles a class; the fade/rise is
// pure CSS in globals.css), so importing these ships no animation library to the client. Keep them
// the only "use client" leaves so pages/sections can stay Server Components.
export { Reveal } from "@/components/landing/reveal";
export { Stagger, StaggerItem } from "./stagger";
