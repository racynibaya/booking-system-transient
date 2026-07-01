import { SiteHeader } from "@/components/landing/site-header";
import { Hero } from "@/components/landing/hero";
import { LocalProof } from "@/components/landing/local-proof";
import { ProblemSolution } from "@/components/landing/problem-solution";
import { HowItWorks } from "@/components/landing/how-it-works";
import { CommissionPricing } from "@/components/landing/commission-pricing";
import { FinalCta } from "@/components/landing/final-cta";
import { SiteFooter } from "@/components/landing/site-footer";
import { HashScroll } from "@/components/landing/hash-scroll";

export default function AboutPage() {
  return (
    <>
      <HashScroll />
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <LocalProof />
        <ProblemSolution />
        <HowItWorks />
        <CommissionPricing />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
