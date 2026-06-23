import { SiteHeader } from "@/components/landing/site-header";
import { Hero } from "@/components/landing/hero";
import { LocalProof } from "@/components/landing/local-proof";
import { ProblemSolution } from "@/components/landing/problem-solution";
import { HowItWorks } from "@/components/landing/how-it-works";
import { PricingTeaser } from "@/components/landing/pricing-teaser";
import { FinalCta } from "@/components/landing/final-cta";
import { SiteFooter } from "@/components/landing/site-footer";

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <LocalProof />
        <ProblemSolution />
        <HowItWorks />
        <PricingTeaser />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
