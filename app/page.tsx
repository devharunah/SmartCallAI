import { CallToAction, Footer } from "@/components/landing/cta-footer";
import { FAQs } from "@/components/landing/faqs";
import { Features } from "@/components/landing/features";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";

export default function Home() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <FAQs />
      <CallToAction />
      <Footer />
    </>
  );
}
